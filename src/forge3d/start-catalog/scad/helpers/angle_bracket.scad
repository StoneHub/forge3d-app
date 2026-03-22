// Angle Bracket
leg_length = 64;
bracket_width = 22;
thickness = 4;
gusset_thickness = 5;
hole_diameter = 4.8;
hole_margin = 14;

$fn = $preview ? 32 : 64;

module gusset_profile() {
  polygon(points = [
    [0, 0],
    [leg_length - thickness, 0],
    [0, leg_length - thickness]
  ]);
}

difference() {
  union() {
    translate([leg_length / 2, bracket_width / 2, thickness / 2]) {
      cube([leg_length, bracket_width, thickness], center = true);
    }

    translate([thickness / 2, bracket_width / 2, leg_length / 2]) {
      cube([thickness, bracket_width, leg_length], center = true);
    }

    translate([thickness, 0, thickness]) {
      rotate([-90, 0, 0]) linear_extrude(height = bracket_width) gusset_profile();
    }
  }

  translate([hole_margin, bracket_width / 2, -0.1]) {
    cylinder(h = thickness + 0.2, d = hole_diameter);
  }

  translate([leg_length - hole_margin, bracket_width / 2, -0.1]) {
    cylinder(h = thickness + 0.2, d = hole_diameter);
  }

  translate([-0.1, bracket_width / 2, hole_margin]) {
    rotate([0, 90, 0]) cylinder(h = thickness + 0.2, d = hole_diameter);
  }

  translate([-0.1, bracket_width / 2, leg_length - hole_margin]) {
    rotate([0, 90, 0]) cylinder(h = thickness + 0.2, d = hole_diameter);
  }
}
