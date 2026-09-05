# Measure and cut on the model

**Measure** is available above the viewport in Design and Assembly. Click two points on visible model surfaces to see their straight-line distance in millimeters. The markers and label stay visible until the next pair or **Done**. Drag to orbit; right-drag to pan. Assembly also keeps a session measurement log in the inspector.

These are picks on the rendered triangle mesh, not constrained vertex/edge snaps or distances along a curved surface. Quick renders can approximate curved surfaces more coarsely. Use a Final render when inspecting detailed geometry. Rebuilding, transforming a part, or switching modes clears the active measurements so old coordinates are not mistaken for current ones.

**Hole** works in Assembly. From Design, it opens Assembly (rendering Final first when required); click **Hole** there, then click the target surface. Set the diameter in millimeters and inspect the red cutter preview. **Cut hole** creates a new subtracted part and retains the original part and cutter, hidden in the parts list. Undo restores the previous scene. Save Scene preserves all three parts and the cutter's OpenSCAD text.

The round cutter follows the picked triangle's surface normal and extends through the target's entire bounds in that direction. It affects only that target, even when other parts overlap. Repeated cuts can be applied to the new result. Locked parts cannot be cut. The calculation runs in the existing assembly boolean worker and reports failures without replacing the target.

Expand **OpenSCAD cutter** in the preview or result inspector to select and copy the snippet. It uses Z-up millimeter coordinates for the assembled scene. Its example `difference()` expects a base STL exported in those same coordinates; it is not an insertion into the original part's local source coordinates. The source `.scad` stays unchanged.

This first tool creates round through-holes. Arbitrary drawn profiles, blind pockets, edge/vertex snaps, and automatic regeneration after editing a source or cutter are not implemented. The retained parts are editable snapshots, and the subtraction result is a snapshot; moving a hidden cutter does not automatically recut its result.
