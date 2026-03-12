// ─── @param Annotation Parser ─────────────────────────────────────────────
// Parses `// @param name = value  // type: number, min: 0, max: 100, step: 0.5`
// from .scad source code and provides utilities to patch values back.

/**
 * Parse all @param annotations from OpenSCAD source code.
 * 
 * Supported annotation format:
 *   // @param name = value          // type: number, min: 0, max: 100, step: 0.5
 *   // @param name = "text"         // type: string
 *   // @param name = "A"            // type: string, options: A,B,C,D
 * 
 * The actual variable assignment (e.g. `name = value;`) should follow the annotation.
 * 
 * @param {string} code - The .scad source code
 * @returns {Array<{name: string, value: any, type: string, min?: number, max?: number, step?: number, options?: string[], line: number}>}
 */
export function parseParams(code) {
  const params = [];
  const lines = code.split('\n');

  // Match: // @param name = value   // optional metadata
  const paramRegex = /^\/\/\s*@param\s+(\w+)\s*=\s*(.+?)(?:\s*\/\/\s*(.*))?$/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(paramRegex);
    if (!match) continue;

    const name = match[1];
    let rawValue = match[2].trim();
    const metaStr = match[3] || '';

    // Parse the value
    let value, type;
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      value = rawValue.slice(1, -1);
      type = 'string';
    } else if (!isNaN(parseFloat(rawValue))) {
      value = parseFloat(rawValue);
      type = 'number';
    } else if (rawValue === 'true' || rawValue === 'false') {
      value = rawValue === 'true';
      type = 'boolean';
    } else {
      value = rawValue;
      type = 'string';
    }

    // Parse metadata: type: number, min: 0, max: 100, step: 0.5, options: A,B,C
    const meta = {};
    if (metaStr) {
      const pairs = metaStr.split(',').map(p => p.trim());
      for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) continue;
        const key = pair.slice(0, colonIdx).trim().toLowerCase();
        const val = pair.slice(colonIdx + 1).trim();
        if (key === 'type') meta.type = val;
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
      name,
      value,
      type,
      line: i + 1, // 1-indexed
      assignmentLine: assignmentLine >= 0 ? assignmentLine + 1 : i + 1,
      ...(meta.min !== undefined && { min: meta.min }),
      ...(meta.max !== undefined && { max: meta.max }),
      ...(meta.step !== undefined && { step: meta.step }),
      ...(meta.options && { options: meta.options }),
    });
  }

  return params;
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
  const params = parseParams(code);
  const param = params.find(p => p.name === paramName);
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
  const assignRegex = new RegExp(`^(\\s*${paramName}\\s*=\\s*)(.+?)(\\s*;.*)$`);
  const match = line.match(assignRegex);
  if (match) {
    lines[lineIdx] = `${match[1]}${formatted}${match[3]}`;
  }

  return lines.join('\n');
}
