export const OPENSCAD_DOCS = {
  cube: {
    name: 'cube',
    signature: 'cube(size = [x, y, z] | n, center = false)',
    summary: 'Create an axis-aligned box. A single number makes a uniform cube; a 3-item vector sets width, depth, and height.',
    arguments: [
      { name: 'size', type: 'number | [x, y, z]', description: 'Uniform size or explicit XYZ dimensions.' },
      { name: 'center', type: 'boolean', description: 'When true, center the cube around the origin.', defaultValue: 'false' },
    ],
    example: `cube([20, 14, 8], center = true);`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Primitive_Solids#cube',
  },
  sphere: {
    name: 'sphere',
    signature: 'sphere(r = radius | d = diameter)',
    summary: 'Create a sphere from a radius or diameter.',
    arguments: [
      { name: 'r', type: 'number', description: 'Sphere radius.' },
      { name: 'd', type: 'number', description: 'Sphere diameter.' },
    ],
    example: `sphere(r = 12);`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Primitive_Solids#sphere',
  },
  cylinder: {
    name: 'cylinder',
    signature: 'cylinder(h, r | d, r1, r2, center = false)',
    summary: 'Create a straight or tapered cylinder with optional centering.',
    arguments: [
      { name: 'h', type: 'number', description: 'Cylinder height.' },
      { name: 'r / d', type: 'number', description: 'Shared radius or diameter.' },
      { name: 'r1 / r2', type: 'number', description: 'Independent bottom and top radii for tapered shapes.' },
      { name: 'center', type: 'boolean', description: 'When true, center the cylinder on Z.', defaultValue: 'false' },
    ],
    example: `cylinder(h = 24, r = 8, center = true);`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Primitive_Solids#cylinder',
  },
  square: {
    name: 'square',
    signature: 'square(size = [x, y] | n, center = false)',
    summary: 'Create a 2D square or rectangle for profiles and sketches.',
    arguments: [
      { name: 'size', type: 'number | [x, y]', description: 'Uniform size or explicit XY dimensions.' },
      { name: 'center', type: 'boolean', description: 'When true, center the shape on the origin.', defaultValue: 'false' },
    ],
    example: `square([40, 28], center = true);`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_Primitives#square',
  },
  circle: {
    name: 'circle',
    signature: 'circle(r = radius | d = diameter)',
    summary: 'Create a 2D circle from a radius or diameter.',
    arguments: [
      { name: 'r', type: 'number', description: 'Circle radius.' },
      { name: 'd', type: 'number', description: 'Circle diameter.' },
    ],
    example: `circle(r = 12);`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_Primitives#circle',
  },
  offset: {
    name: 'offset',
    signature: 'offset(r = value | delta = value, chamfer = false) { ... }',
    summary: 'Grow or shrink a 2D profile. Use `r` for rounded offsets and `delta` for straight inset/outset changes.',
    arguments: [
      { name: 'r', type: 'number', description: 'Rounded radial offset amount.' },
      { name: 'delta', type: 'number', description: 'Linear inset or outset amount.' },
      { name: 'chamfer', type: 'boolean', description: 'Create chamfered corners with `delta` offsets.', defaultValue: 'false' },
    ],
    example: `offset(r = 2) {\n  square([24, 24], center = true);\n}`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Transformations#offset',
  },
  translate: {
    name: 'translate',
    signature: 'translate([x, y, z]) { ... }',
    summary: 'Move child geometry in XYZ space.',
    arguments: [
      { name: 'vector', type: '[x, y, z]', description: 'Translation amount for each axis.' },
    ],
    example: `translate([20, 0, 0]) {\n  cube([12, 12, 12], center = true);\n}`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Transformations#translate',
  },
  rotate: {
    name: 'rotate',
    signature: 'rotate([x, y, z]) { ... }',
    summary: 'Rotate child geometry around the X, Y, and Z axes.',
    arguments: [
      { name: 'vector', type: '[x, y, z]', description: 'Rotation angles in degrees.' },
    ],
    example: `rotate([0, 45, 0]) {\n  cube([18, 18, 18], center = true);\n}`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Transformations#rotate',
  },
  union: {
    name: 'union',
    signature: 'union() { ... }',
    summary: 'Combine child solids into one resulting body.',
    arguments: [],
    example: `union() {\n  cube([20, 20, 12], center = true);\n  translate([12, 0, 0]) sphere(r = 8);\n}`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/CSG_Modelling#union',
  },
  difference: {
    name: 'difference',
    signature: 'difference() { base(); cut(); }',
    summary: 'Subtract later child solids from the first child solid.',
    arguments: [],
    example: `difference() {\n  cube([30, 30, 12], center = true);\n  cylinder(h = 16, r = 6, center = true);\n}`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/CSG_Modelling#difference',
  },
  linear_extrude: {
    name: 'linear_extrude',
    signature: 'linear_extrude(height, center = false, scale = 1) { 2d_shape(); }',
    summary: 'Turn a 2D profile into a 3D solid by extruding along Z.',
    arguments: [
      { name: 'height', type: 'number', description: 'Extrusion height.' },
      { name: 'center', type: 'boolean', description: 'When true, center the extrusion on Z.', defaultValue: 'false' },
      { name: 'scale', type: 'number | [x, y]', description: 'Scale the top face during extrusion.', defaultValue: '1' },
    ],
    example: `linear_extrude(height = 4, center = true) {\n  square([30, 18], center = true);\n}`,
    url: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_to_3D_Extrusion#linear_extrude',
  },
};

export function getOpenScadDoc(name) {
  if (!name) return null;
  return OPENSCAD_DOCS[String(name).trim()] || null;
}

export function isDocumentedBuiltin(name) {
  return Boolean(getOpenScadDoc(name));
}
