// CodeEditor supplies no model paths: this pair belongs to its DiffEditor mount.
// The React wrapper still owns the widget. After detachment its cleanup cannot
// discover these models, so release the captured pair here exactly once.
export function detachAndDisposeDiffModels(editor) {
  const models = editor?.getModel();
  if (!models) return;
  editor.setModel(null);
  for (const model of new Set([models.original, models.modified])) {
    if (model && !model.isDisposed()) model.dispose();
  }
}
