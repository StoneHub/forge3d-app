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

### macOS Development Preview Note

Downloaded macOS apps must be signed with a paid Developer ID certificate and notarized by Apple to open without Gatekeeper friction. Forge3D is currently a portfolio/development project, so macOS DMGs are intentionally published as unsigned native Apple Silicon development previews.

Browsers attach quarantine metadata to downloaded apps, so Gatekeeper can show:

```text
"Forge3D.app" is damaged and can't be opened. You should move it to the Trash.
```

Forge3D 3.0.2 and later make this explicit in the artifact name:

```text
Forge3D-<version>-mac-arm64-unsigned-dev-preview.dmg
```

The macOS package job reports the current release mode:

```bash
npm run verify:mac-release
```

For general users, prefer the source build path until paid Developer ID signing is added. For a downloaded unsigned preview that you personally trust, the local workaround is:

```bash
xattr -dr com.apple.quarantine /Applications/Forge3D.app
```

This is disclosed as a development-preview tradeoff, not treated as a production install flow.

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
git tag v3.0.2
git push origin v3.0.2
```

The workflow builds Windows, macOS, and Linux packages, captures release screenshots, uploads all artifacts, and creates or updates a prerelease on GitHub.

Current release notes should remain honest:

- OpenSCAD is required locally for rendering.
- macOS DMGs are unsigned native Apple Silicon development previews until paid Developer ID signing is added.
- Print Mode and slicer workflows are planned work until shipped.
