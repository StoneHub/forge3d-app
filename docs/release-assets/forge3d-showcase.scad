// Forge3D release showcase model
// Repo-owned fixture for deterministic release screenshots.

$fn = $preview ? 36 : 72;

plate_w = 112;
plate_d = 72;
plate_h = 4;
corner_r = 8;
gear_h = 8;
hub_h = 13;

module rounded_plate(size = [80, 50, 4], r = 6) {
  hull() {
    for (x = [-size[0] / 2 + r, size[0] / 2 - r]) {
      for (y = [-size[1] / 2 + r, size[1] / 2 - r]) {
        translate([x, y, 0]) cylinder(h = size[2], r = r);
      }
    }
  }
}

module gear_2d(teeth = 24, root_r = 11, tip_r = 13) {
  polygon(points = [
    for (i = [0 : teeth * 2 - 1])
      let(
        a = i * 360 / (teeth * 2),
        r = (i % 2 == 0) ? tip_r : root_r
      )
      [r * cos(a), r * sin(a)]
  ]);
}

module spur_gear(teeth = 24, root_r = 11, tip_r = 13, bore_r = 3.2) {
  difference() {
    union() {
      linear_extrude(height = gear_h, twist = 10, slices = 12) gear_2d(teeth, root_r, tip_r);
      translate([0, 0, gear_h]) cylinder(h = hub_h - gear_h, r = root_r * 0.42);
    }
    translate([0, 0, -1]) cylinder(h = hub_h + 2, r = bore_r);
    for (a = [0 : 90 : 270]) {
      rotate([0, 0, a]) translate([root_r * 0.62, 0, -1]) cylinder(h = gear_h + 2, r = 1.5);
    }
  }
}

module socket_post(r = 5.5, h = 18) {
  difference() {
    union() {
      cylinder(h = h, r = r);
      translate([0, 0, h]) sphere(r = r * 0.95);
    }
    translate([0, 0, -1]) cylinder(h = h + r + 2, r = 2.2);
  }
}

module rib(from, to, width = 8, height = 8) {
  hull() {
    translate([from[0], from[1], plate_h]) cylinder(h = height, r = width / 2);
    translate([to[0], to[1], plate_h]) cylinder(h = height, r = width / 2);
  }
}

difference() {
  rounded_plate([plate_w, plate_d, plate_h], corner_r);
  for (x = [-42, 42]) {
    for (y = [-23, 23]) {
      translate([x, y, -1]) cylinder(h = plate_h + 2, r = 3.1);
    }
  }
  translate([0, 0, -1]) rounded_plate([33, 18, plate_h + 2], 4);
}

rib([-32, -16], [0, 15], 7, 6);
rib([32, -16], [0, 15], 7, 6);
rib([-32, -16], [32, -16], 6, 5);

translate([-32, -16, plate_h]) rotate([0, 0, 7]) spur_gear(22, 10.5, 13.2, 3.0);
translate([0, 15, plate_h]) rotate([0, 0, -5]) spur_gear(28, 13.5, 16.5, 3.4);
translate([32, -16, plate_h]) rotate([0, 0, 12]) spur_gear(22, 10.5, 13.2, 3.0);

translate([-49, 0, plate_h]) socket_post(4.8, 13);
translate([49, 0, plate_h]) socket_post(4.8, 13);

translate([0, -31, plate_h]) {
  difference() {
    rounded_plate([42, 12, 8], 4);
    translate([-12, 0, -1]) cylinder(h = 10, r = 2.8);
    translate([12, 0, -1]) cylinder(h = 10, r = 2.8);
  }
}
