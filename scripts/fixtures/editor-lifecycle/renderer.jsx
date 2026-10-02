import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { CodeEditor } from '../../../src/forge3d/editor.jsx';

const calls = { modelDisposals: {}, subscriptions: 0, unsubscriptions: 0, creationSubscriptions: 0, creationUnsubscriptions: 0 };
const errors = [];
const sharedModel = monaco.editor.createModel('unrelated shared model', 'plaintext');
const onDidCreateDiffEditor = monaco.editor.onDidCreateDiffEditor;
monaco.editor.onDidCreateDiffEditor = listener => {
  calls.creationSubscriptions++;
  const subscription = onDidCreateDiffEditor(listener);
  return { dispose() { calls.creationUnsubscriptions++; subscription.dispose(); } };
};
// Observe ownership without replacing real Monaco behavior.
monaco.editor.onDidCreateModel(model => {
  const id = model.uri.toString();
  calls.modelDisposals[id] = 0;
  const dispose = model.dispose.bind(model);
  model.dispose = () => { calls.modelDisposals[id]++; return dispose(); };
  if (window.editorLifecycle?.closeDuringCreation && ++window.editorLifecycle.earlyModels === 2) {
    window.editorLifecycle.update({ showDiff: false });
  }
});
monaco.editor.onDidCreateEditor(editor => {
  const onMouseDown = editor.onMouseDown.bind(editor);
  editor.onMouseDown = listener => {
    calls.subscriptions++;
    const subscription = onMouseDown(listener);
    return { dispose() { calls.unsubscriptions++; subscription.dispose(); } };
  };
});
window.editorLifecycle = {
  errors, calls,
  earlyModels: 0,
  ready: () => Array.isArray(monaco.editor.getDiffEditors()[0]?.getLineChanges()),
  snapshot: () => ({ errors: [...errors], calls, liveOwnedModels: monaco.editor.getModels().filter(model => model !== sharedModel).length,
    sharedModelAlive: !sharedModel.isDisposed(), diffEditors: monaco.editor.getDiffEditors().length }),
};
window.addEventListener('error', event => errors.push(event.error?.stack || event.message));
window.addEventListener('unhandledrejection', event => errors.push(event.reason?.stack || String(event.reason)));
function Harness({ initialDiff }) {
  const [state, setState] = useState({ showDiff: initialDiff, code: 'cube([18,12,8]);', comparisonCode: 'cube([10,12,8]);', theme: 'dark' });
  const ref = useRef(null);
  window.editorLifecycle.update = changes => setState(current => ({ ...current, ...changes }));
  window.editorLifecycle.insert = text => ref.current.insertText(text);
  window.editorLifecycle.code = state.code;
  return <CodeEditor ref={ref} {...state} onChange={code => setState(current => ({ ...current, code }))} />;
}
let root;
window.editorLifecycle.mount = (initialDiff = true) => {
  root = createRoot(document.getElementById('root'));
  root.render(<React.StrictMode><Harness initialDiff={initialDiff} /></React.StrictMode>);
};
window.editorLifecycle.unmount = () => root.unmount();
window.editorLifecycle.mount();
