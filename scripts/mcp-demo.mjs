#!/usr/bin/env node
// Real stdio client: exercises Electron, React, native OpenSCAD and PNG/STL
// output end-to-end. No fake forgeAPI and no browser-debugging port.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { parseSTL } from '../src/forge3d/stl-parser.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : path.join(root, 'output', 'mcp-demo');
const keepOpen = process.argv.includes('--keep-open');
await fs.mkdir(output, { recursive: true });
const child = spawn(process.execPath, [path.join(root, 'electron/mcp-server.mjs')], {
  cwd: root, env: process.env, stdio: ['pipe', 'pipe', 'pipe'],
});
let sequence = 0, stderr = '', finished = false;
const pending = new Map(), transcript = [];
child.stderr.on('data', (chunk) => { stderr += chunk; });
const exited = new Promise((resolve) => child.on('exit', (code, signal) => {
  finished = true;
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(`MCP exited: ${code ?? signal}\n${stderr.slice(-4000)}`)); }
  pending.clear();
  resolve({ code, signal });
}));
child.on('error', (error) => {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
  pending.clear();
});
const lines = createInterface({ input: child.stdout });
lines.on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { throw new Error(`Non-JSON on MCP stdout: ${line}`); }
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id); clearTimeout(entry.timer);
  transcript.push({ direction: 'response', ...message,
    ...(message.result?.content?.some((part) => part.type === 'image') ? { result: { content: message.result.content.map((part) => part.type === 'image' ? { ...part, data: `[${part.data.length} base64 characters]` } : part) } } : {}),
  });
  entry.resolve(message);
});
function request(method, params) {
  const id = ++sequence, message = { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };
  transcript.push({ direction: 'request', ...message });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Request timed out: ${method}`)); }, 360_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify(message)}\n`);
  });
}
async function tool(name, args = {}, { failure = false } = {}) {
  const response = await request('tools/call', { name, arguments: args });
  if (failure) { assert.ok(response.error || response.result?.isError, `Expected ${name} to reject`); return response; }
  assert.ok(!response.error && !response.result?.isError, JSON.stringify(response));
  const result = response.result;
  return result.content[0]?.type === 'text' ? JSON.parse(result.content[0].text) : result;
}

export const BRACKET_SOURCE = `// Forge3D MCP demo: parametric reinforced mounting bracket
// @param width = 64 // type: number, min: 40, max: 120
width = 64;
// @param depth = 30 // type: number, min: 20, max: 60
depth = 30;
// @param height = 38 // type: number, min: 20, max: 70
height = 38;
// @param thickness = 4 // type: number, min: 3, max: 8
thickness = 4;
// @param hole_diameter = 5.2 // type: number, min: 3, max: 8
hole_diameter = 5.2;
$fn = 64;
translate([0, depth, 0]) mirror([0, 1, 0])
difference() {
  union() {
    translate([-width/2, 0, 0]) cube([width, depth, thickness]);
    translate([-width/2, 0, 0]) cube([width, thickness, height]);
    for (x = [-width/2, width/2-thickness])
      translate([x, thickness, thickness]) rotate([90, 0, 90])
        linear_extrude(height=thickness)
          polygon([[0,0], [depth-2*thickness,0], [0,height-2*thickness]]);
  }
  for (x = [-width/4, width/4]) {
    translate([x, depth*0.65, -1]) cylinder(h=thickness+2, d=hole_diameter);
    translate([x, thickness+1, height*0.65]) rotate([90,0,0])
      cylinder(h=thickness+2, d=hole_diameter);
  }
}
`;

