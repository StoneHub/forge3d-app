import { COLLAPSED_BOTTOM_PANEL_HEIGHT, DEFAULT_BOTTOM_PANEL_HEIGHT, clampBottomPanelHeight } from './forge3d/bottom-panel-layout.js';
import { normalizeTransform as cloneTransformState } from './forge3d/assembly-transform.js';
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import Icons from "./forge3d/icons.jsx";
import { useThreeRenderer } from "./forge3d/renderer.js";
import { DEFAULT_FILE_NAME, getDefaultWorkspace, loadWorkspace, saveWorkspace } from "./forge3d/workspace.js";
import { CodeEditor } from "./forge3d/editor.jsx";
import { extractOpenScadSymbols } from "./forge3d/editor-language.js";
import { exportSceneToSTL } from "./forge3d/exporter.js";
import { parseSTL } from "./forge3d/stl-parser.js";
import { useLSP } from "./forge3d/lsp-client.js";
import { parseParams, applyParamChange } from "./forge3d/param-parser.js";
import { requireForgeAPI } from "./forge3d/forge-api.js";
import ForgeToolbar from "./forge3d/toolbar.jsx";
import StatusBar from "./forge3d/status-bar.jsx";
import StartSidebar from "./forge3d/start-sidebar.jsx";
import WorkspaceSidebar from "./forge3d/workspace-sidebar.jsx";
import ParamsSidebar from "./forge3d/params-sidebar.jsx";
import TerminalSidebar from "./forge3d/terminal-sidebar.jsx";
import BottomPane from "./forge3d/bottom-pane.jsx";
import ViewportPane from "./forge3d/viewport-pane.jsx";
import DocsDrawer from "./forge3d/docs-drawer.jsx";
import AssemblySidebar from "./forge3d/assembly-sidebar.jsx";
import AssemblyInspector from "./forge3d/assembly-inspector.jsx";
import { createHistoryState, pushHistoryState, redoHistoryState, replaceHistoryState, undoHistoryState, updateHistoryPresent } from "./forge3d/history.js";
import { prepareTemplateInsertion } from "./forge3d/template-merge.js";
import { getThemeColors } from "./forge3d/theme.js";
import {
  createAssemblyGeometryFromPayload,
  createAssemblyGeometryFromDesignGeometry,
  createAssemblyGeometryFromStlBytes,
  createAssemblyPart,
  createCenteredTransform,
  createFloorAlignedTransform,
  deserializeAssemblyScene,
  duplicateAssemblyPart,
  getAssemblyPartMetrics,
  serializeAssemblyGeometry,
  serializeAssemblyScene,
} from "./forge3d/assembly.js";

function getParentDirectory(filePath) {
  if (!filePath) return null;
  const normalized = String(filePath).replace(/[\\/]+$/, '');
  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (separatorIndex <= 0) return null;
  return normalized.slice(0, separatorIndex);
}

function buildMergedInsertionStatus(itemName, mode, stats = {}) {
  const actionLabel = mode === 'replace' ? 'Replaced with' : mode === 'cursor' ? 'Inserted' : 'Added';
  const details = [];

  if (stats.reusedParamCount > 0) {
    details.push(`kept ${stats.reusedParamCount} existing param${stats.reusedParamCount === 1 ? '' : 's'}`);
  }

  if (stats.addedParamCount > 0) {
    details.push(`added ${stats.addedParamCount} new param${stats.addedParamCount === 1 ? '' : 's'}`);
  }

  if (stats.reusedSpecialCount > 0) {
    details.push(`reused ${stats.reusedSpecialCount} render setting${stats.reusedSpecialCount === 1 ? '' : 's'}`);
  }

  if (details.length === 0) return `${actionLabel} ${itemName}`;
  return `${actionLabel} ${itemName} (${details.join(', ')})`;
}

function extractDiagnosticLineNumber(entry) {
  if (entry && typeof entry === 'object' && Number.isInteger(entry.lineNumber)) {
    return entry.lineNumber;
  }

  const message = typeof entry === 'string'
    ? entry
    : (entry?.raw || entry?.message || '');
  const lineMatch = String(message).match(/\bline\s+(\d+)\b/i);
  return lineMatch ? Number.parseInt(lineMatch[1], 10) : null;
}

function buildCodeExcerpt(sourceCode, lineNumber, radius = 1) {
  if (!Number.isInteger(lineNumber) || lineNumber < 1) return null;
  const lines = String(sourceCode || '').split(/\r?\n/);
  if (lines.length === 0) return null;

  const startLine = Math.max(1, lineNumber - radius);
  const endLine = Math.min(lines.length, lineNumber + radius);
  return {
    highlightLine: lineNumber,
    lines: Array.from({ length: endLine - startLine + 1 }, (_, index) => {
      const number = startLine + index;
      return { number, text: lines[number - 1] ?? '' };
    }),
  };
}

function createOpenScadIssue(lines, sourceCode, fallbackSeverity = 'error') {
  const filteredLines = Array.isArray(lines)
    ? lines.map((line) => String(line).trimEnd()).filter(Boolean)
    : [];
  const raw = filteredLines.join('\n').trim();
  const firstLine = filteredLines[0] || 'OpenSCAD reported an issue.';
  const severity = /^(warning|deprecated):/i.test(firstLine)
    ? 'warning'
    : /^(error):/i.test(firstLine)
      ? 'error'
      : fallbackSeverity;
  const message = firstLine.replace(/^(error|warning|deprecated):\s*/i, '').trim() || firstLine.trim();
  const lineNumber = extractDiagnosticLineNumber(raw);

  return {
    severity,
    message,
    raw,
    detail: filteredLines.slice(1).join('\n'),
    lineNumber,
    excerpt: buildCodeExcerpt(sourceCode, lineNumber),
  };
}

function parseOpenScadOutput(output, sourceCode, { treatLooseLinesAsIssues = true } = {}) {
  const normalizedLines = String(output || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return { errors: [], warnings: [], logs: [] };
  }

  const groupedIssues = [];
  const looseLines = [];
  let currentIssue = null;

  normalizedLines.forEach((line) => {
    if (/^(error|warning|deprecated):/i.test(line)) {
      if (currentIssue) groupedIssues.push(currentIssue);
      currentIssue = { severity: /^(warning|deprecated):/i.test(line) ? 'warning' : 'error', lines: [line] };
      return;
    }

    if (currentIssue) {
      currentIssue.lines.push(line);
      return;
    }

    looseLines.push(line);
  });

  if (currentIssue) groupedIssues.push(currentIssue);

  if (treatLooseLinesAsIssues && groupedIssues.length === 0 && looseLines.length > 0) {
    groupedIssues.push({ severity: 'error', lines: looseLines });
  }

  const errors = [];
  const warnings = [];

  groupedIssues.forEach((issue) => {
    const entry = createOpenScadIssue(issue.lines, sourceCode, issue.severity);
    if (entry.severity === 'warning') {
      warnings.push(entry);
    } else {
      errors.push(entry);
    }
  });

  return { errors, warnings, logs: looseLines };
}

function buildRenderLifecycleLogEntries(response = {}, { includeStreams = true } = {}) {
  return [
    response.command ? `OpenSCAD command: ${response.command}` : null,
    Number.isInteger(response.exitCode) ? `Exit code: ${response.exitCode}` : null,
    Number.isInteger(response.elapsedMs) ? `OpenSCAD render time: ${response.elapsedMs}ms` : null,
    response.debugSourcePath ? `Debug source: ${response.debugSourcePath}` : null,
    includeStreams && response.stdout ? `stdout:\n${response.stdout}` : null,
    includeStreams && response.stderr ? `stderr:\n${response.stderr}` : null,
  ].filter(Boolean);
}

function formatBuildElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
}

function getRenderProfileConfig(profile) {
  if (profile === 'final') {
    return {
      id: 'final',
      label: 'Final',
      defineOverrides: [],
      statusSuffix: 'full detail',
    };
  }

  return {
    id: 'quick',
    label: 'Quick',
    defineOverrides: ['$fn=28', '$fa=14', '$fs=1.5'],
    statusSuffix: 'reduced detail',
  };
}

function appendIssueDetail(issue, detail) {
  if (!detail) return issue;
  return {
    ...issue,
    detail: [issue.detail, detail].filter(Boolean).join('\n\n'),
  };
}

function appendStageDetailToDiagnostics(diagnostics, detail) {
  if (!detail) return diagnostics;
  if (diagnostics.errors.length > 0) {
    return {
      ...diagnostics,
      errors: diagnostics.errors.map((entry, index) => index === 0 ? appendIssueDetail(entry, detail) : entry),
    };
  }
  if (diagnostics.warnings.length > 0) {
    return {
      ...diagnostics,
      warnings: diagnostics.warnings.map((entry, index) => index === 0 ? appendIssueDetail(entry, detail) : entry),
    };
  }
  return diagnostics;
}

function buildRenderDiagnostics(response, sourceCode) {
  const hasExplicitFailure = Boolean(response?.error);
  const diagnostics = parseOpenScadOutput(
    [response?.stderr, response?.stdout, response?.error].filter(Boolean).join('\n'),
    sourceCode,
    { treatLooseLinesAsIssues: hasExplicitFailure },
  );
  const renderDetail = [
    response?.command ? `Command:\n${response.command}` : null,
    Number.isInteger(response?.exitCode) ? `Exit code: ${response.exitCode}` : null,
    Number.isInteger(response?.elapsedMs) ? `Render time: ${response.elapsedMs}ms` : null,
    response?.debugSourcePath ? `Debug source:\n${response.debugSourcePath}` : null,
  ].filter(Boolean).join('\n\n');

  if (!hasExplicitFailure) {
    return diagnostics;
  }

  if (diagnostics.errors.length === 0 && diagnostics.warnings.length === 0) {
    const fallbackMessage = response?.error || 'OpenSCAD render failed.';
    const lineNumber = extractDiagnosticLineNumber(fallbackMessage);
    return {
      errors: [{
        severity: 'error',
        message: fallbackMessage,
        raw: fallbackMessage,
        detail: [
          renderDetail,
          response?.stdout ? `stdout:\n${response.stdout}` : null,
          response?.stderr ? `stderr:\n${response.stderr}` : null,
        ].filter(Boolean).join('\n\n'),
        lineNumber,
        excerpt: buildCodeExcerpt(sourceCode, lineNumber),
      }],
      warnings: [],
      logs: diagnostics.logs,
    };
  }

  return {
    errors: diagnostics.errors.map((entry, index) => index === 0 ? appendIssueDetail(entry, renderDetail) : entry),
    warnings: diagnostics.warnings.map((entry, index) => index === 0 && diagnostics.errors.length === 0 ? appendIssueDetail(entry, renderDetail) : entry),
    logs: diagnostics.logs,
  };
}

function createRenderStageError(stageLabel, error, response, sourceCode) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown render pipeline failure.');
  const stageDetail = [
    `Pipeline stage:\n${stageLabel}`,
    Array.isArray(response?.stl) ? `STL bytes:\n${response.stl.length}` : null,
  ].filter(Boolean).join('\n\n');

  return appendStageDetailToDiagnostics(
    buildRenderDiagnostics({
      ...response,
      error: `Forge3D ${stageLabel.toLowerCase()} failed: ${message}`,
    }, sourceCode),
    stageDetail,
  );
}

function formatDiagnosticForPrompt(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return String(entry);

  const parts = [];
  const severityLabel = entry.severity ? `${String(entry.severity).toUpperCase()}: ` : '';
  parts.push(`${severityLabel}${entry.message || entry.raw || 'Issue'}`);

  if (entry.detail) {
    parts.push(entry.detail);
  }

  if (entry.excerpt?.lines?.length) {
    const excerptText = entry.excerpt.lines
      .map(({ number, text }) => `${String(number).padStart(4, ' ')} | ${text}`)
      .join('\n');
    parts.push(`Code excerpt:\n${excerptText}`);
  }

  return parts.join('\n');
}

const DEFAULT_ASSEMBLY_SCENE = {
  parts: [],
  selectedPartId: null,
  snap: {
    enabled: true,
    translateStepMm: 1,
    rotateStepDeg: 15,
  },
};

const DEFAULT_ASSEMBLY_MEASUREMENT = {
  enabled: false,
  points: [],
  distance: null,
  history: [],
};

const MAX_MEASUREMENT_HISTORY = 10;

