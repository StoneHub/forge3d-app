import { useMemo, useState } from 'react';
import Icons from './icons.jsx';

const KIND_LABELS = {
  template: 'Template',
  module: 'Module',
  function: 'Function',
  variable: 'Variable',
};

export default function ViewportTree({ colors, hiddenIds = [], onJumpToSymbol, onToggleSymbol, symbols = [] }) {
  const [open, setOpen] = useState(true);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  if (symbols.length === 0) return null;

  return (
    <div style={{ position: 'absolute', top: '54px', left: '10px', zIndex: 11, width: open ? '280px' : 'auto', background: colors.surfaceOverlay || `${colors.bgDark}ee`, border: `1px solid ${colors.borderHover}`, borderRadius: '12px', backdropFilter: 'blur(12px)', boxShadow: '0 12px 28px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((value) => !value)}
        style={{ width: '100%', background: 'transparent', border: 'none', color: colors.textSoft, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, letterSpacing: '0.3px', padding: '10px 12px' }}
      >
        <span>View Tree</span>
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
          <Icons.ChevRight />
        </span>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflow: 'auto', padding: '10px' }}>
          {symbols.map((symbol) => {
            const hidden = hiddenSet.has(symbol.id);
            const toggleable = symbol.kind === 'template';
            return (
              <div key={symbol.id} style={{ background: colors.bgPanel, border: `1px solid ${hidden ? colors.error : colors.border}`, borderRadius: '10px', padding: '9px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {toggleable ? (
                  <button
                    onClick={() => onToggleSymbol?.(symbol)}
                    title={hidden ? 'Show in preview' : 'Hide from preview'}
                    style={{ background: 'none', border: 'none', color: hidden ? colors.textFaint : colors.accent, cursor: 'pointer', padding: 0, lineHeight: 1, display: 'inline-flex' }}
                  >
                    <Icons.Eye />
                  </button>
                ) : (
                  <span style={{ color: colors.textFaint, display: 'inline-flex' }}>
                    <Icons.File />
                  </span>
                )}

                <button
                  onClick={() => onJumpToSymbol?.(symbol)}
                  style={{ background: 'none', border: 'none', color: colors.textSoft, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, padding: 0, textAlign: 'left' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {symbol.name}
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>
                    {KIND_LABELS[symbol.kind] || symbol.kind} • line {symbol.startLine}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
