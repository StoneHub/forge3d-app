const STORAGE_KEY = 'forge3d.workspace.v1';
const DEFAULT_FILE_NAME = 'main.scad';

function getDefaultWorkspace() {
  return {
    code: EXAMPLES["Welcome"],
    viewSettings: { grid: true, axes: true, wireframe: true },
    autoRun: true,
    currentFileName: DEFAULT_FILE_NAME,
  };
}

function loadWorkspace() {
  if (typeof window === 'undefined') return getDefaultWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWorkspace();
    const parsed = JSON.parse(raw);
    return { ...getDefaultWorkspace(), ...parsed, viewSettings: { ...getDefaultWorkspace().viewSettings, ...(parsed.viewSettings || {}) } };
  } catch {
    return getDefaultWorkspace();
  }
}

function downloadTextFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function openBrowserFile() {
  return await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.scad,.txt,text/plain';
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return resolve(null);
      resolve({
        name: file.name,
        content: await file.text(),
      });
    };
    input.click();
  });
}

export { STORAGE_KEY, DEFAULT_FILE_NAME, getDefaultWorkspace, loadWorkspace, downloadTextFile, openBrowserFile };
