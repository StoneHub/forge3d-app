import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";

// ─── ICONS ───────────────────────────────────────────────────────────
const Icons = {
  Play: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  Cube: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Sphere: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="10" ry="4"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
  Cylinder: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5"/></svg>,
  Grid: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  File: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  Zap: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg>,
  ChevRight: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  Warn: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Err: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  Layers: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Minus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  Union: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="12" r="7"/><circle cx="15" cy="12" r="7"/></svg>,
  Intersect: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="12" r="7" strokeDasharray="3 2"/><circle cx="15" cy="12" r="7" strokeDasharray="3 2"/><path d="M12 6.2a7 7 0 0 1 0 11.6 7 7 0 0 1 0-11.6" fill="currentColor" opacity="0.3" stroke="currentColor" strokeDasharray="0"/></svg>,
  Undo: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 1 1 0 14h-1"/></svg>,
  Redo: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 14 5-5-5-5"/><path d="M20 9h-9a7 7 0 1 0 0 14h1"/></svg>,
};

// ─── TOKENIZER ───────────────────────────────────────────────────────
const KEYWORDS = new Set(['module','function','if','else','for','let','each','include','use','true','false','undef']);
const BUILTINS = new Set(['cube','sphere','cylinder','polyhedron','circle','square','polygon','text','linear_extrude','rotate_extrude','translate','rotate','scale','mirror','multmatrix','color','offset','hull','minkowski','union','difference','intersection','render','projection','surface','import','resize','children','echo','assert','concat','lookup','str','chr','ord','search','version','len','log','ln','pow','sqrt','exp','abs','sign','sin','cos','tan','asin','acos','atan','atan2','floor','ceil','round','min','max','norm','cross','rands','PI']);
const MULTI_OPS = new Set(['==','!=','<=','>=','||','&&']);

function tokenize(code) {
  const tokens = [];
  let i = 0;
  const len = code.length;
  while (i < len) {
    const ch = code[i];
    // ── Skip whitespace ──
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { i++; continue; }
    // ── Line comment ──
    if (ch === '/' && code[i + 1] === '/') {
      const s = i; while (i < len && code[i] !== '\n') i++;
      tokens.push({ type: 'comment', value: code.slice(s, i) }); continue;
    }
    // ── Block comment ──
    if (ch === '/' && code[i + 1] === '*') {
      const s = i; i += 2;
      while (i < len - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2; tokens.push({ type: 'comment', value: code.slice(s, i) }); continue;
    }
    // ── String ──
    if (ch === '"') {
      const s = i; i++;
      while (i < len && code[i] !== '"') { if (code[i] === '\\') i++; i++; }
      i++; tokens.push({ type: 'string', value: code.slice(s, i) }); continue;
    }
    // ── Identifiers (including $fn etc) ──
    if (/[a-zA-Z_$]/.test(ch)) {
      const s = i; i++;
      while (i < len && /[a-zA-Z0-9_]/.test(code[i])) i++;
      const w = code.slice(s, i);
      tokens.push({ type: KEYWORDS.has(w) ? 'keyword' : BUILTINS.has(w) ? 'builtin' : 'ident', value: w });
      continue;
    }
    // ── Numbers ──
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(code[i + 1]))) {
      const s = i;
      while (i < len && /[0-9]/.test(code[i])) i++;
      if (i < len && code[i] === '.') { i++; while (i < len && /[0-9]/.test(code[i])) i++; }
      if (i < len && (code[i] === 'e' || code[i] === 'E')) {
        i++; if (i < len && (code[i] === '+' || code[i] === '-')) i++;
        while (i < len && /[0-9]/.test(code[i])) i++;
      }
      tokens.push({ type: 'number', value: code.slice(s, i) }); continue;
    }
    // ── Multi-char operators ──
    if (i + 1 < len && MULTI_OPS.has(ch + code[i + 1])) {
      tokens.push({ type: 'punct', value: ch + code[i + 1] }); i += 2; continue;
    }
    // ── Single-char punctuation ──
    tokens.push({ type: 'punct', value: ch }); i++;
  }
  return tokens;
}

const TOKEN_COLORS = {
  keyword: '#c678dd', builtin: '#61afef', string: '#98c379', number: '#d19a66',
  comment: '#5c6370', ident: '#e5c07b', punct: '#abb2bf',
};

