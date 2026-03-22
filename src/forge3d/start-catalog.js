import angleBracketCode from './start-catalog/scad/helpers/angle_bracket.scad?raw';
import ballSocketMountCode from './start-catalog/scad/helpers/ball_socket_mount.scad?raw';
import chessPawnCode from './start-catalog/scad/examples/chess_pawn.scad?raw';
import impossibleRingCode from './start-catalog/scad/examples/impossible_ring_showcase.scad?raw';
import magneticLettersCode from './start-catalog/scad/examples/magnetic_letters_pro.scad?raw';
import quadsCode from './start-catalog/scad/examples/quads_relief_showcase.scad?raw';
import cubeStarterCode from './start-catalog/scad/learning/cube_starter.scad?raw';
import offsetProfileCode from './start-catalog/scad/learning/offset_profile.scad?raw';
import projectEnclosureCode from './start-catalog/scad/helpers/project_enclosure.scad?raw';
import insertBossPlateCode from './start-catalog/scad/helpers/insert_boss_plate.scad?raw';
import screwHoleSamplerCode from './start-catalog/scad/helpers/screw_hole_sampler.scad?raw';
import sphereStarterCode from './start-catalog/scad/learning/sphere_starter.scad?raw';
import threadedBoltCode from './start-catalog/scad/helpers/threaded_bolt.scad?raw';
import threadedHoleTestCode from './start-catalog/scad/helpers/threaded_hole_test.scad?raw';
import talonsCode from './start-catalog/scad/vendored/jeffbarr/talons.scad?raw';
import trianglePlateCode from './start-catalog/scad/learning/triangle_plate.scad?raw';
import angleBracketPreview from './start-catalog/previews/helper-angle-bracket.png';
import ballSocketMountPreview from './start-catalog/previews/helper-ball-socket-mount.png';
import magneticLettersPreview from './start-catalog/previews/example-magnetic-letters.png';
import chessPawnPreview from './start-catalog/previews/example-chess-pawn.png';
import impossibleRingPreview from './start-catalog/previews/example-impossible-ring.png';
import quadsPreview from './start-catalog/previews/example-quads.png';
import talonsPreview from './start-catalog/previews/example-talons.png';
import projectEnclosurePreview from './start-catalog/previews/helper-project-enclosure.png';
import insertBossPlatePreview from './start-catalog/previews/helper-insert-boss-plate.png';
import screwHoleSamplerPreview from './start-catalog/previews/helper-screw-hole-sampler.png';
import threadedBoltPreview from './start-catalog/previews/helper-threaded-bolt.png';
import threadedHoleTestPreview from './start-catalog/previews/helper-threaded-hole-test.png';
import cubeStarterPreview from './start-catalog/previews/learning-cube-starter.png';
import offsetProfilePreview from './start-catalog/previews/learning-offset-profile.png';
import sphereStarterPreview from './start-catalog/previews/learning-sphere-starter.png';
import trianglePlatePreview from './start-catalog/previews/learning-triangle-plate.png';
import openscadExamplesPreview from './start-catalog/previews/library-openscad-examples.svg';
import openscadObjectsPreview from './start-catalog/previews/library-openscad-objects.svg';
import threadlibPreview from './start-catalog/previews/library-threadlib.svg';

const SECTION_ORDER = ['examples', 'helpers', 'learning', 'libraries'];

