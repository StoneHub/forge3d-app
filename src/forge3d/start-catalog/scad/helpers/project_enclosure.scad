// Project Enclosure
outer_width = 90;
outer_depth = 60;
outer_height = 28;
wall_thickness = 2.4;
floor_thickness = 2.8;
corner_radius = 6;
lid_lip_height = 5;
lid_clearance = 0.35;

$fn = 48;

module rounded_rect(size = [outer_width, outer_depth], r = corner_radius) {
  offset(r = r) {
    offset(delta = -r) {
      square(size, center = true);
    }
  }
}

difference() {
  linear_extrude(height = outer_height) rounded_rect();

  translate([0, 0, floor_thickness]) {
    linear_extrude(height = outer_height - floor_thickness + 0.2) {
      rounded_rect(
        [outer_width - 2 * wall_thickness, outer_depth - 2 * wall_thickness],
        max(corner_radius - wall_thickness, 0.8)
      );
    }
  }
}

translate([0, 0, outer_height]) {
  linear_extrude(height = lid_lip_height) {
    rounded_rect(
      [
        outer_width - 2 * (wall_thickness + lid_clearance),
        outer_depth - 2 * (wall_thickness + lid_clearance)
      ],
      max(corner_radius - wall_thickness - lid_clearance, 0.8)
    );
  }
}
