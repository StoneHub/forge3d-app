import { parseParams } from './param-parser.js';

// Only literal, top-level assignments are safe to change through a parameter
// tool. The UI parser deliberately accepts more expressions for display.
function maskComments(code) {
  let result = '', block = false, line = false, quoted = false, escaped = false;
  for (let i = 0; i < code.length; i++) {
    const char = code[i], next = code[i + 1];
    if (line) {
      if (char === '\n') { line = false; result += char; } else result += ' ';
    } else if (block) {
      if (char === '*' && next === '/') { block = false; result += '  '; i++; }
      else result += char === '\n' ? '\n' : ' ';
    } else if (quoted) {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') { quoted = true; result += char; }
    else if (char === '/' && next === '/') { line = true; result += '  '; i++; }
    else if (char === '/' && next === '*') { block = true; result += '  '; i++; }
    else result += char;
  }
  return result;
}

const LITERAL = /^(?:-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|true|false|"(?:\\.|[^"\\])*")$/i;

export function getMcpParameters(code) {
  const lines = maskComments(code).split('\n');
  let depth = 0;
  const topLevel = lines.map((line) => {
    const isTop = depth === 0;
    const structural = line.replace(/"(?:\\.|[^"\\])*"/g, '');
    for (const char of structural) {
      if (char === '{' || char === '(' || char === '[') depth++;
      if (char === '}' || char === ')' || char === ']') depth--;
    }
    return isTop;
  });
  const metadata = new Map(parseParams(code).map((param) => [param.id, param]));
  return lines.flatMap((line, index) => {
    const match = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*;\s*$/);
    if (!topLevel[index] || !match || !LITERAL.test(match[2])) return [];
    const [, name, raw] = match, id = `${name}:${index + 1}`;
    let value;
    try { value = JSON.parse(raw); } catch {
      // OpenSCAD accepts .5 and 1.; JSON doesn't. Other non-JSON strings are
      // intentionally omitted rather than claiming a safe round-trip.
      if (raw.startsWith('"')) return [];
      value = Number(raw);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) return [];
    const existing = metadata.get(id);
    return [{ ...existing, id, name, assignmentLine: index + 1, line: existing?.line || index + 1,
      value, type: existing?.type === 'enum' ? 'enum' : typeof value }];
  });
}

export function applyMcpParameters(code, values) {
  if (!Array.isArray(values) || !values.length) throw new Error('Provide at least one parameter value.');
  const params = new Map(getMcpParameters(code).map((param) => [param.id, param]));
  const lines = code.split('\n'), seen = new Set();
  for (const { id, value } of values) {
    const param = params.get(id);
    if (!param) throw new Error(`Unknown or non-literal parameter: ${id}`);
    if (seen.has(id)) throw new Error(`Duplicate parameter: ${id}`);
    seen.add(id);
    const expected = param.type === 'enum' ? 'string' : param.type;
    if (typeof value !== expected || (expected === 'number' && !Number.isFinite(value))) {
      throw new Error(`${param.name} requires a finite ${expected} value.`);
    }
    if (param.options && !param.options.includes(value)) throw new Error(`${param.name} must be one of: ${param.options.join(', ')}`);
    if (expected === 'number' && ((Number.isFinite(param.min) && value < param.min) || (Number.isFinite(param.max) && value > param.max))) {
      throw new Error(`${param.name} must be between ${param.min ?? '-infinity'} and ${param.max ?? 'infinity'}.`);
    }
    const index = param.assignmentLine - 1;
    const assignment = lines[index].match(/^(\s*[A-Za-z_]\w*\s*=\s*)("(?:\\.|[^"\\])*"|[^;]+)(\s*;[\s\S]*)$/);
    if (!assignment) throw new Error(`Cannot safely edit parameter: ${id}`);
    lines[index] = `${assignment[1]}${JSON.stringify(value)}${assignment[3]}`;
  }
  return lines.join('\n');
}

export function assertMcpRevision(state, expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== state.revision) {
    throw new Error(`Model changed (current revision ${state.revision}). Read forge3d_get_model before editing.`);
  }
  if (state.building) throw new Error('A render is running. Wait for it to finish before editing.');
  if (state.mode !== 'design') throw new Error('Return to Design mode before editing through MCP.');
}

export function mcpTextResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}
