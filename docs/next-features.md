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

## 5. Implementation Priority

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
6. 🔎 **Code ↔ Geometry Explorer** - MEDIUM/HIGH
   - Jump from params or picked geometry back to source lines
   - Highlight/isolate sub-parts in the viewport from a build tree
   - Add a step-through construction mode for debugging unions/differences
   - Add an agent-facing API/MCP layer for screenshots, model stats, scene tree, and source links
7. ⏱ **File History** - LOWER (nice-to-have, but impactful)

---

## Notes for Implementation

- Keep it simple - don't over-engineer
- Focus on 80/20 - solve most common pain points
- All features should work offline (no cloud dependencies)
- Store preferences in localStorage + `.forge3d/` folder in workspace
