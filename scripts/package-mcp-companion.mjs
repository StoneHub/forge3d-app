import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function prepareMcpCompanion({ root = ROOT, outputRoot = path.join(ROOT, 'release') } = {}) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const directory = path.join(outputRoot, `forge3d-mcp-${version}`)
  fs.mkdirSync(directory, { recursive: true })
  for (const relative of ['electron/mcp-server.mjs', 'electron/mcp-protocol.mjs', 'docs/MCP.md', 'docs/screenshots/forge3d-mcp-bracket.png', 'LICENSE']) {
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

Example on macOS (replace paths for your system):

    node /path/to/forge3d-mcp-${version}/electron/mcp-server.mjs --app /Applications/Forge3D.app/Contents/MacOS/Forge3D

The command speaks newline JSON MCP on stdin/stdout and opens a NEW isolated window. Closing client stdin closes that window. It does not attach to an existing model or install client configuration. Review client permissions separately. Only trust clients and OpenSCAD source you intend to run: source can read local files, so the temporary profile is not a filesystem sandbox.

macOS builds are unsigned, unnotarized Apple Silicon development previews. Do not disable system protections to bypass a blocked launch. Native OpenSCAD must be installed separately on every platform.

See docs/MCP.md for tools, revisions, exports, troubleshooting, and full safety details. Release: https://github.com/StoneHub/forge3d-app/releases/tag/v${version}
`)
  return directory
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(prepareMcpCompanion())
}
