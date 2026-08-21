import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OFFICIAL_OPENSCAD_DOWNLOAD_URL,
  OFFICIAL_OPENSCAD_SUPPORT_URL,
  buildOpenScadSupportMessage,
  shouldShowOpenScadSupport,
} from '../src/forge3d/openscad-support.js';

test('points users to the official OpenSCAD downloads page', () => {
  assert.equal(OFFICIAL_OPENSCAD_DOWNLOAD_URL, 'https://openscad.org/downloads.html');
  assert.equal(OFFICIAL_OPENSCAD_SUPPORT_URL, 'https://openscad.org/community.html');
  assert.match(buildOpenScadSupportMessage(), /official OpenSCAD downloads/);
  assert.match(buildOpenScadSupportMessage(), /FORGE3D_OPENSCAD_BIN/);
});

test('shows OpenSCAD support only for missing or unlaunchable OpenSCAD errors', () => {
  assert.equal(shouldShowOpenScadSupport([
    { message: 'OpenSCAD executable not found.' },
  ]), true);
  assert.equal(shouldShowOpenScadSupport([
    { message: 'OpenSCAD executable could not be launched.' },
  ]), true);
  assert.equal(shouldShowOpenScadSupport([
    'Install OpenSCAD from https://openscad.org/downloads.html',
  ]), true);
  assert.equal(shouldShowOpenScadSupport([
    { message: 'Parser error: syntax error in main.scad' },
  ]), false);
});
