# Forge3D Agent Ops Notes

This file captures practical operating context for Codex/Claude-style agents working on Forge3D.

## Product Context

Forge3D is no longer just "code editor plus future print view."

Recommended workflow direction:

1. Design Mode
   OpenSCAD authoring, params, docs, terminal, native render
2. Assembly Mode
   Multi-part mesh scene for placement, measurement, booleans, and export
3. Print Mode
   Printer bed, slicing, and G-code

Related docs:

- `docs/DEVPLAN.md`
- `docs/WORKFLOW.md`
- `docs/assembly-mode-plan.md`

## Tavily Usage In This Repo

### Recommendation

Do not default to `tavily_research` for this project.

Use this ladder instead:

1. `tavily_search`
2. `tavily_extract`
3. `tavily_map` or `tavily_crawl` only when exploring a docs site structure
4. `tavily_research` only if the account/plan clearly supports it and the task truly needs broad synthesis

### Why

Forge3D research tasks are usually narrow:

- official docs lookup
- product behavior confirmation
- feature comparison
- one or two-source implementation guidance

That makes `search` plus `extract` a much better default than `research`.

### Free-Plan Friendly Pattern

For Tavily free-plan usage:

- prefer `tavily_search` with `search_depth: "basic"` or `"advanced"`
- use `include_domains` when possible
- request `include_raw_content` only when needed
- use `tavily_extract` on the best 1-3 URLs after search
- avoid `tavily_research` unless the user explicitly wants it and the plan supports it

### Current Official Pricing/Behavior Notes

Official Tavily docs indicate:

- Search API:
  - `basic` search depth costs 1 credit
  - `advanced` search depth costs 2 credits
- Research API:
  - dynamic pricing
  - minimum cost starts at 500 credits and can go higher depending on the task

For a free 1,000-credit plan, that makes `research` a very expensive default.

Official docs:

- Credits and pricing:
  - https://docs.tavily.com/documentation/best-practices/best-practices-credit-management
- Search API:
  - https://docs.tavily.com/documentation/api-reference/endpoint/search
- Research API:
  - https://docs.tavily.com/documentation/api-reference/endpoint/research

## Suggested Codex Personalization Addition

Recommended personalization text:

```text
When using Tavily for this workspace, assume the account may be on the free plan.
Default to tavily_search first, then tavily_extract on selected URLs.
Do not use tavily_research unless I explicitly ask for deep research or you confirm the plan supports it.
Prefer official docs and primary sources.
When Tavily research is unavailable or too expensive, say so briefly and fall back to search + extract without blocking.
```

## Friction Points Seen So Far

### 1. Tavily Research Is Too Expensive As A Default

Problem:

- `tavily_research` can fail or burn too many credits for normal product planning tasks

Fix:

- treat `search` + `extract` as the default workflow

### 2. Windows `rg` Alias Can Be Broken

Problem:

- the WindowsApps `rg.exe` alias may be application-protected and unusable from Codex

Fix:

- install normal ripgrep and make sure `Get-Command rg` resolves to a real path

### 3. Same-Version Installer Updates Can Be Confusing

Problem:

- packaging and reinstalling the same app version can make it look like the host app updated when the installed files are still old

Safe verification:

- check installed `resources/app.asar` timestamp and size
- if needed, compare against `release/win-unpacked/resources/app.asar`

### 4. External File Edits Only Sync For Saved Files

Problem:

- terminal-driven edits work only when the active document has a real file path

Implication:

- unsaved scratch buffers cannot be watched from disk

### 5. Electron-Only Assumptions Matter

Problem:

- Forge3D depends on `window.forgeAPI`, native OpenSCAD, file dialogs, terminal IPC, and Electron preload behavior

Fix:

- avoid browser-only assumptions during debugging or planning

### 6. Main/Preload Changes Need Explicit Verification

Recommended checks after Electron changes:

- `npm run build`
- `node --check electron/main.mjs`
- `node --check electron/preload.cjs`

### 7. Product Docs Need A Three-Stage Mental Model

Problem:

- older docs still bias toward a two-mode story

Fix:

- keep `Design -> Assembly -> Print` visible in planning docs and agent notes
