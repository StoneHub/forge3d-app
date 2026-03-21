import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import MonacoEditor, { DiffEditor, loader } from '@monaco-editor/react';
import * as monacoApi from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletions.contribution.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { configureMonacoOpenScad, ensureForge3DThemes, extractOpenScadSymbols, OPENSCAD_LANGUAGE_ID, resolveOpenScadReference } from './editor-language.js';

const INLINE_ACCEPT_ID = 'editor.action.inlineSuggest.commit';
const INLINE_ACCEPT_WORD_ID = 'editor.action.inlineSuggest.acceptNextWord';
const INLINE_ACCEPT_LINE_ID = 'editor.action.inlineSuggest.acceptNextLine';
const INLINE_TRIGGER_ID = 'editor.action.inlineSuggest.trigger';
const FIND_ACTION_ID = 'actions.find';
const REPLACE_ACTION_ID = 'editor.action.startFindReplaceAction';

if (typeof globalThis !== 'undefined' && !globalThis.MonacoEnvironment) {
  globalThis.MonacoEnvironment = {
    getWorker() {
      return new editorWorker();
    },
  };
}

loader.config({ monaco: monacoApi });

function prepareBlockInsertion(source, start, end, text) {
  if (!source.trim()) {
    return {
      rangeStart: 0,
      rangeEnd: source.length,
      insertedText: text,
      selectionStart: 0,
      selectionEnd: text.length,
    };
  }

  if (start !== end) {
    return {
      rangeStart: start,
      rangeEnd: end,
      insertedText: text,
      selectionStart: start,
      selectionEnd: start + text.length,
    };
  }

  const before = source.slice(0, start);
  const after = source.slice(end);
  const trailingNewlines = before.match(/\n*$/)?.[0].length ?? 0;
  const leadingNewlines = after.match(/^\n*/)?.[0].length ?? 0;
  const prefix = before.length === 0 ? '' : '\n'.repeat(Math.max(0, 2 - trailingNewlines));
  const suffix = after.length === 0 ? '' : '\n'.repeat(Math.max(0, 2 - leadingNewlines));

  return {
    rangeStart: start,
    rangeEnd: end,
    insertedText: `${prefix}${text}${suffix}`,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + text.length,
  };
}

function getEditorTheme(theme) {
  return theme === 'light' ? 'forge3d-light' : 'forge3d-dark';
}

function createSymbolDecorations(monaco, code) {
  return extractOpenScadSymbols(code).map((symbol) => {
    const decorationClass =
      symbol.kind === 'module'
        ? 'forge3d-symbol-module'
        : symbol.kind === 'function'
          ? 'forge3d-symbol-function'
          : symbol.kind === 'template'
            ? 'forge3d-symbol-template'
            : 'forge3d-symbol-variable';

    const color =
      symbol.kind === 'module'
        ? '#4fc3f7'
        : symbol.kind === 'function'
          ? '#81c784'
          : symbol.kind === 'template'
            ? '#ffb74d'
            : '#8a8baa';

    return {
      range: new monaco.Range(symbol.startLine, 1, symbol.startLine, 1),
      options: {
        isWholeLine: true,
        linesDecorationsClassName: decorationClass,
        overviewRuler: {
          color,
          position: monaco.editor.OverviewRulerLane.Left,
        },
        hoverMessage: [
          {
            value: `$(symbol-${symbol.kind === 'variable' ? 'variable' : symbol.kind}) ${symbol.name}`,
          },
        ],
      },
    };
  });
}

function convertDiagnosticsToMarkers(monaco, diagnostics = []) {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    severity:
      diagnostic.severity === 'error'
        ? monaco.MarkerSeverity.Error
        : diagnostic.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
  }));
}

function getBaseEditorOptions(theme, readOnly = false) {
  return {
    automaticLayout: true,
    bracketPairColorization: { enabled: true },
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace",
    fontLigatures: true,
    fontSize: 13,
    glyphMargin: false,
    guides: {
      bracketPairs: 'active',
      indentation: true,
    },
    inlineSuggest: {
      enabled: true,
      fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace",
      mode: 'subwordSmart',
      showToolbar: 'always',
      suppressSuggestions: false,
    },
    lineDecorationsWidth: 12,
    lineHeight: 20,
    lineNumbersMinChars: 3,
    matchBrackets: 'always',
    minimap: { enabled: false },
    overviewRulerBorder: false,
    padding: { top: 12, bottom: 12 },
    quickSuggestions: { other: true, comments: false, strings: false },
    readOnly,
    renderFinalNewline: 'on',
    renderValidationDecorations: 'on',
    roundedSelection: true,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    suggest: {
      preview: true,
      selectionMode: 'always',
      showStatusBar: true,
    },
    tabCompletion: 'on',
    theme: getEditorTheme(theme),
    wordBasedSuggestions: 'currentDocument',
  };
}