const checks = [];
try {
  const initialized = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'forge3d-live-demo', version: '1.0.0' } });
  assert.equal(initialized.result?.serverInfo.name, 'forge3d');
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const listed = await request('tools/list', {});
  assert.equal(listed.result.tools.length, 6);
  checks.push('MCP initialize, negotiated version, six discovered tools');

  let model = await tool('forge3d_get_model');
  assert.equal(model.code, '', 'MCP launches an isolated empty workspace');
  model = await tool('forge3d_set_code', { code: BRACKET_SOURCE, expectedRevision: model.revision });
  await tool('forge3d_set_code', { code: 'cube(1);', expectedRevision: model.revision - 1 }, { failure: true });
  assert.equal((await tool('forge3d_get_model')).code, BRACKET_SOURCE);
  checks.push('Isolated workspace, source edit, stale revision rejected without mutation');

  const width = model.parameters.find((parameter) => parameter.name === 'width');
  assert.ok(width);
  await tool('forge3d_set_parameters', { expectedRevision: model.revision, values: [{ id: width.id, value: 72 }, { id: 'missing:1', value: 3 }] }, { failure: true });
  assert.equal((await tool('forge3d_get_model')).revision, model.revision);
  model = await tool('forge3d_set_parameters', { expectedRevision: model.revision, values: [{ id: width.id, value: 72 }] });
  assert.equal(model.parameters.find((parameter) => parameter.name === 'width').value, 72);
  checks.push('Atomic parameter validation and live 64→72 mm resize');

  await tool('forge3d_export_stl', {}, { failure: true });
  model = await tool('forge3d_render', { profile: 'quick' });
  assert.equal(model.render.profile, 'quick');
  await tool('forge3d_export_stl', {}, { failure: true });
  model = await tool('forge3d_render');
  assert.equal(model.render.profile, 'final');
  assert.ok(model.render.triangles > 100);
  assert.deepEqual(model.render.bounds.min, [-36, 0, 0]);
  assert.deepEqual(model.render.bounds.max, [36, 30, 38]);
  checks.push('Native quick/final rendering, 72×30×38 mm bounds, final-only export guard');

  const firstExport = await tool('forge3d_export_stl', { filename: 'mounting-bracket.stl' });
  const secondExport = await tool('forge3d_export_stl', { filename: 'mounting-bracket.stl' });
  assert.notEqual(firstExport.filePath, secondExport.filePath);
  await tool('forge3d_export_stl', { filename: '../escape.stl' }, { failure: true });
  const bytes = await fs.readFile(firstExport.filePath);
  const mesh = parseSTL(new Uint8Array(bytes));
  assert.equal(mesh.triangleCount, model.render.triangles);
  await fs.writeFile(path.join(output, 'mounting-bracket.stl'), bytes);
  await fs.writeFile(path.join(output, 'mounting-bracket.scad'), model.code);
  const capture = await tool('forge3d_capture_viewport');
  const png = Buffer.from(capture.content[0].data, 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  await fs.writeFile(path.join(output, 'mounting-bracket.png'), png);
  checks.push('Non-overwriting STL export, traversal rejection, parsed mesh and viewport-only PNG');

  model = await tool('forge3d_set_code', { code: 'cube(;', expectedRevision: model.revision });
  await tool('forge3d_export_stl', {}, { failure: true });
  await tool('forge3d_capture_viewport', {}, { failure: true });
  await tool('forge3d_render', {}, { failure: true });
  await tool('forge3d_export_stl', {}, { failure: true });
  checks.push('Edits invalidate export/capture; native parser failure never exports old geometry');

  model = await tool('forge3d_get_model');
  model = await tool('forge3d_set_code', { code: BRACKET_SOURCE.replace('width = 64;', 'width = 72;'), expectedRevision: model.revision });
  model = await tool('forge3d_render');
  const finalCapture = await tool('forge3d_capture_viewport');
  await fs.writeFile(path.join(output, 'mounting-bracket.png'), Buffer.from(finalCapture.content[0].data, 'base64'));
  checks.push('Recovered from failed render and left the completed model visible');
  const report = { ok: true, checks, tools: listed.result.tools.map((entry) => entry.name), model: { revision: model.revision, render: model.render }, output };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(output, 'transcript.json'), JSON.stringify(transcript, null, 2));
  await fs.writeFile(path.join(output, 'electron.log'), stderr);
  console.log(`FORGE3D_MCP_DEMO_READY ${JSON.stringify(report)}`);
  if (keepOpen) {
    // The user/QA can inspect the visible session; Ctrl+C closes it cleanly.
    await new Promise((resolve) => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); child.once('exit', resolve); });
  }
} catch (error) {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: false, checks, error: error.stack }, null, 2));
  await fs.writeFile(path.join(output, 'transcript.json'), JSON.stringify(transcript, null, 2));
  await fs.writeFile(path.join(output, 'electron.log'), stderr);
  console.error(error);
  process.exitCode = 1;
} finally {
  if (!finished) child.stdin.end();
  const exit = await exited;
  await fs.writeFile(path.join(output, 'shutdown.json'), JSON.stringify(exit));
  if (exit.code !== 0 && !process.exitCode) process.exitCode = 1;
  lines.close();
}
