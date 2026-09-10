# Changelog

## Unreleased

## 3.1.0 - 2026-09-09

Forge3D v3.1.0 adds a practical assembly workflow while keeping OpenSCAD source portable and editable.

### Included

- Measure between two model surfaces with a persistent session log.
- Place round through-holes while retaining the original part and cutter in the assembly scene.
- Read automatic dimensions and picked distances with consistent, zoom-independent labels.
- Use a cleaner assembly inspector and compact Measure, Hole, and View controls.
- Collapse Console, Problems, and Terminal completely to their tab bar.
- Explore six editable Math Lab studies in knots, recursion, waves, polar curves, phyllotaxis, and ruled surfaces.
- Import SCAD through native OpenSCAD with relative dependencies, preserve assembly transforms, and export STL with corrected coordinates.

### Preview limitations

- OpenSCAD must be installed separately.
- The Apple Silicon DMG is unsigned and unnotarized; Gatekeeper may require manual approval.
- OpenSCAD language-server support is limited to Windows development builds. Packaged Windows support and macOS/Linux binaries remain follow-up work.
- Print Mode, integrated slicing, surface sketches, and compact Merge/Split tools remain planned.

- Reconciled the v3.0.2 release work with the main branch.
- Made manual release runs check out the requested tag.
- Isolated optional release screenshots by operating system.
- Added Windows PATH support for both `openscad.com` and `openscad.exe`.
- Restricted packaged renderer navigation to Forge3D's own entry file.
- Made the macOS release report match the fixed unsigned-preview package configuration.

## 3.0.2 - 2026-05-14

Forge3D v3.0.2 is a public prerelease built from commit `c5ad9ef`. The successful release workflow produced a Windows NSIS installer, an unsigned native Apple Silicon DMG, and a Linux AppImage.

The package files are verified release assets. The screenshots are not platform proof. The three uploaded screenshot files have the same Darwin image digest, so the Windows and Linux screenshots are mislabeled copies.

### Included

- Native OpenSCAD resolution on Windows, macOS, and Linux.
- Cross-platform Electron packaging through GitHub Actions.
- Viewport appearance controls for edges, shading, color, and opacity.
- An unsigned-preview macOS package with explicit Gatekeeper guidance.

## 3.0.1 - 2026-05-13

Forge3D entered preview as an Electron desktop OpenSCAD modeling IDE. No public installer assets were published for this version.

### Current app state

- Native OpenSCAD rendering through the locally installed OpenSCAD binary.
- Three.js viewport with orbit, pan, zoom, grid, axes, edge overlay, and dimension brackets.
- Monaco-based OpenSCAD editor with syntax highlighting, file open/save, and workspace helpers.
- Parameter controls from OpenSCAD variables and `// @param` annotations.
- Windows OpenSCAD LSP diagnostics, embedded terminal, recent files, and STL export.
- Electron Builder packaging was configured, but no public installer assets were published for v3.0.1.

### Known release notes

- OpenSCAD must be installed locally for rendering.
- Windows is the most mature target today; macOS and Linux packaging are configured but should be validated with real release assets before being advertised as ready-to-download builds.
- Print Mode and slicer workflows remain planned work, not a shipped release feature.