export const CodeEditor = forwardRef(function CodeEditor({
  code,
  comparisonCode,
  diagnostics = [],
  onBuild,
  onChange,
  onOpenReference,
  onRedo,
  onUndo,
  showDiff = false,
  theme,
}, ref) {
  const editorRef = useRef(null);
  const diffEditorRef = useRef(null);
  const modifiedEditorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationIdsRef = useRef([]);
  const interactionDisposablesRef = useRef([]);

  const editorTheme = useMemo(() => getEditorTheme(theme), [theme]);

  const getActiveEditor = useCallback(() => modifiedEditorRef.current || editorRef.current, []);

  const applyEditorEnhancements = useCallback((editor, monaco) => {
    editor.addAction({
      id: 'forge3d-build-model',
      label: 'Build Model',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => onBuild?.(),
    });

    editor.addAction({
      id: 'forge3d-inline-accept-line',
      label: 'Accept Next Inline Suggestion Line',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.RightArrow],
      run: () => editor.trigger('keyboard', INLINE_ACCEPT_LINE_ID, null),
    });

    editor.addAction({
      id: 'forge3d-inline-trigger',
      label: 'Trigger Inline Suggestion',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Slash],
      run: () => editor.trigger('keyboard', INLINE_TRIGGER_ID, { explicit: true }),
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => onUndo?.());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => onRedo?.());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => onRedo?.());
  }, [onBuild, onRedo, onUndo]);

  const attachBuiltinDocsInteractions = useCallback((editor) => {
    interactionDisposablesRef.current.forEach((disposable) => disposable?.dispose?.());
    interactionDisposablesRef.current = [];

    interactionDisposablesRef.current.push(editor.onMouseDown((event) => {
      const position = event.target.position;
      if (!position || !(event.event.ctrlKey || event.event.metaKey)) return;
      const model = editor.getModel();
      const word = model?.getWordAtPosition(position)?.word;
      const reference = resolveOpenScadReference(model?.getValue() || '', word, position.lineNumber);
      if (!reference) return;
      onOpenReference?.(reference);
    }));
  }, [onOpenReference]);

  const refreshDecorationsAndMarkers = useCallback(() => {
    const editor = getActiveEditor();
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    monaco.editor.setModelMarkers(model, 'forge3d-lsp', convertDiagnosticsToMarkers(monaco, diagnostics));
    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      createSymbolDecorations(monaco, model.getValue()),
    );
  }, [diagnostics, getActiveEditor]);

  const focusEditor = useCallback(() => {
    getActiveEditor()?.focus();
  }, [getActiveEditor]);

  const runEditorAction = useCallback((actionId) => {
    const editor = getActiveEditor();
    if (!editor) return;
    editor.focus();
    editor.getAction(actionId)?.run();
  }, [getActiveEditor]);

  const jumpToLine = useCallback((lineNumber) => {
    const editor = getActiveEditor();
    const model = editor?.getModel();
    if (!editor || !model) return;

    const safeLine = Math.max(1, Math.min(lineNumber, model.getLineCount()));
    const maxColumn = model.getLineMaxColumn(safeLine);
    const selection = new monacoApi.Selection(safeLine, 1, safeLine, maxColumn);

    editor.focus();
    editor.setSelection(selection);
    editor.revealLineInCenter(safeLine);
  }, [getActiveEditor]);

  const insertText = useCallback((text, options = {}) => {
    const editor = getActiveEditor();
    const model = editor?.getModel();
    const monaco = monacoRef.current;
    if (!editor || !model || !monaco) return false;

    const selection = editor.getSelection();
    if (!selection) return false;

    const source = model.getValue();
    const startOffset = model.getOffsetAt(selection.getStartPosition());
    const endOffset = model.getOffsetAt(selection.getEndPosition());
    const insertion = prepareBlockInsertion(source, startOffset, endOffset, text);
    const range = new monaco.Range(
      model.getPositionAt(insertion.rangeStart).lineNumber,
      model.getPositionAt(insertion.rangeStart).column,
      model.getPositionAt(insertion.rangeEnd).lineNumber,
      model.getPositionAt(insertion.rangeEnd).column,
    );

    editor.pushUndoStop();
    editor.executeEdits('forge3d.insert', [{
      range,
      text: insertion.insertedText,
      forceMoveMarkers: true,
    }]);
    editor.pushUndoStop();

    const shouldSelectInserted = options.selectInserted ?? true;
    const selectionStart = model.getPositionAt(shouldSelectInserted ? insertion.selectionStart : insertion.selectionEnd);
    const selectionEnd = model.getPositionAt(shouldSelectInserted ? insertion.selectionEnd : insertion.selectionEnd);
    const nextSelection = new monaco.Selection(
      selectionStart.lineNumber,
      selectionStart.column,
      selectionEnd.lineNumber,
      selectionEnd.column,
    );
    editor.setSelection(nextSelection);
    editor.revealPositionInCenter(selectionStart);
    editor.focus();
    return true;
  }, [getActiveEditor]);

  useImperativeHandle(ref, () => ({
    focus: focusEditor,
    getDocumentSymbols() {
      const editor = getActiveEditor();
      const model = editor?.getModel();
      return extractOpenScadSymbols(model?.getValue() || code);
    },
    insertText,
    jumpToLine,
    openFind() {
      runEditorAction(FIND_ACTION_ID);
    },
    openReplace() {
      runEditorAction(REPLACE_ACTION_ID);
    },
    triggerInlineSuggestion() {
      const editor = getActiveEditor();
      editor?.trigger('keyboard', INLINE_TRIGGER_ID, { explicit: true });
    },
    acceptInlineSuggestion() {
      const editor = getActiveEditor();
      editor?.trigger('keyboard', INLINE_ACCEPT_ID, null);
    },
    acceptNextInlineWord() {
      const editor = getActiveEditor();
      editor?.trigger('keyboard', INLINE_ACCEPT_WORD_ID, null);
    },
    acceptNextInlineLine() {
      const editor = getActiveEditor();
      editor?.trigger('keyboard', INLINE_ACCEPT_LINE_ID, null);
    },
  }), [code, focusEditor, getActiveEditor, insertText, jumpToLine, runEditorAction]);

  useEffect(() => {
    refreshDecorationsAndMarkers();
  }, [code, diagnostics, showDiff, refreshDecorationsAndMarkers]);

  useEffect(() => {
    const editor = getActiveEditor();
    editor?.updateOptions({ theme: editorTheme });
  }, [editorTheme, getActiveEditor]);

  useEffect(() => () => {
    interactionDisposablesRef.current.forEach((disposable) => disposable?.dispose?.());
    interactionDisposablesRef.current = [];
  }, []);

  const handleBeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco;
    configureMonacoOpenScad(monaco);
    ensureForge3DThemes(monaco);
  }, []);

  const handleMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;
    modifiedEditorRef.current = null;
    applyEditorEnhancements(editor, monaco);
    attachBuiltinDocsInteractions(editor);
    refreshDecorationsAndMarkers();
  }, [applyEditorEnhancements, attachBuiltinDocsInteractions, refreshDecorationsAndMarkers]);

  const handleDiffMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    diffEditorRef.current = editor;
    modifiedEditorRef.current = editor.getModifiedEditor();
    applyEditorEnhancements(modifiedEditorRef.current, monaco);
    attachBuiltinDocsInteractions(modifiedEditorRef.current);
    refreshDecorationsAndMarkers();
  }, [applyEditorEnhancements, attachBuiltinDocsInteractions, refreshDecorationsAndMarkers]);

  const baseOptions = useMemo(() => getBaseEditorOptions(theme), [theme]);
  const diffOptions = useMemo(() => ({
    ...getBaseEditorOptions(theme),
    originalEditable: false,
    renderSideBySide: true,
  }), [theme]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <style>{`
        .forge3d-symbol-module {
          border-left: 3px solid #4fc3f7;
          margin-left: 6px;
        }
        .forge3d-symbol-function {
          border-left: 3px solid #81c784;
          margin-left: 6px;
        }
        .forge3d-symbol-template {
          border-left: 3px solid #ffb74d;
          margin-left: 6px;
        }
        .forge3d-symbol-variable {
          border-left: 3px solid #8a8baa;
          margin-left: 6px;
        }
      `}</style>

      {showDiff ? (
        <DiffEditor
          beforeMount={handleBeforeMount}
          height="100%"
          language={OPENSCAD_LANGUAGE_ID}
          modified={code}
          onChange={(value) => {
            if (typeof value === 'string' && value !== code) onChange(value);
          }}
          onMount={handleDiffMount}
          options={diffOptions}
          original={comparisonCode || ''}
          theme={editorTheme}
        />
      ) : (
        <MonacoEditor
          beforeMount={handleBeforeMount}
          height="100%"
          language={OPENSCAD_LANGUAGE_ID}
          onChange={(value) => {
            if (typeof value === 'string' && value !== code) onChange(value);
          }}
          onMount={handleMount}
          options={baseOptions}
          theme={editorTheme}
          value={code}
        />
      )}
    </div>
  );
});
