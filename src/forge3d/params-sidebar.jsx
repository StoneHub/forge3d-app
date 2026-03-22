function stopEvent(event) {
  event.stopPropagation();
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function getSteppedRangeConfig(value) {
  const numericValue = Number(value) || 0;
  const absValue = Math.abs(numericValue);

  if (absValue < 1) return { step: 0.1, span: 1 };
  if (absValue < 10) return { step: 1, span: 10 };
  if (absValue < 100) return { step: 5, span: 50 };
  if (absValue < 500) return { step: 10, span: 100 };
  return { step: 50, span: 500 };
}

function getNumericStep(param) {
  if (!param.auto && isFiniteNumber(param.step) && Number(param.step) > 0) {
    return Number(param.step);
  }
  return getSteppedRangeConfig(param.value).step;
}

function getSliderBounds(param) {
  const value = Number(param.value) || 0;
  const step = getNumericStep(param);
  const explicitMin = !param.auto && isFiniteNumber(param.min) ? Number(param.min) : null;
  const explicitMax = !param.auto && isFiniteNumber(param.max) ? Number(param.max) : null;

  if (explicitMin !== null && explicitMax !== null && explicitMax > explicitMin) {
    return { min: explicitMin, max: explicitMax, step };
  }

  const { span } = getSteppedRangeConfig(value);
  let min = explicitMin ?? (value < 0 ? value - span : Math.max(0, value - span));
  let max = explicitMax ?? (value + span);

  if (value < min) min = value;
  if (value > max) max = value;
  if (max - min < step) max = min + step;

  return { min, max, step };
}

export default function ParamsSidebar({
  colors,
  compact = false,
  onJumpToParam,
  onParamChange,
  onResetParam,
  parsedParams,
  showLineMeta = !compact,
}) {
  const canJump = typeof onJumpToParam === 'function';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '8px' : '6px' }}>
      {parsedParams.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: '12px', padding: '12px 8px', textAlign: 'center', lineHeight: 1.55 }}>
          <div style={{ marginBottom: '8px' }}>No parameters detected.</div>
          <div style={{ fontSize: '11px', color: colors.textMuted, lineHeight: '1.5', marginBottom: '8px' }}>Parameters are auto-detected from top-level variables anywhere in the file, or you can use <code style={{ background: `${colors.accent}22`, padding: '1px 4px', borderRadius: '3px', fontSize: '11px' }}>// @param</code> annotations for more control:</div>
          <pre style={{ textAlign: 'left', fontSize: '10px', marginTop: '8px', padding: '8px', background: colors.bgDarker, borderRadius: '6px', border: `1px solid ${colors.border}`, lineHeight: '1.5', overflow: 'auto', color: colors.textSoft }}>{`// Auto-detected:
size = 10;
height = 20;

// Or annotate for full control:
// @param radius = 5  // min: 1, max: 50, step: 0.5
radius = 5;`}</pre>
        </div>
      ) : (
        parsedParams.map((param) => {
          const sliderBounds = param.type === 'number' ? getSliderBounds(param) : null;

          return (
            <div
            key={param.id || `${param.name}:${param.assignmentLine}`}
            role={canJump ? 'button' : undefined}
            tabIndex={canJump ? 0 : undefined}
            title={canJump ? `Jump to ${param.label || param.name} in code` : undefined}
            onClick={canJump ? () => onJumpToParam(param) : undefined}
            onKeyDown={canJump ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onJumpToParam(param);
              }
            } : undefined}
            style={{
              background: compact ? colors.bgDarker : colors.bgPanel,
              border: `1px solid ${colors.border}`,
              borderRadius: compact ? '10px' : '6px',
              padding: compact ? '10px' : '8px 10px',
              cursor: canJump ? 'pointer' : 'default',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={canJump ? (event) => Object.assign(event.currentTarget.style, { borderColor: colors.accent, background: colors.btnHover }) : undefined}
            onMouseLeave={canJump ? (event) => Object.assign(event.currentTarget.style, { borderColor: colors.border, background: compact ? colors.bgDarker : colors.bgPanel }) : undefined}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: colors.text, marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', minWidth: 0 }}>
                {param.label || param.name}
                {param.auto && <span style={{ fontSize: '8px', background: `${colors.success}22`, color: colors.success, padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }} title="Auto-detected parameter">AUTO</span>}
                {param.section && <span style={{ fontSize: '8px', background: `${colors.accent}22`, color: colors.accent, padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }} title="Parameter source section">{param.section}</span>}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {showLineMeta && (
                  <span style={{ fontSize: '10px', color: colors.accent, background: `${colors.accent}22`, borderRadius: '999px', padding: '1px 6px', fontWeight: 600 }}>
                    line {param.assignmentLine || param.line}
                  </span>
                )}
                <span style={{ fontSize: '10px', color: colors.textMuted, fontWeight: 400 }}>{param.type}</span>
                <button
                  onClick={(event) => {
                    stopEvent(event);
                    onResetParam(param);
                  }}
                  onMouseDown={stopEvent}
                  title="Reset to original value"
                  style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textMuted, cursor: 'pointer', fontSize: '10px', padding: '2px 5px', lineHeight: 1 }}
                >↺</button>
              </div>
            </div>

            {param.type === 'number' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={stopEvent} onMouseDown={stopEvent}>
                <input type="range"
                  min={sliderBounds.min}
                  max={sliderBounds.max}
                  step={sliderBounds.step}
                  value={param.value}
                  onChange={(event) => onParamChange(param, parseFloat(event.target.value))}
                  style={{ flex: 1, accentColor: colors.accent, height: '4px' }}
                />
                <input type="number"
                  value={param.value}
                  min={sliderBounds.min}
                  max={sliderBounds.max}
                  step={sliderBounds.step}
                  onChange={(event) => {
                    const value = parseFloat(event.target.value);
                    if (!Number.isNaN(value)) {
                      onParamChange(param, value);
                    }
                  }}
                  style={{ width: '60px', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}
                />
              </div>
            )}

            {param.type === 'string' && (
              <input type="text"
                value={param.value}
                onChange={(event) => onParamChange(param, event.target.value)}
                onClick={stopEvent}
                onMouseDown={stopEvent}
                style={{ width: '100%', boxSizing: 'border-box', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '4px 6px', fontSize: '11px' }}
              />
            )}

            {param.type === 'enum' && param.options && (
              <select
                value={param.value}
                onChange={(event) => onParamChange(param, event.target.value)}
                onClick={stopEvent}
                onMouseDown={stopEvent}
                style={{ width: '100%', background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.text, padding: '4px 6px', fontSize: '11px' }}
              >
                {param.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            )}

            {param.type === 'boolean' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.text, cursor: 'pointer' }} onClick={stopEvent} onMouseDown={stopEvent}>
                <input type="checkbox"
                  checked={param.value}
                  onChange={(event) => onParamChange(param, event.target.checked)}
                  style={{ accentColor: colors.accent }}
                />
                {param.value ? 'true' : 'false'}
              </label>
            )}
          </div>
          );
        })
      )}
    </div>
  );
}
