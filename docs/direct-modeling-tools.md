# Direct modeling tools

The next tools should build on Forge3D's retained source/cutter/result parts and undo history. Original `.scad` files remain unchanged. A successful operation produces a new result and hides its inputs; a failure leaves the scene usable.

## Toolbar

Today: **Measure · Hole · View ▾**. View holds grid, axes, edges, dimensions, appearance, and capture. Keep the default row short and give buttons comfortable hit targets.

As more operations ship: **Measure · Modify ▾ · View ▾**. Modify contains Hole, Merge, Split, and the less common Subtract/Intersect operations. The active operation gets a compact control panel over the bottom of the viewport with its parameters, Apply, and Cancel. Keep unavailable features out of the toolbar until they work. Tooltips explain disabled actions; keep tutorials out of the permanent chrome.

## Implementation order

| Tool | Interaction | Existing foundation | Acceptance evidence |
| --- | --- | --- | --- |
| Merge | Select two or more parts; preview the selection; Merge | Existing union worker, retained operands, derived parts, undo | Overlapping solids form one result; disjoint solids remain separate shells inside that result; undo and reopen preserve inputs |
| Split | Place a cutting plane; choose X/Y/Z or a picked face; adjust offset; keep both sides or one | Existing intersection/subtraction worker; needs plane controls and capped results | Known-volume block split; oblique cuts; multiple shells; no-cut plane; both pieces export closed and stay in their original positions |
| Align | Select reference and moving parts; align centers or min/max faces by axis | Bounds, transforms, existing Center/Drop to Floor | Rotated bounds and locked parts; predictable reference; undo |
| Hollow / shell | Set wall thickness and opening | Requires a robust geometry backend beyond simple mesh booleans | Defer until thickness and manifold validation are dependable |

Merge and Split are different from Group: Merge changes geometry; Group only coordinates selection and movement. Do not present them as interchangeable.

For Merge, promote the existing union capability before adding a second implementation. Add multi-selection with a visible count and an explicit primary/reference part. Preserve all inputs and provenance in the saved scene.

For Split, use a translucent plane and live position preview, then perform the geometry operation off the UI thread. Account for the complete model bounds; avoid fixed-size half-space boxes that silently fail on large parts. Do not move or floor-align the generated halves automatically. Define behavior for tangent/coplanar faces and empty halves. Robustness work belongs with the native boolean adapter tracked in #11.

Surface sketches, precise edge/vertex snaps, and editable cut parameters remain tracked in #33. A moved cutter must not imply its old derived result has been recomputed: explicit regeneration and stale-result status come before automatic updates.
