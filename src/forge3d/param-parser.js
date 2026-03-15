// ─── @param Annotation Parser ─────────────────────────────────────────────
// Parses `// @param name = value  // type: number, min: 0, max: 100, step: 0.5`
// from .scad source code and provides utilities to patch values back.
//
// ALSO auto-detects top-level variable assignments and treats them as parameters
// with smart defaults based on naming patterns.

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createParamId(name, assignmentLine) {
  return `${name}:${assignmentLine}`;
}

function parseLiteralValue(rawValue) {
  const trimmed = rawValue.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return { value: trimmed.slice(1, -1), type: 'string' };
  }

  if (trimmed === 'true' || trimmed === 'false') {
    return { value: trimmed === 'true', type: 'boolean' };
  }

  if (!Number.isNaN(parseFloat(trimmed))) {
    return { value: parseFloat(trimmed), type: 'number' };
  }

  return { value: trimmed, type: 'string' };
}

function buildLineContexts(code) {
  const lines = code.split('\n');
  const depthAtLineStart = [];
  const sectionByLine = [];

  let braceDepth = 0;
  let inBlockComment = false;
  let inString = false;
  let stringQuote = '';
  let escapeNext = false;
  let currentSection = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    depthAtLineStart[lineIndex] = braceDepth;

    if (trimmed.startsWith('// --- End Forge3D Template:')) {
      sectionByLine[lineIndex] = currentSection;
      currentSection = null;
    } else {
      if (trimmed.startsWith('// --- Forge3D Template:')) {
        currentSection = trimmed
          .replace('// --- Forge3D Template:', '')
          .replace(/---$/, '')
          .trim();
      }
      sectionByLine[lineIndex] = currentSection;
    }

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
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

      if (char === '/' && nextChar === '/') {
        break;
      }

      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        charIndex += 1;
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringQuote = char;
        continue;
      }

      if (char === '{') {
        braceDepth += 1;
      } else if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      }
    }
  }

  return { lines, depthAtLineStart, sectionByLine };
}

/**
 * Parse all @param annotations AND auto-detect top-level variables from OpenSCAD source code.
 *
 * Supported annotation format:
 *   // @param name = value          // type: number, min: 0, max: 100, step: 0.5
 *   // @param name = "text"         // type: string
 *   // @param name = "A"            // type: string, options: A,B,C,D
 *
 * Auto-detection:
 *   - Finds top-level variable assignments anywhere in the file
 *   - Ignores assignments nested inside module/function bodies
 *   - Adds smart min/max based on naming patterns (size, width, height, count, etc.)
 *
 * @param {string} code - The .scad source code
 * @returns {Array<{id: string, name: string, value: any, type: string, min?: number, max?: number, step?: number, options?: string[], line: number, auto?: boolean}>}
 */
