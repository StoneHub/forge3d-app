# Next Features - UX Improvements

## 1. Resizable Panels ⚡ Done

### Goal
Allow users to resize code editor, viewport, and console/terminal panels to their preference.

### Implementation Plan
- **Horizontal resize**: Code editor ↔ Viewport (drag middle divider)
- **Vertical resize**: Editor/Viewport area ↔ Console/Terminal (drag top divider of bottom panel)
- Store sizes in localStorage as part of workspace settings

### Technical Approach
```javascript
// Shipped:
// - Sidebar width is resizable
// - Editor ↔ viewport divider is resizable
// - Bottom console/terminal height is resizable
// - Layout is persisted in localStorage via panelLayout
```

### Libraries to Consider
- Plain React + mouse events (simplest)
- `react-resizable-panels` (if we want more features)

---

## 2. App Icon 🎨 Done

### Options
1. **Forge/Anvil + 3D cube** - represents "forging" 3D objects
2. **F3D monogram** - minimal, modern
3. **Isometric cube with grid** - emphasizes CAD/precision

### Files Needed
- `public/icon.png` (256x256+) - for Electron
- `public/favicon.ico` - for window/titlebar assets
- Update `electron-builder` config in package.json

### Tool
Use Figma/Inkscape or generate with AI (DALL-E, Midjourney)

---

## 3. File History / Snapshots ("Windows Recall" for .scad files)

### Goal
Never lose work. Track all changes to workspace files with easy rollback.

### Design Concept: Auto-Snapshot System

#### How It Works
1. **Auto-snapshot on significant events:**
   - Every manual save
   - Every N minutes (if code changed)
   - Before opening a new file
   - Before major operations (refactor, etc.)

2. **Snapshot storage:**
   - `.forge3d/snapshots/` folder in workspace (gitignored)
   - Each snapshot: `{filename}_{timestamp}.scad`
   - Metadata: `.forge3d/snapshots/index.json` with timestamps, file sizes

3. **UI:**
   - New sidebar tab: "⏱ History"
   - Timeline view showing snapshots
   - Click to preview diff
   - Restore button to revert to snapshot

#### Implementation Phases

**Phase 1: Auto-save snapshots**
```javascript
// In Forge3D.jsx, on save:
const saveSnapshot = async () => {
  const timestamp = Date.now();
  const snapshotPath = `.forge3d/snapshots/${currentFileName}_${timestamp}.scad`;
  await window.forgeAPI.writeSnapshot(snapshotPath, code);
};
```

**Phase 2: Snapshot history UI**
- List snapshots in sidebar
- Show timestamp, size, preview
- Diff viewer (highlight changes)

**Phase 3: Smart cleanup**
- Keep all snapshots < 1 hour old
- Keep hourly snapshots < 1 day old
- Keep daily snapshots < 1 week old
- Keep weekly snapshots indefinitely (or until manual delete)

### Alternative: Git Integration
- Auto-commit on save
- UI for browsing git history
- Leverage existing git tooling
- Requires git in workspace folder

**Pros:** Industry standard, powerful
**Cons:** Might be overkill, requires git knowledge

### Recommendation
Start with **custom snapshot system** (simpler, more integrated). Can add git integration later.

---

## 4. Better Code Templates (Replace Primitive Buttons) Done

### Concept: Smart Templates Library

Instead of "Insert Cube", have useful templates:

#### Template Categories

**1. Parametric Shapes**
```scad
// Parametric Box with Rounded Corners
width = 50;   // @param
depth = 30;   // @param
height = 20;  // @param
corner_radius = 2;  // @param

minkowski() {
  cube([width, depth, height], center=true);
  sphere(r=corner_radius, $fn=16);
}
```

**2. Mechanical Parts**
```scad
// Mounting Bracket
// ... complete working example
```

**3. Joinery**
```scad
// Dovetail Joint
// Snap-Fit Clips
// Threaded Insert Holes
```

**4. Utilities**
```scad
// Grid Array
// Circular Pattern
// Honeycomb Fill
```

### UI Integration
- Replace primitive buttons with "📋 Templates" dropdown
- Shows categorized list
- Insert modes:
  - `Append` (default) adds a marked block to the end of the file
  - `Cursor` is the advanced/manual insertion mode
  - `Replace` loads the template into the current editor buffer
- Templates stored in `src/forge3d/templates.js`

### Follow-up Adjustment (Shipped)
- Auto-parameter detection now scans top-level assignments anywhere in the file
- Appended template blocks keep existing params visible instead of hiding them behind the first inserted `module`
- Params from appended blocks show their template source in the Params tab

