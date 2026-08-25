import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const feedbackEnabled = process.argv.includes('--feedback')

await build({
  entryPoints: [path.join(repoRoot, 'electron', 'preload.cjs')],
  outfile: path.join(repoRoot, 'electron', 'preload.bundle.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  define: {
    __FORGE3D_FEEDBACK_INSPECTOR__: JSON.stringify(feedbackEnabled),
  },
  logLevel: 'info',
})
