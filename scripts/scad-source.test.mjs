import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createScadSourceRenderer, formatScadFailure } from '../electron/scad-source.mjs'

async function fixture(t, renderInput) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge3d-source-test-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const inputPath = path.join(dir, 'buffer.scad')
  const outputPath = path.join(dir, 'output.stl')
  return {
    dir, inputPath, outputPath,
    render: createScadSourceRenderer({ renderInput, createPaths: () => ({ inputPath, outputPath }) }),
  }
}

test('SCAD file import supplies an output path and preserves native bytes, diagnostics and source', async (t) => {
  const stlBuffer = Buffer.from('solid fixture\nendsolid fixture')
  const f = await fixture(t, async (input, output, options) => {
    assert.equal(input, sourcePath)
    assert.equal(typeof output, 'string')
    assert.equal(options.cwd, path.dirname(sourcePath))
    assert.equal(options.removeInput, false)
    assert.equal(await fs.readFile(path.join(options.cwd, 'size.scad'), 'utf8'), 'size=10;')
    await fs.writeFile(output, stlBuffer)
    return { stlBuffer, stdout: 'echo', stderr: 'warning', command: 'openscad fixture' }
  })
  const sourcePath = path.join(f.dir, 'source.scad')
  await fs.writeFile(sourcePath, 'include <size.scad>; cube(size);')
  await fs.writeFile(path.join(f.dir, 'size.scad'), 'size=10;')
  const result = await f.render({ sourcePath, sourceName: 'source.scad' })
  assert.deepEqual(result.stlBuffer, stlBuffer)
  assert.equal(result.stderr, 'warning')
  assert.equal(result.stdout, 'echo')
  assert.deepEqual(result.source, { kind: 'scad-file', filePath: sourcePath })
  assert.match(await fs.readFile(sourcePath, 'utf8'), /include/)
  await assert.rejects(fs.access(f.outputPath), { code: 'ENOENT' })
})

test('Design buffers use the same result contract and remove only successful scratch files', async (t) => {
  const f = await fixture(t, async (input, output, options) => {
    assert.equal(await fs.readFile(input, 'utf8'), 'cube(2);')
    assert.deepEqual(options.defineOverrides, ['$fn=16'])
    assert.equal(options.requestId, 'design-1')
    await fs.writeFile(output, 'mesh')
    return { stlBuffer: Buffer.from('mesh'), stdout: '', stderr: '' }
  })
  const sourcePath = path.join(f.dir, 'saved.scad')
  await fs.writeFile(sourcePath, 'cube(1);')
  const result = await f.render({ code: 'cube(2);', sourcePath, requestId: 'design-1', defineOverrides: ['$fn=16'] })
  assert.deepEqual(result.source, { kind: 'active-render', filePath: sourcePath })
  assert.equal(await fs.readFile(sourcePath, 'utf8'), 'cube(1);')
  await assert.rejects(fs.access(f.inputPath), { code: 'ENOENT' })
  await assert.rejects(fs.access(f.outputPath), { code: 'ENOENT' })
})

test('failed renders preserve source/debug input, clean partial output and retain diagnostics', async (t) => {
  const f = await fixture(t, async (input, output) => {
    await fs.writeFile(output, 'partial')
    throw Object.assign(new Error('render failed'), { stderr: `ERROR in ${input}`, code: 1 })
  })
  await assert.rejects(f.render({ code: 'invalid', sourceName: 'Broken.scad' }), (error) => {
    assert.equal(error.code, 1)
    assert.match(error.forgeMessage, /ERROR in Broken.scad/)
    assert.equal(error.debugSourcePath, f.inputPath)
    return true
  })
  assert.equal(await fs.readFile(f.inputPath, 'utf8'), 'invalid')
  await assert.rejects(fs.access(f.outputPath), { code: 'ENOENT' })
  const sourcePath = path.join(f.dir, 'import.scad')
  await fs.writeFile(sourcePath, 'bad import')
  await assert.rejects(f.render({ sourcePath }))
  assert.equal(await fs.readFile(sourcePath, 'utf8'), 'bad import')
})

test('empty native results fail explicitly instead of creating empty Assembly parts', async (t) => {
  const f = await fixture(t, async () => ({ stlBuffer: Buffer.alloc(0) }))
  await assert.rejects(f.render({ code: 'cube(1);' }), /no STL geometry/)
  assert.equal(formatScadFailure(new Error('missing source')), 'missing source')
})
