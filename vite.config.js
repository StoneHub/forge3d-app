import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const enableSourceMaps = process.env.FORGE3D_SOURCEMAP === 'true'

export default defineConfig({
  plugins: [react()],
  base: './',
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