### Template Format
```javascript
export const TEMPLATES = {
  "Parametric Box": {
    category: "Shapes",
    code: `// Parametric Box\nwidth = 50;\n...`,
    description: "Box with rounded corners and wall thickness",
    tags: ["parametric", "container", "beginner"]
  },
  // ...
};
```

---

## 5. IDE UX Follow-Up Batch

### 5.1 IDE-Style Zoom

### Goal
Let Forge3D scale like a real desktop IDE instead of forcing users to live with a single fixed UI size.

### Plan
- Support `Ctrl+=`, `Ctrl+-`, and `Ctrl+0`
- Optionally support `Ctrl+MouseWheel` over the editor/viewport
- Persist app zoom in workspace or user config
- Show current zoom percentage in the status bar or toolbar

### Note
- Electron already exposes menu zoom roles, but Forge3D does not currently surface or persist zoom as part of the product UX
- Optional follow-up: separate `editorFontSize` from global app zoom for users who only want larger code text

### 5.2 Quick Start Panel

### Goal
Bridge the gap between "full example" and "large template" with small insertable starters that help users begin common modeling tasks fast.

### Plan
- Add a **Quick Start** surface in the editor area or sidebar for:
  - cube / sphere / cylinder / square / circle
  - `offset`, `hull`, `minkowski`
  - `union`, `difference`, `intersection`
  - `translate`, `rotate`, `scale`
  - module/function skeletons
  - starter param header blocks
- Treat these as **starters/snippets**, not full examples
- Use smart landing rules:
  - blank file → replace
  - active selection/cursor → insert there
  - non-empty file with existing params → append/merge safely

### Recommendation
Keep **Examples** for teaching and **Templates** for multi-part working code. Use **Quick Start** for tiny building blocks and starter scaffolds.

### 5.3 Inline Completions

### Goal
Support both standard code completions and optional AI inline predictions.

### Plan
- Step 1: extend the existing OpenSCAD LSP bridge to request completions and document symbols
- Step 2: add an AI completion provider layer with:
  - user OpenAI/Anthropic API key
  - local OpenAI-compatible endpoint / Ollama
  - experimental Codex CLI / Claude Code adapters
- Keep provider integration explicit; do **not** depend on reading or scraping an arbitrary live terminal session

### Recommendation
For the current custom textarea editor, ship normal completion lists first. If we want robust ghost text, accept-next-word/line, richer diff review, and symbol decorations, plan an editor-surface upgrade to Monaco or CodeMirror 6 before investing heavily in AI prediction.

### 5.4 Template Insertions Should Preserve Existing Params

### Goal
Fix the current "insert template and lose previously generated parameters" problem.

### Plan
- Replace raw string insertion with a smart merge path
- Split templates into conceptual sections:
  - `params`
  - `helpers`
  - `body`
- On insert:
  - keep existing param assignments and values
  - add only missing params from the inserted starter/template
  - avoid duplicating helper modules/functions where possible
  - reserve destructive replace behavior for blank buffers or explicit user choice

### 5.5 Smarter Parameter Slider Scaling

### Goal
Make the Params tab feel calibrated to the actual model instead of defaulting to giant ranges.

### Current Problem
- Auto-generated numeric ranges are often too large because the heuristics default to values like `value * 5` or `200`

### Plan
- Priority 1: explicit `// @param min/max/step` always wins
- Priority 2: infer file scale from nearby numeric literals and common geometry calls
- Priority 3: choose a tighter default slider window around the current value instead of a giant absolute max
- Add a low-friction way to widen the range when the auto-fit guess is wrong

### 5.6 Params + Symbols + Tree Navigation

### Goal
Turn the Params sidebar into the start of a real source navigator.

### Plan
- Add clickable sections for:
  - modules
  - functions
  - top-level variables
  - inserted template blocks
- Build an outline/tree view from LSP document symbols when available
- Fall back to lightweight parsing for module/function discovery if symbols are unavailable
- Later connect the code outline to viewport/build-tree highlighting

### Recommendation
Start with a **document outline** first. A true object tree from rendered geometry is harder because the native OpenSCAD flow currently returns STL geometry, not a semantic scene graph.
When the object tree arrives, mount it in the **viewport/View area** so visibility toggles and isolate/show-hide actions stay close to the rendered model.

### 5.7 Built-In Diff History

### Goal
Give users a safer memory than undo/redo.

### Plan
- Auto-snapshot on:
  - save
  - timed idle interval
  - before destructive replace/template/AI operations
  - before opening another file
- Show a **History** timeline in the sidebar
- Add diff preview and restore
- Add manual checkpoints/bookmarks for important revisions

### Recommendation
Start with Forge3D-owned snapshots in `.forge3d/snapshots/`. Git integration can come later.

---

## 6. Implementation Priority

1. ✅ **UI Polish** (DONE: removed clutter, improved colors, reset buttons)
2. ✅ **Resizable Panels** (DONE: sidebar, editor, and console layout persistence)
3. ✅ **App Icon** - DONE
4. ✅ **Templates System** - DONE
5. 🧩 **Assembly Layer / Reference Parts** - CURRENT GOAL
   - Load a second template or `.scad` file beside the active file without mutating the working code
   - Show multiple parts in one scene/build plate so joins, gaps, overlaps, and fit are obvious
   - Move/rotate/scale each part visually
   - Support union/subtract/intersect per part
   - Use this as the foundation for a future print-bed stage
6. ✨ **IDE UX Follow-Up** - PARALLEL TRACK
   - IDE-style zoom, Quick Start starters, smarter template merge, and adaptive params are all isolated enough to land incrementally
   - Completion UX and richer diff review may become the forcing function for a Monaco/CodeMirror editor upgrade
7. 🔎 **Code ↔ Geometry Explorer** - MEDIUM/HIGH
   - Jump from params or picked geometry back to source lines
   - Highlight/isolate sub-parts in the viewport from a build tree
   - Add a step-through construction mode for debugging unions/differences
   - Add an agent-facing API/MCP layer for screenshots, model stats, scene tree, and source links
8. ⏱ **File History** - LOWER (nice-to-have, but impactful)

---

## Notes for Implementation

- Keep it simple - don't over-engineer
- Focus on 80/20 - solve most common pain points
- All features should work offline (no cloud dependencies)
- Store preferences in localStorage + `.forge3d/` folder in workspace
