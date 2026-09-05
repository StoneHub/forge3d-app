import test from 'node:test';
import assert from 'node:assert/strict';
import { clampBottomPanelHeight, COLLAPSED_BOTTOM_PANEL_HEIGHT } from '../src/forge3d/bottom-panel-layout.js';

test('dragging near the tab bar snaps fully closed instead of leaving a content strip', () => {
  for (const height of [-200, 0, 31, 60]) assert.equal(clampBottomPanelHeight(height), COLLAPSED_BOTTOM_PANEL_HEIGHT);
  assert.equal(clampBottomPanelHeight(70), 100);
  assert.equal(clampBottomPanelHeight(240), 240);
});

test('restoring or resizing a collapsed layout keeps it closed', () => {
  for (const max of [100, 250, 520]) assert.equal(clampBottomPanelHeight(31, max), 31);
  assert.equal(clampBottomPanelHeight(480, 250), 250);
  assert.equal(clampBottomPanelHeight(Number.NaN), 180);
});
