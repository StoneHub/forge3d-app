import chessPawnCode from './start-catalog/scad/examples/chess_pawn.scad?raw';
import magneticLettersCode from './start-catalog/scad/examples/magnetic_letters_pro.scad?raw';
import cubeStarterCode from './start-catalog/scad/learning/cube_starter.scad?raw';
import offsetProfileCode from './start-catalog/scad/learning/offset_profile.scad?raw';
import projectEnclosureCode from './start-catalog/scad/helpers/project_enclosure.scad?raw';
import insertBossPlateCode from './start-catalog/scad/helpers/insert_boss_plate.scad?raw';
import screwHoleSamplerCode from './start-catalog/scad/helpers/screw_hole_sampler.scad?raw';
import threadedBoltCode from './start-catalog/scad/helpers/threaded_bolt.scad?raw';
import threadedHoleTestCode from './start-catalog/scad/helpers/threaded_hole_test.scad?raw';
import impossibleRingCode from './start-catalog/scad/vendored/jeffbarr/impossible_ring.scad?raw';
import quadsCode from './start-catalog/scad/vendored/jeffbarr/quads.scad?raw';
import talonsCode from './start-catalog/scad/vendored/jeffbarr/talons.scad?raw';

const SECTION_ORDER = ['examples', 'helpers', 'learning', 'libraries'];

export const START_SECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'examples', label: 'Examples' },
  { id: 'helpers', label: 'Construction Helpers' },
  { id: 'learning', label: 'Learning' },
  { id: 'libraries', label: 'Libraries' },
];

function createPreviewPath(id) {
  return `/start-previews/${id}.png`;
}