export const START_SECTIONS = [
  { id: 'all', label: 'All' },
  { id: 'examples', label: 'Examples' },
  { id: 'helpers', label: 'Construction Helpers' },
  { id: 'learning', label: 'Learning' },
  { id: 'libraries', label: 'Libraries' },
];

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
    previewImage: magneticLettersPreview,
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'example-chess-pawn',
    section: 'examples',
    kind: 'example',
    name: 'Chess Pieces',
    summary: 'One file with reusable modules for pawn, rook, knight, bishop, queen, and king, selected by a single `piece` setting.',
    tags: ['chess', 'parametric', 'playful', 'piece-selector'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: chessPawnCode,
    previewImage: chessPawnPreview,
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'example-impossible-ring',
    section: 'examples',
    kind: 'example',
    name: 'Impossible Ring',
    summary: 'A fast, layered impossible-ring study tuned for Forge3D, inspired by Jeff Barr’s MIT collection.',
    tags: ['sculpture', 'illusion', 'curated'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: impossibleRingCode,
    previewImage: impossibleRingPreview,
    license: 'MIT',
    sourceRepoUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
  },
  {
    id: 'example-quads',
    section: 'examples',
    kind: 'example',
    name: 'Quads Relief',
    summary: 'A clean tapered quad field with deterministic relief, adapted from Jeff Barr’s MIT collection.',
    tags: ['pattern', 'surface', 'relief'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: quadsCode,
    previewImage: quadsPreview,
    license: 'MIT',
    sourceRepoUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
  },
  {
    id: 'example-talons',
    section: 'examples',
    kind: 'example',
    name: 'Talon Array',
    summary: 'A dramatic talon study with grid and ring layout modes from Jeff Barr’s MIT collection.',
    tags: ['talons', 'pattern', 'vendored'],
    sourceType: 'vendored',
    primaryAction: 'openExample',
    code: talonsCode,
    previewImage: talonsPreview,
    license: 'MIT',
    sourceRepoUrl: 'https://github.com/jeffbarr/OpenSCADObjects',
  },
  {
    id: 'helper-angle-bracket',
    section: 'helpers',
    kind: 'helper',
    name: 'Angle Bracket',
    summary: 'A practical L-bracket with four holes and an integrated gusset.',
    tags: ['bracket', 'mount', 'gusset'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: angleBracketCode,
    previewImage: angleBracketPreview,
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'helper-ball-socket-mount',
    section: 'helpers',
    kind: 'helper',
    name: 'Ball Socket Mount',
    summary: 'A compact socket mount starter with a slotted cup and two base screws.',
    tags: ['ball', 'socket', 'mount'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: ballSocketMountCode,
    previewImage: ballSocketMountPreview,
    license: 'MIT',
    sourceRepoUrl: null,
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
    previewImage: projectEnclosurePreview,
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
    previewImage: insertBossPlatePreview,
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
    previewImage: screwHoleSamplerPreview,
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
    previewImage: threadedBoltPreview,
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
    previewImage: threadedHoleTestPreview,
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'learning-cube-starter',
    section: 'learning',
    kind: 'learning',
    name: 'Shape Starter',
    summary: 'A selector-driven shape lineup that walks from low-poly solids to smoother and more mathematical forms.',
    tags: ['primitive', 'shapes', 'starter', 'math'],
    sourceType: 'builtin',
    primaryAction: 'openExample',
    code: cubeStarterCode,
    previewImage: cubeStarterPreview,
    license: 'MIT',
    sourceRepoUrl: null,
  },
  {
    id: 'learning-sphere-starter',
    section: 'learning',
    kind: 'learning',
    name: 'Sphere Starter',
    summary: 'A quick sphere setup with an optional flat and equator ring for form studies.',
    tags: ['sphere', 'round', 'starter'],
    sourceType: 'builtin',
    primaryAction: 'insert',
    code: sphereStarterCode,
    previewImage: sphereStarterPreview,
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
    previewImage: offsetProfilePreview,
    license: 'MIT',
    sourceRepoUrl: null,
    docs: { builtin: 'offset', category: 'transform' },
  },
  {
    id: 'learning-triangle-plate',
    section: 'learning',
    kind: 'learning',
    name: 'Triangle Plate',
    summary: 'A rounded triangle plate showing polygon, offset, and hole placement in one file.',
    tags: ['triangle', 'polygon', 'plate'],
    sourceType: 'builtin',
    primaryAction: 'appendSafe',
    code: trianglePlateCode,
    previewImage: trianglePlatePreview,
    license: 'MIT',
    sourceRepoUrl: null,
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
    previewImage: openscadExamplesPreview,
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
    previewImage: openscadObjectsPreview,
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
    previewImage: threadlibPreview,
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
