import { parseParams } from './param-parser.js';

const SPECIAL_ASSIGNMENT_REGEX = /^\s*(\$\w+)\s*=\s*.+?;\s*(?:\/\/.*)?$/;

function normalizeCode(code = '') {
  return code.replace(/\r\n/g, '\n');
}

function ensureTrailingNewline(code) {
  const trimmed = code.trimEnd();
  return trimmed ? `${trimmed}\n` : '';
}

function cleanCode(code) {
  return normalizeCode(code)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildLineDepths(code) {
  const lines = normalizeCode(code).split('\n');
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

      if (char === '{') {
        braceDepth += 1;
      } else if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      }
    }
  }

  return { lines, depthAtLineStart };
}

function dedupeByName(blocks) {
  const seen = new Set();
  return blocks.filter((block) => {
    if (!block?.name || seen.has(block.name)) return false;
    seen.add(block.name);
    return true;
  });
}

function collectParamBlocks(code) {
  const normalized = normalizeCode(code);
  const lines = normalized.split('\n');
  const params = parseParams(normalized)
    .slice()
    .sort((left, right) => (left.line - right.line) || (left.assignmentLine - right.assignmentLine));

  return dedupeByName(params.map((param) => {
    const startLine = Math.max(1, Math.min(param.line, param.assignmentLine));
    const endLine = Math.max(startLine, Math.max(param.line, param.assignmentLine));
    const text = lines.slice(startLine - 1, endLine).join('\n').trimEnd();
    return {
      name: param.name,
      startLine,
      endLine,
      text,
    };
  }).filter((block) => block.text));
}

function collectSpecialAssignments(code) {
  const { lines, depthAtLineStart } = buildLineDepths(code);
  const blocks = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (depthAtLineStart[lineIndex] !== 0) continue;
    const trimmed = lines[lineIndex].trim();
    const match = trimmed.match(SPECIAL_ASSIGNMENT_REGEX);
    if (!match) continue;
    blocks.push({
      name: match[1],
      startLine: lineIndex + 1,
      endLine: lineIndex + 1,
      text: lines[lineIndex].trimEnd(),
    });
  }

  return dedupeByName(blocks);
}

function removeLineRanges(code, blocks) {
  const lines = normalizeCode(code).split('\n');
  const remove = new Set();

  for (const block of blocks) {
    for (let lineNumber = block.startLine; lineNumber <= block.endLine; lineNumber += 1) {
      remove.add(lineNumber - 1);
    }
  }

  return cleanCode(lines.filter((_, index) => !remove.has(index)).join('\n'));
}

function buildTemplateBody(templateCode, duplicateSpecialBlocks) {
  const templateParamBlocks = collectParamBlocks(templateCode);
  const linesToStrip = [...templateParamBlocks, ...duplicateSpecialBlocks];
  const stripped = removeLineRanges(templateCode, linesToStrip);
  return stripped || cleanCode(templateCode);
}

function buildMarkedTemplateBlock(templateName, content) {
  const trimmedContent = cleanCode(content);
  return cleanCode(`// --- Forge3D Template: ${templateName} ---
${trimmedContent}
// --- End Forge3D Template: ${templateName} ---`);
}

function appendToCode(currentCode, blockText) {
  const trimmedCurrent = normalizeCode(currentCode).trimEnd();
  const trimmedBlock = cleanCode(blockText);
  if (!trimmedCurrent) return ensureTrailingNewline(trimmedBlock);
  return `${trimmedCurrent}\n\n${trimmedBlock}\n`;
}

function buildMergedParts(currentCode, templateCode) {
  const currentParamBlocks = collectParamBlocks(currentCode);
  const currentSpecialBlocks = collectSpecialAssignments(currentCode);
  const templateParamBlocks = collectParamBlocks(templateCode);
  const templateSpecialBlocks = collectSpecialAssignments(templateCode);

  const currentParamNames = new Set(currentParamBlocks.map((block) => block.name));
  const currentSpecialNames = new Set(currentSpecialBlocks.map((block) => block.name));

  const missingParamBlocks = templateParamBlocks.filter((block) => !currentParamNames.has(block.name));
  const missingSpecialBlocks = templateSpecialBlocks.filter((block) => !currentSpecialNames.has(block.name));
  const duplicateSpecialBlocks = templateSpecialBlocks.filter((block) => currentSpecialNames.has(block.name));
  const templateBody = buildTemplateBody(templateCode, duplicateSpecialBlocks);

  return {
    currentParamBlocks,
    currentSpecialBlocks,
    missingParamBlocks,
    missingSpecialBlocks,
    templateBody,
    stats: {
      preservedParamCount: currentParamBlocks.length,
      addedParamCount: missingParamBlocks.length,
      reusedParamCount: templateParamBlocks.length - missingParamBlocks.length,
      preservedSpecialCount: currentSpecialBlocks.length,
      addedSpecialCount: missingSpecialBlocks.length,
      reusedSpecialCount: templateSpecialBlocks.length - missingSpecialBlocks.length,
    },
  };
}

export function prepareTemplateInsertion(template, currentCode, mode = 'append') {
  const templateCode = normalizeCode(template?.code || '');
  const existingCode = normalizeCode(currentCode || '');

  if (!templateCode.trim()) return null;

  if (!existingCode.trim()) {
    return {
      nextCode: ensureTrailingNewline(cleanCode(templateCode)),
      stats: {
        preservedParamCount: 0,
        addedParamCount: collectParamBlocks(templateCode).length,
        reusedParamCount: 0,
        preservedSpecialCount: 0,
        addedSpecialCount: collectSpecialAssignments(templateCode).length,
        reusedSpecialCount: 0,
      },
    };
  }

  const merged = buildMergedParts(existingCode, templateCode);

  if (mode === 'replace') {
    const nextCode = cleanCode([
      ...merged.currentParamBlocks.map((block) => block.text),
      ...merged.missingParamBlocks.map((block) => block.text),
      ...merged.currentSpecialBlocks.map((block) => block.text),
      ...merged.missingSpecialBlocks.map((block) => block.text),
      merged.templateBody,
    ].filter(Boolean).join('\n\n'));

    return {
      nextCode: ensureTrailingNewline(nextCode),
      stats: merged.stats,
    };
  }

  const insertPayload = cleanCode([
    ...merged.missingParamBlocks.map((block) => block.text),
    ...merged.missingSpecialBlocks.map((block) => block.text),
    merged.templateBody,
  ].filter(Boolean).join('\n\n'));

  if (mode === 'cursor') {
    return {
      insertText: ensureTrailingNewline(insertPayload),
      fallbackNextCode: appendToCode(existingCode, buildMarkedTemplateBlock(template.name, insertPayload)),
      stats: merged.stats,
    };
  }

  return {
    nextCode: appendToCode(existingCode, buildMarkedTemplateBlock(template.name, insertPayload)),
    stats: merged.stats,
  };
}
