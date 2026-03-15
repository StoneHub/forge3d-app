import Icons from './icons.jsx';
import TerminalPane from './terminal.jsx';

export default function BottomPane({ activeTab, allErrors, allWarnings, askAI, buildTime, colors, jumpToLine, onActiveTabChange, result, statusMessage }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colors.bgDark }}>
      <div style={{ height: '30px', minHeight: '30px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, padding: '0 8px', gap: '2px' }}>
        {[
          { id: 'console', label: 'Console', count: result.logs.length },
          { id: 'errors', label: 'Problems', count: allErrors.length + allWarnings.length },
          { id: 'terminal', label: '>_ Terminal', count: 0 }
        ].map(({ id, label, count }) => (
          <button key={id} onClick={() => onActiveTabChange(id)}
            style={{ background: activeTab === id ? colors.bgPanel : 'transparent', border: 'none', borderBottom: activeTab === id ? `2px solid ${colors.accent}` : '2px solid transparent', color: activeTab === id ? colors.text : colors.textMuted, cursor: 'pointer', padding: '5px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
          >{label}{count > 0 && <span style={{ background: id === 'errors' && allErrors.length > 0 ? `${colors.error}44` : `${colors.accent}44`, color: id === 'errors' && allErrors.length > 0 ? colors.error : colors.accent, borderRadius: '8px', padding: '0 5px', fontSize: '10px', fontWeight: 700 }}>{count}</span>}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: colors.textFaint }}>
          {(allErrors.length > 0 || allWarnings.length > 0) && (
            <button onClick={askAI} style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', padding: '3px 9px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>✦</span> Ask AI
            </button>
          )}
          <Icons.Zap /><span>{buildTime}ms</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: activeTab === 'terminal' ? '0' : '8px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', lineHeight: '18px' }}>
        {activeTab === 'console' && (<>{result.logs.length === 0 && <div style={{ color: colors.textFaint, marginBottom: '6px' }}>{statusMessage}</div>}{result.logs.length === 0 && <div style={{ color: colors.borderHover }}>// Console output appears here...</div>}{result.logs.map((log, index) => (<div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '2px 0', color: colors.success }}><span style={{ color: colors.textMuted, minWidth: '16px' }}><Icons.ChevRight /></span><span>{log}</span></div>))}</>)}
        {activeTab === 'errors' && (
          <>
            {allErrors.length === 0 && allWarnings.length === 0 && <div style={{ color: colors.success }}>✓ No problems detected</div>}
            {allErrors.map((rawError, index) => {
              const message = typeof rawError === 'string' ? rawError : (rawError?.message ?? JSON.stringify(rawError));
              const lineMatch = message.match(/line (\d+)/);
              const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : null;
              return (
                <div key={`error-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0', borderBottom: `1px solid ${colors.border}22` }}>
                  <span style={{ color: colors.error, flexShrink: 0, marginTop: '1px' }}><Icons.Err /></span>
                  <span style={{ color: colors.error, flex: 1 }}>{message.replace(/ \(line \d+\)/, '')}</span>
                  {lineNumber && (
                    <button onClick={() => jumpToLine(lineNumber)} style={{ background: `${colors.error}22`, border: `1px solid ${colors.error}44`, borderRadius: '4px', color: colors.error, cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '1px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      line {lineNumber} ↗
                    </button>
                  )}
                </div>
              );
            })}
            {allWarnings.map((rawWarning, index) => {
              const message = typeof rawWarning === 'string' ? rawWarning : (rawWarning?.message ?? JSON.stringify(rawWarning));
              const lineMatch = message.match(/line (\d+)/);
              const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : null;
              return (
                <div key={`warning-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0', borderBottom: `1px solid ${colors.border}22` }}>
                  <span style={{ color: colors.warn, flexShrink: 0, marginTop: '1px' }}><Icons.Warn /></span>
                  <span style={{ color: colors.warn, flex: 1 }}>{message.replace(/ \(line \d+\)/, '')}</span>
                  {lineNumber && (
                    <button onClick={() => jumpToLine(lineNumber)} style={{ background: `${colors.warn}22`, border: `1px solid ${colors.warn}44`, borderRadius: '4px', color: colors.warn, cursor: 'pointer', fontSize: '10px', fontWeight: 700, padding: '1px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      line {lineNumber} ↗
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
        {activeTab === 'terminal' && <TerminalPane colors={colors} />}
      </div>
    </div>
  );
}
