import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import Icons from "./forge3d/icons.jsx";
import { useThreeRenderer } from "./forge3d/renderer.js";
import { EXAMPLE_LIBRARY } from "./forge3d/examples.js";
import { STORAGE_KEY, DEFAULT_FILE_NAME, getDefaultWorkspace, loadWorkspace } from "./forge3d/workspace.js";
import { CodeEditor } from "./forge3d/editor.jsx";
import { exportSceneToSTL } from "./forge3d/exporter.js";
import { parseSTL } from "./forge3d/stl-parser.js";
import { useLSP } from "./forge3d/lsp-client.js";
import { parseParams, applyParamChange } from "./forge3d/param-parser.js";
import { requireForgeAPI } from "./forge3d/forge-api.js";
import ForgeToolbar from "./forge3d/toolbar.jsx";
import StatusBar from "./forge3d/status-bar.jsx";
import ExamplesSidebar from "./forge3d/examples-sidebar.jsx";
import WorkspaceSidebar from "./forge3d/workspace-sidebar.jsx";
import ParamsSidebar from "./forge3d/params-sidebar.jsx";
import BottomPane from "./forge3d/bottom-pane.jsx";
import ViewportPane from "./forge3d/viewport-pane.jsx";
import { getThemeColors } from "./forge3d/theme.js";

// ─── HISTORY ────────────────────────────────────────────────────────
function createHistoryState(initialCode) {
  return { past: [], present: initialCode, future: [] };
}

