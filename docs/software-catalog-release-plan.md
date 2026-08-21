# Forge3D catalog and release plan

## Product position

Forge3D is a desktop OpenSCAD modeling IDE for practical CAD-to-print work. Public copy should describe working editing, rendering, viewport, and STL export behavior. It should not claim to replace mature CAD tools or include unfinished slicer workflows.

## Verified release state

- Catalog version: `3.0.2`
- Release tag: `v3.0.2`
- Release commit: `c5ad9ef`
- Successful workflow run: `25884265877`
- Published packages: Windows NSIS, unsigned Apple Silicon DMG, Linux AppImage
- Screenshot status: invalid as cross-platform evidence because all three uploaded PNG files share the Darwin digest
- Source status: newer than the published v3.0.2 artifacts

`product.json` points to the v3.0.2 prerelease page. It must keep the unsigned macOS warning and local OpenSCAD requirement.

## Current reconciliation

GitHub issue #7 tracks the integration of the remote release branch into main. The accepted tree must:

- Keep the useful release automation, OpenSCAD resolution, security guard, install helper, and viewport controls.
- Keep generated start-catalog thumbnails and release screenshots out until they are regenerated and reviewed from the accepted tree.
- Make manual publication use the exact requested tag.
- Run the package matrix on pull requests without publishing.
- Keep optional screenshots isolated by platform.
- Report the fixed unsigned macOS package truth.
- Keep README, changelog, package metadata, and `product.json` on version 3.0.2 while clearly identifying newer source changes.

## Catalog contract

The catalog reads root `product.json`.

- `releaseUrl` and `downloadUrl` point at a verified release page.
- `platforms` lists only platforms with published package assets.
- `requirements` names OpenSCAD and the unsigned macOS limitation.
- Screenshots point only at committed images that have been reviewed.
- The support link points at GitHub Issues.

## Hosting boundary

Forge3D's product site is static. Provider, DNS, quota, billing, and deployment policy remain blocked on Monroe's shared cross-project hosting decision.

Do not move DNS, repair a custom domain, change hosting, or add a Forge3D-specific provider before that policy is settled. A Forge3D failure must not consume or disrupt another project's capacity.

## Public copy rules

- Name OpenSCAD as a local requirement.
- Call v3.0.2 a prerelease.
- State that the macOS DMG is unsigned.
- Separate published package proof from current source state.
- Treat screenshots as platform proof only when their generation and digest are verified.
- Keep Print Mode and slicer integration in the roadmap until a release proves them.
