import { mkdir, stat } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const previewDir = path.join(repoRoot, 'src', 'forge3d', 'start-catalog', 'previews');
const openscadBin = 'C:\\Program Files\\OpenSCAD\\openscad.com';
const scriptPath = fileURLToPath(import.meta.url);
const force = process.argv.includes('--force');
const changedOnly = process.argv.includes('--changed-only');

const jobs = [
  ['example-magnetic-letters', 'src/forge3d/start-catalog/scad/examples/magnetic_letters_pro.scad'],
  ['example-chess-pawn', 'src/forge3d/start-catalog/scad/examples/chess_pawn.scad'],
  ['example-impossible-ring', 'src/forge3d/start-catalog/scad/examples/impossible_ring_showcase.scad'],
  ['example-quads', 'src/forge3d/start-catalog/scad/examples/quads_relief_showcase.scad'],
  ['example-talons', 'src/forge3d/start-catalog/scad/vendored/jeffbarr/talons.scad'],
  ['helper-angle-bracket', 'src/forge3d/start-catalog/scad/helpers/angle_bracket.scad'],
  ['helper-ball-socket-mount', 'src/forge3d/start-catalog/scad/helpers/ball_socket_mount.scad'],
  ['helper-project-enclosure', 'src/forge3d/start-catalog/scad/helpers/project_enclosure.scad'],
  ['helper-insert-boss-plate', 'src/forge3d/start-catalog/scad/helpers/insert_boss_plate.scad'],
  ['helper-screw-hole-sampler', 'src/forge3d/start-catalog/scad/helpers/screw_hole_sampler.scad'],
  ['helper-threaded-bolt', 'src/forge3d/start-catalog/scad/helpers/threaded_bolt.scad'],
  ['helper-threaded-hole-test', 'src/forge3d/start-catalog/scad/helpers/threaded_hole_test.scad'],
  ['learning-cube-starter', 'src/forge3d/start-catalog/scad/learning/cube_starter.scad'],
  ['learning-offset-profile', 'src/forge3d/start-catalog/scad/learning/offset_profile.scad'],
  ['learning-sphere-starter', 'src/forge3d/start-catalog/scad/learning/sphere_starter.scad'],
  ['learning-triangle-plate', 'src/forge3d/start-catalog/scad/learning/triangle_plate.scad'],
];

async function shouldRenderJob(inputRelativePath, outputFileName) {
  if (force || !changedOnly) return true;

  const inputPath = path.join(repoRoot, inputRelativePath);
  const outputPath = path.join(previewDir, `${outputFileName}.png`);

  try {
    const [inputStats, outputStats, scriptStats] = await Promise.all([
      stat(inputPath),
      stat(outputPath),
      stat(scriptPath),
    ]);
    return inputStats.mtimeMs > outputStats.mtimeMs || scriptStats.mtimeMs > outputStats.mtimeMs;
  } catch (_) {
    return true;
  }
}

async function runOpenScad(inputRelativePath, outputFileName) {
  const inputPath = path.join(repoRoot, inputRelativePath);
  const outputPath = path.join(previewDir, `${outputFileName}.png`);
  const args = [
    '--autocenter',
    '--viewall',
    '--projection=p',
    '--imgsize=640,420',
    '--colorscheme=DeepOcean',
    '--render',
    '-D',
    '$fn=40',
    '-o',
    outputPath,
    inputPath,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(openscadBin, args, {
      cwd: path.dirname(inputPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`OpenSCAD failed for ${inputRelativePath} (${code})\n${stdout}\n${stderr}`));
      }
    });
  });
}

await mkdir(previewDir, { recursive: true });

let renderedCount = 0;

for (const [id, relativePath] of jobs) {
  if (!(await shouldRenderJob(relativePath, id))) {
    process.stdout.write(`Skipping ${id} (up to date)\n`);
    continue;
  }
  process.stdout.write(`Rendering ${id}...\n`);
  await runOpenScad(relativePath, id);
  renderedCount += 1;
}

process.stdout.write(`Generated ${renderedCount} preview image${renderedCount === 1 ? '' : 's'} in ${previewDir}\n`);
