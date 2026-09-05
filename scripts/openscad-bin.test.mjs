import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOpenScadCandidates,
  resolveOpenScadBin,
  resolveOpenScadLaunch,
} from '../electron/openscad-bin.mjs';

test('uses FORGE3D_OPENSCAD_BIN before platform defaults', () => {
  const result = resolveOpenScadBin({
    env: { FORGE3D_OPENSCAD_BIN: '/custom/openscad' },
    platform: 'darwin',
    existsSync: (candidate) => candidate === '/custom/openscad',
  });

  assert.equal(result.path, '/custom/openscad');
  assert.equal(result.source, 'FORGE3D_OPENSCAD_BIN');
});

test('includes macOS app bundle, Homebrew, and PATH candidates on darwin', () => {
  const candidates = buildOpenScadCandidates({
    env: { PATH: '/custom/bin:/opt/homebrew/bin' },
    platform: 'darwin',
  });

  assert.deepEqual(candidates, [
    { path: '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD', source: 'macOS application bundle' },
    { path: '/Applications/OpenSCAD-2021.01.app/Contents/MacOS/OpenSCAD', source: 'macOS application bundle' },
    { path: '/opt/homebrew/bin/openscad', source: 'Homebrew' },
    { path: '/usr/local/bin/openscad', source: 'Homebrew' },
    { path: '/custom/bin/openscad', source: 'PATH' },
  ]);
});

test('checks OpenSCAD CLI and GUI executables on Windows PATH', () => {
  const candidates = buildOpenScadCandidates({
    env: { PATH: 'C:\\Tools\\OpenSCAD;D:\\OpenSCAD' },
    platform: 'win32',
  });

  assert.deepEqual(candidates.slice(-4), [
    { path: 'C:\\Tools\\OpenSCAD\\openscad.com', source: 'PATH' },
    { path: 'C:\\Tools\\OpenSCAD\\openscad.exe', source: 'PATH' },
    { path: 'D:\\OpenSCAD\\openscad.com', source: 'PATH' },
    { path: 'D:\\OpenSCAD\\openscad.exe', source: 'PATH' },
  ]);
});

test('returns clear diagnostics when OpenSCAD cannot be found', () => {
  const result = resolveOpenScadBin({
    env: { PATH: '/usr/local/bin' },
    platform: 'darwin',
    existsSync: () => false,
  });

  assert.equal(result.path, null);
  assert.equal(result.error, 'OpenSCAD executable not found.');
  assert.match(result.message, /FORGE3D_OPENSCAD_BIN/);
  assert.match(result.message, /openscad.org\/downloads/);
});

test('falls back to Rosetta on macOS when direct universal launch fails', () => {
  const calls = [];
  const result = resolveOpenScadLaunch({
    env: { FORGE3D_OPENSCAD_BIN: '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD' },
    platform: 'darwin',
    existsSync: (candidate) => candidate === '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD'
      || candidate === '/usr/bin/arch',
    spawnSync: (command, args) => {
      calls.push([command, args]);
      if (command === '/usr/bin/arch') return { status: 0, stdout: 'OpenSCAD version 2026.04.26' };
      return { status: -1, stderr: 'Incompatible processor. This Qt build requires the following features:\n    neon' };
    },
  });

  assert.equal(result.command, '/usr/bin/arch');
  assert.deepEqual(result.argsPrefix, ['-x86_64', '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD']);
  assert.equal(result.archMode, 'x86_64-rosetta');
  assert.equal(calls.length, 2);
});

test('honors FORGE3D_OPENSCAD_ARCH=x86_64 on macOS', () => {
  const result = resolveOpenScadLaunch({
    env: {
      FORGE3D_OPENSCAD_BIN: '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD',
      FORGE3D_OPENSCAD_ARCH: 'x86_64',
    },
    platform: 'darwin',
    existsSync: (candidate) => candidate === '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD'
      || candidate === '/usr/bin/arch',
    spawnSync: () => ({ status: 0, stdout: 'OpenSCAD version 2026.04.26' }),
  });

  assert.equal(result.command, '/usr/bin/arch');
  assert.deepEqual(result.argsPrefix, ['-x86_64', '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD']);
  assert.equal(result.archMode, 'x86_64-forced');
});
