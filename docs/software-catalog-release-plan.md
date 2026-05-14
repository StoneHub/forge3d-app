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

Current blocker: release automation is now wired, but a version tag still needs to be pushed and the produced artifacts verified before `product.json` can point to a concrete download.

Work items:

1. Add `CHANGELOG.md` with a current `3.0.1` entry based on the real app state.
2. Run `npm run build` to verify renderer build.
3. Run `npm run capture:release-screenshot` to generate deterministic release screenshots from `docs/release-assets/forge3d-showcase.scad`.
4. Run `npm run dist` on the target packaging machine.
5. Confirm installers exist under `release/`.
6. Create a GitHub Release with assets:
   - Windows NSIS installer when available.
   - macOS DMG when available.
   - Linux AppImage when available.
   - Release screenshots from `docs/screenshots/release/`.
7. Update `product.json` `downloadUrl` after the first real release exists.

## Dedicated Product Site Handoff

`FORGE3D.SPACE` is owned through Bluehost and expires March 22, 2027. Firebase Hosting already has a `forge3d-space` site available under the shared `possible-haven-471616-f0` project.

Do not treat the standalone Forge3D site as ready until the release path is real. The next agent working in this repo should prepare the app and public materials first:

1. Publish real GitHub Release assets for the current desktop builds.
2. Add clear install and source-build instructions for unsigned preview builds.
3. Keep `product.json` honest: no direct `downloadUrl` until a release asset exists.
4. Add current screenshots and a short product-support path.
5. Draft a small static product site plan for `forge3d.space` after the release assets are live.

The intended relationship is:

- `monroes.tech/software/` remains the portfolio catalog entry.
- `forge3d.space` can become the product-specific site once downloads, screenshots, install docs, and support links are ready.
- Do not move domain/DNS or Firebase Hosting mappings without Monroe's explicit approval.

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
