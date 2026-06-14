# Forge3D Builder Mode Design

Date: 2026-06-14
Status: approved design draft

## Product Direction

Forge3D should keep its current OpenSCAD identity and add **Builder Mode** as the STL-first workbench between Design Mode and future Print Mode.

The mode sequence is:

```text
Design Mode -> Builder Mode -> Print Mode later
```

Builder Mode V1 is not a slicer and not a general mesh-repair app. It is an **STL inspection and boolean assembly workbench** for quick object edits, merges, cutouts, and cleanup-style composition.

V1 supports:

- carrying the current OpenSCAD render into Builder Mode automatically
- importing additional STL files
- selecting, moving, rotating, scaling, duplicating, hiding, locking, and deleting objects
- inspecting selected-object dimensions
- using a free point-to-point surface measurement tool
- running non-destructive Union, Subtract, and Intersect operations
- exporting selected objects, boolean results, or combined visible scene output as STL

The stack decision is:

- **Three.js** handles interactive scene work: display, selection, transforms, measurement picks, and object list state.
- **Native OpenSCAD** handles final boolean mesh generation by rendering temporary wrapper `.scad` files that import transformed STLs and apply boolean operations.

This keeps the UI responsive while relying on the native solid backend Forge3D already trusts.

## Scope

### In Scope For V1

- Builder Mode shell in the existing Forge3D app
- automatic handoff from current Design render to Builder object
- STL import into the Builder scene
- object list with visibility, lock, duplicate, delete, and selection controls
- selected-object transform controls and numeric fields
- selected-object bounding-box dimensions
- free surface-pick measurement tool
- non-destructive OpenSCAD-backed booleans
- result object creation with source inputs hidden, not deleted
- selected/result/combined STL export
- clear boolean progress and error reporting

### Out Of Scope For V1

- full mesh repair
- slicer integration
- printer bed layout
- vertex, edge, face, radius, diameter, or angle snapping
- automatic collision resolution
- general Blender-style mesh editing
- replacing Forge3D with a separate STL-only app

The V1 foundation should leave room for repair, snapping, and print prep later without pulling them into the first implementation.

## Architecture

Builder Mode is built around a small set of explicit units.

| Unit | Responsibility |
| --- | --- |
| `builderScene` state | Source objects, transforms, visibility, locks, selection, boolean results, measurements |
| Builder sidebar | Object list, STL import, duplicate/delete, visibility/lock controls |
| Builder inspector | Numeric transform fields, dimensions, measurement history, boolean controls |
| Viewport renderer | Draw transformed STL objects, selected bounds, transform handles, measurement points/lines |
| Boolean runner | Generate temp `.scad`, write input STLs, call OpenSCAD through Electron IPC, parse result STL |
| Exporter | Export selected object, boolean result, or combined scene output |

The important boundary is that **source geometry and transformed scene state stay separate**. Original STL vertices are not rewritten when a user moves, rotates, or scales an object. Boolean and export operations bake transforms only when producing derived output.

That prevents cumulative geometry damage and keeps undo/recovery practical.

## Data Model

Recommended state shape:

```js
builderScene = {
  parts: [
    {
      id: 'part-1',
      name: 'current-render',
      source: {
        kind: 'design-render' | 'stl-file' | 'boolean-result',
        filePath: null,
        sourcePartIds: [],
        operation: null,
      },
      geometry: {
        vertices: Float32Array,
        normals: Float32Array,
      },
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      visible: true,
      locked: false,
      material: {
        color: '#75b8d4',
        opacity: 1,
      },
      stats: {
        bounds: { x: 0, y: 0, z: 0 },
        volume: null,
      },
    },
  ],
  selection: ['part-1'],
  snap: {
    enabled: true,
    translateStepMm: 1,
    rotateStepDeg: 15,
  },
  measurement: {
    active: false,
    draftPoints: [],
    history: [],
  },
}
```

Measurement entries should be future-proofed for vertex and edge snapping even though V1 only supports surface picks:

```js
{
  id: 'measurement-1',
  label: 'Measurement 1',
  points: [
    {
      partId: 'part-1',
      worldPosition: [10.2, 4.1, -2.5],
      localPosition: [8.7, 1.2, -2.5],
      faceIndex: 42,
      snapMode: 'surface',
    },
    {
      partId: 'part-2',
      worldPosition: [31.4, 4.1, -2.5],
      localPosition: [2.4, 5.9, -2.5],
      faceIndex: 88,
      snapMode: 'surface',
    },
  ],
  distanceMm: 21.2,
  createdAt: '2026-06-14T00:00:00.000Z',
  stale: false,
}
```

