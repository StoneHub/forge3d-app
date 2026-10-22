import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeMacReleaseMode,
} from './macos-release-config.mjs';

const packageConfig = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('macOS releases seal native arm64 development preview DMGs with an explicit ad-hoc hook', () => {
  const macConfig = packageConfig.build?.mac || {};
  const dmgTarget = Array.isArray(macConfig.target)
    ? macConfig.target.find((target) => target?.target === 'dmg')
    : null;

  assert.equal(packageConfig.version, '3.2.0');
  assert.deepEqual(dmgTarget, { target: 'dmg', arch: ['arm64'] });
  assert.match(macConfig.artifactName, /ad-hoc-dev-preview/);
  assert.equal(packageConfig.build.afterPack, 'scripts/macos-adhoc-sign.mjs');
  assert.equal(packageConfig.devDependencies['@electron/osx-sign'], '1.3.1');
  assert.equal(macConfig.identity, null);
  assert.equal(macConfig.hardenedRuntime, true);
  assert.equal(macConfig.gatekeeperAssess, false);
  assert.equal(macConfig.notarize, false);
  assert.equal(macConfig.entitlements, 'build/entitlements.mac.plist');
  assert.equal(macConfig.entitlementsInherit, 'build/entitlements.mac.inherit.plist');
  assert.equal(fs.existsSync(new URL('../build/entitlements.mac.plist', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../build/entitlements.mac.inherit.plist', import.meta.url)), true);
});

test('macOS release mode distinguishes ad-hoc integrity from Apple-trusted distribution', () => {
  assert.deepEqual(describeMacReleaseMode({}), {
    mode: 'ad-hoc-dev-preview',
    signed: true,
    developerIdSigned: false,
    notarized: false,
    publishableForGeneralMacUsers: false,
  });
  assert.deepEqual(describeMacReleaseMode({
    CSC_LINK: 'certificate-base64',
    APPLE_API_KEY: 'AuthKey.p8',
    APPLE_API_KEY_ID: 'ABC123',
    APPLE_API_ISSUER: 'issuer-uuid',
  }), {
    mode: 'ad-hoc-dev-preview',
    signed: true,
    developerIdSigned: false,
    notarized: false,
    publishableForGeneralMacUsers: false,
  });
});