// ─── INTERPRETER ─────────────────────────────────────────────────────
function interpret(code) {
  const objects = [];
  const logs = [];
  const errors = [];
  const warnings = [];
  const variables = {};
  let objectId = 0;

  const palette = ['#4fc3f7','#81c784','#ffb74d','#e57373','#ba68c8','#4dd0e1','#aed581','#ff8a65','#f06292','#7986cb'];

  try {
    const tokens = tokenize(code).filter(t => t.type !== 'comment');
    let ti = 0;

    function peek() { return tokens[ti] || { type: 'eof', value: '' }; }
    function next() { return tokens[ti++] || { type: 'eof', value: '' }; }
    function expect(val) { const t = next(); if (t.value !== val) throw new Error(`Expected '${val}' got '${t.value}'`); return t; }
    function match(val) { if (peek().value === val) { next(); return true; } return false; }

    // ── Math builtins ──
    const mathFns = {
      sin: (a) => Math.sin(a * Math.PI / 180), cos: (a) => Math.cos(a * Math.PI / 180),
      tan: (a) => Math.tan(a * Math.PI / 180), asin: Math.asin, acos: Math.acos, atan: Math.atan,
      atan2: Math.atan2, sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
      round: Math.round, min: Math.min, max: Math.max, pow: Math.pow, log: Math.log, ln: Math.log,
      exp: Math.exp, sign: Math.sign,
      len: (a) => a != null && a.length != null ? a.length : 0,
      norm: (a) => Array.isArray(a) ? Math.sqrt(a.reduce((s, v) => s + v * v, 0)) : Math.abs(a),
      str: (...a) => a.join(''), concat: (...a) => a.flat(),
      rands: (lo, hi, n) => { const a = []; for (let j = 0; j < n; j++) a.push(lo + Math.random() * (hi - lo)); return a; },
    };

    // ── Expression parser ──
    function parseExpr() { return parseTernary(); }
    function parseTernary() { let l = parseOr(); if (match('?')) { const t = parseExpr(); expect(':'); const f = parseExpr(); return l ? t : f; } return l; }
    function parseOr() { let l = parseAnd(); while (peek().value === '||') { next(); l = l || parseAnd(); } return l; }
    function parseAnd() { let l = parseCmp(); while (peek().value === '&&') { next(); l = l && parseCmp(); } return l; }
    function parseCmp() {
      let l = parseAdd();
      const ops = new Set(['<','>','<=','>=','==','!=']);
      while (ops.has(peek().value)) { const o = next().value; const r = parseAdd(); l = o==='<'?l<r:o==='>'?l>r:o==='<='?l<=r:o==='>='?l>=r:o==='=='?l==r:l!=r; }
      return l;
    }
    function parseAdd() { let l = parseMul(); while (peek().value === '+' || peek().value === '-') { const o = next().value; const r = parseMul(); l = o === '+' ? l + r : l - r; } return l; }
    function parseMul() { let l = parseUnary(); while (peek().value === '*' || peek().value === '/' || peek().value === '%') { const o = next().value; const r = parseUnary(); l = o === '*' ? l * r : o === '/' ? l / r : l % r; } return l; }
    function parseUnary() { if (peek().value === '-') { next(); return -parseUnary(); } if (peek().value === '!') { next(); return !parseUnary(); } return parsePostfix(); }

    // ── Postfix (array indexing) ──
    function parsePostfix() {
      let l = parsePrimary();
      while (peek().value === '[') {
        next();
        const idx = parseExpr();
        expect(']');
        if (Array.isArray(l) && typeof idx === 'number') l = l[Math.floor(idx)];
        else if (typeof l === 'string' && typeof idx === 'number') l = l.charAt(Math.floor(idx));
        else l = undefined;
      }
      return l;
    }

    function parsePrimary() {
      const t = peek();
      if (t.type === 'number') { next(); return parseFloat(t.value); }
      if (t.value === 'true') { next(); return true; }
      if (t.value === 'false') { next(); return false; }
      if (t.value === 'undef') { next(); return undefined; }
      if (t.value === 'PI') { next(); return Math.PI; }

      // Parenthesized expression
      if (t.value === '(') { next(); const v = parseExpr(); expect(')'); return v; }

      // Array literal or range [a:b] or [a:step:b]
      if (t.value === '[') {
        next();
        if (peek().value === ']') { next(); return []; }
        const first = parseExpr();
        if (peek().value === ':') {
          next();
          const second = parseExpr();
          if (peek().value === ':') {
            next();
            const third = parseExpr();
            expect(']');
            const arr = []; const step = second;
            if (step > 0) for (let v = first; v <= third; v += step) arr.push(Math.round(v * 1e10) / 1e10);
            else if (step < 0) for (let v = first; v >= third; v += step) arr.push(Math.round(v * 1e10) / 1e10);
            return arr;
          }
          expect(']');
          const arr = [];
          if (first <= second) for (let v = first; v <= second; v++) arr.push(v);
          else for (let v = first; v >= second; v--) arr.push(v);
          return arr;
        }
        const arr = [first];
        while (match(',')) { if (peek().value === ']') break; arr.push(parseExpr()); }
        expect(']');
        return arr;
      }

      // String literal
      if (t.type === 'string') { next(); return t.value.slice(1, -1); }

      // Function call (math builtins)
      if (mathFns[t.value] && tokens[ti + 1]?.value === '(') {
        next(); expect('(');
        const args = [];
        if (peek().value !== ')') { args.push(parseExpr()); while (match(',')) args.push(parseExpr()); }
        expect(')');
        return mathFns[t.value](...args);
      }

      // Variable
      if (t.type === 'ident') {
        next();
        if (variables[t.value] !== undefined) return variables[t.value];
        return 0;
      }

      // Fallback
      if (t.type !== 'eof') next();
      return 0;
    }

    // ── Argument list parser ──
    function parseArgs() {
      expect('(');
      const named = {};
      const positional = [];
      if (peek().value !== ')') {
        const parseOneArg = () => {
          // Named arg: ident = expr (peek ahead to check for = but NOT ==)
          if ((peek().type === 'ident' || peek().value?.startsWith('$')) && tokens[ti + 1]?.value === '=') {
            const name = next().value; next(); // eat =
            named[name] = parseExpr();
          } else {
            positional.push(parseExpr());
          }
        };
        parseOneArg();
        while (match(',')) { if (peek().value === ')') break; parseOneArg(); }
      }
      expect(')');
      return { named, positional };
    }

    function getColor() { return palette[objectId % palette.length]; }

    // ── Statement parser ──
    function parseStatement(transform) {
      if (!transform) transform = { translate:[0,0,0], rotate:[0,0,0], scale:[1,1,1], color:null };
      const t = peek();
      if (t.type === 'eof') return;

      // Variable assignment
      if (t.type === 'ident' && !BUILTINS.has(t.value) && tokens[ti + 1]?.value === '=') {
        const name = next().value; next();
        variables[name] = parseExpr();
        match(';'); return;
      }

      // Echo
      if (t.value === 'echo') {
        next(); expect('(');
        const parts = [];
        if (peek().value !== ')') { parts.push(parseExpr()); while (match(',')) parts.push(parseExpr()); }
        expect(')'); match(';');
        logs.push('ECHO: ' + parts.map(p => typeof p === 'object' && p != null ? JSON.stringify(p) : String(p)).join(', '));
        return;
      }

      // Let
      if (t.value === 'let') {
        next(); expect('(');
        while (peek().value !== ')' && peek().type !== 'eof') {
          const vn = next().value; expect('=');
          variables[vn] = parseExpr(); match(',');
        }
        expect(')'); parseBody(transform); return;
      }

      // For loop
      if (t.value === 'for') {
        next(); expect('(');
        const varName = next().value; expect('=');
        const range = parseExpr();
        expect(')');
        if (Array.isArray(range)) {
          const bodyStart = ti;
          for (let idx = 0; idx < range.length; idx++) {
            ti = bodyStart;
            variables[varName] = range[idx];
            parseBody({ ...transform });
          }
        } else { parseBody(transform); }
        return;
      }

      // If/else
      if (t.value === 'if') {
        next(); expect('('); const cond = parseExpr(); expect(')');
        if (cond) { parseBody(transform); if (peek().value === 'else') { next(); skipBody(); } }
        else { skipBody(); if (peek().value === 'else') { next(); parseBody(transform); } }
        return;
      }

      // Transforms
      if (t.value === 'translate') {
        next(); const { positional, named } = parseArgs();
        const v = named.v || positional[0] || [0,0,0];
        parseBody({ ...transform, translate: [transform.translate[0]+(v[0]||0), transform.translate[1]+(v[1]||0), transform.translate[2]+(v[2]||0)] });
        return;
      }
      if (t.value === 'rotate') {
        next(); const { positional, named } = parseArgs();
        const v = named.a || positional[0] || [0,0,0];
        const deg = Array.isArray(v) ? v : [0,0,v];
        parseBody({ ...transform, rotate: [transform.rotate[0]+(deg[0]||0), transform.rotate[1]+(deg[1]||0), transform.rotate[2]+(deg[2]||0)] });
        return;
      }
      if (t.value === 'scale') {
        next(); const { positional, named } = parseArgs();
        const v = named.v || positional[0] || [1,1,1];
        const sv = typeof v === 'number' ? [v,v,v] : v;
        parseBody({ ...transform, scale: [transform.scale[0]*(sv[0]||1), transform.scale[1]*(sv[1]||1), transform.scale[2]*(sv[2]||1)] });
        return;
      }
      if (t.value === 'color') {
        next(); const { positional } = parseArgs();
        let c = positional[0] || '#4fc3f7';
        if (Array.isArray(c)) c = `rgb(${Math.round((c[0]||0)*255)},${Math.round((c[1]||0)*255)},${Math.round((c[2]||0)*255)})`;
        parseBody({ ...transform, color: c });
        return;
      }
      if (t.value === 'mirror') { next(); parseArgs(); parseBody(transform); return; }

      // Boolean / CSG
      if (['union','difference','intersection','hull','minkowski','render'].includes(t.value)) {
        next();
        if (peek().value === '(') { next(); while (peek().value !== ')' && peek().type !== 'eof') next(); match(')'); }
        parseBody(transform); return;
      }

      // Extrude
      if (t.value === 'linear_extrude' || t.value === 'rotate_extrude') {
        next(); parseArgs(); parseBody(transform); return;
      }

      // ── Primitives ──
      if (t.value === 'cube') {
        next(); const { positional, named } = parseArgs();
        let size = named.size || positional[0] || 1;
        if (typeof size === 'number') size = [size, size, size];
        objects.push({ type:'cube', size, center: named.center ?? false, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }
      if (t.value === 'sphere') {
        next(); const { positional, named } = parseArgs();
        const r = named.r ?? (named.d != null ? named.d / 2 : null) ?? positional[0] ?? 1;
        objects.push({ type:'sphere', r, fn: named['$fn'] || 32, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }
      if (t.value === 'cylinder') {
        next(); const { positional, named } = parseArgs();
        const h = named.h ?? positional[0] ?? 1;
        const baseR = named.r ?? (named.d != null ? named.d / 2 : null) ?? 1;
        const r1 = named.r1 ?? (named.d1 != null ? named.d1 / 2 : null) ?? baseR;
        const r2 = named.r2 ?? (named.d2 != null ? named.d2 / 2 : null) ?? baseR;
        objects.push({ type:'cylinder', h, r1, r2, center: named.center ?? false, fn: named['$fn'] || 32, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }
      if (t.value === 'text') {
        next(); const { positional, named } = parseArgs();
        const txt = named.text || positional[0] || "Hello";
        const sz = named.size || 10;
        logs.push(`TEXT: "${txt}" (size=${sz})`);
        objects.push({ type:'text', text:txt, textSize:sz, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }

      // Module def (skip)
      if (t.value === 'module') {
        next(); const name = next().value;
        expect('('); let d = 1; while (d > 0 && peek().type !== 'eof') { if (peek().value === '(') d++; if (peek().value === ')') d--; if (d > 0) next(); } next();
        skipBody();
        warnings.push(`Module '${name}' defined (custom modules not yet supported)`);
        return;
      }
      // Function def (skip)
      if (t.value === 'function') {
        next(); next(); expect('('); while (peek().value !== ')' && peek().type !== 'eof') next(); expect(')'); expect('='); parseExpr(); match(';');
        return;
      }

      if (t.value === ';') { next(); return; }
      if (t.type !== 'eof') next();
    }

    function parseBody(transform) {
      if (peek().value === '{') {
        next();
        while (peek().value !== '}' && peek().type !== 'eof') parseStatement(transform);
        match('}');
      } else {
        parseStatement(transform);
      }
    }

    function skipBody() {
      if (peek().value === '{') {
        next(); let d = 1;
        while (d > 0 && peek().type !== 'eof') { const v = next().value; if (v === '{') d++; if (v === '}') d--; }
      } else {
        let d = 0;
        while (peek().type !== 'eof') {
          const v = peek().value;
          if (v === '(') d++;
          if (v === ')') d--;
          if (v === '{') { skipBody(); return; }
          if (v === ';' && d <= 0) { next(); return; }
          next();
        }
      }
    }

    while (peek().type !== 'eof') parseStatement();

  } catch (e) {
    errors.push(e.message);
  }

  return { objects, logs, errors, warnings, variables };
}

// ─── 3D RENDERER ─────────────────────────────────────────────────────
function useThreeRenderer(canvasRef, objects, viewSettings, resetViewSignal = 0) {
  const frameRef = useRef(null);
  const mouseRef = useRef({ down: false, button: -1, x: 0, y: 0, theta: 0.8, phi: 0.6, dist: 50 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1b26');

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    const m = mouseRef.current;
    if (resetViewSignal > 0) {
      Object.assign(m, { theta: 0.8, phi: 0.6, dist: 50, down: false, button: -1 });
    }
    const updateCam = () => {
      camera.position.set(
        m.dist * Math.sin(m.theta) * Math.cos(m.phi),
        m.dist * Math.sin(m.phi),
        m.dist * Math.cos(m.theta) * Math.cos(m.phi)
      );
      camera.lookAt(0, 0, 0);
    };
    updateCam();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
    d1.position.set(30, 50, 30); d1.castShadow = true; scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x88aaff, 0.3);
    d2.position.set(-20, 30, -20); scene.add(d2);

    if (viewSettings.grid) scene.add(new THREE.GridHelper(100, 20, 0x333355, 0x222244));
    if (viewSettings.axes) scene.add(new THREE.AxesHelper(15));

    for (const obj of objects) {
      let geometry;
      const matColor = new THREE.Color(obj.color);
      const material = new THREE.MeshPhysicalMaterial({
        color: matColor, metalness: 0.1, roughness: 0.4,
        clearcoat: 0.3, clearcoatRoughness: 0.25, transparent: true, opacity: 0.92,
      });

      switch (obj.type) {
        case 'cube': geometry = new THREE.BoxGeometry(obj.size[0], obj.size[2], obj.size[1]); break;
        case 'sphere': geometry = new THREE.SphereGeometry(obj.r, Math.min(obj.fn, 64), Math.min(obj.fn / 2, 32)); break;
        case 'cylinder': geometry = new THREE.CylinderGeometry(obj.r2, obj.r1, obj.h, Math.min(obj.fn, 64)); break;
        case 'text': geometry = new THREE.BoxGeometry(obj.textSize * String(obj.text).length * 0.6, obj.textSize, obj.textSize * 0.2); break;
        default: continue;
      }

      const mesh = new THREE.Mesh(geometry, material);
      if (obj.type === 'cube' && !obj.center) mesh.position.set(obj.size[0] / 2, obj.size[2] / 2, obj.size[1] / 2);
      if (obj.type === 'cylinder' && !obj.center) mesh.position.y = obj.h / 2;

      mesh.scale.set(obj.scale[0], obj.scale[2], obj.scale[1]);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(obj.rotate[0]),
        THREE.MathUtils.degToRad(obj.rotate[2]),
        THREE.MathUtils.degToRad(obj.rotate[1])
      );
      mesh.position.x += obj.translate[0];
      mesh.position.y += obj.translate[2];
      mesh.position.z += obj.translate[1];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      if (viewSettings.wireframe) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: matColor.clone().multiplyScalar(0.6), transparent: true, opacity: 0.4 })
        );
        edges.position.copy(mesh.position);
        edges.rotation.copy(mesh.rotation);
        edges.scale.copy(mesh.scale);
        scene.add(edges);
      }
    }

    function animate() { frameRef.current = requestAnimationFrame(animate); renderer.render(scene, camera); }
    animate();

    const onDown = (e) => { m.down = true; m.button = e.button; m.x = e.clientX; m.y = e.clientY; };
    const onUp = () => { m.down = false; };
    const onMove = (e) => {
      if (!m.down) return;
      const dx = e.clientX - m.x, dy = e.clientY - m.y;
      m.x = e.clientX; m.y = e.clientY;
      m.theta -= dx * 0.01;
      m.phi = Math.max(-1.5, Math.min(1.5, m.phi + dy * 0.01));
      updateCam();
    };
    const onWheel = (e) => {
      e.preventDefault();
      m.dist = Math.max(5, Math.min(200, m.dist + e.deltaY * 0.05));
      updateCam();
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    const onResize = () => {
      if (!canvas.parentElement) return;
      const w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 50);

    return () => {
      cancelAnimationFrame(frameRef.current); renderer.dispose();
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }, [objects, viewSettings, resetViewSignal]);
}

// ─── SYNTAX HIGHLIGHTER (preserves whitespace for overlay) ──────────
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

// ─── CODE EDITOR COMPONENT ──────────────────────────────────────────
function CodeEditor({ code, onChange, onUndo, onRedo }) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const lineRef = useRef(null);

  const lines = code.split('\n');

  const handleScroll = (e) => {
    if (highlightRef.current) { highlightRef.current.scrollTop = e.target.scrollTop; highlightRef.current.scrollLeft = e.target.scrollLeft; }
    if (lineRef.current) { lineRef.current.scrollTop = e.target.scrollTop; }
  };

  const handleKeyDown = (e) => {
    const mod = e.metaKey || e.ctrlKey;
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
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const nc = code.substring(0, start) + '  ' + code.substring(end);
      onChange(nc);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
    }
  };

  const font = "'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace";

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', fontFamily: font, fontSize: '13px', lineHeight: '20px' }}>
      <div ref={lineRef} style={{ width: '48px', minWidth: '48px', background: '#1e1f2e', color: '#4a4b6a', textAlign: 'right', padding: '12px 8px 12px 0', overflow: 'hidden', userSelect: 'none', borderRight: '1px solid #2a2b3d' }}>
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
}

// ─── EXAMPLES ────────────────────────────────────────────────────────
const EXAMPLES = {
  "Welcome": `// Welcome to Forge3D
// A modern parametric 3D modeler

base_w = 30;
base_d = 20;
base_h = 3;
pillar_r = 2;
pillar_h = 15;
dome_r = 4;

// Base plate
color("#4fc3f7")
  cube([base_w, base_d, base_h], center=true);

// Four pillars
for (x = [0:1])
  for (y = [0:1])
    translate([(x * 2 - 1) * base_w / 3, (y * 2 - 1) * base_d / 3, base_h / 2])
      color("#81c784")
        cylinder(h=pillar_h, r=pillar_r, $fn=24);

// Dome caps
for (x = [0:1])
  for (y = [0:1])
    translate([(x * 2 - 1) * base_w / 3, (y * 2 - 1) * base_d / 3, base_h / 2 + pillar_h])
      color("#ffb74d")
        sphere(r=dome_r, $fn=32);

// Center spire
translate([0, 0, base_h / 2])
  color("#e57373")
    cylinder(h=pillar_h + 8, r1=3, r2=0.5, $fn=6);

echo("Model built: base + 4 pillars + 4 domes + spire");`,

  "Gears": `// Parametric Gear
teeth = 16;
tooth_r = 20;
inner_r = 15;
hub_r = 6;
thickness = 5;
res = 48;

// Outer ring
color("#4fc3f7")
  cylinder(h=thickness, r=tooth_r, center=true, $fn=32);

// Hub
color("#e57373")
  cylinder(h=thickness + 2, r=hub_r, center=true, $fn=res);

// Spokes
for (i = [0:5])
  rotate([0, 0, i * 60])
    translate([inner_r / 2 + 2, 0, 0])
      color("#81c784")
        cube([inner_r - 4, 2, thickness], center=true);

// Tooth markers
for (i = [0:15])
  rotate([0, 0, i * 360 / teeth])
    translate([tooth_r, 0, 0])
      color("#ffb74d")
        cylinder(h=thickness + 1, r=1.5, center=true, $fn=6);

echo("Gear: ", teeth, " teeth");`,

  "Chess Pawn": `// Parametric Chess Pawn
base_r = 10;
base_h = 3;
body_h = 15;
neck_h = 2;
head_r = 5;

// Base
color("#e0e0e0")
  cylinder(h=base_h, r1=base_r, r2=base_r - 1, $fn=48);

// Base rim
color("#bdbdbd")
  translate([0, 0, base_h])
    cylinder(h=1.5, r1=base_r - 1, r2=8, $fn=48);

// Body
color("#f5f5f5")
  translate([0, 0, base_h + 1.5])
    cylinder(h=body_h, r1=8, r2=4, $fn=48);

// Neck collar
color("#e0e0e0")
  translate([0, 0, base_h + 1.5 + body_h])
    cylinder(h=neck_h, r1=4, r2=3, $fn=48);

// Neck
color("#f5f5f5")
  translate([0, 0, base_h + 1.5 + body_h + neck_h])
    cylinder(h=3, r=3, $fn=48);

// Head
color("#fafafa")
  translate([0, 0, base_h + 1.5 + body_h + neck_h + 3 + head_r * 0.5])
    sphere(r=head_r, $fn=48);

echo("Chess pawn generated");`,

  "Snowflake": `// Parametric Snowflake
arms = 6;
arm_len = 25;
arm_w = 2;
branch_len = 10;
branch_w = 1.5;
th = 2;

// Center hub
color("#81d4fa")
  cylinder(h=th, r=4, center=true, $fn=6);

// Main arms
for (i = [0:5])
  rotate([0, 0, i * 60])
    translate([arm_len / 2, 0, 0])
      color("#4fc3f7")
        cube([arm_len, arm_w, th], center=true);

// Inner branches
for (i = [0:5])
  rotate([0, 0, i * 60]) {
    translate([10, 0, 0])
      rotate([0, 0, 45])
        translate([branch_len / 2, 0, 0])
          color("#29b6f6")
            cube([branch_len, branch_w, th], center=true);
    translate([10, 0, 0])
      rotate([0, 0, -45])
        translate([branch_len / 2, 0, 0])
          color("#29b6f6")
            cube([branch_len, branch_w, th], center=true);
  }

// Outer branches
for (i = [0:5])
  rotate([0, 0, i * 60]) {
    translate([18, 0, 0])
      rotate([0, 0, 45])
        translate([3, 0, 0])
          color("#03a9f4")
            cube([6, 1.2, th], center=true);
    translate([18, 0, 0])
      rotate([0, 0, -45])
        translate([3, 0, 0])
          color("#03a9f4")
            cube([6, 1.2, th], center=true);
  }

// Tips
for (i = [0:5])
  rotate([0, 0, i * 60])
    translate([arm_len, 0, 0])
      color("#0288d1")
        sphere(r=1.5, $fn=12);

echo("Snowflake with ", arms, " arms");`,

  "Tower": `// Parametric Tower Stack
levels = 8;
base_size = 24;
shrink = 0.85;
height = 4;
gap = 1;

for (i = [0:7]) {
  s = base_size * pow(shrink, i);
  translate([0, 0, i * (height + gap)])
    color("#4fc3f7")
      cube([s, s, height], center=true);
}

// Top sphere
translate([0, 0, levels * (height + gap)])
  color("#fff176")
    sphere(r=3, $fn=32);

echo("Tower with ", levels, " levels");`,

  "Molecule": `// Simple Molecule
bond_len = 12;
atom_r = 3;
bond_r = 0.8;

// Center atom
color("#e57373")
  sphere(r=atom_r + 1, $fn=32);

// Ring atoms + bonds
for (i = [0:5]) {
  a = i * 60;
  dx = bond_len * cos(a);
  dy = bond_len * sin(a);

  translate([dx / 2, dy / 2, 0])
    rotate([0, 0, a])
      color("#90a4ae")
        cube([bond_len, bond_r * 2, bond_r * 2], center=true);

  translate([dx, dy, 0])
    color("#4fc3f7")
      sphere(r=atom_r, $fn=24);
}

// Top + bottom atoms
translate([0, 0, bond_len])
  color("#81c784")
    sphere(r=atom_r, $fn=24);
translate([0, 0, 0 - bond_len])
  color("#81c784")
    sphere(r=atom_r, $fn=24);

// Vertical bonds
translate([0, 0, bond_len / 2])
  color("#90a4ae")
    cylinder(h=bond_len, r=bond_r, center=true, $fn=12);
translate([0, 0, 0 - bond_len / 2])
  color("#90a4ae")
    cylinder(h=bond_len, r=bond_r, center=true, $fn=12);

echo("Molecule: 8 atoms, 8 bonds");`,

  "Castle": `// Mini Castle
wall_h = 20;
wall_w = 40;
wall_t = 3;
tower_r = 5;
tower_h = 28;

// Walls
color("#8d6e63")
  translate([0, 0 - wall_w / 2, 0])
    cube([wall_w, wall_t, wall_h]);
color("#8d6e63")
  translate([0, wall_w / 2 - wall_t, 0])
    cube([wall_w, wall_t, wall_h]);
color("#a1887f")
  translate([0, 0 - wall_w / 2, 0])
    cube([wall_t, wall_w, wall_h]);
color("#a1887f")
  translate([wall_w - wall_t, 0 - wall_w / 2, 0])
    cube([wall_t, wall_w, wall_h]);

// Corner towers + caps
for (x = [0:1])
  for (y = [0:1]) {
    translate([x * wall_w, y * wall_w - wall_w / 2, 0])
      color("#6d4c41")
        cylinder(h=tower_h, r=tower_r, $fn=24);
    translate([x * wall_w, y * wall_w - wall_w / 2, tower_h])
      color("#e57373")
        cylinder(h=6, r1=tower_r + 1, r2=0, $fn=24);
  }

// Gate
color("#4e342e")
  translate([wall_w / 2 - 4, 0 - wall_w / 2 - 0.5, 0])
    cube([8, wall_t + 1, 12]);

echo("Castle with 4 towers");`,
};

// ─── MAIN APP ────────────────────────────────────────────────────────
const STORAGE_KEY = 'forge3d.workspace.v1';
const DEFAULT_FILE_NAME = 'main.scad';

function getDefaultWorkspace() {
  return {
    code: EXAMPLES["Welcome"],
    viewSettings: { grid: true, axes: true, wireframe: true },
    autoRun: true,
    currentFileName: DEFAULT_FILE_NAME,
  };
}

function loadWorkspace() {
  if (typeof window === 'undefined') return getDefaultWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultWorkspace();
    const parsed = JSON.parse(raw);
    return { ...getDefaultWorkspace(), ...parsed, viewSettings: { ...getDefaultWorkspace().viewSettings, ...(parsed.viewSettings || {}) } };
  } catch {
    return getDefaultWorkspace();
  }
}

function downloadTextFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function openBrowserFile() {
  return await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.scad,.txt,text/plain';
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return resolve(null);
      resolve({
        name: file.name,
        content: await file.text(),
      });
    };
    input.click();
  });
}

