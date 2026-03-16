import { BUILTINS, KEYWORDS } from './interpreter.js';

export const OPENSCAD_LANGUAGE_ID = 'openscad';

const OPENSCAD_WORD_PATTERN = /(-?\d*\.\d\w*)|([$A-Za-z_][$\w]*)/g;
const KEYWORD_LIST = Array.from(KEYWORDS).sort();
const BUILTIN_LIST = Array.from(BUILTINS).sort();
const SYMBOL_NAME_PATTERN = '[$A-Za-z_][$\\w]*';

const SNIPPETS = [
  {
    label: 'module block',
    kind: 'snippet',
    insertText: 'module ${1:name}(${2}) {\n  ${0}\n}',
    documentation: 'Create a reusable module block.',
  },
  {
    label: 'function expression',
    kind: 'snippet',
    insertText: 'function ${1:name}(${2}) = ${0};',
    documentation: 'Create an OpenSCAD function.',
  },
  {
    label: 'difference block',
    kind: 'snippet',
    insertText: 'difference() {\n  ${0}\n}',
    documentation: 'Boolean subtraction block.',
  },
  {
    label: 'union block',
    kind: 'snippet',
    insertText: 'union() {\n  ${0}\n}',
    documentation: 'Boolean union block.',
  },
  {
    label: 'translate block',
    kind: 'snippet',
    insertText: 'translate([${1:0}, ${2:0}, ${3:0}]) {\n  ${0}\n}',
    documentation: 'Translate child geometry.',
  },
  {
    label: 'rotate block',
    kind: 'snippet',
    insertText: 'rotate([${1:0}, ${2:0}, ${3:0}]) {\n  ${0}\n}',
    documentation: 'Rotate child geometry.',
  },
  {
    label: '@param annotation',
    kind: 'snippet',
    insertText: '// @param ${1:name} = ${2:value} // min: ${3:0}, max: ${4:100}, step: ${5:1}\n${1:name} = ${2:value};',
    documentation: 'Forge3D parameter annotation and assignment.',
  },
];

const INLINE_PATTERNS = [
  {
    test: /^diff(?:erence)?$/i,
    build: () => 'difference() {\n  \n}',
  },
  {
    test: /^uni(?:on)?$/i,
    build: () => 'union() {\n  \n}',
  },
  {
    test: /^inter(?:section)?$/i,
    build: () => 'intersection() {\n  \n}',
  },
  {
    test: /^trans(?:late)?$/i,
    build: () => 'translate([0, 0, 0]) {\n  \n}',
  },
  {
    test: /^rot(?:ate)?$/i,
    build: () => 'rotate([0, 0, 0]) {\n  \n}',
  },
  {
    test: /^scale$/i,
    build: () => 'scale([1, 1, 1]) {\n  \n}',
  },
  {
    test: /^module$/i,
    build: () => 'module name() {\n  \n}',
  },
  {
    test: /^function$/i,
    build: () => 'function name() = ;',
  },
  {
    test: /^offset$/i,
    build: () => 'offset(r = 1) {\n  \n}',
  },
  {
    test: /^hull$/i,
    build: () => 'hull() {\n  \n}',
  },
];

let configuredMonaco = false;

function buildLineContexts(lines) {
  const depthAtLineStart = [];
  let braceDepth = 0;
  let inBlockComment = false;
  let inString = false;
  let stringQuote = '';
  let escapeNext = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    depthAtLineStart[lineIndex] = braceDepth;

    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const char = line[charIndex];
      const nextChar = line[charIndex + 1];

      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          charIndex += 1;
        }
        continue;
      }

      if (inString) {
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === stringQuote) {
          inString = false;
          stringQuote = '';
        }
        continue;
      }

      if (char === '/' && nextChar === '/') break;

      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        charIndex += 1;
        continue;
      }

      if (char === '"' || char === '\'') {
        inString = true;
        stringQuote = char;
        continue;
      }

      if (char === '{') braceDepth += 1;
      if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    }
  }

  return depthAtLineStart;
}

function findBlockEndLine(lines, startLine) {
  let braceDepth = 0;
  let foundOpeningBrace = false;
  let inBlockComment = false;
  let inString = false;
  let stringQuote = '';
  let escapeNext = false;

  for (let lineIndex = startLine; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const char = line[charIndex];
      const nextChar = line[charIndex + 1];

      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          charIndex += 1;
        }
        continue;
      }

      if (inString) {
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === stringQuote) {
          inString = false;
          stringQuote = '';
        }
        continue;
      }

      if (char === '/' && nextChar === '/') break;

      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        charIndex += 1;
        continue;
      }

      if (char === '"' || char === '\'') {
        inString = true;
        stringQuote = char;
        continue;
      }

      if (char === '{') {
        braceDepth += 1;
        foundOpeningBrace = true;
      } else if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        if (foundOpeningBrace && braceDepth === 0) {
          return lineIndex + 1;
        }
      }
    }
  }

  return startLine + 1;
}

