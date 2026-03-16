# Forge3D Assembly Mode Plan

## Goal

Add a post-OpenSCAD workspace for working with rendered meshes and imported printable assets before slicing.

This is the stage where users should be able to:

- load multiple parts into one scene
- place them on a virtual floor
- move, rotate, and duplicate them
- align or drop them to the floor
- use simple boolean operations on mesh parts
- measure distances and bounding-box dimensions
- export a combined STL when they are done

## Recommendation

Forge3D should become a three-stage workflow:

1. Design Mode
   OpenSCAD editor, params, templates/start, native OpenSCAD render
2. Assembly Mode
   Mesh scene workspace for STL-first fit, placement, booleans, measurement, and orientation
3. Print Mode
   Printer-specific bed, slicing profiles, auto-arrange, and G-code export

Do not combine Assembly and Print into one first pass.

Why:

- Assembly tasks are about geometry and fit, not printer constraints
- printer bed, filament, and slicing settings add a second layer of complexity
- many users will want Design + Assembly without ever touching slicer settings
- some users may want to inspect, combine, and orient existing STL assets without writing OpenSCAD

## Research Takeaways

The Microsoft 3D Builder pattern is useful here because it treats "object editing" and "print targeting" as related but not identical workflows.

Key patterns I found:

- Multiple objects in one editor scene are a first-class workflow, not a hack
- Selection is object-based, with a clear bounding-box highlight
- Move, rotate, and scale support both direct manipulation and precise numeric entry
- Boolean operations are selection-scoped and only appear when multiple solid objects are selected
- Measurement is a visible, normal tool for split-and-fit workflows
- Collision and snapping behavior matter enough that 3D Builder exposed settings to turn them on or off
- Users expected to place one object inside another for subtract/intersect workflows, and collision settings could block that if left enabled

The strongest product lesson is this:

Use safe, guided defaults for placement, but make overlap and collision assistance optional so subtract/intersect workflows do not feel broken.

## Fit With Forge3D Today

Forge3D already has the foundation for an Assembly Mode:

- native OpenSCAD render already produces STL bytes
- `src/forge3d/stl-parser.js` already turns STL into geometry
- `src/forge3d/renderer.js` already owns the viewport and floor/grid logic
- the existing roadmap already points toward a post-editor assembly/print layer in `docs/DEVPLAN.md` and `docs/WORKFLOW.md`

The main architectural shift is moving from "one rendered mesh" to "a scene of managed parts."

## Assembly Mode V1

### Core UX

- Add an `Assembly Mode` button next to the existing modeling controls
- Carry the current rendered mesh into Assembly Mode as the first part
- Let users add:
  - current file render
  - another `.scad` file rendered through OpenSCAD
  - `.stl` files directly
- Show a scene list with per-part visibility, lock, duplicate, delete, and source label
- Show transform controls for the selected part
- Keep a generic floor plane, not a printer bed, in V1

### Viewport Behavior

- Free camera, but floor always visible
- Selection outline and bounding box
- Move gizmo with plane-constrained drag
- Rotate around floor normal by default
- Optional scale, but hide it behind an advanced toggle because print workflows usually prefer true dimensions
- "Drop to Floor" action on selection
- "Gravity Assist" toggle:
  - on: selected part drops to floor or lands on top of intersected support geometry
  - off: free placement in 3D space so booleans are easy
- "Snap" toggle:
  - floor snap in mm increments
  - rotation snap in degrees
- "Collision" toggle:
  - prevents accidental overlap when arranging parts side by side
  - must be easy to disable for subtract/intersect workflows

### Tools

- Add Part
- Duplicate
- Delete
- Group Select
- Drop to Floor
- Center Selected
- Measure
- Union
- Subtract
- Intersect
- Export Selected
- Export Combined

## Why A Floor, Not A Bed, For V1

Use a neutral "virtual floor" first.

That supports:

- magnetic letters side by side in a scene
- checking how one STL nests into another
- orienting a model to sit flat
- quick boolean prep

Do not introduce printer-bed constraints until Print Mode.

If a user sees a printer bed too early, they will assume slicing rules, skirt/brim concepts, and out-of-bounds warnings are active. That is not the right mental model for basic multi-part editing.

## Data Model

Recommended Assembly Mode state:

