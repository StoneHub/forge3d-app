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
import TerminalPane from "./forge3d/terminal.jsx";
import { requireForgeAPI } from "./forge3d/forge-api.js";

// ─── HISTORY ────────────────────────────────────────────────────────
function createHistoryState(initialCode) {
  return { past: [], present: initialCode, future: [] };
}

// ─── MAIN APP ────────────────────────────────────────────────────────
export default function Forge3D() {
  const initialWorkspace = useMemo(() => loadWorkspace(), []);
  const [history, setHistory] = useState(() => createHistoryState(initialWorkspace.code));
  const code = history.present;
  const [result, setResult] = useState({ objects: [], logs: [], errors: [], warnings: [], variables: {} });
  const [activeTab, setActiveTab] = useState('console');
  const [viewSettings, setViewSettings] = useState(initialWorkspace.viewSettings);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('examples');
  const [autoRun, setAutoRun] = useState(initialWorkspace.autoRun);
  const [buildTime, setBuildTime] = useState(0);
  const [currentFileName, setCurrentFileName] = useState(initialWorkspace.currentFileName || DEFAULT_FILE_NAME);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [lastSavedCode, setLastSavedCode] = useState(initialWorkspace.code);
  const [statusMessage, setStatusMessage] = useState('Workspace restored');
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [theme, setTheme] = useState(initialWorkspace.theme || 'dark');
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
  const [bottomPanelHeight, setBottomPanelHeight] = useState(180);
  const [editorWidth, setEditorWidth] = useState(480);
  const resizingRef = useRef(null); // null | 'bottom' | 'horiz'
  const dragStartRef = useRef({});

  const buildIdRef = useRef(0);
  const buildStartRef = useRef(0);
  const BUILD_TIMEOUT = 60000;

  const colors = theme === 'dark' ? {
    bg: '#13141f', bgPanel: '#1e1f30', bgDark: '#16172a', bgDarker: '#1a1b2e',
    text: '#c8c9db', textMuted: '#8a8baa', textFaint: '#5c5d7a',
    border: '#2a2b3d', borderHover: '#3a3b55', accent: '#4fc3f7', accentHover: '#4dd0e1',
    error: '#e57373', warn: '#ffb74d', success: '#81c784',
    logoGlow: 'linear-gradient(135deg,#4fc3f7,#7c4dff)', btnHover: '#2a2b40'
  } : {
    bg: '#f0f2f5', bgPanel: '#ffffff', bgDark: '#f7f9fa', bgDarker: '#fafbfc',
    text: '#333333', textMuted: '#666666', textFaint: '#999999',
    border: '#e0e0e0', borderHover: '#d0d0d0', accent: '#1565c0', accentHover: '#1976d2',
    error: '#c62828', warn: '#f57c00', success: '#2e7d32',
    logoGlow: 'linear-gradient(135deg,#1565c0,#4527a0)', btnHover: '#f0f0f0'
  };

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

  // ─── Native build (Electron → openscad.com IPC) ──────────────────────
  const runCode = useCallback(async () => {
    const id = ++buildIdRef.current;
    buildStartRef.current = performance.now();
    setBuilding(true);

    const timer = setTimeout(() => {
      setBuilding(false);
      setBuildTime(BUILD_TIMEOUT);
      setResult({ objects: [], logs: [], errors: [`Render timed out after ${BUILD_TIMEOUT / 1000}s`], warnings: [], variables: {} });
      setActiveTab('errors');
    }, BUILD_TIMEOUT);

    try {
      const response = await forgeAPI.renderOpenSCAD(code);
      if (buildIdRef.current !== id) return; // stale build
      clearTimeout(timer);
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
      clearTimeout(timer);
      setBuilding(false);
      setBuildTime(Math.round(performance.now() - buildStartRef.current));
      setResult({ objects: [], logs: [], errors: [`Render error: ${err.message}`], warnings: [], variables: {} });
      setActiveTab('errors');
    }
  }, [code, forgeAPI, loadStlBytes]);

  // ─── File operations ──────────────────────────────────────────────────
  const resetWorkspace = useCallback(() => {
    const next = getDefaultWorkspace();
    replaceCodeWithoutHistory(next.code);
    setLastSavedCode(next.code);
    setCurrentFileName(DEFAULT_FILE_NAME);
    setCurrentFilePath(null);
    setStatusMessage('Started a new workspace');
  }, [replaceCodeWithoutHistory]);

  const openFile = useCallback(async () => {
    try {
      const payload = await forgeAPI.openFile();
      if (!payload) return;
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
  }, [forgeAPI, replaceCodeWithoutHistory]);

  const openFilePath = useCallback(async (filePath) => {
    try {
      const payload = await forgeAPI.openFilePath(filePath);
      if (!payload || payload.error) {
        setStatusMessage(`Failed to open: ${payload?.error || 'unknown error'}`);
        return;
      }
      replaceCodeWithoutHistory(payload.content);
      setLastSavedCode(payload.content);
      setCurrentFileName(payload.name || DEFAULT_FILE_NAME);
      setCurrentFilePath(payload.filePath || null);
      setStatusMessage(`Opened ${payload.name || DEFAULT_FILE_NAME}`);
      forgeAPI.getRecentFiles().then(setRecentFiles).catch(() => {});
    } catch (error) {
      setStatusMessage(`Open failed: ${error.message}`);
    }
  }, [forgeAPI, replaceCodeWithoutHistory]);

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

  // ─── Persist workspace ────────────────────────────────────────────────
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, viewSettings, autoRun, currentFileName, theme }));
  }, [code, viewSettings, autoRun, currentFileName, theme]);

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
    const onMouseMove = (e) => {
      if (!resizingRef.current) return;
      if (resizingRef.current === 'bottom') {
        const delta = dragStartRef.current.y - e.clientY;
        setBottomPanelHeight(Math.max(60, Math.min(600, dragStartRef.current.height + delta)));
      } else if (resizingRef.current === 'horiz') {
        const delta = e.clientX - dragStartRef.current.x;
        setEditorWidth(Math.max(200, Math.min(1200, dragStartRef.current.width + delta)));
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
  }, []);

  // ─── Three.js scene ───────────────────────────────────────────────────
  const scene = useThreeRenderer(canvasRef, result.objects, viewSettings, resetViewSignal, theme, stlGeometry);

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
      replaceCodeWithoutHistory(content);
      setLastSavedCode(content);
      setCurrentFileName(file.name);
      setCurrentFilePath(null);
      setStatusMessage(`Opened: ${file.name}`);
    };
    reader.readAsText(file);
  }, [replaceCodeWithoutHistory]);

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

  const askAI = useCallback(() => {
    const errorText = allErrors.map(e => `- ${e}`).join('\n');
    const warnText = allWarnings.map(w => `- ${w}`).join('\n');
    const prompt = `I'm writing OpenSCAD code in Forge3D and getting errors. Please help me fix the issue.\n\n## My Code (${currentFileName})\n\`\`\`openscad\n${code}\n\`\`\`\n\n## Errors\n${errorText || 'None'}\n\n## Warnings\n${warnText || 'None'}\n\nPlease explain what's wrong and show me the corrected code.`;
    navigator.clipboard.writeText(prompt).then(
      () => setStatusMessage('AI debug prompt copied to clipboard'),
      () => setStatusMessage('Failed to copy to clipboard')
    );
  }, [code, allErrors, allWarnings, currentFileName]);

  const BtnStyle = (active) => ({
    background: active ? `${colors.accent}33` : `${colors.bgDarker}cc`,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    color: active ? colors.accent : colors.textMuted,
    padding: '5px 8px', borderRadius: '5px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
    backdropFilter: 'blur(8px)',
  });

  // ─── RENDER ──────────────────────────────────────────────────────────
  return (
    <div
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
      <div style={{ height: '42px', minHeight: '42px', background: theme === 'dark' ? 'linear-gradient(180deg,#1e1f30,#181924)' : colors.bgPanel, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', background: colors.logoGlow, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icons.Cube /></div>
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>
              <span style={{ color: colors.accent }}>FORGE</span><span style={{ color: theme === 'dark' ? '#7c4dff' : '#4527a0' }}>3D</span>
            </span>
            <span style={{ fontSize: '10px', color: colors.textFaint, marginLeft: '4px' }}>v3.0</span>
          </div>
          <div style={{ height: '20px', width: '1px', background: colors.border }} />
          {/* File ops */}
          {[
            { icon: Icons.File, label: 'New', action: resetWorkspace },
            { icon: Icons.File, label: 'Open', action: openFile },
            { icon: Icons.File, label: 'Save', action: saveFile },
            { icon: Icons.Grid, label: 'Export STL', action: handleExportSTL },
            { icon: Icons.Undo, label: 'Undo', action: undoCode, disabled: !canUndo, title: 'Ctrl/Cmd+Z' },
            { icon: Icons.Redo, label: 'Redo', action: redoCode, disabled: !canRedo, title: 'Ctrl/Cmd+Shift+Z' },
          ].map(({ icon: I, label, action, disabled, title }) => (
            <button key={label} onClick={action} title={title || label} disabled={disabled}
              style={{ background: 'none', border: '1px solid transparent', color: disabled ? colors.textFaint : colors.textMuted, padding: '4px 8px', borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', opacity: disabled ? 0.55 : 1 }}
              onMouseEnter={e => { if (!disabled) Object.assign(e.currentTarget.style, { background: colors.btnHover, borderColor: colors.borderHover, color: colors.text }); }}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'none', borderColor: 'transparent', color: disabled ? colors.textFaint : colors.textMuted })}
            ><I /><span>{label}</span></button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '12px' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setResetViewSignal(v => v + 1)} style={{ background: `${colors.bgDarker}cc`, border: `1px solid ${colors.border}`, color: colors.text, padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Reset View</button>
          {building ? (
            <button onClick={() => { setBuilding(false); setStatusMessage('Build cancelled'); }} style={{ background: 'linear-gradient(135deg,#e57373,#ef5350)', border: 'none', color: '#fff', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>⏹ Cancel</button>
          ) : (
            <button onClick={runCode} style={{ background: 'linear-gradient(135deg,#4fc3f7,#4dd0e1)', border: 'none', color: '#111', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}><Icons.Play /> Build</button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: colors.textMuted, cursor: 'pointer' }}>
            <input type='checkbox' checked={autoRun} onChange={e => setAutoRun(e.target.checked)} style={{ accentColor: colors.accent }} />Auto
          </label>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{ width: '240px', minWidth: '240px', background: colors.bgDark, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
              {[{ id: 'examples', label: '📂 Examples' }, { id: 'workspace', label: '📁 Workspace' }, { id: 'params', label: '⚙ Params' }].map(({ id, label }) => (
                <button key={id} onClick={() => {
                  setSidebarTab(id);
                  if (id === 'workspace' && workspaceFolder) {
                    forgeAPI.listWorkspaceFiles().then(setWorkspaceFiles).catch(() => {});
                  }
                }}
                  style={{ flex: 1, padding: '6px 2px', background: sidebarTab === id ? colors.bgPanel : 'transparent', border: 'none', borderBottom: sidebarTab === id ? `2px solid ${colors.accent}` : '2px solid transparent', color: sidebarTab === id ? colors.accent : colors.textMuted, cursor: 'pointer', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}
                >{label}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {/* ── Examples Tab ── */}
              {sidebarTab === 'examples' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Recent Files Section */}
                  {recentFiles.length > 0 && (
                    <>
                      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: colors.textFaint, padding: '4px 2px 2px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>🕐 Recent</span>
                        <button onClick={() => { forgeAPI.clearRecentFiles().then(() => setRecentFiles([])); }} style={{ background: 'none', border: 'none', color: colors.textFaint, cursor: 'pointer', fontSize: '9px', padding: '2px 4px' }} title="Clear recent files">✕</button>
                      </div>
                      {recentFiles.slice(0, 5).map(fp => {
                        const fname = fp.split(/[\\/]/).pop();
                        return (
                          <button key={fp} onClick={() => openFilePath(fp)} title={fp}
                            style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                            onMouseEnter={e => Object.assign(e.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                            onMouseLeave={e => Object.assign(e.currentTarget.style, { background: colors.bgPanel, borderColor: colors.border })}
                          >🕐 {fname}</button>
                        );
                      })}
                      <div style={{ height: '1px', background: colors.border, margin: '4px 0' }} />
                    </>
                  )}
                  {/* Examples Section */}
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: colors.textFaint, padding: '4px 2px 2px', letterSpacing: '0.5px' }}>Built-in Examples</div>
                  <input
                    value={exampleSearch}
                    onChange={(e) => setExampleSearch(e.target.value)}
                    placeholder='Search examples...'
                    style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '7px 8px', borderRadius: '6px', fontSize: '11px', outline: 'none' }}
                  />
                  {Object.entries(groupedExamples).map(([category, items]) => (
                    <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '10px', color: colors.textFaint, padding: '4px 2px 0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{category}</div>
                      {items.map(({ name, code: exampleCode, summary }) => (
                        <button key={name} onClick={() => { replaceCodeWithoutHistory(exampleCode); setLastSavedCode(exampleCode); setCurrentFileName(`${name.toLowerCase().replace(/\s+/g, '-')}.scad`); setCurrentFilePath(null); setStatusMessage(`Loaded example: ${name}`); }}
                          title={summary}
                          style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', transition: 'all 0.15s' }}
                          onMouseEnter={e => Object.assign(e.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                          onMouseLeave={e => Object.assign(e.currentTarget.style, { background: colors.bgPanel, borderColor: colors.border })}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Icons.File />{name}</span>
                          <span style={{ color: colors.textMuted, fontSize: '10px', paddingLeft: '20px' }}>{summary}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredExamples.length === 0 && (
                    <div style={{ color: colors.textFaint, fontSize: '11px', padding: '8px', textAlign: 'center' }}>No examples match your search.</div>
                  )}
                </div>
              )}

              {/* ── Workspace Tab ── */}
              {sidebarTab === 'workspace' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {workspaceFolder ? (
                    <>
                      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: colors.textFaint, padding: '2px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span title={workspaceFolder}>📁 {workspaceFolder.split(/[\\/]/).pop()}</span>
                        <button onClick={async () => {
                          const folder = await forgeAPI.setWorkspaceFolder();
                          if (folder) {
                            setWorkspaceFolder(folder);
                            const files = await forgeAPI.listWorkspaceFiles();
                            setWorkspaceFiles(files || []);
                          }
                        }} style={{ background: 'none', border: 'none', color: colors.accent, cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }} title="Change folder">📂</button>
                      </div>
                      {workspaceFiles.length === 0 ? (
                        <div style={{ color: colors.textFaint, fontSize: '11px', padding: '8px', textAlign: 'center' }}>No .scad files found</div>
                      ) : (
                        workspaceFiles.map(f => (
                          <button key={f.fullPath} onClick={() => openFilePath(f.fullPath)} title={f.relativePath}
                            style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                            onMouseEnter={e => Object.assign(e.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                            onMouseLeave={e => Object.assign(e.currentTarget.style, { background: colors.bgPanel, borderColor: colors.border })}
                          ><Icons.File /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.relativePath}</span></button>
                        ))
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                      <div style={{ color: colors.textFaint, fontSize: '11px', marginBottom: '10px' }}>Set a workspace folder to browse .scad files</div>
                      <button onClick={async () => {
                        const folder = await forgeAPI.setWorkspaceFolder();
                        if (folder) {
                          setWorkspaceFolder(folder);
                          const files = await forgeAPI.listWorkspaceFiles();
                          setWorkspaceFiles(files || []);
                        }
                      }}
                        style={{ background: `${colors.accent}22`, border: `1px solid ${colors.accent}`, color: colors.accent, padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                      >📁 Set Workspace Folder</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Params Tab ── */}
              {sidebarTab === 'params' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {parsedParams.length === 0 ? (
                    <div style={{ color: colors.textFaint, fontSize: '11px', padding: '12px 8px', textAlign: 'center' }}>
                      <div style={{ marginBottom: '8px' }}>No parameters detected.</div>
                      <div style={{ fontSize: '10px', color: colors.textFaint, lineHeight: '1.45', marginBottom: '8px' }}>Parameters are auto-detected from top-level variables, or you can use <code style={{ background: `${colors.accent}22`, padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>// @param</code> annotations for more control:</div>
                      <pre style={{ textAlign: 'left', fontSize: '9px', marginTop: '8px', padding: '6px', background: colors.bgDarker, borderRadius: '4px', border: `1px solid ${colors.border}`, lineHeight: '1.4', overflow: 'auto' }}>{`// Auto-detected:
size = 10;
height = 20;

// Or annotate for full control:
// @param radius = 5  // min: 1, max: 50, step: 0.5
radius = 5;`}</pre>
                    </div>
                  ) : (
                    parsedParams.map(param => (
                      <div key={param.name} style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '6px', padding: '8px 10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: colors.text, marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {param.name}
                            {param.auto && <span style={{ fontSize: '8px', background: `${colors.success}22`, color: colors.success, padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }} title="Auto-detected parameter">AUTO</span>}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', color: colors.textMuted, fontWeight: 400 }}>{param.type}</span>
                            <button
                              onClick={() => {
                                // Reset to original value from code
                                const originalParams = parseParams(lastSavedCode);
                                const original = originalParams.find(p => p.name === param.name);
                                if (original) {
                                  const newCode = applyParamChange(code, param.name, original.value);
                                  applyCodeChange(newCode);
                                }
                              }}
                              title="Reset to original value"
                              style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textMuted, cursor: 'pointer', fontSize: '10px', padding: '2px 5px', lineHeight: 1 }}
                            >↺</button>
                          </div>
                        </div>

                        {/* Number → Slider */}
                        {param.type === 'number' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="range"
                              min={param.min ?? 0}
                              max={param.max ?? (param.value * 3 || 100)}
                              step={param.step ?? (param.value < 1 ? 0.01 : param.value < 10 ? 0.1 : 1)}
                              value={param.value}
                              onChange={e => {
                                const newCode = applyParamChange(code, param.name, parseFloat(e.target.value));
                                applyCodeChange(newCode);
                              }}
                              style={{ flex: 1, accentColor: colors.accent, height: '4px' }}
                            />
                            <input type="number"
                              value={param.value}
                              min={param.min}
                              max={param.max}
                              step={param.step ?? 0.1}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  const newCode = applyParamChange(code, param.name, val);
                                  applyCodeChange(newCode);
                                }
                              }}
                              style={{ width: '52px', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '2px 4px', fontSize: '11px', textAlign: 'center' }}
                            />
                          </div>
                        )}

                        {/* String → Text input */}
                        {param.type === 'string' && (
                          <input type="text"
                            value={param.value}
                            onChange={e => {
                              const newCode = applyParamChange(code, param.name, e.target.value);
                              applyCodeChange(newCode);
                            }}
                            style={{ width: '100%', boxSizing: 'border-box', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '4px 6px', fontSize: '11px' }}
                          />
                        )}

                        {/* Enum → Dropdown */}
                        {param.type === 'enum' && param.options && (
                          <select
                            value={param.value}
                            onChange={e => {
                              const newCode = applyParamChange(code, param.name, e.target.value);
                              applyCodeChange(newCode);
                            }}
                            style={{ width: '100%', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '4px 6px', fontSize: '11px' }}
                          >
                            {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        )}

                        {/* Boolean → Checkbox */}
                        {param.type === 'boolean' && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.text, cursor: 'pointer' }}>
                            <input type="checkbox"
                              checked={param.value}
                              onChange={e => {
                                const newCode = applyParamChange(code, param.name, e.target.checked);
                                applyCodeChange(newCode);
                              }}
                              style={{ accentColor: colors.accent }}
                            />
                            {param.value ? 'true' : 'false'}
                          </label>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={() => setSidebarOpen(o => !o)} style={{ width: '20px', minWidth: '20px', background: colors.bgDarker, border: 'none', borderRight: `1px solid ${colors.border}`, color: colors.textFaint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '10px' }}>{sidebarOpen ? '◀' : '▶'}</button>

        {/* Editor panel */}
        <div style={{ width: editorWidth, minWidth: 200, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ height: '30px', minHeight: '30px', background: colors.bgDarker, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
            <Icons.File /><span style={{ fontSize: '12px', color: colors.textMuted }}>{currentFileName}{isDirty ? ' *' : ''}</span>
            <span style={{ fontSize: '10px', color: canUndo || canRedo ? colors.accent : colors.borderHover, background: canUndo || canRedo ? `${colors.accent}22` : 'transparent', border: canUndo || canRedo ? `1px solid ${colors.accent}44` : '1px solid transparent', borderRadius: '999px', padding: '2px 6px' }}>{history.past.length} undo · {history.future.length} redo</span>
            <span style={{ fontSize: '10px', color: colors.borderHover, marginLeft: 'auto' }}>{code.split("\n").length} lines</span>
          </div>
          <div style={{ flex: 1, background: colors.bgDarker, overflow: 'hidden' }}>
            <CodeEditor ref={editorRef} code={code} onChange={applyCodeChange} onUndo={undoCode} onRedo={redoCode} canUndo={canUndo} canRedo={canRedo} theme={theme} onBuild={runCode} />
          </div>

          {/* Bottom panel drag handle */}
          <div
            onMouseDown={(e) => { resizingRef.current = 'bottom'; dragStartRef.current = { y: e.clientY, height: bottomPanelHeight }; document.body.style.cursor = 'row-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); }}
            style={{ height: '5px', cursor: 'row-resize', background: 'transparent', borderTop: `1px solid ${colors.border}`, flexShrink: 0, transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${colors.accent}55`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          />
          {/* Console / Problems / Terminal panel */}
          <div style={{ height: bottomPanelHeight, minHeight: 60, display: 'flex', flexDirection: 'column', background: colors.bgDark }}>
            <div style={{ height: '30px', minHeight: '30px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, padding: '0 8px', gap: '2px' }}>
              {[
                { id: 'console', label: 'Console', count: result.logs.length },
                { id: 'errors', label: 'Problems', count: allErrors.length + allWarnings.length },
                { id: 'terminal', label: '>_ Terminal', count: 0 }
              ].map(({ id, label, count }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  style={{ background: activeTab === id ? colors.bgPanel : 'transparent', border: 'none', borderBottom: activeTab === id ? `2px solid ${colors.accent}` : '2px solid transparent', color: activeTab === id ? colors.text : colors.textMuted, cursor: 'pointer', padding: '5px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >{label}{count > 0 && <span style={{ background: id === 'errors' && allErrors.length > 0 ? `${colors.error}44` : `${colors.accent}44`, color: id === 'errors' && allErrors.length > 0 ? colors.error : colors.accent, borderRadius: '8px', padding: '0 5px', fontSize: '10px', fontWeight: 700 }}>{count}</span>}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: colors.textFaint }}>
                {(allErrors.length > 0 || allWarnings.length > 0) && (
                  <button onClick={askAI} style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', padding: '3px 9px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>✦</span> Ask AI
                  </button>
                )}
                <Icons.Zap /><span>{buildTime}ms</span>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: activeTab === 'terminal' ? '0' : '8px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', lineHeight: '18px' }}>
              {activeTab === 'console' && (<>{result.logs.length === 0 && <div style={{ color: colors.textFaint, marginBottom: '6px' }}>{statusMessage}</div>}{result.logs.length === 0 && <div style={{ color: colors.borderHover }}>// Console output appears here...</div>}{result.logs.map((log, i) => (<div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '2px 0', color: colors.success }}><span style={{ color: colors.textMuted, minWidth: '16px' }}><Icons.ChevRight /></span><span>{log}</span></div>))}</>)}
              {activeTab === 'errors' && (
                <>
                  {allErrors.length === 0 && allWarnings.length === 0 && <div style={{ color: colors.success }}>✓ No problems detected</div>}
                  {allErrors.map((rawErr, i) => {
                    const msg = typeof rawErr === 'string' ? rawErr : (rawErr?.message ?? JSON.stringify(rawErr));
                    const lineMatch = msg.match(/line (\d+)/);
                    const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : null;
                    return (
                      <div key={`e${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0', borderBottom: `1px solid ${colors.border}22` }}>
                        <span style={{ color: colors.error, flexShrink: 0, marginTop: '1px' }}><Icons.Err /></span>
                        <span style={{ color: colors.error, flex: 1 }}>{msg.replace(/ \(line \d+\)/, '')}</span>
                        {lineNum && (
                          <button onClick={() => jumpToLine(lineNum)} style={{ background: `${colors.error}22`, border: `1px solid ${colors.error}44`, borderRadius: '4px', color: colors.error, cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '1px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            line {lineNum} ↗
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {allWarnings.map((rawWarn, i) => {
                    const msg = typeof rawWarn === 'string' ? rawWarn : (rawWarn?.message ?? JSON.stringify(rawWarn));
                    const lineMatch = msg.match(/line (\d+)/);
                    const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : null;
                    return (
                      <div key={`w${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0', borderBottom: `1px solid ${colors.border}22` }}>
                        <span style={{ color: colors.warn, flexShrink: 0, marginTop: '1px' }}><Icons.Warn /></span>
                        <span style={{ color: colors.warn, flex: 1 }}>{msg.replace(/ \(line \d+\)/, '')}</span>
                        {lineNum && (
                          <button onClick={() => jumpToLine(lineNum)} style={{ background: `${colors.warn}22`, border: `1px solid ${colors.warn}44`, borderRadius: '4px', color: colors.warn, cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '1px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            line {lineNum} ↗
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {activeTab === 'terminal' && <TerminalPane colors={colors} />}
            </div>
          </div>
        </div>

        {/* Horizontal drag handle */}
        <div
          onMouseDown={(e) => { resizingRef.current = 'horiz'; dragStartRef.current = { x: e.clientX, width: editorWidth }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); }}
          style={{ width: '5px', cursor: 'col-resize', background: 'transparent', borderLeft: `1px solid ${colors.border}`, flexShrink: 0, transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = `${colors.accent}55`; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        />
        {/* 3D viewport */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', position: 'relative', background: theme === 'dark' ? '#1a1b26' : '#e6e8eb' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '4px' }}>
            {[
              { icon: Icons.Grid, key: 'grid', label: 'Grid' },
              { icon: Icons.Layers, key: 'axes', label: 'Axes' },
              { icon: Icons.Eye, key: 'wireframe', label: 'Edges' },
              { icon: Icons.Ruler, key: 'dimensions', label: 'Dimensions' }
            ].map(({ icon: I, key, label }) => (
              <button key={key} title={label} onClick={() => setViewSettings(s => ({ ...s, [key]: !s[key] }))} style={BtnStyle(viewSettings[key])}><I /></button>
            ))}
          </div>

          <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 10, background: `${colors.bg}cc`, borderRadius: '6px', padding: '6px 10px', fontSize: '10px', color: colors.textFaint, backdropFilter: 'blur(8px)', border: `1px solid ${colors.border}`, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>Orbit: LMB</span><span>Build: Shift+Enter</span><span>Undo: Ctrl+Z</span><span>Redo: Ctrl+Y</span>
          </div>

          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>

      {/* ── Status bar ── */}
      <div style={{ height: '24px', minHeight: '24px', background: allErrors.length > 0 ? colors.error : colors.accent, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '16px', fontSize: '11px', color: theme === 'dark' ? '#111' : '#fff', fontWeight: 500, transition: 'background 0.3s' }}>
        <span>{allErrors.length === 0 ? (isDirty ? '● Unsaved changes' : '✓ Saved / synced') : `✗ ${allErrors.length} error(s)`}</span>
        <span>{code.split("\n").length} lines</span>
        <span>{currentFilePath ? currentFilePath : currentFileName}</span>
        <span style={{ marginLeft: 'auto' }}>Forge3D — OpenSCAD Modeling</span>
      </div>
    </div>
  );
}
