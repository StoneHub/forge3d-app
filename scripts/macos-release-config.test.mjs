import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasMacCodeSigningIdentity,
  hasMacNotarizationCredentials,
} from './macos-release-config.mjs';

const packageConfig = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('macOS releases are native arm64 DMGs with hardened runtime notarization enabled', () => {
  const macConfig = packageConfig.build?.mac || {};
  const dmgTarget = Array.isArray(macConfig.target)
    ? macConfig.target.find((target) => target?.target === 'dmg')
    : null;

  assert.equal(packageConfig.version, '3.0.2');
  assert.deepEqual(dmgTarget, { target: 'dmg', arch: ['arm64'] });
  assert.equal(macConfig.hardenedRuntime, true);
  assert.equal(macConfig.gatekeeperAssess, false);
  assert.equal(macConfig.notarize, true);
  assert.equal(macConfig.entitlements, 'build/entitlements.mac.plist');
  assert.equal(macConfig.entitlementsInherit, 'build/entitlements.mac.inherit.plist');
  assert.equal(fs.existsSync(new URL('../build/entitlements.mac.plist', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../build/entitlements.mac.inherit.plist', import.meta.url)), true);
});

test('macOS release credential detection requires signing and notarization inputs', () => {
  assert.equal(hasMacCodeSigningIdentity({}), false);
  assert.equal(hasMacCodeSigningIdentity({ CSC_LINK: 'certificate-base64' }), true);
  assert.equal(hasMacCodeSigningIdentity({ CSC_NAME: 'Developer ID Application: Example' }), true);

  assert.equal(hasMacNotarizationCredentials({}), false);
  assert.equal(hasMacNotarizationCredentials({
    APPLE_API_KEY: 'AuthKey.p8',
    APPLE_API_KEY_ID: 'ABC123',
    APPLE_API_ISSUER: 'issuer-uuid',
  }), true);
  assert.equal(hasMacNotarizationCredentials({
    APPLE_ID: 'dev@example.com',
    APPLE_APP_SPECIFIC_PASSWORD: 'app-password',
    APPLE_TEAM_ID: 'TEAMID',
  }), true);
  assert.equal(hasMacNotarizationCredentials({
    APPLE_KEYCHAIN_PROFILE: 'forge3d-notary',
  }), true);
});
