// Rounded Offset Profile
width = 60;
depth = 36;
corner_radius = 5;
thickness = 8;

module rounded_profile(size = [width, depth], r = corner_radius) {
  offset(r = r) {
    offset(delta = -r) {
      square(size, center = true);
    }
  }
}

linear_extrude(height = thickness, center = true) rounded_profile();
