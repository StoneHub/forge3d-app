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
const output = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : path.join(root, 'output', 'mcp-assembly-demo');
const keepOpen = process.argv.includes('--keep-open');
const appIndex = process.argv.indexOf('--app');
const appArgs = appIndex >= 0 ? ['--app', process.argv[appIndex + 1]] : [];
if (appIndex >= 0 && (!appArgs[1] || !path.isAbsolute(appArgs[1]))) throw new Error('--app requires an absolute packaged executable path');
const launcherIndex = process.argv.indexOf('--launcher');
const launcher = launcherIndex >= 0 ? process.argv[launcherIndex + 1] : path.join(root, 'electron/mcp-server.mjs');
if (!launcher || !path.isAbsolute(launcher)) throw new Error('--launcher requires an absolute MCP launcher path');
await fs.mkdir(output, { recursive: true });
const child = spawn(process.execPath, [launcher, ...appArgs], {
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

const checks = [];
const snapshot = () => tool('forge3d_get_assembly');
async function capture(filename) {
  const result = await tool('forge3d_capture_viewport');
  const png = Buffer.from(result.content[0].data, 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  await fs.writeFile(path.join(output, filename), png);
}
async function exportMesh(state, filename, partIds) {
  const exported = await tool('forge3d_export_assembly_stl', { expectedRevision: state.revision, filename, ...(partIds ? { partIds } : {}) });
  const bytes = await fs.readFile(exported.filePath);
  const parsed = parseSTL(new Uint8Array(bytes));
  assert.equal(parsed.triangleCount, exported.triangles);
  const chosen = state.parts.filter((part) => part.visible && (!partIds || partIds.includes(part.id)));
  assert.equal(exported.parts, chosen.length);
  assert.deepEqual(exported.partIds, partIds || chosen.map((part) => part.id));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < parsed.vertices.length; i++) {
    const axis = i % 3; min[axis] = Math.min(min[axis], parsed.vertices[i]); max[axis] = Math.max(max[axis], parsed.vertices[i]);
  }
  const expectedMin = [Math.min(...chosen.map((p) => p.bounds.min.x)), -Math.max(...chosen.map((p) => p.bounds.max.z)), Math.min(...chosen.map((p) => p.bounds.min.y))];
  const expectedMax = [Math.max(...chosen.map((p) => p.bounds.max.x)), -Math.min(...chosen.map((p) => p.bounds.min.z)), Math.max(...chosen.map((p) => p.bounds.max.y))];
  for (let axis = 0; axis < 3; axis++) { assert.ok(Math.abs(min[axis] - expectedMin[axis]) < .02); assert.ok(Math.abs(max[axis] - expectedMax[axis]) < .02); }
  await fs.writeFile(path.join(output, filename), bytes);
  return { parts: exported.parts, triangles: exported.triangles, min, max };
}
try {
  const initialized = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'forge3d-assembly-demo', version: '1.0.0' } });
  assert.equal(initialized.result?.serverInfo.name, 'forge3d');
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const listed = await request('tools/list', {});
  assert.equal(listed.result.tools.length, 15);
  let state = await snapshot();
  assert.equal(state.parts.length, 0);
  await tool('forge3d_export_assembly_stl', { expectedRevision: state.revision }, { failure: true });
  await tool('forge3d_add_assembly_part', { expectedRevision: state.revision, code: 'cube(;', name: 'Invalid' }, { failure: true });
  assert.equal((await snapshot()).revision, state.revision);
  checks.push('15 standard MCP tools, isolated empty assembly and atomic native syntax failure');

  const plate = 'difference(){translate([-65,-55,0])cube([130,110,6]);for(x=[-50:20:50],y=[-36:24:36])translate([x,y,-1])cylinder(d=5,h=8,$fn=16);}';
  state = await tool('forge3d_add_assembly_part', { expectedRevision: state.revision, name: 'Base plate', code: plate });
  const baseId = state.addedPartId;
  state = await tool('forge3d_duplicate_assembly_part', { expectedRevision: state.revision, partId: baseId, instances: [{ name: 'Upper plate', transform: { position: [0, 45, 0] } }] });
  const upperId = state.selectedPartId;
  state = await tool('forge3d_add_assembly_part', { expectedRevision: state.revision, name: 'Corner standoff', code: 'difference(){cylinder(d=12,h=39,$fn=24);translate([0,0,-1])cylinder(d=5,h=41,$fn=16);}', transform: { position: [-57, 6, -47] } });
  const columnId = state.addedPartId;
  state = await tool('forge3d_duplicate_assembly_part', { expectedRevision: state.revision, partId: columnId, instances: [[57,6,-47],[-57,6,47],[57,6,47]].map((position, index) => ({ name: `Standoff ${index+2}`, transform: { position } })) });
  state = await tool('forge3d_add_assembly_part', { expectedRevision: state.revision, name: 'Fastener', code: 'cylinder(d=4,h=8,$fn=16);translate([0,0,8])cylinder(d=8,h=3,$fn=6);', transform: { position: [-50, 6, -36] } });
  const boltId = state.addedPartId;
  const positions = [];
  for (const height of [6,51]) for (let x=-50;x<=50;x+=20) for (let z=-36;z<=36;z+=24) positions.push([x,height,z]);
  state = await tool('forge3d_duplicate_assembly_part', { expectedRevision: state.revision, partId: boltId, instances: positions.slice(1).map((position,index) => ({ name: `Fastener ${index+2}`, transform: { position } })) });
  assert.equal(state.parts.length, 54);
  assert.equal((await tool('forge3d_get_model')).code, '');
  checks.push('Three distinct real OpenSCAD renders and 51 positioned instances form a visible 54-part assembly; Design source preserved');

  await tool('forge3d_update_assembly_part', { expectedRevision: state.revision-1, partId: upperId, name: 'stale' }, { failure: true });
  const unchangedRevision = state.revision;
  state = await tool('forge3d_update_assembly_part', { expectedRevision: state.revision, partId: upperId, locked: true });
  await tool('forge3d_update_assembly_part', { expectedRevision: state.revision, partId: upperId, transform: { position: [0,80,0] } }, { failure: true });
  await tool('forge3d_remove_assembly_part', { expectedRevision: state.revision, partId: upperId }, { failure: true });
  assert.ok(state.revision > unchangedRevision);
  state = await tool('forge3d_update_assembly_part', { expectedRevision: state.revision, partId: upperId, locked: false, visible: false });
  await tool('forge3d_export_assembly_stl', { expectedRevision: state.revision, partIds:[upperId] }, { failure: true });
  state = await tool('forge3d_update_assembly_part', { expectedRevision: state.revision, partId: upperId, visible: true, transform: { position:[0,45,0] } });
  state = await tool('forge3d_duplicate_assembly_part', { expectedRevision: state.revision, partId: boltId, instances: [{ name:'Temporary fastener' }] });
  state = await tool('forge3d_remove_assembly_part', { expectedRevision: state.revision, partId: state.selectedPartId });
  assert.equal(state.parts.length,54);
  await tool('forge3d_set_mode',{mode:'design'});
  await tool('forge3d_capture_viewport',{}, {failure:true});
  await tool('forge3d_set_mode',{mode:'assembly'});
  await capture('complex-assembly.png');
  const assemblyExport = await exportMesh(state,'complex-assembly.stl');
  checks.push('Stale revisions, locks, visibility, transforms, removal and mode-aware viewport PNG; exported all 54 meshes with verified Z-up bounds');

  const prePrint = await tool('forge3d_get_print');
  assert.equal(prePrint.capabilities.slicing,false);
  await tool('forge3d_prepare_print',{expectedRevision:state.revision,bed:{widthMm:20,depthMm:20,heightMm:20}},{failure:true});
  assert.equal((await snapshot()).revision,state.revision);
  const subset = [baseId,boltId,columnId];
  const prepared = await tool('forge3d_prepare_print',{expectedRevision:state.revision,partIds:subset,bed:{widthMm:220,depthMm:220,heightMm:250},spacingMm:3});
  assert.equal(prepared.placementReady,true);
  state=await snapshot();
  assert.equal(prepared.revision,state.revision);
  await exportMesh(state,'print-subset.stl',subset);
  const allPrepared=await tool('forge3d_prepare_print',{expectedRevision:state.revision,bed:{widthMm:400,depthMm:400,heightMm:250},spacingMm:3});
  assert.equal(allPrepared.placementReady,true);
  assert.equal(allPrepared.parts.length,54);
  state=await snapshot();
  await capture('prepared-print-bed.png');
  const printExport=await exportMesh(state,'prepared-print-bed.stl');
  checks.push('Atomic too-small-bed rejection, exact-subset STL, 54-part bed arrangement and floor/volume checks with real viewport PNG; no slicing claims');
  const report={ok:true,checks,tools:listed.result.tools.map((entry)=>entry.name),assemblyExport,printExport,output};
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await fs.writeFile(path.join(output,'transcript.json'),JSON.stringify(transcript,null,2));
  await fs.writeFile(path.join(output,'electron.log'),stderr);
  console.log(`FORGE3D_ASSEMBLY_DEMO_READY ${JSON.stringify(report)}`);
  if(keepOpen) await new Promise((resolve)=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);child.once('exit',resolve);});
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
