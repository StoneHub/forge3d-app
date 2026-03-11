import { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { KEYWORDS, BUILTINS, TOKEN_COLORS } from './interpreter.js';

// ─── SYNTAX HIGHLIGHTER ─────────────────────────────────────────────
function HighlightedCode({ code }) {
  return useMemo(() => {
    const result = [];
    let i = 0, key = 0;
    const len = code.length;
    while (i < len) {
      const ch = code[i];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        let s = i; while (i < len && /[\s]/.test(code[i])) i++;
        result.push(<span key={key++}>{code.slice(s, i)}</span>); continue;
      }
      if (ch === '/' && code[i + 1] === '/') {
        let s = i; while (i < len && code[i] !== '\n') i++;
        result.push(<span key={key++} style={{ color: TOKEN_COLORS.comment }}>{code.slice(s, i)}</span>); continue;
      }
      if (ch === '/' && code[i + 1] === '*') {
        let s = i; i += 2; while (i < len - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++; i += 2;
        result.push(<span key={key++} style={{ color: TOKEN_COLORS.comment }}>{code.slice(s, i)}</span>); continue;
      }
      if (ch === '"') {
        let s = i; i++; while (i < len && code[i] !== '"') { if (code[i] === '\\') i++; i++; } i++;
        result.push(<span key={key++} style={{ color: TOKEN_COLORS.string }}>{code.slice(s, i)}</span>); continue;
      }
      if (/[a-zA-Z_$]/.test(ch)) {
        let s = i; i++; while (i < len && /[a-zA-Z0-9_]/.test(code[i])) i++;
        const w = code.slice(s, i);
        const c = KEYWORDS.has(w) ? TOKEN_COLORS.keyword : BUILTINS.has(w) ? TOKEN_COLORS.builtin : TOKEN_COLORS.ident;
        result.push(<span key={key++} style={{ color: c }}>{w}</span>); continue;
      }
      if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(code[i + 1]))) {
        let s = i; while (i < len && /[0-9.eE\-+]/.test(code[i])) i++;
        result.push(<span key={key++} style={{ color: TOKEN_COLORS.number }}>{code.slice(s, i)}</span>); continue;
      }
      result.push(<span key={key++} style={{ color: TOKEN_COLORS.punct }}>{ch}</span>); i++;
    }
    return result;
  }, [code]);
}

const AUTO_CLOSE = { '{': '}', '(': ')', '[': ']', '"': '"' };

// ─── CODE EDITOR COMPONENT ───────────────────────────────────────────
export const CodeEditor = forwardRef(function CodeEditor({ code, onChange, onUndo, onRedo, canUndo, canRedo, onBuild, theme }, ref) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const lineRef = useRef(null);

  // Expose imperative jumpToLine for error click navigation
  useImperativeHandle(ref, () => ({
    jumpToLine(lineNumber) {
      const ta = textareaRef.current;
      if (!ta) return;
      const lines = ta.value.split('\n');
      let pos = 0;
      for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
        pos += lines[i].length + 1;
      }
      ta.focus();
      ta.setSelectionRange(pos, pos + (lines[lineNumber - 1]?.length ?? 0));
      // Scroll the line into view
      const lineHeight = 20;
      const scrollTop = (lineNumber - 4) * lineHeight;
      if (highlightRef.current) highlightRef.current.scrollTop = scrollTop;
      if (lineRef.current) lineRef.current.scrollTop = scrollTop;
      ta.scrollTop = scrollTop;
    },
  }));

  const lines = code.split('\n');
  const isDark = theme !== 'light';

  const handleScroll = (e) => {
    if (highlightRef.current) { highlightRef.current.scrollTop = e.target.scrollTop; highlightRef.current.scrollLeft = e.target.scrollLeft; }
    if (lineRef.current) { lineRef.current.scrollTop = e.target.scrollTop; }
  };

  const handleKeyDown = (e) => {
    const mod = e.metaKey || e.ctrlKey;

    // Undo / Redo
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) onRedo?.();
      else onUndo?.();
      return;
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      onRedo?.();
      return;
    }

    // ── Shift+Enter → Build ──
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      onBuild?.();
      return;
    }

    // Tab → 2-space indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const nc = code.substring(0, start) + '  ' + code.substring(end);
      onChange(nc);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
      return;
    }

    // ── Auto-close brackets & quotes ──
    if (AUTO_CLOSE[e.key]) {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const closing = AUTO_CLOSE[e.key];
      // If selection exists, wrap it
      if (start !== end) {
        const selected = code.substring(start, end);
        const nc = code.substring(0, start) + e.key + selected + closing + code.substring(end);
        onChange(nc);
        setTimeout(() => { ta.selectionStart = start + 1; ta.selectionEnd = end + 1; }, 0);
      } else {
        // Insert pair and place cursor in between
        const nc = code.substring(0, start) + e.key + closing + code.substring(end);
        onChange(nc);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1; }, 0);
      }
      return;
    }

    // Smart closing: skip over existing closing char if it's already there
    if (['}', ')', ']', '"'].includes(e.key)) {
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      if (code[start] === e.key) {
        e.preventDefault();
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1; }, 0);
        return;
      }
    }

    // Auto-indent after '{'
    if (e.key === 'Enter') {
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const lineStart = code.lastIndexOf('\n', start - 1) + 1;
      const lineText = code.slice(lineStart, start);
      const indent = lineText.match(/^(\s*)/)[1];
      const prevChar = code[start - 1];
      const nextChar = code[start];
      if (prevChar === '{' && nextChar === '}') {
        // Expand block: put closing brace on its own line
        e.preventDefault();
        const ins = '\n' + indent + '  \n' + indent;
        const nc = code.substring(0, start) + ins + code.substring(start);
        onChange(nc);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + indent.length + 3; }, 0);
        return;
      }
      if (prevChar === '{') {
        e.preventDefault();
        const ins = '\n' + indent + '  ';
        const nc = code.substring(0, start) + ins + code.substring(start);
        onChange(nc);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + ins.length; }, 0);
        return;
      }
    }
  };

  const font = "'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace";
  const lineNumBg = isDark ? '#1e1f2e' : '#f0f2f5';
  const lineNumColor = isDark ? '#4a4b6a' : '#aaaacc';
  const lineNumBorder = isDark ? '#2a2b3d' : '#e0e0e0';

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', fontFamily: font, fontSize: '13px', lineHeight: '20px' }}>
      <div ref={lineRef} style={{ width: '48px', minWidth: '48px', background: lineNumBg, color: lineNumColor, textAlign: 'right', padding: '12px 8px 12px 0', overflow: 'hidden', userSelect: 'none', borderRight: `1px solid ${lineNumBorder}` }}>
        {lines.map((_, i) => <div key={i} style={{ height: '20px' }}>{i + 1}</div>)}
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <pre ref={highlightRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: '12px', overflow: 'hidden', pointerEvents: 'none', color: '#abb2bf', whiteSpace: 'pre', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }}>
          <HighlightedCode code={code} />
        </pre>
        <textarea ref={textareaRef} value={code} onChange={e => onChange(e.target.value)} onScroll={handleScroll} onKeyDown={handleKeyDown} spellCheck={false}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', margin: 0, padding: '12px', background: 'transparent', color: 'transparent', caretColor: '#61afef', border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', whiteSpace: 'pre', overflow: 'auto' }}
        />
      </div>
    </div>
  );
});
