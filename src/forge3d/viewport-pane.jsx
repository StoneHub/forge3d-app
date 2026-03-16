import Icons from './icons.jsx';
import ViewportTree from './viewport-tree.jsx';

export default function ViewportPane({
  canvasRef,
  colors,
  hiddenPreviewSymbolIds,
  minViewportWidth,
  onCaptureRender,
  onJumpToSymbol,
  onTogglePreviewSymbol,
  setViewSettings,
  symbols,
  theme,
  viewSettings,
}) {
  const viewportBackground = theme === 'dark'
    ? 'linear-gradient(180deg,#314156 0%, #1a2230 55%, #0c1018 100%)'
    : 'linear-gradient(180deg,#f8fbff 0%, #e6edf5 58%, #d2dbe7 100%)';
  const buttonStyle = (active) => ({
    background: active ? `${colors.accent}33` : `${colors.bgDarker}cc`,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    color: active ? colors.accent : colors.textMuted,
    padding: '5px 8px',
    borderRadius: '5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 700,
    backdropFilter: 'blur(8px)',
  });

  return (
    <div style={{ flex: 1, minWidth: minViewportWidth, display: 'flex', flexDirection: 'column', position: 'relative', background: viewportBackground }}>
      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '4px' }}>
        {[
          { icon: Icons.Grid, key: 'grid', label: 'Grid' },
          { icon: Icons.Layers, key: 'axes', label: 'Axes' },
          { icon: Icons.Eye, key: 'wireframe', label: 'Edges' },
          { icon: Icons.Ruler, key: 'dimensions', label: 'Dimensions' }
        ].map(({ icon: Icon, key, label }) => (
          <button key={key} title={label} onClick={() => setViewSettings(settings => ({ ...settings, [key]: !settings[key] }))} style={buttonStyle(viewSettings[key])}><Icon /></button>
        ))}
        <button title="Capture Render" onClick={() => onCaptureRender?.()} style={buttonStyle(false)}><Icons.Camera /></button>
      </div>

      <ViewportTree
        colors={colors}
        hiddenIds={hiddenPreviewSymbolIds}
        onJumpToSymbol={onJumpToSymbol}
        onToggleSymbol={onTogglePreviewSymbol}
        symbols={symbols}
      />

      <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 10, background: colors.surfaceOverlay || `${colors.bg}dd`, borderRadius: '10px', padding: '8px 11px', fontSize: '11px', color: colors.textMuted, fontWeight: 700, backdropFilter: 'blur(10px)', border: `1px solid ${colors.borderHover}`, boxShadow: theme === 'dark' ? '0 8px 24px rgba(0,0,0,0.24)' : '0 8px 20px rgba(64,80,96,0.14)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <span>Orbit: LMB</span><span>Build: Shift+Enter</span><span>Undo: Ctrl+Z</span><span>Redo: Ctrl+Y</span><span>Zoom: Ctrl+= / - / 0</span>
      </div>

      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
