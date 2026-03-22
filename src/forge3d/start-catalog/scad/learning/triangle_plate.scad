// Triangle Plate
side_length = 72;
plate_thickness = 5;
corner_radius = 4;
hole_diameter = 4.8;
hole_offset = 10;

$fn = $preview ? 32 : 72;

triangle_height = side_length * sqrt(3) / 2;

function raw_triangle_points() = [
  [-side_length / 2, -triangle_height / 3],
  [side_length / 2, -triangle_height / 3],
  [0, triangle_height * 2 / 3]
];

module triangle_2d() {
  offset(r = corner_radius) {
    offset(delta = -corner_radius) {
      polygon(points = raw_triangle_points());
    }
  }
}

difference() {
  linear_extrude(height = plate_thickness) triangle_2d();

  for (pt = raw_triangle_points()) {
    translate([
      pt[0] * (1 - hole_offset / side_length),
      pt[1] * (1 - hole_offset / side_length),
      -0.1
    ]) cylinder(h = plate_thickness + 0.2, d = hole_diameter);
  }
}
