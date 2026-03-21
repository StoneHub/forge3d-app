// Threaded Bolt Starter
major_diameter = 12;
thread_pitch = 2;
thread_length = 20;
shank_length = 10;
head_diameter = 20;
head_height = 7;
thread_depth = 0.9;

$fn = $preview ? 48 : 96;

module helical_thread(major_d, pitch, length, depth) {
  slices = max(36, ceil(length / pitch * 30));
  linear_extrude(height = length, twist = -360 * length / pitch, slices = slices, convexity = 10) {
    translate([major_d / 2 - depth, 0]) {
      polygon(points = [
        [0, -pitch * 0.28],
        [depth, 0],
        [0, pitch * 0.28]
      ]);
    }
  }
}

union() {
  cylinder(h = head_height, d = head_diameter, $fn = 6);
  translate([0, 0, head_height]) cylinder(h = shank_length, d = major_diameter - 2 * thread_depth);
  translate([0, 0, head_height + shank_length]) {
    union() {
      cylinder(h = thread_length, d = major_diameter - 2 * thread_depth);
      helical_thread(major_diameter, thread_pitch, thread_length, thread_depth);
    }
  }
}
