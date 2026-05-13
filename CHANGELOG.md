# Changelog

## 3.0.1 - 2026-05-13

Forge3D is in preview as an Electron desktop OpenSCAD modeling IDE. This release state reflects the current app and catalog metadata; no public installer assets are published yet on GitHub Releases.

### Current app state

- Native OpenSCAD rendering through the locally installed OpenSCAD binary.
- Three.js viewport with orbit, pan, zoom, grid, axes, edge overlay, and dimension brackets.
- Monaco-based OpenSCAD editor with syntax highlighting, file open/save, and workspace helpers.
- Parameter controls from OpenSCAD variables and `// @param` annotations.
- Windows OpenSCAD LSP diagnostics, embedded terminal, recent files, and STL export.
- Electron Builder packaging is configured, but no public installer assets are published yet.

### Known release notes

- OpenSCAD must be installed locally for rendering.
- Windows is the most mature target today; macOS and Linux packaging are configured but should be validated with real release assets before being advertised as ready-to-download builds.
- Print Mode and slicer workflows remain planned work, not a shipped release feature.
