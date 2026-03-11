import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Icons from "./forge3d/icons.jsx";
import { useThreeRenderer } from "./forge3d/renderer.js";
import { EXAMPLES } from "./forge3d/examples.js";
import { STORAGE_KEY, DEFAULT_FILE_NAME, getDefaultWorkspace, loadWorkspace, downloadTextFile, openBrowserFile } from "./forge3d/workspace.js";
import { interpret } from "./forge3d/interpreter.js";
import { CodeEditor } from "./forge3d/editor.jsx";
import { exportSceneToSTL } from "./forge3d/exporter.js";
import InterpreterWorker from "./forge3d/interpreter.worker.js?worker";

// ─── EXAMPLES ────────────────────────────────────────────────────────
// ─── MAIN APP ────────────────────────────────────────────────────────
function createHistoryState(initialCode) {
  return {
    past: [],
    present: initialCode,
    future: [],
  };
}

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

  const applyCodeChange = useCallback((nextCodeOrUpdater) => {
    setHistory((current) => {
      const nextCode = typeof nextCodeOrUpdater === 'function'
        ? nextCodeOrUpdater(current.present)
        : nextCodeOrUpdater;

      if (nextCode === current.present) return current;

      return {
        past: [...current.past, current.present].slice(-100),
        present: nextCode,
        future: [],
      };
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
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
    if (changed) setStatusMessage('Undo applied');
  }, []);

  const redoCode = useCallback(() => {
    let changed = false;
    setHistory((current) => {
      if (current.future.length === 0) return current;
      const [next, ...rest] = current.future;
      changed = true;
      return {
        past: [...current.past, current.present].slice(-100),
        present: next,
        future: rest,
      };
    });
    if (changed) setStatusMessage('Redo applied');
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const isDirty = code !== lastSavedCode;

  const workerRef = useRef(null);
  const buildIdRef = useRef(0);
  const buildStartRef = useRef(0);
  const [building, setBuilding] = useState(false);

  const BUILD_TIMEOUT = 15000; // ms

  const runCode = useCallback(() => {
    // Kill any in-flight worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    const id = ++buildIdRef.current;
    buildStartRef.current = performance.now();
    setBuilding(true);

    const worker = new InterpreterWorker();
    workerRef.current = worker;

    const timer = setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setBuilding(false);
      setBuildTime(BUILD_TIMEOUT);
      setResult({
        objects: [], logs: [],
        errors: [`Build timed out after ${BUILD_TIMEOUT / 1000}s — code may contain an infinite loop or unsupported construct`],
        warnings: [], variables: {},
      });
      setActiveTab('errors');
    }, BUILD_TIMEOUT);

    worker.onmessage = (e) => {
      if (e.data.id !== id) return; // stale result
      clearTimeout(timer);
      workerRef.current = null;
      setBuilding(false);
      const elapsed = Math.round(performance.now() - buildStartRef.current);
      setBuildTime(elapsed);
      const r = e.data.result;
      setResult(r);
      setActiveTab(r.errors.length > 0 || r.warnings.length > 0 ? 'errors' : 'console');
    };

    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      workerRef.current = null;
      setBuilding(false);
      setBuildTime(Math.round(performance.now() - buildStartRef.current));
      setResult({
        objects: [], logs: [],
        errors: [err.message || 'Worker crashed'],
        warnings: [], variables: {},
      });
      setActiveTab('errors');
    };

    worker.postMessage({ code, id });
  }, [code]);

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
      const payload = window.forgeAPI?.openFile ? await window.forgeAPI.openFile() : await openBrowserFile();
      if (!payload) return;
      replaceCodeWithoutHistory(payload.content);
      setLastSavedCode(payload.content);
      setCurrentFileName(payload.name || DEFAULT_FILE_NAME);
      setCurrentFilePath(payload.filePath || null);
      setStatusMessage(`Opened ${payload.name || DEFAULT_FILE_NAME}`);
    } catch (error) {
      setStatusMessage(`Open failed: ${error.message}`);
    }
  }, [replaceCodeWithoutHistory]);

  const saveFile = useCallback(async () => {
    try {
      const suggestedName = currentFileName?.endsWith('.scad') ? currentFileName : `${currentFileName || 'model'}.scad`;
      if (window.forgeAPI?.saveFile) {
        const saved = await window.forgeAPI.saveFile({ content: code, filePath: currentFilePath, suggestedName });
        if (!saved) return;
        setCurrentFileName(saved.name || suggestedName);
        setCurrentFilePath(saved.filePath || null);
      } else {
        downloadTextFile(suggestedName, code);
        setCurrentFileName(suggestedName);
      }
      setLastSavedCode(code);
      setStatusMessage(`Saved ${suggestedName}`);
    } catch (error) {
      setStatusMessage(`Save failed: ${error.message}`);
    }
  }, [code, currentFileName, currentFilePath]);

  useEffect(() => {
    if (!autoRun) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runCode, 400);
    return () => clearTimeout(timerRef.current);
  }, [code, autoRun, runCode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, viewSettings, autoRun, currentFileName, theme }));
  }, [code, viewSettings, autoRun, currentFileName, theme]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoCode();
        else undoCode();
        return;
      }
      if (mod && !event.altKey && event.key.toLowerCase() === 'y') { event.preventDefault(); redoCode(); return; }
      if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); saveFile(); }
      if (mod && event.key.toLowerCase() === 'o') { event.preventDefault(); openFile(); }
      if (mod && event.key.toLowerCase() === 'n') { event.preventDefault(); resetWorkspace(); }
      if (event.key === 'F5' || (event.shiftKey && event.key === 'Enter')) { event.preventDefault(); runCode(); }
    };

    const removeMenu = window.forgeAPI?.onMenuAction?.((action) => {
      if (action === 'new-file') resetWorkspace();
      if (action === 'open-file') openFile();
      if (action === 'save-file') saveFile();
    });

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      removeMenu?.();
    };
  }, [openFile, redoCode, resetWorkspace, runCode, saveFile, undoCode]);

  // Clean up worker on unmount
  useEffect(() => {
    return () => { if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; } };
  }, []);

  const scene = useThreeRenderer(canvasRef, result.objects, viewSettings, resetViewSignal, theme);

  // ── Drag-and-drop .scad file import ──
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
      setStatusMessage(`Dropped: ${file.name}`);
    };
    reader.readAsText(file);
  }, [replaceCodeWithoutHistory]);

  const handleExportSTL = useCallback(() => {
    if (!scene) return;
    const baseName = currentFileName.replace(/\.scad$/i, '');
    exportSceneToSTL(scene, `${baseName}.stl`);
    setStatusMessage(`Exported ${baseName}.stl`);
  }, [scene, currentFileName]);

  // Jump to a specific line in the editor
  const jumpToLine = useCallback((lineNum) => {
    editorRef.current?.jumpToLine(lineNum);
    setActiveTab('console');
  }, []);

  // Build an AI debugging prompt and open Claude.ai
  const askAI = useCallback(() => {
    const errorText = result.errors.map(e => `- ${e}`).join('\n');
    const warnText = result.warnings.map(w => `- ${w}`).join('\n');
    const prompt = `I'm writing OpenSCAD-style parametric 3D modeling code in Forge3D and getting errors. Please help me fix the issue.

## My Code (${currentFileName})
\`\`\`openscad
${code}
\`\`\`

## Errors
${errorText || 'None'}

## Warnings
${warnText || 'None'}

Please explain what's wrong and show me the corrected code.`;
    navigator.clipboard.writeText(prompt).catch(() => {});
    // Open Claude.ai with the prompt pre-filled via URL
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt.slice(0, 2000))}`;
    window.open(url, '_blank');
    setStatusMessage('Prompt opened in Claude.ai (also copied to clipboard)');
  }, [code, result.errors, result.warnings, currentFileName]);

  const varEntries = Object.entries(result.variables).filter(([, v]) => typeof v === 'number');

  const BtnStyle = (active) => ({
    background: active ? `${colors.accent}33` : `${colors.bgDarker}cc`,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    color: active ? colors.accent : colors.textMuted,
    padding: '5px 8px', borderRadius: '5px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
    backdropFilter: 'blur(8px)',
  });

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

      <div style={{ height: '42px', minHeight: '42px', background: theme === 'dark' ? 'linear-gradient(180deg,#1e1f30,#181924)' : colors.bgPanel, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', background: colors.logoGlow, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icons.Cube /></div>
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>
              <span style={{ color: colors.accent }}>FORGE</span><span style={{ color: theme === 'dark' ? '#7c4dff' : '#4527a0' }}>3D</span>
            </span>
            <span style={{ fontSize: '10px', color: colors.textFaint, marginLeft: '4px' }}>v2.2</span>
          </div>
          <div style={{ height: '20px', width: '1px', background: colors.border }} />
          {[
            { icon: Icons.File, label: 'New', action: resetWorkspace },
            { icon: Icons.File, label: 'Open', action: openFile },
            { icon: Icons.File, label: 'Save', action: saveFile },
            { icon: Icons.Grid, label: 'Export STL', action: handleExportSTL, disabled: result.objects.length === 0 },
            { icon: Icons.Undo, label: 'Undo', action: undoCode, disabled: !canUndo, title: 'Undo (Ctrl/Cmd+Z)' },
            { icon: Icons.Redo, label: 'Redo', action: redoCode, disabled: !canRedo, title: 'Redo (Ctrl/Cmd+Shift+Z / Ctrl+Y)' },
          ].map(({ icon: I, label, action, disabled, title }) => (
            <button key={label} onClick={action} title={title || label} disabled={disabled}
              style={{ background: 'none', border: '1px solid transparent', color: disabled ? colors.textFaint : colors.textMuted, padding: '4px 8px', borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', opacity: disabled ? 0.55 : 1 }}
              onMouseEnter={e => { if (!disabled) Object.assign(e.currentTarget.style, { background: colors.btnHover, borderColor: colors.borderHover, color: colors.text }); }}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'none', borderColor: 'transparent', color: disabled ? colors.textFaint : colors.textMuted })}
            ><I /><span>{label}</span></button>
          ))}
          <div style={{ height: '20px', width: '1px', background: colors.border }} />
          {[
            { icon: Icons.Cube, label: 'Cube', s: "cube([10,10,10], center=true);" },
            { icon: Icons.Sphere, label: 'Sphere', s: "sphere(r=5, $fn=32);" },
            { icon: Icons.Cylinder, label: 'Cylinder', s: "cylinder(h=10, r=5, $fn=32);" },
          ].map(({ icon: I, label, s }) => (
            <button key={label} onClick={() => applyCodeChange(c => `${c}\n${s}\n`)} title={`Insert ${label}`}
              style={{ background: 'none', border: '1px solid transparent', color: colors.textMuted, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { background: colors.btnHover, borderColor: colors.borderHover, color: colors.text })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'none', borderColor: 'transparent', color: colors.textMuted })}
            ><I /><span>{label}</span></button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '12px' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setResetViewSignal(v => v + 1)} style={{ background: `${colors.bgDarker}cc`, border: `1px solid ${colors.border}`, color: colors.text, padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Reset View</button>
          {building ? (
            <button onClick={() => { if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; } setBuilding(false); setStatusMessage('Build cancelled'); }} style={{ background: 'linear-gradient(135deg,#e57373,#ef5350)', border: 'none', color: '#fff', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, animation: 'pulse 1s infinite' }}>⏹ Cancel</button>
          ) : (
            <button onClick={runCode} style={{ background: 'linear-gradient(135deg,#4fc3f7,#4dd0e1)', border: 'none', color: '#111', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}><Icons.Play /> Build</button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: colors.textMuted, cursor: 'pointer' }}>
            <input type='checkbox' checked={autoRun} onChange={e => setAutoRun(e.target.checked)} style={{ accentColor: colors.accent }} />Auto
          </label>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {sidebarOpen && (
          <div style={{ width: '220px', minWidth: '220px', background: colors.bgDark, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
              {['examples', 'params'].map(tab => (
                <button key={tab} onClick={() => setSidebarTab(tab)}
                  style={{ flex: 1, padding: '8px', background: sidebarTab === tab ? colors.bgPanel : 'transparent', border: 'none', borderBottom: sidebarTab === tab ? `2px solid ${colors.accent}` : '2px solid transparent', color: sidebarTab === tab ? colors.accent : colors.textMuted, cursor: 'pointer', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >{tab === 'examples' ? '📂 Examples' : '⚙ Params'}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {sidebarTab === 'examples' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(EXAMPLES).map(([name, exampleCode]) => (
                    <button key={name} onClick={() => { replaceCodeWithoutHistory(exampleCode); setLastSavedCode(exampleCode); setCurrentFileName(`${name.toLowerCase().replace(/\s+/g, '-')}.scad`); setCurrentFilePath(null); setStatusMessage(`Loaded example: ${name}`); }}
                      style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                      onMouseEnter={e => Object.assign(e.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                      onMouseLeave={e => Object.assign(e.currentTarget.style, { background: colors.bgPanel, borderColor: colors.border })}
                    ><Icons.File />{name}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {varEntries.length === 0 ? (
                    <div style={{ color: colors.textFaint, fontSize: '11px', padding: '8px', textAlign: 'center' }}>Define variables in code to see interactive sliders here.</div>
                  ) : varEntries.map(([name, value]) => (
                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: theme === 'dark' ? '#e5c07b' : '#d16a1b', fontFamily: 'monospace' }}>{name}</span>
                        <span style={{ color: colors.textMuted }}>{Number.isInteger(value) ? value : value.toFixed(2)}</span>
                      </div>
                      <input type='range' min={0} max={Math.max(value * 3, 50)} step={value > 10 ? 1 : 0.1} value={value}
                        onChange={e => { const nv = parseFloat(e.target.value); applyCodeChange(c => c.replace(new RegExp(`(${name}\\s*=\\s*)[\\d.]+`), `$1${nv}`)); }}
                        style={{ width: '100%', accentColor: colors.accent, height: '4px' }}
                      />
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '10px', color: colors.textFaint, fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>View</div>
                    {['grid','axes','wireframe'].map(key => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textMuted, cursor: 'pointer', padding: '3px 0' }}>
                        <input type='checkbox' checked={viewSettings[key]} onChange={e => setViewSettings(s => ({ ...s, [key]: e.target.checked }))} style={{ accentColor: colors.accent }} />
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={() => setSidebarOpen(o => !o)} style={{ width: '20px', minWidth: '20px', background: colors.bgDarker, border: 'none', borderRight: `1px solid ${colors.border}`, color: colors.textFaint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '10px' }}>{sidebarOpen ? '◀' : '▶'}</button>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${colors.border}` }}>
          <div style={{ height: '30px', minHeight: '30px', background: colors.bgDarker, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
            <Icons.File /><span style={{ fontSize: '12px', color: colors.textMuted }}>{currentFileName}{isDirty ? ' *' : ''}</span>
            <span style={{ fontSize: '10px', color: canUndo || canRedo ? colors.accent : colors.borderHover, background: canUndo || canRedo ? `${colors.accent}22` : 'transparent', border: canUndo || canRedo ? `1px solid ${colors.accent}44` : '1px solid transparent', borderRadius: '999px', padding: '2px 6px' }}>{history.past.length} undo · {history.future.length} redo</span>
            <span style={{ fontSize: '10px', color: colors.borderHover, marginLeft: 'auto' }}>{code.split("\n").length} lines</span>
          </div>
          <div style={{ flex: 1, background: colors.bgDarker, overflow: 'hidden' }}>
            <CodeEditor ref={editorRef} code={code} onChange={applyCodeChange} onUndo={undoCode} onRedo={redoCode} canUndo={canUndo} canRedo={canRedo} theme={theme} onBuild={runCode} />
          </div>

          <div style={{ height: '180px', minHeight: '100px', borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', background: colors.bgDark }}>
            <div style={{ height: '30px', minHeight: '30px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, padding: '0 8px', gap: '2px' }}>
              {[{ id: 'console', label: 'Console', count: result.logs.length }, { id: 'errors', label: 'Problems', count: result.errors.length + result.warnings.length }].map(({ id, label, count }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  style={{ background: activeTab === id ? colors.bgPanel : 'transparent', border: 'none', borderBottom: activeTab === id ? `2px solid ${colors.accent}` : '2px solid transparent', color: activeTab === id ? colors.text : colors.textMuted, cursor: 'pointer', padding: '5px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >{label}{count > 0 && <span style={{ background: id === 'errors' && result.errors.length > 0 ? `${colors.error}44` : `${colors.accent}44`, color: id === 'errors' && result.errors.length > 0 ? colors.error : colors.accent, borderRadius: '8px', padding: '0 5px', fontSize: '10px', fontWeight: 700 }}>{count}</span>}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: colors.textFaint }}>
                {(result.errors.length > 0 || result.warnings.length > 0) && (
                  <button onClick={askAI} style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', padding: '3px 9px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.02em' }}>
                    <span>✦</span> Ask AI
                  </button>
                )}
                <Icons.Zap /><span>{buildTime}ms</span><span>·</span><span>{result.objects.length} obj</span>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', lineHeight: '18px' }}>
              {activeTab === 'console' && (<>{result.logs.length === 0 && <div style={{ color: colors.textFaint, marginBottom: '6px' }}>{statusMessage}</div>}{result.logs.length === 0 && <div style={{ color: colors.borderHover }}>// Console output appears here...</div>}{result.logs.map((log, i) => (<div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '2px 0', color: colors.success }}><span style={{ color: colors.textMuted, minWidth: '16px' }}><Icons.ChevRight /></span><span>{log}</span></div>))}</>)}
              {activeTab === 'errors' && (
                <>
                  {result.errors.length === 0 && result.warnings.length === 0 && <div style={{ color: colors.success }}>✓ No problems detected</div>}
                  {result.errors.map((e, i) => {
                    const lineMatch = e.match(/line (\d+)/);
                    const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : null;
                    return (
                      <div key={`e${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0', borderBottom: `1px solid ${colors.border}22` }}>
                        <span style={{ color: colors.error, flexShrink: 0, marginTop: '1px' }}><Icons.Err /></span>
                        <span style={{ color: colors.error, flex: 1 }}>{e.replace(/ \(line \d+\)/, '')}</span>
                        {lineNum && (
                          <button onClick={() => jumpToLine(lineNum)} style={{ background: `${colors.error}22`, border: `1px solid ${colors.error}44`, borderRadius: '4px', color: colors.error, cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '1px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            line {lineNum} ↗
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {result.warnings.map((w, i) => {
                    const lineMatch = w.match(/line (\d+)/);
                    const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : null;
                    return (
                      <div key={`w${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0', borderBottom: `1px solid ${colors.border}22` }}>
                        <span style={{ color: colors.warn, flexShrink: 0, marginTop: '1px' }}><Icons.Warn /></span>
                        <span style={{ color: colors.warn, flex: 1 }}>{w.replace(/ \(line \d+\)/, '')}</span>
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
            </div>
          </div>
        </div>

        <div style={{ flex: 1.3, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', background: theme === 'dark' ? '#1a1b26' : '#e6e8eb' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '4px' }}>
            {[{ icon: Icons.Grid, key: 'grid', label: 'Grid' }, { icon: Icons.Layers, key: 'axes', label: 'Axes' }, { icon: Icons.Eye, key: 'wireframe', label: 'Edges' }].map(({ icon: I, key, label }) => (
              <button key={key} title={label} onClick={() => setViewSettings(s => ({ ...s, [key]: !s[key] }))} style={BtnStyle(viewSettings[key])}><I /></button>
            ))}
          </div>

          <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 10, background: `${colors.bg}cc`, borderRadius: '6px', padding: '6px 10px', fontSize: '10px', color: colors.textFaint, backdropFilter: 'blur(8px)', border: `1px solid ${colors.border}`, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>Orbit: LMB</span><span>Build: Shift+Enter</span><span>Undo: Ctrl/Cmd+Z</span><span>Redo: Ctrl+Y</span><span>Objects: {result.objects.length}</span>
          </div>

          {result.objects.length > 0 && (
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: `${colors.bgDark}cc`, borderRadius: '8px', padding: '8px', fontSize: '11px', backdropFilter: 'blur(8px)', border: `1px solid ${colors.border}`, maxHeight: '200px', overflow: 'auto', minWidth: '140px' }}>
              <div style={{ fontSize: '10px', color: colors.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Scene Tree</div>
              {result.objects.map((obj, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0', color: colors.textMuted }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: obj.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{obj.type}</span>
                </div>
              ))}
            </div>
          )}

          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>

      <div style={{ height: '24px', minHeight: '24px', background: result.errors.length > 0 ? colors.error : colors.accent, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '16px', fontSize: '11px', color: theme === 'dark' ? '#111' : '#fff', fontWeight: 500, transition: 'background 0.3s' }}>
        <span>{result.errors.length === 0 ? (isDirty ? '● Unsaved changes' : '✓ Saved / synced') : `✗ ${result.errors.length} error(s)`}</span>
        <span>{result.objects.length} objects</span>
        <span>{code.split("\n").length} lines</span>
        <span>{currentFilePath ? currentFilePath : currentFileName}</span>
        <span style={{ marginLeft: 'auto' }}>Forge3D — Parametric 3D Modeling</span>
      </div>
    </div>
  );
}
