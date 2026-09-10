# Release readiness: September 9, 2026

Decision: hold a general public release. Prepare v3.1.0 as the next feature release; do not reuse the existing v3.0.2 tag or installers. No tag or release was created by this audit.

## Source and verification

- Default branch: `9e55d8e6b88dfc48d749c7ee443d3a40f2854d98`, including merged PRs #14, #19–#21, #23, #25, #30, #32, #36, and #38.
- Its tree matches `701138f`, the feature head packaged successfully on macOS, Windows, and Linux in [Actions run 33974656483](https://github.com/StoneHub/forge3d-app/actions/runs/33974656483). The publish job was skipped because this was a PR run.
- Fresh dependency install, `npm run test:node` (55 passed, 6 native gallery tests skipped), and `npm run build` succeeded on September 9. This is build/test evidence, not new installed cross-platform acceptance.
- Package and lockfile still identify the app as 3.0.2. README and the macOS configuration test also reference that version. Update them together once a release candidate is selected.
- Latest public download remains [v3.0.2 prerelease](https://github.com/StoneHub/forge3d-app/releases/tag/v3.0.2), published May 14. Existing conventions are Windows NSIS, Linux AppImage, and an explicitly unsigned Apple Silicon DMG.

## Distribution blockers

1. macOS packaging explicitly sets `identity: null` and `notarize: false`. `verify:mac-release` reports `publishableForGeneralMacUsers: false` but exits successfully: it is a report, not a gate. The workflow has no signing/notarization credential wiring; repository secret and environment inventories were empty at audit time. A Developer ID signing identity and notarization credentials must be provisioned through a secure channel, then wired into CI. Require signature verification, notarization acceptance, and stapler/Gatekeeper checks on the actual downloadable artifact. Do not present an unsigned development preview as a signed general release.
2. The workflow always publishes a prerelease with generic notes and can edit an existing release and replace its assets. Before the new release, use version-specific reviewed notes and an intentional release channel. Build and verify assets before exposing the release, and preserve historical downloads.
3. [Issue #18](https://github.com/StoneHub/forge3d-app/issues/18) remains relevant: macOS/Linux have no bundled language server, while packaged Windows expects a resource path that packaging does not provide. README's broad LSP claim needs qualification; Windows packaged launch needs proof or the feature must be explicitly marked unavailable.
4. [Issue #28](https://github.com/StoneHub/forge3d-app/issues/28): screenshot steps are allowed to fail. Successful packaging does not certify screenshots. Capture and inspect current public-safe images before including them in release notes.

Windows signing is also not configured in the current workflow; document its trust status and validate the installer on Windows. Linux packaging success likewise does not replace an installed launch/render/export check. A deliberately labeled preview could follow the prior convention, but that would not satisfy the general-release readiness decision above.

## Draft v3.1.0 notes

Forge3D adds practical assembly editing to its native OpenSCAD workflow.

- Measure between two model surfaces and keep a session measurement log.
- Place round through-holes while retaining the original part and cutter in the assembly scene.
- Read automatic dimensions and picked distances with consistent, zoom-independent labels and high-contrast lines.
- Use a cleaner assembly inspector and compact Measure, Hole, and View controls.
- Collapse Console, Problems, and Terminal completely to their tab bar.
- Explore six editable Math Lab examples covering knots, recursion, waves, polar curves, phyllotaxis, and ruled surfaces.
- Import SCAD through native OpenSCAD with relative dependencies, preserve supported assembly transforms, and export STL with corrected coordinates.

OpenSCAD must be installed separately. Print Mode and integrated slicing remain planned. General surface sketches, precise snapping, and a compact Merge/Split workflow are follow-up work, not included features. Language-server availability and platform trust/install requirements must be filled in from the verified final artifacts before publishing these notes.

## Completion path

Provision the signing/notarization inputs; address the distribution and claim gaps above; bump the selected candidate to 3.1.0; run tests and packaging on that exact revision; verify each downloadable platform artifact; publish with the reviewed notes and checksums. Leave the existing May prereleases intact.
