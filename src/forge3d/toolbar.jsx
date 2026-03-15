import { useEffect, useMemo, useRef, useState } from 'react';
import Icons from './icons.jsx';
import { TEMPLATE_LIBRARY } from './templates.js';

function ToolbarButton({ active = false, colors, disabled, icon: Icon, label, onClick, title }) {
  const restingStyle = {
    background: active ? colors.btnHover : 'none',
    borderColor: active ? colors.borderHover : 'transparent',
    color: disabled ? colors.textFaint : active ? colors.text : colors.textMuted,
  };

  return (
    <button
      onClick={onClick}
      title={title || label}
      disabled={disabled}
      style={{
        border: '1px solid transparent',
        ...restingStyle,
        padding: '4px 8px',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={(event) => {
        if (!disabled) {
          Object.assign(event.currentTarget.style, {
            background: colors.btnHover,
            borderColor: colors.borderHover,
            color: colors.text,
          });
        }
      }}
      onMouseLeave={(event) => {
        Object.assign(event.currentTarget.style, restingStyle);
      }}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}

function TemplatesMenu({ colors, onInsertTemplate, onTemplateInsertModeChange, templateInsertMode }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const groupedTemplates = useMemo(() => {
    return TEMPLATE_LIBRARY.reduce((groups, template) => {
      if (!groups[template.category]) groups[template.category] = [];
      groups[template.category].push(template);
      return groups;
    }, {});
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <ToolbarButton
        active={open}
        colors={colors}
        icon={Icons.Clipboard}
        label="Templates"
        onClick={() => setOpen((current) => !current)}
        title="Insert a parametric template at the cursor"
      />

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            width: '360px',
            maxHeight: '460px',
            overflowY: 'auto',
            padding: '10px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            background: `${colors.bgPanel}f6`,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
            zIndex: 20,
          }}
        >
          <div style={{ padding: '2px 4px 10px', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: colors.text }}>Smart Templates</div>
            <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '3px' }}>
              Pick how templates should land in the current model.
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              {[
                { id: 'append', label: 'Append', title: 'Recommended. Adds a clearly marked block to the end of the file.' },
                { id: 'cursor', label: 'Cursor', title: 'Advanced. Inserts at the current selection or cursor position.' },
                { id: 'replace', label: 'Replace', title: 'Replaces the current editor contents with the template.' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onTemplateInsertModeChange?.(mode.id)}
                  title={mode.title}
                  style={{
                    background: templateInsertMode === mode.id ? `${colors.accent}22` : colors.bgDarker,
                    border: `1px solid ${templateInsertMode === mode.id ? colors.accent : colors.border}`,
                    borderRadius: '999px',
                    color: templateInsertMode === mode.id ? colors.accent : colors.textMuted,
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    padding: '5px 9px',
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px' }}>
            {Object.entries(groupedTemplates).map(([category, templates]) => (
              <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textFaint, padding: '0 4px' }}>
                  {category}
                </div>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      onInsertTemplate?.(template, templateInsertMode);
                      setOpen(false);
                    }}
                    title={template.tags.join(', ')}
                    style={{
                      background: colors.bgDarker,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.text,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(event) => Object.assign(event.currentTarget.style, {
                      background: colors.btnHover,
                      borderColor: colors.accent,
                    })}
                    onMouseLeave={(event) => Object.assign(event.currentTarget.style, {
                      background: colors.bgDarker,
                      borderColor: colors.border,
                    })}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
                      <Icons.File />
                      {template.name}
                    </span>
                    <span style={{ fontSize: '11px', color: colors.textMuted, paddingLeft: '22px' }}>
                      {template.description}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ForgeToolbar({
  autoRun,
  building,
  canRedo,
  canUndo,
  colors,
  onAutoRunChange,
  onCancelBuild,
  onExportStl,
  onNewFile,
  onOpenFile,
  onRedo,
  onResetView,
  onRunCode,
  onSaveFile,
  onInsertTemplate,
  onTemplateInsertModeChange,
  onThemeToggle,
  onUndo,
  templateInsertMode,
  theme,
}) {
  return (
    <div style={{ height: '42px', minHeight: '42px', background: theme === 'dark' ? 'linear-gradient(180deg,#1e1f30,#181924)' : colors.bgPanel, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '22px', height: '22px', background: colors.logoGlow, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icons.Cube /></div>
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>
            <span style={{ color: colors.accent }}>FORGE</span><span style={{ color: theme === 'dark' ? '#7c4dff' : '#4527a0' }}>3D</span>
          </span>
          <span style={{ fontSize: '10px', color: colors.textFaint, marginLeft: '4px' }}>v3.0</span>
        </div>
        <div style={{ height: '20px', width: '1px', background: colors.border }} />
        <ToolbarButton colors={colors} icon={Icons.File} label="New" onClick={onNewFile} />
        <ToolbarButton colors={colors} icon={Icons.File} label="Open" onClick={onOpenFile} />
        <ToolbarButton colors={colors} icon={Icons.File} label="Save" onClick={onSaveFile} />
        <TemplatesMenu
          colors={colors}
          onInsertTemplate={onInsertTemplate}
          onTemplateInsertModeChange={onTemplateInsertModeChange}
          templateInsertMode={templateInsertMode}
        />
        <ToolbarButton colors={colors} icon={Icons.Grid} label="Export STL" onClick={onExportStl} />
        <ToolbarButton colors={colors} disabled={!canUndo} icon={Icons.Undo} label="Undo" onClick={onUndo} title="Ctrl/Cmd+Z" />
        <ToolbarButton colors={colors} disabled={!canRedo} icon={Icons.Redo} label="Redo" onClick={onRedo} title="Ctrl/Cmd+Shift+Z" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onThemeToggle} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '12px' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button onClick={onResetView} style={{ background: `${colors.bgDarker}cc`, border: `1px solid ${colors.border}`, color: colors.text, padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Reset View</button>
        {building ? (
          <button onClick={onCancelBuild} style={{ background: 'linear-gradient(135deg,#e57373,#ef5350)', border: 'none', color: '#fff', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}>⏹ Cancel</button>
        ) : (
          <button onClick={onRunCode} style={{ background: 'linear-gradient(135deg,#4fc3f7,#4dd0e1)', border: 'none', color: '#111', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}><Icons.Play /> Build</button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: colors.textMuted, cursor: 'pointer' }}>
          <input type='checkbox' checked={autoRun} onChange={(event) => onAutoRunChange(event.target.checked)} style={{ accentColor: colors.accent }} />Auto
        </label>
      </div>
    </div>
  );
}
