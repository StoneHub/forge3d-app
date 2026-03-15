const EXAMPLES = {
  "Welcome": `// Welcome to Forge3D
// A modern parametric 3D modeler

base_w = 30;
base_d = 20;
base_h = 3;
pillar_r = 2;
pillar_h = 15;
dome_r = 4;

// Base plate
color("#4fc3f7")
  cube([base_w, base_d, base_h], center=true);

// Four pillars
for (x = [0:1])
  for (y = [0:1])
    translate([(x * 2 - 1) * base_w / 3, (y * 2 - 1) * base_d / 3, base_h / 2])
      color("#81c784")
        cylinder(h=pillar_h, r=pillar_r, $fn=24);

// Dome caps
for (x = [0:1])
  for (y = [0:1])
    translate([(x * 2 - 1) * base_w / 3, (y * 2 - 1) * base_d / 3, base_h / 2 + pillar_h])
      color("#ffb74d")
        sphere(r=dome_r, $fn=32);

// Center spire
translate([0, 0, base_h / 2])
  color("#e57373")
    cylinder(h=pillar_h + 8, r1=3, r2=0.5, $fn=6);

echo("Model built: base + 4 pillars + 4 domes + spire");`,

  "OpenSCAD Basics: Patterns": `// OpenSCAD Basics: reusable code patterns
// Useful for building larger files with cleaner structure.

// @param pitch 8 30 14 1
// @param count 3 10 6 1
// @param shell 1 4 2 0.5

pitch = 14;
count = 6;
shell = 2;
base_h = 4;

// Good pattern 1: small helper function
function slot_x(i) = (i - (count - 1) / 2) * pitch;

// Good pattern 2: module with named parameters
module standoff(h = 8, r = 3, hole = 1.5) {
  difference() {
    cylinder(h = h, r = r, $fn = 48);
    translate([0, 0, -0.1])
      cylinder(h = h + 0.2, r = hole, $fn = 32);
  }
}

// Good pattern 3: isolate shape intent with union/difference
module rail() {
  difference() {
    union() {
      cube([count * pitch + 10, 18, base_h], center = true);
      translate([0, 0, base_h / 2])
        cube([count * pitch + 10, 8, base_h], center = true);
    }
    for (i = [0:count - 1])
      translate([slot_x(i), 0, 0])
        cylinder(h = base_h + 2, r = shell, center = true, $fn = 48);
  }
}

color("#9fa8da") rail();

for (i = [0:count - 1])
  translate([slot_x(i), 0, base_h / 2])
    color("#80cbc4")
      standoff(h = 12, r = 2.6, hole = 1.2);

echo("Patterns example complete. count=", count);`,

  "Magnetic Letters Pro": `// Magnetic Letters Pro (example)
// Better defaults for clean letters + safer magnet pockets.

letter = "M";
font_name = "Bahnschrift:style=Bold";
letter_size = 88;
letter_thickness = 8;
emboss_chamfer = 0; // keep off for glyph-only exports
shape_mode = "glyph"; // glyph (no backplate) or tile
tile_margin = 4;

magnet_d = 6.2;
magnet_depth = 2.3;
edge_clearance = 0.8;
max_magnets = 5;
magnet_mode = "auto_grid"; // auto_grid | spine | manual
manual_positions = [[-18, 16], [16, -16], [0, 0]];
grid_pitch = 13;
grid_extent = 42;

$fn = $preview ? 28 : 96;

module glyph_2d() {
  text(letter, size = letter_size, font = font_name,
       halign = "center", valign = "center");
}

module printable_shape_2d() {
  if (shape_mode == "tile") offset(delta = tile_margin) glyph_2d();
  else glyph_2d();
}

module safe_mask_2d() {
  offset(r = -(magnet_d / 2 + edge_clearance)) printable_shape_2d();
}

module letter_body() {
  body_chamfer = shape_mode == "tile" ? emboss_chamfer : 0;

  if (body_chamfer > 0) {
    linear_extrude(height = letter_thickness - body_chamfer)
      printable_shape_2d();

    for (i = [0:4]) {
      t0 = i / 5;
      t1 = (i + 1) / 5;
      h0 = letter_thickness - body_chamfer + body_chamfer * t0;
      h1 = letter_thickness - body_chamfer + body_chamfer * t1;
      in0 = body_chamfer * 0.45 * t0;
      in1 = body_chamfer * 0.45 * t1;
      hull() {
        translate([0, 0, h0]) linear_extrude(0.01) offset(r = -in0) printable_shape_2d();
        translate([0, 0, h1]) linear_extrude(0.01) offset(r = -in1) printable_shape_2d();
      }
    }
  } else {
    linear_extrude(height = letter_thickness) printable_shape_2d();
  }
}

function grid_candidates(extent, pitch) =
  [for (x = [-extent:pitch:extent]) for (y = [-extent:pitch:extent]) [x, y]];

module pocket_candidates() {
  pts = magnet_mode == "manual" ? manual_positions : grid_candidates(grid_extent, grid_pitch);
  for (i = [0:min(max_magnets, len(pts)) - 1]) {
    p = pts[i];
    translate([p[0], p[1], 0]) cylinder(h = magnet_depth, d = magnet_d);
  }
}

difference() {
  letter_body();
  intersection() {
    linear_extrude(height = magnet_depth) safe_mask_2d();
    pocket_candidates();
  }
}

echo("Magnetic letter generated:", letter);`,

  "Gears": `// Parametric Gear
teeth = 16;
tooth_r = 20;
inner_r = 15;
hub_r = 6;
thickness = 5;
res = 48;

// Outer ring
color("#4fc3f7")
  cylinder(h=thickness, r=tooth_r, center=true, $fn=32);

// Hub
color("#e57373")
  cylinder(h=thickness + 2, r=hub_r, center=true, $fn=res);

// Spokes
for (i = [0:5])
  rotate([0, 0, i * 60])
    translate([inner_r / 2 + 2, 0, 0])
      color("#81c784")
        cube([inner_r - 4, 2, thickness], center=true);

// Tooth markers
for (i = [0:15])
  rotate([0, 0, i * 360 / teeth])
    translate([tooth_r, 0, 0])
      color("#ffb74d")
        cylinder(h=thickness + 1, r=1.5, center=true, $fn=6);

echo("Gear: ", teeth, " teeth");`,

  "Chess Pawn": `// Parametric Chess Pawn
base_r = 10;
base_h = 3;
body_h = 15;
neck_h = 2;
head_r = 5;

// Base
color("#e0e0e0")
  cylinder(h=base_h, r1=base_r, r2=base_r - 1, $fn=48);

// Base rim
color("#bdbdbd")
  translate([0, 0, base_h])
    cylinder(h=1.5, r1=base_r - 1, r2=8, $fn=48);

// Body
color("#f5f5f5")
  translate([0, 0, base_h + 1.5])
    cylinder(h=body_h, r1=8, r2=4, $fn=48);

// Neck collar
color("#e0e0e0")
  translate([0, 0, base_h + 1.5 + body_h])
    cylinder(h=neck_h, r1=4, r2=3, $fn=48);

// Neck
color("#f5f5f5")
  translate([0, 0, base_h + 1.5 + body_h + neck_h])
    cylinder(h=3, r=3, $fn=48);

// Head
color("#fafafa")
  translate([0, 0, base_h + 1.5 + body_h + neck_h + 3 + head_r * 0.5])
    sphere(r=head_r, $fn=48);

echo("Chess pawn generated");`,

  "Snowflake": `// Parametric Snowflake
arms = 6;
arm_len = 25;
arm_w = 2;
branch_len = 10;
branch_w = 1.5;
th = 2;

// Center hub
color("#81d4fa")
  cylinder(h=th, r=4, center=true, $fn=6);

// Main arms
for (i = [0:5])
  rotate([0, 0, i * 60])
    translate([arm_len / 2, 0, 0])
      color("#4fc3f7")
        cube([arm_len, arm_w, th], center=true);

// Inner branches
for (i = [0:5])
  rotate([0, 0, i * 60]) {
    translate([10, 0, 0])
      rotate([0, 0, 45])
        translate([branch_len / 2, 0, 0])
          color("#29b6f6")
            cube([branch_len, branch_w, th], center=true);
    translate([10, 0, 0])
      rotate([0, 0, -45])
        translate([branch_len / 2, 0, 0])
          color("#29b6f6")
            cube([branch_len, branch_w, th], center=true);
  }

// Outer branches
for (i = [0:5])
  rotate([0, 0, i * 60]) {
    translate([18, 0, 0])
      rotate([0, 0, 45])
        translate([3, 0, 0])
          color("#03a9f4")
            cube([6, 1.2, th], center=true);
    translate([18, 0, 0])
      rotate([0, 0, -45])
        translate([3, 0, 0])
          color("#03a9f4")
            cube([6, 1.2, th], center=true);
  }

// Tips
for (i = [0:5])
  rotate([0, 0, i * 60])
    translate([arm_len, 0, 0])
      color("#0288d1")
        sphere(r=1.5, $fn=12);

echo("Snowflake with ", arms, " arms");`,

  "Tower": `// Parametric Tower Stack
levels = 8;
base_size = 24;
shrink = 0.85;
height = 4;
gap = 1;

for (i = [0:7]) {
  s = base_size * pow(shrink, i);
  translate([0, 0, i * (height + gap)])
    color("#4fc3f7")
      cube([s, s, height], center=true);
}

// Top sphere
translate([0, 0, levels * (height + gap)])
  color("#fff176")
    sphere(r=3, $fn=32);

echo("Tower with ", levels, " levels");`,

  "Molecule": `// Simple Molecule
bond_len = 12;
atom_r = 3;
bond_r = 0.8;

// Center atom
color("#e57373")
  sphere(r=atom_r + 1, $fn=32);

// Ring atoms + bonds
for (i = [0:5]) {
  a = i * 60;
  dx = bond_len * cos(a);
  dy = bond_len * sin(a);

  translate([dx / 2, dy / 2, 0])
    rotate([0, 0, a])
      color("#90a4ae")
        cube([bond_len, bond_r * 2, bond_r * 2], center=true);

  translate([dx, dy, 0])
    color("#4fc3f7")
      sphere(r=atom_r, $fn=24);
}

// Top + bottom atoms
translate([0, 0, bond_len])
  color("#81c784")
    sphere(r=atom_r, $fn=24);
translate([0, 0, 0 - bond_len])
  color("#81c784")
    sphere(r=atom_r, $fn=24);

// Vertical bonds
translate([0, 0, bond_len / 2])
  color("#90a4ae")
    cylinder(h=bond_len, r=bond_r, center=true, $fn=12);
translate([0, 0, 0 - bond_len / 2])
  color("#90a4ae")
    cylinder(h=bond_len, r=bond_r, center=true, $fn=12);

echo("Molecule: 8 atoms, 8 bonds");`,

  "Castle": `// Mini Castle
wall_h = 20;
wall_w = 40;
wall_t = 3;
tower_r = 5;
tower_h = 28;

// Walls
color("#8d6e63")
  translate([0, 0 - wall_w / 2, 0])
    cube([wall_w, wall_t, wall_h]);
color("#8d6e63")
  translate([0, wall_w / 2 - wall_t, 0])
    cube([wall_w, wall_t, wall_h]);
color("#a1887f")
  translate([0, 0 - wall_w / 2, 0])
    cube([wall_t, wall_w, wall_h]);
color("#a1887f")
  translate([wall_w - wall_t, 0 - wall_w / 2, 0])
    cube([wall_t, wall_w, wall_h]);

// Corner towers + caps
for (x = [0:1])
  for (y = [0:1]) {
    translate([x * wall_w, y * wall_w - wall_w / 2, 0])
      color("#6d4c41")
        cylinder(h=tower_h, r=tower_r, $fn=24);
    translate([x * wall_w, y * wall_w - wall_w / 2, tower_h])
      color("#e57373")
        cylinder(h=6, r1=tower_r + 1, r2=0, $fn=24);
  }

// Gate
color("#4e342e")
  translate([wall_w / 2 - 4, 0 - wall_w / 2 - 0.5, 0])
    cube([8, wall_t + 1, 12]);

echo("Castle with 4 towers");`,
};

