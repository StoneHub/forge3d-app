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

export { EXAMPLES };
