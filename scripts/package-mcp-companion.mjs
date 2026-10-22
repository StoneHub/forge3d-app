import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function prepareMcpCompanion({ root = ROOT, outputRoot = path.join(ROOT, 'release') } = {}) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const directory = path.join(outputRoot, `forge3d-mcp-${version}`)
  fs.mkdirSync(directory, { recursive: true })
  for (const relative of ['electron/mcp-server.mjs', 'electron/mcp-protocol.mjs', 'electron/mcp-config.mjs', 'docs/MCP.md', 'docs/INSTALL-MAC.md', 'docs/screenshots/forge3d-mcp-bracket.png', 'LICENSE']) {
    const destination = path.join(directory, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(root, relative), destination)
  }
  fs.writeFileSync(path.join(directory, 'package.json'), `${JSON.stringify({
    name: 'forge3d-mcp-companion', version, private: true, type: 'module', engines: { node: '>=22' }, license: 'MIT',
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(directory, 'README.md'), `# Forge3D MCP companion ${version}

Install the matching Forge3D desktop app and native OpenSCAD first. This companion requires Node.js 22+ but needs no npm install, source checkout, or Electron development package.

Configure your MCP client to run your absolute Node executable, with these arguments:

1. The absolute path to this folder's electron/mcp-server.mjs.
2. --app
3. The absolute path to the installed Forge3D executable.

Examples of the third argument:
- macOS: /Applications/Forge3D.app/Contents/MacOS/Forge3D (or your side-by-side app location).
- Windows: the installed Forge3D.exe, commonly under your user Programs directory.
- Linux: the installed Forge3D native executable. For an AppImage, use its executable path if your system supports AppImage launching, or the extracted native binary.

To generate a ready-to-copy \`mcpServers\` entry after installing Node.js 22+, run this command with the native app path for your platform:

    node /path/to/forge3d-mcp-${version}/electron/mcp-config.mjs --app "/Applications/Forge3D.app"

The helper prints JSON to stdout and does not launch Forge3D or edit any client configuration. Add \`--openscad "/absolute/path/to/openscad"\` only when Forge3D cannot discover your native OpenSCAD executable; this becomes the \`FORGE3D_OPENSCAD_BIN\` environment value. MCP clients and harnesses may wrap the same command, args, and optional env fields in different configuration formats.

Any MCP harness or provider with support for a local stdio server can connect. Use the generated \`command\`, \`args\`, and optional \`env\` values in that client's documented wrapper; Forge3D does not install a provider or edit client configuration. This release includes 15 tools across Design, Assembly, and print-bed preparation.

For an assembly workflow, ask the client to switch to Assembly Mode, read the current assembly revision, render trusted inline OpenSCAD source into a base and component meshes, then duplicate and position components using each latest assembly revision. Check the parts against the printer bed dimensions, prepare their layout, inspect the updated placement, capture the Assembly viewport, and export an assembly STL for an external slicer. The full 15-tool reference and JSON examples are in docs/MCP.md.

Design edits and assembly part sources remain in the isolated session; Forge3D does not save them to .scad files. Design and Assembly use separate revisions. Assembly transforms use viewport Y-up millimeters and XYZ degrees; OpenSCAD source and STL use Z-up, with OpenSCAD [x,y,z] mapping to viewport [x,z,-y]. Print preparation checks bed fit, floor contact, and conservative axis-aligned bounding-box overlaps. It does not slice, create G-code, control a printer, add supports, or validate exact mesh collision/manifold quality. Assembly STL combines visible meshes without boolean union. If you prepare a \`partIds\` subset, pass the same IDs to assembly export; otherwise all visible parts are exported. Exports are temporary; copy wanted files to durable storage.

Example on macOS (replace paths for your system):

    node /path/to/forge3d-mcp-${version}/electron/mcp-server.mjs --app /Applications/Forge3D.app/Contents/MacOS/Forge3D

The command speaks newline JSON MCP on stdin/stdout and opens a NEW isolated window. Closing client stdin closes that window. It does not attach to an existing model or install client configuration. Review client permissions separately. Only trust clients and OpenSCAD source you intend to run: source can read local files, so the temporary profile is not a filesystem sandbox.

macOS builds are ad-hoc-signed Apple Silicon development previews without Apple Developer ID signing or notarization. See docs/INSTALL-MAC.md for installation and individual macOS approval. Do not disable system protections to bypass a blocked launch. Native OpenSCAD must be installed separately on every platform.

See docs/MCP.md for tools, revisions, exports, troubleshooting, and full safety details. Release: https://github.com/StoneHub/forge3d-app/releases/tag/v${version}
`)
  return directory
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(prepareMcpCompanion())
}
