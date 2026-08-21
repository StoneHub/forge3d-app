import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeMacReleaseMode,
} from './macos-release-config.mjs';

const packageConfig = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('macOS releases are native arm64 unsigned development preview DMGs', () => {
  const macConfig = packageConfig.build?.mac || {};
  const dmgTarget = Array.isArray(macConfig.target)
    ? macConfig.target.find((target) => target?.target === 'dmg')
    : null;

  assert.equal(packageConfig.version, '3.0.2');
  assert.deepEqual(dmgTarget, { target: 'dmg', arch: ['arm64'] });
  assert.match(macConfig.artifactName, /unsigned-dev-preview/);
  assert.equal(macConfig.identity, null);
  assert.equal(macConfig.hardenedRuntime, true);
  assert.equal(macConfig.gatekeeperAssess, false);
  assert.equal(macConfig.notarize, false);
  assert.equal(macConfig.entitlements, 'build/entitlements.mac.plist');
  assert.equal(macConfig.entitlementsInherit, 'build/entitlements.mac.inherit.plist');
  assert.equal(fs.existsSync(new URL('../build/entitlements.mac.plist', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../build/entitlements.mac.inherit.plist', import.meta.url)), true);
});

test('macOS release mode follows the fixed unsigned packaging configuration', () => {
  assert.deepEqual(describeMacReleaseMode({}), {
    mode: 'unsigned-dev-preview',
    signed: false,
    notarized: false,
    publishableForGeneralMacUsers: false,
  });
  assert.deepEqual(describeMacReleaseMode({
    CSC_LINK: 'certificate-base64',
    APPLE_API_KEY: 'AuthKey.p8',
    APPLE_API_KEY_ID: 'ABC123',
    APPLE_API_ISSUER: 'issuer-uuid',
  }), {
    mode: 'unsigned-dev-preview',
    signed: false,
    notarized: false,
    publishableForGeneralMacUsers: false,
  });
});