function snapMetric(value, step) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

function applyAssemblySnap(transform, snap) {
  if (snap?.enabled === false) return cloneTransformState(transform);
  const next = cloneTransformState(transform);
  const translateStep = snap?.translateStepMm || 1;
  const rotateStep = snap?.rotateStepDeg || 15;
  next.position = next.position.map((value) => snapMetric(value, translateStep));
  next.rotation = next.rotation.map((value) => snapMetric(value, rotateStep));
  return next;
}

function cloneMeasurementPoint(point = {}) {
  return {
    position: Array.isArray(point.position) ? [...point.position] : [0, 0, 0],
    partId: point.partId || null,
  };
}

function cloneMeasurementEntry(entry = {}) {
  return {
    id: entry.id || `measurement-${Date.now()}`,
    distance: Number.isFinite(entry.distance) ? entry.distance : 0,
    label: entry.label || 'Measurement',
    createdAt: entry.createdAt || Date.now(),
    points: Array.isArray(entry.points) ? entry.points.map(cloneMeasurementPoint) : [],
  };
}

function cloneMeasurementState(measurement = {}) {
  return {
    enabled: measurement.enabled === true,
    points: Array.isArray(measurement.points) ? measurement.points.map(cloneMeasurementPoint) : [],
    distance: Number.isFinite(measurement.distance) ? measurement.distance : null,
    history: Array.isArray(measurement.history) ? measurement.history.map(cloneMeasurementEntry) : [],
  };
}

function computeMeasurementDistance(points = []) {
  if (points.length < 2) return null;
  const [start, end] = points;
  return Math.hypot(
    end.position[0] - start.position[0],
    end.position[1] - start.position[1],
    end.position[2] - start.position[2],
  );
}

function clearMeasurementDraft(measurement = {}, { disable = true } = {}) {
  const current = cloneMeasurementState(measurement);
  return {
    ...current,
    enabled: disable ? false : current.enabled,
    points: [],
    distance: null,
  };
}