When snapping arrives later, `snapMode` can become `vertex`, `edge`, `face`, `origin`, or `grid` without changing the measurement model.

## Data Flow

```text
Design render STL
  -> Builder scene object

Imported STL
  -> parse STL
  -> Builder scene object

User transform
  -> update object transform
  -> viewport redraw
  -> dimensions recalc

Pick two surface points
  -> measurement draft
  -> committed measurement entry
  -> viewport line + inspector distance

Union/Subtract/Intersect
  -> selected objects + transforms
  -> temp OpenSCAD wrapper
  -> native OpenSCAD render
  -> result STL object added
  -> input objects hidden, not deleted

Export
  -> selected/result/combined visible objects
  -> STL file
```

## User Experience

Builder Mode should feel like a focused desktop utility, not a broad CAD suite.

```text
Left: Object List       Center: 3D Viewport        Right: Inspector
- current render        - floor grid               - selected dimensions
- imported STLs         - selected bounds          - transform fields
- boolean results       - move/rotate handles      - measurement tool
- visibility/lock       - measurement line         - boolean actions
```

Primary toolbar:

```text
Import STL | Add Current Render | Duplicate | Drop to Floor | Center | Union | Subtract | Intersect | Export
```

### Measurement UX

- Inspector has a **Pick Points** action.
- When active, clicking mesh surfaces records point A and then point B.
- The viewport draws two markers and a line.
- The inspector shows the latest distance in millimeters.
- Recent measurement history stays visible.
- `Esc` or **Clear Picks** exits active measurement.
- V1 does not snap to vertices or edges.
- Each pick stores object id, world position, local position, face index if available, and snap mode `surface`.

If a picked object is transformed after a measurement, the measurement remains visible as a logged world-space distance but is marked stale.

### Boolean UX

- Boolean buttons enable only when the selection is valid.
- Union and Intersect require at least two selected objects.
- Subtract uses ordered selection: target first, cutters after.
- Boolean results get generated names such as `Subtract bracket - cutout`.
- Source inputs are hidden and linked as recoverable sources.
- Source inputs are not deleted by default.
- The console or bottom pane shows OpenSCAD progress and errors.

## Boolean Execution

V1 booleans use OpenSCAD wrappers rather than a JavaScript mesh boolean library.

For each operation:

1. Resolve selected objects and transforms.
2. Export each selected object to a temporary STL with its transform baked.
3. Generate a temporary `.scad` wrapper.
4. Render the wrapper through existing native OpenSCAD IPC.
5. Parse the resulting STL.
6. Add a new boolean-result object to the Builder scene.
7. Hide source inputs and store their ids in the result metadata.

Example wrapper shape:

```scad
union() {
  import("part-a-transformed.stl");
  import("part-b-transformed.stl");
}
```

Subtract wrapper shape:

```scad
difference() {
  import("target-transformed.stl");
  import("cutter-transformed.stl");
}
```

The implementation should not mutate original imported STL geometry during this process.

## Error Handling

### Boolean Failures

When OpenSCAD boolean execution fails:

- keep all source objects unchanged
- keep source objects visible
- do not create a result object
- show the OpenSCAD error in the console or problems area
- preserve the generated wrapper path in dev builds for debugging
- expose a single useful recovery action such as **Copy Error** or **Open Boolean Wrapper**

### Measurement Failures

- Clicking empty space leaves Pick Points active and does not add a draft point.
- If the selected object is hidden or deleted before point B, clear the draft measurement.
- If a measurement references a transformed object, mark that measurement stale instead of silently changing its value.
- If face index is unavailable, store `faceIndex: null` and still record the surface pick.

## Verification

The implementation is complete only when these pass:

- existing production build succeeds
- Electron main/preload syntax checks pass if those files change:
  - `node --check electron/main.mjs`
  - `node --check electron/preload.cjs`
- manual Electron smoke confirms:
  - Design render carries into Builder Mode automatically
  - two STL files can be imported
  - an object can be moved and rotated
  - Pick Points logs a point-to-point surface measurement
  - Union creates a new result object and hides inputs
  - a forced Subtract failure leaves source objects intact
  - exported result STL parses back into Forge3D

## Recommendation

Build Builder Mode inside the existing Forge3D project. Do not create a separate repo for this pivot.

This preserves Forge3D's strongest existing foundation while addressing the practical gap left by Microsoft 3D Builder on macOS: fast STL inspection, placement, boolean edits, and export.
