// Shelf bracket
// @param width = 40 // min: 20, max: 70, step: 2, label: Width
width = 40;
// @param leg = 60 // min: 30, max: 90, step: 2, label: Leg length
leg = 60;
// @param thickness = 5 // min: 3, max: 10, step: 0.5, label: Thickness
thickness = 5;
// @param hole_d = 5 // min: 3, max: 8, step: 0.5, label: Hole diameter
hole_d = 5;

$fn = 40;
module plate(len) {
  difference() {
    cube([width, len, thickness]);
    for (y = [len * 0.4, len * 0.8])
      translate([width / 2, y, -1]) cylinder(h = thickness + 2, d = hole_d);
  }
}
plate(leg);
translate([0, thickness, 0]) rotate([90, 0, 0]) plate(leg);
// gusset
translate([width / 2 - thickness / 2, 0, 0]) rotate([90, 0, 90])
  linear_extrude(thickness) polygon([[thickness - 1, thickness - 1], [leg * 0.6, thickness - 1], [thickness - 1, leg * 0.6]]);
