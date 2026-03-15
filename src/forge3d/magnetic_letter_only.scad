// Magnetic Letters Pro (single-letter export)
//
// Render one letter:
//   openscad -q -D 'letter="M"' -o M.stl magnetic_letter_only.scad
//
// Goals of this version:
// 1) Clean letter silhouette by default (no forced backplate)
// 2) Safer pocket placement that stays inside the glyph
// 3) Better font controls and quality settings for print clarity

// ── Core text settings ──────────────────────────────────────────────────────
letter = "M";
font_name = "Bahnschrift:style=Bold";
letter_size = 88;         // Letter height in mm (88 ~= fits 100x100 bed)
letter_thickness = 8;     // Main print thickness
// Keep this off for glyph exports: hull-based chamfering can bridge open
// spaces in letters like M/W and create an unwanted backplate.
emboss_chamfer = 0;       // Optional top edge softening (tile mode only)

// Optional reinforcing tile (disabled by default to avoid unwanted backplate)
// @param shape_mode = "glyph" // type: enum, options: glyph,tile
shape_mode = "glyph";    // "glyph" | "tile"
tile_margin = 4;          // Only used in tile mode

// ── Magnet settings ─────────────────────────────────────────────────────────
magnet_d = 6.2;           // pocket diameter for nominal 6 mm magnets
magnet_depth = 2.3;
edge_clearance = 0.8;     // distance from pocket edge to letter edge
max_magnets = 5;

// Placement strategy
// @param magnet_mode = "smart" // type: enum, options: smart,auto_grid,spine,manual
magnet_mode = "smart"; // "smart" | "auto_grid" | "spine" | "manual"
manual_positions = [[-18, 16], [16, -16], [0, 0]];

// Auto-grid tunables
grid_pitch = 13;          // spacing between candidate centers
grid_extent = 42;         // candidate search radius

// Spine tunables (good for skinny letters)
spine_samples = 7;
spine_y_span = 30;

$fn = $preview ? 28 : 96;

// ── Geometry helpers ────────────────────────────────────────────────────────
module glyph_2d() {
  text(letter, size = letter_size, font = font_name,
    halign = "center", valign = "center");
}

module tile_2d() {
  offset(delta = tile_margin) glyph_2d();
}

module printable_shape_2d() {
  if (shape_mode == "tile") tile_2d();
  else glyph_2d();
}

// Eroded mask that guarantees full magnet fit within letter body.
module safe_magnet_mask_2d() {
  offset(r = -(magnet_d / 2 + edge_clearance)) printable_shape_2d();
}

module letter_body() {
  body_chamfer = shape_mode == "tile" ? emboss_chamfer : 0;

  if (body_chamfer > 0) {
    linear_extrude(height = letter_thickness - body_chamfer)
      printable_shape_2d();

    // Simple stepped chamfer near top for connected plaque/tile shapes.
    for (i = [0:4]) {
      t0 = i / 5;
      t1 = (i + 1) / 5;
      h0 = letter_thickness - body_chamfer + body_chamfer * t0;
      h1 = letter_thickness - body_chamfer + body_chamfer * t1;
      in0 = body_chamfer * 0.45 * t0;
      in1 = body_chamfer * 0.45 * t1;
      hull() {
        translate([0, 0, h0]) linear_extrude(0.01) offset(r = -in0) printable_shape_2d();
        translate([0, 0, h1]) linear_extrude(0.01) offset(r = -in1) printable_shape_2d();
      }
    }
  } else {
    linear_extrude(height = letter_thickness) printable_shape_2d();
  }
}

// ── Pocket candidate generation ─────────────────────────────────────────────
function clamp_count(n, lo, hi) = min(max(n, lo), hi);

