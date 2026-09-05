import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseParams, applyParamChange } from '../src/forge3d/param-parser.js';
import { parseSTL } from '../src/forge3d/stl-parser.js';
import { resolveOpenScadLaunch } from '../electron/openscad-bin.mjs';

const sourceDir = fileURLToPath(new URL('../src/forge3d/start-catalog/scad/math/', import.meta.url));
const files = readdirSync(sourceDir).filter((name) => name.endsWith('.scad'));
const nativeEnabled = process.env.FORGE3D_TEST_OPENSCAD === '1';

for (const file of files) {
  const code = readFileSync(path.join(sourceDir, file), 'utf8');
  const params = parseParams(code);
  test(`${file}: controls patch real assignments with bounded numeric values`, () => {
    assert.ok(params.length >= 3);
    for (const param of params) {
      assert.equal(param.auto, undefined, `${param.name} needs explicit teaching controls`);
      assert.equal(param.type, 'number');
      assert.ok(Number.isFinite(param.value));
      assert.ok(param.min < param.max && param.step > 0);
      assert.ok(param.value >= param.min && param.value <= param.max);
      for (const value of [param.min, param.max]) {
        const edited = applyParamChange(code, param, value);
        assert.equal(parseParams(edited).find((p) => p.name === param.name).value, value);
      }
    }
  });

  test(`${file}: native defaults and control extremes produce closed Z-up solids`, {
    skip: !nativeEnabled && 'Set FORGE3D_TEST_OPENSCAD=1 to render with installed OpenSCAD',
    timeout: 360_000,
  }, () => {
    const launch = resolveOpenScadLaunch();
    assert.ok(launch.command, launch.message);
    const dir = mkdtempSync(path.join(tmpdir(), 'forge3d-math-'));
    try {
      for (const variant of ['default', 'min', 'max']) {
        const input = path.join(dir, file);
        const output = path.join(dir, 'model.stl');
        const source = variant === 'default' ? code : params.reduce(
          (current, param) => applyParamChange(current, param, param[variant]), code);
        writeFileSync(input, source);
        const result = spawnSync(launch.command, [
          ...launch.argsPrefix, '--hardwarnings', '--export-format', 'binstl', '-o', output, input,
        ], { encoding: 'utf8', timeout: 120_000 });
        assert.ifError(result.error);
        assert.equal(result.status, 0, `${variant}: ${result.stderr}`);
        assert.doesNotMatch(result.stderr, /WARNING:|ERROR:/);
        const buffer = readFileSync(output);
        const mesh = parseSTL(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        assertClosedSolid(mesh, `${file} ${variant}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

function assertClosedSolid({ vertices, triangleCount }, label) {
  assert.ok(triangleCount > 0, label);
  const edges = new Map();
  let volume = 0;
  for (let i = 0; i < vertices.length; i += 9) {
    const points = [0, 3, 6].map((offset) => Array.from(vertices.slice(i + offset, i + offset + 3)));
    const [a, b, c] = points;
    for (const point of points) {
      assert.ok(point.every(Number.isFinite), label);
      assert.ok(point[2] >= -0.00001, `${label}: below floor`);
    }
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1])
      + a[1] * (b[2] * c[0] - b[0] * c[2])
      + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    for (let j = 0; j < 3; j++) {
      const from = points[j].join(',');
      const to = points[(j + 1) % 3].join(',');
      assert.notEqual(from, to, `${label}: collapsed edge`);
      const key = [from, to].sort().join('|');
      const edge = edges.get(key) || { count: 0, direction: 0 };
      edge.count++;
      edge.direction += from < to ? 1 : -1;
      edges.set(key, edge);
    }
  }
  assert.ok(volume > 0, `${label}: outward winding and positive volume`);
  for (const edge of edges.values()) {
    assert.equal(edge.count, 2, `${label}: closed two-face edge`);
    assert.equal(edge.direction, 0, `${label}: consistent face winding`);
  }
}
