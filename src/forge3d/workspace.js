// Electron-only workspace helpers
// openBrowserFile and downloadTextFile removed — native dialogs used exclusively via forgeAPI IPC.

import { EXAMPLES } from './examples.js';

export const STORAGE_KEY = 'forge3d.workspace.v1';
export const DEFAULT_FILE_NAME = 'main.scad';

export function getDefaultWorkspace() {
  return {
    code: EXAMPLES["Welcome"],
    viewSettings: { grid: true, axes: true, wireframe: true },
    autoRun: true,
    currentFileName: DEFAULT_FILE_NAME,
  };
}

export function loadWorkspace() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWorkspace();
    const parsed = JSON.parse(raw);
    return { ...getDefaultWorkspace(), ...parsed, viewSettings: { ...getDefaultWorkspace().viewSettings, ...(parsed.viewSettings || {}) } };
  } catch {
    return getDefaultWorkspace();
  }
}
