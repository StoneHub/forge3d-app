const KEYWORDS = new Set(['module','function','if','else','for','let','each','include','use','true','false','undef']);
const BUILTINS = new Set(['cube','sphere','cylinder','polyhedron','circle','square','polygon','text','linear_extrude','rotate_extrude','translate','rotate','scale','mirror','multmatrix','color','offset','hull','minkowski','union','difference','intersection','render','projection','surface','import','resize','children','echo','assert','concat','lookup','str','chr','ord','search','version','len','log','ln','pow','sqrt','exp','abs','sign','sin','cos','tan','asin','acos','atan','atan2','floor','ceil','round','min','max','norm','cross','rands','PI']);
const MULTI_OPS = new Set(['==','!=','<=','>=','||','&&']);

function tokenize(code) {
  const tokens = [];
  let i = 0;
  const len = code.length;
  let line = 1, col = 1;
  while (i < len) {
    const ch = code[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') { if (ch !== '\r') col++; i++; continue; }
    if (ch === '\n') { line++; col = 1; i++; continue; }
    if (ch === '/' && code[i + 1] === '/') {
      const s = i; const sLine = line;
      while (i < len && code[i] !== '\n') { i++; col++; }
      tokens.push({ type: 'comment', value: code.slice(s, i), line: sLine, col }); continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const s = i; const sLine = line; i += 2; col += 2;
      while (i < len - 1 && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') { line++; col = 1; } else col++;
        i++;
      }
      i += 2; col += 2;
      tokens.push({ type: 'comment', value: code.slice(s, i), line: sLine, col }); continue;
    }
    if (ch === '"') {
      const s = i; const sLine = line; const sCol = col; i++; col++;
      while (i < len && code[i] !== '"') { if (code[i] === '\\') { i++; col++; } i++; col++; }
      i++; col++;
      tokens.push({ type: 'string', value: code.slice(s, i), line: sLine, col: sCol }); continue;
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      const s = i; const sLine = line; const sCol = col;
      while (i < len && /[a-zA-Z0-9_$]/.test(code[i])) { i++; col++; }
      const w = code.slice(s, i);
      tokens.push({ type: KEYWORDS.has(w) ? 'keyword' : BUILTINS.has(w) ? 'builtin' : 'ident', value: w, line: sLine, col: sCol });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(code[i + 1]))) {
      const s = i; const sLine = line; const sCol = col;
      while (i < len && /[0-9]/.test(code[i])) { i++; col++; }
      if (i < len && code[i] === '.') { i++; col++; while (i < len && /[0-9]/.test(code[i])) { i++; col++; } }
      if (i < len && (code[i] === 'e' || code[i] === 'E')) {
        i++; col++; if (i < len && (code[i] === '+' || code[i] === '-')) { i++; col++; }
        while (i < len && /[0-9]/.test(code[i])) { i++; col++; }
      }
      tokens.push({ type: 'number', value: code.slice(s, i), line: sLine, col: sCol }); continue;
    }
    if (i + 1 < len && MULTI_OPS.has(ch + code[i + 1])) {
      tokens.push({ type: 'punct', value: ch + code[i + 1], line, col }); i += 2; col += 2; continue;
    }
    tokens.push({ type: 'punct', value: ch, line, col }); i++; col++;
  }
  return tokens;
}

const TOKEN_COLORS = {
  keyword: '#c678dd', builtin: '#61afef', string: '#98c379', number: '#d19a66',
  comment: '#5c6370', ident: '#e5c07b', punct: '#abb2bf',
};

// ─── INTERPRETER ─────────────────────────────────────────────────────
const MAX_ITERATIONS = 100000;   // per-build iteration budget
const MAX_OBJECTS = 10000;       // cap output objects
const MAX_CALL_DEPTH = 64;       // recursion limit

