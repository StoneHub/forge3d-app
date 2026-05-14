# Forge3D Release Automation

Forge3D releases are built from tagged commits by `.github/workflows/release.yml`.

## Local Release Screenshot

The release screenshot fixture is:

```text
docs/release-assets/forge3d-showcase.scad
```

Generate the current platform screenshot with:

```bash
npm run build
npm run capture:release-screenshot
```

The script launches Electron against the production `dist/` renderer, loads the showcase model, renders it through the native OpenSCAD executable, captures the full app window, and writes:

```text
docs/screenshots/release/forge3d-showcase-<platform>.png
```

Start catalog preview thumbnails are committed assets. Regenerate them explicitly when the catalog source changes:

```bash
npm run generate:start-previews
```

Installer packaging intentionally does not regenerate those thumbnails.

## OpenSCAD Resolution

Forge3D checks for OpenSCAD in this order:

1. `FORGE3D_OPENSCAD_BIN`
2. Platform defaults such as `/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD`, `/opt/homebrew/bin/openscad`, and `C:\Program Files\OpenSCAD\openscad.com`
3. `openscad` entries on `PATH`

Set `FORGE3D_OPENSCAD_BIN` in CI or local shells when OpenSCAD is installed somewhere custom.

### macOS Gatekeeper Note

On Apple Silicon Macs, prefer:

```bash
brew install --cask openscad@snapshot
```

The stable Homebrew `openscad` cask can install an Intel OpenSCAD app bundle and may require Rosetta. If `npm run capture:release-screenshot` reports that OpenSCAD does not respond to `--version`, manually approve OpenSCAD in System Settings or remove quarantine from the specific OpenSCAD app only after deciding you trust that installed app.

If the snapshot app launches but crashes during render, force the Rosetta slice for automation:

```bash
FORGE3D_OPENSCAD_ARCH=x86_64 npm run capture:release-screenshot
```

The release screenshot script also accepts:

```bash
npm run capture:release-screenshot -- --force-rosetta
```

## GitHub Release

Push a version tag to run the release workflow:

```bash
git tag v3.0.1
git push origin v3.0.1
```

The workflow builds Windows, macOS, and Linux packages, captures release screenshots, uploads all artifacts, and creates or updates a prerelease on GitHub.

Current release notes should remain honest:

- OpenSCAD is required locally for rendering.
- macOS builds are unsigned preview builds unless signing and notarization are configured.
- Print Mode and slicer workflows are planned work until shipped.