export function parseParams(code) {
  const params = [];
  const { lines, sectionByLine } = buildLineContexts(code);

  // Match: // @param name = value   // optional metadata
  const paramRegex = /^\/\/\s*@param\s+(\w+)\s*=\s*(.+?)(?:\s*\/\/\s*(.*))?$/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(paramRegex);
    if (!match) continue;

    const name = match[1];
    const rawValue = match[2].trim();
    const metaStr = match[3] || '';

    // Parse the value
    let { value, type } = parseLiteralValue(rawValue);
    const defaultValue = value;

    // Parse metadata: type: number, min: 0, max: 100, step: 0.5, options: A,B,C
    const meta = {};
    if (metaStr) {
      const pairs = metaStr.split(/,\s*(?=\w+\s*:)/).map(p => p.trim());
      for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) continue;
        const key = pair.slice(0, colonIdx).trim().toLowerCase();
        const val = pair.slice(colonIdx + 1).trim();
        if (key === 'type') meta.type = val;
        else if (key === 'label') meta.label = val;
        else if (key === 'min') meta.min = parseFloat(val);
        else if (key === 'max') meta.max = parseFloat(val);
        else if (key === 'step') meta.step = parseFloat(val);
        else if (key === 'options') meta.options = val.split(/\s*,\s*/);
      }
    }

    // Override type from metadata if present
    if (meta.type) type = meta.type;

    // If options are present, treat as enum
    if (meta.options && meta.options.length > 0) {
      type = 'enum';
    }

    // Find the actual variable assignment line (should be near the annotation)
    let assignmentLine = -1;
    const assignRegex = new RegExp(`^\\s*${name}\\s*=`);
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (assignRegex.test(lines[j])) {
        assignmentLine = j;
        break;
      }
    }

    // Read actual value from the assignment line if found
    if (assignmentLine >= 0) {
      const assignMatch = lines[assignmentLine].match(new RegExp(`^(\\s*${name}\\s*=\\s*)(.+?)(\\s*;.*)?$`));
      if (assignMatch) {
        const actualRaw = assignMatch[2].trim();
        if (type === 'number' && !isNaN(parseFloat(actualRaw))) {
          value = parseFloat(actualRaw);
        } else if (type === 'string' || type === 'enum') {
          if (actualRaw.startsWith('"') && actualRaw.endsWith('"')) {
            value = actualRaw.slice(1, -1);
          }
        } else if (type === 'boolean') {
          value = actualRaw === 'true';
        }
      }
    }

    params.push({
      id: createParamId(name, assignmentLine >= 0 ? assignmentLine + 1 : i + 1),
      name,
      value,
      defaultValue,
      type,
      line: i + 1, // 1-indexed
      assignmentLine: assignmentLine >= 0 ? assignmentLine + 1 : i + 1,
      section: sectionByLine[assignmentLine >= 0 ? assignmentLine : i] || null,
      ...(meta.label && { label: meta.label }),
      ...(meta.min !== undefined && { min: meta.min }),
      ...(meta.max !== undefined && { max: meta.max }),
      ...(meta.step !== undefined && { step: meta.step }),
      ...(meta.options && { options: meta.options }),
    });
  }

  // ─── Auto-detect top-level variables ──────────────────────────────────────
  // Look for variable assignments before first function/module or large comment block
  const autoParams = autoDetectVariables(code, params);
  params.push(...autoParams);

  return params;
}

/**
 * Auto-detect top-level variable assignments and infer parameter metadata.
 * Detects depth-0 assignments anywhere in the file.
 *
 * @param {string} code - The .scad source code
 * @param {Array} existingParams - Already parsed @param annotations to avoid duplicates
 * @returns {Array} Auto-detected parameters
 */
function autoDetectVariables(code, existingParams) {
  const autoParams = [];
  const { lines, depthAtLineStart, sectionByLine } = buildLineContexts(code);
  const existingNames = new Set(existingParams.map(p => p.name));

  // Match: variable = value;
  const assignRegex = /^(\w+)\s*=\s*(.+?)\s*;(?:\s*\/\/\s*(.*))?$/;

  for (let i = 0; i < lines.length; i++) {
    if (depthAtLineStart[i] !== 0) continue;

    const trimmed = lines[i].trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('//')) continue;

    const match = trimmed.match(assignRegex);
    if (!match) continue;

    const name = match[1];
    const rawValue = match[2].trim();
    const inlineComment = match[3]?.trim() || '';

    // Skip if already defined via @param
    if (existingNames.has(name)) continue;

    // Skip special OpenSCAD variables
    if (name.startsWith('$')) continue;

    // Parse value and infer type
    const parsed = parseLiteralValue(rawValue);
    const value = parsed.value;
    const type = parsed.type;

    if (type === 'string' && !(rawValue.startsWith('"') && rawValue.endsWith('"'))) {
      // Skip complex expressions, arrays, and module calls for auto-detect.
      continue;
    }

    // Smart defaults based on naming patterns
    const meta = {
      ...inferMetadataFromName(name, value, type),
      ...inferInlineMetadata(type, inlineComment),
    };

    autoParams.push({
      id: createParamId(name, i + 1),
      name,
      value,
      type: meta.options ? 'enum' : type,
      line: i + 1,
      assignmentLine: i + 1,
      section: sectionByLine[i] || null,
      auto: true, // Mark as auto-detected
      ...meta,
    });
  }

  return autoParams;
}

