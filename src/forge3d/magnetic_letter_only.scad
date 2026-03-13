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
emboss_chamfer = 0.8;     // Top edge softening (0 to disable)

// Optional reinforcing tile (disabled by default to avoid unwanted backplate)
shape_mode = "glyph";    // "glyph" | "tile"
tile_margin = 4;          // Only used in tile mode

// ── Magnet settings ─────────────────────────────────────────────────────────
magnet_d = 6.2;           // pocket diameter for nominal 6 mm magnets
magnet_depth = 2.3;
edge_clearance = 0.8;     // distance from pocket edge to letter edge
max_magnets = 5;

// Placement strategy
magnet_mode = "auto_grid"; // "auto_grid" | "spine" | "manual"
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
  if (emboss_chamfer > 0) {
    linear_extrude(height = letter_thickness - emboss_chamfer)
      printable_shape_2d();

    // Simple stepped chamfer near top for crisper looking edges.
    for (i = [0:4]) {
      t0 = i / 5;
      t1 = (i + 1) / 5;
      h0 = letter_thickness - emboss_chamfer + emboss_chamfer * t0;
      h1 = letter_thickness - emboss_chamfer + emboss_chamfer * t1;
      in0 = emboss_chamfer * 0.45 * t0;
      in1 = emboss_chamfer * 0.45 * t1;
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

function grid_candidates(extent, pitch) =
  [for (x = [-extent:pitch:extent]) for (y = [-extent:pitch:extent]) [x, y]];

function spine_candidates(n, y_span) =
  [for (i = [0:n - 1]) [0, y_span * (i / max(n - 1, 1) - 0.5)]];

module candidate_pockets() {
  pts = magnet_mode == "manual" ? manual_positions
    : magnet_mode == "spine" ? spine_candidates(spine_samples, spine_y_span)
    : grid_candidates(grid_extent, grid_pitch);

  // Keep pocket count bounded. First points are closest to center for grid mode.
  count = clamp_count(max_magnets, 1, len(pts));

  for (i = [0:count - 1]) {
    p = pts[i];
    translate([p[0], p[1], 0])
      cylinder(h = magnet_depth, d = magnet_d);
  }
}

// Final pocket set is clipped against the safe eroded mask.
module safe_pockets() {
  intersection() {
    linear_extrude(height = magnet_depth)
      safe_magnet_mask_2d();
    candidate_pockets();
  }
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
