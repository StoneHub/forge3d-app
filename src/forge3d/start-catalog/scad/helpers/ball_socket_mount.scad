// Ball Socket Mount
ball_diameter = 24;
socket_clearance = 0.5;
socket_wall = 4;
socket_stem_height = 10;
base_diameter = 42;
base_thickness = 6;
opening_scale = 0.70;
slot_width = 3.5;
screw_spacing = 24;
screw_diameter = 4.4;

$fn = $preview ? 24 : 56;

ball_radius = ball_diameter / 2;
socket_radius = ball_radius + socket_clearance + socket_wall;

difference() {
  union() {
    cylinder(h = base_thickness, d = base_diameter);

    translate([0, 0, base_thickness]) {
      cylinder(h = socket_stem_height, d1 = base_diameter * 0.72, d2 = socket_radius * 2.0);
    }

    translate([0, 0, base_thickness + socket_stem_height + ball_radius * 0.15]) {
      sphere(r = socket_radius);
    }
  }

  translate([0, 0, base_thickness + socket_stem_height + ball_radius * 0.15]) {
    sphere(r = ball_radius + socket_clearance);
  }

  translate([0, 0, base_thickness + socket_stem_height + ball_radius * 0.95]) {
    cylinder(h = socket_radius * 2, d = ball_diameter * opening_scale, center = true);
  }

  translate([-slot_width / 2, -socket_radius - 1, base_thickness + socket_stem_height * 0.55]) {
    cube([slot_width, (socket_radius + 1) * 2, socket_radius * 2]);
  }

  for (x = [-screw_spacing / 2, screw_spacing / 2]) {
    translate([x, 0, -0.1]) cylinder(h = base_thickness + 0.2, d = screw_diameter);
  }
}
