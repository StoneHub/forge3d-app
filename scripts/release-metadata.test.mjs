import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const product = JSON.parse(fs.readFileSync(new URL('../product.json', import.meta.url), 'utf8'));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

test('release metadata agrees on version 3.0.2', () => {
  assert.equal(packageJson.version, '3.0.2');
  assert.equal(packageLock.version, '3.0.2');
  assert.equal(packageLock.packages[''].version, '3.0.2');
  assert.equal(product.version, '3.0.2');
  assert.match(readme, /version-3\.0\.2/);
  assert.match(changelog, /## 3\.0\.2 - 2026-05-14/);
});

test('catalog metadata points at the verified prerelease without overstating it', () => {
  assert.equal(product.releaseUrl, 'https://github.com/StoneHub/forge3d-app/releases/tag/v3.0.2');
  assert.equal(product.downloadUrl, product.releaseUrl);
  assert.deepEqual(product.platforms, ['Windows', 'macOS', 'Linux']);
  assert.match(product.status, /prerelease/i);
  assert.match(product.requirements.join('\n'), /OpenSCAD installed locally/);
  assert.match(product.requirements.join('\n'), /unsigned/i);
});

test('public docs separate published artifacts from newer source changes', () => {
  assert.match(readme, /built those packages from commit `c5ad9ef`/i);
  assert.match(readme, /current source contains changes newer than those artifacts/i);
  assert.match(changelog, /three uploaded screenshot files have the same Darwin image digest/i);
});
