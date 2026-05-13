# Forge3D Catalog And Release Plan

## Goal

Make Forge3D the strongest downloadable product in Monroe's software catalog.

The product story should be: a desktop OpenSCAD modeling IDE for practical CAD-to-print workflows. Do not claim it replaces mature CAD software. Show what works, publish real builds, and make support/download paths clear.

## Catalog Metadata

Create a root `product.json` for `monroes.tech/software` to consume:

```json
{
  "slug": "forge3d",
  "name": "Forge3D",
  "kind": "desktop-app",
  "summary": "Desktop OpenSCAD modeling IDE for practical CAD-to-print workflows.",
  "status": "preview",
  "repo": "https://github.com/StoneHub/forge3d-app",
  "liveUrl": "",
  "releaseUrl": "https://github.com/StoneHub/forge3d-app/releases",
  "downloadUrl": "",
  "supportUrl": "",
  "license": "MIT",
  "platforms": ["Windows", "macOS", "Linux"],
  "requirements": ["OpenSCAD installed locally"],
  "highlights": [
    "OpenSCAD editor and render loop",
    "Three.js viewport",
    "Desktop packaging through Electron Builder"
  ],
  "screenshots": [
    {
      "src": "docs/screenshots/hero.png",
      "alt": "Forge3D editor and 3D viewport"
    }
  ]
}
```

## Release Work

Current blocker: README mentions GitHub Releases, but no published releases exist.

Work items:

1. Add `CHANGELOG.md` with a current `3.0.1` entry based on the real app state.
2. Run `npm run build` to verify renderer build.
3. Run `npm run dist` on the target packaging machine.
4. Confirm installers exist under `release/`.
5. Create a GitHub Release with assets:
   - Windows NSIS installer when available.
   - macOS DMG when available.
   - Linux AppImage when available.
6. Update `product.json` `downloadUrl` after the first real release exists.

## Public Copy Rules

- Mention OpenSCAD as a requirement.
- Be honest about preview status, signing, and platform maturity.
- If builds are unsigned, say so in release notes.
- Do not promise slicer workflows until they are working in a release.

## Verification

```bash
npm run build
npm run dist
git diff --check
```

If Electron main/preload files are changed:

```bash
node --check electron/main.mjs
node --check electron/preload.cjs
```
