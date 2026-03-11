// Fridge magnet letter tile — fits 100×100 mm build plate
// Render one letter:
//   openscad -q -D 'letter="M"' -o M.stl magnetic_letter_only.scad
// Batch-render a word:
//   for L in M O E; do openscad -q -D "letter=\"$L\"" -o "$L.stl" magnetic_letter_only.scad; done
//
// Slicer tips for faster prints:
//   - 0.28 mm layer height (or 0.3 if your nozzle allows)
//   - 10–15 % infill (gyroid or grid) — or enable hollow below
//   - 3 perimeters is plenty for strength

// ╔══════════════════════════════════════════════════════════════════╗
// ║  SETTINGS — edit these, leave everything below alone            ║
// ╚══════════════════════════════════════════════════════════════════╝

letter    = "M";
size      = 88;   // glyph height in mm (88 ≈ full 100×100 plate)
thickness = 15;   // Z height of the tile

// ── MODE — uncomment exactly one ─────────────────────────────────────────────
mode = "smart";    // hardcoded per-letter positions for A–Z (best quality)
// mode = "spiral";  // auto-spiral; only pockets that FULLY fit inside are kept
// mode = "manual";  // use magnet_positions list below

// ── Font ─────────────────────────────────────────────────────────────────────
font_name = "Comic Sans MS:style=Bold";   // ← the MOE font
// font_name = "Bahnschrift:style=Bold";
// font_name = "Bahnschrift:style=Bold Condensed";
// font_name = "Liberation Sans:style=Bold";
// font_name = "Arial:style=Bold";
// font_name = "Impact";
// font_name = "Anton";                    // Google Font — narrow + punchy
// font_name = "Oswald:style=Bold";        // Google Font — tall + slim

// ── Fillet ───────────────────────────────────────────────────────────────────
// Rounded top edge — makes the face side feel nice.  Bottom stays flat for
// bed adhesion and magnet pockets.  Set to 0 to disable.
fillet_r     = 2;    // radius of the quarter-round (mm)
fillet_steps = 10;   // curve smoothness (more = smoother but slower render)

// ── Magnet spec ──────────────────────────────────────────────────────────────
magnet_d     = 6.2;  // pocket diameter (slightly loose for 6 mm disc magnets)
magnet_depth = 2.2;  // pocket depth

// ── MANUAL positions (used when mode = "manual") ─────────────────────────────
// Origin [0,0] = visual centre of the glyph.
magnet_positions = [
  [ 17,  15],
  [ 11, -15],
  [-15,  15],
];

// ── SPIRAL settings (used when mode = "spiral") ──────────────────────────────
spiral_max     = 4;   // target pocket count (magnets are expensive!)
spiral_spacing = 16;  // mm between candidate ring steps

// ╔══════════════════════════════════════════════════════════════════╗
// ║  PER-LETTER MAGNET POSITIONS  (mode = "smart")                  ║
// ║  Tuned for Comic Sans MS Bold at size = 88.                     ║
// ║  Coords are mm from the visual centre of each glyph.            ║
// ║  Safety-masked against the letter body so any position that      ║
// ║  misses the stroke is silently dropped.                          ║
// ╚══════════════════════════════════════════════════════════════════╝
function letter_magnets(ch) =
  ch == "A" ? [[-20, -20], [ 20, -20], [  0,  -5]             ] :
  ch == "B" ? [[-24,  18], [-24, -15], [ 14,  18], [ 14,  -8] ] :
  ch == "C" ? [[-30,   0], [  0,  26], [  0, -26]             ] :
  ch == "D" ? [[-24,  18], [-24, -18], [ 20,   0]             ] :
  ch == "E" ? [[-24,  20], [-24, -20], [ 10,  24], [ 10, -24] ] :
  ch == "F" ? [[-24,  20], [-24,  -8], [ 10,  26]             ] :
  ch == "G" ? [[-30,   0], [  0,  26], [ 20,  -8]             ] :
  ch == "H" ? [[-24,  15], [-24, -15], [ 24,  15], [ 24, -15] ] :
  ch == "I" ? [[  0,  18], [  0, -18]                         ] :
  ch == "J" ? [[ 16,  22], [  0, -24]                         ] :
  ch == "K" ? [[-24,  15], [-24, -15], [ 14,  22], [ 14, -22] ] :
  ch == "L" ? [[-24,  18], [-24,  -8], [ 12, -28]             ] :
  ch == "M" ? [[-30,   0], [ -8,   0], [  9,   0], [ 30,   0] ] :
  ch == "N" ? [[-24,  15], [-24, -15], [ 24,  15], [ 24, -15] ] :
  ch == "O" ? [[-28,   0], [ 28,   0], [  0,  24], [  0, -24] ] :
  ch == "P" ? [[-24,  15], [-24, -20], [ 16,  18]             ] :
  ch == "Q" ? [[-28,   0], [  0,  24], [ 24, -15]             ] :
  ch == "R" ? [[-24,  15], [-24, -20], [ 16,  18], [ 16, -20] ] :
  ch == "S" ? [[-12,  20], [ 12, -20]                         ] :
  ch == "T" ? [[-26,  28], [ 26,  28], [  0, -10]             ] :
  ch == "U" ? [[-24,  15], [ 24,  15], [  0, -26]             ] :
  ch == "V" ? [[-22,  22], [ 22,  22]                         ] :
  ch == "W" ? [[-30,   5], [-10, -18], [ 10, -18], [ 30,   5] ] :
  ch == "X" ? [[-18,  22], [ 18,  22], [-18, -22], [ 18, -22] ] :
  ch == "Y" ? [[-22,  22], [ 22,  22], [  0, -16]             ] :
  ch == "Z" ? [[ 10,  28], [  0,   0], [-10, -28]             ] :
  /* fallback */ [[0, 0]];

