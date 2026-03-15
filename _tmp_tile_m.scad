letter = "M";
font_name = "Bahnschrift:style=Bold";
letter_size = 88;
letter_thickness = 8;
shape_mode = "tile";
tile_margin = 4;
magnet_d = 6.2;
magnet_depth = 2.3;
edge_clearance = 0.8;
max_magnets = 5;
magnet_mode = "auto_grid";
manual_positions = [[-18, 16], [16, -16], [0, 0]];
grid_pitch = 13;
grid_extent = 42;
$fn = 48;
module glyph_2d() { text(letter, size = letter_size, font = font_name, halign = "center", valign = "center"); }
module printable_shape_2d() { if (shape_mode == "tile") offset(delta = tile_margin) glyph_2d(); else glyph_2d(); }
module safe_mask_2d() { offset(r = -(magnet_d / 2 + edge_clearance)) printable_shape_2d(); }
function grid_candidates(extent, pitch) = [for (x = [-extent:pitch:extent]) for (y = [-extent:pitch:extent]) [x, y]];
module pocket_candidates() { pts = magnet_mode == "manual" ? manual_positions : grid_candidates(grid_extent, grid_pitch); for (i = [0:min(max_magnets, len(pts)) - 1]) { p = pts[i]; translate([p[0], p[1], 0]) cylinder(h = magnet_depth, d = magnet_d); } }
difference() { linear_extrude(height = letter_thickness) printable_shape_2d(); intersection() { linear_extrude(height = magnet_depth) safe_mask_2d(); pocket_candidates(); } }
