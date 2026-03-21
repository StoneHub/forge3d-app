import Icons from './icons.jsx';

function ToolbarButton({ active = false, colors, disabled, icon: Icon, label, onClick, title }) {
  const restingStyle = {
    background: active ? colors.btnHover : 'none',
    borderColor: active ? colors.borderHover : 'transparent',
    color: disabled ? colors.textFaint : active ? colors.textSoft : colors.textMuted,
  };

  return (
    <button
      onClick={onClick}
      title={title || label}
      disabled={disabled}
      style={{
        border: '1px solid transparent',
        ...restingStyle,
        padding: '4px 8px',
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '12px',
        fontWeight: 600,
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={(event) => {
        if (!disabled) {
          Object.assign(event.currentTarget.style, {
            background: colors.btnHover,
            borderColor: colors.borderHover,
            color: colors.textSoft,
          });
        }
      }}
      onMouseLeave={(event) => {
        Object.assign(event.currentTarget.style, restingStyle);
      }}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}

export default function ForgeToolbar({
  autoRun,
  building,
  canEnterAssembly,
  canRedo,
  canUndo,
  colors,
  mode = 'design',
  onAutoRunChange,
  onCancelBuild,
  onEnterAssemblyMode,
  onExportStl,
  onNewFile,
  onOpenFile,
  onRedo,
  onRenderProfileChange,
  onResetView,
  onReturnToDesignMode,
  onRunCode,
  onSaveFile,
  onThemeToggle,
  onUndo,
  renderProfile = 'quick',
  theme,
}) {
  return (
    <div style={{ height: '42px', minHeight: '42px', background: theme === 'dark' ? 'linear-gradient(180deg,#1e1f30,#181924)' : colors.bgPanel, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '22px', height: '22px', background: colors.logoGlow, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icons.Cube /></div>
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>
            <span style={{ color: colors.accent }}>FORGE</span><span style={{ color: theme === 'dark' ? '#7c4dff' : '#4527a0' }}>3D</span>
          </span>
          <span style={{ fontSize: '10px', color: colors.textMuted, marginLeft: '4px', fontWeight: 700 }}>v3.0</span>
        </div>
        <div style={{ height: '20px', width: '1px', background: colors.border }} />
        <ToolbarButton colors={colors} icon={Icons.File} label="New" onClick={onNewFile} />
        <ToolbarButton colors={colors} icon={Icons.File} label="Open" onClick={onOpenFile} />
        <ToolbarButton colors={colors} icon={Icons.File} label="Save" onClick={onSaveFile} />
        <ToolbarButton colors={colors} icon={Icons.Grid} label={mode === 'assembly' ? 'Export Combined STL' : 'Export STL'} onClick={onExportStl} />
        <ToolbarButton colors={colors} disabled={!canUndo} icon={Icons.Undo} label="Undo" onClick={onUndo} title="Ctrl/Cmd+Z" />
        <ToolbarButton colors={colors} disabled={!canRedo} icon={Icons.Redo} label="Redo" onClick={onRedo} title="Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onThemeToggle} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '12px' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {mode === 'assembly' ? (
          <button onClick={onReturnToDesignMode} style={{ background: `${colors.bgDarker}cc`, border: `1px solid ${colors.border}`, color: colors.textSoft, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Design Mode</button>
        ) : (
          <button
            disabled={!canEnterAssembly}
            onClick={onEnterAssemblyMode}
            style={{
              background: canEnterAssembly ? `${colors.bgDarker}cc` : colors.bgDarker,
              border: `1px solid ${canEnterAssembly ? colors.accent : colors.border}`,
              color: canEnterAssembly ? colors.textSoft : colors.textFaint,
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: canEnterAssembly ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            Assembly Mode
          </button>
        )}
        <button onClick={onResetView} style={{ background: `${colors.bgDarker}cc`, border: `1px solid ${colors.border}`, color: colors.textSoft, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Reset View</button>
        {mode === 'design' && (building ? (
          <button onClick={onCancelBuild} style={{ background: 'linear-gradient(135deg,#e57373,#ef5350)', border: 'none', color: '#fff', padding: '5px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}>⏹ Cancel</button>
        ) : (
          <button onClick={onRunCode} style={{ background: 'linear-gradient(135deg,#4fc3f7,#4dd0e1)', border: 'none', color: '#111', padding: '5px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700 }}><Icons.Play /> Build</button>
        ))}
        {mode === 'design' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textMuted, fontWeight: 600 }}>
            <span>Render</span>
            <select
              value={renderProfile}
              onChange={(event) => onRenderProfileChange?.(event.target.value)}
              style={{
                background: `${colors.bgDarker}cc`,
                border: `1px solid ${colors.border}`,
                color: colors.textSoft,
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 600,
              }}
              title="Quick lowers facet detail for faster iteration. Final uses full code-defined detail."
            >
              <option value="quick">Quick</option>
              <option value="final">Final</option>
            </select>
          </label>
        )}
        {mode === 'design' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textMuted, cursor: 'pointer', fontWeight: 600 }}>
            <input type='checkbox' checked={autoRun} onChange={(event) => onAutoRunChange(event.target.checked)} style={{ accentColor: colors.accent }} />Auto
          </label>
        )}
      </div>
    </div>
  );
}
