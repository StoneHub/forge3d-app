import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getReleaseNotes } from './release-notes.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const product = JSON.parse(fs.readFileSync(new URL('../product.json', import.meta.url), 'utf8'));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

test('release metadata agrees on version 3.2.0', () => {
  assert.equal(packageJson.version, '3.2.0');
  assert.equal(packageLock.version, '3.2.0');
  assert.equal(packageLock.packages[''].version, '3.2.0');
  assert.equal(product.version, '3.2.0');
  assert.match(readme, /version-3\.2\.0/);
  assert.match(changelog, /## 3\.2\.0 - 2026-10-22/);
});

test('catalog metadata points at the preview release without overstating it', () => {
  assert.equal(product.releaseUrl, 'https://github.com/StoneHub/forge3d-app/releases/tag/v3.2.0');
  assert.equal(product.downloadUrl, product.releaseUrl);
  assert.deepEqual(product.platforms, ['macOS']);
  assert.match(product.status, /prerelease/i);
  assert.match(product.requirements.join('\n'), /OpenSCAD installed locally/);
  assert.match(product.requirements.join('\n'), /ad-hoc-signed/i);
});

test('public docs state platform limitations', () => {
  assert.match(readme, /ad-hoc integrity signature/i);
  assert.match(readme, /packaged Windows support and macOS\/Linux binaries remain follow-up work/i);
  assert.match(changelog, /ad-hoc-signed, unnotarized/i);
});

test('release notes select only the requested version and reject missing tags', () => {
  const notes = getReleaseNotes(changelog, 'v3.2.0');
  assert.match(notes, /MCP companion/);
  assert.doesNotMatch(notes, /## 3\.1\.0/);
  assert.throws(() => getReleaseNotes(changelog, 'main'), /Expected a version tag/);
  assert.throws(() => getReleaseNotes(changelog, 'v99.0.0'), /No changelog entry/);
});