export function extractOpenScadSymbols(code) {
  const lines = code.split('\n');
  const depthAtLineStart = buildLineContexts(lines);
  const symbols = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const templateMatch = trimmed.match(/^\/\/\s*---\s*Forge3D Template:\s*(.+?)\s*---$/);
    if (templateMatch) {
      let endLine = lines.length;
      for (let nextLine = lineIndex + 1; nextLine < lines.length; nextLine += 1) {
        if (lines[nextLine].trim().startsWith('// --- End Forge3D Template:')) {
          endLine = nextLine + 1;
          break;
        }
      }
      symbols.push({ kind: 'template', name: templateMatch[1], startLine: lineIndex + 1, endLine });
      continue;
    }

    const moduleMatch = line.match(new RegExp(`^\\s*module\\s+(${SYMBOL_NAME_PATTERN})\\s*\\(`));
    if (moduleMatch) {
      symbols.push({
        kind: 'module',
        name: moduleMatch[1],
        startLine: lineIndex + 1,
        endLine: findBlockEndLine(lines, lineIndex),
      });
      continue;
    }

    const functionMatch = line.match(new RegExp(`^\\s*function\\s+(${SYMBOL_NAME_PATTERN})\\s*\\(`));
    if (functionMatch) {
      symbols.push({
        kind: 'function',
        name: functionMatch[1],
        startLine: lineIndex + 1,
        endLine: lineIndex + 1,
      });
      continue;
    }

    if (depthAtLineStart[lineIndex] === 0) {
      const variableMatch = line.match(new RegExp(`^\\s*(${SYMBOL_NAME_PATTERN})\\s*=\\s*.+;`));
      if (variableMatch && !variableMatch[1].startsWith('$')) {
        symbols.push({
          kind: 'variable',
          name: variableMatch[1],
          startLine: lineIndex + 1,
          endLine: lineIndex + 1,
        });
      }
    }
  }

  return symbols;
}

function getSymbolKind(monaco, kind) {
  if (kind === 'module') return monaco.languages.SymbolKind.Module;
  if (kind === 'function') return monaco.languages.SymbolKind.Function;
  if (kind === 'template') return monaco.languages.SymbolKind.Namespace;
  return monaco.languages.SymbolKind.Variable;
}

function buildRange(monaco, startLine, endLine) {
  return new monaco.Range(startLine, 1, Math.max(startLine, endLine), Number.MAX_SAFE_INTEGER);
}

function wordRangeAtPosition(monaco, model, position) {
  const word = model.getWordUntilPosition(position);
  return {
    word: word.word || '',
    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
  };
}

function buildKeywordSuggestions(monaco, model, position) {
  const { range } = wordRangeAtPosition(monaco, model, position);

  const keywordItems = KEYWORD_LIST.map((label) => ({
    label,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: label,
    range,
    detail: 'OpenSCAD keyword',
  }));

  const builtinItems = BUILTIN_LIST.map((label) => ({
    label,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: label,
    range,
    detail: 'OpenSCAD built-in',
  }));

  const snippetItems = SNIPPETS.map((snippet) => ({
    label: snippet.label,
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: snippet.insertText,
    range,
    documentation: snippet.documentation,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  }));

  return [...snippetItems, ...keywordItems, ...builtinItems];
}

function buildInlineSuggestions(monaco, model, position) {
  const { word, range } = wordRangeAtPosition(monaco, model, position);
  const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1).trim();
  const inlineItems = [];
  const seen = new Set();

  const addSuggestion = (insertText) => {
    if (!insertText || seen.has(insertText)) return;
    seen.add(insertText);
    inlineItems.push({ insertText, range });
  };

  if (word.length >= 2) {
    const symbols = extractOpenScadSymbols(model.getValue());
    for (const label of [...KEYWORD_LIST, ...BUILTIN_LIST, ...symbols.map((symbol) => symbol.name)]) {
      if (label.toLowerCase().startsWith(word.toLowerCase()) && label !== word) {
        addSuggestion(label);
      }
    }
  }

  for (const pattern of INLINE_PATTERNS) {
    if (pattern.test(linePrefix)) {
      addSuggestion(pattern.build(linePrefix));
      break;
    }
  }

  return inlineItems.slice(0, 3);
}

