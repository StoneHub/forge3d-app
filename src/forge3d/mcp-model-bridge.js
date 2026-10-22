import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createAssemblyPart, createAssemblyGeometryFromStlBytes } from './assembly.js';
import { assertAssemblyCapacity, assertAssemblyRevision, validateAssemblyTransform, getMcpAssemblySnapshot, updateMcpAssemblyPart, duplicateMcpAssemblyPart, removeMcpAssemblyPart, selectMcpAssemblyExportParts, exportMcpAssemblyStl } from './mcp-assembly.js';
import { getMcpPrintSnapshot, prepareMcpPrint } from './mcp-print.js';
import { isCurrentDesignRender } from './assembly-refresh.js';
import { applyMcpParameters, assertMcpRevision, getMcpParameters, mcpTextResult } from './mcp-model.js';

// Minimized/background windows may suspend RAF. Rendering must still finish;
// captures fail explicitly rather than hanging until the whole session dies.
const settleViewport = () => new Promise((resolve) => {
  let first, second;
  const timer = setTimeout(() => { cancelAnimationFrame(first); cancelAnimationFrame(second); resolve(false); }, 1500);
  first = requestAnimationFrame(() => {
    second = requestAnimationFrame(() => { clearTimeout(timer); resolve(true); });
  });
});

