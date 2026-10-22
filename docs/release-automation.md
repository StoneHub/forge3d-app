# Forge3D release automation

Forge3D packages tagged commits through `.github/workflows/release.yml`.

## Verified v3.0.2 release

The public v3.0.2 prerelease points at commit `c5ad9ef`. GitHub Actions run `25884265877` completed successfully on May 14, 2026 with these jobs:

- Windows package
- macOS package
- Linux package
- GitHub Release publication

The release has a Windows NSIS installer, an unsigned native Apple Silicon DMG, and a Linux AppImage. The current source contains changes newer than those packages.

The release screenshots are not platform proof. The three uploaded PNG files share the same Darwin image digest. Do not use the Windows or Linux filenames as evidence that those platforms produced distinct captures.

## Workflow behavior

Pull requests that touch packaging inputs run the package matrix. They do not publish a GitHub Release.

Tag pushes matching `v*` package that exact tag and publish a prerelease. A manual run requires an existing tag and checks out that tag in both the package and publish jobs.

Repository contents are read-only during packaging. Only the publish job receives `contents: write`.

## Release screenshots

The screenshot fixture is:

```text
docs/release-assets/forge3d-showcase.scad
```

Generate the current platform screenshot with:

```bash
npm run build
npm run capture:release-screenshot
```

The script launches Electron against the production renderer, loads the fixture, renders it through OpenSCAD, and writes:

```text
docs/screenshots/release/forge3d-showcase-<platform>.png
```

Release screenshots are generated artifacts. They are not committed. CI uploads only the current matrix platform's exact filename. Screenshot failure warns but does not hide a successful package.

Start-catalog thumbnails are separate committed assets. Regenerate them only when their source changes:

```bash
npm run generate:start-previews
```

## OpenSCAD resolution

Forge3D checks for OpenSCAD in this order:

1. `FORGE3D_OPENSCAD_BIN`
2. Platform defaults
3. Executables on `PATH`

Windows checks both `openscad.com` and `openscad.exe`. macOS checks the application bundle and common Homebrew locations. Linux checks system locations and `PATH`.

Set `FORGE3D_OPENSCAD_BIN` when OpenSCAD is installed somewhere else.

## macOS preview policy

The current macOS package is an ad-hoc signed native Apple Silicon development preview. `scripts/macos-adhoc-sign.mjs` runs in electron-builder's `afterPack` hook and signs the nested code and final app bundle, then requires `codesign --verify --deep --strict` to succeed before a DMG is produced. This fixes the invalid resource seal left by Electron's original linker signature after packaging.

The hook uses `@electron/osx-sign` with identity `-`, the configured main/inherited entitlements, hardened runtime, and no timestamp service. It does not search for certificates, embed a provisioning profile, change security settings, or remove quarantine attributes. `mac.identity` stays `null` to keep electron-builder 25 from trying a second certificate-based signing pass. Notarization remains disabled; environment credentials do not change this policy.

An ad-hoc signature proves bundle integrity locally. It does not establish an Apple-trusted Developer ID and does not make the app notarized. Downloaded copies can still require user approval through normal macOS controls or be blocked. A general macOS release requires Developer ID signing and Apple notarization.

On Apple Silicon, the current OpenSCAD snapshot is the preferred development dependency:

```bash
brew install --cask openscad@snapshot
```

If native OpenSCAD cannot launch, Forge3D can fall back to Rosetta. Force that path for diagnostics with:

```bash
FORGE3D_OPENSCAD_ARCH=x86_64 npm run capture:release-screenshot
```

## Publishing a future release

1. Merge the intended source and pass the pull-request package matrix.
2. Update package, lockfile, changelog, README, and catalog metadata to one version.
3. Create the version tag on the exact reviewed commit.
4. Push the tag.
5. Verify each package job and the release job separately.
6. Compare published asset names and digests with the workflow output.
7. Update public download claims only after that proof exists.

Print Mode and slicer integration remain planned work until a released artifact proves them.
