import { useMemo } from 'react';
import Icons from './icons.jsx';
import { START_CATALOG, START_SECTIONS, getStartSectionLabel, sortStartItems } from './start-catalog.js';

function filterStartItems(items, search, sectionFilter) {
  const normalizedSearch = search.trim().toLowerCase();
  return items.filter((item) => {
    if (sectionFilter !== 'all' && item.section !== sectionFilter) return false;
    if (!normalizedSearch) return true;
    const haystack = [
      item.name,
      item.summary,
      item.section,
      item.kind,
      item.license,
      ...(item.tags || []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

function actionLabelForItem(item) {
  if (item.primaryAction === 'insert') return 'Insert at Cursor';
  if (item.primaryAction === 'appendSafe') return 'Append as Safe Block';
  if (item.primaryAction === 'openExternal') return 'Open Source';
  return 'Open Example File';
}

function renderPreview(colors, item) {
  if (item.previewImage) {
    return (
      <div
        style={{
          height: '124px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: `1px solid ${colors.border}`,
          background: colors.bgDarker,
        }}
      >
        <img
          alt={item.name}
          src={item.previewImage}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '124px',
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(135deg, ${colors.bgPanel}, ${colors.bgDarker})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textMuted,
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
      }}
    >
      {item.sourceType === 'library-wrapper' ? 'Reference' : item.section}
    </div>
  );
}

export default function StartSidebar({ colors, onInsertItem, onOpenExternal, onStateChange, startState = {} }) {
  const search = startState.search || '';
  const sectionFilter = startState.sectionFilter || 'all';

  const filteredGroups = useMemo(() => {
    const filtered = sortStartItems(filterStartItems(START_CATALOG, search, sectionFilter));
    return START_SECTIONS
      .filter((section) => section.id !== 'all')
      .map((section) => ({
        id: section.id,
        label: section.label,
        items: filtered.filter((item) => item.section === section.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [search, sectionFilter]);

  const filterButtonStyle = (active) => ({
    background: active ? `${colors.accent}20` : colors.bgPanel,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    borderRadius: '999px',
    color: active ? colors.accent : colors.textMuted,
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.2px',
    padding: '6px 10px',
    whiteSpace: 'nowrap',
  });

  const primaryButtonStyle = {
    flex: 1,
    background: `${colors.accent}22`,
    border: `1px solid ${colors.accent}`,
    borderRadius: '10px',
    color: colors.accent,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    padding: '9px 10px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSoft, fontSize: '13px', fontWeight: 700 }}>
          <Icons.Spark />
          <span>Start</span>
        </div>
        <div style={{ marginTop: '8px', color: colors.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          Preview-first examples, construction helpers, and references. Use examples to replace the file, snippets to insert at the cursor, and safe blocks to merge into what you already have.
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <input
            type="search"
            placeholder="Search examples, helpers, and libraries"
            value={search}
            onChange={(event) => onStateChange?.({ search: event.target.value })}
            style={{
              width: '100%',
              background: colors.bgDarker,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              color: colors.text,
              fontSize: '12px',
              padding: '9px 11px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          {START_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => onStateChange?.({ sectionFilter: section.id })}
              style={filterButtonStyle(sectionFilter === section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div style={{ color: colors.textMuted, fontSize: '12px', lineHeight: 1.5, padding: '12px 8px', textAlign: 'center' }}>
          No Start items match that search yet.
        </div>
      ) : (
        filteredGroups.map((group) => (
          <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.textMuted, padding: '0 2px' }}>
              {getStartSectionLabel(group.id)}
            </div>
            {group.items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: colors.bgPanel,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '14px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  cursor: 'pointer',
                }}
              >
                {renderPreview(colors, item)}

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSoft, fontSize: '13px', fontWeight: 700 }}>
                      <Icons.File />
                      <span>{item.name}</span>
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: '12px', lineHeight: 1.5, marginTop: '4px' }}>
                      {item.summary}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '999px', color: colors.textMuted, fontSize: '10px', fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {item.kind}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: `${colors.accent}16`, border: `1px solid ${colors.accent}33`, borderRadius: '999px', color: colors.accent, fontSize: '10px', fontWeight: 700, padding: '3px 8px' }}>
                    {item.sourceType === 'builtin' ? 'Forge3D' : item.sourceType === 'vendored' ? 'Vendored' : 'Reference'}
                  </span>
                  {item.license && (
                    <span style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '999px', color: colors.textMuted, fontSize: '10px', fontWeight: 700, padding: '3px 8px' }}>
                      {item.license}
                    </span>
                  )}
                  {(item.tags || []).slice(0, 4).map((tag) => (
                    <span key={tag} style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '999px', color: colors.textMuted, fontSize: '10px', fontWeight: 700, padding: '3px 7px' }}>
                      {tag}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onInsertItem?.(item)}
                    style={primaryButtonStyle}
                  >
                    {actionLabelForItem(item)}
                  </button>
                  {item.sourceRepoUrl && (
                    <button
                      onClick={() => onOpenExternal?.(item.sourceRepoUrl)}
                      style={{
                        background: colors.bgDarker,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '10px',
                        color: colors.textMuted,
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '9px 10px',
                      }}
                    >
                      Source
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
