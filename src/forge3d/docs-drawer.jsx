import { getOpenScadDoc } from './openscad-docs.js';

function renderBuiltin(colors, reference, onInsertExample, onOpenExternal) {
  const doc = getOpenScadDoc(reference?.word);
  if (!doc) return null;

  return (
    <>
      <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ color: colors.textSoft, fontSize: '15px', fontWeight: 700 }}>{doc.name}()</div>
        <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>{doc.summary}</div>
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
    </>
  );
}

function renderUserSymbol(colors, reference, onJumpToLine) {
  const symbol = reference?.symbol;
  if (!symbol) return null;

  return (
    <>
      <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ color: colors.textSoft, fontSize: '15px', fontWeight: 700 }}>{symbol.name}</div>
        <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>
          User-defined {symbol.kind} from this file.
        </div>
        <code style={{ display: 'block', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textSoft, fontSize: '11px', lineHeight: 1.5, padding: '10px 11px', marginTop: '12px', whiteSpace: 'pre-wrap' }}>
          {symbol.signature || symbol.name}
        </code>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={() => onJumpToLine?.(symbol.startLine)} style={{ flex: 1, background: `${colors.accent}22`, border: `1px solid ${colors.accent}`, borderRadius: '10px', color: colors.accent, cursor: 'pointer', fontSize: '12px', fontWeight: 700, padding: '8px 10px' }}>
            Jump to Line {symbol.startLine}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
        <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
          Definition
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ color: colors.textSoft, fontSize: '12px', fontWeight: 700 }}>Kind</div>
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '4px' }}>{symbol.kind}</div>
          </div>
          <div style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ color: colors.textSoft, fontSize: '12px', fontWeight: 700 }}>Lines</div>
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '4px' }}>
              Defined at line {symbol.startLine}{symbol.endLine > symbol.startLine ? `, ends at line ${symbol.endLine}` : ''}
            </div>
          </div>
          {symbol.params?.length > 0 && (
            <div style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
              <div style={{ color: colors.textSoft, fontSize: '12px', fontWeight: 700 }}>Parameters</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {symbol.params.map((param) => (
                  <div key={param.name} style={{ color: colors.textMuted, fontSize: '11px' }}>
                    {param.name}{param.defaultValue ? ` = ${param.defaultValue}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DocsDrawer({ colors, onClose, onInsertExample, onJumpToLine, onOpenExternal, reference }) {
  if (!reference) return null;

  return (
    <div style={{ position: 'absolute', top: '12px', right: '12px', bottom: '12px', width: '320px', maxWidth: 'calc(100% - 24px)', background: `${colors.bgPanel}f4`, border: `1px solid ${colors.border}`, borderRadius: '14px', boxShadow: '0 18px 40px rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          {reference.type === 'builtin' ? 'Builtin Reference' : 'Definition'}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
      </div>
      {reference.type === 'builtin'
        ? renderBuiltin(colors, reference, onInsertExample, onOpenExternal)
        : renderUserSymbol(colors, reference, onJumpToLine)}
    </div>
  );
}
