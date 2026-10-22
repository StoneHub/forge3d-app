# Install Forge3D 3.2.0 on a Mac

This release is for Apple Silicon (M1 or later), with macOS 11 or later. The app is ad-hoc signed and its resource seal is verified during packaging. It has **no Apple Developer ID signature or notarization**. Ad-hoc signing verifies bundle integrity; it does not establish Apple-trusted publisher identity.

## Install and open

1. Download `Forge3D-3.2.0-mac-arm64-ad-hoc-dev-preview.dmg` from the [official v3.2.0 release](https://github.com/StoneHub/forge3d-app/releases/tag/v3.2.0). `SHA256SUMS.txt` lists the asset checksums. You can verify a downloaded file with `shasum -a 256` and compare the exact filename and digest.
2. Open the DMG. Drag **Forge3D.app** to **Applications**. Preserve an existing version before replacing it, and save any open work first.
3. Open **Applications → Forge3D**. The installed app's Dock name is Forge3D. A source preview launched using stock Electron keeps the Electron name.
4. If macOS blocks the app because the developer cannot be verified, dismiss that warning, then open **System Settings → Privacy & Security**. If macOS offers **Open Anyway** for Forge3D, choose it, authenticate yourself if asked, and confirm **Open**. This is an individual app approval; do not change the global security policy.

Apple documents this flow in [Safely open apps on your Mac](https://support.apple.com/102445). Availability depends on macOS and device policy. If **Open Anyway** is absent, or macOS reports malware, a revoked signature, or an organization policy restriction, stop and retain protections. This preview cannot guarantee installation on a managed Mac that disallows unnotarized apps. Do not disable Gatekeeper, strip quarantine, or use a terminal command to bypass a blocked launch. A successful local build/test is not proof that a downloaded copy will pass Gatekeeper automatically.

## Native rendering

Install [OpenSCAD](https://openscad.org/downloads.html) separately and open it normally once. Forge3D finds `/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD` and common Homebrew locations. Use an Apple Silicon-capable build. The packaged Forge3D GUI needs neither Node.js nor npm.

## Connect an agent from any provider

Use a harness that supports **local MCP over stdio**, Node.js 22+, and `forge3d-mcp-3.2.0.zip` from this same release. Extract the ZIP to a permanent directory. In Terminal, run (replace the companion path):

```sh
node /absolute/path/forge3d-mcp-3.2.0/electron/mcp-config.mjs --app /Applications/Forge3D.app
```

The command prints client configuration with absolute paths; it does not change any client settings. For custom OpenSCAD installations, add `--openscad /absolute/path/to/OpenSCAD`.

Merge the generated `forge3d` entry into clients using `mcpServers`. Other clients may use another configuration format: copy its command, arguments, and optional environment variables into their local stdio server settings. Restart/reload that client as required. No Forge3D API key, provider subscription, source checkout, npm install, or remote server is needed. Your chosen harness/provider controls its own access and billing.

After connecting, the client discovers 15 tools. Try: “Create a multi-part OpenSCAD assembly in Forge3D, show me its real viewport capture, arrange its parts on a 220 × 220 × 250 mm bed, and export the STL.” See the companion's [MCP guide](MCP.md) for exact tools and revisions.

Each connection opens a new visible, isolated window. It cannot attach to your existing unsaved model. Agents can model, assemble, arrange, inspect and export; this release has no slicer, G-code generator or printer control. OpenSCAD source can read local files, so only connect trusted clients and render trusted code. Save wanted source/scenes through the app and copy temporary exported files to durable storage.
