import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = fileURLToPath(import.meta.url)

export async function bundlePreload({
  feedbackEnabled = false,
  outfile = path.join(repoRoot, 'electron', 'preload.bundle.cjs'),
  logLevel = 'info',
} = {}) {
  return build({
    entryPoints: [path.join(repoRoot, 'electron', 'preload.cjs')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    define: {
      __FORGE3D_FEEDBACK_INSPECTOR__: JSON.stringify(feedbackEnabled),
    },
    logLevel,
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await bundlePreload({ feedbackEnabled: process.argv.includes('--feedback') })
}