```js
assemblyScene: {
  parts: [
    {
      id: 'part-1',
      name: 'magnetic_A',
      source: {
        kind: 'rendered-scad' | 'scad-file' | 'stl-file',
        filePath: 'C:/...',
        codeFilePath: 'C:/...' | null,
      },
      mesh: {
        vertices: Float32Array,
        normals: Float32Array,
      },
      transform: {
        position: [x, y, z],
        rotation: [x, y, z],
        scale: [1, 1, 1],
      },
      visible: true,
      locked: false,
      selected: false,
      material: {
        color: '#75b8d4',
        opacity: 1,
      },
      stats: {
        bounds: { x, y, z },
        volume: null,
      },
    },
  ],
  selection: ['part-1'],
  floor: {
    snapEnabled: true,
    snapStep: 1,
    gravityEnabled: true,
    collisionEnabled: false,
  },
  measurement: {
    active: false,
    points: [],
    unit: 'mm',
  },
}
```

## Implementation Phases

### Phase A1: Multi-Part Scene

- Introduce `mode: 'design' | 'assembly' | 'print'`
- Add Assembly Mode shell and scene state
- Carry the current render into Assembly Mode
- Add `Add STL` and `Add SCAD File`
- Scene list with select, visibility, duplicate, delete
- Reuse current renderer with managed meshes instead of a single `stlGeometry`

### Phase A2: Transform And Placement

- Per-part transform gizmos
- Numeric X/Y/Z and rotation entry
- Drop to floor
- Center selected
- Snap toggle
- Collision toggle
- Gravity assist toggle

### Phase A3: Measurement

- Bounding-box dimensions for selected part
- Point-to-point measure tool in viewport
- Optional face-to-face measure later
- Keep units in mm first

### Phase A4: Mesh Booleans

- Union, subtract, intersect on selected parts
- Operate on duplicated working meshes, never on the original source file
- Replace selection with a derived result part
- Keep originals hidden in a history stack for undo/recovery
- Export combined STL after operation

### Phase A5: Scene Persistence

- Save/load assembly sessions without touching the original `.scad`
- Suggested file format: `.forge3dscene.json`
- Store part sources, transforms, visibility, and derived mesh references

### Phase A6: Bridge To Print Mode

- Convert Assembly Mode scene into bed parts
- Introduce printer-specific bed dimensions and out-of-bounds warnings
- Add auto-arrange, slicing profiles, and G-code

## Boolean Strategy

Do not fake booleans visually in the viewport.

Assembly Mode should use a real mesh boolean backend so exports are printable. The implementation detail can be chosen later, but the rule should be:

- no custom hand-rolled triangle booleans
- use a dedicated mesh boolean library or backend
- validate manifoldness or at least report likely broken output

## Measurement Strategy

V1 measurement should be simple:

- selected-part width, depth, height
- point-to-point distance
- floor distance from lowest point

That already covers most maker use cases:

- "will this letter fit next to that one?"
- "how deep is this cutout?"
- "how tall is this assembled part after I stack two bodies?"

## Magnetic Letters Test Workflow

This should be a first-class dogfood scenario:

1. Open one magnetic letter `.scad`
2. Build it
3. Enter Assembly Mode
4. Add several other rendered letters from the same folder
5. Drop them to the floor
6. Arrange them side by side
7. Measure spacing and total width
8. Optionally boolean-merge or subtract connector geometry
9. Export a combined STL

If Forge3D feels great for this, the mode is on the right track.

## Recommended Product Boundary

For the next phase:

- build Assembly Mode first
- keep printer/bed/slicer controls out of it
- let Print Mode be the next dedicated stage

In short:

- Design Mode answers "how do I make the part?"
- Assembly Mode answers "how do these parts fit and combine?"
- Print Mode answers "how do I print this on a real machine?"

## Suggested Success Criteria

- Users can import at least 2 STL assets and 1 rendered SCAD asset into one scene
- Users can arrange parts on a floor without editing OpenSCAD code
- Users can disable collision assistance when they need overlap for booleans
- Users can measure size and spacing in mm
- Users can export a combined STL
- Users understand the difference between Assembly Mode and Print Mode

## Sources

- Microsoft 3D Builder FAQ: multi-object scene, move/rotate/scale, numeric transforms, measurement units
  - https://learn.microsoft.com/en-us/answers/questions/2628824/3d-builder-faq
- Microsoft 3D Builder Q&A: snapping and collision settings affect whether objects can overlap for subtract/intersect workflows
  - https://learn.microsoft.com/en-us/answers/questions/3164057/3d-builder-cant-intersect-subtract-or-place-object
- Microsoft 3D Builder tutorial: boolean operations in edit mode
  - https://learn.microsoft.com/en-us/shows/3d-printing/3d-builder-tutorial-part-4-building-3d-models-edit-mode
- Microsoft Q&A: measurement plus cut/split workflow
  - https://learn.microsoft.com/en-us/answers/questions/4060736/measuring-an-object-in-3d-builder
- Forge3D local workflow draft for later printer-specific Print Mode
  - `docs/WORKFLOW.md`
