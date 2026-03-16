import Icons from './icons.jsx';

function renderActionButton(colors, Icon, label, onClick, title, accent = false) {
  return (
    <button
      onClick={onClick}
      title={title || label}
      style={{
        background: accent ? `${colors.accent}22` : colors.bgPanel,
        border: `1px solid ${accent ? colors.accent : colors.border}`,
        borderRadius: '8px',
        color: accent ? colors.accent : colors.text,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        fontWeight: 600,
        justifyContent: 'center',
        padding: '8px 10px',
      }}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}

export default function WorkspaceSidebar({
  colors,
  currentFileName,
  currentFilePath,
  onChooseWorkspaceFolder,
  onClearRecentFiles,
  onNewFile,
  onOpenFile,
  onOpenRecentFile,
  onOpenWorkspaceFile,
  recentFiles,
  workspaceFiles,
  workspaceFolder,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
        {renderActionButton(colors, Icons.File, 'New File', onNewFile, 'Start a new workspace')}
        {renderActionButton(colors, Icons.File, 'Open File', onOpenFile, 'Open a .scad file')}
      </div>

      <div>
        {renderActionButton(colors, Icons.Folder, workspaceFolder ? 'Change Folder' : 'Set Folder', onChooseWorkspaceFolder, 'Choose a workspace folder', true)}
      </div>

      <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.textMuted, marginBottom: '8px' }}>
          Current File
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.text, fontSize: '12px' }}>
          <Icons.File />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentFileName}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentFilePath || 'Unsaved workspace file'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.textMuted, marginBottom: '8px' }}>
          Modeling Flow
        </div>
        <div style={{ color: colors.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          Use the Start tool in the left rail for Basics, Recipes, and Templates. Workspace stays focused on files, folders, and where your project lives on disk.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: colors.textMuted, padding: '2px', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Recent Files</span>
          {recentFiles.length > 0 && (
            <button onClick={onClearRecentFiles} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '11px', fontWeight: 700, padding: '2px 4px' }} title="Clear recent files">
              Clear
            </button>
          )}
        </div>
        {recentFiles.length === 0 ? (
          <div style={{ color: colors.textMuted, fontSize: '12px', padding: '6px 2px' }}>Recent .scad files will appear here.</div>
        ) : (
          recentFiles.slice(0, 8).map((filePath) => {
            const fileName = filePath.split(/[\\/]/).pop();
            const isActive = currentFilePath === filePath;
            return (
              <button
                key={filePath}
                onClick={() => onOpenRecentFile(filePath)}
                title={filePath}
                style={{
                  background: isActive ? `${colors.accent}16` : colors.bgPanel,
                  border: `1px solid ${isActive ? colors.accent : colors.border}`,
                  color: isActive ? colors.accent : colors.text,
                  padding: '7px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(event) => Object.assign(event.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                onMouseLeave={(event) => Object.assign(event.currentTarget.style, { background: isActive ? `${colors.accent}16` : colors.bgPanel, borderColor: isActive ? colors.accent : colors.border })}
              >
                <Icons.File />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
              </button>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: colors.textMuted, padding: '2px', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{workspaceFolder ? workspaceFolder.split(/[\\/]/).pop() : 'Workspace Folder'}</span>
          <button onClick={onChooseWorkspaceFolder} style={{ background: 'none', border: 'none', color: colors.accent, cursor: 'pointer', fontSize: '11px', fontWeight: 700, padding: '2px 4px' }} title={workspaceFolder ? 'Change workspace folder' : 'Choose workspace folder'}>
            Browse
          </button>
        </div>

        {!workspaceFolder ? (
          <div style={{ color: colors.textMuted, fontSize: '12px', padding: '8px 2px', lineHeight: 1.5 }}>
            Set a workspace folder to browse local `.scad` files like a project explorer.
          </div>
        ) : workspaceFiles.length === 0 ? (
          <div style={{ color: colors.textMuted, fontSize: '12px', padding: '8px 2px', textAlign: 'center' }}>No .scad files found</div>
        ) : (
          workspaceFiles.map((file) => {
            const isActive = currentFilePath === file.fullPath;
            return (
              <button
                key={file.fullPath}
                onClick={() => onOpenWorkspaceFile(file.fullPath)}
                title={file.relativePath}
                style={{
                  background: isActive ? `${colors.accent}16` : colors.bgPanel,
                  border: `1px solid ${isActive ? colors.accent : colors.border}`,
                  color: isActive ? colors.accent : colors.text,
                  padding: '7px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(event) => Object.assign(event.currentTarget.style, { background: colors.btnHover, borderColor: colors.accent })}
                onMouseLeave={(event) => Object.assign(event.currentTarget.style, { background: isActive ? `${colors.accent}16` : colors.bgPanel, borderColor: isActive ? colors.accent : colors.border })}
              >
                <Icons.File />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.relativePath}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
