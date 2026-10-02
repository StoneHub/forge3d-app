import { createAssemblyGeometryFromDesignGeometry } from './assembly.js';

// Paths are deliberately compared exactly: an ambiguous source must never replace
// an existing part. Unsaved documents need a session identity, not a shared null path.
export function isAssemblyRenderSourceCurrent(source, document) {
  if (source?.kind !== 'active-render' || !document) return false;
  if (source.filePath) return source.filePath === document.filePath;
  return Boolean(source.documentId && source.documentId === document.documentId);
}

export function isCurrentDesignRender({ geometry, renderMeta, document, building = false }) {
  return Boolean(geometry && !building && document?.documentId
    && renderMeta?.documentId === document.documentId
    && (renderMeta?.filePath || null) === (document.filePath || null)
    && renderMeta?.sourceCode === document.sourceCode);
}

export function getAssemblyRefreshBlockReason(part, context) {
  if (!part || part.source?.kind !== 'active-render') return 'Select a current-render Assembly part to refresh';
  if (part.locked) return `Unlock ${part.name} before refreshing it`;
  if (!isAssemblyRenderSourceCurrent(part.source, context.document)) {
    return 'Open the original source design before refreshing this Assembly part';
  }
  if (context.building) return 'Wait for the current design build to finish before refreshing';
  if (!isCurrentDesignRender(context)) return 'Build the current design before refreshing this Assembly part';
  return null;
}

export function refreshAssemblyPartFromRender(part, context) {
  if (getAssemblyRefreshBlockReason(part, context)) return part;
  return {
    ...part,
    geometry: createAssemblyGeometryFromDesignGeometry(context.geometry),
    // Once an unsaved design has been saved and rebuilt, retain its durable source
    // so this refreshed snapshot remains refreshable after a scene/app reload.
    source: !part.source.filePath && context.document.filePath
      ? { ...part.source, filePath: context.document.filePath }
      : part.source,
    // Preserve placement exactly. Drop to Floor and Center remain explicit actions.
    transform: part.transform,
  };
}
