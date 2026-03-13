# Forge3D Review + Improvement Plan

## High-impact improvements

1. **Examples should teach reusable patterns, not just shapes**
   - Add a "Basics: Patterns" track with modules, helper functions, `difference/union`, and parameter annotations.
   - Add practical templates (fixture plate, enclosure lid, tabs/snap fits, text emboss/deboss).
   - Add comments in each example that explain *why* a pattern is used.

2. **Examples browser UX**
   - Add categories (Basics, Mechanical, Text, Artistic, Print-ready).
   - Add search and tags (e.g., `offset`, `hull`, `text`, `threads`).
   - Show "learning goals" and expected print time/material for each example.

3. **Workspace UX**
   - Workspace tree should support folders, pinning favorites, and quick filter.
   - Add split editor tabs and compare view for iterating parametric variants.
   - Persist per-file camera bookmarks and render presets.

4. **Modeling app baseline features**
   - Measurement gizmo (distance/radius/angle).
   - Grid and snap controls (increment, origin lock, workplane).
   - Section/cut view and simple collision checks.
   - Preset library for common hardware clearances (M2/M3/M4, bearings, magnets).

## Print Stage feature plan

### Goal
Create a dedicated **Print Stage** where users validate printability and export with confidence, without leaving Forge3D.

### Stage 1 — Foundation
- Add a new top-level panel: **Model → Print**.
- Store print profiles in workspace state:
  - printer name
  - bed size (X/Y/Z)
  - nozzle diameter
  - layer height defaults
  - filament type
- Add bed visualization in viewport (build plate + safe margins).

### Stage 2 — Placement & orientation
- One-click actions:
  - Lay flat
  - Center on bed
  - Rotate 90° on X/Y/Z
- Numeric transform entry for model placement.
- Out-of-bounds warning and red highlight if model exceeds bed volume.

### Stage 3 — Printability checks
- Wall thickness check (heuristic by nozzle size).
- Unsupported overhang estimator (angle threshold).
- Small feature warning for details below nozzle/layer thresholds.
- Volume + mass estimate based on filament density and infill %.

### Stage 4 — Export handoff
- Export package with:
  - STL/3MF
  - profile JSON sidecar
  - project metadata (model name, material, revision)
- Add direct handoff adapters later (PrusaSlicer/OrcaSlicer/Bambu Studio) via profile mapping.

### Suggested data model
```json
{
  "printProfile": {
    "printer": "Voron 2.4",
    "bed": { "x": 250, "y": 250, "z": 250, "shape": "rect" },
    "nozzle": 0.4,
    "layerHeight": 0.2,
    "material": "PLA",
    "qualityPreset": "draft",
    "placement": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "layFlat": true,
      "centered": true
    }
  }
}
```

## Magnetic Letters improvement plan

### Problems observed
- Prior workflow could leave users with unwanted plate-like backing.
- Magnet placement required too much manual trial/error.
- Font choice had high impact on readability but lacked opinionated defaults.

### Changes implemented now
- New **Magnetic Letters Pro** example uses **glyph-first** mode by default (no forced backplate).
- Added `shape_mode = "glyph" | "tile"` for optional reinforcement.
- Added safer pocket placement with eroded mask clipping so pockets remain inside printable shape.
- Added font and clearance controls tuned for clearer letterforms.

### Next steps
- Add per-letter heuristics for skinny glyphs (I, J, L) and wide glyphs (M, W).
- Add magnet polarity preview cues for assembly consistency.
- Add multi-letter batch generation and optional kerning-aware nameplate mode.
