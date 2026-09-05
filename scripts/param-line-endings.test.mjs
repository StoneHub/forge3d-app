import test from 'node:test';
import assert from 'node:assert/strict';
import { parseParams, applyParamChange } from '../src/forge3d/param-parser.js';

for (const [name, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  test(`${name}: annotated parameters read saved values and preserve source when edited`, () => {
    const lines = [
      '// @param radius = 2 // min: 1, max: 10',
      '  radius = 4; // keep this comment',
      '// @param label = "Default" // type: string',
      'label = "Saved";',
      '// @param enabled = false // type: boolean',
      'enabled = true;',
      'height = 12;',
      'cube([radius, height, 1]);',
      '',
    ];
    const code = lines.join(eol);
    const params = parseParams(code);
    assert.deepEqual(params.map(({ name, value }) => [name, value]), [
      ['radius', 4], ['label', 'Saved'], ['enabled', true], ['height', 12],
    ]);
    for (const [param, value, line, expected] of [
      ['radius', 6, 1, '  radius = 6; // keep this comment'],
      ['label', 'Edited', 3, 'label = "Edited";'],
      ['enabled', false, 5, 'enabled = false;'],
      ['height', 20, 6, 'height = 20;'],
    ]) {
      const edited = applyParamChange(code, param, value);
      const expectedLines = [...lines];
      expectedLines[line] = expected;
      assert.equal(edited, expectedLines.join(eol));
      assert.equal(parseParams(edited).find((p) => p.name === param).value, value);
    }
  });
}
