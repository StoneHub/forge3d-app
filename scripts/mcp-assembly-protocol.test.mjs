import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createMcpProtocol, validateToolArguments, TOOL_DEFINITIONS } from '../electron/mcp-protocol.mjs';
import { createAssemblyPart } from '../src/forge3d/assembly.js';
import { assertAssemblyRevision, getMcpAssemblySnapshot, updateMcpAssemblyPart, duplicateMcpAssemblyPart, removeMcpAssemblyPart } from '../src/forge3d/mcp-assembly.js';
import { getMcpPrintSnapshot, prepareMcpPrint } from '../src/forge3d/mcp-print.js';

const bed = { widthMm: 100, depthMm: 100, heightMm: 100 };
const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
async function initialized(callTool) {
  const protocol = createMcpProtocol({ callTool });
  await protocol.handle({ jsonrpc: '2.0', id: 'init', method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'local-test', version: '1' } } });
  await protocol.handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
  let id = 0;
  return {
    protocol,
    call: async (name, args = {}) => (await protocol.handle({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } })).result,
  };
}

const invalidCalls = [
  ['forge3d_set_mode', { mode: 'print' }],
  ['forge3d_set_mode', { mode: 'assembly', extra: true }],
  ['forge3d_add_assembly_part', { expectedRevision: 0 }],
  ['forge3d_add_assembly_part', { expectedRevision: 0, code: 'cube(2);', transform: { position: [0, 1] } }],
  ['forge3d_add_assembly_part', { expectedRevision: 0, code: 'cube(2);', transform: { scale: [1, 0, 1] } }],
  ['forge3d_update_assembly_part', { expectedRevision: -1, partId: 'a' }],
  ['forge3d_update_assembly_part', { expectedRevision: 0, partId: 'a', transform: { rotation: [0, Infinity, 0] } }],
  ['forge3d_update_assembly_part', { expectedRevision: 0, partId: 'a', transform: { position: [0, 1e6 + 1, 0] } }],
  ['forge3d_update_assembly_part', { expectedRevision: 0, partId: 'a', visible: 'true' }],
  ['forge3d_update_assembly_part', { expectedRevision: 0, partId: 'a', locked: null }],
  ['forge3d_update_assembly_part', { expectedRevision: 0, partId: 'a', name: '   ' }],
  ['forge3d_duplicate_assembly_part', { expectedRevision: 0, partId: 'a', instances: [] }],
  ['forge3d_duplicate_assembly_part', { expectedRevision: 0, partId: 'a', instances: Array(201).fill({}) }],
  ['forge3d_duplicate_assembly_part', { expectedRevision: 0, partId: 'a', instances: [{ name: 'x', color: 'red' }] }],
  ['forge3d_duplicate_assembly_part', { expectedRevision: 0, partId: 'a', instances: [{ transform: { scale: [1, -1, 1] } }] }],
  ['forge3d_remove_assembly_part', { expectedRevision: 0, partId: '' }],
  ['forge3d_export_assembly_stl', { expectedRevision: 0, filename: '../outside.stl' }],
  ['forge3d_export_assembly_stl', { expectedRevision: 0, filename: 'outside.obj' }],
  ['forge3d_get_print', { bed: { widthMm: 10, depthMm: 10 } }],
  ['forge3d_get_print', { bed: { ...bed, widthMm: 10001 } }],
  ['forge3d_get_print', { bed: { ...bed, depthMm: 0 } }],
  ['forge3d_get_print', { bed: { ...bed, heightMm: NaN } }],
  ['forge3d_get_print', { bed: { ...bed, nozzle: 0.4 } }],
  ['forge3d_get_print', { partIds: ['a', 'a'] }],
  ['forge3d_get_print', { partIds: [] }],
  ['forge3d_get_print', { partIds: [42] }],
  ['forge3d_prepare_print', { expectedRevision: 0 }],
  ['forge3d_prepare_print', { expectedRevision: 0, bed, spacingMm: -1 }],
  ['forge3d_prepare_print', { expectedRevision: 0, bed, spacingMm: 1001 }],
];

