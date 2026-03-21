import { useRef } from 'react';
import Icons from './icons.jsx';
import TerminalPane from './terminal.jsx';

function getIssueMessage(entry) {
  if (typeof entry === 'string') return entry;
  return entry?.message ?? JSON.stringify(entry);
}

function getIssueLineNumber(entry) {
  if (entry && typeof entry === 'object' && Number.isInteger(entry.lineNumber)) {
    return entry.lineNumber;
  }

  const message = getIssueMessage(entry);
  const lineMatch = String(message).match(/\bline\s+(\d+)\b/i);
  return lineMatch ? Number.parseInt(lineMatch[1], 10) : null;
}

function getIssueDetail(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const parts = [];

  if (entry.detail) {
    parts.push(entry.detail);
  }

  if (entry.excerpt?.lines?.length) {
    const excerpt = entry.excerpt.lines
      .map(({ number, text }) => `${String(number).padStart(4, ' ')} | ${text}`)
      .join('\n');
    parts.push(`Code excerpt:\n${excerpt}`);
  }

  return parts.join('\n\n');
}

export default function BottomPane({
  activeTab,
  allErrors,
  allWarnings,
  askAI,
  buildTime,
  colors,
  jumpToLine,
  onActiveTabChange,
  onEnsureTerminalSession,
  onFocusTerminal,
  result,
  statusMessage,
  terminalFocusToken,
  terminalResetToken,
  terminalState,
}) {
  const terminalPaneRef = useRef(null);

  const panelStyle = (visible, extra = {}) => ({
    position: 'absolute',
    inset: 0,
    overflow: visible ? 'auto' : 'hidden',
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    padding: extra.padding ?? '8px',
    transition: 'opacity 0.12s ease',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: '11px',
    lineHeight: '18px',
    userSelect: visible ? 'text' : 'none',
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colors.bgDark }}>
      <div style={{ height: '30px', minHeight: '30px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, padding: '0 8px', gap: '2px' }}>
        {[
          { id: 'console', label: 'Console', count: result.logs.length },
          { id: 'errors', label: 'Problems', count: allErrors.length + allWarnings.length },
          { id: 'terminal', label: 'Terminal', count: 0 },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => {
              onActiveTabChange(id);
              if (id === 'terminal') onFocusTerminal?.();
            }}
            style={{
              background: activeTab === id ? colors.bgPanel : 'transparent',
              border: 'none',
              borderBottom: activeTab === id ? `2px solid ${colors.accent}` : '2px solid transparent',
              color: activeTab === id ? colors.textSoft : colors.textMuted,
              cursor: 'pointer',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {label}
            {count > 0 && (
              <span style={{ background: id === 'errors' && allErrors.length > 0 ? `${colors.error}44` : `${colors.accent}44`, color: id === 'errors' && allErrors.length > 0 ? colors.error : colors.accent, borderRadius: '8px', padding: '0 5px', fontSize: '10px', fontWeight: 700 }}>
                {count}
              </span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textMuted, fontWeight: 600 }}>
          {(allErrors.length > 0 || allWarnings.length > 0) && (
            <button onClick={askAI} style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', padding: '3px 9px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>✦</span> Ask AI
            </button>
          )}
          <Icons.Zap /><span>{buildTime}ms</span>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={panelStyle(activeTab === 'console')}>
          {result.logs.length === 0 && <div style={{ color: colors.textMuted, marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{statusMessage}</div>}
          {result.logs.length === 0 && <div style={{ color: colors.textFaint }}>// Console output appears here...</div>}
          {result.logs.map((log, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '2px 0', color: colors.success }}>
              <span style={{ color: colors.textMuted, minWidth: '16px' }}><Icons.ChevRight /></span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{log}</span>
            </div>
          ))}
        </div>

        <div style={panelStyle(activeTab === 'errors')}>
          <>
            {allErrors.length === 0 && allWarnings.length === 0 && <div style={{ color: colors.success }}>No problems detected</div>}
            {allErrors.map((rawError, index) => {
              const message = getIssueMessage(rawError);
              const detail = getIssueDetail(rawError);
              const lineNumber = getIssueLineNumber(rawError);
              return (
                <div key={`error-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${colors.border}22` }}>
                  <span style={{ color: colors.error, flexShrink: 0, marginTop: '1px' }}><Icons.Err /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: colors.error, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.replace(/ \(line \d+\)/, '')}</div>
                    {detail && (
                      <pre style={{ margin: '6px 0 0', padding: '8px', background: `${colors.error}12`, border: `1px solid ${colors.error}22`, borderRadius: '8px', color: colors.textSoft, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', lineHeight: 1.5 }}>
                        {detail}
                      </pre>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {lineNumber && (
                      <button onClick={() => jumpToLine(lineNumber)} style={{ background: `${colors.error}22`, border: `1px solid ${colors.error}44`, borderRadius: '4px', color: colors.error, cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        line {lineNumber} ↗
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {allWarnings.map((rawWarning, index) => {
              const message = getIssueMessage(rawWarning);
              const detail = getIssueDetail(rawWarning);
              const lineNumber = getIssueLineNumber(rawWarning);
              return (
                <div key={`warning-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${colors.border}22` }}>
                  <span style={{ color: colors.warn, flexShrink: 0, marginTop: '1px' }}><Icons.Warn /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: colors.warn, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.replace(/ \(line \d+\)/, '')}</div>
                    {detail && (
                      <pre style={{ margin: '6px 0 0', padding: '8px', background: `${colors.warn}12`, border: `1px solid ${colors.warn}22`, borderRadius: '8px', color: colors.textSoft, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', lineHeight: 1.5 }}>
                        {detail}
                      </pre>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {lineNumber && (
                      <button onClick={() => jumpToLine(lineNumber)} style={{ background: `${colors.warn}22`, border: `1px solid ${colors.warn}44`, borderRadius: '4px', color: colors.warn, cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        line {lineNumber} ↗
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        </div>

        <div style={panelStyle(activeTab === 'terminal', { padding: '0' })}>
          <TerminalPane
            ref={terminalPaneRef}
            active={activeTab === 'terminal'}
            colors={colors}
            focusToken={terminalFocusToken}
            onEnsureSession={onEnsureTerminalSession}
            resetToken={terminalResetToken}
            sessionState={terminalState}
          />
        </div>
      </div>
    </div>
  );
}
