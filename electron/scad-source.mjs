import fs from 'node:fs/promises'
import path from 'node:path'

export function formatScadFailure(error, { inputPath, sourceName = 'Current buffer' } = {}) {
  return [...new Set([error.stderr, error.stdout, error.message]
    .filter(Boolean)
    .map((value) => {
      const text = String(value)
      return (inputPath ? text.split(inputPath).join(sourceName)
        .split(path.basename(inputPath)).join(sourceName) : text).trim()
    }))].join('\n') || 'OpenSCAD render failed.'
}

// Design buffers and source-file imports share the same native result contract.
// Only generated inputs are disposable; imported source files are never removed.
export function createScadSourceRenderer({ renderInput, createPaths }) {
  return async function renderSource({ code, sourcePath = null, sourceName = 'Current buffer', ...options }) {
    const isBuffer = typeof code === 'string'
    if (!isBuffer && !sourcePath) throw new Error('A SCAD source path or code buffer is required.')
    const paths = createPaths()
    const inputPath = isBuffer ? paths.inputPath : sourcePath
    const outputPath = paths.outputPath
    const startedAt = Date.now()
    let succeeded = false

    try {
      if (isBuffer) await fs.writeFile(inputPath, code, 'utf8')
      const result = await renderInput(inputPath, outputPath, {
        ...options,
        cwd: sourcePath && !sourcePath.includes('.asar') ? path.dirname(sourcePath) : undefined,
        removeInput: false,
      })
      if (!Buffer.isBuffer(result?.stlBuffer) || result.stlBuffer.length === 0) {
        throw new Error('OpenSCAD returned no STL geometry.')
      }
      succeeded = true
      return {
        ...result,
        source: { kind: isBuffer ? 'active-render' : 'scad-file', filePath: sourcePath },
        sourceName,
        debugSourcePath: null,
        elapsedMs: Date.now() - startedAt,
      }
    } catch (error) {
      error.forgeMessage = formatScadFailure(error, { inputPath, sourceName })
      error.debugSourcePath = inputPath
      error.elapsedMs = Date.now() - startedAt
      throw error
    } finally {
      await fs.unlink(outputPath).catch(() => {})
      // Keep failed generated input for the existing debug-source action.
      if (isBuffer && succeeded) await fs.unlink(inputPath).catch(() => {})
    }
  }
}
