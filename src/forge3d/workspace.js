// Workspace helpers for the Electron renderer.
// File open/save lives in the preload bridge via forgeAPI IPC.

import { EXAMPLES } from './examples.js';

export const STORAGE_KEY = 'forge3d.workspace.v1';
export const DEFAULT_FILE_NAME = 'main.scad';

const DEFAULT_PANEL_LAYOUT = {
  sidebarOpen: true,
  sidebarWidth: 240,
  editorWidth: 480,
  bottomPanelHeight: 180,
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readAssignment(code, name) {
  const match = code.match(new RegExp(`(^|\\n)\\s*${escapeRegex(name)}\\s*=\\s*([^;]+);`));
  return match ? match[2].trim() : null;
}

function replaceAssignment(code, name, nextValue) {
  return code.replace(
    new RegExp(`(^|\\n)(\\s*${escapeRegex(name)}\\s*=\\s*)([^;]+)(;)`),
    `$1$2${nextValue}$4`,
  );
}

function migrateLegacyMagneticLetters(workspace) {
  const code = workspace?.code || '';
  const isLegacySample = code.includes('// Fridge magnet letter tile') && code.includes('fillet_r');
  if (!isLegacySample) return workspace;

  let nextCode = EXAMPLES["Magnetic Letters Pro"];
  const replacements = [
    ['letter', 'letter'],
    ['font_name', 'font_name'],
    ['size', 'letter_size'],
    ['thickness', 'letter_thickness'],
    ['magnet_d', 'magnet_d'],
    ['magnet_depth', 'magnet_depth'],
  ];

  for (const [legacyName, nextName] of replacements) {
    const value = readAssignment(code, legacyName);
    if (value) {
      nextCode = replaceAssignment(nextCode, nextName, value);
    }
  }

  const legacyMode = readAssignment(code, 'mode')?.replace(/^["']|["']$/g, '');
  if (legacyMode === 'manual') {
    nextCode = replaceAssignment(nextCode, 'magnet_mode', '"manual"');
    const manualPositions = readAssignment(code, 'magnet_positions');
    if (manualPositions) {
      nextCode = replaceAssignment(nextCode, 'manual_positions', manualPositions);
    }
  } else if (legacyMode === 'spiral') {
    nextCode = replaceAssignment(nextCode, 'magnet_mode', '"spine"');
  }

  return {
    ...workspace,
    code: nextCode,
    statusMessage: 'Upgraded legacy Magnetic Letters sample',
  };
}

export function getDefaultWorkspace() {
  return {
    code: EXAMPLES["Welcome"],
    viewSettings: { grid: true, axes: true, wireframe: true, dimensions: true },
    autoRun: true,
    currentFileName: DEFAULT_FILE_NAME,
    panelLayout: DEFAULT_PANEL_LAYOUT,
  };
}

export function loadWorkspace() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWorkspace();
    const parsed = migrateLegacyMagneticLetters(JSON.parse(raw));
    return {
      ...getDefaultWorkspace(),
      ...parsed,
      viewSettings: { ...getDefaultWorkspace().viewSettings, ...(parsed.viewSettings || {}) },
      panelLayout: { ...DEFAULT_PANEL_LAYOUT, ...(parsed.panelLayout || {}) },
    };
  } catch {
    return getDefaultWorkspace();
  }
}