/**
 * Infer smart metadata (min, max, step) based on variable name patterns.
 *
 * @param {string} name - Variable name
 * @param {any} value - Current value
 * @param {string} type - Detected type
 * @returns {Object} Metadata object with min, max, step
 */
function inferMetadataFromName(name, value, type) {
  if (type !== 'number') return {};

  const lowerName = name.toLowerCase();
  const meta = {};

  // Count/levels - typically 1-100
  if (lowerName.match(/^(count|levels?|steps?|segments?|num|n)(_|$)/)) {
    meta.min = 1;
    meta.max = Math.max(value * 3, 50);
    meta.step = 1;
  }
  // Size/dimension values - typically 0-200
  else if (lowerName.match(/(size|width|height|depth|length|radius|diameter|thickness|dist|offset)/)) {
    meta.min = 0;
    meta.max = Math.max(value * 5, 200);
    meta.step = value < 1 ? 0.01 : value < 10 ? 0.1 : 1;
  }
  // Angles - 0-360
  else if (lowerName.match(/(angle|rotation|rot|deg)/)) {
    meta.min = 0;
    meta.max = 360;
    meta.step = 1;
  }
  // Multipliers/scales - 0-5
  else if (lowerName.match(/(scale|factor|mult|ratio|shrink|grow)/)) {
    meta.min = 0;
    meta.max = 5;
    meta.step = 0.01;
  }
  // Gaps/spacing - 0-20
  else if (lowerName.match(/(gap|spacing|padding|margin)/)) {
    meta.min = 0;
    meta.max = 20;
    meta.step = 0.1;
  }
  // Default for other numbers
  else {
    meta.min = 0;
    meta.max = Math.max(value * 3, 100);
    meta.step = value < 1 ? 0.01 : value < 10 ? 0.1 : 1;
  }

  return meta;
}

function inferInlineMetadata(type, inlineComment) {
  if (type !== 'string' || !inlineComment.includes('|')) return {};

  const options = inlineComment
    .split('|')
    .map((option) => option.trim())
    .map((option) => option.replace(/\s*\(.*\)\s*$/, ''))
    .map((option) => option.replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  return options.length >= 2 ? { options } : {};
}

/**
 * Apply a parameter value change to the source code.
 * Updates the actual variable assignment line (not the annotation).
 * 
 * @param {string} code - The .scad source code
 * @param {string} paramName - The variable name to update
 * @param {any} newValue - The new value
 * @returns {string} Updated source code
 */
export function applyParamChange(code, paramName, newValue) {
  const lines = code.split('\n');
  const param = typeof paramName === 'string'
    ? parseParams(code).find((entry) => entry.name === paramName)
    : paramName;
  if (!param) return code;

  // Format the new value
  let formatted;
  if (param.type === 'string' || param.type === 'enum') {
    formatted = `"${newValue}"`;
  } else if (param.type === 'boolean') {
    formatted = String(newValue);
  } else {
    formatted = String(newValue);
  }

  // Find and replace in the assignment line
  const lineIdx = param.assignmentLine - 1;
  const line = lines[lineIdx];
  const assignRegex = new RegExp(`^(\\s*${escapeRegex(param.name)}\\s*=\\s*)(.+?)(\\s*;.*)$`);
  const match = line.match(assignRegex);
  if (match) {
    lines[lineIdx] = `${match[1]}${formatted}${match[3]}`;
  }

  return lines.join('\n');
}