const EXAMPLE_DETAILS = {
  "Welcome": { category: "Basics", summary: "Starter scene with transforms, loops, and primitive shapes." },
  "OpenSCAD Basics: Patterns": { category: "Basics", summary: "Reusable helper functions/modules and boolean modeling patterns." },
  "Magnetic Letters Pro": { category: "Print-ready", summary: "Custom text letters with safer magnet pocket clipping and font controls." },
  "Gears": { category: "Mechanical", summary: "Radial patterning with loops and rotational placement." },
  "Chess Pawn": { category: "Artistic", summary: "Layered solids with profile-style shaping." },
  "Snowflake": { category: "Artistic", summary: "Symmetry and repeated branch motifs." },
  "Tower": { category: "Basics", summary: "Stacked transforms and progressive scaling." },
  "Molecule": { category: "Basics", summary: "Positioning with trigonometry and mixed primitive usage." },
  "Castle": { category: "Architectural", summary: "Composed walls/towers from reusable dimensional vars." },
};

const EXAMPLE_LIBRARY = Object.entries(EXAMPLES).map(([name, code]) => ({
  name,
  code,
  category: EXAMPLE_DETAILS[name]?.category || "Other",
  summary: EXAMPLE_DETAILS[name]?.summary || "",
}));

export { EXAMPLES, EXAMPLE_LIBRARY };
