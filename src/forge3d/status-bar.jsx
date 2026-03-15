export default function StatusBar({ allErrors, code, colors, currentFileName, currentFilePath, isDirty, theme }) {
  return (
    <div style={{ height: '24px', minHeight: '24px', background: allErrors.length > 0 ? colors.error : colors.accent, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '16px', fontSize: '11px', color: theme === 'dark' ? '#111' : '#fff', fontWeight: 500, transition: 'background 0.3s' }}>
      <span>{allErrors.length === 0 ? (isDirty ? '● Unsaved changes' : '✓ Saved / synced') : `✗ ${allErrors.length} error(s)`}</span>
      <span>{code.split('\n').length} lines</span>
      <span>{currentFilePath ? currentFilePath : currentFileName}</span>
      <span style={{ marginLeft: 'auto' }}>Forge3D — OpenSCAD Modeling</span>
    </div>
  );
}