function interpret(code) {
  const objects = [];
  const logs = [];
  const errors = [];
  const warnings = [];
  const variables = { '$preview': true }; // global scope — $preview defaults true
  const customModules = {}; // user-defined modules
  const customFunctions = {}; // user-defined functions
  let objectId = 0;
  let iterations = 0;  // safety counter
  let callDepth = 0;   // recursion depth

  const palette = ['#4fc3f7','#81c784','#ffb74d','#e57373','#ba68c8','#4dd0e1','#aed581','#ff8a65','#f06292','#7986cb'];

  function tick() {
    if (++iterations > MAX_ITERATIONS) throw new Error('Iteration limit reached — possible infinite loop');
    if (objects.length > MAX_OBJECTS) throw new Error('Object limit reached — too many primitives');
  }

  try {
    let tokens = tokenize(code).filter(t => t.type !== 'comment');
    let ti = 0;

    function peek() { return tokens[ti] || { type: 'eof', value: '', line: 0, col: 0 }; }
    function next() { return tokens[ti++] || { type: 'eof', value: '', line: 0, col: 0 }; }
    function expect(val) {
      const t = next();
      if (t.value !== val) {
        const loc = t.line ? ` (line ${t.line})` : '';
        throw new Error(`Expected '${val}' got '${t.value}'${loc}`);
      }
      return t;
    }
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
      cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
    };

    // ── Expression parser ──
    function parseExpr(env = variables) { return parseTernary(env); }
    function parseTernary(env) { let l = parseOr(env); if (match('?')) { const t = parseExpr(env); expect(':'); const f = parseExpr(env); return l ? t : f; } return l; }
    function parseOr(env) { let l = parseAnd(env); while (peek().value === '||') { next(); l = l || parseAnd(env); } return l; }
    function parseAnd(env) { let l = parseCmp(env); while (peek().value === '&&') { next(); l = l && parseCmp(env); } return l; }
    function parseCmp(env) {
      let l = parseAdd(env);
      const ops = new Set(['<','>','<=','>=','==','!=']);
      while (ops.has(peek().value)) { const o = next().value; const r = parseAdd(env); l = o==='<'?l<r:o==='>'?l>r:o==='<='?l<=r:o==='>='?l>=r:o==='=='?l==r:l!=r; }
      return l;
    }
    function parseAdd(env) { let l = parseMul(env); while (peek().value === '+' || peek().value === '-') { const o = next().value; const r = parseMul(env); l = o === '+' ? (Array.isArray(l) && Array.isArray(r) ? l.map((v,i) => v + (r[i]||0)) : l + r) : (Array.isArray(l) && Array.isArray(r) ? l.map((v,i) => v - (r[i]||0)) : l - r); } return l; }
    function parseMul(env) { let l = parseUnary(env); while (peek().value === '*' || peek().value === '/' || peek().value === '%') { const o = next().value; const r = parseUnary(env); l = o === '*' ? l * r : o === '/' ? l / r : l % r; } return l; }
    function parseUnary(env) { if (peek().value === '-') { next(); return -parseUnary(env); } if (peek().value === '!') { next(); return !parseUnary(env); } return parsePostfix(env); }

    function parsePostfix(env) {
      let l = parsePrimary(env);
      while (peek().value === '[') {
        next();
        const idx = parseExpr(env);
        expect(']');
        if (Array.isArray(l) && typeof idx === 'number') l = l[Math.floor(idx)];
        else if (typeof l === 'string' && typeof idx === 'number') l = l.charAt(Math.floor(idx));
        else l = undefined;
      }
      return l;
    }

    function parsePrimary(env) {
      const t = peek();
      if (t.type === 'number') { next(); return parseFloat(t.value); }
      if (t.value === 'true') { next(); return true; }
      if (t.value === 'false') { next(); return false; }
      if (t.value === 'undef') { next(); return undefined; }
      if (t.value === 'PI') { next(); return Math.PI; }

      if (t.value === '(') { next(); const v = parseExpr(env); expect(')'); return v; }

      // Array / range / list comprehension
      if (t.value === '[') {
        next();
        if (peek().value === ']') { next(); return []; }

        // List comprehension: [for (var = range) expr] or [for (var = range) each expr]
        if (peek().value === 'for') {
          const result = [];
          const skipComprehensionBody = () => {
            let depth = 0;
            while (peek().type !== 'eof') {
              const v = peek().value;
              if (v === '[' || v === '(') depth++;
              if (v === ']' && depth === 0) break;
              if (v === ']' || v === ')') depth--;
              next();
            }
          };
          const parseFullComprehension = (outerEnv) => {
            if (peek().value === 'for') {
              next(); expect('(');
              // Parse first variable
              const varName = next().value; expect('=');
              const range = parseExpr(outerEnv);
              // Check for comma-separated additional iteration variables
              // e.g. for (r = [0:4], pt = _ring(r, sp)) — means nested iteration
              const extraVars = [];
              while (peek().value === ',' && peek().type !== 'eof') {
                next(); // skip comma
                const ev = next().value; expect('=');
                // Save token position for re-parsing the range expr with each outer iteration
                extraVars.push({ name: ev, rangeStart: ti });
                // Skip past this range expression to find the next comma or ')'
                let depth = 0;
                while (peek().type !== 'eof') {
                  const v = peek().value;
                  if (v === '(' || v === '[') depth++;
                  if (v === ')' && depth === 0) break;
                  if (v === ')' || v === ']') depth--;
                  if (v === ',' && depth === 0) break;
                  next();
                }
              }
              expect(')');

              const iterateNested = (iterEnv, varIdx) => {
                if (varIdx >= extraVars.length) {
                  // All variables bound, parse the body
                  parseFullComprehension(iterEnv);
                  return;
                }
                const ev = extraVars[varIdx];
                const savedTi = ti;
                ti = ev.rangeStart;
                const innerRange = parseExpr(iterEnv);
                const afterRange = ti;
                ti = savedTi;
                if (Array.isArray(innerRange)) {
                  const bodyStart = ti;
                  for (let ci = 0; ci < innerRange.length; ci++) {
                    tick();
                    ti = bodyStart;
                    iterateNested({ ...iterEnv, [ev.name]: innerRange[ci] }, varIdx + 1);
                  }
                }
              };

              if (Array.isArray(range)) {
                const bodyStart = ti;
                for (let ci = 0; ci < range.length; ci++) {
                  tick();
                  ti = bodyStart;
                  const iterEnv = { ...outerEnv, [varName]: range[ci] };
                  if (extraVars.length > 0) iterateNested(iterEnv, 0);
                  else parseFullComprehension(iterEnv);
                }
              } else {
                // skip body
                skipComprehensionBody();
              }
            } else if (peek().value === 'if') {
              next(); expect('(');
              const cond = parseExpr(outerEnv);
              expect(')');
              if (cond) parseFullComprehension(outerEnv);
              else skipComprehensionBody();
            } else if (peek().value === 'let') {
              next(); expect('(');
              const letEnv = { ...outerEnv };
              while (peek().value !== ')' && peek().type !== 'eof') {
                const vn = next().value; expect('=');
                letEnv[vn] = parseExpr(outerEnv); match(',');
              }
              expect(')');
              parseFullComprehension(letEnv);
            } else {
              const eachMode = peek().value === 'each';
              if (eachMode) next();
              const val = parseExpr(outerEnv);
              if (eachMode && Array.isArray(val)) result.push(...val);
              else result.push(val);
            }
          };
          parseFullComprehension(env);
          expect(']');
          return result;
        }

        const first = parseExpr(env);
        if (peek().value === ':') {
          next();
          const second = parseExpr(env);
          if (peek().value === ':') {
            next();
            const third = parseExpr(env);
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
        while (match(',')) { if (peek().value === ']') break; arr.push(parseExpr(env)); }
        expect(']');
        return arr;
      }

      if (t.type === 'string') { next(); return t.value.slice(1, -1); }

      // ── User-defined function call ──
      if (customFunctions[t.value] && tokens[ti + 1]?.value === '(') {
        const fnName = next().value;
        const { positional, named } = parseArgs(env);
        const fn = customFunctions[fnName];
        const fnEnv = { ...variables, ...env };
        fn.params.forEach((param, i) => {
          if (named[param.name] !== undefined) fnEnv[param.name] = named[param.name];
          else if (positional[i] !== undefined) fnEnv[param.name] = positional[i];
          else if (param.default !== null) fnEnv[param.name] = param.default;
        });
        if (++callDepth > MAX_CALL_DEPTH) throw new Error(`Recursion limit reached in function '${fnName}'`);
        const prevTokens = tokens;
        const prevTi = ti;
        tokens = [...fn.exprTokens];
        ti = 0;
        const result = parseExpr(fnEnv);
        tokens = prevTokens;
        ti = prevTi;
        callDepth--;
        return result;
      }

      // Built-in math function call
      if (mathFns[t.value] && tokens[ti + 1]?.value === '(') {
        next(); expect('(');
        const args = [];
        if (peek().value !== ')') { args.push(parseExpr(env)); while (match(',')) args.push(parseExpr(env)); }
        expect(')');
        return mathFns[t.value](...args);
      }

      if (t.type === 'ident') {
        next();
        if (env[t.value] !== undefined) return env[t.value];
        if (variables[t.value] !== undefined) return variables[t.value];
        return 0;
      }

      if (t.type !== 'eof') next();
      return 0;
    }

    // ── Argument list parser ──
    function parseArgs(env) {
      expect('(');
      const named = {};
      const positional = [];
      if (peek().value !== ')') {
        const parseOneArg = () => {
          if ((peek().type === 'ident' || peek().value?.startsWith('$')) && tokens[ti + 1]?.value === '=') {
            const name = next().value; next();
            named[name] = parseExpr(env);
          } else {
            positional.push(parseExpr(env));
          }
        };
        parseOneArg();
        while (match(',')) { if (peek().value === ')') break; parseOneArg(); }
      }
      expect(')');
      return { named, positional };
    }

    function getColor() { return palette[objectId % palette.length]; }

    // ── Module definition parser ──
    function parseModuleDef() {
      next(); // skip 'module'
      const name = next().value;
      expect('(');
      const params = [];
      if (peek().value !== ')') {
        const parseParam = () => {
          const pName = next().value;
          let defValue = null;
          if (match('=')) defValue = parseExpr();
          params.push({ name: pName, default: defValue });
        };
        parseParam();
        while (match(',')) { if (peek().value === ')') break; parseParam(); }
      }
      expect(')');

      const bodyTokens = [];
      if (peek().value === '{') {
        let braces = 0;
        do {
          const t = next();
          bodyTokens.push(t);
          if (t.value === '{') braces++;
          if (t.value === '}') braces--;
        } while (braces > 0 && peek().type !== 'eof');
      } else {
        let d = 0;
        while (peek().type !== 'eof') {
          const t = next();
          bodyTokens.push(t);
          if (t.value === '(') d++;
          if (t.value === ')') d--;
          if (t.value === '{') {
            let braces = 1;
            do {
              const innerT = next();
              bodyTokens.push(innerT);
              if (innerT.value === '{') braces++;
              if (innerT.value === '}') braces--;
            } while (braces > 0 && peek().type !== 'eof');
            break;
          }
          if (t.value === ';' && d <= 0) break;
        }
      }
      customModules[name] = { params, bodyTokens };
      logs.push(`${name}() defined`);
    }

    // ── Function definition parser ──
    function parseFunctionDef() {
      next(); // skip 'function'
      const name = next().value;
      expect('(');
      const params = [];
      if (peek().value !== ')') {
        const parseParam = () => {
          const pName = next().value;
          let defValue = null;
          if (match('=')) defValue = parseExpr();
          params.push({ name: pName, default: defValue });
        };
        parseParam();
        while (match(',')) { if (peek().value === ')') break; parseParam(); }
      }
      expect(')');
      expect('=');
      // Capture expression tokens up to ';' (respecting nesting depth)
      const exprTokens = [];
      let depth = 0;
      while (peek().type !== 'eof') {
        const tok = peek();
        if (tok.value === '(' || tok.value === '[') depth++;
        if (tok.value === ')' || tok.value === ']') depth--;
        if (tok.value === ';' && depth <= 0) break;
        exprTokens.push(next());
      }
      match(';');
      customFunctions[name] = { params, exprTokens };
      logs.push(`function ${name}() defined`);
    }

    // ── Statement parser ──
    function parseStatement(transform, env = variables) {
      if (!transform) transform = { translate:[0,0,0], rotate:[0,0,0], scale:[1,1,1], color:null, extrude:null };
      const t = peek();
      lastLine = t.line || lastLine;
      if (t.type === 'eof') return;

      // Variable assignment
      if (t.type === 'ident' && !BUILTINS.has(t.value) && !customModules[t.value] && tokens[ti + 1]?.value === '=') {
        const name = next().value; next();
        env[name] = parseExpr(env);
        match(';'); return;
      }

      // Echo
      if (t.value === 'echo') {
        next(); expect('(');
        const parts = [];
        if (peek().value !== ')') { parts.push(parseExpr(env)); while (match(',')) parts.push(parseExpr(env)); }
        expect(')'); match(';');
        logs.push('ECHO: ' + parts.map(p => typeof p === 'object' && p != null ? JSON.stringify(p) : String(p)).join(', '));
        return;
      }

      // Let
      if (t.value === 'let') {
        next(); expect('(');
        const newEnv = { ...env };
        while (peek().value !== ')' && peek().type !== 'eof') {
          const vn = next().value; expect('=');
          newEnv[vn] = parseExpr(env); match(',');
        }
        expect(')'); parseBody(transform, newEnv); return;
      }

      // For loop
      if (t.value === 'for') {
        next(); expect('(');
        const varName = next().value; expect('=');
        const range = parseExpr(env);
        expect(')');
        if (Array.isArray(range)) {
          const bodyStart = ti;
          for (let idx = 0; idx < range.length; idx++) {
            tick();
            ti = bodyStart;
            parseBody({ ...transform }, { ...env, [varName]: range[idx] });
          }
        } else { parseBody(transform, env); }
        return;
      }

      // If/else
      if (t.value === 'if') {
        next(); expect('('); const cond = parseExpr(env); expect(')');
        if (cond) { parseBody(transform, env); if (peek().value === 'else') { next(); skipBody(); } }
        else { skipBody(); if (peek().value === 'else') { next(); parseBody(transform, env); } }
        return;
      }

      // Transforms
      if (t.value === 'translate') {
        next(); const { positional, named } = parseArgs(env);
        const v = named.v || positional[0] || [0,0,0];
        parseBody({ ...transform, translate: [transform.translate[0]+(v[0]||0), transform.translate[1]+(v[1]||0), transform.translate[2]+(v[2]||0)] }, env);
        return;
      }
      if (t.value === 'rotate') {
        next(); const { positional, named } = parseArgs(env);
        const v = named.a || positional[0] || [0,0,0];
        const deg = Array.isArray(v) ? v : [0,0,v];
        parseBody({ ...transform, rotate: [transform.rotate[0]+(deg[0]||0), transform.rotate[1]+(deg[1]||0), transform.rotate[2]+(deg[2]||0)] }, env);
        return;
      }
      if (t.value === 'scale') {
        next(); const { positional, named } = parseArgs(env);
        const v = named.v || positional[0] || [1,1,1];
        const sv = typeof v === 'number' ? [v,v,v] : v;
        parseBody({ ...transform, scale: [transform.scale[0]*(sv[0]||1), transform.scale[1]*(sv[1]||1), transform.scale[2]*(sv[2]||1)] }, env);
        return;
      }
      if (t.value === 'color') {
        next(); const { positional, named } = parseArgs(env);
        let c = named.c || named.color || positional[0] || '#4fc3f7';
        if (Array.isArray(c)) c = `rgb(${Math.round((c[0]||0)*255)},${Math.round((c[1]||0)*255)},${Math.round((c[2]||0)*255)})`;
        else if (typeof c === 'string' && !c.startsWith('#') && !c.startsWith('rgb')) c = c; // named CSS color, pass through
        parseBody({ ...transform, color: c }, env);
        return;
      }
      if (t.value === 'mirror') { next(); parseArgs(env); parseBody(transform, env); return; }
      if (t.value === 'multmatrix') { next(); parseArgs(env); parseBody(transform, env); return; }
      if (t.value === 'resize') { next(); parseArgs(env); parseBody(transform, env); return; }
      if (t.value === 'offset') { next(); parseArgs(env); parseBody(transform, env); return; }

      // Boolean / CSG
      if (['union','difference','intersection','hull','minkowski','render'].includes(t.value)) {
        next();
        if (peek().value === '(') { next(); while (peek().value !== ')' && peek().type !== 'eof') next(); match(')'); }
        parseBody(transform, env); return;
      }

      // ── Extrude operations ──
      if (t.value === 'linear_extrude') {
        next(); const { positional, named } = parseArgs(env);
        const height = named.height ?? named.h ?? positional[0] ?? 1;
        const twist = named.twist ?? 0;
        const scale = named.scale ?? 1;
        const center = named.center ?? false;
        parseBody({ ...transform, extrude: { type: 'linear', height, twist, scale, center } }, env);
        return;
      }
      if (t.value === 'rotate_extrude') {
        next(); const { named } = parseArgs(env);
        const angle = named.angle ?? 360;
        const fn = named['$fn'] || 32;
        parseBody({ ...transform, extrude: { type: 'rotate', angle, fn } }, env);
        return;
      }

      // ── 3D Primitives ──
      if (t.value === 'cube') {
        next(); const { positional, named } = parseArgs(env);
        let size = named.size || positional[0] || 1;
        if (typeof size === 'number') size = [size, size, size];
        objects.push({ type:'cube', size, center: named.center ?? false, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }
      if (t.value === 'sphere') {
        next(); const { positional, named } = parseArgs(env);
        const r = named.r ?? (named.d != null ? named.d / 2 : null) ?? positional[0] ?? 1;
        objects.push({ type:'sphere', r, fn: named['$fn'] || 32, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }
      if (t.value === 'cylinder') {
        next(); const { positional, named } = parseArgs(env);
        const h = named.h ?? positional[0] ?? 1;
        const baseR = named.r ?? (named.d != null ? named.d / 2 : null) ?? 1;
        const r1 = named.r1 ?? (named.d1 != null ? named.d1 / 2 : null) ?? baseR;
        const r2 = named.r2 ?? (named.d2 != null ? named.d2 / 2 : null) ?? baseR;
        objects.push({ type:'cylinder', h, r1, r2, center: named.center ?? false, fn: named['$fn'] || 32, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }
      if (t.value === 'text') {
        next(); const { positional, named } = parseArgs(env);
        const txt = named.text || positional[0] || 'Hello';
        const sz = named.size || 10;
        logs.push(`TEXT: "${txt}" (size=${sz})`);
        objects.push({ type:'text', text:txt, textSize:sz, ...transform, color: transform.color || getColor(), id: objectId++ });
        match(';'); return;
      }

      // ── 2D Primitives ──
      if (t.value === 'polygon') {
        next(); const { positional, named } = parseArgs(env);
        const points = named.points ?? positional[0] ?? [];
        const paths = named.paths ?? positional[1] ?? null;
        if (transform.extrude?.type === 'linear') {
          objects.push({ type: 'polygon_extruded', points, paths, ...transform, color: transform.color || getColor(), id: objectId++ });
        } else {
          // Flat polygon (no extrude) — treat as very thin extrude for visibility
          objects.push({ type: 'polygon_extruded', points, paths, ...transform, extrude: { type:'linear', height: 0.5, twist:0, scale:1, center:false }, color: transform.color || getColor(), id: objectId++ });
        }
        match(';'); return;
      }
      if (t.value === 'circle') {
        next(); const { positional, named } = parseArgs(env);
        const r = named.r ?? (named.d != null ? named.d / 2 : null) ?? positional[0] ?? 1;
        const fn = named['$fn'] || 32;
        if (transform.extrude?.type === 'linear') {
          objects.push({ type: 'circle_extruded', r, fn, ...transform, color: transform.color || getColor(), id: objectId++ });
        } else {
          objects.push({ type: 'circle_extruded', r, fn, ...transform, extrude: { type:'linear', height: 0.5, twist:0, scale:1, center:false }, color: transform.color || getColor(), id: objectId++ });
        }
        match(';'); return;
      }
      if (t.value === 'square') {
        next(); const { positional, named } = parseArgs(env);
        let size = named.size ?? positional[0] ?? 1;
        if (typeof size === 'number') size = [size, size];
        const center = named.center ?? false;
        if (transform.extrude?.type === 'linear') {
          objects.push({ type: 'square_extruded', size, center, ...transform, color: transform.color || getColor(), id: objectId++ });
        } else {
          objects.push({ type: 'square_extruded', size, center, ...transform, extrude: { type:'linear', height: 0.5, twist:0, scale:1, center:false }, color: transform.color || getColor(), id: objectId++ });
        }
        match(';'); return;
      }

      // Module def
      if (t.value === 'module') { parseModuleDef(); return; }

      // Function def
      if (t.value === 'function') { parseFunctionDef(); return; }

      // Custom module call
      if (customModules[t.value]) {
        const modName = next().value;
        const { positional, named } = parseArgs(env);
        const modDef = customModules[modName];

        const modEnv = { ...variables, ...env };
        modDef.params.forEach((param, i) => {
          if (named[param.name] !== undefined) modEnv[param.name] = named[param.name];
          else if (positional[i] !== undefined) modEnv[param.name] = positional[i];
          else if (param.default !== null) modEnv[param.name] = param.default;
        });

        if (++callDepth > MAX_CALL_DEPTH) throw new Error(`Recursion limit reached in module '${modName}'`);
        const previousTokens = tokens;
        const previousTi = ti;
        tokens = [...modDef.bodyTokens];
        ti = 0;
        parseBody(transform, modEnv);
        tokens = previousTokens;
        ti = previousTi;
        callDepth--;

        match(';');
        return;
      }

      if (t.value === ';') { next(); return; }
      if (t.type !== 'eof') next();
    }

    function parseBody(transform, env) {
      if (peek().value === '{') {
        next();
        while (peek().value !== '}' && peek().type !== 'eof') parseStatement(transform, env);
        match('}');
      } else {
        parseStatement(transform, env);
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

    let lastLine = 0;
    while (peek().type !== 'eof') { tick(); parseStatement(undefined, variables); }

  } catch (e) {
    // Enrich message with line number if not already present
    const msg = e.message || String(e);
    const hasLine = /line \d+/.test(msg);
    errors.push(hasLine ? msg : `${msg} (line ${lastLine || '?'})`);
  }

  return { objects, logs, errors, warnings, variables };
}

export { KEYWORDS, BUILTINS, tokenize, TOKEN_COLORS, interpret };