function appendMeasurementPick(measurement = {}, point, resolvePartName) {
  const current = cloneMeasurementState(measurement);
  const nextPoints = [...current.points, cloneMeasurementPoint(point)].slice(-2);
  const distance = computeMeasurementDistance(nextPoints);

  if (nextPoints.length === 2 && Number.isFinite(distance)) {
    const labels = nextPoints
      .map((candidate) => resolvePartName(candidate.partId))
      .filter(Boolean);
    const entry = {
      id: `measurement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      distance,
      label: labels.length === 2 && labels[0] !== labels[1] ? `${labels[0]} -> ${labels[1]}` : (labels[0] || 'Measurement'),
      createdAt: Date.now(),
      points: nextPoints,
    };
    return {
      entry,
      nextMeasurement: {
        ...current,
        enabled: true,
        points: [],
        distance: null,
        history: [entry, ...current.history].slice(0, MAX_MEASUREMENT_HISTORY),
      },
    };
  }

  return {
    entry: null,
    nextMeasurement: {
      ...current,
      enabled: true,
      points: nextPoints,
      distance,
    },
  };
}
// ─── MAIN APP ────────────────────────────────────────────────────────
export default function Forge3D() {
  const ACTIVITY_RAIL_WIDTH = 52;
  const initialWorkspace = useMemo(() => loadWorkspace(), []);
  const initialPanelLayout = initialWorkspace.panelLayout || {};
  const [history, setHistory] = useState(() => createHistoryState(initialWorkspace.code));
  const code = history.present;
  const [result, setResult] = useState({ objects: [], logs: [], errors: [], warnings: [], variables: {} });
  const [activeTab, setActiveTab] = useState(initialWorkspace.workbenchTab || 'console');
  const [viewSettings, setViewSettings] = useState(initialWorkspace.viewSettings);
  const [sidebarOpen, setSidebarOpen] = useState(initialPanelLayout.sidebarOpen ?? true);
  const [sidebarTab, setSidebarTab] = useState(initialWorkspace.activeActivity || (initialWorkspace.code.trim() ? 'workspace' : 'start'));
  const [autoRun, setAutoRun] = useState(initialWorkspace.autoRun);
  const [renderProfile, setRenderProfile] = useState(initialWorkspace.renderProfile || 'quick');
  const [buildElapsedMs, setBuildElapsedMs] = useState(0);
  const [buildStatusDetail, setBuildStatusDetail] = useState('');
  const [currentFileName, setCurrentFileName] = useState(initialWorkspace.currentFileName || DEFAULT_FILE_NAME);
  const [currentFilePath, setCurrentFilePath] = useState(initialWorkspace.currentFilePath || null);
  const [savedCode, setSavedCode] = useState(initialWorkspace.lastSavedCode ?? initialWorkspace.code);
  const [comparisonCode, setComparisonCode] = useState(initialWorkspace.comparisonCode ?? initialWorkspace.lastSavedCode ?? initialWorkspace.code);
  const [statusMessage, setStatusMessage] = useState('Workspace restored');
  const [zoomFactor, setZoomFactor] = useState(1);
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [fitViewSignal, setFitViewSignal] = useState(0);
  const [theme, setTheme] = useState(initialWorkspace.theme || 'dark');
  const [startState, setStartState] = useState(initialWorkspace.startState || { search: '', sectionFilter: 'all' });
  const [preferredShellId, setPreferredShellId] = useState(initialWorkspace.terminalPreferences?.preferredShellId || null);
  const [terminalManagerState] = useState(initialWorkspace.terminalManagerState || {});
  const [currentRenderMeta, setCurrentRenderMeta] = useState({ profileId: null, sourceCode: null });
  const appRef = useRef(null);
  const contentRef = useRef(null);
  const canvasRef = useRef(null);
  const releaseScreenshotStartedRef = useRef(false);
  const timerRef = useRef(null);
  const editorRef = useRef(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [stlGeometry, setStlGeometry] = useState(null);
  const [mode, setMode] = useState('design');
  const [assemblyScenePath, setAssemblyScenePath] = useState(null);
  const [booleanOperandId, setBooleanOperandId] = useState(null);
  const [assemblyHistory, setAssemblyHistory] = useState(() => createHistoryState(DEFAULT_ASSEMBLY_SCENE));
  const [assemblyMeasurement, setAssemblyMeasurement] = useState(DEFAULT_ASSEMBLY_MEASUREMENT);
  const [assemblyBooleanState, setAssemblyBooleanState] = useState({ running: false, operation: null });
  const [building, setBuilding] = useState(false);
  const [lspDiagnostics, setLspDiagnostics] = useState({ errors: [], warnings: [], markers: [] });
  const [showDiffEditor, setShowDiffEditor] = useState(false);
  const [activeReference, setActiveReference] = useState(null);
  const [pendingExternalSnapshot, setPendingExternalSnapshot] = useState(null);
  const [availableShells, setAvailableShells] = useState([]);
  const [terminalState, setTerminalState] = useState({ status: 'idle', pid: null, cwd: null, shellId: null, shellLabel: null, error: null });
  const [terminalResetToken, setTerminalResetToken] = useState(0);
  const [terminalFocusToken, setTerminalFocusToken] = useState(0);
  const forgeAPI = requireForgeAPI();

  // ─── Phase 1 state ──────────────────────────────────────────────────
  const [recentFiles, setRecentFiles] = useState([]);
  const [workspaceFolder, setWorkspaceFolder] = useState(null);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [parsedParams, setParsedParams] = useState([]);

  // ─── Resizable panels ───────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(initialPanelLayout.sidebarWidth ?? 240);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => clampBottomPanelHeight(initialPanelLayout.bottomPanelHeight ?? DEFAULT_BOTTOM_PANEL_HEIGHT));
  const lastExpandedBottomHeightRef = useRef(bottomPanelHeight > COLLAPSED_BOTTOM_PANEL_HEIGHT ? bottomPanelHeight : DEFAULT_BOTTOM_PANEL_HEIGHT);
  const bottomPanelCollapsed = bottomPanelHeight === COLLAPSED_BOTTOM_PANEL_HEIGHT;
  const [editorWidth, setEditorWidth] = useState(initialPanelLayout.editorWidth ?? 480);
  const resizingRef = useRef(null); // null | 'sidebar' | 'bottom' | 'editor'
  const dragStartRef = useRef({});
  const shouldAutoFitViewRef = useRef(true);

  const DEFAULT_SIDEBAR_WIDTH = 240;
  const DEFAULT_EDITOR_WIDTH = 480;
  const MIN_SIDEBAR_WIDTH = 180;
  const MAX_SIDEBAR_WIDTH = 420;
  const MIN_EDITOR_WIDTH = 280;
  const MIN_VIEWPORT_WIDTH = 320;
  const MIN_BOTTOM_PANEL_HEIGHT = COLLAPSED_BOTTOM_PANEL_HEIGHT;

  const buildIdRef = useRef(0);
  const buildStartRef = useRef(0);
  const buildTimeoutRef = useRef(null);
  const booleanWorkerRef = useRef(null);
  const booleanTimeoutRef = useRef(null);
  const booleanRequestIdRef = useRef(0);
  const renderRequestIdRef = useRef(null);
  const renderLogBufferRef = useRef([]);
  const latestRenderedGeometryRef = useRef(null);
  const currentBuildProfileRef = useRef(getRenderProfileConfig(initialWorkspace.renderProfile || 'quick'));
  const BUILD_TIMEOUT = 5 * 60 * 1000;
  const BOOLEAN_TIMEOUT = 30 * 1000;

  const colors = getThemeColors(theme);
  const activeRenderProfile = useMemo(() => getRenderProfileConfig(renderProfile), [renderProfile]);
  const projectWorkingDirectory = useMemo(() => workspaceFolder || getParentDirectory(currentFilePath), [workspaceFolder, currentFilePath]);
  const documentSymbols = useMemo(() => extractOpenScadSymbols(code), [code]);
  const previewCode = code;
  const assemblyScene = assemblyHistory.present;
  const selectedAssemblyPart = useMemo(
    () => assemblyScene.parts.find((part) => part.id === assemblyScene.selectedPartId) || null,
    [assemblyScene.parts, assemblyScene.selectedPartId],
  );
  const selectedAssemblyMetrics = useMemo(
    () => (selectedAssemblyPart ? getAssemblyPartMetrics(selectedAssemblyPart) : null),
    [selectedAssemblyPart],
  );
  const hasCurrentRenderableGeometry = Boolean(stlGeometry) && currentRenderMeta.sourceCode === previewCode;
  const hasCurrentFinalRender = hasCurrentRenderableGeometry && currentRenderMeta.profileId === 'final';
  const canEnterAssembly = Boolean(hasCurrentRenderableGeometry || assemblyScene.parts.length > 0);
  const canRefreshCurrentRender = hasCurrentRenderableGeometry;
  const booleanBusy = assemblyBooleanState.running;
  const booleanOperandOptions = useMemo(
    () => assemblyScene.parts.filter((part) => part.id !== selectedAssemblyPart?.id),
    [assemblyScene.parts, selectedAssemblyPart],
  );

  useEffect(() => {
    if (!selectedAssemblyPart || booleanOperandOptions.length === 0) {
      if (booleanOperandId !== null) setBooleanOperandId(null);
      return;
    }
    if (!booleanOperandOptions.some((part) => part.id === booleanOperandId)) {
      setBooleanOperandId(booleanOperandOptions[0].id);
    }
  }, [booleanOperandId, booleanOperandOptions, selectedAssemblyPart]);

  // ─── History ────────────────────────────────────────────────────────
  const applyCodeChange = useCallback((nextCodeOrUpdater) => {
    setHistory((current) => {
      const nextCode = typeof nextCodeOrUpdater === 'function'
        ? nextCodeOrUpdater(current.present)
        : nextCodeOrUpdater;
      return pushHistoryState(current, nextCode);
    });
  }, []);

  const replaceCodeWithoutHistory = useCallback((nextCode) => {
    setHistory(replaceHistoryState(nextCode));
  }, []);

  const undoCode = useCallback(() => {
    let changed = false;
    setHistory((current) => {
      const result = undoHistoryState(current);
      changed = result.changed;
      return result.state;
    });
    if (changed) setStatusMessage('Undo applied');
  }, []);

  const redoCode = useCallback(() => {
    let changed = false;
    setHistory((current) => {
      const result = redoHistoryState(current);
      changed = result.changed;
      return result.state;
    });
    if (changed) setStatusMessage('Redo applied');
  }, []);

  const canUndoCode = history.past.length > 0;
  const canRedoCode = history.future.length > 0;
  const canUndoAssembly = assemblyHistory.past.length > 0;
  const canRedoAssembly = assemblyHistory.future.length > 0;
  const canUndo = mode === 'assembly' ? canUndoAssembly : canUndoCode;
  const canRedo = mode === 'assembly' ? canRedoAssembly : canRedoCode;
  const isDirty = code !== savedCode;
  const hasComparisonDiff = code !== comparisonCode;

  const updateStartState = useCallback((partialState) => {
    setStartState((current) => ({ ...current, ...partialState }));
  }, []);

  const expandBottomPanel = useCallback(() => {
    const maximum = Math.min(520, (appRef.current?.clientHeight || window.innerHeight) - 220);
    setBottomPanelHeight((height) => clampBottomPanelHeight(
      height === COLLAPSED_BOTTOM_PANEL_HEIGHT ? lastExpandedBottomHeightRef.current : height, maximum,
    ));
  }, []);

  const focusTerminal = useCallback(() => {
    expandBottomPanel();
    setTerminalFocusToken((value) => value + 1);
  }, [expandBottomPanel]);

  const replaceRenderLogs = useCallback((nextLogs) => {
    renderLogBufferRef.current = nextLogs;
    setResult((current) => ({
      ...current,
      logs: nextLogs,
    }));
  }, []);

  // ─── STL loader helper ───────────────────────────────────────────────
  const loadStlBytes = useCallback((bytes, elapsed) => {
    const stlBytes = bytes instanceof Uint8Array
      ? bytes
      : (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes));

    if (stlBytes.byteLength < 84) {
      throw new Error(`STL output is too small to parse (${stlBytes.byteLength} bytes).`);
    }

    const parsed = parseSTL(stlBytes);
    if (!Number.isFinite(parsed.triangleCount) || parsed.triangleCount <= 0 || parsed.vertices.length === 0) {
      throw new Error('STL output contained no triangles.');
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(parsed.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(parsed.normals, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const bounds = geometry.boundingBox;
    const sphere = geometry.boundingSphere;
    const boundsAreFinite = bounds
      && Number.isFinite(bounds.min.x)
      && Number.isFinite(bounds.min.y)
      && Number.isFinite(bounds.min.z)
      && Number.isFinite(bounds.max.x)
      && Number.isFinite(bounds.max.y)
      && Number.isFinite(bounds.max.z);

    if (!boundsAreFinite || !sphere || !Number.isFinite(sphere.radius) || sphere.radius <= 0) {
      throw new Error('STL geometry parsed, but produced invalid bounds for viewport rendering.');
    }

    latestRenderedGeometryRef.current = geometry;
    setStlGeometry(geometry);
    return parsed.triangleCount;
  }, []);

  const queueAutoFitView = useCallback(() => {
    shouldAutoFitViewRef.current = true;
  }, []);

  const queueAssemblyFitView = useCallback(() => {
    queueAutoFitView();
    setFitViewSignal((value) => value + 1);
  }, [queueAutoFitView]);

  const resetAssemblyState = useCallback(({ keepMode = false } = {}) => {
    setAssemblyHistory(replaceHistoryState(DEFAULT_ASSEMBLY_SCENE));
    setAssemblyMeasurement(DEFAULT_ASSEMBLY_MEASUREMENT);
    setAssemblyScenePath(null);
    setBooleanOperandId(null);
    if (!keepMode) setMode('design');
  }, []);

  const replaceAssemblySceneWithoutHistory = useCallback((nextScene) => {
    setAssemblyHistory(replaceHistoryState(nextScene));
  }, []);

  const updateAssemblyScene = useCallback((updater, { recordHistory = true } = {}) => {
    setAssemblyHistory((current) => {
      const baseScene = current.present;
      const nextScene = typeof updater === 'function' ? updater(baseScene) : updater;
      if (!nextScene || Object.is(nextScene, baseScene)) return current;
      return recordHistory
        ? pushHistoryState(current, nextScene)
        : updateHistoryPresent(current, nextScene);
    });
  }, []);

  const resolveAssemblyPartName = useCallback((partId) => (
    assemblyScene.parts.find((part) => part.id === partId)?.name || 'Measurement'
  ), [assemblyScene.parts]);

  const undoAssemblyScene = useCallback(() => {
    let changed = false;
    setAssemblyHistory((current) => {
      const result = undoHistoryState(current);
      changed = result.changed;
      return result.state;
    });
    if (changed) {
      setAssemblyMeasurement((current) => clearMeasurementDraft(current, { disable: false }));
      setStatusMessage('Assembly undo applied');
    }
  }, []);

  const redoAssemblyScene = useCallback(() => {
    let changed = false;
    setAssemblyHistory((current) => {
      const result = redoHistoryState(current);
      changed = result.changed;
      return result.state;
    });
    if (changed) {
      setAssemblyMeasurement((current) => clearMeasurementDraft(current, { disable: false }));
      setStatusMessage('Assembly redo applied');
    }
  }, []);

  const handleAssemblyMeasurementPick = useCallback((payload) => {
    if (!payload?.point) return;
    let nextStatus = null;
    setAssemblyMeasurement((current) => {
      const { entry, nextMeasurement } = appendMeasurementPick(current, payload, resolveAssemblyPartName);
      nextStatus = entry
        ? `Logged measurement ${entry.distance.toFixed(2)} mm`
        : 'First point picked. Click a second point to log the measurement.';
      return nextMeasurement;
    });
    if (nextStatus) setStatusMessage(nextStatus);
  }, [resolveAssemblyPartName]);

  const handleMeasurementPrimaryAction = useCallback(() => {
    let activating = false;
    setAssemblyMeasurement((current) => {
      const shouldActivate = !(current.enabled || current.points.length > 0);
      activating = shouldActivate;
      return shouldActivate
        ? { ...cloneMeasurementState(current), enabled: true, points: [], distance: null }
        : clearMeasurementDraft(current);
    });
    setStatusMessage(activating ? 'Pick two points in the viewport to log a measurement' : 'Cleared active measurement picks');
  }, []);

  const handleClearMeasurementHistory = useCallback(() => {
    setAssemblyMeasurement((current) => ({
      ...clearMeasurementDraft(current, { disable: current.enabled === false }),
      history: [],
    }));
    setStatusMessage('Cleared measurement log');
  }, []);

  const addAssemblyPart = useCallback(({ name, source, geometry, centerOnAdd = false, switchMode = true }) => {
    const basePart = createAssemblyPart({ name, source, geometry });
    const floorTransform = centerOnAdd ? createCenteredTransform(basePart) : createFloorAlignedTransform(basePart);
    const nextPart = { ...basePart, transform: floorTransform };

    updateAssemblyScene((current) => ({
      ...current,
      parts: [...current.parts, nextPart],
      selectedPartId: nextPart.id,
    }));
    setAssemblyMeasurement((current) => clearMeasurementDraft(current));
    if (switchMode) {
      setMode('assembly');
      setSidebarTab('assembly');
      setSidebarOpen(true);
    }
    queueAssemblyFitView();
    return nextPart;
  }, [queueAssemblyFitView, updateAssemblyScene]);

  const addCurrentRenderToAssembly = useCallback(({ centerOnAdd = false, switchMode = true } = {}) => {
    const geometry = latestRenderedGeometryRef.current || stlGeometry;
    if (!geometry || !hasCurrentRenderableGeometry) {
      setStatusMessage('Build the current design before adding it to Assembly Mode');
      return null;
    }

    const baseName = currentFileName.replace(/\.scad$/i, '') || 'Current Render';
    const nextPart = addAssemblyPart({
      name: baseName,
      source: { kind: 'active-render', filePath: currentFilePath || null },
      geometry: createAssemblyGeometryFromDesignGeometry(geometry),
      centerOnAdd,
      switchMode,
    });
    setStatusMessage(`Added ${nextPart.name} to Assembly Mode`);
    return nextPart;
  }, [addAssemblyPart, currentFileName, currentFilePath, hasCurrentRenderableGeometry, stlGeometry]);

  const updateAssemblyPart = useCallback((partId, updater) => {
    updateAssemblyScene((current) => {
      let changed = false;
      const nextParts = current.parts.map((part) => {
        if (part.id !== partId) return part;
        changed = true;
        return typeof updater === 'function' ? updater(part) : { ...part, ...updater };
      });
      return changed ? { ...current, parts: nextParts } : current;
    });
  }, [updateAssemblyScene]);

  const updateAssemblyPartTransform = useCallback((partId, nextTransform) => {
    const sourcePart = assemblyScene.parts.find((part) => part.id === partId);
    if (!sourcePart || sourcePart.locked) {
      if (sourcePart?.locked) setStatusMessage(`Unlock ${sourcePart.name} before changing its transform`);
      return;
    }
    updateAssemblyPart(partId, (part) => {
      const merged = applyAssemblySnap({
        ...cloneTransformState(part.transform),
        ...nextTransform,
        position: nextTransform.position ? [...nextTransform.position] : [...part.transform.position],
        rotation: nextTransform.rotation ? [...nextTransform.rotation] : [...part.transform.rotation],
        scale: nextTransform.scale ? [...nextTransform.scale] : [...part.transform.scale],
      }, assemblyScene.snap);
      return { ...part, transform: merged };
    });
  }, [assemblyScene.parts, assemblyScene.snap, updateAssemblyPart]);

  const selectAssemblyPart = useCallback((partId) => {
    updateAssemblyScene((current) => ({
      ...current,
      selectedPartId: partId,
    }), { recordHistory: false });
  }, [updateAssemblyScene]);

  const refreshSelectedCurrentRenderPart = useCallback(() => {
    if (!selectedAssemblyPart || selectedAssemblyPart.source?.kind !== 'active-render' || !stlGeometry) {
      setStatusMessage('Build the current design before refreshing this Assembly part');
      return;
    }

    updateAssemblyPart(selectedAssemblyPart.id, (part) => {
      const refreshedGeometry = createAssemblyGeometryFromDesignGeometry(stlGeometry);
      return {
        ...part,
        geometry: refreshedGeometry,
        transform: createFloorAlignedTransform({
          ...part,
          geometry: refreshedGeometry,
        }),
      };
    });
    queueAssemblyFitView();
    setStatusMessage(`Refreshed ${selectedAssemblyPart.name} from the current Design render`);
  }, [queueAssemblyFitView, selectedAssemblyPart, stlGeometry, updateAssemblyPart]);

  const duplicateSelectedAssemblyPart = useCallback((partId) => {
    const sourcePart = assemblyScene.parts.find((part) => part.id === partId);
    if (!sourcePart) return;
    const nextPart = duplicateAssemblyPart(sourcePart);
    updateAssemblyScene((current) => ({
      ...current,
      parts: [...current.parts, nextPart],
      selectedPartId: nextPart.id,
    }));
    queueAssemblyFitView();
    setStatusMessage(`Duplicated ${sourcePart.name}`);
  }, [assemblyScene.parts, queueAssemblyFitView, updateAssemblyScene]);

  const deleteAssemblyPart = useCallback((partId) => {
    const sourcePart = assemblyScene.parts.find((part) => part.id === partId);
    if (!sourcePart) return;
    if (sourcePart.locked) {
      setStatusMessage(`Unlock ${sourcePart.name} before deleting it`);
      return;
    }
    updateAssemblyScene((current) => {
      const nextParts = current.parts.filter((part) => part.id !== partId);
      return {
        ...current,
        parts: nextParts,
        selectedPartId: current.selectedPartId === partId ? nextParts[0]?.id || null : current.selectedPartId,
      };
    });
    setAssemblyMeasurement((current) => clearMeasurementDraft(current));
    if (assemblyScene.parts.length === 1) setMode('design');
    setStatusMessage(`Removed ${sourcePart.name} from Assembly Mode`);
  }, [assemblyScene.parts, updateAssemblyScene]);

  const toggleAssemblyPartVisibility = useCallback((partId) => {
    updateAssemblyPart(partId, (part) => ({ ...part, visible: part.visible === false }));
  }, [updateAssemblyPart]);

  const toggleAssemblyPartLock = useCallback((partId) => {
    updateAssemblyPart(partId, (part) => ({ ...part, locked: !part.locked }));
  }, [updateAssemblyPart]);

  const dropSelectedAssemblyPartToFloor = useCallback(() => {
    if (!selectedAssemblyPart) return;
    if (selectedAssemblyPart.locked) {
      setStatusMessage(`Unlock ${selectedAssemblyPart.name} before moving it`);
      return;
    }
    updateAssemblyPart(selectedAssemblyPart.id, (part) => ({
      ...part,
      transform: createFloorAlignedTransform(part),
    }));
    setStatusMessage(`Dropped ${selectedAssemblyPart.name} to the floor`);
  }, [selectedAssemblyPart, updateAssemblyPart]);

  const centerSelectedAssemblyPart = useCallback(() => {
    if (!selectedAssemblyPart) return;
    if (selectedAssemblyPart.locked) {
      setStatusMessage(`Unlock ${selectedAssemblyPart.name} before moving it`);
      return;
    }
    updateAssemblyPart(selectedAssemblyPart.id, (part) => ({
      ...part,
      transform: createCenteredTransform(part),
    }));
    setStatusMessage(`Centered ${selectedAssemblyPart.name}`);
  }, [selectedAssemblyPart, updateAssemblyPart]);

  const handleAssemblyPositionInput = useCallback((axisIndex, value) => {
    if (!selectedAssemblyPart || selectedAssemblyPart.locked || Number.isNaN(value)) return;
    const nextPosition = [...selectedAssemblyPart.transform.position];
    nextPosition[axisIndex] = value;
    updateAssemblyPartTransform(selectedAssemblyPart.id, { position: nextPosition });
  }, [selectedAssemblyPart, updateAssemblyPartTransform]);

  const handleAssemblyRotationInput = useCallback((axisIndex, value) => {
    if (!selectedAssemblyPart || selectedAssemblyPart.locked || Number.isNaN(value)) return;
    const nextRotation = [...selectedAssemblyPart.transform.rotation];
    nextRotation[axisIndex] = value;
    updateAssemblyPartTransform(selectedAssemblyPart.id, { rotation: nextRotation });
  }, [selectedAssemblyPart, updateAssemblyPartTransform]);

  const handleImportAssemblyPart = useCallback(async (kind) => {
    try {
      const payload = await forgeAPI.importAssemblyPart({ kind });
      if (!payload) return;
      if (payload.error) {
        setResult({ objects: [], logs: [], errors: [payload.error], warnings: [], variables: {} });
        setActiveTab('errors');
        setStatusMessage(`Assembly import failed: ${payload.error}`);
        return;
      }

      const geometry = createAssemblyGeometryFromStlBytes(new Uint8Array(payload.stl));
      addAssemblyPart({
        name: payload.name.replace(/\.(stl|scad)$/i, ''),
        source: payload.source,
        geometry,
      });
      setStatusMessage(`Imported ${payload.name} into Assembly Mode`);
    } catch (error) {
      setResult({ objects: [], logs: [], errors: [error.message], warnings: [], variables: {} });
      setActiveTab('errors');
      setStatusMessage(`Assembly import failed: ${error.message}`);
    }
  }, [addAssemblyPart, forgeAPI]);

  const handleSaveAssemblyScene = useCallback(async () => {
    if (assemblyScene.parts.length === 0) {
      setStatusMessage('Add at least one part before saving an Assembly scene');
      return;
    }

    try {
      const suggestedName = `${currentFileName.replace(/\.scad$/i, '') || 'assembly'}.forge3dscene.json`;
      const saved = await forgeAPI.saveAssemblyScene({
        content: JSON.stringify(serializeAssemblyScene(assemblyScene), null, 2),
        filePath: assemblyScenePath,
        suggestedName,
      });
      if (!saved) return;
      setAssemblyScenePath(saved.filePath || null);
      setStatusMessage(`Saved ${saved.name || suggestedName}`);
    } catch (error) {
      setStatusMessage(`Assembly save failed: ${error.message}`);
    }
  }, [assemblyScene, assemblyScenePath, currentFileName, forgeAPI]);

  const handleOpenAssemblyScene = useCallback(async () => {
    try {
      const payload = await forgeAPI.openAssemblyScene();
      if (!payload) return;
      const parsed = JSON.parse(payload.content);
      const nextScene = deserializeAssemblyScene(parsed);
      replaceAssemblySceneWithoutHistory(nextScene);
      setAssemblyMeasurement(DEFAULT_ASSEMBLY_MEASUREMENT);
      setAssemblyScenePath(payload.filePath || null);
      setMode('assembly');
      setSidebarTab('assembly');
      setSidebarOpen(true);
      queueAssemblyFitView();
      setStatusMessage(`Opened ${payload.name || 'assembly scene'}`);
    } catch (error) {
      setStatusMessage(`Assembly open failed: ${error.message}`);
    }
  }, [forgeAPI, queueAssemblyFitView, replaceAssemblySceneWithoutHistory]);

  const terminateBooleanWorker = useCallback(() => {
    if (booleanTimeoutRef.current) {
      clearTimeout(booleanTimeoutRef.current);
      booleanTimeoutRef.current = null;
    }
    if (booleanWorkerRef.current) {
      booleanWorkerRef.current.terminate();
      booleanWorkerRef.current = null;
    }
  }, []);

  const runAssemblyBooleanOperation = useCallback((operation, primaryPart, operandPart) => new Promise((resolve, reject) => {
    terminateBooleanWorker();
    const worker = new Worker(new URL('./forge3d/assembly-boolean-worker.js', import.meta.url), { type: 'module' });
    const requestId = ++booleanRequestIdRef.current;
    booleanWorkerRef.current = worker;
    setAssemblyBooleanState({ running: true, operation });

    const finish = () => {
      setAssemblyBooleanState({ running: false, operation: null });
      terminateBooleanWorker();
    };

    booleanTimeoutRef.current = setTimeout(() => {
      finish();
      reject(new Error(`Boolean ${operation} timed out after ${Math.round(BOOLEAN_TIMEOUT / 1000)}s`));
    }, BOOLEAN_TIMEOUT);

    worker.onmessage = (event) => {
      if (event.data?.requestId !== requestId) return;
      const payload = event.data;
      finish();
      if (payload.ok) {
        resolve(payload.geometry);
        return;
      }
      reject(new Error(payload.error || `Boolean ${operation} failed`));
    };

    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || `Boolean ${operation} worker crashed`));
    };

    worker.postMessage({
      requestId,
      operation,
      primary: {
        geometry: serializeAssemblyGeometry(primaryPart.geometry),
        transform: primaryPart.transform,
      },
      operand: {
        geometry: serializeAssemblyGeometry(operandPart.geometry),
        transform: operandPart.transform,
      },
    });
  }), [BOOLEAN_TIMEOUT, terminateBooleanWorker]);

  const handleRunBooleanOperation = useCallback(async (operation) => {
    const primaryPart = selectedAssemblyPart;
    const operandPart = assemblyScene.parts.find((part) => part.id === booleanOperandId);
    if (!primaryPart || !operandPart) {
      setStatusMessage('Select a part and a boolean operand first');
      return;
    }
    if (booleanBusy) {
      setStatusMessage('A boolean operation is already running');
      return;
    }

    try {
      setStatusMessage(`Running ${operation} for ${primaryPart.name} and ${operandPart.name}...`);
      const payload = await runAssemblyBooleanOperation(operation, primaryPart, operandPart);
      const bakedGeometry = createAssemblyGeometryFromPayload(payload);

      const derivedPart = createAssemblyPart({
        name: `${primaryPart.name} ${operation} ${operandPart.name}`,
        source: { kind: 'derived', filePath: null },
        geometry: bakedGeometry,
        metadata: {
          derivedFrom: [primaryPart.id, operandPart.id],
          operation,
        },
      });

      updateAssemblyScene((current) => ({
        ...current,
        parts: [
          ...current.parts.map((part) => (
            part.id === primaryPart.id || part.id === operandPart.id
              ? { ...part, visible: false }
              : part
          )),
          derivedPart,
        ],
        selectedPartId: derivedPart.id,
      }));
      setStatusMessage(`${operation} created ${derivedPart.name}`);
      queueAssemblyFitView();
    } catch (error) {
      setResult({ objects: [], logs: [], errors: [error.message], warnings: [], variables: {} });
      setActiveTab('errors');
      setStatusMessage(`Boolean ${operation} failed: ${error.message}`);
    }
  }, [assemblyScene.parts, booleanBusy, booleanOperandId, queueAssemblyFitView, runAssemblyBooleanOperation, selectedAssemblyPart, updateAssemblyScene]);

  const clearBuildTimeout = useCallback((timeoutHandle = buildTimeoutRef.current) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    if (buildTimeoutRef.current === timeoutHandle) {
      buildTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    terminateBooleanWorker();
  }, [terminateBooleanWorker]);

  const loadFileSnapshot = useCallback(async (filePath, { quiet = false, reason = 'reload' } = {}) => {
    if (!filePath || !forgeAPI.readFileSnapshot) return null;

    const snapshot = await forgeAPI.readFileSnapshot(filePath);
    if (!snapshot?.exists || snapshot.error) {
      if (!quiet) {
        setStatusMessage(`Disk reload failed: ${snapshot?.error || 'file is unavailable'}`);
      }
      return snapshot;
    }

    const hasUnsavedLocalChanges = code !== savedCode;
    if (hasUnsavedLocalChanges) {
      setPendingExternalSnapshot(snapshot);
      setComparisonCode(snapshot.content);
      setShowDiffEditor(true);
      if (!quiet) {
        setStatusMessage(`Disk changed for ${snapshot.name || currentFileName}; review local vs disk before choosing`);
      }
      return { skipped: true, reason: 'dirty', snapshot };
    }

    if (snapshot.content === code && snapshot.content === savedCode) {
      return { reused: true, snapshot };
    }

    queueAutoFitView();
    setComparisonCode(code);
    replaceCodeWithoutHistory(snapshot.content);
    setSavedCode(snapshot.content);
    setPendingExternalSnapshot(null);
    setCurrentFileName(snapshot.name || currentFileName);
    setCurrentFilePath(snapshot.filePath || filePath);
    setShowDiffEditor(true);
    setStatusMessage(
      reason === 'restore'
        ? `Loaded latest disk version of ${snapshot.name || currentFileName}`
        : `Reloaded ${snapshot.name || currentFileName} from disk`,
    );
    return { applied: true, snapshot };
  }, [code, currentFileName, forgeAPI, queueAutoFitView, replaceCodeWithoutHistory, savedCode]);

  // ─── Native build (Electron → openscad.com IPC) ──────────────────────
  const runCode = useCallback(async (options = {}) => {
    const targetProfile = getRenderProfileConfig(options.profileId || renderProfile);
    const sourceCode = options.codeOverride ?? previewCode;
    const sourceName = options.sourceName || currentFileName || DEFAULT_FILE_NAME;
    const sourcePath = options.sourcePath ?? currentFilePath ?? null;
    const id = ++buildIdRef.current;
    const requestId = `render-${Date.now()}-${id}`;
    renderRequestIdRef.current = requestId;
    currentBuildProfileRef.current = targetProfile;
    renderLogBufferRef.current = [];
    buildStartRef.current = performance.now();
    setBuilding(true);
    setBuildElapsedMs(0);
    setBuildStatusDetail('Preparing render...');
    setStatusMessage(`Rendering ${sourceName} (${targetProfile.label})...`);
    setResult((current) => ({
      ...current,
      logs: [],
      errors: [],
      warnings: [],
    }));

    clearBuildTimeout();
    const timeoutHandle = setTimeout(() => {
      if (buildIdRef.current !== id) return;
      buildTimeoutRef.current = null;
      if (renderRequestIdRef.current === requestId) renderRequestIdRef.current = null;
      latestRenderedGeometryRef.current = null;
      setBuilding(false);
      setBuildStatusDetail(`Timed out after ${formatBuildElapsed(BUILD_TIMEOUT)}`);
      setCurrentRenderMeta({ profileId: null, sourceCode: null });
      setResult({
        objects: [],
        logs: [...renderLogBufferRef.current],
        errors: [`Render timed out after ${BUILD_TIMEOUT / 1000}s`],
        warnings: [],
        variables: {},
      });
      setActiveTab('errors');
    }, BUILD_TIMEOUT);
    buildTimeoutRef.current = timeoutHandle;

    try {
      const response = await forgeAPI.renderOpenSCAD(sourceCode, {
        sourceName,
        sourcePath,
        requestId,
        defineOverrides: targetProfile.defineOverrides,
      });
      clearBuildTimeout(timeoutHandle);
      if (buildIdRef.current !== id) return; // stale build
      if (renderRequestIdRef.current === requestId) renderRequestIdRef.current = null;
      setBuilding(false);
      const elapsed = Math.round(performance.now() - buildStartRef.current);
      setBuildElapsedMs(elapsed);

      if (response.error) {
        latestRenderedGeometryRef.current = null;
        setStlGeometry(null);
        setCurrentRenderMeta({ profileId: null, sourceCode: null });
        const diagnostics = buildRenderDiagnostics(response, sourceCode);
        const primaryIssue = diagnostics.errors[0] || diagnostics.warnings[0];
        const lifecycleLogs = [
          ...renderLogBufferRef.current,
          ...buildRenderLifecycleLogEntries(response, { includeStreams: false }),
          ...diagnostics.logs,
        ].filter(Boolean);
        setResult({ objects: [], logs: lifecycleLogs, errors: diagnostics.errors, warnings: diagnostics.warnings, variables: {} });
        setActiveTab('errors');
        setBuildStatusDetail('Render failed');
        setStatusMessage(primaryIssue ? `Render failed: ${primaryIssue.message}` : 'Render failed. See Problems for details.');
        return false;
      } else {
        let triangleCount = 0;
        try {
          triangleCount = loadStlBytes(new Uint8Array(response.stl), elapsed);
          setCurrentRenderMeta({ profileId: targetProfile.id, sourceCode });
        } catch (loadError) {
          latestRenderedGeometryRef.current = null;
          setStlGeometry(null);
          setCurrentRenderMeta({ profileId: null, sourceCode: null });
          const diagnostics = createRenderStageError('STL ingest', loadError, response, sourceCode);
          const primaryIssue = diagnostics.errors[0] || diagnostics.warnings[0];
          setResult({
            objects: [],
            logs: [...renderLogBufferRef.current, ...buildRenderLifecycleLogEntries(response, { includeStreams: false }), ...diagnostics.logs],
            errors: diagnostics.errors,
            warnings: diagnostics.warnings,
            variables: {},
          });
          setActiveTab('errors');
          setBuildStatusDetail('STL ingest failed');
          setStatusMessage(primaryIssue ? `Render failed: ${primaryIssue.message}` : 'Render failed during STL ingest. See Problems for details.');
          return false;
        }
        const diagnostics = buildRenderDiagnostics(response, sourceCode);
        setResult({
          objects: [],
          logs: [
            ...renderLogBufferRef.current,
            `Rendered ${triangleCount} triangles in ${elapsed}ms`,
            ...buildRenderLifecycleLogEntries(response, { includeStreams: false }),
            ...diagnostics.logs,
          ],
          errors: diagnostics.errors,
          warnings: diagnostics.warnings,
          variables: {},
        });
        setBuildStatusDetail('Render complete');
        setStatusMessage(
          diagnostics.warnings.length > 0
            ? `Render completed with ${diagnostics.warnings.length} warning${diagnostics.warnings.length === 1 ? '' : 's'}`
            : 'Render complete',
        );
        return true;
      }
    } catch (err) {
      clearBuildTimeout(timeoutHandle);
      if (buildIdRef.current !== id) return; // stale build
      if (renderRequestIdRef.current === requestId) renderRequestIdRef.current = null;
      setBuilding(false);
      latestRenderedGeometryRef.current = null;
      setStlGeometry(null);
      setCurrentRenderMeta({ profileId: null, sourceCode: null });
      const failureResponse = {
        error: err.message || 'OpenSCAD render failed.',
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        command: err.command || null,
        exitCode: Number.isInteger(err.code) ? err.code : null,
        debugSourcePath: err.debugSourcePath || null,
        elapsedMs: err.elapsedMs || null,
      };
      const diagnostics = buildRenderDiagnostics(failureResponse, sourceCode);
      const primaryIssue = diagnostics.errors[0] || diagnostics.warnings[0];
      setResult({
        objects: [],
        logs: [...renderLogBufferRef.current, ...buildRenderLifecycleLogEntries(failureResponse, { includeStreams: false }), ...diagnostics.logs],
        errors: diagnostics.errors,
        warnings: diagnostics.warnings,
        variables: {},
      });
      setActiveTab('errors');
      setBuildStatusDetail(err.message === 'OpenSCAD render cancelled.' ? 'Render cancelled' : 'Render failed');
      setStatusMessage(primaryIssue ? `Render failed: ${primaryIssue.message}` : 'Render failed. See Problems for details.');
      return false;
    }
  }, [BUILD_TIMEOUT, clearBuildTimeout, currentFileName, currentFilePath, forgeAPI, loadStlBytes, previewCode, renderProfile]);

  const cancelBuild = useCallback(async () => {
    buildIdRef.current += 1;
    clearBuildTimeout();
    const requestId = renderRequestIdRef.current;
    renderRequestIdRef.current = null;
    if (requestId) {
      try {
        await forgeAPI.cancelOpenScadRender(requestId);
      } catch (_) {}
    }
    latestRenderedGeometryRef.current = null;
    setCurrentRenderMeta({ profileId: null, sourceCode: null });
    setBuilding(false);
    setBuildStatusDetail('Render cancelled');
    setStatusMessage('Build cancelled');
  }, [clearBuildTimeout, forgeAPI]);

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
    setActiveReference(null);
    setSavedCode(next.code);
    setComparisonCode(next.code);
    setPendingExternalSnapshot(null);
    setCurrentFileName(DEFAULT_FILE_NAME);
    setCurrentFilePath(null);
    setAutoRun(next.autoRun);
    setRenderProfile(next.renderProfile || 'quick');
    setSidebarTab(next.activeActivity || 'start');
    setSidebarOpen(true);
    setStartState(next.startState || { search: '', sectionFilter: 'all' });
    setActiveTab(next.workbenchTab || 'console');
    resetAssemblyState();
    setStatusMessage('Started a new workspace');
  }, [queueAutoFitView, replaceCodeWithoutHistory, resetAssemblyState]);

  const openFile = useCallback(async () => {
    try {
      const payload = await forgeAPI.openFile();
      if (!payload) return;
      queueAutoFitView();
      replaceCodeWithoutHistory(payload.content);
      setActiveReference(null);
      setSavedCode(payload.content);
      setComparisonCode(payload.content);
      setPendingExternalSnapshot(null);
      setCurrentFileName(payload.name || DEFAULT_FILE_NAME);
      setCurrentFilePath(payload.filePath || null);
      resetAssemblyState();
      setStatusMessage(`Opened ${payload.name || DEFAULT_FILE_NAME}`);
      // Refresh recent files list
      forgeAPI.getRecentFiles().then(setRecentFiles).catch(() => {});
    } catch (error) {
      setStatusMessage(`Open failed: ${error.message}`);
    }
  }, [forgeAPI, queueAutoFitView, replaceCodeWithoutHistory, resetAssemblyState]);

  const openFilePath = useCallback(async (filePath) => {
    try {
      const payload = await forgeAPI.openFilePath(filePath);
      if (!payload || payload.error) {
        setStatusMessage(`Failed to open: ${payload?.error || 'unknown error'}`);
        return;
      }
      queueAutoFitView();
      replaceCodeWithoutHistory(payload.content);
      setActiveReference(null);
      setSavedCode(payload.content);
      setComparisonCode(payload.content);
      setPendingExternalSnapshot(null);
      setCurrentFileName(payload.name || DEFAULT_FILE_NAME);
      setCurrentFilePath(payload.filePath || null);
      resetAssemblyState();
      setStatusMessage(`Opened ${payload.name || DEFAULT_FILE_NAME}`);
      forgeAPI.getRecentFiles().then(setRecentFiles).catch(() => {});
    } catch (error) {
      setStatusMessage(`Open failed: ${error.message}`);
    }
  }, [forgeAPI, queueAutoFitView, replaceCodeWithoutHistory, resetAssemblyState]);

  const saveFile = useCallback(async () => {
    try {
      const suggestedName = currentFileName?.endsWith('.scad') ? currentFileName : `${currentFileName || 'model'}.scad`;
      const saved = await forgeAPI.saveFile({ content: code, filePath: currentFilePath, suggestedName });
      if (!saved) return;
      setCurrentFileName(saved.name || suggestedName);
      setCurrentFilePath(saved.filePath || null);
      setSavedCode(code);
      setComparisonCode(code);
      setPendingExternalSnapshot(null);
      setStatusMessage(`Saved ${saved.name || suggestedName}`);
    } catch (error) {
      setStatusMessage(`Save failed: ${error.message}`);
    }
  }, [code, currentFileName, currentFilePath, forgeAPI]);

  useEffect(() => {
    if (!autoRun) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!code.trim()) return;
      runCode();
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [autoRun, code, runCode]);

  useEffect(() => () => clearBuildTimeout(), [clearBuildTimeout]);

  useEffect(() => {
    if (releaseScreenshotStartedRef.current) return;
    releaseScreenshotStartedRef.current = true;

    let cancelled = false;

    async function runReleaseScreenshotFlow() {
      const launchContext = await forgeAPI.getLaunchContext?.();
      const screenshotConfig = launchContext?.releaseScreenshot;
      if (!screenshotConfig?.enabled) return;

      try {
        if (!screenshotConfig.scadPath) {
          throw new Error('FORGE3D_RELEASE_SCREENSHOT_SCAD is required.');
        }

        const snapshot = await forgeAPI.readFileSnapshot(screenshotConfig.scadPath);
        if (!snapshot?.exists || snapshot.error) {
          throw new Error(snapshot?.error || `Unable to read ${screenshotConfig.scadPath}`);
        }

        const fileName = snapshot.name || DEFAULT_FILE_NAME;
        setAutoRun(false);
        setMode('design');
        setSidebarTab('workspace');
        setActiveTab('console');
        resetAssemblyState();
        queueAutoFitView();
        replaceCodeWithoutHistory(snapshot.content);
        setSavedCode(snapshot.content);
        setComparisonCode(snapshot.content);
        setCurrentFileName(fileName);
        setCurrentFilePath(snapshot.filePath);
        setStatusMessage(`Preparing release screenshot for ${fileName}`);

        await new Promise((resolve) => window.setTimeout(resolve, 250));
        const ok = await runCode({
          profileId: 'final',
          codeOverride: snapshot.content,
          sourceName: fileName,
          sourcePath: snapshot.filePath,
        });
        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
        await new Promise((resolve) => window.setTimeout(resolve, 500));

        if (!cancelled) {
          await forgeAPI.notifyReleaseScreenshotReady?.({ ok });
        }
      } catch (err) {
        if (!cancelled) {
          await forgeAPI.notifyReleaseScreenshotReady?.({ ok: false, error: err.message });
        }
      }
    }

    runReleaseScreenshotFlow();

    return () => {
      cancelled = true;
    };
  }, [forgeAPI, queueAutoFitView, replaceCodeWithoutHistory, resetAssemblyState, runCode]);

  useEffect(() => {
    if (!building) {
      setBuildElapsedMs(0);
      return;
    }

    setBuildElapsedMs(Math.max(0, Math.round(performance.now() - buildStartRef.current)));
    const intervalId = window.setInterval(() => {
      setBuildElapsedMs(Math.max(0, Math.round(performance.now() - buildStartRef.current)));
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [building]);

  useEffect(() => forgeAPI.onOpenScadProgress((payload) => {
    if (!payload || payload.requestId !== renderRequestIdRef.current) return;

    if (Number.isFinite(payload.elapsedMs)) {
      setBuildElapsedMs(payload.elapsedMs);
    }

    if (payload.phase === 'started') {
      const introLogs = [
        `OpenSCAD started for ${currentFileName || DEFAULT_FILE_NAME} (${currentBuildProfileRef.current.label})`,
        payload.launchMode ? `OpenSCAD launch mode: ${payload.launchMode}` : null,
        payload.launchWarning ? `OpenSCAD launch warning: ${payload.launchWarning}` : null,
        payload.command ? `OpenSCAD command: ${payload.command}` : null,
        payload.defineOverrides?.length ? `Render overrides: ${payload.defineOverrides.join(', ')}` : null,
        payload.inputPath ? `Debug source: ${payload.inputPath}` : null,
        payload.cwd ? `Working directory: ${payload.cwd}` : null,
      ].filter(Boolean);
      setBuildStatusDetail('Launching OpenSCAD...');
      replaceRenderLogs(introLogs);
      return;
    }

    if (payload.phase === 'stdout' || payload.phase === 'stderr') {
      const prefix = payload.phase === 'stderr' ? 'stderr' : 'stdout';
      const text = String(payload.text || '').trim();
      if (!text) return;
      setBuildStatusDetail(`OpenSCAD running... ${formatBuildElapsed(payload.elapsedMs || 0)}`);
      replaceRenderLogs([...renderLogBufferRef.current, `${prefix}:\n${text}`]);
      return;
    }

    if (payload.phase === 'finished') {
      setBuildStatusDetail(`OpenSCAD finished in ${formatBuildElapsed(payload.elapsedMs || 0)}`);
      return;
    }

    if (payload.phase === 'timed_out') {
      setBuildStatusDetail(`OpenSCAD timed out after ${formatBuildElapsed(payload.elapsedMs || 0)}`);
      return;
    }

    if (payload.phase === 'cancelled') {
      setBuildStatusDetail(`OpenSCAD cancelled after ${formatBuildElapsed(payload.elapsedMs || 0)}`);
      return;
    }

    if (payload.phase === 'exited') {
      setBuildStatusDetail(`OpenSCAD exited after ${formatBuildElapsed(payload.elapsedMs || 0)}`);
    }
  }), [currentFileName, forgeAPI, replaceRenderLogs]);

  useEffect(() => {
    if (!stlGeometry || !shouldAutoFitViewRef.current) return;
    shouldAutoFitViewRef.current = false;
    setFitViewSignal((value) => value + 1);
  }, [stlGeometry]);

  // ─── Persist workspace ────────────────────────────────────────────────
  useEffect(() => {
    saveWorkspace({
      code,
      lastSavedCode: savedCode,
      comparisonCode,
      viewSettings,
      autoRun,
      activeActivity: sidebarTab,
      workbenchTab: activeTab,
      currentFileName,
      currentFilePath,
      theme,
      startState,
      terminalPreferences: {
        preferredShellId,
      },
      terminalManagerState,
      renderProfile,
      panelLayout: {
        sidebarOpen,
        sidebarWidth,
        editorWidth,
        bottomPanelHeight,
      },
    });
  }, [activeTab, autoRun, bottomPanelHeight, code, comparisonCode, currentFileName, currentFilePath, editorWidth, preferredShellId, renderProfile, savedCode, sidebarOpen, sidebarTab, sidebarWidth, startState, terminalManagerState, theme, viewSettings]);

  // ─── Load recent files & workspace on mount ──────────────────────────
  useEffect(() => {
    forgeAPI.getRecentFiles().then(setRecentFiles).catch(() => {});
    forgeAPI.getWorkspaceFolder().then(folder => {
      if (folder) {
        setWorkspaceFolder(folder);
        forgeAPI.listWorkspaceFiles().then(setWorkspaceFiles).catch(() => {});
      }
    }).catch(() => {});

    forgeAPI.getZoomFactor?.().then((value) => {
      if (Number.isFinite(value)) setZoomFactor(value);
    }).catch(() => {});

    const removeZoomListener = forgeAPI.onZoomChanged?.((value) => {
      if (Number.isFinite(value)) setZoomFactor(value);
    });

    forgeAPI.listTerminalShells?.().then((payload) => {
      const shells = payload?.shells || [];
      setAvailableShells(shells);
      if (!preferredShellId && payload?.defaultShellId) {
        setPreferredShellId(payload.defaultShellId);
      }
    }).catch(() => {});

    forgeAPI.getTerminalState?.().then((state) => {
      if (state) setTerminalState(state);
    }).catch(() => {});

    const removeTerminalListener = forgeAPI.onTerminalState?.((state) => {
      if (state) setTerminalState(state);
    });

    return () => {
      removeZoomListener?.();
      removeTerminalListener?.();
    };
  }, [forgeAPI, preferredShellId]);

  useEffect(() => {
    if (!currentFilePath) {
      Promise.resolve(forgeAPI.unwatchFile?.()).catch(() => {});
      return undefined;
    }

    Promise.resolve(forgeAPI.watchFile?.(currentFilePath)).catch(() => {});
    loadFileSnapshot(currentFilePath, { quiet: true, reason: 'restore' }).catch(() => {});

    return () => {
      Promise.resolve(forgeAPI.unwatchFile?.()).catch(() => {});
    };
  }, [currentFilePath, forgeAPI, loadFileSnapshot]);

  useEffect(() => {
    const removeFileChangedListener = forgeAPI.onFileChanged?.((payload) => {
      if (!payload?.filePath || payload.filePath !== currentFilePath) return;
      if (payload.exists === false) {
        setStatusMessage(`File removed on disk: ${currentFileName}`);
        return;
      }
      loadFileSnapshot(payload.filePath).catch(() => {});
    });

    return () => {
      removeFileChangedListener?.();
    };
  }, [currentFileName, currentFilePath, forgeAPI, loadFileSnapshot]);

  useEffect(() => {
    if (availableShells.length === 0) return;
    if (preferredShellId && availableShells.some((shell) => shell.id === preferredShellId)) return;
    setPreferredShellId((current) => current || availableShells[0].id);
  }, [availableShells, preferredShellId]);

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
      if (event.defaultPrevented) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mode === 'assembly') {
        if (event.key === 'Delete' && selectedAssemblyPart) {
          event.preventDefault();
          deleteAssemblyPart(selectedAssemblyPart.id);
          return;
        }
        if (mod && !event.altKey && event.key.toLowerCase() === 'd' && selectedAssemblyPart) {
          event.preventDefault();
          duplicateSelectedAssemblyPart(selectedAssemblyPart.id);
          return;
        }
        if (mod && !event.altKey && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) redoAssemblyScene(); else undoAssemblyScene();
          return;
        }
        if (mod && !event.altKey && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          redoAssemblyScene();
          return;
        }
      } else {
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
        if (mod && !event.altKey && event.key.toLowerCase() === 'h') {
          event.preventDefault();
          editorRef.current?.openReplace?.();
          return;
        }
        if (mod && !event.altKey && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          redoCode();
          return;
        }
      }
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
  }, [deleteAssemblyPart, duplicateSelectedAssemblyPart, mode, openFile, openFilePath, redoAssemblyScene, redoCode, resetWorkspace, runCode, saveFile, selectedAssemblyPart, undoAssemblyScene, undoCode]);

  useEffect(() => {
    if (!hasComparisonDiff && showDiffEditor) {
      setShowDiffEditor(false);
    }
  }, [hasComparisonDiff, showDiffEditor]);

  // ─── Panel resize mouse handlers ──────────────────────────────────────
  useEffect(() => {
    const getContentWidth = () => contentRef.current?.clientWidth || window.innerWidth;
    const getAppHeight = () => appRef.current?.clientHeight || window.innerHeight;

    const onMouseMove = (e) => {
      if (!resizingRef.current) return;

      const contentWidth = getContentWidth();
      const appHeight = getAppHeight();
      const sidebarFootprint = ACTIVITY_RAIL_WIDTH + (sidebarOpen ? dragStartRef.current.sidebarWidth + 6 : 0);

      if (resizingRef.current === 'bottom') {
        const delta = dragStartRef.current.y - e.clientY;
        const maxBottomHeight = Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.min(520, appHeight - 220));
        const nextHeight = clampBottomPanelHeight(dragStartRef.current.bottomPanelHeight + delta, maxBottomHeight);
        if (nextHeight === COLLAPSED_BOTTOM_PANEL_HEIGHT && dragStartRef.current.bottomPanelHeight > COLLAPSED_BOTTOM_PANEL_HEIGHT) {
          lastExpandedBottomHeightRef.current = dragStartRef.current.bottomPanelHeight;
        }
        setBottomPanelHeight(nextHeight);
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
          Math.min(MAX_SIDEBAR_WIDTH, contentWidth - ACTIVITY_RAIL_WIDTH - 6 - 6 - MIN_EDITOR_WIDTH - MIN_VIEWPORT_WIDTH),
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
  }, [ACTIVITY_RAIL_WIDTH, MAX_SIDEBAR_WIDTH, MIN_BOTTOM_PANEL_HEIGHT, MIN_EDITOR_WIDTH, MIN_SIDEBAR_WIDTH, MIN_VIEWPORT_WIDTH, sidebarOpen]);

  useEffect(() => {
    const clampLayout = () => {
      const contentWidth = contentRef.current?.clientWidth || window.innerWidth;
      const appHeight = appRef.current?.clientHeight || window.innerHeight;
      const openSidebarFootprint = ACTIVITY_RAIL_WIDTH + (sidebarOpen ? sidebarWidth + 6 : 0);
      const maxEditorWidth = Math.max(
        MIN_EDITOR_WIDTH,
        contentWidth - openSidebarFootprint - 6 - MIN_VIEWPORT_WIDTH,
      );
      const maxSidebarWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, contentWidth - ACTIVITY_RAIL_WIDTH - 6 - 6 - MIN_EDITOR_WIDTH - MIN_VIEWPORT_WIDTH),
      );
      const maxBottomHeight = Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.min(520, appHeight - 220));

      setEditorWidth((current) => Math.max(MIN_EDITOR_WIDTH, Math.min(maxEditorWidth, current)));
      setSidebarWidth((current) => Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxSidebarWidth, current)));
      setBottomPanelHeight((current) => clampBottomPanelHeight(current, maxBottomHeight));
    };

    clampLayout();
    window.addEventListener('resize', clampLayout);
    return () => window.removeEventListener('resize', clampLayout);
  }, [ACTIVITY_RAIL_WIDTH, MAX_SIDEBAR_WIDTH, MIN_BOTTOM_PANEL_HEIGHT, MIN_EDITOR_WIDTH, MIN_SIDEBAR_WIDTH, MIN_VIEWPORT_WIDTH, sidebarOpen, sidebarWidth]);

  // ─── Three.js scene ───────────────────────────────────────────────────
  const scene = useThreeRenderer({
    canvasRef,
    mode,
    viewSettings,
    resetViewSignal,
    fitViewSignal,
    theme,
    stlGeometry,
    assemblyScene,
    selectedPartId: assemblyScene.selectedPartId,
    measurement: assemblyMeasurement,
    onAssemblyMeasurementPick: handleAssemblyMeasurementPick,
    onSelectAssemblyPart: selectAssemblyPart,
    onUpdateAssemblyPartTransform: updateAssemblyPartTransform,
  });

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
      setActiveReference(null);
      setSavedCode(content);
      setComparisonCode(content);
      setPendingExternalSnapshot(null);
      setCurrentFileName(file.name);
      setCurrentFilePath(file.path || null);
      resetAssemblyState();
      setStatusMessage(`Opened: ${file.name}`);
    };
    reader.readAsText(file);
  }, [queueAutoFitView, replaceCodeWithoutHistory, resetAssemblyState]);

  const handleExportSTL = useCallback(async () => {
    if (!scene) return;
    const baseName = mode === 'assembly'
      ? (assemblyScenePath?.split(/[\\/]/).pop()?.replace(/\.forge3dscene\.json$/i, '') || currentFileName.replace(/\.scad$/i, '') || 'assembly')
      : currentFileName.replace(/\.scad$/i, '');
    try {
      const content = exportSceneToSTL(scene);
      const saved = await forgeAPI.saveStlFile({ content, suggestedName: `${baseName}.stl` });
      if (!saved) return;
      setStatusMessage(mode === 'assembly'
        ? `Exported combined assembly STL as ${saved.name || `${baseName}.stl`}`
        : `Exported ${saved.name || `${baseName}.stl`}`);
    } catch (error) {
      setStatusMessage(`STL export failed: ${error.message}`);
    }
  }, [assemblyScenePath, currentFileName, forgeAPI, mode, scene]);

  const toggleBottomPanel = () => {
    if (bottomPanelCollapsed) {
      expandBottomPanel();
    } else {
      lastExpandedBottomHeightRef.current = bottomPanelHeight;
      setBottomPanelHeight(COLLAPSED_BOTTOM_PANEL_HEIGHT);
    }
  };

  const handleBottomTabChange = (nextTab) => {
    if (nextTab === activeTab) toggleBottomPanel();
    else {
      setActiveTab(nextTab);
      if (bottomPanelCollapsed) expandBottomPanel();
    }
  };

  const jumpToLine = useCallback((lineNum) => {
    editorRef.current?.jumpToLine(lineNum);
  }, []);

  const handleSidebarTabChange = useCallback((nextTab) => {
    if (sidebarTab === nextTab) {
      setSidebarOpen((open) => !open);
    } else {
      setSidebarTab(nextTab);
      setSidebarOpen(true);
    }

    if (nextTab === 'workspace' && workspaceFolder) {
      forgeAPI.listWorkspaceFiles().then(setWorkspaceFiles).catch(() => {});
    }
    if (nextTab === 'terminal') {
      setActiveTab('terminal');
      expandBottomPanel();
      if (terminalState?.status === 'running') {
        focusTerminal();
      }
    }
  }, [expandBottomPanel, focusTerminal, forgeAPI, sidebarTab, terminalState?.status, workspaceFolder]);

  const handleChooseWorkspaceFolder = useCallback(async () => {
    const folder = await forgeAPI.setWorkspaceFolder();
    if (!folder) return;
    setWorkspaceFolder(folder);
    const files = await forgeAPI.listWorkspaceFiles();
    setWorkspaceFiles(files || []);
  }, [forgeAPI]);

  const enterAssemblyMode = useCallback(async () => {
    if (assemblyScene.parts.length > 0) {
      setMode('assembly');
      setSidebarTab('assembly');
      setSidebarOpen(true);
      setStatusMessage('Assembly Mode ready');
      return;
    }

    if (!hasCurrentRenderableGeometry) {
      setStatusMessage('Build the current design before entering Assembly Mode');
      return;
    }

    if (!hasCurrentFinalRender) {
      if (renderProfile !== 'final') {
        setRenderProfile('final');
      }
      setStatusMessage('Assembly Mode requires a Final render. Running Final render now...');
      const success = await runCode({ profileId: 'final' });
      if (!success) {
        setStatusMessage('Assembly Mode requires a successful Final render before continuing');
        return;
      }
    }

    const part = addCurrentRenderToAssembly({ centerOnAdd: true, switchMode: true });
    if (part) {
      setSidebarTab('assembly');
      setSidebarOpen(true);
      setStatusMessage(`Entered Assembly Mode with ${part.name}`);
    }
  }, [addCurrentRenderToAssembly, assemblyScene.parts.length, hasCurrentFinalRender, hasCurrentRenderableGeometry, renderProfile, runCode]);

  const returnToDesignMode = useCallback(() => {
    setMode('design');
    setSidebarTab((current) => (current === 'assembly' ? 'workspace' : current));
    setStatusMessage('Returned to Design Mode');
  }, []);

  const ensureTerminalSession = useCallback(async (options = {}) => {
    const payload = await forgeAPI.spawnTerminal({
      cwd: options.cwd || projectWorkingDirectory,
      shellId: preferredShellId || undefined,
    });

    if (!payload) return null;

    if (payload.state) {
      setTerminalState(payload.state);
    }

    if (payload.error) {
      setStatusMessage(`Terminal: ${payload.error}`);
      return payload;
    }

    if (!payload.reused) {
      setTerminalResetToken((value) => value + 1);
      setStatusMessage(`Terminal ready: ${payload.state?.shellLabel || 'shell'}`);
    }

    return payload;
  }, [forgeAPI, preferredShellId, projectWorkingDirectory]);

  const restartTerminalSession = useCallback(async (cwdOverride = null) => {
    const payload = await forgeAPI.restartTerminal({
      cwd: cwdOverride || projectWorkingDirectory,
      shellId: preferredShellId || undefined,
    });

    if (!payload) return null;

    if (payload.state) {
      setTerminalState(payload.state);
    }

    if (payload.error) {
      setStatusMessage(`Terminal restart failed: ${payload.error}`);
      return payload;
    }

    setTerminalResetToken((value) => value + 1);
    setStatusMessage(`Terminal restarted: ${payload.state?.shellLabel || 'shell'}`);
    return payload;
  }, [forgeAPI, preferredShellId, projectWorkingDirectory]);

  const handleKillTerminal = useCallback(async () => {
    const state = await forgeAPI.killTerminal();
    if (state) setTerminalState(state);
    setStatusMessage('Terminal stopped');
  }, [forgeAPI]);

  const handleOpenTerminalTool = useCallback(async () => {
    setSidebarTab('terminal');
    setSidebarOpen(true);
    setActiveTab('terminal');
    expandBottomPanel();
    const payload = await ensureTerminalSession();
    if (payload?.state?.status === 'running') {
      focusTerminal();
    }
  }, [ensureTerminalSession, expandBottomPanel, focusTerminal]);

  const handlePreferredShellChange = useCallback((nextShellId) => {
    setPreferredShellId(nextShellId || null);
    setStatusMessage(nextShellId ? 'Terminal shell preference saved for the next restart' : 'Terminal shell preference cleared');
  }, []);

  const handleInsertStartItem = useCallback((item, explicitMode) => {
    if (!item) return;

    if (item.primaryAction === 'openExternal' && item.externalUrl) {
      Promise.resolve(forgeAPI.openExternalUrl?.(item.externalUrl)).catch(() => {});
      setStatusMessage(`Opened ${item.name}`);
      return;
    }

    if (!item.code) return;

    if (item.primaryAction === 'openExample' || explicitMode === 'replace') {
      const nextCode = `${item.code.trimEnd()}\n`;
      queueAutoFitView();
      replaceCodeWithoutHistory(nextCode);
      setSavedCode(nextCode);
      setComparisonCode(nextCode);
      setPendingExternalSnapshot(null);
      setCurrentFileName(`${item.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'example'}.scad`);
      setCurrentFilePath(null);
      setActiveReference(null);
      resetAssemblyState();
      setStatusMessage(`Opened ${item.name}`);
      return;
    }

    if (item.primaryAction === 'insert') {
      const inserted = editorRef.current?.insertText?.(item.code, { selectInserted: true });
      if (inserted) {
        setStatusMessage(`Inserted ${item.name}`);
        return;
      }

      applyCodeChange(`${code.replace(/\s+$/, '')}\n\n${item.code.trim()}\n`);
      setStatusMessage(`Added ${item.name}`);
      return;
    }

    const mode = explicitMode || 'append';
    const insertion = prepareTemplateInsertion({ name: item.name, code: item.code }, code, mode);
    if (!insertion) return;

    if (insertion.insertText) {
      const inserted = editorRef.current?.insertText?.(insertion.insertText, { selectInserted: true });
      if (inserted) {
        setStatusMessage(buildMergedInsertionStatus(item.name, mode, insertion.stats));
        return;
      }

      if (insertion.fallbackNextCode) {
        applyCodeChange(insertion.fallbackNextCode);
        setStatusMessage(buildMergedInsertionStatus(item.name, mode, insertion.stats));
      }
      return;
    }

    if (insertion.nextCode) {
      applyCodeChange(insertion.nextCode);
      setStatusMessage(buildMergedInsertionStatus(item.name, mode, insertion.stats));
    }
  }, [applyCodeChange, code, forgeAPI, queueAutoFitView, replaceCodeWithoutHistory, resetAssemblyState]);

  const handleBuildCurrentDesign = useCallback(() => {
    setStatusMessage('Rendering the latest design from Assembly...');
    runCode();
  }, [runCode]);

  const handleParamChange = useCallback((param, value) => {
    const nextCode = applyParamChange(code, param, value);
    applyCodeChange(nextCode);
    if (mode === 'assembly' && !autoRun) {
      setStatusMessage(`Updated ${param.label || param.name}. Render the latest design to refresh current render parts.`);
    }
  }, [applyCodeChange, autoRun, code, mode]);

  const handleResetParam = useCallback((param) => {
    const originalParams = parseParams(savedCode);
    const original = originalParams.find((candidate) => candidate.id === param.id)
      || originalParams.find((candidate) => candidate.name === param.name && candidate.section === param.section);
    const resetValue = original?.value ?? param.defaultValue;
    if (resetValue === undefined) return;
    const nextCode = applyParamChange(code, param, resetValue);
    applyCodeChange(nextCode);
    if (mode === 'assembly' && !autoRun) {
      setStatusMessage(`Reset ${param.label || param.name}. Render the latest design to refresh current render parts.`);
    }
  }, [applyCodeChange, autoRun, code, mode, savedCode]);

  const handleJumpToParam = useCallback((param) => {
    const targetLine = param?.assignmentLine || param?.line;
    if (!targetLine) return;
    editorRef.current?.jumpToLine(targetLine);
    setStatusMessage(`Jumped to ${param.name}`);
  }, []);

  const handleClearRecentFiles = useCallback(() => {
    forgeAPI.clearRecentFiles().then(() => setRecentFiles([]));
  }, [forgeAPI]);

  const handleCaptureRender = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatusMessage('Render capture is not ready yet');
      return;
    }

    try {
      const saved = await forgeAPI.saveViewportCapture({
        dataUrl: canvas.toDataURL('image/png'),
        preferredDir: projectWorkingDirectory,
      });

      if (!saved) return;
      if (saved.error) {
        setStatusMessage(`Capture failed: ${saved.error}`);
        return;
      }

      setStatusMessage(`Render captured: ${saved.name}`);
    } catch (error) {
      setStatusMessage(`Capture failed: ${error.message}`);
    }
  }, [forgeAPI, projectWorkingDirectory]);

  const handleInsertDocExample = useCallback((example) => {
    if (!example) return;
    const inserted = editorRef.current?.insertText?.(example, { selectInserted: true });
    if (!inserted) {
      applyCodeChange((current) => `${current.replace(/\s+$/, '')}\n\n${example.trim()}\n`);
    }
    setStatusMessage('Inserted OpenSCAD docs example');
  }, [applyCodeChange]);

  const handleOpenExternalDoc = useCallback((url) => {
    if (!url) return;
    Promise.resolve(forgeAPI.openExternalUrl?.(url)).catch(() => {});
  }, [forgeAPI]);

  const handleReloadFromDiskConflict = useCallback(() => {
    if (!pendingExternalSnapshot?.content) return;
    const localCode = code;
    queueAutoFitView();
    replaceCodeWithoutHistory(pendingExternalSnapshot.content);
    setSavedCode(pendingExternalSnapshot.content);
    setComparisonCode(localCode);
    setCurrentFileName(pendingExternalSnapshot.name || currentFileName);
    setCurrentFilePath(pendingExternalSnapshot.filePath || currentFilePath);
    setPendingExternalSnapshot(null);
    setShowDiffEditor(true);
    setStatusMessage(`Reloaded ${pendingExternalSnapshot.name || currentFileName} from disk`);
  }, [code, currentFileName, currentFilePath, pendingExternalSnapshot, queueAutoFitView, replaceCodeWithoutHistory]);

  const handleKeepLocalChanges = useCallback(() => {
    if (!pendingExternalSnapshot) return;
    setComparisonCode(pendingExternalSnapshot.content);
    setPendingExternalSnapshot(null);
    setShowDiffEditor(true);
    setStatusMessage('Keeping local edits for now');
  }, [pendingExternalSnapshot]);

  const askAI = useCallback(() => {
    const errorText = allErrors.map((entry) => `- ${formatDiagnosticForPrompt(entry).replace(/\n/g, '\n  ')}`).join('\n');
    const warnText = allWarnings.map((entry) => `- ${formatDiagnosticForPrompt(entry).replace(/\n/g, '\n  ')}`).join('\n');
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
        assemblyActionLabel={!hasCurrentRenderableGeometry
          ? 'Assembly Mode'
          : hasCurrentFinalRender || mode === 'assembly'
            ? 'Assembly Mode'
            : 'Final Render for Assembly'}
        building={building}
        canEnterAssembly={canEnterAssembly}
        canRedo={canRedo}
        canUndo={canUndo}
        colors={colors}
        mode={mode}
        onAutoRunChange={setAutoRun}
        onCancelBuild={cancelBuild}
        onEnterAssemblyMode={enterAssemblyMode}
        onExportStl={handleExportSTL}
        onNewFile={resetWorkspace}
        onOpenFile={openFile}
        onRedo={mode === 'assembly' ? redoAssemblyScene : redoCode}
        onRenderProfileChange={setRenderProfile}
        onResetView={() => setResetViewSignal(v => v + 1)}
        onReturnToDesignMode={returnToDesignMode}
        onRunCode={runCode}
        onSaveFile={saveFile}
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onUndo={mode === 'assembly' ? undoAssemblyScene : undoCode}
        renderProfile={renderProfile}
        theme={theme}
      />

      {/* ── Body ── */}
      <div ref={contentRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: ACTIVITY_RAIL_WIDTH, minWidth: ACTIVITY_RAIL_WIDTH, background: colors.bgDark, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 8px', gap: '8px', flexShrink: 0 }}>
          {(mode === 'assembly'
            ? [{ id: 'assembly', label: 'Assembly', icon: Icons.Cube }]
            : [
                { id: 'start', label: 'Start', icon: Icons.Spark },
                { id: 'workspace', label: 'Workspace', icon: Icons.Folder },
                { id: 'params', label: 'Params', icon: Icons.Sliders },
                { id: 'terminal', label: 'Terminal', icon: Icons.Terminal },
              ]).map(({ id, icon: Icon, label }) => {
            const active = sidebarTab === id && sidebarOpen;
            return (
              <button
                key={id}
                onClick={() => handleSidebarTabChange(id)}
                title={label}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: `1px solid ${active ? colors.accent : 'transparent'}`,
                  background: active ? `${colors.accent}22` : 'transparent',
                  color: active ? colors.accent : colors.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {active && <span style={{ position: 'absolute', left: '-11px', top: '8px', bottom: '8px', width: '3px', borderRadius: '999px', background: colors.accent }} />}
                <Icon />
              </button>
            );
          })}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setSidebarOpen((open) => !open)}
            title={sidebarOpen ? 'Collapse sidebar panel' : 'Expand sidebar panel'}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              background: colors.bgDarker,
              color: colors.textMuted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ display: 'inline-flex', transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
              <Icons.ChevRight />
            </span>
          </button>
        </div>

        {sidebarOpen && (
          <div style={{ width: sidebarWidth, minWidth: MIN_SIDEBAR_WIDTH, background: colors.bgDark, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ borderBottom: `1px solid ${colors.border}`, padding: '10px 12px 8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.textMuted }}>
                {mode === 'assembly'
                  ? 'Assembly'
                  : sidebarTab === 'start'
                    ? 'Start'
                    : sidebarTab === 'workspace'
                      ? 'Workspace'
                      : sidebarTab === 'terminal'
                        ? 'Terminal'
                        : 'Params'}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
              {mode === 'assembly' ? (
                <AssemblySidebar
                  canAddCurrentRender={Boolean(stlGeometry)}
                  colors={colors}
                  onAddCurrentRender={() => addCurrentRenderToAssembly({ switchMode: true })}
                  onDeletePart={deleteAssemblyPart}
                  onDuplicatePart={duplicateSelectedAssemblyPart}
                  onImportScad={() => handleImportAssemblyPart('scad')}
                  onImportStl={() => handleImportAssemblyPart('stl')}
                  onOpenScene={handleOpenAssemblyScene}
                  onSaveScene={handleSaveAssemblyScene}
                  onSelectPart={selectAssemblyPart}
                  onToggleLock={toggleAssemblyPartLock}
                  onToggleVisibility={toggleAssemblyPartVisibility}
                  parts={assemblyScene.parts}
                  selectedPartId={assemblyScene.selectedPartId}
                />
              ) : sidebarTab === 'start' && (
                <StartSidebar
                  colors={colors}
                  onInsertItem={handleInsertStartItem}
                  onOpenExternal={handleOpenExternalDoc}
                  onStateChange={updateStartState}
                  startState={startState}
                />
              )}
              {mode !== 'assembly' && sidebarTab === 'workspace' && (
                <WorkspaceSidebar
                  colors={colors}
                  currentFileName={currentFileName}
                  currentFilePath={currentFilePath}
                  onChooseWorkspaceFolder={handleChooseWorkspaceFolder}
                  onClearRecentFiles={handleClearRecentFiles}
                  onNewFile={resetWorkspace}
                  onOpenFile={openFile}
                  onOpenRecentFile={openFilePath}
                  onOpenWorkspaceFile={openFilePath}
                  recentFiles={recentFiles}
                  workspaceFiles={workspaceFiles}
                  workspaceFolder={workspaceFolder}
                />
              )}
              {mode !== 'assembly' && sidebarTab === 'terminal' && (
                <TerminalSidebar
                  availableShells={availableShells}
                  colors={colors}
                  onKill={handleKillTerminal}
                  onOpen={handleOpenTerminalTool}
                  onPreferredShellChange={handlePreferredShellChange}
                  onRestart={() => restartTerminalSession()}
                  onRestartInProject={() => restartTerminalSession(projectWorkingDirectory)}
                  preferredShellId={preferredShellId}
                  sessionState={terminalState}
                  suggestedProjectPath={projectWorkingDirectory}
                />
              )}
              {mode !== 'assembly' && sidebarTab === 'params' && (
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

        {/* Editor panel */}
        <div style={{ width: editorWidth, minWidth: MIN_EDITOR_WIDTH, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative' }}>
          <div style={{ height: '32px', minHeight: '32px', background: colors.bgDarker, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
            {mode === 'assembly' ? (
              <>
                <span style={{ display: 'inline-flex', flexShrink: 0 }}><Icons.Cube /></span>
                <span style={{ fontSize: '12px', color: colors.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>Inspector</span>
              </>
            ) : (
              <>
                <Icons.File /><span title={currentFileName} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: colors.textMuted, fontWeight: 700 }}>{currentFileName}{isDirty ? ' *' : ''}</span>
                <button
                  onClick={() => setShowDiffEditor((value) => !value)}
                  disabled={!hasComparisonDiff}
                  title={hasComparisonDiff ? 'Compare current code with the current comparison base' : 'Diff becomes available once the file changes locally or on disk'}
                  style={{
                    background: showDiffEditor ? `${colors.accent}22` : 'transparent',
                    border: `1px solid ${showDiffEditor ? colors.accent : colors.border}`,
                    borderRadius: '999px',
                    color: !hasComparisonDiff ? colors.textFaint : showDiffEditor ? colors.accent : colors.textMuted,
                    cursor: !hasComparisonDiff ? 'not-allowed' : 'pointer',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >Diff</button>
              </>
            )}
          </div>
          <div style={{ flex: 1, background: colors.bgDarker, overflow: 'hidden', position: 'relative' }}>
            {mode !== 'assembly' && pendingExternalSnapshot && (
              <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 15, background: `${colors.warn}18`, border: `1px solid ${colors.warn}55`, borderRadius: '12px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ color: colors.textSoft, fontSize: '12px', fontWeight: 700 }}>
                  Disk changed: {pendingExternalSnapshot.name || currentFileName}
                </div>
                <div style={{ color: colors.textMuted, fontSize: '11px', flex: 1, minWidth: '180px' }}>
                  The saved file changed outside Forge3D while you also have unsaved local edits.
                </div>
                <button onClick={() => setShowDiffEditor(true)} style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '9px', color: colors.textSoft, cursor: 'pointer', padding: '7px 10px', fontSize: '11px', fontWeight: 700 }}>
                  Open Diff
                </button>
                <button onClick={handleKeepLocalChanges} style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '9px', color: colors.textSoft, cursor: 'pointer', padding: '7px 10px', fontSize: '11px', fontWeight: 700 }}>
                  Keep Local
                </button>
                <button onClick={handleReloadFromDiskConflict} style={{ background: `${colors.warn}22`, border: `1px solid ${colors.warn}`, borderRadius: '9px', color: colors.warn, cursor: 'pointer', padding: '7px 10px', fontSize: '11px', fontWeight: 700 }}>
                  Reload From Disk
                </button>
              </div>
            )}
            {mode === 'assembly' ? (
              <AssemblyInspector
                booleanBusy={booleanBusy}
                booleanBusyLabel={assemblyBooleanState.operation ? `${assemblyBooleanState.operation}...` : 'Working...'}
                booleanOperandId={booleanOperandId}
                booleanOperandOptions={booleanOperandOptions}
                building={building}
                canRefreshCurrentRender={canRefreshCurrentRender}
                colors={colors}
                measurement={assemblyMeasurement}
                metrics={selectedAssemblyMetrics}
                onBooleanOperandChange={setBooleanOperandId}
                onBooleanRun={handleRunBooleanOperation}
                onBuildCurrentDesign={handleBuildCurrentDesign}
                onCenterSelected={centerSelectedAssemblyPart}
                onClearMeasurementHistory={handleClearMeasurementHistory}
                onDropToFloor={dropSelectedAssemblyPartToFloor}
                onMeasurementPrimaryAction={handleMeasurementPrimaryAction}
                onParamChange={handleParamChange}
                onPositionChange={handleAssemblyPositionInput}
                onRefreshCurrentRender={refreshSelectedCurrentRenderPart}
                onResetParam={handleResetParam}
                onRotationChange={handleAssemblyRotationInput}
                onToggleSnap={(enabled) => updateAssemblyScene((current) => ({ ...current, snap: { ...current.snap, enabled } }), { recordHistory: false })}
                parsedParams={parsedParams}
                part={selectedAssemblyPart}
                snap={assemblyScene.snap}
              />
            ) : (
              <CodeEditor
                ref={editorRef}
                code={code}
                comparisonCode={comparisonCode}
                diagnostics={lspDiagnostics.markers}
                onBuild={runCode}
                onChange={applyCodeChange}
                onOpenReference={setActiveReference}
                onRedo={redoCode}
                onUndo={undoCode}
                showDiff={showDiffEditor && hasComparisonDiff}
                theme={theme}
              />
            )}
            {mode !== 'assembly' && activeReference && (
              <DocsDrawer
                colors={colors}
                onClose={() => setActiveReference(null)}
                onInsertExample={handleInsertDocExample}
                onJumpToLine={jumpToLine}
                onOpenExternal={handleOpenExternalDoc}
                reference={activeReference}
              />
            )}
          </div>

          {/* Bottom panel drag handle */}
          <div
            onMouseDown={(e) => startResize('bottom', e)}
            onDoubleClick={toggleBottomPanel}
            title="Resize bottom panel"
            style={{ height: '8px', cursor: 'row-resize', background: 'transparent', borderTop: `1px solid ${colors.border}`, flexShrink: 0, transition: 'background 0.15s', position: 'relative' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${colors.accent}33`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ position: 'absolute', left: '50%', top: '1px', width: '56px', height: '4px', transform: 'translateX(-50%)', borderRadius: '999px', background: `${colors.borderHover}88` }} />
          </div>
          <div style={{ height: bottomPanelHeight, minHeight: MIN_BOTTOM_PANEL_HEIGHT, flexShrink: 0, overflow: 'hidden' }}>
            <BottomPane
              activeTab={activeTab}
              allErrors={allErrors}
              allWarnings={allWarnings}
              askAI={askAI}
              collapsed={bottomPanelCollapsed}
              colors={colors}
              jumpToLine={jumpToLine}
              onActiveTabChange={handleBottomTabChange}
              onEnsureTerminalSession={ensureTerminalSession}
              onFocusTerminal={focusTerminal}
              result={result}
              statusMessage={statusMessage}
              terminalFocusToken={terminalFocusToken}
              terminalResetToken={terminalResetToken}
              terminalState={terminalState}
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
          buildElapsedMs={buildElapsedMs}
          buildStatusText={buildStatusDetail}
          building={building}
          canvasRef={canvasRef}
          colors={colors}
          minViewportWidth={MIN_VIEWPORT_WIDTH}
          mode={mode}
          onCaptureRender={handleCaptureRender}
          setViewSettings={setViewSettings}
          viewSettings={viewSettings}
        />
      </div>

      {/* ── Status bar ── */}
      <StatusBar
        allErrors={allErrors}
        buildElapsedMs={buildElapsedMs}
        buildStatusText={buildStatusDetail}
        building={building}
        code={code}
        colors={colors}
        currentFileName={currentFileName}
        currentFilePath={currentFilePath}
        isDirty={isDirty}
        mode={mode}
        theme={theme}
        zoomFactor={zoomFactor}
      />
    </div>
  );
}