test('assembly/print schema validation rejects malformed calls before dispatch', async () => {
  let dispatches = 0;
  const { call } = await initialized(() => { dispatches++; return text({}); });
  for (const [name, args] of invalidCalls) {
    const result = await call(name, args);
    assert.equal(result.isError, true, `${name}: ${JSON.stringify(args)}`);
  }
  assert.equal(dispatches, 0);
});

test('valid vectors, explicit bounds, IDs, and revision remain detached across IPC validation', () => {
  const args = { expectedRevision: 5, partId: 'part-a', instances: [{ name: 'Copy', transform: { position: [1.25, 0, -2.5], rotation: [0, 2.5, 0], scale: [1, 2, 0.5] } }] };
  const validated = validateToolArguments('forge3d_duplicate_assembly_part', args);
  assert.deepEqual(validated, args);
  validated.instances[0].transform.position[0] = 500;
  assert.equal(args.instances[0].transform.position[0], 1.25);
  assert.deepEqual(validateToolArguments('forge3d_prepare_print', { expectedRevision: 0, bed: { widthMm: 10000, depthMm: 10000, heightMm: 10000 }, spacingMm: 1000 }), { expectedRevision: 0, bed: { widthMm: 10000, depthMm: 10000, heightMm: 10000 }, spacingMm: 1000 });
  assert.deepEqual(validateToolArguments('forge3d_prepare_print', { expectedRevision: 0, bed, spacingMm: 0 }), { expectedRevision: 0, bed, spacingMm: 0 });
  const printTool = TOOL_DEFINITIONS.find((entry) => entry.name === 'forge3d_prepare_print');
  assert.equal(printTool.inputSchema.properties.bed.properties.widthMm.maximum, 10000);
  assert.equal(printTool.inputSchema.properties.spacingMm.maximum, 1000);
});

test('protocol surfaces stale revisions, unknown IDs, and failed arrangements without partial edits', async () => {
  let scene = { parts: ['a', 'b'].map((id) => createAssemblyPart({ id, name: id, geometry: new THREE.BoxGeometry(60, 10, 60).toNonIndexed() })), selectedPartId: 'a' };
  let revision = 3;
  const { call } = await initialized((name, args) => {
    if (name === 'forge3d_get_assembly') return text(getMcpAssemblySnapshot(scene, revision, 'assembly'));
    if (name === 'forge3d_get_print') return text({ revision, ...getMcpPrintSnapshot(scene, args) });
    assertAssemblyRevision(revision, args.expectedRevision);
    let next;
    if (name === 'forge3d_update_assembly_part') next = updateMcpAssemblyPart(scene, args);
    if (name === 'forge3d_duplicate_assembly_part') next = duplicateMcpAssemblyPart(scene, args);
    if (name === 'forge3d_remove_assembly_part') next = removeMcpAssemblyPart(scene, args.partId);
    if (name === 'forge3d_prepare_print') next = prepareMcpPrint(scene, args).scene;
    scene = next;
    revision++;
    return text(getMcpAssemblySnapshot(scene, revision, 'assembly'));
  });
  const original = scene;
  const stale = await call('forge3d_update_assembly_part', { expectedRevision: 2, partId: 'a', transform: { position: [1, 2, 3] } });
  assert.equal(stale.isError, true);
  assert.match(stale.content[0].text, /current revision 3/);
  assert.equal(scene, original);
  const unknown = await call('forge3d_remove_assembly_part', { expectedRevision: 3, partId: 'missing' });
  assert.equal(unknown.isError, true);
  assert.equal(scene, original);
  const crowded = await call('forge3d_prepare_print', { expectedRevision: 3, bed });
  assert.equal(crowded.isError, true);
  assert.match(crowded.content[0].text, /does not fit/);
  assert.equal(scene, original);
  assert.equal(revision, 3);
  assert.deepEqual(scene.parts[0].transform.position, [0, 0, 0]);
  const prepared = await call('forge3d_prepare_print', { expectedRevision: 3, bed: { ...bed, widthMm: 200 } });
  assert.notEqual(prepared.isError, true);
  assert.equal(revision, 4);
  assert.equal(JSON.parse((await call('forge3d_get_print')).content[0].text).placementReady, true);
  const stalePrint = await call('forge3d_prepare_print', { expectedRevision: 3, bed });
  assert.equal(stalePrint.isError, true);
  assert.equal(revision, 4);
});
