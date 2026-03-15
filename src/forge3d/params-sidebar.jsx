export default function ParamsSidebar({ colors, onParamChange, onResetParam, parsedParams }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {parsedParams.length === 0 ? (
        <div style={{ color: colors.textFaint, fontSize: '11px', padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}>No parameters detected.</div>
          <div style={{ fontSize: '10px', color: colors.textFaint, lineHeight: '1.45', marginBottom: '8px' }}>Parameters are auto-detected from top-level variables, or you can use <code style={{ background: `${colors.accent}22`, padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>// @param</code> annotations for more control:</div>
          <pre style={{ textAlign: 'left', fontSize: '9px', marginTop: '8px', padding: '6px', background: colors.bgDarker, borderRadius: '4px', border: `1px solid ${colors.border}`, lineHeight: '1.4', overflow: 'auto' }}>{`// Auto-detected:
size = 10;
height = 20;

// Or annotate for full control:
// @param radius = 5  // min: 1, max: 50, step: 0.5
radius = 5;`}</pre>
        </div>
      ) : (
        parsedParams.map((param) => (
          <div key={param.name} style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: colors.text, marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {param.name}
                {param.auto && <span style={{ fontSize: '8px', background: `${colors.success}22`, color: colors.success, padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }} title="Auto-detected parameter">AUTO</span>}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: colors.textMuted, fontWeight: 400 }}>{param.type}</span>
                <button
                  onClick={() => onResetParam(param.name)}
                  title="Reset to original value"
                  style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textMuted, cursor: 'pointer', fontSize: '10px', padding: '2px 5px', lineHeight: 1 }}
                >↺</button>
              </div>
            </div>

            {param.type === 'number' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="range"
                  min={param.min ?? 0}
                  max={param.max ?? (param.value * 3 || 100)}
                  step={param.step ?? (param.value < 1 ? 0.01 : param.value < 10 ? 0.1 : 1)}
                  value={param.value}
                  onChange={(event) => onParamChange(param.name, parseFloat(event.target.value))}
                  style={{ flex: 1, accentColor: colors.accent, height: '4px' }}
                />
                <input type="number"
                  value={param.value}
                  min={param.min}
                  max={param.max}
                  step={param.step ?? 0.1}
                  onChange={(event) => {
                    const value = parseFloat(event.target.value);
                    if (!Number.isNaN(value)) {
                      onParamChange(param.name, value);
                    }
                  }}
                  style={{ width: '52px', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '2px 4px', fontSize: '11px', textAlign: 'center' }}
                />
              </div>
            )}

            {param.type === 'string' && (
              <input type="text"
                value={param.value}
                onChange={(event) => onParamChange(param.name, event.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '4px 6px', fontSize: '11px' }}
              />
            )}

            {param.type === 'enum' && param.options && (
              <select
                value={param.value}
                onChange={(event) => onParamChange(param.name, event.target.value)}
                style={{ width: '100%', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '4px 6px', fontSize: '11px' }}
              >
                {param.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            )}

            {param.type === 'boolean' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.text, cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={param.value}
                  onChange={(event) => onParamChange(param.name, event.target.checked)}
                  style={{ accentColor: colors.accent }}
                />
                {param.value ? 'true' : 'false'}
              </label>
            )}
          </div>
        ))
      )}
    </div>
  );
}
