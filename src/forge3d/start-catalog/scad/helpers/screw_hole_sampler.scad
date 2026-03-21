// Screw Hole Sampler
plate_size = [80, 28, 8];
clearance_diameter = 3.4;
counterbore_diameter = 6.5;
counterbore_depth = 3;
countersink_diameter = 7.2;

$fn = 64;

module screw_clearance_hole(length, d) {
  cylinder(h = length, d = d);
}

module screw_counterbore(length, clearance_d, bore_d, bore_depth) {
  union() {
    cylinder(h = length, d = clearance_d);
    cylinder(h = bore_depth, d = bore_d);
  }
}

module screw_countersink(length, clearance_d, sink_d) {
  union() {
    cylinder(h = length, d = clearance_d);
    cylinder(h = (sink_d - clearance_d) / 2, d1 = sink_d, d2 = clearance_d);
  }
}

difference() {
  cube(plate_size, center = true);

  translate([-24, 0, -plate_size[2] / 2 - 0.1]) {
    screw_clearance_hole(plate_size[2] + 0.2, clearance_diameter);
  }

  translate([0, 0, plate_size[2] / 2 + 0.1]) rotate([180, 0, 0]) {
    screw_counterbore(plate_size[2] + 0.2, clearance_diameter, counterbore_diameter, counterbore_depth);
  }

  translate([24, 0, plate_size[2] / 2 + 0.1]) rotate([180, 0, 0]) {
    screw_countersink(plate_size[2] + 0.2, clearance_diameter, countersink_diameter);
  }
}
