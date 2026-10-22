import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { signAsync } from '@electron/osx-sign';

const runFile = promisify(execFile);

// electron-builder 25 skips signing when mac.identity=null; it does not handle
// '-' as an ad-hoc identity. Seal the finished bundle explicitly before the DMG.
// No certificate, keychain search, provisioning profile, or timestamp service.
export async function signMacPreview(context, { sign = signAsync, run = runFile } = {}) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const projectDir = context.packager.projectDir;
  const mac = context.packager.platformSpecificBuildOptions;
  const entitlements = path.resolve(projectDir, mac.entitlements);
  const inheritedEntitlements = path.resolve(projectDir, mac.entitlementsInherit);
  await sign({
    app, platform: 'darwin', identity: '-', identityValidation: false,
    version: context.packager.info.framework.version,
    preAutoEntitlements: false, preEmbedProvisioningProfile: false,
    optionsForFile: (file) => ({
      entitlements: file === app ? entitlements : inheritedEntitlements,
      hardenedRuntime: mac.hardenedRuntime !== false,
      timestamp: 'none',
    }),
  });
  // Keep verification explicit and fail packaging if the resource seal is bad.
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  console.log('macOS preview: sealed ad-hoc signature verified; no Developer ID or notarization.');
}

export default signMacPreview;
