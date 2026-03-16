import { getOpenScadDoc } from './openscad-docs.js';

export default function DocsDrawer({ colors, docKey, onClose, onInsertExample, onOpenExternal }) {
  const doc = getOpenScadDoc(docKey);
  if (!doc) return null;

  return (
    <div style={{ position: 'absolute', top: '12px', right: '12px', bottom: '12px', width: '320px', maxWidth: 'calc(100% - 24px)', background: `${colors.bgPanel}f4`, border: `1px solid ${colors.border}`, borderRadius: '14px', boxShadow: '0 18px 40px rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ color: colors.textSoft, fontSize: '15px', fontWeight: 700 }}>{doc.name}()</div>
            <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>{doc.summary}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        <code style={{ display: 'block', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textSoft, fontSize: '11px', lineHeight: 1.5, padding: '10px 11px', marginTop: '12px', whiteSpace: 'pre-wrap' }}>
          {doc.signature}
        </code>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={() => onInsertExample?.(doc.example)} style={{ flex: 1, background: `${colors.accent}22`, border: `1px solid ${colors.accent}`, borderRadius: '10px', color: colors.accent, cursor: 'pointer', fontSize: '12px', fontWeight: 700, padding: '8px 10px' }}>
            Insert Example
          </button>
          <button onClick={() => onOpenExternal?.(doc.url)} style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMuted, cursor: 'pointer', fontSize: '11px', fontWeight: 700, padding: '8px 10px' }}>
            Official Docs
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
        <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
          Arguments
        </div>
        {doc.arguments.length === 0 ? (
          <div style={{ color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>This builtin does not take named parameters in the common case.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {doc.arguments.map((argument) => (
              <div key={argument.name} style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: colors.textSoft, fontSize: '12px', fontWeight: 700 }}>{argument.name}</span>
                  <span style={{ color: colors.accent, fontSize: '11px', fontWeight: 700 }}>{argument.type}</span>
                  {argument.defaultValue && <span style={{ color: colors.textMuted, fontSize: '10px', fontWeight: 700 }}>default {argument.defaultValue}</span>}
                </div>
                <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>
                  {argument.description}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '16px', marginBottom: '8px' }}>
          Example
        </div>
        <pre style={{ margin: 0, background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textSoft, fontSize: '11px', lineHeight: 1.55, padding: '12px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {doc.example}
        </pre>
      </div>
    </div>
  );
}
