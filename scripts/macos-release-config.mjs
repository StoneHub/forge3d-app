export function hasMacCodeSigningIdentity(env = process.env) {
  return Boolean(env.CSC_LINK || env.CSC_NAME);
}

export function hasMacNotarizationCredentials(env = process.env) {
  const hasApiKey = Boolean(env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER);
  const hasAppleId = Boolean(env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID);
  const hasKeychainProfile = Boolean(env.APPLE_KEYCHAIN_PROFILE);
  return hasApiKey || hasAppleId || hasKeychainProfile;
}

export function validateMacReleaseCredentials(env = process.env) {
  const errors = [];
  if (!hasMacCodeSigningIdentity(env)) {
    errors.push('Missing macOS code-signing identity. Set CSC_LINK or CSC_NAME.');
  }
  if (!hasMacNotarizationCredentials(env)) {
    errors.push('Missing Apple notarization credentials. Set APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER, APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID, or APPLE_KEYCHAIN_PROFILE.');
  }
  return errors;
}

if (process.argv.includes('--require-ci-credentials')) {
  const errors = validateMacReleaseCredentials(process.env);
  if (errors.length > 0) {
    console.error([
      'Refusing to publish a macOS release that Gatekeeper will reject.',
      ...errors.map((error) => `- ${error}`),
    ].join('\n'));
    process.exit(1);
  }
  console.log('macOS release signing and notarization inputs are configured.');
}