function createHistoryState(initialCode) {
  return {
    past: [],
    present: initialCode,
    future: [],
  };
}

export default function Forge3D() {
  const initialWorkspace = useMemo(() => loadWorkspace(), []);
  const [history, setHistory] = useState(() => createHistoryState(initialWorkspace.code));
  const code = history.present;
  const [result, setResult] = useState({ objects: [], logs: [], errors: [], warnings: [], variables: {} });
  const [activeTab, setActiveTab] = useState('console');
  const [viewSettings, setViewSettings] = useState(initialWorkspace.viewSettings);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('examples');
  const [autoRun, setAutoRun] = useState(initialWorkspace.autoRun);
  const [buildTime, setBuildTime] = useState(0);
  const [currentFileName, setCurrentFileName] = useState(initialWorkspace.currentFileName || DEFAULT_FILE_NAME);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [lastSavedCode, setLastSavedCode] = useState(initialWorkspace.code);
  const [statusMessage, setStatusMessage] = useState('Workspace restored');
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  const applyCodeChange = useCallback((nextCodeOrUpdater) => {
    setHistory((current) => {
      const nextCode = typeof nextCodeOrUpdater === 'function'
        ? nextCodeOrUpdater(current.present)
        : nextCodeOrUpdater;

      if (nextCode === current.present) return current;

      return {
        past: [...current.past, current.present].slice(-100),
        present: nextCode,
        future: [],
      };
    });
  }, []);

  const replaceCodeWithoutHistory = useCallback((nextCode) => {
    setHistory(createHistoryState(nextCode));
  }, []);

  const undoCode = useCallback(() => {
    let changed = false;
    setHistory((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      changed = true;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
    if (changed) setStatusMessage('Undo applied');
  }, []);

  const redoCode = useCallback(() => {
    let changed = false;
    setHistory((current) => {
      if (current.future.length === 0) return current;
      const [next, ...rest] = current.future;
      changed = true;
      return {
        past: [...current.past, current.present].slice(-100),
        present: next,
        future: rest,
      };
    });
    if (changed) setStatusMessage('Redo applied');
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const isDirty = code !== lastSavedCode;

  const runCode = useCallback(() => {
    const start = performance.now();
    const r = interpret(code);
    setBuildTime(Math.round(performance.now() - start));
    setResult(r);
    setActiveTab(r.errors.length > 0 || r.warnings.length > 0 ? 'errors' : 'console');
  }, [code]);

  const resetWorkspace = useCallback(() => {
    const next = getDefaultWorkspace();
    replaceCodeWithoutHistory(next.code);
    setLastSavedCode(next.code);
    setCurrentFileName(DEFAULT_FILE_NAME);
    setCurrentFilePath(null);
    setStatusMessage('Started a new workspace');
  }, [replaceCodeWithoutHistory]);

  const openFile = useCallback(async () => {
    try {
      const payload = window.forgeAPI?.openFile ? await window.forgeAPI.openFile() : await openBrowserFile();
      if (!payload) return;
      replaceCodeWithoutHistory(payload.content);
      setLastSavedCode(payload.content);
      setCurrentFileName(payload.name || DEFAULT_FILE_NAME);
      setCurrentFilePath(payload.filePath || null);
      setStatusMessage(`Opened ${payload.name || DEFAULT_FILE_NAME}`);
    } catch (error) {
      setStatusMessage(`Open failed: ${error.message}`);
    }
  }, [replaceCodeWithoutHistory]);

  const saveFile = useCallback(async () => {
    try {
      const suggestedName = currentFileName?.endsWith('.scad') ? currentFileName : `${currentFileName || 'model'}.scad`;
      if (window.forgeAPI?.saveFile) {
        const saved = await window.forgeAPI.saveFile({ content: code, filePath: currentFilePath, suggestedName });
        if (!saved) return;
        setCurrentFileName(saved.name || suggestedName);
        setCurrentFilePath(saved.filePath || null);
      } else {
        downloadTextFile(suggestedName, code);
        setCurrentFileName(suggestedName);
      }
      setLastSavedCode(code);
      setStatusMessage(`Saved ${suggestedName}`);
    } catch (error) {
      setStatusMessage(`Save failed: ${error.message}`);
    }
  }, [code, currentFileName, currentFilePath]);

  useEffect(() => {
    if (!autoRun) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runCode, 400);
    return () => clearTimeout(timerRef.current);
  }, [code, autoRun, runCode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, viewSettings, autoRun, currentFileName }));
  }, [code, viewSettings, autoRun, currentFileName]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoCode();
        else undoCode();
        return;
      }
      if (mod && !event.altKey && event.key.toLowerCase() === 'y') { event.preventDefault(); redoCode(); return; }
      if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); saveFile(); }
      if (mod && event.key.toLowerCase() === 'o') { event.preventDefault(); openFile(); }
      if (mod && event.key.toLowerCase() === 'n') { event.preventDefault(); resetWorkspace(); }
      if (event.key === 'F5' || (event.shiftKey && event.key === 'Enter')) { event.preventDefault(); runCode(); }
    };

    const removeMenu = window.forgeAPI?.onMenuAction?.((action) => {
      if (action === 'new-file') resetWorkspace();
      if (action === 'open-file') openFile();
      if (action === 'save-file') saveFile();
    });

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      removeMenu?.();
    };
  }, [openFile, redoCode, resetWorkspace, runCode, saveFile, undoCode]);

  useThreeRenderer(canvasRef, result.objects, viewSettings, resetViewSignal);

  const varEntries = Object.entries(result.variables).filter(([, v]) => typeof v === 'number');

  const BtnStyle = (active) => ({
    background: active ? '#4fc3f733' : '#1a1b2ecc',
    border: `1px solid ${active ? '#4fc3f7' : '#2a2b3d'}`,
    color: active ? '#4fc3f7' : '#6a6b8a',
    padding: '5px 8px', borderRadius: '5px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
    backdropFilter: 'blur(8px)',
  });

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#13141f', color: '#c8c9db', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", overflow: 'hidden' }}>

      <div style={{ height: '42px', minHeight: '42px', background: 'linear-gradient(180deg,#1e1f30,#181924)', borderBottom: '1px solid #2a2b3d', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg,#4fc3f7,#7c4dff)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Cube /></div>
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>
              <span style={{ color: '#4fc3f7' }}>FORGE</span><span style={{ color: '#7c4dff' }}>3D</span>
            </span>
            <span style={{ fontSize: '10px', color: '#5c5d7a', marginLeft: '4px' }}>v2.2</span>
          </div>
          <div style={{ height: '20px', width: '1px', background: '#2a2b3d' }} />
          {[
            { icon: Icons.File, label: 'New', action: resetWorkspace },
            { icon: Icons.File, label: 'Open', action: openFile },
            { icon: Icons.File, label: 'Save', action: saveFile },
            { icon: Icons.Undo, label: 'Undo', action: undoCode, disabled: !canUndo, title: 'Undo (Ctrl/Cmd+Z)' },
            { icon: Icons.Redo, label: 'Redo', action: redoCode, disabled: !canRedo, title: 'Redo (Ctrl/Cmd+Shift+Z / Ctrl+Y)' },
          ].map(({ icon: I, label, action, disabled, title }) => (
            <button key={label} onClick={action} title={title || label} disabled={disabled}
              style={{ background: 'none', border: '1px solid transparent', color: disabled ? '#4f5068' : '#8a8baa', padding: '4px 8px', borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', opacity: disabled ? 0.55 : 1 }}
              onMouseEnter={e => { if (!disabled) Object.assign(e.currentTarget.style, { background: '#2a2b40', borderColor: '#3a3b55', color: '#c8c9db' }); }}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'none', borderColor: 'transparent', color: disabled ? '#4f5068' : '#8a8baa' })}
            ><I /><span>{label}</span></button>
          ))}
          <div style={{ height: '20px', width: '1px', background: '#2a2b3d' }} />
          {[
            { icon: Icons.Cube, label: 'Cube', s: "cube([10,10,10], center=true);" },
            { icon: Icons.Sphere, label: 'Sphere', s: "sphere(r=5, $fn=32);" },
            { icon: Icons.Cylinder, label: 'Cylinder', s: "cylinder(h=10, r=5, $fn=32);" },
          ].map(({ icon: I, label, s }) => (
            <button key={label} onClick={() => applyCodeChange(c => `${c}\n${s}\n`)} title={`Insert ${label}`}
              style={{ background: 'none', border: '1px solid transparent', color: '#8a8baa', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { background: '#2a2b40', borderColor: '#3a3b55', color: '#c8c9db' })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'none', borderColor: 'transparent', color: '#8a8baa' })}
            ><I /><span>{label}</span></button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setResetViewSignal(v => v + 1)} style={{ background: '#1a1b2ecc', border: '1px solid #2a2b3d', color: '#c8c9db', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Reset View</button>
          <button onClick={runCode} style={{ background: 'linear-gradient(135deg,#4fc3f7,#4dd0e1)', border: 'none', color: '#111', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}><Icons.Play /> Build</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6a6b8a', cursor: 'pointer' }}>
            <input type='checkbox' checked={autoRun} onChange={e => setAutoRun(e.target.checked)} style={{ accentColor: '#4fc3f7' }} />Auto
          </label>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {sidebarOpen && (
          <div style={{ width: '220px', minWidth: '220px', background: '#16172a', borderRight: '1px solid #2a2b3d', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #2a2b3d' }}>
              {['examples', 'params'].map(tab => (
                <button key={tab} onClick={() => setSidebarTab(tab)}
                  style={{ flex: 1, padding: '8px', background: sidebarTab === tab ? '#1e1f30' : 'transparent', border: 'none', borderBottom: sidebarTab === tab ? '2px solid #4fc3f7' : '2px solid transparent', color: sidebarTab === tab ? '#4fc3f7' : '#6a6b8a', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >{tab === 'examples' ? '📂 Examples' : '⚙ Params'}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {sidebarTab === 'examples' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(EXAMPLES).map(([name, exampleCode]) => (
                    <button key={name} onClick={() => { replaceCodeWithoutHistory(exampleCode); setLastSavedCode(exampleCode); setCurrentFileName(`${name.toLowerCase().replace(/\s+/g, '-')}.scad`); setCurrentFilePath(null); setStatusMessage(`Loaded example: ${name}`); }}
                      style={{ background: '#1e1f30', border: '1px solid #2a2b3d', color: '#c8c9db', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                      onMouseEnter={e => Object.assign(e.currentTarget.style, { background: '#252640', borderColor: '#4fc3f7' })}
                      onMouseLeave={e => Object.assign(e.currentTarget.style, { background: '#1e1f30', borderColor: '#2a2b3d' })}
                    ><Icons.File />{name}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {varEntries.length === 0 ? (
                    <div style={{ color: '#5c5d7a', fontSize: '11px', padding: '8px', textAlign: 'center' }}>Define variables in code to see interactive sliders here.</div>
                  ) : varEntries.map(([name, value]) => (
                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#e5c07b', fontFamily: 'monospace' }}>{name}</span>
                        <span style={{ color: '#6a6b8a' }}>{Number.isInteger(value) ? value : value.toFixed(2)}</span>
                      </div>
                      <input type='range' min={0} max={Math.max(value * 3, 50)} step={value > 10 ? 1 : 0.1} value={value}
                        onChange={e => { const nv = parseFloat(e.target.value); applyCodeChange(c => c.replace(new RegExp(`(${name}\s*=\s*)[\d.]+`), `$1${nv}`)); }}
                        style={{ width: '100%', accentColor: '#4fc3f7', height: '4px' }}
                      />
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #2a2b3d', paddingTop: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#5c5d7a', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>View</div>
                    {['grid','axes','wireframe'].map(key => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8a8baa', cursor: 'pointer', padding: '3px 0' }}>
                        <input type='checkbox' checked={viewSettings[key]} onChange={e => setViewSettings(s => ({ ...s, [key]: e.target.checked }))} style={{ accentColor: '#4fc3f7' }} />
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={() => setSidebarOpen(o => !o)} style={{ width: '20px', minWidth: '20px', background: '#1a1b2e', border: 'none', borderRight: '1px solid #2a2b3d', color: '#5c5d7a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '10px' }}>{sidebarOpen ? '◀' : '▶'}</button>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2b3d' }}>
          <div style={{ height: '30px', minHeight: '30px', background: '#1a1b2e', borderBottom: '1px solid #2a2b3d', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '8px' }}>
            <Icons.File /><span style={{ fontSize: '12px', color: '#8a8baa' }}>{currentFileName}{isDirty ? ' *' : ''}</span>
            <span style={{ fontSize: '10px', color: canUndo || canRedo ? '#4fc3f7' : '#3a3b55', background: canUndo || canRedo ? '#4fc3f722' : 'transparent', border: canUndo || canRedo ? '1px solid #4fc3f744' : '1px solid transparent', borderRadius: '999px', padding: '2px 6px' }}>{history.past.length} undo · {history.future.length} redo</span>
            <span style={{ fontSize: '10px', color: '#3a3b55', marginLeft: 'auto' }}>{code.split("\n").length} lines</span>
          </div>
          <div style={{ flex: 1, background: '#1a1b2e', overflow: 'hidden' }}>
            <CodeEditor code={code} onChange={applyCodeChange} onUndo={undoCode} onRedo={redoCode} />
          </div>

          <div style={{ height: '180px', minHeight: '100px', borderTop: '1px solid #2a2b3d', display: 'flex', flexDirection: 'column', background: '#16172a' }}>
            <div style={{ height: '30px', minHeight: '30px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #2a2b3d', padding: '0 8px', gap: '2px' }}>
              {[{ id: 'console', label: 'Console', count: result.logs.length }, { id: 'errors', label: 'Problems', count: result.errors.length + result.warnings.length }].map(({ id, label, count }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  style={{ background: activeTab === id ? '#1e1f30' : 'transparent', border: 'none', borderBottom: activeTab === id ? '2px solid #4fc3f7' : '2px solid transparent', color: activeTab === id ? '#c8c9db' : '#6a6b8a', cursor: 'pointer', padding: '5px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >{label}{count > 0 && <span style={{ background: id === 'errors' && result.errors.length > 0 ? '#e5737344' : '#4fc3f744', color: id === 'errors' && result.errors.length > 0 ? '#e57373' : '#4fc3f7', borderRadius: '8px', padding: '0 5px', fontSize: '10px', fontWeight: 700 }}>{count}</span>}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#5c5d7a' }}>
                <Icons.Zap /><span>{buildTime}ms</span><span>·</span><span>{result.objects.length} obj</span>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', lineHeight: '18px' }}>
              {activeTab === 'console' && (<><div style={{ color: '#5c5d7a', marginBottom: '6px' }}>{statusMessage}</div>{result.logs.length === 0 && <div style={{ color: '#3a3b55' }}>// Console output appears here...</div>}{result.logs.map((log, i) => (<div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '2px 0', color: '#81c784' }}><span style={{ color: '#4a4b6a', minWidth: '16px' }}><Icons.ChevRight /></span><span>{log}</span></div>))}</>)}
              {activeTab === 'errors' && (<>{result.errors.length === 0 && result.warnings.length === 0 && <div style={{ color: '#81c784' }}>✓ No problems detected</div>}{result.errors.map((e, i) => <div key={`e${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '3px 0', color: '#e57373' }}><Icons.Err /><span>{e}</span></div>)}{result.warnings.map((w, i) => <div key={`w${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '3px 0', color: '#ffb74d' }}><Icons.Warn /><span>{w}</span></div>)}</>)}
            </div>
          </div>
        </div>

        <div style={{ flex: 1.3, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', background: '#1a1b26' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '4px' }}>
            {[{ icon: Icons.Grid, key: 'grid', label: 'Grid' }, { icon: Icons.Layers, key: 'axes', label: 'Axes' }, { icon: Icons.Eye, key: 'wireframe', label: 'Edges' }].map(({ icon: I, key, label }) => (
              <button key={key} title={label} onClick={() => setViewSettings(s => ({ ...s, [key]: !s[key] }))} style={BtnStyle(viewSettings[key])}><I /></button>
            ))}
          </div>

          <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 10, background: '#13141fcc', borderRadius: '6px', padding: '6px 10px', fontSize: '10px', color: '#5c5d7a', backdropFilter: 'blur(8px)', border: '1px solid #2a2b3d', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>Orbit: LMB</span><span>Build: Shift+Enter</span><span>Undo: Ctrl/Cmd+Z</span><span>Redo: Ctrl+Y</span><span>Objects: {result.objects.length}</span>
          </div>

          {result.objects.length > 0 && (
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: '#16172acc', borderRadius: '8px', padding: '8px', fontSize: '11px', backdropFilter: 'blur(8px)', border: '1px solid #2a2b3d', maxHeight: '200px', overflow: 'auto', minWidth: '140px' }}>
              <div style={{ fontSize: '10px', color: '#5c5d7a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Scene Tree</div>
              {result.objects.map((obj, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0', color: '#8a8baa' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: obj.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{obj.type}</span>
                </div>
              ))}
            </div>
          )}

          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>

      <div style={{ height: '24px', minHeight: '24px', background: result.errors.length > 0 ? '#e57373' : '#4fc3f7', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '16px', fontSize: '11px', color: '#111', fontWeight: 500, transition: 'background 0.3s' }}>
        <span>{result.errors.length === 0 ? (isDirty ? '● Unsaved changes' : '✓ Saved / synced') : `✗ ${result.errors.length} error(s)`}</span>
        <span>{result.objects.length} objects</span>
        <span>{code.split("\n").length} lines</span>
        <span>{currentFilePath ? currentFilePath : currentFileName}</span>
        <span style={{ marginLeft: 'auto' }}>Forge3D — Parametric 3D Modeling</span>
      </div>
    </div>
  );
}
