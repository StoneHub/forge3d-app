// Threaded Hole Test Block
block_size = [34, 34, 18];
major_diameter = 12.4;
thread_pitch = 2;
thread_depth = 0.8;
pilot_diameter = 10.5;

$fn = $preview ? 48 : 96;

module helical_thread_cut(major_d, pitch, length, depth) {
  slices = max(36, ceil(length / pitch * 30));
  linear_extrude(height = length, twist = -360 * length / pitch, slices = slices, convexity = 10) {
    translate([major_d / 2 - depth, 0]) {
      polygon(points = [
        [0, -pitch * 0.32],
        [depth, 0],
        [0, pitch * 0.32]
      ]);
    }
  }
}

difference() {
  cube(block_size, center = true);

  translate([0, 0, -block_size[2] / 2 - 0.1]) {
    cylinder(h = block_size[2] + 0.2, d = pilot_diameter);
    helical_thread_cut(major_diameter, thread_pitch, block_size[2] + 0.2, thread_depth);
  }
}
