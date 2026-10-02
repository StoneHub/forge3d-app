import test from 'node:test';
import assert from 'node:assert/strict';
import { detachAndDisposeDiffModels } from '../src/forge3d/editor-lifecycle.js';

function fixture({ sharedPair = false, disposedOriginal = false } = {}) {
  const calls = [];
  let current;
  function model(name, initiallyDisposed = false) {
    let disposed = initiallyDisposed;
    return { isDisposed: () => disposed, dispose() {
      assert.equal(current, null, 'Monaco rejects disposing a model still attached to the diff');
      assert.equal(disposed, false, 'a model has one disposal owner');
      disposed = true;
      calls.push(name);
    } };
  }
  const original = model('original', disposedOriginal);
  const modified = sharedPair ? original : model('modified');
  current = { original, modified };
  const editor = { getModel: () => current, setModel(value) { current = value; calls.push('detach'); } };
  return { editor, calls, original, modified };
}
test('detach precedes owned model disposal and later wrapper cleanup sees no pair', () => {
  const f = fixture();
  detachAndDisposeDiffModels(f.editor);
  assert.deepEqual(f.calls, ['detach', 'original', 'modified']);
  assert.equal(f.editor.getModel(), null);
  detachAndDisposeDiffModels(f.editor);
  assert.deepEqual(f.calls, ['detach', 'original', 'modified']);
});
test('an aliased original/modified model is disposed once', () => {
  const f = fixture({ sharedPair: true });
  detachAndDisposeDiffModels(f.editor);
  assert.deepEqual(f.calls, ['detach', 'original']);
});
test('already disposed models and an absent mount need no second disposal', () => {
  const f = fixture({ disposedOriginal: true });
  detachAndDisposeDiffModels(f.editor);
  assert.deepEqual(f.calls, ['detach', 'modified']);
  detachAndDisposeDiffModels(null);
});
