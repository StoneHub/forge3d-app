export const TEMPLATE_LIBRARY = [
  {
    id: 'rounded-box',
    name: 'Rounded Box',
    category: 'Parametric Shapes',
    description: 'Solid rounded-corner block for quick enclosures, spacers, and mockups.',
    tags: ['box', 'rounded', 'starter'],
    code: `// Rounded Box
// @param width = 80 // min: 20, max: 220, step: 1
width = 80;
// @param depth = 50 // min: 20, max: 220, step: 1
depth = 50;
// @param height = 24 // min: 4, max: 120, step: 1
height = 24;
// @param corner_radius = 6 // min: 1, max: 20, step: 0.5
corner_radius = 6;

$fn = 40;

module rounded_profile(size = [width, depth], r = corner_radius) {
  offset(r = r) {
    offset(delta = -r) {
      square(size, center = true);
    }
  }
}

linear_extrude(height = height, center = true) {
  rounded_profile();
}
`,
  },
  {
    id: 'project-enclosure',
    name: 'Project Enclosure',
    category: 'Parametric Shapes',
    description: 'Rounded shell with wall thickness, floor thickness, and a lid lip.',
    tags: ['enclosure', 'box', 'electronics'],
    code: `// Project Enclosure Shell
// @param outer_width = 90 // min: 30, max: 240, step: 1
outer_width = 90;
// @param outer_depth = 60 // min: 30, max: 240, step: 1
outer_depth = 60;
// @param outer_height = 28 // min: 8, max: 140, step: 1
outer_height = 28;
// @param wall_thickness = 2.4 // min: 1, max: 8, step: 0.1
wall_thickness = 2.4;
// @param floor_thickness = 2.8 // min: 1, max: 8, step: 0.1
floor_thickness = 2.8;
// @param corner_radius = 6 // min: 1, max: 20, step: 0.5
corner_radius = 6;
// @param lid_lip_height = 5 // min: 1, max: 16, step: 0.5
lid_lip_height = 5;
// @param lid_clearance = 0.35 // min: 0, max: 2, step: 0.05
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
  linear_extrude(height = outer_height) {
    rounded_rect();
  }

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
`,
  },
  {
    id: 'mounting-bracket',
    name: 'Mounting Bracket',
    category: 'Mechanical Parts',
    description: 'Simple L-bracket with matching holes on the base and upright faces.',
    tags: ['bracket', 'holes', 'mount'],
    code: `// Mounting Bracket
// @param span = 70 // min: 20, max: 180, step: 1
span = 70;
// @param wall_height = 40 // min: 10, max: 120, step: 1
wall_height = 40;
// @param flange_depth = 22 // min: 8, max: 80, step: 1
flange_depth = 22;
// @param thickness = 4 // min: 1, max: 16, step: 0.5
thickness = 4;
// @param hole_diameter = 5 // min: 2, max: 16, step: 0.1
hole_diameter = 5;
// @param hole_edge = 12 // min: 4, max: 40, step: 0.5
hole_edge = 12;

$fn = 36;

difference() {
  union() {
    cube([span, flange_depth, thickness]);
    cube([span, thickness, wall_height]);
  }

  for (x = [hole_edge, span - hole_edge]) {
    translate([x, flange_depth / 2, -0.1]) {
      cylinder(h = thickness + 0.2, d = hole_diameter);
    }

    translate([x, -0.1, wall_height / 2]) {
      rotate([-90, 0, 0]) {
        cylinder(h = thickness + 0.2, d = hole_diameter);
      }
    }
  }
}
`,
  },
  {
    id: 'insert-boss-plate',
    name: 'Insert Boss Plate',
    category: 'Mechanical Parts',
    description: 'Base plate with four raised bosses sized for heat-set insert holes.',
    tags: ['heat-set', 'insert', 'boss'],
    code: `// Insert Boss Plate
// @param plate_width = 80 // min: 20, max: 220, step: 1
plate_width = 80;
// @param plate_depth = 50 // min: 20, max: 220, step: 1
plate_depth = 50;
// @param plate_thickness = 3 // min: 1, max: 12, step: 0.1
plate_thickness = 3;
// @param boss_height = 6 // min: 2, max: 20, step: 0.1
boss_height = 6;
// @param boss_diameter = 10 // min: 4, max: 24, step: 0.1
boss_diameter = 10;
// @param insert_diameter = 4.2 // min: 2, max: 12, step: 0.05
insert_diameter = 4.2;
// @param edge_margin = 12 // min: 4, max: 40, step: 0.5
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
`,
  },
  {
    id: 'dovetail-rail',
    name: 'Dovetail Rail',
    category: 'Joinery',
    description: 'Male dovetail rail profile for slide-together fixtures and inserts.',
    tags: ['dovetail', 'joinery', 'rail'],
    code: `// Dovetail Rail
// @param rail_length = 80 // min: 20, max: 240, step: 1
rail_length = 80;
// @param base_width = 20 // min: 6, max: 60, step: 0.1
base_width = 20;
// @param top_width = 12 // min: 4, max: 50, step: 0.1
top_width = 12;
// @param rail_height = 8 // min: 2, max: 30, step: 0.1
rail_height = 8;

module dovetail_profile() {
  polygon(points = [
    [-base_width / 2, 0],
    [base_width / 2, 0],
    [top_width / 2, rail_height],
    [-top_width / 2, rail_height]
  ]);
}

rotate([90, 0, 0]) {
  linear_extrude(height = rail_length, center = true) {
    dovetail_profile();
  }
}
`,
  },
  {
    id: 'snap-tab',
    name: 'Snap-Fit Tab',
    category: 'Joinery',
    description: 'Printable cantilever tab with a tapered hook for quick clips and covers.',
    tags: ['snap-fit', 'clip', 'tab'],
    code: `// Snap-Fit Tab
// @param tab_length = 28 // min: 10, max: 80, step: 0.5
tab_length = 28;
// @param tab_width = 14 // min: 4, max: 40, step: 0.5
tab_width = 14;
// @param tab_thickness = 3 // min: 1, max: 10, step: 0.1
tab_thickness = 3;
// @param hook_height = 2.2 // min: 0.5, max: 8, step: 0.1
hook_height = 2.2;
// @param hook_depth = 1.4 // min: 0.2, max: 6, step: 0.05
hook_depth = 1.4;
// @param ramp_length = 8 // min: 2, max: 20, step: 0.1
ramp_length = 8;

module snap_profile() {
  polygon(points = [
    [0, 0],
    [tab_length - ramp_length, 0],
    [tab_length, hook_height + tab_thickness],
    [tab_length - hook_depth, hook_height + tab_thickness],
    [tab_length - ramp_length - hook_depth, tab_thickness],
    [0, tab_thickness]
  ]);
}

rotate([90, 0, 0]) {
  linear_extrude(height = tab_width, center = true) {
    snap_profile();
  }
}
`,
  },
  {
    id: 'grid-array',
    name: 'Grid Array',
    category: 'Utilities',
    description: 'Repeats a simple cylinder feature in a centered rectangular array.',
    tags: ['array', 'pattern', 'grid'],
    code: `// Grid Array
// @param columns = 4 // min: 1, max: 16, step: 1
columns = 4;
// @param rows = 3 // min: 1, max: 16, step: 1
rows = 3;
// @param pitch_x = 22 // min: 4, max: 80, step: 0.5
pitch_x = 22;
// @param pitch_y = 18 // min: 4, max: 80, step: 0.5
pitch_y = 18;
// @param part_diameter = 10 // min: 1, max: 40, step: 0.1
part_diameter = 10;
// @param part_height = 5 // min: 1, max: 40, step: 0.1
part_height = 5;

$fn = 40;

for (row = [0 : rows - 1]) {
  for (col = [0 : columns - 1]) {
    translate([
      (col - (columns - 1) / 2) * pitch_x,
      (row - (rows - 1) / 2) * pitch_y,
      0
    ]) {
      cylinder(h = part_height, d = part_diameter, center = true);
    }
  }
}
`,
  },
  {
    id: 'circular-pattern',
    name: 'Circular Pattern',
    category: 'Utilities',
    description: 'Ring blank with evenly spaced cutouts around a center bore.',
    tags: ['ring', 'pattern', 'radial'],
    code: `// Circular Pattern
// @param count = 6 // min: 2, max: 24, step: 1
count = 6;
// @param radius = 26 // min: 6, max: 120, step: 0.5
radius = 26;
// @param cutout_diameter = 8 // min: 1, max: 30, step: 0.1
cutout_diameter = 8;
// @param center_hole = 12 // min: 1, max: 60, step: 0.1
center_hole = 12;
// @param thickness = 5 // min: 1, max: 30, step: 0.1
thickness = 5;

$fn = 80;

difference() {
  cylinder(d = radius * 2 + cutout_diameter + 12, h = thickness, center = true);
  cylinder(d = center_hole, h = thickness + 0.2, center = true);

  for (i = [0 : count - 1]) {
    rotate([0, 0, i * 360 / count]) {
      translate([radius, 0, 0]) {
        cylinder(d = cutout_diameter, h = thickness + 0.2, center = true, $fn = 36);
      }
    }
  }
}
`,
  },
  {
    id: 'honeycomb-panel',
    name: 'Honeycomb Panel',
    category: 'Utilities',
    description: 'Lightweight perforated panel with a hex pattern cut through the face.',
    tags: ['panel', 'honeycomb', 'lightweight'],
    code: `// Honeycomb Panel
// @param panel_width = 120 // min: 20, max: 260, step: 1
panel_width = 120;
// @param panel_depth = 80 // min: 20, max: 260, step: 1
panel_depth = 80;
// @param thickness = 3 // min: 1, max: 20, step: 0.1
thickness = 3;
// @param cell_diameter = 14 // min: 4, max: 40, step: 0.1
cell_diameter = 14;
// @param web_thickness = 2 // min: 0.6, max: 8, step: 0.05
web_thickness = 2;

module hex_cell(d = cell_diameter) {
  circle(d = d, $fn = 6);
}

difference() {
  linear_extrude(height = thickness, center = true) {
    square([panel_width, panel_depth], center = true);
  }

  translate([0, 0, -thickness / 2 - 0.1]) {
    linear_extrude(height = thickness + 0.2) {
      for (row = [-ceil(panel_depth / cell_diameter) : ceil(panel_depth / cell_diameter)]) {
        row_y = row * cell_diameter * 0.86;
        x_shift = (abs(row) % 2 == 0) ? 0 : cell_diameter * 0.75;

        for (col = [-ceil(panel_width / cell_diameter) : ceil(panel_width / cell_diameter)]) {
          translate([col * cell_diameter * 1.5 + x_shift, row_y]) {
            offset(delta = -web_thickness / 2) {
              hex_cell();
            }
          }
        }
      }
    }
  }
}
`,
  },
];
