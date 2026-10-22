export function describeMacReleaseMode() {
  return {
    mode: 'ad-hoc-dev-preview',
    signed: true,
    developerIdSigned: false,
    notarized: false,
    publishableForGeneralMacUsers: false,
  };
}

if (process.argv.includes('--describe-mode')) {
  const mode = describeMacReleaseMode(process.env);
  console.log(`macOS release mode: ${mode.mode}`);
  if (!mode.publishableForGeneralMacUsers) {
    console.log('This macOS preview has an ad-hoc integrity signature, without an Apple-trusted Developer ID or notarization. Downloaded copies may require macOS user approval or remain blocked.');
  }
}
