// Threaded Bolt Starter
major_diameter = 12;
thread_pitch = 2;
thread_length = 18;
shank_length = 8;
head_diameter = 18;
head_height = 6;
thread_depth = 0.8;

$fn = $preview ? 40 : 88;

eps = 0.04;

module hex_head(diameter, height) {
  cylinder(h = height + eps, d = diameter, $fn = 6);
}

module shank(diameter, length) {
  cylinder(h = length, d = diameter);
}

module helical_thread(major_d, pitch, length, depth) {
  root_d = major_d - 2 * depth;
  slices = max(48, ceil(length / pitch * 36));

  linear_extrude(height = length + eps, twist = -360 * (length + eps) / pitch, slices = slices, convexity = 10) {
    translate([root_d / 2 - eps, 0]) {
      polygon(points = [
        [-eps, -pitch * 0.30],
        [depth, 0],
        [-eps, pitch * 0.30]
      ]);
    }
  }
}

union() {
  hex_head(head_diameter, head_height);
  translate([0, 0, head_height - eps]) {
    shank(major_diameter - 2 * thread_depth + eps, shank_length + thread_length + 2 * eps);
  }
  translate([0, 0, head_height + shank_length - eps]) {
    helical_thread(major_diameter, thread_pitch, thread_length, thread_depth);
  }
}