export const START_CATALOG = [
  {
    id: 'example-magnetic-letters',
    section: 'examples',
    kind: 'example',
    name: 'Magnetic Letters Pro',
    summary: 'Parametric fridge-letter demo with smart magnet pocket placement.',
    tags: ['letters', 'magnets', 'text', 'parametric'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: magneticLettersCode,
    previewImage: createPreviewPath('example-magnetic-letters'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'example-chess-pawn',
    section: 'examples',
    kind: 'example',
    name: 'Chess Pawn',
    summary: 'A printable pawn profile built with rotate_extrude.',
    tags: ['chess', 'rotate_extrude', 'playful'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: chessPawnCode,
    previewImage: createPreviewPath('example-chess-pawn'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'example-impossible-ring',
    section: 'examples',
    kind: 'example',
    name: 'Impossible Ring',
    summary: 'Hand-crafted impossible ring sculpture from Jeff Barr’s MIT collection.',
    tags: ['sculpture', 'illusion', 'vendored'],
    sourceType: 'vendored',
    primaryAction: 'openExample',
    code: impossibleRingCode,
    previewImage: createPreviewPath('example-impossible-ring'),
    license: 'MIT',
    sourceRepoUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
  },
  {
    id: 'example-quads',
    section: 'examples',
    kind: 'example',
    name: 'Quads Relief',
    summary: 'A perturbation-driven relief pattern from Jeff Barr’s MIT collection.',
    tags: ['pattern', 'surface', 'vendored'],
    sourceType: 'vendored',
    primaryAction: 'openExample',
    code: quadsCode,
    previewImage: createPreviewPath('example-quads'),
    license: 'MIT',
    sourceRepoUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
  },
  {
    id: 'example-talons',
    section: 'examples',
    kind: 'example',
    name: 'Talon Array',
    summary: 'A dramatic ring/grid talon study from Jeff Barr’s MIT collection.',
    tags: ['talons', 'pattern', 'vendored'],
    sourceType: 'vendored',
    primaryAction: 'openExample',
    code: talonsCode,
    previewImage: createPreviewPath('example-talons'),
    license: 'MIT',
    sourceRepoUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
  },
  {
    id: 'helper-project-enclosure',
    section: 'helpers',
    kind: 'helper',
    name: 'Project Enclosure',
    summary: 'Rounded shell starter with wall thickness, floor thickness, and lid lip.',
    tags: ['enclosure', 'electronics', 'shell'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: projectEnclosureCode,
    previewImage: createPreviewPath('helper-project-enclosure'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'helper-insert-boss-plate',
    section: 'helpers',
    kind: 'helper',
    name: 'Insert Boss Plate',
    summary: 'A fast starter for heat-set insert bosses and mounting plates.',
    tags: ['insert', 'boss', 'mounting'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: insertBossPlateCode,
    previewImage: createPreviewPath('helper-insert-boss-plate'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'helper-screw-hole-sampler',
    section: 'helpers',
    kind: 'helper',
    name: 'Screw Hole Sampler',
    summary: 'Clearance, counterbore, and countersink examples in one reference block.',
    tags: ['screw', 'counterbore', 'countersink'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: screwHoleSamplerCode,
    previewImage: createPreviewPath('helper-screw-hole-sampler'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'helper-threaded-bolt',
    section: 'helpers',
    kind: 'helper',
    name: 'Threaded Bolt Starter',
    summary: 'A self-contained helical bolt example for prototyping threaded fasteners.',
    tags: ['bolt', 'thread', 'fastener'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: threadedBoltCode,
    previewImage: createPreviewPath('helper-threaded-bolt'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'helper-threaded-hole-test',
    section: 'helpers',
    kind: 'helper',
    name: 'Threaded Hole Test',
    summary: 'A printable block for tuning thread pitch, depth, and pilot diameter.',
    tags: ['thread', 'tap', 'hole'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: threadedHoleTestCode,
    previewImage: createPreviewPath('helper-threaded-hole-test'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'learning-cube-starter',
    section: 'learning',
    kind: 'learning',
    name: 'Cube Starter',
    summary: 'The smallest useful OpenSCAD starter: one variable and one primitive.',
    tags: ['primitive', 'starter'],
    sourceType: 'builtin',
    primaryAction: 'insert',
    code: cubeStarterCode,
    previewImage: createPreviewPath('learning-cube-starter'),
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'learning-offset-profile',
    section: 'learning',
    kind: 'learning',
    name: 'Rounded Offset Profile',
    summary: 'A compact example showing how offset can round a 2D profile before extrusion.',
    tags: ['offset', 'extrude', '2d'],
    sourceType: 'builtin',
    primaryAction: 'appendSafe',
    code: offsetProfileCode,
    previewImage: createPreviewPath('learning-offset-profile'),
    license: 'MIT',
    sourceRepoUrl: null,
    docs: { builtin: 'offset', category: 'transform' },
  },
  {
    id: 'library-openscad-examples',
    section: 'libraries',
    kind: 'reference',
    name: 'Official OpenSCAD Examples',
    summary: 'Reference the upstream example catalog for language patterns and modeling idioms.',
    tags: ['official', 'reference'],
    sourceType: 'library-wrapper',
    primaryAction: 'openExternal',
    externalUrl: 'https://github.com/openscad/openscad/wiki/Examples',
    previewImage: null,
    license: 'GPL-2.0',
    sourceRepoUrl: 'https://github.com/openscad/openscad/wiki/Examples',
  },
  {
    id: 'library-openscad-objects',
    section: 'libraries',
    kind: 'reference',
    name: 'OpenSCAD Objects Collection',
    summary: 'Jeff Barr’s MIT-licensed object gallery for playful, display-oriented models.',
    tags: ['gallery', 'fun', 'mit'],
    sourceType: 'library-wrapper',
    primaryAction: 'openExternal',
    externalUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
    previewImage: null,
    license: 'MIT',
    sourceRepoUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
  },
  {
    id: 'library-threadlib',
    section: 'libraries',
    kind: 'reference',
    name: 'threadlib Reference',
    summary: 'Upstream BSD-3-Clause thread library with standards tables and additional fastener utilities.',
    tags: ['threadlib', 'threads', 'bsd'],
    sourceType: 'library-wrapper',
    primaryAction: 'openExternal',
    externalUrl: 'https://github.com/adrianschlatter/threadlib',
    previewImage: null,
    license: 'BSD-3-Clause',
    sourceRepoUrl: 'https://github.com/adrianschlatter/threadlib',
  },
];

export function getStartSectionLabel(sectionId) {
  return START_SECTIONS.find((section) => section.id === sectionId)?.label || sectionId;
}

export function sortStartItems(items) {
  return [...items].sort((a, b) => {
    const sectionDelta = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    if (sectionDelta !== 0) return sectionDelta;
    return a.name.localeCompare(b.name);
  });
}

export const START_LIBRARY = START_CATALOG;
