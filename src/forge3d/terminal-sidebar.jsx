import Icons from './icons.jsx';

function renderAction(colors, label, onClick, { accent = false, disabled = false } = {}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: accent ? `${colors.accent}22` : colors.bgPanel,
        border: `1px solid ${accent ? colors.accent : colors.border}`,
        borderRadius: '10px',
        color: accent ? colors.accent : colors.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        opacity: disabled ? 0.55 : 1,
        padding: '9px 10px',
      }}
    >
      {label}
    </button>
  );
}

export default function TerminalSidebar({
  availableShells,
  colors,
  onKill,
  onOpen,
  onPreferredShellChange,
  onRestart,
  onRestartInProject,
  preferredShellId,
  sessionState,
  suggestedProjectPath,
}) {
  const running = sessionState?.status === 'running';
  const selectedShellId = preferredShellId || availableShells[0]?.id || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSoft, fontSize: '13px', fontWeight: 700 }}>
          <Icons.Terminal />
          <span>Integrated Terminal</span>
        </div>
        <div style={{ color: colors.textMuted, fontSize: '12px', lineHeight: 1.55, marginTop: '8px' }}>
          One terminal session stays alive while Forge3D stays open. Switch tabs, browse files, and come back without losing the shell state.
        </div>
      </div>

      <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.textMuted }}>
          Session
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' }}>
          <div style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ color: colors.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
            <div style={{ color: running ? colors.success : sessionState?.status === 'error' ? colors.error : colors.textSoft, fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>
              {running ? 'Running' : sessionState?.status === 'error' ? 'Unavailable' : sessionState?.status === 'exited' ? 'Exited' : 'Ready'}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>
              {sessionState?.shellLabel || 'No shell selected yet'}
            </div>
          </div>

          <div style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ color: colors.textMuted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Working Directory</div>
            <div style={{ color: colors.textSoft, fontSize: '11px', lineHeight: 1.5, marginTop: '5px', wordBreak: 'break-word' }}>
              {sessionState?.cwd || suggestedProjectPath || 'Home directory'}
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Shell
          </span>
          <select
            value={selectedShellId}
            onChange={(event) => onPreferredShellChange?.(event.target.value || null)}
            style={{
              background: colors.bgDarker,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              color: colors.text,
              fontSize: '12px',
              padding: '9px 10px',
            }}
          >
            {availableShells.length === 0 ? (
              <option value="">No shells detected</option>
            ) : (
              availableShells.map((shell) => (
                <option key={shell.id} value={shell.id}>
                  {shell.label}
                </option>
              ))
            )}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
          {renderAction(colors, running ? 'Focus Shell' : 'Open Shell', onOpen, { accent: true, disabled: availableShells.length === 0 })}
          {renderAction(colors, 'Restart', onRestart, { disabled: availableShells.length === 0 })}
          {renderAction(colors, 'Project Folder', onRestartInProject, { disabled: availableShells.length === 0 })}
          {renderAction(colors, 'Stop', onKill, { disabled: !running })}
        </div>

        {sessionState?.error && (
          <div style={{ background: `${colors.error}14`, border: `1px solid ${colors.error}44`, borderRadius: '10px', color: colors.error, fontSize: '11px', lineHeight: 1.5, padding: '10px' }}>
            {sessionState.error}
          </div>
        )}
      </div>
    </div>
  );
}
