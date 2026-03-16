export const QUICKSTART_LIBRARY = [
  {
    id: 'cube',
    category: 'Primitives',
    name: 'Cube',
    summary: 'Centered block with one size control.',
    code: `size = 20;
cube([size, size, size], center = true);`,
  },
  {
    id: 'sphere',
    category: 'Primitives',
    name: 'Sphere',
    summary: 'Quick round solid with a radius variable.',
    code: `radius = 12;
sphere(r = radius);`,
  },
  {
    id: 'cylinder',
    category: 'Primitives',
    name: 'Cylinder',
    summary: 'Height and radius starter for pegs or bosses.',
    code: `radius = 8;
height = 24;
cylinder(h = height, r = radius, center = true);`,
  },
  {
    id: 'plate',
    category: 'Primitives',
    name: 'Plane / Plate',
    summary: 'Thin extruded square for panels and covers.',
    code: `size = [40, 40];
thickness = 2;

linear_extrude(height = thickness, center = true) {
  square(size, center = true);
}`,
  },
  {
    id: 'offset',
    category: 'Transforms',
    name: 'Offset',
    summary: 'Expand or contract a 2D profile.',
    code: `offset_amount = 2;

offset(r = offset_amount) {
  square([20, 20], center = true);
}`,
  },
  {
    id: 'translate',
    category: 'Transforms',
    name: 'Translate',
    summary: 'Move a child shape in XYZ.',
    code: `translate([20, 0, 0]) {
  cube([12, 12, 12], center = true);
}`,
  },
  {
    id: 'rotate',
    category: 'Transforms',
    name: 'Rotate',
    summary: 'Rotate a child shape around XYZ axes.',
    code: `rotate([0, 45, 0]) {
  cube([18, 18, 18], center = true);
}`,
  },
  {
    id: 'union',
    category: 'Booleans',
    name: 'Union',
    summary: 'Combine multiple solids into one body.',
    code: `union() {
  cube([20, 20, 12], center = true);
  translate([12, 0, 0]) {
    sphere(r = 8);
  }
}`,
  },
  {
    id: 'difference',
    category: 'Booleans',
    name: 'Difference',
    summary: 'Subtract one solid from another.',
    code: `difference() {
  cube([30, 30, 12], center = true);
  cylinder(h = 16, r = 6, center = true);
}`,
  },
  {
    id: 'module',
    category: 'Structure',
    name: 'Module',
    summary: 'Reusable module skeleton with a call site.',
    code: `module part() {
  cube([20, 20, 20], center = true);
}

part();`,
  },
  {
    id: 'param',
    category: 'Structure',
    name: '@param Starter',
    summary: 'Annotated control block ready for Forge3D sliders.',
    code: `// @param size = 20 // min: 4, max: 120, step: 1
size = 20;

cube([size, size, size], center = true);`,
  },
];
