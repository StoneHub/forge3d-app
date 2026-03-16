import { useEffect, useMemo, useRef } from 'react';
import { QUICKSTART_LIBRARY } from './quickstart.js';

export default function QuickStartPanel({ anchorRef, colors, onClose, onInsert }) {
  const panelRef = useRef(null);

  const groupedStarters = useMemo(() => QUICKSTART_LIBRARY.reduce((groups, starter) => {
    if (!groups[starter.category]) groups[starter.category] = [];
    groups[starter.category].push(starter);
    return groups;
  }, {}), []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (panelRef.current?.contains(event.target) || anchorRef?.current?.contains(event.target)) {
        return;
      }
      if (!panelRef.current?.contains(event.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: '42px',
        left: '10px',
        right: '10px',
        zIndex: 20,
        maxHeight: '360px',
        overflowY: 'auto',
        background: `${colors.bgPanel}f6`,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
        backdropFilter: 'blur(12px)',
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingBottom: '10px', borderBottom: `1px solid ${colors.border}` }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>Quick Start</div>
          <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>
            Tiny starters for shapes, offsets, booleans, and code scaffolds. Inserts keep existing params when possible.
          </div>
        </div>
        <button
          onClick={() => onClose?.()}
          title="Close quick start"
          style={{
            background: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: '999px',
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: '11px',
            padding: '4px 8px',
          }}
        >
          Esc
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px' }}>
        {Object.entries(groupedStarters).map(([category, starters]) => (
          <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textFaint, padding: '0 2px' }}>
              {category}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
              {starters.map((starter) => (
                <button
                  key={starter.id}
                  onClick={() => onInsert?.(starter)}
                  title={starter.summary}
                  style={{
                    background: colors.bgDarker,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px',
                    color: colors.text,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                    padding: '10px 12px',
                    textAlign: 'left',
                    transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={(event) => Object.assign(event.currentTarget.style, {
                    background: colors.btnHover,
                    borderColor: colors.accent,
                    transform: 'translateY(-1px)',
                  })}
                  onMouseLeave={(event) => Object.assign(event.currentTarget.style, {
                    background: colors.bgDarker,
                    borderColor: colors.border,
                    transform: 'translateY(0)',
                  })}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{starter.name}</span>
                  <span style={{ fontSize: '10px', color: colors.textMuted, lineHeight: 1.45 }}>{starter.summary}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
