import Icons from './icons.jsx';

function SourceBadge({ colors, source }) {
  const label = source?.kind === 'active-render'
    ? 'Current Render'
    : source?.kind === 'scad-file'
      ? 'SCAD'
      : source?.kind === 'derived'
        ? 'Derived'
        : source?.kind === 'hole' ? 'Cutter' : 'STL';

  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        color: colors.textMuted,
        background: `${colors.border}66`,
        borderRadius: '999px',
        padding: '2px 7px',
      }}
    >
      {label}
    </span>
  );
}

function IconButton({ active = false, colors, disabled = false, icon: Icon, onClick, title }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        border: `1px solid ${active ? colors.accent : colors.border}`,
        background: active ? `${colors.accent}22` : colors.bgDarker,
        color: disabled ? colors.textFaint : active ? colors.accent : colors.textMuted,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      <Icon />
    </button>
  );
}

export default function AssemblySidebar({
  canAddCurrentRender,
  colors,
  onAddCurrentRender,
  onDeletePart,
  onDuplicatePart,
  onImportScad,
  onImportStl,
  onOpenScene,
  onSaveScene,
  onSelectPart,
  onToggleLock,
  onToggleVisibility,
  parts,
  selectedPartId,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowX: 'hidden' }}>
      <div style={{ display: 'grid', gap: '8px' }}>
        <button
          disabled={!canAddCurrentRender}
          onClick={onAddCurrentRender}
          style={{
            border: `1px solid ${canAddCurrentRender ? colors.accent : colors.border}`,
            background: canAddCurrentRender ? `${colors.accent}16` : colors.bgDarker,
            color: canAddCurrentRender ? colors.accent : colors.textFaint,
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: canAddCurrentRender ? 'pointer' : 'not-allowed',
            textAlign: 'left',
          }}
        >
          Add Current Render
        </button>
        <button
          onClick={onImportScad}
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.bgPanel,
            color: colors.textSoft,
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Add SCAD File
        </button>
        <button
          onClick={onImportStl}
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.bgPanel,
            color: colors.textSoft,
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Add STL
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={onOpenScene}
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.bgDarker,
            color: colors.textMuted,
            borderRadius: '10px',
            padding: '8px 10px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Open Scene
        </button>
        <button
          onClick={onSaveScene}
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.bgDarker,
            color: colors.textMuted,
            borderRadius: '10px',
            padding: '8px 10px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Save Scene
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Assembly Parts
        </span>
        <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 700 }}>{parts.length}</span>
      </div>

      {parts.length === 0 ? (
        <div style={{ border: `1px dashed ${colors.borderHover}`, borderRadius: '12px', padding: '14px', color: colors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
          Add the current render or import other meshes to build up an assembly scene.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowX: 'hidden' }}>
          {parts.map((part) => {
            const selected = part.id === selectedPartId;
            return (
              <div
                key={part.id}
                style={{
                  border: `1px solid ${selected ? colors.accent : colors.border}`,
                  background: selected ? `${colors.accent}12` : colors.bgPanel,
                  borderRadius: '12px',
                  padding: '10px',
                }}
              >
                <button
                  onClick={() => onSelectPart(part.id)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    color: colors.textSoft,
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.35 }}>
                    {part.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <SourceBadge colors={colors} source={part.source} />
                    {part.locked && (
                      <span style={{ fontSize: '10px', color: colors.warn, fontWeight: 800 }}>Locked</span>
                    )}
                  </div>
                </button>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <IconButton
                    active={part.visible !== false}
                    colors={colors}
                    icon={Icons.Eye}
                    onClick={() => onToggleVisibility(part.id)}
                    title={part.visible === false ? 'Show part' : 'Hide part'}
                  />
                  <IconButton
                    active={part.locked}
                    colors={colors}
                    icon={part.locked ? Icons.LockClosed : Icons.LockOpen}
                    onClick={() => onToggleLock(part.id)}
                    title={part.locked ? 'Unlock part' : 'Lock part'}
                  />
                  <button
                    onClick={() => onDuplicatePart(part.id)}
                    style={{
                      flex: '1 1 86px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgDarker,
                      color: colors.textMuted,
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '0 8px',
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    disabled={part.locked}
                    onClick={() => onDeletePart(part.id)}
                    title={part.locked ? 'Unlock part before deleting it' : 'Delete part'}
                    style={{
                      flex: '1 1 86px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.error}44`,
                      background: `${colors.error}14`,
                      color: part.locked ? colors.textFaint : colors.error,
                      cursor: part.locked ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '0 8px',
                      opacity: part.locked ? 0.7 : 1,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
