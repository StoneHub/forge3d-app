import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const workflow = fs
  .readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
  .replaceAll('\r\n', '\n');

test('manual releases check out the requested tag', () => {
  assert.match(workflow, /tag:\n\s+description: Existing tag to publish, for manual release runs\.\n\s+required: true/);
  const checkoutRef = /ref: \$\{\{ github\.event_name == 'workflow_dispatch' && github\.event\.inputs\.tag \|\| github\.ref \}\}/g;
  assert.equal([...workflow.matchAll(checkoutRef)].length, 2);
});

test('pull requests exercise packaging without publishing a release', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /publish:[\s\S]*?if: startsWith\(github\.ref, 'refs\/tags\/'\) \|\| github\.event_name == 'workflow_dispatch'/);
});

test('release screenshots are isolated by runner and remain optional', () => {
  assert.match(workflow, /screenshot: darwin/);
  assert.match(workflow, /screenshot: win32/);
  assert.match(workflow, /screenshot: linux/);
  assert.match(workflow, /path: docs\/screenshots\/release\/forge3d-showcase-\$\{\{ matrix\.screenshot \}\}\.png/);
  assert.match(workflow, /name: Upload release screenshots[\s\S]*?if-no-files-found: warn/);
  assert.doesNotMatch(workflow, /path: docs\/screenshots\/release\/\*\*/);
});

test('only the publish job can write repository contents', () => {
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.match(workflow, /publish:[\s\S]*?permissions:\n\s+contents: write/);
});
