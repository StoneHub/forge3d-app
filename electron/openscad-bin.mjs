import fsSync from 'fs';
import path from 'path';
import { spawnSync as defaultSpawnSync } from 'child_process';

const DOWNLOAD_URL = 'https://openscad.org/downloads.html';

function isExecutableCandidate(candidate, existsSync) {
  try {
    return Boolean(candidate) && existsSync(candidate);
  } catch (_) {
    return false;
  }
}

function pathCandidates(env = {}, platform = process.platform) {
  return String(env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => path.join(dir, platform === 'win32' ? 'openscad.exe' : 'openscad'));
}

export function buildOpenScadCandidates({ env = process.env, platform = process.platform } = {}) {
  const candidates = [];

  if (env.FORGE3D_OPENSCAD_BIN) {
    candidates.push({ path: env.FORGE3D_OPENSCAD_BIN, source: 'FORGE3D_OPENSCAD_BIN' });
  }

  if (platform === 'win32') {
    candidates.push(
      { path: 'C:\\Program Files\\OpenSCAD\\openscad.com', source: 'Windows default install' },
      { path: 'C:\\Program Files\\OpenSCAD\\openscad.exe', source: 'Windows default install' },
    );
  } else if (platform === 'darwin') {
    candidates.push(
      { path: '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD', source: 'macOS application bundle' },
      { path: '/Applications/OpenSCAD-2021.01.app/Contents/MacOS/OpenSCAD', source: 'macOS application bundle' },
      { path: '/opt/homebrew/bin/openscad', source: 'Homebrew' },
      { path: '/usr/local/bin/openscad', source: 'Homebrew' },
    );
  } else {
    candidates.push({ path: '/usr/bin/openscad', source: 'Linux system path' });
    candidates.push({ path: '/usr/local/bin/openscad', source: 'Linux local path' });
  }

  for (const candidate of pathCandidates(env, platform)) {
    candidates.push({ path: candidate, source: 'PATH' });
  }

  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate.path || seen.has(candidate.path)) return false;
    seen.add(candidate.path);
    return true;
  });
}

export function resolveOpenScadBin({
  env = process.env,
  platform = process.platform,
  existsSync = fsSync.existsSync,
} = {}) {
  const candidates = buildOpenScadCandidates({ env, platform });
  const match = candidates.find((candidate) => isExecutableCandidate(candidate.path, existsSync));

  if (match) {
    return {
      path: match.path,
      source: match.source,
      candidates,
      error: null,
      message: null,
    };
  }

  const checked = candidates.map((candidate) => `- ${candidate.path} (${candidate.source})`).join('\n');
  return {
    path: null,
    source: null,
    candidates,
    error: 'OpenSCAD executable not found.',
    message: [
      'OpenSCAD executable not found.',
      `Install OpenSCAD from ${DOWNLOAD_URL}, or set FORGE3D_OPENSCAD_BIN to the executable path.`,
      checked ? `Checked:\n${checked}` : '',
    ].filter(Boolean).join('\n'),
  };
}

function summarizeSpawnFailure(result = {}) {
  return [result.stderr, result.stdout, result.error?.message]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('\n');
}

function smokeTestLaunch(command, args, spawnSync) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });
    return {
      ok: result.status === 0,
      detail: summarizeSpawnFailure(result),
    };
  } catch (err) {
    return {
      ok: false,
      detail: err.message,
    };
  }
}

export function resolveOpenScadLaunch({
  env = process.env,
  platform = process.platform,
  existsSync = fsSync.existsSync,
  spawnSync = defaultSpawnSync,
} = {}) {
  const resolution = resolveOpenScadBin({ env, platform, existsSync });
  if (!resolution.path) {
    return {
      ...resolution,
      command: null,
      argsPrefix: [],
      archMode: null,
    };
  }

  const forcedArch = platform === 'darwin' ? String(env.FORGE3D_OPENSCAD_ARCH || '').trim() : '';
  const archBin = '/usr/bin/arch';
  if (forcedArch === 'x86_64') {
    if (!existsSync(archBin)) {
      return {
        ...resolution,
        path: null,
        command: null,
        argsPrefix: [],
        archMode: null,
        error: 'Rosetta launcher not found.',
        message: `FORGE3D_OPENSCAD_ARCH=x86_64 was requested, but ${archBin} is not available.`,
      };
    }
    return {
      ...resolution,
      command: archBin,
      argsPrefix: ['-x86_64', resolution.path],
      archMode: 'x86_64-forced',
      launchWarning: null,
    };
  }

  const directSmoke = smokeTestLaunch(resolution.path, ['--version'], spawnSync);
  if (directSmoke.ok) {
    return {
      ...resolution,
      command: resolution.path,
      argsPrefix: [],
      archMode: platform === 'darwin' ? 'native-or-system-default' : 'system-default',
      launchWarning: null,
    };
  }

  if (platform === 'darwin' && existsSync(archBin)) {
    const rosettaSmoke = smokeTestLaunch(archBin, ['-x86_64', resolution.path, '--version'], spawnSync);
    if (rosettaSmoke.ok) {
      return {
        ...resolution,
        command: archBin,
        argsPrefix: ['-x86_64', resolution.path],
        archMode: 'x86_64-rosetta',
        launchWarning: `OpenSCAD native launch failed; using Rosetta x86_64 fallback.\n${directSmoke.detail}`,
      };
    }
  }

  return {
    ...resolution,
    path: null,
    command: null,
    argsPrefix: [],
    archMode: null,
    error: 'OpenSCAD executable could not be launched.',
    message: [
      `OpenSCAD was found at ${resolution.path}, but could not be launched.`,
      directSmoke.detail,
      platform === 'darwin' ? 'On macOS, approve OpenSCAD in System Settings, install Rosetta if needed, or set FORGE3D_OPENSCAD_BIN to a working executable.' : '',
    ].filter(Boolean).join('\n'),
  };
}
