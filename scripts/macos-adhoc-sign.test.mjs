import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import signMacPreview from './macos-adhoc-sign.mjs';

const projectDir = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const context = {
  electronPlatformName: 'darwin', appOutDir: '/tmp/forge3d-sign-test/mac-arm64',
  packager: { projectDir, appInfo: { productFilename: 'Forge3D' }, info: { framework: { version: '33.4.11' } }, platformSpecificBuildOptions: config.build.mac },
};

test('builder resolves the configured hook and local signing seals both nested and root bundles', async () => {
  const require = createRequire(import.meta.url);
  const { resolveFunction } = require('app-builder-lib/out/util/resolve.js');
  const hook = await resolveFunction('module', path.resolve(projectDir, config.build.afterPack), 'afterPack');
  assert.equal(hook, signMacPreview);
  const calls = [];
  await hook(context, {
    sign: async (options) => { calls.push(['sign', options]); },
    run: async (...args) => { calls.push(['verify', ...args]); },
  });
  const app = path.join(context.appOutDir, 'Forge3D.app');
  assert.equal(calls[0][0], 'sign');
  const options = calls[0][1];
  assert.equal(options.app, app);
  assert.equal(options.identity, '-');
  assert.equal(options.identityValidation, false);
  assert.equal(options.preAutoEntitlements, false);
  assert.equal(options.preEmbedProvisioningProfile, false);
  assert.equal(options.platform, 'darwin');
  assert.equal(options.version, '33.4.11');
  assert.deepEqual(options.optionsForFile(app), { entitlements: path.join(projectDir, config.build.mac.entitlements), hardenedRuntime: true, timestamp: 'none' });
  assert.deepEqual(options.optionsForFile(path.join(app, 'Contents', 'Frameworks', 'Forge3D Helper.app')), { entitlements: path.join(projectDir, config.build.mac.entitlementsInherit), hardenedRuntime: true, timestamp: 'none' });
  assert.deepEqual(calls[1], ['verify', '/usr/bin/codesign', ['--verify', '--deep', '--strict', app]]);
});

test('non-mac builds never invoke macOS signing or verification', async () => {
  const unexpected = async () => assert.fail('Unexpected macOS command');
  for (const electronPlatformName of ['win32', 'linux', 'mas']) {
    await signMacPreview({ electronPlatformName }, { sign: unexpected, run: unexpected });
  }
});

test('signature and resource verification failures abort packaging', async () => {
  await assert.rejects(signMacPreview(context, {
    sign: async () => { throw new Error('sign failed'); },
    run: async () => assert.fail('Do not verify an unsuccessful signature'),
  }), /sign failed/);
  await assert.rejects(signMacPreview(context, {
    sign: async () => {},
    run: async () => { throw new Error('invalid resource seal'); },
  }), /invalid resource seal/);
});
