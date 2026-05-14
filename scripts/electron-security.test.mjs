import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isAllowedExternalUrl,
  isAllowedRendererNavigation,
} from '../electron/security.mjs';

test('allows only safe external URL protocols', () => {
  assert.equal(isAllowedExternalUrl('https://openscad.org/downloads.html'), true);
  assert.equal(isAllowedExternalUrl('mailto:support@example.com'), true);
  assert.equal(isAllowedExternalUrl('http://example.com'), false);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('file:///tmp/model.scad'), false);
});

test('allows renderer navigation only to app origins', () => {
  assert.equal(isAllowedRendererNavigation('http://localhost:5173/src/main.jsx', { isDev: true }), true);
  assert.equal(isAllowedRendererNavigation('http://127.0.0.1:5173/src/main.jsx', { isDev: true }), true);
  assert.equal(isAllowedRendererNavigation('https://example.com', { isDev: true }), false);
  assert.equal(isAllowedRendererNavigation('file:///app/dist/index.html', { isDev: false }), true);
  assert.equal(isAllowedRendererNavigation('https://example.com', { isDev: false }), false);
});
