import Icons from './icons.jsx';

export default function WorkspaceSidebar({ colors, onChooseWorkspaceFolder, onOpenWorkspaceFile, workspaceFiles, workspaceFolder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {workspaceFolder ? (
        <>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: colors.textFaint, padding: '2px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span title={workspaceFolder}>📁 {workspaceFolder.split(/[\\/]/).pop()}</span>
            <button onClick={onChooseWorkspaceFolder} style={{ background: 'none', border: 'none', color: colors.accent, cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }} title="Change folder">📂</button>
          </div>
          {workspaceFiles.length === 0 ? (
            <div style={{ color: colors.textFaint, fontSize: '11px', padding: '8px', textAlign: 'center' }}>No .scad files found</div>
          ) : (
            workspaceFiles.map((file) => (
              <button key={file.fullPath} onClick={() => onOpenWorkspaceFile(file.fullPath)} title={file.relativePath}
                style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, color: colors.text, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                onMouseEnter={(event) => Object.assign(event.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                onMouseLeave={(event) => Object.assign(event.currentTarget.style, { background: colors.bgPanel, borderColor: colors.border })}
              ><Icons.File /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.relativePath}</span></button>
            ))
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 8px' }}>
          <div style={{ color: colors.textFaint, fontSize: '11px', marginBottom: '10px' }}>Set a workspace folder to browse .scad files</div>
          <button onClick={onChooseWorkspaceFolder}
            style={{ background: `${colors.accent}22`, border: `1px solid ${colors.accent}`, color: colors.accent, padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >📁 Set Workspace Folder</button>
        </div>
      )}
    </div>
  );
}
