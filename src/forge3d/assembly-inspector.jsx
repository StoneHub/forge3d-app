import ParamsSidebar from './params-sidebar.jsx';

function NumberField({ colors, disabled = false, label, value, onChange, step = 1 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '10px', color: colors.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </span>
      <input
        disabled={disabled}
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          width: '100%',
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
          background: colors.bgDarker,
          color: disabled ? colors.textFaint : colors.textSoft,
          padding: '8px 10px',
          fontSize: '12px',
          fontWeight: 700,
          outline: 'none',
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.65 : 1,
        }}
      />
    </label>
  );
}

function MetricRow({ colors, label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }}>
      <span style={{ color: colors.textMuted, fontWeight: 700 }}>{label}</span>
      <span style={{ color: colors.textSoft, fontWeight: 800, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function PanelButton({
  colors,
  disabled = false,
  emphasis = 'default',
  label,
  onClick,
}) {
  const borderColor = emphasis === 'accent'
    ? (disabled ? colors.border : colors.accent)
    : emphasis === 'danger'
      ? `${colors.error}44`
      : colors.border;
  const background = emphasis === 'accent'
    ? (disabled ? colors.bgPanel : `${colors.accent}14`)
    : emphasis === 'danger'
      ? `${colors.error}14`
      : colors.bgPanel;
  const color = emphasis === 'accent'
    ? (disabled ? colors.textFaint : colors.accent)
    : emphasis === 'danger'
      ? colors.error
      : (disabled ? colors.textFaint : colors.textSoft);

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        borderRadius: '10px',
        border: `1px solid ${borderColor}`,
        background,
        color,
        padding: '10px 12px',
        fontSize: '12px',
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}

function formatMeasurementStatus(measurement) {
  const points = measurement?.points || [];
  if (measurement?.enabled) {
    if (points.length === 0) return 'Click the first point in the viewport.';
    if (points.length === 1) return 'Click the second point to log the measurement.';
  }
  if (measurement?.history?.length) {
    return `Last logged ${measurement.history[0].distance.toFixed(2)} mm.`;
  }
  return 'Use Pick Points to start a session measurement.';
}

function formatMeasurementPoint(point) {
  const position = point?.position || [0, 0, 0];
  return `${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)} mm`;
}

export default function AssemblyInspector({
  autoRun,
  booleanBusy = false,
  booleanBusyLabel = 'Working...',
  booleanOperandId,
  booleanOperandOptions,
  building,
  canRefreshCurrentRender,
  colors,
  currentFileName,
  measurement,
  metrics,
  onBooleanOperandChange,
  onBooleanRun,
  onBuildCurrentDesign,
  onCenterSelected,
  onClearMeasurementHistory,
  onDropToFloor,
  onMeasurementPrimaryAction,
  onParamChange,
  onRefreshCurrentRender,
  onResetParam,
  onRotationChange,
  onToggleSnap,
  onPositionChange,
  parsedParams,
  part,
  snap,
}) {
  if (!part) {
    return (
      <div style={{ height: '100%', background: colors.bgDarker, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: colors.textMuted, fontSize: '13px', textAlign: 'center', lineHeight: 1.6 }}>
        Select a part in the viewport or parts list to edit transforms, inspect dimensions, and measure spacing.
      </div>
    );
  }

  const position = part.transform?.position || [0, 0, 0];
  const rotation = part.transform?.rotation || [0, 0, 0];
  const partLocked = part.locked === true;
  const measurementPoints = measurement?.points || [];
  const measurementHistory = measurement?.history || [];
  const measurementActionLabel = measurement?.enabled || measurementPoints.length > 0 ? 'Clear Picks' : 'Pick Points';
  const measurementDistance = Number.isFinite(measurement?.distance)
    ? `${measurement.distance.toFixed(2)} mm`
    : measurementHistory.length > 0
      ? `${measurementHistory[0].distance.toFixed(2)} mm`
      : 'No logged measurement yet';
  const sourceLabel = part.source?.kind === 'active-render'
    ? 'Current design render snapshot'
    : part.source?.filePath || part.source?.kind || 'Imported mesh';

  return (
    <div style={{ height: '100%', background: colors.bgDarker, overflow: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: colors.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Selected Part
        </span>
        <div style={{ fontSize: '18px', color: colors.textSoft, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{part.name}</div>
        <div style={{ fontSize: '11px', color: colors.textMuted, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span>{sourceLabel}</span>
          {partLocked && <span style={{ color: colors.warn, fontWeight: 800 }}>Locked for transforms and delete</span>}
        </div>
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: colors.textSoft }}>Transform</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textMuted, fontWeight: 700 }}>
            <input type="checkbox" checked={snap.enabled !== false} onChange={(event) => onToggleSnap(event.target.checked)} style={{ accentColor: colors.accent }} />
            Snap 1mm / 15°
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          <NumberField colors={colors} disabled={partLocked} label="X" onChange={(value) => onPositionChange(0, value)} step={snap.translateStepMm || 1} value={position[0]} />
          <NumberField colors={colors} disabled={partLocked} label="Y" onChange={(value) => onPositionChange(1, value)} step={snap.translateStepMm || 1} value={position[1]} />
          <NumberField colors={colors} disabled={partLocked} label="Z" onChange={(value) => onPositionChange(2, value)} step={snap.translateStepMm || 1} value={position[2]} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          <NumberField colors={colors} disabled={partLocked} label="Rot X" onChange={(value) => onRotationChange(0, value)} step={snap.rotateStepDeg || 15} value={rotation[0]} />
          <NumberField colors={colors} disabled={partLocked} label="Rot Y" onChange={(value) => onRotationChange(1, value)} step={snap.rotateStepDeg || 15} value={rotation[1]} />
          <NumberField colors={colors} disabled={partLocked} label="Rot Z" onChange={(value) => onRotationChange(2, value)} step={snap.rotateStepDeg || 15} value={rotation[2]} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <PanelButton colors={colors} disabled={partLocked} label="Drop to Floor" onClick={onDropToFloor} />
          <PanelButton colors={colors} disabled={partLocked} label="Center Selected" onClick={onCenterSelected} />
        </div>
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: colors.textSoft }}>Measurements</span>
        <MetricRow colors={colors} label="Width" value={`${metrics?.size?.x ?? 0} mm`} />
        <MetricRow colors={colors} label="Height" value={`${metrics?.size?.y ?? 0} mm`} />
        <MetricRow colors={colors} label="Depth" value={`${metrics?.size?.z ?? 0} mm`} />
        <MetricRow colors={colors} label="Floor Distance" value={`${metrics?.floorDistance ?? 0} mm`} />
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: colors.textSoft }}>Measure Tool</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <PanelButton colors={colors} emphasis="accent" label={measurementActionLabel} onClick={onMeasurementPrimaryAction} />
            {measurementHistory.length > 0 && (
              <PanelButton colors={colors} label="Clear Log" onClick={onClearMeasurementHistory} />
            )}
          </div>
        </div>
        <div style={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.55 }}>
          {formatMeasurementStatus(measurement)}
        </div>
        <MetricRow colors={colors} label="Latest Distance" value={measurementDistance} />
        <MetricRow colors={colors} label="Draft Picks" value={`${measurementPoints.length} / 2`} />
        {measurementHistory.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Session Log
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '190px', overflow: 'auto', paddingRight: '4px' }}>
              {measurementHistory.map((entry, index) => (
                <div key={entry.id || `${entry.distance}-${index}`} style={{ border: `1px solid ${colors.border}`, background: colors.bgPanel, borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: colors.textSoft, fontSize: '12px', fontWeight: 800 }}>{entry.distance.toFixed(2)} mm</span>
                    <span style={{ color: colors.textMuted, fontSize: '10px', fontWeight: 700 }}>{entry.label || 'Measurement'}</span>
                  </div>
                  {entry.points?.map((point, pointIndex) => (
                    <div key={`${entry.id || index}-${pointIndex}`} style={{ color: colors.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
                      P{pointIndex + 1}: {formatMeasurementPoint(point)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {part.source?.kind === 'active-render' && (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: colors.textSoft }}>Current Render Snapshot</span>
          <div style={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.6 }}>
            This part is frozen until you explicitly replace it with the latest successful Design render.
          </div>
          <PanelButton
            colors={colors}
            disabled={!canRefreshCurrentRender}
            emphasis="accent"
            label="Replace Selected Part"
            onClick={onRefreshCurrentRender}
          />
        </div>
      )}

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: colors.textSoft }}>Current Design Parameters</span>
          <PanelButton
            colors={colors}
            disabled={building}
            emphasis="accent"
            label={building ? 'Rendering...' : 'Render Latest Design'}
            onClick={onBuildCurrentDesign}
          />
        </div>
        <div style={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.6 }}>
          Edit <span style={{ color: colors.textSoft, fontWeight: 700 }}>{currentFileName}</span> without leaving Assembly. {autoRun ? 'Auto-build is on, so param changes will re-render after a short pause.' : 'Auto-build is off, so click Render Latest Design after changing a value.'}
        </div>
        {parsedParams.length > 0 ? (
          <div style={{ maxHeight: '260px', overflow: 'auto', paddingRight: '4px' }}>
            <ParamsSidebar
              colors={colors}
              compact
              onParamChange={onParamChange}
              onResetParam={onResetParam}
              parsedParams={parsedParams}
              showLineMeta={false}
            />
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.6 }}>
            No top-level OpenSCAD parameters were detected in the current file yet.
          </div>
        )}
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: colors.textSoft }}>Mesh Booleans</span>
        <div style={{ fontSize: '11px', color: colors.textMuted, lineHeight: 1.6 }}>
          Pick another part, then create a derived mesh. The original inputs are kept hidden so you can recover them from the parts list.
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: colors.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Operand
          </span>
          <select
            disabled={booleanBusy || booleanOperandOptions.length === 0}
            onChange={(event) => onBooleanOperandChange(event.target.value || null)}
            value={booleanOperandId || ''}
            style={{
              width: '100%',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              background: colors.bgDarker,
              color: colors.textSoft,
              padding: '8px 10px',
              fontSize: '12px',
              fontWeight: 700,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          >
            {booleanOperandOptions.length === 0 ? (
              <option value="">No other parts available</option>
            ) : (
              booleanOperandOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))
            )}
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          {['union', 'subtract', 'intersect'].map((operation) => (
            <PanelButton
              key={operation}
              colors={colors}
              disabled={booleanBusy || !booleanOperandId}
              label={booleanBusy ? booleanBusyLabel : operation[0].toUpperCase() + operation.slice(1)}
              onClick={() => onBooleanRun(operation)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