// This hook has no effect in an ordinary desktop session. Commands share the
// same undo history, renderer, native diagnostics and viewport as UI actions.
export function useMcpModelBridge(options) {
  const latest = useRef(options);
  latest.current = options;
  const identity = `${options.document.documentId}\0${options.document.filePath || ''}\0${options.document.sourceCode}`;
  const version = useRef({ identity, revision: 0 });
  if (version.current.identity !== identity) version.current = { identity, revision: version.current.revision + 1 };

  const assemblyVersion = useRef({ scene: options.assemblyScene, revision: 0 });
  if (assemblyVersion.current.scene !== options.assemblyScene) assemblyVersion.current = { scene: options.assemblyScene, revision: assemblyVersion.current.revision + 1 };
  const assemblyRendering = useRef(false);

  useEffect(() => {
    let disposed = false, removeListener;
    const getSnapshot = () => {
      const o = latest.current;
      const geometry = o.geometryRef.current, renderMeta = o.renderMetaRef.current;
      const building = Boolean(o.renderRequestIdRef.current);
      const current = isCurrentDesignRender({ geometry, renderMeta, document: o.document, building });
      const box = current ? geometry.boundingBox : null;
      return {
        code: o.document.sourceCode, fileName: o.fileName, filePath: o.document.filePath,
        revision: version.current.revision, dirty: o.dirty, mode: o.mode,
        parameters: getMcpParameters(o.document.sourceCode),
        render: {
          building, current, profile: current ? renderMeta.profileId : null,
          triangles: current ? geometry.attributes.position.count / 3 : 0,
          bounds: box ? { min: box.min.toArray(), max: box.max.toArray(), units: 'mm', coordinateSystem: 'OpenSCAD Z-up' } : null,
        },
        diagnostics: { errors: o.result.errors, warnings: o.result.warnings },
      };
    };
    const assemblySnapshot = () => getMcpAssemblySnapshot(latest.current.assemblyScene, assemblyVersion.current.revision, latest.current.mode);
    const assertAssemblyEditable = (expectedRevision) => {
      assertAssemblyRevision(assemblyVersion.current.revision, expectedRevision);
      if (latest.current.renderRequestIdRef.current || latest.current.assemblyBooleanBusy || assemblyRendering.current) throw new Error('A model operation is running. Wait before editing the assembly.');
    };
    const commitAssembly = (nextScene) => {
      flushSync(() => {
        latest.current.disableAutoRun();
        latest.current.updateAssemblyScene(nextScene);
        latest.current.showMode('assembly');
        latest.current.fitAssembly();
      });
    };
    const handle = async ({ name, arguments: args = {} }) => {
      if (name === 'forge3d_get_assembly') return mcpTextResult(assemblySnapshot());
      if (name === 'forge3d_get_print') return mcpTextResult({ revision: assemblyVersion.current.revision, ...getMcpPrintSnapshot(latest.current.assemblyScene, args) });
      if (name === 'forge3d_prepare_print') {
        assertAssemblyEditable(args.expectedRevision);
        const prepared = prepareMcpPrint(latest.current.assemblyScene, args);
        commitAssembly(prepared.scene);
        return mcpTextResult({ revision: assemblyVersion.current.revision, ...prepared.print });
      }
      if (name === 'forge3d_set_mode') {
        if (latest.current.renderRequestIdRef.current || latest.current.assemblyBooleanBusy) throw new Error('Wait for the current model operation before switching mode.');
        if (!['design', 'assembly'].includes(args.mode)) throw new Error('Mode must be design or assembly.');
        flushSync(() => latest.current.showMode(args.mode));
        await settleViewport();
        return mcpTextResult({ mode: latest.current.mode });
      }
      if (name === 'forge3d_add_assembly_part') {
        assertAssemblyEditable(args.expectedRevision);
        validateAssemblyTransform(args.transform || {});
        assertAssemblyCapacity(latest.current.assemblyScene, 0, 1);
        if (typeof args.code !== 'string' || !args.code.trim()) throw new Error('Provide OpenSCAD source for the new part.');
        assemblyRendering.current = true;
        flushSync(() => { latest.current.disableAutoRun(); latest.current.setStatusMessage(`Rendering assembly part ${args.name || 'Part'}...`); });
        let geometry;
        try {
          const response = await latest.current.forgeAPI.renderOpenSCAD(args.code, { sourceName: `${args.name || 'Part'}.scad`, requestId: `mcp-assembly-${crypto.randomUUID()}` });
          if (response.error) throw new Error(typeof response.error === 'string' ? response.error : JSON.stringify(response.error));
          assertAssemblyRevision(assemblyVersion.current.revision, args.expectedRevision);
          geometry = createAssemblyGeometryFromStlBytes(response.stl);
          if (!geometry.getAttribute('position').count) throw new Error('OpenSCAD produced no geometry.');
          assertAssemblyCapacity(latest.current.assemblyScene, geometry.getAttribute('position').count / 3, 1);
          const part = createAssemblyPart({ name: args.name || 'Part', source: { kind: 'mcp-openscad', code: args.code }, geometry, transform: args.transform });
          commitAssembly({ ...latest.current.assemblyScene, parts: [...latest.current.assemblyScene.parts, part], selectedPartId: part.id });
          latest.current.setStatusMessage(`Added ${part.name} to Assembly Mode`);
          return mcpTextResult({ ...assemblySnapshot(), addedPartId: part.id, diagnostics: { stdout: response.stdout, stderr: response.stderr } });
        } finally { assemblyRendering.current = false; geometry?.dispose(); }
      }
      if (['forge3d_update_assembly_part', 'forge3d_duplicate_assembly_part', 'forge3d_remove_assembly_part'].includes(name)) {
        assertAssemblyEditable(args.expectedRevision);
        const scene = latest.current.assemblyScene;
        const nextScene = name === 'forge3d_update_assembly_part' ? updateMcpAssemblyPart(scene, args)
          : name === 'forge3d_duplicate_assembly_part' ? duplicateMcpAssemblyPart(scene, args) : removeMcpAssemblyPart(scene, args.partId);
        commitAssembly(nextScene);
        return mcpTextResult(assemblySnapshot());
      }
      if (name === 'forge3d_export_assembly_stl') {
        assertAssemblyEditable(args.expectedRevision);
        const snapshot = assemblySnapshot();
        const parts = selectMcpAssemblyExportParts(latest.current.assemblyScene, args.partIds);
        return { assemblyStlContent: exportMcpAssemblyStl(latest.current.assemblyScene, args.partIds), model: {
          revision: snapshot.revision, parts: parts.length, partIds: parts.map((part) => part.id),
          triangles: parts.reduce((sum, part) => sum + part.geometry.getAttribute('position').count / 3, 0),
          units: 'mm', coordinateSystem: 'OpenSCAD Z-up',
          note: 'Combined visible meshes; overlapping parts are not boolean-unioned.',
        } };
      }
      const state = getSnapshot();
      if (name === 'forge3d_get_model') return mcpTextResult(state);
      if (name === 'forge3d_set_code' || name === 'forge3d_set_parameters') {
        assertMcpRevision({ ...state, building: state.render.building }, args.expectedRevision);
        const code = name === 'forge3d_set_code' ? args.code : applyMcpParameters(state.code, args.values);
        flushSync(() => {
          latest.current.disableAutoRun();
          latest.current.applyCodeChange(code);
          latest.current.setStatusMessage('MCP updated the design buffer (not saved to disk)');
          latest.current.showParameters();
        });
        return mcpTextResult(getSnapshot());
      }
      if (name === 'forge3d_render') {
        if (state.mode !== 'design') throw new Error('Return to Design mode before rendering through MCP.');
        if (state.render.building) throw new Error('A render is already running. Wait for it to finish.');
        if (!state.code.trim()) throw new Error('The model is empty. Set OpenSCAD source before rendering.');
        const profile = args.profile || 'final';
        flushSync(() => latest.current.prepareRender(profile));
        const ok = await latest.current.runCode({ profileId: profile });
        await settleViewport();
        const rendered = getSnapshot();
        if (!ok || !rendered.render.current || rendered.revision !== state.revision) {
          return { ...mcpTextResult({ error: 'Render failed, was cancelled, or the model changed. Inspect diagnostics and render again.', ...rendered }), isError: true };
        }
        return mcpTextResult(rendered);
      }
      if (name === 'forge3d_export_stl') {
        if (state.mode !== 'design' || !state.render.current || state.render.profile !== 'final') {
          throw new Error('A successful final render of the current Design model is required before STL export.');
        }
        return {
          nativeRenderRequestId: latest.current.renderMetaRef.current.requestId,
          model: { revision: state.revision, triangles: state.render.triangles, bounds: state.render.bounds },
        };
      }
      if (name === 'forge3d_capture_viewport') {
        if (state.mode === 'design' && !state.render.current) throw new Error('Render the current Design model before capturing its viewport.');
        const capturedAssemblyRevision = assemblyVersion.current.revision;
        if (state.mode === 'assembly' && !latest.current.assemblyScene.parts.some((part) => part.visible !== false)) throw new Error('Add a visible assembly part before capturing its viewport.');
        const visible = await settleViewport();
        const current = getSnapshot();
        if (!visible) throw new Error('The viewport is not drawing. Restore the Forge3D window and try capture again.');
        if (current.mode !== state.mode || (state.mode === 'design' ? !current.render.current || state.revision !== current.revision : assemblyVersion.current.revision !== capturedAssemblyRevision)) throw new Error('The model or mode changed before capture. Read the current state and capture again.');
        const canvas = latest.current.canvasRef.current;
        if (!canvas?.width || !canvas?.height) throw new Error('The viewport is not ready.');
        const data = canvas.toDataURL('image/png').split(',')[1];
        if (!data) throw new Error('Viewport capture returned no image.');
        return { content: [{ type: 'image', mimeType: 'image/png', data }] };
      }
      throw new Error(`Unknown modeling tool: ${name}`);
    };

    options.forgeAPI.getLaunchContext().then((context) => {
      if (disposed || !context?.mcp?.enabled) return;
      removeListener = options.forgeAPI.onMcpRequest(async (request) => {
        try {
          const result = await handle(request);
          if (!disposed) options.forgeAPI.respondToMcp({ id: request.id, result });
        } catch (error) {
          if (!disposed) options.forgeAPI.respondToMcp({ id: request.id, error: error.message });
        }
      });
      options.forgeAPI.notifyMcpReady();
    }).catch(() => {});
    return () => { disposed = true; removeListener?.(); };
  }, [options.forgeAPI]);
}
