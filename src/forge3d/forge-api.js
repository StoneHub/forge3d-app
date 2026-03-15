export function requireForgeAPI() {
  const forgeAPI = window.forgeAPI;
  if (!forgeAPI) {
    throw new Error(
      "Forge3D requires the Electron preload bridge. Launch the app through Electron, not a standalone browser tab."
    );
  }
  return forgeAPI;
}
