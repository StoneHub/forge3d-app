import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Forge3D can execute its initial render with the Electron bridge present', async () => {
  const output = await build({
    absWorkingDir: root,
    entryPoints: ['src/Forge3D.jsx'], bundle: true, write: false,
    platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external',
    loader: { '.scad': 'text', '.png': 'dataurl', '.svg': 'dataurl' }, logLevel: 'silent',
    plugins: [{
      name: 'native-widget-boundaries',
      setup(builder) {
        // Monaco and xterm require a real DOM. Keep the parent component and its
        // hooks real; actual widget/viewport behavior is covered in Electron QA.
        builder.onResolve({ filter: /\/(editor|terminal)\.jsx$/ }, (args) => ({ path: args.path, namespace: 'widget-stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'widget-stub' }, () => ({
          contents: 'export const CodeEditor = () => null; export default () => null;', loader: 'js',
        }));
      },
    }],
  });
  const exports = {};
  const context = {
    exports, module: { exports }, require: createRequire(path.join(root, 'package.json')),
    console, crypto: globalThis.crypto, URL, setTimeout, clearTimeout,
    window: { forgeAPI: {}, localStorage: { getItem: () => null } },
  };
  vm.runInNewContext(output.outputFiles[0].text, context);
  const html = renderToStaticMarkup(React.createElement(context.module.exports.default));
  assert.match(html, /Forge3D/);
  assert.match(html, /Assembly/);
});
