// Quads Relief
// Forge3D curated example inspired by Jeff Barr's MIT collection.

$fn = $preview ? 24 : 48;

rows = 7;
cols = 7;
cell_size = 18;
cell_gap = 2.4;
quad_size = 13.5;
base_thickness = 1.6;
height_base = 3.8;
height_variation = 3.2;
perturb = 2.1;

function grid_width() = cols * cell_size + (cols - 1) * cell_gap;
function grid_depth() = rows * cell_size + (rows - 1) * cell_gap;

function cell_center(row, col) = [
  col * (cell_size + cell_gap),
  row * (cell_size + cell_gap)
];

function quad_height(row, col) =
  height_base + height_variation * (0.55 + 0.45 * sin(row * 31 + col * 17));

function skew(row, col, seed) =
  sin(row * (17 + seed) + col * (29 - seed)) * perturb;

module quad_tile(row, col) {
  center_point = cell_center(row, col);
  half_size = quad_size / 2;
  points = [
    [center_point[0] - half_size + skew(row, col, 3), center_point[1] - half_size + skew(row, col, 7)],
    [center_point[0] + half_size + skew(row, col, 11), center_point[1] - half_size + skew(row, col, 13)],
    [center_point[0] + half_size + skew(row, col, 17), center_point[1] + half_size + skew(row, col, 19)],
    [center_point[0] - half_size + skew(row, col, 23), center_point[1] + half_size + skew(row, col, 5)]
  ];

  translate([0, 0, base_thickness]) {
    linear_extrude(height = quad_height(row, col), scale = 0.84, convexity = 6) {
      polygon(points = points);
    }
  }
}

color("Gainsboro") {
  union() {
    translate([-grid_width() / 2 - 8, -grid_depth() / 2 - 8, 0]) {
      cube([grid_width() + 16, grid_depth() + 16, base_thickness], center = false);
    }

    translate([-grid_width() / 2, -grid_depth() / 2, 0]) {
      for (row = [0 : rows - 1]) {
        for (col = [0 : cols - 1]) {
          quad_tile(row, col);
        }
      }
    }
  }
}