function smart_candidates(ch) =
  ch == "A" ? [[-20, -20], [20, -20], [0, -5]] :
  ch == "B" ? [[-24, 18], [-24, -15], [14, 18], [14, -8]] :
  ch == "C" ? [[-30, 0], [0, 26], [0, -26]] :
  ch == "D" ? [[-24, 18], [-24, -18], [20, 0]] :
  ch == "E" ? [[-24, 20], [-24, -20], [10, 24], [10, -24]] :
  ch == "F" ? [[-24, 20], [-24, -8], [10, 26]] :
  ch == "G" ? [[-30, 0], [0, 26], [20, -8]] :
  ch == "H" ? [[-24, 15], [-24, -15], [24, 15], [24, -15]] :
  ch == "I" ? [[0, 18], [0, -18]] :
  ch == "J" ? [[16, 22], [0, -24]] :
  ch == "K" ? [[-24, 15], [-24, -15], [14, 22], [14, -22]] :
  ch == "L" ? [[-24, 18], [-24, -8], [12, -28]] :
  ch == "M" ? [[-30, 0], [-8, 0], [9, 0], [30, 0]] :
  ch == "N" ? [[-24, 15], [-24, -15], [24, 15], [24, -15]] :
  ch == "O" ? [[-28, 0], [28, 0], [0, 24], [0, -24]] :
  ch == "P" ? [[-24, 15], [-24, -20], [16, 18]] :
  ch == "Q" ? [[-28, 0], [0, 24], [24, -15]] :
  ch == "R" ? [[-24, 15], [-24, -20], [16, 18], [16, -20]] :
  ch == "S" ? [[-12, 20], [12, -20]] :
  ch == "T" ? [[-26, 28], [26, 28], [0, -10]] :
  ch == "U" ? [[-24, 15], [24, 15], [0, -26]] :
  ch == "V" ? [[-22, 22], [22, 22]] :
  ch == "W" ? [[-30, 5], [-10, -18], [10, -18], [30, 5]] :
  ch == "X" ? [[-18, 22], [18, 22], [-18, -22], [18, -22]] :
  ch == "Y" ? [[-22, 22], [22, 22], [0, -16]] :
  ch == "Z" ? [[10, 28], [0, 0], [-10, -28]] :
  [];

function ring_candidates(r, pitch) =
  r == 0 ? [[0, 0]] :
  concat(
    [for (x = [-r:r]) [x * pitch, -r * pitch]],
    [for (y = [-r + 1:r]) [r * pitch, y * pitch]],
    [for (x = [r - 1:-1:-r]) [x * pitch, r * pitch]],
    [for (y = [r - 1:-1:-r + 1]) [-r * pitch, y * pitch]]
  );

function grid_candidates(extent, pitch) =
  [for (ring = [0:floor(extent / pitch)], pt = ring_candidates(ring, pitch))
    if (abs(pt[0]) <= extent && abs(pt[1]) <= extent) pt];

function spine_candidates(n, y_span) =
  [for (i = [0:n - 1]) [0, y_span * (i / max(n - 1, 1) - 0.5)]];

module validated_pocket(point) {
  minkowski() {
    intersection() {
      linear_extrude(height = 0.02)
        safe_magnet_mask_2d();
      translate([point[0], point[1], 0])
        cylinder(h = 0.02, r = 0.01, $fn = 8);
    }
    cylinder(h = magnet_depth, d = magnet_d);
  }
}

module candidate_pockets() {
  pts = magnet_mode == "manual" ? manual_positions
    : magnet_mode == "spine" ? spine_candidates(spine_samples, spine_y_span)
    : magnet_mode == "smart" ? smart_candidates(letter)
    : grid_candidates(grid_extent, grid_pitch);

  // Keep pocket count bounded. Auto-grid now walks outward from center.
  count = clamp_count(max_magnets, 1, len(pts));

  for (i = [0:count - 1]) {
    validated_pocket(pts[i]);
  }
}

// Final pocket set is clipped against the safe eroded mask.
module safe_pockets() {
  candidate_pockets();
}

// ── Build ────────────────────────────────────────────────────────────────────
echo(str("MagneticLettersPro letter=", letter,
  " font=", font_name,
  " mode=", magnet_mode,
  " shape=", shape_mode,
  " magnets<=", max_magnets));

difference() {
  letter_body();
  safe_pockets();
}
