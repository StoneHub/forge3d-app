import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const enableSourceMaps = process.env.FORGE3D_SOURCEMAP === 'true'
const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
const appVersion = packageJson.version

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: enableSourceMaps,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/monaco-editor')) {
            return 'monaco'
          }
        },
      },
    },
  },
})
