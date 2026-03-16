export default function StatusBar({ allErrors, building, code, colors, currentFileName, currentFilePath, isDirty, theme, zoomFactor = 1 }) {
  const zoomPercent = `${Math.round((zoomFactor || 1) * 100)}%`;

  return (
    <div style={{ position: 'relative', height: '24px', minHeight: '24px' }}>
      <style>{`@keyframes forge-build-sweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }`}</style>
      {building && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '7px', background: 'rgba(0,0,0,0.22)', overflow: 'hidden', boxShadow: '0 -1px 8px rgba(79,195,247,0.25) inset' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0.32),rgba(255,255,255,0.08))', opacity: 0.45 }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.95),transparent)', animation: 'forge-build-sweep 1.1s linear infinite' }} />
        </div>
      )}
      <div style={{ height: '24px', minHeight: '24px', background: building ? (theme === 'dark' ? '#2a5270' : '#1976d2') : (allErrors.length > 0 ? colors.error : colors.accent), display: 'flex', alignItems: 'center', padding: '0 12px', gap: '16px', fontSize: '12px', color: theme === 'dark' ? '#091119' : '#fff', fontWeight: 700, letterSpacing: '0.1px', transition: 'background 0.3s' }}>
        <span>{building ? 'Rendering in progress...' : allErrors.length === 0 ? (isDirty ? '● Unsaved changes' : '✓ Saved / synced') : `✗ ${allErrors.length} error(s)`}</span>
        <span>{code.split('\n').length} lines</span>
        <span>Zoom {zoomPercent}</span>
        <span>{currentFilePath ? currentFilePath : currentFileName}</span>
        <span style={{ marginLeft: 'auto' }}>Forge3D — OpenSCAD Modeling</span>
      </div>
    </div>
  );
}
