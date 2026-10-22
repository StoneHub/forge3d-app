#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const USAGE = 'Usage: node electron/mcp-config.mjs --app <absolute-app-bundle-or-executable> [--openscad <absolute-executable>]\nPrints an mcpServers JSON entry; does not launch Forge3D or edit client configuration.\n'

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag !== '--app' && flag !== '--openscad') {
      throw new Error(`Unknown option: ${flag}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a path`)
    if (options[flag]) throw new Error(`${flag} may only be provided once`)
    options[flag] = value
    index += 1
  }
  if (!options['--app']) throw new Error('Required option missing: --app')
  return options
}

function resolveExecutable(value, label, { appBundle = false } = {}) {
  if (!path.isAbsolute(value)) throw new Error(`${label} path must be absolute: ${value}`)
  let candidate = value
  if (appBundle && path.extname(candidate).toLowerCase() === '.app') {
    candidate = path.join(candidate, 'Contents', 'MacOS', 'Forge3D')
  }
  let resolved
  try {
    resolved = fs.realpathSync(candidate)
  } catch {
    throw new Error(`${label} executable was not found: ${candidate}`)
  }
  let info
  try {
    info = fs.statSync(resolved)
  } catch {
    throw new Error(`${label} executable could not be inspected: ${resolved}`)
  }
  if (!info.isFile()) throw new Error(`${label} path is not a file: ${resolved}`)
  if (process.platform !== 'win32' && (info.mode & 0o111) === 0) {
    throw new Error(`${label} file is not executable: ${resolved}`)
  }
  return resolved
}

export function createMcpConfig({ app, openscad, companionRoot = path.resolve(HERE, '..') }) {
  if (!app) throw new Error('Required option missing: --app')
  const appPath = resolveExecutable(app, 'Forge3D', { appBundle: true })
  const serverPath = fs.realpathSync(path.join(companionRoot, 'electron', 'mcp-server.mjs'))
  const config = {
    mcpServers: {
      forge3d: {
        command: process.execPath,
        args: [serverPath, '--app', appPath],
      },
    },
  }
  if (openscad) {
    config.mcpServers.forge3d.env = {
      FORGE3D_OPENSCAD_BIN: resolveExecutable(openscad, 'OpenSCAD'),
    }
  }
  return config
}

export function runMcpConfigCli(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--help') {
    process.stderr.write(USAGE)
    return
  }
  const options = parseArgs(argv)
  const config = createMcpConfig({ app: options['--app'], openscad: options['--openscad'] })
  process.stdout.write(`${JSON.stringify(config, null, 2)}\n`)
}

function isMainModule() {
  if (!process.argv[1]) return false
  try {
    // realpath handles macOS /var -> /private/var paths and invoked symlinks.
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  }
}

if (isMainModule()) {
  try {
    runMcpConfigCli()
  } catch (error) {
    process.stderr.write(`Forge3D MCP config: ${error.message}\n`)
    process.exitCode = 2
  }
}
