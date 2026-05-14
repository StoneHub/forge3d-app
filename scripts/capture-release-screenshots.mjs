import { mkdir } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveOpenScadLaunch } from '../electron/openscad-bin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const electronBin = process.platform === 'win32'
  ? path.join(repoRoot, 'node_modules', '.bin', 'electron.cmd')
  : path.join(repoRoot, 'node_modules', '.bin', 'electron');

const defaultScadPath = path.join(repoRoot, 'docs', 'release-assets', 'forge3d-showcase.scad');
const defaultOutputPath = path.join(
  repoRoot,
  'docs',
  'screenshots',
  'release',
  `forge3d-showcase-${process.platform}.png`,
);

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? path.resolve(process.cwd(), match.slice(prefix.length)) : fallback;
}

const scadPath = readArg('scad', defaultScadPath);
const outputPath = readArg('output', defaultOutputPath);
const forceRosetta = process.argv.includes('--force-rosetta');

async function ensureOpenScadRunnable() {
  const launch = resolveOpenScadLaunch({
    env: {
      ...process.env,
      ...(forceRosetta ? { FORGE3D_OPENSCAD_ARCH: 'x86_64' } : {}),
    },
  });
  if (!launch.command) {
    throw new Error(launch.message);
  }
  if (launch.launchWarning) {
    console.warn(launch.launchWarning);
  }
  console.log(`OpenSCAD launch mode: ${launch.archMode || 'system-default'}`);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await ensureOpenScadRunnable();

await new Promise((resolve, reject) => {
  const child = spawn(electronBin, ['.', '--skip-start-previews'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FORGE3D_SKIP_START_PREVIEWS: '1',
      FORGE3D_RELEASE_SCREENSHOT: '1',
      FORGE3D_RELEASE_SCREENSHOT_SCAD: scadPath,
      FORGE3D_RELEASE_SCREENSHOT_OUTPUT: outputPath,
      ...(forceRosetta ? { FORGE3D_OPENSCAD_ARCH: 'x86_64' } : {}),
    },
    stdio: 'inherit',
  });

  const timeout = setTimeout(() => {
    child.kill();
    reject(new Error('Timed out while capturing release screenshot.'));
  }, 240000);

  child.on('error', (err) => {
    clearTimeout(timeout);
    reject(err);
  });

  child.on('exit', (code) => {
    clearTimeout(timeout);
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`Electron screenshot capture exited with code ${code}.`));
  });
});

console.log(`Release screenshot captured: ${outputPath}`);
