import { QUICKSTART_LIBRARY } from './quickstart.js';
import { TEMPLATE_LIBRARY } from './templates.js';

const BASIC_ITEMS = QUICKSTART_LIBRARY.map((item) => ({
  id: item.id,
  kind: 'basic',
  section: 'Basics',
  name: item.name,
  summary: item.summary,
  tags: item.category ? [item.category.toLowerCase(), item.id, ...(item.tags || [])] : [item.id, ...(item.tags || [])],
  code: item.code,
  defaultInsertBehavior: 'cursor',
  docs: item.id === 'offset'
    ? { builtin: 'offset', category: 'transform' }
    : item.id === 'cube' || item.id === 'sphere' || item.id === 'cylinder'
      ? { builtin: item.id, category: 'primitive' }
      : undefined,
}));

const RECIPE_ITEMS = [
  {
    id: 'offset-outset-profile',
    kind: 'recipe',
    section: 'Recipes',
    name: 'Outset Profile',
    summary: 'Grow a 2D profile before extrusion for walls, flanges, and soft edges.',
    tags: ['offset', '2d', 'walls', 'profile'],
    code: `// Outset Profile
// @param profile_size = 24 // min: 8, max: 120, step: 1
profile_size = 24;
// @param wall = 2 // min: 0.4, max: 12, step: 0.1
wall = 2;
// @param thickness = 4 // min: 1, max: 30, step: 0.1
thickness = 4;

linear_extrude(height = thickness, center = true) {
  offset(r = wall) {
    square([profile_size, profile_size], center = true);
  }
}
`,
    defaultInsertBehavior: 'append',
    mergeStrategy: 'template',
    docs: { builtin: 'offset', category: 'transform' },
  },
  {
    id: 'offset-inset-profile',
    kind: 'recipe',
    section: 'Recipes',
    name: 'Inset Profile',
    summary: 'Contract a 2D profile for pockets, cutouts, and shell interiors.',
    tags: ['offset', '2d', 'pocket', 'inset'],
    code: `// Inset Profile
// @param outer = 40 // min: 10, max: 180, step: 1
outer = 40;
// @param inset = 2 // min: 0.4, max: 12, step: 0.1
inset = 2;
// @param thickness = 3 // min: 1, max: 30, step: 0.1
thickness = 3;

linear_extrude(height = thickness, center = true) {
  offset(delta = -inset) {
    square([outer, outer], center = true);
  }
}
`,
    defaultInsertBehavior: 'append',
    mergeStrategy: 'template',
    docs: { builtin: 'offset', category: 'transform' },
  },
  {
    id: 'plate-from-sketch',
    kind: 'recipe',
    section: 'Recipes',
    name: 'Plate from Sketch',
    summary: 'Turn a 2D sketch into a clean printable plate with one extrusion.',
    tags: ['extrude', 'plate', '2d', 'starter'],
    code: `// Plate from Sketch
// @param width = 70 // min: 20, max: 220, step: 1
width = 70;
// @param depth = 40 // min: 20, max: 220, step: 1
depth = 40;
// @param thickness = 3 // min: 1, max: 20, step: 0.1
thickness = 3;

linear_extrude(height = thickness, center = true) {
  square([width, depth], center = true);
}
`,
    defaultInsertBehavior: 'append',
    mergeStrategy: 'template',
  },
  {
    id: 'rounded-profile-offset',
    kind: 'recipe',
    section: 'Recipes',
    name: 'Rounded Profile',
    summary: 'Use offset twice to round the corners of a 2D profile before extrusion.',
    tags: ['offset', 'rounded', 'profile', '2d'],
    code: `// Rounded Profile
// @param width = 60 // min: 20, max: 220, step: 1
width = 60;
// @param depth = 36 // min: 20, max: 220, step: 1
depth = 36;
// @param corner_radius = 5 // min: 1, max: 24, step: 0.1
corner_radius = 5;
// @param thickness = 8 // min: 1, max: 50, step: 0.1
thickness = 8;

module rounded_profile(size = [width, depth], r = corner_radius) {
  offset(r = r) {
    offset(delta = -r) {
      square(size, center = true);
    }
  }
}

linear_extrude(height = thickness, center = true) {
  rounded_profile();
}
`,
    defaultInsertBehavior: 'append',
    mergeStrategy: 'template',
    docs: { builtin: 'offset', category: 'transform' },
  },
  {
    id: 'starter-welcome',
    kind: 'recipe',
    section: 'Recipes',
    name: 'Starter Welcome',
    summary: 'A tiny parametric example that shows variables, transforms, and a buildable result.',
    tags: ['welcome', 'starter', 'learn'],
    code: `// Starter Welcome
// @param size = 18 // min: 6, max: 80, step: 1
size = 18;
// @param tilt = 25 // min: 0, max: 90, step: 1
tilt = 25;

rotate([0, tilt, 0]) {
  cube([size, size, size], center = true);
}
`,
    defaultInsertBehavior: 'append',
    mergeStrategy: 'template',
  },
];

const TEMPLATE_ITEMS = TEMPLATE_LIBRARY.map((item) => ({
  id: item.id,
  kind: 'template',
  section: 'Templates',
  name: item.name,
  summary: item.description,
  tags: item.tags,
  code: item.code,
  defaultInsertBehavior: 'append',
  mergeStrategy: 'template',
}));

export const START_LIBRARY = [
  ...BASIC_ITEMS,
  ...RECIPE_ITEMS,
  ...TEMPLATE_ITEMS,
];
