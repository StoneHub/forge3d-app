import Icons from './icons.jsx';

export default function ExamplesSidebar({
  colors,
  exampleSearch,
  filteredExamples,
  groupedExamples,
  onClearRecentFiles,
  onExampleSearchChange,
  onLoadExample,
  onOpenRecentFile,
  recentFiles,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {recentFiles.length > 0 && (
        <>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: colors.textFaint, padding: '4px 2px 2px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🕐 Recent</span>
            <button onClick={onClearRecentFiles} style={{ background: 'none', border: 'none', color: colors.textFaint, cursor: 'pointer', fontSize: '9px', padding: '2px 4px' }} title="Clear recent files">✕</button>
          </div>
          {recentFiles.slice(0, 5).map((filePath) => {
            const fileName = filePath.split(/[\\/]/).pop();
            return (
              <button key={filePath} onClick={() => onOpenRecentFile(filePath)} title={filePath}
                style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                onMouseEnter={(event) => Object.assign(event.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                onMouseLeave={(event) => Object.assign(event.currentTarget.style, { background: colors.bgPanel, borderColor: colors.border })}
              >🕐 {fileName}</button>
            );
          })}
          <div style={{ height: '1px', background: colors.border, margin: '4px 0' }} />
        </>
      )}

      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: colors.textFaint, padding: '4px 2px 2px', letterSpacing: '0.5px' }}>Built-in Examples</div>
      <input
        value={exampleSearch}
        onChange={(event) => onExampleSearchChange(event.target.value)}
        placeholder='Search examples...'
        style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '7px 8px', borderRadius: '6px', fontSize: '11px', outline: 'none' }}
      />
      {Object.entries(groupedExamples).map(([category, items]) => (
        <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', color: colors.textFaint, padding: '4px 2px 0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{category}</div>
          {items.map(({ name, code, summary }) => (
            <button key={name} onClick={() => onLoadExample(name, code)}
              title={summary}
              style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', transition: 'all 0.15s' }}
              onMouseEnter={(event) => Object.assign(event.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
              onMouseLeave={(event) => Object.assign(event.currentTarget.style, { background: colors.bgPanel, borderColor: colors.border })}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Icons.File />{name}</span>
              <span style={{ color: colors.textMuted, fontSize: '10px', paddingLeft: '20px' }}>{summary}</span>
            </button>
          ))}
        </div>
      ))}
      {filteredExamples.length === 0 && (
        <div style={{ color: colors.textFaint, fontSize: '11px', padding: '8px', textAlign: 'center' }}>No examples match your search.</div>
      )}
    </div>
  );
}