// ─── MAIN APP ────────────────────────────────────────────────────────
export default function Forge3D() {
  const initialWorkspace = useMemo(() => loadWorkspace(), []);
  const initialPanelLayout = initialWorkspace.panelLayout || {};
  const [history, setHistory] = useState(() => createHistoryState(initialWorkspace.code));
  const code = history.present;
  const [result, setResult] = useState({ objects: [], logs: [], errors: [], warnings: [], variables: {} });
  const [activeTab, setActiveTab] = useState('console');
  const [viewSettings, setViewSettings] = useState(initialWorkspace.viewSettings);
  const [sidebarOpen, setSidebarOpen] = useState(initialPanelLayout.sidebarOpen ?? true);
  const [sidebarTab, setSidebarTab] = useState('examples');
  const [autoRun, setAutoRun] = useState(initialWorkspace.autoRun);
  const [buildTime, setBuildTime] = useState(0);
  const [currentFileName, setCurrentFileName] = useState(initialWorkspace.currentFileName || DEFAULT_FILE_NAME);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [lastSavedCode, setLastSavedCode] = useState(initialWorkspace.code);
  const [statusMessage, setStatusMessage] = useState('Workspace restored');
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [fitViewSignal, setFitViewSignal] = useState(0);
  const [theme, setTheme] = useState(initialWorkspace.theme || 'dark');
  const appRef = useRef(null);
  const contentRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const editorRef = useRef(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [stlGeometry, setStlGeometry] = useState(null);
  const [building, setBuilding] = useState(false);
  const [lspDiagnostics, setLspDiagnostics] = useState({ errors: [], warnings: [] });
  const forgeAPI = requireForgeAPI();

  // ─── Phase 1 state ──────────────────────────────────────────────────
  const [recentFiles, setRecentFiles] = useState([]);
  const [workspaceFolder, setWorkspaceFolder] = useState(null);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [parsedParams, setParsedParams] = useState([]);
  const [exampleSearch, setExampleSearch] = useState('');

  const filteredExamples = useMemo(() => {
    const q = exampleSearch.trim().toLowerCase();
    if (!q) return EXAMPLE_LIBRARY;
    return EXAMPLE_LIBRARY.filter(({ name, category, summary }) =>
      [name, category, summary].some(v => v.toLowerCase().includes(q))
    );
  }, [exampleSearch]);

  const groupedExamples = useMemo(() => {
    return filteredExamples.reduce((acc, item) => {
      const group = item.category || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    }, {});
  }, [filteredExamples]);

  // ─── Resizable panels ───────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(initialPanelLayout.sidebarWidth ?? 240);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(initialPanelLayout.bottomPanelHeight ?? 180);
  const [editorWidth, setEditorWidth] = useState(initialPanelLayout.editorWidth ?? 480);
  const resizingRef = useRef(null); // null | 'sidebar' | 'bottom' | 'editor'
  const dragStartRef = useRef({});
  const shouldAutoFitViewRef = useRef(true);

  const DEFAULT_SIDEBAR_WIDTH = 240;
  const DEFAULT_EDITOR_WIDTH = 480;
  const DEFAULT_BOTTOM_PANEL_HEIGHT = 180;
  const MIN_SIDEBAR_WIDTH = 180;
  const MAX_SIDEBAR_WIDTH = 420;
  const MIN_EDITOR_WIDTH = 280;
  const MIN_VIEWPORT_WIDTH = 320;
  const MIN_BOTTOM_PANEL_HEIGHT = 100;

  const buildIdRef = useRef(0);
  const buildStartRef = useRef(0);
  const buildTimeoutRef = useRef(null);
  const BUILD_TIMEOUT = 60000;

  const colors = getThemeColors(theme);

  // ─── History ────────────────────────────────────────────────────────
  const applyCodeChange = useCallback((nextCodeOrUpdater) => {
    setHistory((current) => {
      const nextCode = typeof nextCodeOrUpdater === 'function'
        ? nextCodeOrUpdater(current.present)
        : nextCodeOrUpdater;
      if (nextCode === current.present) return current;
      return { past: [...current.past, current.present].slice(-100), present: nextCode, future: [] };
    });
  }, []);

  const replaceCodeWithoutHistory = useCallback((nextCode) => {
    setHistory(createHistoryState(nextCode));
  }, []);

  const undoCode = useCallback(() => {
    let changed = false;
    setHistory((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      changed = true;
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
    });
    if (changed) setStatusMessage('Undo applied');
  }, []);

  const redoCode = useCallback(() => {
    let changed = false;
    setHistory((current) => {
      if (current.future.length === 0) return current;
      const [next, ...rest] = current.future;
      changed = true;
      return { past: [...current.past, current.present].slice(-100), present: next, future: rest };
    });
    if (changed) setStatusMessage('Redo applied');
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const isDirty = code !== lastSavedCode;

  // ─── STL loader helper ───────────────────────────────────────────────
  const loadStlBytes = useCallback((bytes, elapsed) => {
    const parsed = parseSTL(bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(parsed.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(parsed.normals, 3));
    geometry.computeBoundingBox();
    setStlGeometry(geometry);
    setResult({ objects: [], logs: [`Rendered ${parsed.triangleCount} triangles in ${elapsed}ms`], errors: [], warnings: [], variables: {} });
    setActiveTab('console');
  }, []);

  const queueAutoFitView = useCallback(() => {
    shouldAutoFitViewRef.current = true;
  }, []);

  const clearBuildTimeout = useCallback((timeoutHandle = buildTimeoutRef.current) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    if (buildTimeoutRef.current === timeoutHandle) {
      buildTimeoutRef.current = null;
    }
  }, []);

  // ─── Native build (Electron → openscad.com IPC) ──────────────────────
  const runCode = useCallback(async () => {
    const id = ++buildIdRef.current;
    buildStartRef.current = performance.now();
    setBuilding(true);

    clearBuildTimeout();
    const timeoutHandle = setTimeout(() => {
      if (buildIdRef.current !== id) return;
      buildTimeoutRef.current = null;
      setBuilding(false);
      setBuildTime(BUILD_TIMEOUT);
      setResult({ objects: [], logs: [], errors: [`Render timed out after ${BUILD_TIMEOUT / 1000}s`], warnings: [], variables: {} });
      setActiveTab('errors');
    }, BUILD_TIMEOUT);
    buildTimeoutRef.current = timeoutHandle;

    try {
      const response = await forgeAPI.renderOpenSCAD(code);
      clearBuildTimeout(timeoutHandle);
      if (buildIdRef.current !== id) return; // stale build
      setBuilding(false);
      const elapsed = Math.round(performance.now() - buildStartRef.current);
      setBuildTime(elapsed);

      if (response.error) {
        setStlGeometry(null);
        const lines = response.error.split('\n').filter(Boolean);
        setResult({ objects: [], logs: [], errors: lines, warnings: [], variables: {} });
        setActiveTab('errors');
      } else {
        loadStlBytes(new Uint8Array(response.stl), elapsed);
      }
    } catch (err) {
      clearBuildTimeout(timeoutHandle);
      if (buildIdRef.current !== id) return; // stale build
      setBuilding(false);
      setBuildTime(Math.round(performance.now() - buildStartRef.current));
      setResult({ objects: [], logs: [], errors: [`Render error: ${err.message}`], warnings: [], variables: {} });
      setActiveTab('errors');
    }
  }, [BUILD_TIMEOUT, clearBuildTimeout, code, forgeAPI, loadStlBytes]);

  const cancelBuild = useCallback(() => {
    buildIdRef.current += 1;
    clearBuildTimeout();
    setBuilding(false);
    setStatusMessage('Build cancelled');
  }, [clearBuildTimeout]);

  const startResize = useCallback((panel, event) => {
    resizingRef.current = panel;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      sidebarWidth,
      editorWidth,
      bottomPanelHeight,
    };
    document.body.style.cursor = panel === 'bottom' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    event.preventDefault();
  }, [bottomPanelHeight, editorWidth, sidebarWidth]);

  // ─── File operations ──────────────────────────────────────────────────
  const resetWorkspace = useCallback(() => {
    const next = getDefaultWorkspace();
    queueAutoFitView();
    replaceCodeWithoutHistory(next.code);
    setLastSavedCode(next.code);
    setCurrentFileName(DEFAULT_FILE_NAME);
    setCurrentFilePath(null);
    setStatusMessage('Started a new workspace');
  }, [queueAutoFitView, replaceCodeWithoutHistory]);

  const openFile = useCallback(async () => {
    try {
      const payload = await forgeAPI.openFile();
      if (!payload) return;
      queueAutoFitView();
      replaceCodeWithoutHistory(payload.content);
      setLastSavedCode(payload.content);
      setCurrentFileName(payload.name || DEFAULT_FILE_NAME);
      setCurrentFilePath(payload.filePath || null);
      setStatusMessage(`Opened ${payload.name || DEFAULT_FILE_NAME}`);
      // Refresh recent files list
      forgeAPI.getRecentFiles().then(setRecentFiles).catch(() => {});
    } catch (error) {
      setStatusMessage(`Open failed: ${error.message}`);
    }
  }, [forgeAPI, queueAutoFitView, replaceCodeWithoutHistory]);

  const openFilePath = useCallback(async (filePath) => {
    try {
      const payload = await forgeAPI.openFilePath(filePath);
      if (!payload || payload.error) {
        setStatusMessage(`Failed to open: ${payload?.error || 'unknown error'}`);
        return;
      }
      queueAutoFitView();
      replaceCodeWithoutHistory(payload.content);
      setLastSavedCode(payload.content);
      setCurrentFileName(payload.name || DEFAULT_FILE_NAME);
      setCurrentFilePath(payload.filePath || null);
      setStatusMessage(`Opened ${payload.name || DEFAULT_FILE_NAME}`);
      forgeAPI.getRecentFiles().then(setRecentFiles).catch(() => {});
    } catch (error) {
      setStatusMessage(`Open failed: ${error.message}`);
    }
  }, [forgeAPI, queueAutoFitView, replaceCodeWithoutHistory]);

  const saveFile = useCallback(async () => {
    try {
      const suggestedName = currentFileName?.endsWith('.scad') ? currentFileName : `${currentFileName || 'model'}.scad`;
      const saved = await forgeAPI.saveFile({ content: code, filePath: currentFilePath, suggestedName });
      if (!saved) return;
      setCurrentFileName(saved.name || suggestedName);
      setCurrentFilePath(saved.filePath || null);
      setLastSavedCode(code);
      setStatusMessage(`Saved ${saved.name || suggestedName}`);
    } catch (error) {
      setStatusMessage(`Save failed: ${error.message}`);
    }
  }, [code, currentFileName, currentFilePath, forgeAPI]);

  // ─── Auto-run ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRun) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runCode, 400);
    return () => clearTimeout(timerRef.current);
  }, [code, autoRun, runCode]);

  useEffect(() => () => clearBuildTimeout(), [clearBuildTimeout]);

  useEffect(() => {
    if (!stlGeometry || !shouldAutoFitViewRef.current) return;
    shouldAutoFitViewRef.current = false;
    setFitViewSignal((value) => value + 1);
  }, [stlGeometry]);

  // ─── Persist workspace ────────────────────────────────────────────────
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      code,
      viewSettings,
      autoRun,
      currentFileName,
      theme,
      panelLayout: {
        sidebarOpen,
        sidebarWidth,
        editorWidth,
        bottomPanelHeight,
      },
    }));
  }, [autoRun, bottomPanelHeight, code, currentFileName, editorWidth, sidebarOpen, sidebarWidth, theme, viewSettings]);

  // ─── Load recent files & workspace on mount ──────────────────────────
  useEffect(() => {
    forgeAPI.getRecentFiles().then(setRecentFiles).catch(() => {});
    forgeAPI.getWorkspaceFolder().then(folder => {
      if (folder) {
        setWorkspaceFolder(folder);
        forgeAPI.listWorkspaceFiles().then(setWorkspaceFiles).catch(() => {});
      }
    }).catch(() => {});
  }, [forgeAPI]);

  // ─── Parse @param annotations on code change ─────────────────────────
  useEffect(() => {
    try {
      const params = parseParams(code);
      setParsedParams(params);
    } catch (_) {
      setParsedParams([]);
    }
  }, [code]);

  // ─── Global keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoCode(); else undoCode();
        return;
      }
      if (mod && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        editorRef.current?.openFind?.();
        return;
      }
      if (mod && !event.altKey && event.key.toLowerCase() === 'y') { event.preventDefault(); redoCode(); return; }
      if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); saveFile(); }
      if (mod && event.key.toLowerCase() === 'o') { event.preventDefault(); openFile(); }
      if (mod && event.key.toLowerCase() === 'n') { event.preventDefault(); resetWorkspace(); }
      if (event.key === 'F5' || (event.shiftKey && event.key === 'Enter')) { event.preventDefault(); runCode(); }
    };

    const removeMenu = forgeAPI.onMenuAction((action) => {
      if (action === 'new-file') resetWorkspace();
      if (action === 'open-file') openFile();
      if (action === 'save-file') saveFile();
      // Handle open-recent:<path> from Electron menu
      if (action.startsWith('open-recent:')) {
        const fp = action.slice('open-recent:'.length);
        openFilePath(fp);
      }
    });

    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); removeMenu?.(); };
  }, [openFile, openFilePath, redoCode, resetWorkspace, runCode, saveFile, undoCode]);

  // ─── Panel resize mouse handlers ──────────────────────────────────────
  useEffect(() => {
    const getContentWidth = () => contentRef.current?.clientWidth || window.innerWidth;
    const getAppHeight = () => appRef.current?.clientHeight || window.innerHeight;

    const onMouseMove = (e) => {
      if (!resizingRef.current) return;

      const contentWidth = getContentWidth();
      const appHeight = getAppHeight();
      const sidebarFootprint = sidebarOpen ? dragStartRef.current.sidebarWidth + 6 + 20 : 20;

      if (resizingRef.current === 'bottom') {
        const delta = dragStartRef.current.y - e.clientY;
        const maxBottomHeight = Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.min(520, appHeight - 220));
        setBottomPanelHeight(Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.min(maxBottomHeight, dragStartRef.current.bottomPanelHeight + delta)));
      } else if (resizingRef.current === 'editor') {
        const delta = e.clientX - dragStartRef.current.x;
        const maxEditorWidth = Math.max(
          MIN_EDITOR_WIDTH,
          contentWidth - sidebarFootprint - 6 - MIN_VIEWPORT_WIDTH,
        );
        setEditorWidth(Math.max(MIN_EDITOR_WIDTH, Math.min(maxEditorWidth, dragStartRef.current.editorWidth + delta)));
      } else if (resizingRef.current === 'sidebar') {
        const delta = e.clientX - dragStartRef.current.x;
        const maxSidebarWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          Math.min(MAX_SIDEBAR_WIDTH, contentWidth - 20 - 6 - 6 - MIN_EDITOR_WIDTH - MIN_VIEWPORT_WIDTH),
        );
        setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxSidebarWidth, dragStartRef.current.sidebarWidth + delta)));
      }
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [MAX_SIDEBAR_WIDTH, MIN_BOTTOM_PANEL_HEIGHT, MIN_EDITOR_WIDTH, MIN_SIDEBAR_WIDTH, MIN_VIEWPORT_WIDTH, sidebarOpen]);

  useEffect(() => {
    const clampLayout = () => {
      const contentWidth = contentRef.current?.clientWidth || window.innerWidth;
      const appHeight = appRef.current?.clientHeight || window.innerHeight;
      const openSidebarFootprint = sidebarOpen ? sidebarWidth + 6 + 20 : 20;
      const maxEditorWidth = Math.max(
        MIN_EDITOR_WIDTH,
        contentWidth - openSidebarFootprint - 6 - MIN_VIEWPORT_WIDTH,
      );
      const maxSidebarWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, contentWidth - 20 - 6 - 6 - MIN_EDITOR_WIDTH - MIN_VIEWPORT_WIDTH),
      );
      const maxBottomHeight = Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.min(520, appHeight - 220));

      setEditorWidth((current) => Math.max(MIN_EDITOR_WIDTH, Math.min(maxEditorWidth, current)));
      setSidebarWidth((current) => Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxSidebarWidth, current)));
      setBottomPanelHeight((current) => Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.min(maxBottomHeight, current)));
    };

    clampLayout();
    window.addEventListener('resize', clampLayout);
    return () => window.removeEventListener('resize', clampLayout);
  }, [MAX_SIDEBAR_WIDTH, MIN_BOTTOM_PANEL_HEIGHT, MIN_EDITOR_WIDTH, MIN_SIDEBAR_WIDTH, MIN_VIEWPORT_WIDTH, sidebarOpen, sidebarWidth]);

  // ─── Three.js scene ───────────────────────────────────────────────────
  const scene = useThreeRenderer(canvasRef, result.objects, viewSettings, resetViewSignal, fitViewSignal, theme, stlGeometry);

  // ─── LSP diagnostics (Problems tab) ───────────────────────────────────
  useLSP(code, currentFilePath, setLspDiagnostics);
  const allErrors = [...result.errors, ...lspDiagnostics.errors];
  const allWarnings = [...result.warnings, ...lspDiagnostics.warnings];

  // ─── Drag-and-drop ────────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    const hasFile = Array.from(e.dataTransfer.types).includes('Files');
    if (hasFile) { e.preventDefault(); setIsDraggingFile(true); }
  }, []);
  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingFile(false);
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.scad') || f.name.endsWith('.txt'));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      queueAutoFitView();
      replaceCodeWithoutHistory(content);
      setLastSavedCode(content);
      setCurrentFileName(file.name);
      setCurrentFilePath(null);
      setStatusMessage(`Opened: ${file.name}`);
    };
    reader.readAsText(file);
  }, [queueAutoFitView, replaceCodeWithoutHistory]);

  const handleExportSTL = useCallback(async () => {
    if (!scene) return;
    const baseName = currentFileName.replace(/\.scad$/i, '');
    try {
      const content = exportSceneToSTL(scene);
      const saved = await forgeAPI.saveStlFile({ content, suggestedName: `${baseName}.stl` });
      if (!saved) return;
      setStatusMessage(`Exported ${saved.name || `${baseName}.stl`}`);
    } catch (error) {
      setStatusMessage(`STL export failed: ${error.message}`);
    }
  }, [currentFileName, forgeAPI, scene]);

  const jumpToLine = useCallback((lineNum) => {
    editorRef.current?.jumpToLine(lineNum);
    setActiveTab('console');
  }, []);

  const handleSidebarTabChange = useCallback((nextTab) => {
    setSidebarTab(nextTab);
    if (nextTab === 'workspace' && workspaceFolder) {
      forgeAPI.listWorkspaceFiles().then(setWorkspaceFiles).catch(() => {});
    }
  }, [forgeAPI, workspaceFolder]);

  const handleChooseWorkspaceFolder = useCallback(async () => {
    const folder = await forgeAPI.setWorkspaceFolder();
    if (!folder) return;
    setWorkspaceFolder(folder);
    const files = await forgeAPI.listWorkspaceFiles();
    setWorkspaceFiles(files || []);
  }, [forgeAPI]);

  const handleLoadExample = useCallback((name, exampleCode) => {
    queueAutoFitView();
    replaceCodeWithoutHistory(exampleCode);
    setLastSavedCode(exampleCode);
    setCurrentFileName(`${name.toLowerCase().replace(/\s+/g, '-')}.scad`);
    setCurrentFilePath(null);
    setStatusMessage(`Loaded example: ${name}`);
  }, [queueAutoFitView, replaceCodeWithoutHistory]);

  const handleInsertTemplate = useCallback((template) => {
    if (!template?.code) return;

    const inserted = editorRef.current?.insertText?.(template.code, { selectInserted: true });
    if (!inserted) {
      const nextCode = code.trim() ? `${code}\n\n${template.code}` : template.code;
      applyCodeChange(nextCode);
    }

    setStatusMessage(`Inserted template: ${template.name}`);
  }, [applyCodeChange, code]);

  const handleParamChange = useCallback((name, value) => {
    const nextCode = applyParamChange(code, name, value);
    applyCodeChange(nextCode);
  }, [applyCodeChange, code]);

  const handleResetParam = useCallback((name) => {
    const originalParams = parseParams(lastSavedCode);
    const original = originalParams.find((param) => param.name === name);
    if (!original) return;
    const nextCode = applyParamChange(code, name, original.value);
    applyCodeChange(nextCode);
  }, [applyCodeChange, code, lastSavedCode]);

  const handleJumpToParam = useCallback((param) => {
    const targetLine = param?.assignmentLine || param?.line;
    if (!targetLine) return;
    editorRef.current?.jumpToLine(targetLine);
    setStatusMessage(`Jumped to ${param.name}`);
  }, []);

  const handleClearRecentFiles = useCallback(() => {
    forgeAPI.clearRecentFiles().then(() => setRecentFiles([]));
  }, [forgeAPI]);

  const askAI = useCallback(() => {
    const errorText = allErrors.map(e => `- ${e}`).join('\n');
    const warnText = allWarnings.map(w => `- ${w}`).join('\n');
    const prompt = `I'm writing OpenSCAD code in Forge3D and getting errors. Please help me fix the issue.\n\n## My Code (${currentFileName})\n\`\`\`openscad\n${code}\n\`\`\`\n\n## Errors\n${errorText || 'None'}\n\n## Warnings\n${warnText || 'None'}\n\nPlease explain what's wrong and show me the corrected code.`;
    navigator.clipboard.writeText(prompt).then(
      () => setStatusMessage('AI debug prompt copied to clipboard'),
      () => setStatusMessage('Failed to copy to clipboard')
    );
  }, [code, allErrors, allWarnings, currentFileName]);

  // ─── RENDER ──────────────────────────────────────────────────────────
  return (
    <div
      ref={appRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: colors.bg, color: colors.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflow: 'hidden', position: 'relative' }}
    >
      {isDraggingFile && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9999, background: `${colors.accent}22`, border: `3px dashed ${colors.accent}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: `${colors.bgPanel}ee`, borderRadius: '12px', padding: '24px 40px', textAlign: 'center', border: `1px solid ${colors.accent}` }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📂</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.accent }}>Drop .scad file to open</div>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <ForgeToolbar
        autoRun={autoRun}
        building={building}
        canRedo={canRedo}
        canUndo={canUndo}
        colors={colors}
        onAutoRunChange={setAutoRun}
        onCancelBuild={cancelBuild}
        onExportStl={handleExportSTL}
        onNewFile={resetWorkspace}
        onOpenFile={openFile}
        onRedo={redoCode}
        onResetView={() => setResetViewSignal(v => v + 1)}
        onRunCode={runCode}
        onSaveFile={saveFile}
        onInsertTemplate={handleInsertTemplate}
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onUndo={undoCode}
        theme={theme}
      />

      {/* ── Body ── */}
      <div ref={contentRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{ width: sidebarWidth, minWidth: MIN_SIDEBAR_WIDTH, background: colors.bgDark, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
              {[{ id: 'examples', label: '📂 Examples' }, { id: 'workspace', label: '📁 Workspace' }, { id: 'params', label: '⚙ Params' }].map(({ id, label }) => (
                <button key={id} onClick={() => handleSidebarTabChange(id)}
                  style={{ flex: 1, padding: '6px 2px', background: sidebarTab === id ? colors.bgPanel : 'transparent', border: 'none', borderBottom: sidebarTab === id ? `2px solid ${colors.accent}` : '2px solid transparent', color: sidebarTab === id ? colors.accent : colors.textMuted, cursor: 'pointer', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}
                >{label}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {sidebarTab === 'examples' && (
                <ExamplesSidebar
                  colors={colors}
                  exampleSearch={exampleSearch}
                  filteredExamples={filteredExamples}
                  groupedExamples={groupedExamples}
                  onClearRecentFiles={handleClearRecentFiles}
                  onExampleSearchChange={setExampleSearch}
                  onLoadExample={handleLoadExample}
                  onOpenRecentFile={openFilePath}
                  recentFiles={recentFiles}
                />
              )}
              {sidebarTab === 'workspace' && (
                <WorkspaceSidebar
                  colors={colors}
                  onChooseWorkspaceFolder={handleChooseWorkspaceFolder}
                  onOpenWorkspaceFile={openFilePath}
                  workspaceFiles={workspaceFiles}
                  workspaceFolder={workspaceFolder}
                />
              )}
              {sidebarTab === 'params' && (
                <ParamsSidebar
                  colors={colors}
                  onJumpToParam={handleJumpToParam}
                  onParamChange={handleParamChange}
                  onResetParam={handleResetParam}
                  parsedParams={parsedParams}
                />
              )}
            </div>
          </div>
        )}

        {sidebarOpen && (
          <div
            onMouseDown={(e) => startResize('sidebar', e)}
            onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
            title="Resize sidebar"
            style={{ width: '6px', cursor: 'col-resize', background: 'transparent', borderRight: `1px solid ${colors.border}`, flexShrink: 0, position: 'relative' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${colors.accent}33`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ position: 'absolute', top: '50%', left: '1px', right: '1px', height: '34px', transform: 'translateY(-50%)', borderRadius: '999px', background: `${colors.borderHover}66` }} />
          </div>
        )}

        <button
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          style={{ width: '20px', minWidth: '20px', background: colors.bgDarker, border: 'none', borderRight: `1px solid ${colors.border}`, color: colors.textFaint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '10px' }}
        >{sidebarOpen ? '◀' : '▶'}</button>

        {/* Editor panel */}
        <div style={{ width: editorWidth, minWidth: MIN_EDITOR_WIDTH, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ height: '30px', minHeight: '30px', background: colors.bgDarker, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
            <Icons.File /><span style={{ fontSize: '12px', color: colors.textMuted }}>{currentFileName}{isDirty ? ' *' : ''}</span>
            <span style={{ fontSize: '10px', color: canUndo || canRedo ? colors.accent : colors.borderHover, background: canUndo || canRedo ? `${colors.accent}22` : 'transparent', border: canUndo || canRedo ? `1px solid ${colors.accent}44` : '1px solid transparent', borderRadius: '999px', padding: '2px 6px' }}>{history.past.length} undo · {history.future.length} redo</span>
            <span style={{ fontSize: '10px', color: colors.borderHover, marginLeft: 'auto' }}>{code.split("\n").length} lines</span>
            <span style={{ fontSize: '10px', color: colors.textFaint }}>{Math.round(editorWidth)}px</span>
          </div>
          <div style={{ flex: 1, background: colors.bgDarker, overflow: 'hidden' }}>
            <CodeEditor ref={editorRef} code={code} onChange={applyCodeChange} onUndo={undoCode} onRedo={redoCode} canUndo={canUndo} canRedo={canRedo} theme={theme} onBuild={runCode} />
          </div>

          {/* Bottom panel drag handle */}
          <div
            onMouseDown={(e) => startResize('bottom', e)}
            onDoubleClick={() => setBottomPanelHeight(DEFAULT_BOTTOM_PANEL_HEIGHT)}
            title="Resize bottom panel"
            style={{ height: '8px', cursor: 'row-resize', background: 'transparent', borderTop: `1px solid ${colors.border}`, flexShrink: 0, transition: 'background 0.15s', position: 'relative' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${colors.accent}33`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ position: 'absolute', left: '50%', top: '1px', width: '56px', height: '4px', transform: 'translateX(-50%)', borderRadius: '999px', background: `${colors.borderHover}88` }} />
          </div>
          <div style={{ height: bottomPanelHeight, minHeight: MIN_BOTTOM_PANEL_HEIGHT }}>
            <BottomPane
              activeTab={activeTab}
              allErrors={allErrors}
              allWarnings={allWarnings}
              askAI={askAI}
              buildTime={buildTime}
              colors={colors}
              jumpToLine={jumpToLine}
              onActiveTabChange={setActiveTab}
              result={result}
              statusMessage={statusMessage}
            />
          </div>
        </div>

        {/* Horizontal drag handle */}
        <div
          onMouseDown={(e) => startResize('editor', e)}
          onDoubleClick={() => setEditorWidth(DEFAULT_EDITOR_WIDTH)}
          title="Resize editor"
          style={{ width: '6px', cursor: 'col-resize', background: 'transparent', borderLeft: `1px solid ${colors.border}`, flexShrink: 0, transition: 'background 0.15s', position: 'relative' }}
          onMouseEnter={e => { e.currentTarget.style.background = `${colors.accent}33`; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ position: 'absolute', top: '50%', left: '1px', right: '1px', height: '40px', transform: 'translateY(-50%)', borderRadius: '999px', background: `${colors.borderHover}66` }} />
        </div>
        {/* 3D viewport */}
        <ViewportPane
          canvasRef={canvasRef}
          colors={colors}
          minViewportWidth={MIN_VIEWPORT_WIDTH}
          setViewSettings={setViewSettings}
          theme={theme}
          viewSettings={viewSettings}
        />
      </div>

      {/* ── Status bar ── */}
      <StatusBar
        allErrors={allErrors}
        building={building}
        code={code}
        colors={colors}
        currentFileName={currentFileName}
        currentFilePath={currentFilePath}
        isDirty={isDirty}
        theme={theme}
      />
    </div>
  );
}
