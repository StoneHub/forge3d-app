export function describeMacReleaseMode() {
  return {
    mode: 'unsigned-dev-preview',
    signed: false,
    notarized: false,
    publishableForGeneralMacUsers: false,
  };
}

if (process.argv.includes('--describe-mode')) {
  const mode = describeMacReleaseMode(process.env);
  console.log(`macOS release mode: ${mode.mode}`);
  if (!mode.publishableForGeneralMacUsers) {
    console.log('This macOS artifact is an unsigned development preview. macOS may block launch; use the normal approval flow and do not disable system protections.');
  }
}
