// Insert Boss Plate
plate_width = 80;
plate_depth = 50;
plate_thickness = 3;
boss_height = 6;
boss_diameter = 10;
insert_diameter = 4.2;
edge_margin = 12;

$fn = 48;

boss_offset_x = plate_width / 2 - edge_margin;
boss_offset_y = plate_depth / 2 - edge_margin;

difference() {
  union() {
    cube([plate_width, plate_depth, plate_thickness], center = true);

    for (sx = [-1, 1], sy = [-1, 1]) {
      translate([sx * boss_offset_x, sy * boss_offset_y, plate_thickness / 2]) {
        cylinder(h = boss_height, d = boss_diameter);
      }
    }
  }

  for (sx = [-1, 1], sy = [-1, 1]) {
    translate([sx * boss_offset_x, sy * boss_offset_y, -plate_thickness / 2 - 0.1]) {
      cylinder(h = plate_thickness + boss_height + 0.2, d = insert_diameter);
    }
  }
}
