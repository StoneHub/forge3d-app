# Print Stage — Stage 1 Implementation Plan

## Goal
Add the first usable Print Stage foundation to Forge3D so users can reason about printer constraints before export.

## Scope for Stage 1
1. Add a top-level Print panel/state area
2. Store a print profile in workspace state
3. Show a simple build plate / bed visualization in the viewport
4. Surface basic profile info in the UI

## Proposed data model
Add `printProfile` to workspace state:

```json
{
  "printer": "Custom",
  "bed": { "x": 220, "y": 220, "z": 250, "shape": "rect" },
  "nozzle": 0.4,
  "layerHeight": 0.2,
  "material": "PLA",
  "qualityPreset": "draft",
  "placement": {
    "position": [0, 0, 0],
    "rotation": [0, 0, 0],
    "layFlat": false,
    "centered": true
  }
}
```

## Files likely to change
- `src/forge3d/workspace.js`
- `src/Forge3D.jsx`
- `src/forge3d/renderer.js`
- optional small helper: `src/forge3d/print-profile.js`

## UI plan
### 1) New Print tab/panel
- Add a `Print` section alongside existing modeling/workspace controls.
- Show compact editable fields:
  - Printer name
  - Bed X/Y/Z
  - Nozzle
  - Layer height
  - Material
- Keep first pass dead simple: text/select/number inputs only.

### 2) Workspace persistence
- Extend default workspace object with `printProfile`.
- Migrate old saved workspaces safely by merging defaults.
- Keep backward compatibility if prior localStorage entries do not have print state.

### 3) Viewport bed visualization
- Draw a rectangular build plate at Z=0.
- Show:
  - bed outline
  - subtle filled plane
  - center cross / origin marker
- Size should come from `printProfile.bed.x/y`.
- Hide or keep subdued when no mesh is loaded.

### 4) Model fit summary
- Reuse current geometry bounding box.
- Compute whether model exceeds bed X/Y/Z.
- Show a small status summary in Print UI:
  - Fits bed / exceeds width / exceeds depth / exceeds height
- No auto-placement yet; just visibility.

## Renderer implementation notes
- Add optional `printProfile` input to renderer hook/component.
- Build a dedicated Three.js group for print-bed helpers.
- Regenerate helpers only when bed settings change.
- Keep visual style subtle so dimensions/model remain primary.

## Acceptance criteria
- A saved workspace restores print settings.
- User can edit bed dimensions and see viewport update.
- Loaded/rendered model reports whether it fits current bed volume.
- No regression in normal modeling/render flow.

## Nice-to-have if trivial
- A few printer presets: Ender 3, Prusa MK4, Bambu A1 Mini
- "Reset to default print profile" button

## Out of scope for Stage 1
- Lay flat
- Rotate/center tools
- Collision/overhang/wall analysis
- Slicer handoff
- 3MF export

## Suggested execution order
1. Add workspace schema + defaults
2. Add Print UI state editor
3. Add renderer bed visualization
4. Add fit check summary
5. Build and smoke test
