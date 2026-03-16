import { useMemo } from 'react';
import Icons from './icons.jsx';
import { START_LIBRARY } from './start-library.js';

const KIND_ORDER = ['basic', 'recipe', 'template'];
const KIND_LABELS = {
  basic: 'Basics',
  recipe: 'Recipes',
  template: 'Templates',
};

function filterStartItems(items, search, kindFilter) {
  const normalizedSearch = search.trim().toLowerCase();
  return items.filter((item) => {
    if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
    if (!normalizedSearch) return true;
    const haystack = [item.name, item.summary, item.section, ...(item.tags || [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

export default function StartSidebar({ colors, onInsertItem, onStateChange, startState = {} }) {
  const search = startState.search || '';
  const kindFilter = startState.kindFilter || 'all';

  const filteredGroups = useMemo(() => {
    const filtered = filterStartItems(START_LIBRARY, search, kindFilter);
    return KIND_ORDER.map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      items: filtered.filter((item) => item.kind === kind),
    })).filter((group) => group.items.length > 0);
  }, [kindFilter, search]);

  const buttonStyle = (active) => ({
    background: active ? `${colors.accent}22` : colors.bgPanel,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    borderRadius: '999px',
    color: active ? colors.accent : colors.textMuted,
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.2px',
    padding: '6px 10px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.textSoft, fontSize: '13px', fontWeight: 700 }}>
          <Icons.Spark />
          <span>Start Modeling Faster</span>
        </div>
        <div style={{ marginTop: '8px', color: colors.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          Learn OpenSCAD with working building blocks. Basics insert at the cursor. Recipes and templates land as safe merged blocks so your existing params stay intact.
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <input
            type="search"
            placeholder="Search starters, recipes, and templates"
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
          {[
            { id: 'all', label: 'All' },
            { id: 'basic', label: 'Basics' },
            { id: 'recipe', label: 'Recipes' },
            { id: 'template', label: 'Templates' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => onStateChange?.({ kindFilter: filter.id })}
              style={buttonStyle(kindFilter === filter.id)}
            >
              {filter.label}
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
          <div key={group.kind} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: colors.textMuted, padding: '0 2px' }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const primaryLabel = item.defaultInsertBehavior === 'cursor' ? 'Insert' : 'Add Safely';
              return (
                <div
                  key={item.id}
                  style={{
                    background: colors.bgPanel,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
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
                    <span style={{ flexShrink: 0, background: `${colors.accent}16`, border: `1px solid ${colors.accent}44`, borderRadius: '999px', color: colors.accent, fontSize: '10px', fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {item.kind}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(item.tags || []).slice(0, 5).map((tag) => (
                      <span key={tag} style={{ background: colors.bgDarker, border: `1px solid ${colors.border}`, borderRadius: '999px', color: colors.textMuted, fontSize: '10px', fontWeight: 700, padding: '3px 7px' }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onInsertItem?.(item)}
                      style={{
                        flex: 1,
                        background: `${colors.accent}22`,
                        border: `1px solid ${colors.accent}`,
                        borderRadius: '10px',
                        color: colors.accent,
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '9px 10px',
                      }}
                    >
                      {primaryLabel}
                    </button>
                    <button
                      onClick={() => onInsertItem?.(item, 'replace')}
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
                      Replace File
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