// ╔══════════════════════════════════════════════════════════════════╗
// ║  INTERNALS — nothing to edit below here                         ║
// ╚══════════════════════════════════════════════════════════════════╝

// Adaptive quality: fast in preview (F5), full detail in render (F6)
_fn = $preview ? 24 : 64;

// Spiral candidate generator — rings expand outward from [0,0].
function _ring(r, sp) =
  r == 0 ? [[0, 0]]
         : [for (a = [0 : 360 / (r * 6) : 359.9])
              [sp * r * cos(a), sp * r * sin(a)]];

function _spiral_pts(sp, rings) =
  [for (r = [0:rings], pt = _ring(r, sp)) pt];

_candidates = _spiral_pts(spiral_spacing, 4);  // ~60 candidates, inner-first

// ── Shared helpers ───────────────────────────────────────────────────────────

// 2D letter glyph — single source of truth for the shape
module _letter_2d() {
  text(letter, size = size, font = font_name,
       halign = "center", valign = "center");
}

// 2D letter eroded inward by magnet radius + margin.
module _eroded_2d() {
  offset(r = -(magnet_d / 2 + 0.3))
    _letter_2d();
}

// ── Letter body with optional fillet ─────────────────────────────────────────

module letter_body() {
  if (fillet_r > 0) {
    // Flat-sided main body up to the fillet zone
    linear_extrude(height = thickness - fillet_r)
      _letter_2d();

    // Quarter-circle rolloff at the top edge.
    // Each step hulls two thin slices at slightly different offsets/heights,
    // tracing a smooth arc that rounds the edge.
    for (i = [0 : fillet_steps - 1]) {
      t0 = i       / fillet_steps;
      t1 = (i + 1) / fillet_steps;
      // Quarter-circle parameterisation
      inset0 = fillet_r * (1 - cos(t0 * 90));
      inset1 = fillet_r * (1 - cos(t1 * 90));
      z0 = thickness - fillet_r + fillet_r * sin(t0 * 90);
      z1 = thickness - fillet_r + fillet_r * sin(t1 * 90);
      hull() {
        translate([0, 0, z0])
          linear_extrude(height = 0.01)
            offset(r = -inset0) _letter_2d();
        translate([0, 0, z1])
          linear_extrude(height = 0.01)
            offset(r = -inset1) _letter_2d();
      }
    }
  } else {
    // No fillet — simple extrude
    linear_extrude(height = thickness)
      _letter_2d();
  }
}

// ── Pocket modules ───────────────────────────────────────────────────────────

// SMART — hardcoded positions, masked against the letter body.
module smart_pockets() {
  intersection() {
    linear_extrude(height = magnet_depth)
      _letter_2d();
    union()
      for (p = letter_magnets(letter))
        translate([p[0], p[1], 0])
          cylinder(h = magnet_depth, d = magnet_d, $fn = _fn);
  }
}

// SPIRAL — morphological erosion guarantees every surviving pocket fully fits.
module spiral_pockets() {
  test_count = min(spiral_max * 5, len(_candidates));
  for (i = [0 : test_count - 1]) {
    cx = _candidates[i][0];
    cy = _candidates[i][1];
    minkowski() {
      intersection() {
        linear_extrude(height = 0.02)
          _eroded_2d();
        translate([cx, cy, 0])
          cylinder(h = 0.02, r = 0.01, $fn = 4);
      }
      cylinder(h = magnet_depth, d = magnet_d, $fn = _fn);
    }
  }
}

// MANUAL — raw positions, no masking.
module manual_pockets() {
  for (p = magnet_positions)
    translate([p[0], p[1], 0])
      cylinder(h = magnet_depth, d = magnet_d, $fn = _fn);
}

// ── Main ─────────────────────────────────────────────────────────────────────

echo(str("letter=\"", letter, "\"  mode=", mode,
         "  font=", font_name,
         "  fillet=", fillet_r, "mm"));

difference() {
  letter_body();
  if      (mode == "smart")  smart_pockets();
  else if (mode == "spiral") spiral_pockets();
  else                       manual_pockets();
}
