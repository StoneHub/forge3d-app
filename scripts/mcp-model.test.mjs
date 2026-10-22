import test from 'node:test';
import assert from 'node:assert/strict';
import { getMcpParameters, applyMcpParameters, assertMcpRevision } from '../src/forge3d/mcp-model.js';

test('MCP exposes only top-level literal parameters, not commented/nested/derived expressions', () => {
  const code = `size = 10;
derived = 10 * 2;
vector = [1, 2, 3];
/*
hidden = 15;
*/
module part() {
  inner = 3;
}
label = "a; // not a comment";
enabled = true;
`;
  assert.deepEqual(getMcpParameters(code).map((p) => p.name), ['size', 'label', 'enabled']);
});

test('MCP parameter updates preserve CRLF, comments and annotation defaults', () => {
  const code = '// @param size = 10 // type: number, min: 1, max: 30\r\nsize = 10; // mm\r\nlabel = "hi"; // text\r\n';
  const next = applyMcpParameters(code, [{ id: 'size:2', value: 11 }, { id: 'label:3', value: 'hello' }]);
  assert.equal(next, '// @param size = 10 // type: number, min: 1, max: 30\r\nsize = 11; // mm\r\nlabel = "hello"; // text\r\n');
  assert.equal(getMcpParameters(next)[0].defaultValue, 10);
  assert.equal(applyMcpParameters('size = 10;\r\ncube(size);\r\n', [{ id: 'size:1', value: 11 }]), 'size = 11;\r\ncube(size);\r\n');
});

test('MCP string values are encoded as literals, never interpolated into SCAD', () => {
  const code = 'label = "hello"; // preserved\n';
  const value = 'a"; cube(999); //\n\\b';
  const next = applyMcpParameters(code, [{ id: 'label:1', value }]);
  assert.equal(next, `label = ${JSON.stringify(value)}; // preserved\n`);
  assert.equal(getMcpParameters(next)[0].value, value);
});

test('MCP validates every parameter before returning any changed code', () => {
  const code = 'size = 10;\nenabled = false;\n';
  for (const values of [
    [{ id: 'size:1', value: 11 }, { id: 'missing:3', value: 2 }],
    [{ id: 'size:1', value: NaN }],
    [{ id: 'size:1', value: Infinity }],
    [{ id: 'size:1', value: '11' }],
    [{ id: 'enabled:2', value: 1 }],
    [{ id: 'size:1', value: 11 }, { id: 'size:1', value: 12 }],
    [{ id: 'size:1', value: -1 }],
    [],
  ]) assert.throws(() => applyMcpParameters(code, values));
  assert.equal(code, 'size = 10;\nenabled = false;\n');
});

test('MCP enforces explicit enums and repeated variable identities', () => {
  const code = '// @param mode = "a" // options: a,b\nmode = "a";\nsize = 10;\nsize = 12;\n';
  assert.throws(() => applyMcpParameters(code, [{ id: 'mode:2', value: 'c' }]));
  const next = applyMcpParameters(code, [{ id: 'size:4', value: 13 }, { id: 'mode:2', value: 'b' }]);
  assert.match(next, /size = 10;\nsize = 13;/);
  assert.match(next, /mode = "b";/);
});

test('MCP protects against stale revisions, builds and non-design edits', () => {
  const state = { revision: 8, building: false, mode: 'design' };
  assert.doesNotThrow(() => assertMcpRevision(state, 8));
  for (const revision of [7, 9, NaN, '8', undefined]) assert.throws(() => assertMcpRevision(state, revision), /Model changed/);
  assert.throws(() => assertMcpRevision({ ...state, building: true }, 8), /render is running/);
  assert.throws(() => assertMcpRevision({ ...state, mode: 'assembly' }, 8), /Design mode/);
});