export function ensureForge3DThemes(monaco) {
  monaco.editor.defineTheme('forge3d-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'predefined', foreground: '61afef' },
      { token: 'identifier', foreground: 'e5c07b' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'string', foreground: '98c379' },
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#1a1b2e',
      'editor.lineHighlightBackground': '#23243a',
      'editorLineNumber.foreground': '#5c5d7a',
      'editorLineNumber.activeForeground': '#c8c9db',
      'editorCursor.foreground': '#61afef',
      'editorWhitespace.foreground': '#2a2b40',
      'editorGutter.background': '#1e1f30',
      'editorIndentGuide.background1': '#2a2b40',
      'editorIndentGuide.activeBackground1': '#4fc3f766',
      'editorInlayHint.background': '#4fc3f714',
      'editorInlayHint.foreground': '#8a8baa',
    },
  });

  monaco.editor.defineTheme('forge3d-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '7a1fa2' },
      { token: 'predefined', foreground: '1565c0' },
      { token: 'identifier', foreground: '8d4b00' },
      { token: 'number', foreground: 'b25b00' },
      { token: 'string', foreground: '2e7d32' },
      { token: 'comment', foreground: '7b8794', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#fafbfc',
      'editor.lineHighlightBackground': '#f0f4fa',
      'editorLineNumber.foreground': '#9aa5b1',
      'editorLineNumber.activeForeground': '#333333',
      'editorCursor.foreground': '#1565c0',
      'editorWhitespace.foreground': '#dce3ea',
      'editorGutter.background': '#f0f2f5',
      'editorIndentGuide.background1': '#dce3ea',
      'editorIndentGuide.activeBackground1': '#1565c055',
      'editorInlayHint.background': '#1565c012',
      'editorInlayHint.foreground': '#666666',
    },
  });
}

export function configureMonacoOpenScad(monaco) {
  ensureForge3DThemes(monaco);
  if (configuredMonaco) return;
  configuredMonaco = true;

  if (!monaco.languages.getLanguages().some((language) => language.id === OPENSCAD_LANGUAGE_ID)) {
    monaco.languages.register({ id: OPENSCAD_LANGUAGE_ID });
  }

  monaco.languages.setLanguageConfiguration(OPENSCAD_LANGUAGE_ID, {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    wordPattern: OPENSCAD_WORD_PATTERN,
    indentationRules: {
      increaseIndentPattern: /^.*\{\s*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
    folding: {
      markers: {
        start: /^\s*\/\/\s*#?region\b/,
        end: /^\s*\/\/\s*#?endregion\b/,
      },
    },
  });

  monaco.languages.setMonarchTokensProvider(OPENSCAD_LANGUAGE_ID, {
    keywords: KEYWORD_LIST,
    builtins: BUILTIN_LIST,
    tokenizer: {
      root: [
        [/[{}()[\]]/, '@brackets'],
        [/\$?[A-Za-z_][$\w]*/, { cases: { '@keywords': 'keyword', '@builtins': 'predefined', '@default': 'identifier' } }],
        [/-?(?:\d+\.\d+|\d+|\.\d+)(?:e[+\-]?\d+)?/, 'number'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"/, 'string', '@string'],
        [/[;,.]/, 'delimiter'],
        [/[+\-*/=<>!&|%^]+/, 'operator'],
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  });

  monaco.languages.registerCompletionItemProvider(OPENSCAD_LANGUAGE_ID, {
    triggerCharacters: ['$', '_'],
    provideCompletionItems(model, position) {
      return {
        suggestions: buildKeywordSuggestions(monaco, model, position),
      };
    },
  });

  monaco.languages.registerDocumentSymbolProvider(OPENSCAD_LANGUAGE_ID, {
    provideDocumentSymbols(model) {
      return extractOpenScadSymbols(model.getValue()).map((symbol) => ({
        name: symbol.name,
        detail: symbol.kind,
        kind: getSymbolKind(monaco, symbol.kind),
        range: buildRange(monaco, symbol.startLine, symbol.endLine),
        selectionRange: buildRange(monaco, symbol.startLine, symbol.startLine),
        children: [],
      }));
    },
  });

  monaco.languages.registerInlineCompletionsProvider(OPENSCAD_LANGUAGE_ID, {
    provideInlineCompletions(model, position) {
      return {
        items: buildInlineSuggestions(monaco, model, position),
      };
    },
    handlePartialAccept() {},
    disposeInlineCompletions() {},
  });
}
