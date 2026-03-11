// OpenSCAD WASM Web Worker
// Uses the high-level renderToStl API for simplicity and reliability.
// Fonts are loaded once via the low-level FS API for text() support.
import { createOpenSCAD } from 'openscad-wasm';

let instancePromise = null;

async function getInstance() {
  if (!instancePromise) {
    instancePromise = (async () => {
      const openscad = await createOpenSCAD({
        noInitialRun: true,
      });
      // Load fonts into the WASM FS so text() works
      await loadFonts(openscad.getInstance());
      return openscad;
    })();
  }
  return instancePromise;
}

async function loadFonts(fs_instance) {
  // Fonts served locally from /public/fonts/ (copied from OpenSCAD installation)
  // self.location.origin gives the Vite dev server or Electron origin
  const origin = self.location.origin;
  const fonts = [
    { name: 'LiberationSans-Bold.ttf',    url: `${origin}/fonts/LiberationSans-Bold.ttf` },
    { name: 'LiberationSans-Regular.ttf', url: `${origin}/fonts/LiberationSans-Regular.ttf` },
  ];

  try { fs_instance.FS.mkdir('/fonts'); } catch (_) {}

  for (const { name, url } of fonts) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        fs_instance.FS.writeFile(`/fonts/${name}`, new Uint8Array(buf));
      }
    } catch (_) {
      // Best-effort — text() may fall back to no font
    }
  }

  // fontconfig so OpenSCAD finds our fonts
  try { fs_instance.FS.mkdir('/etc'); } catch (_) {}
  try { fs_instance.FS.mkdir('/etc/fonts'); } catch (_) {}
  fs_instance.FS.writeFile('/etc/fonts/fonts.conf', `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>/fonts</dir>
  <cachedir>/tmp/fc-cache</cachedir>
  <match target="pattern">
    <edit name="family" mode="append_last">
      <string>Liberation Sans</string>
    </edit>
  </match>
</fontconfig>
`);
}

// Pre-warm the instance as soon as the worker spawns
getInstance().catch(() => {});

self.onmessage = async (e) => {
  const { type, id, code } = e.data;
  if (type !== 'render') return;

  const stdout = [];
  const stderr = [];

  try {
    const openscad = await getInstance();

    // Capture print output by overriding on the raw instance
    const raw = openscad.getInstance();
    raw.print    = (t) => stdout.push(t);
    raw.printErr = (t) => stderr.push(t);

    // Use the built-in high-level API
    let stlText;
    try {
      stlText = await openscad.renderToStl(code);
    } catch (renderErr) {
      // renderToStl may throw if OpenSCAD returns non-zero exit
      const allOutput = [...stdout, ...stderr].join('\n');
      let error = renderErr.message || String(renderErr);
      if (allOutput.includes("Can't get font") || allOutput.includes('Current top level object is empty')) {
        error = 'Font not found. Use font_name = "Liberation Sans:style=Bold" in your .scad file.';
      } else if (stderr.length > 0) {
        error = stderr.join('\n');
      }
      self.postMessage({ type: 'error', id, error, stdout: stdout.join('\n'), stderr: stderr.join('\n') });
      return;
    }

    if (!stlText || stlText.length < 10) {
      const allOutput = [...stdout, ...stderr].join('\n');
      let error = 'OpenSCAD produced empty output';
      if (allOutput.includes("Can't get font") || allOutput.includes('Current top level object is empty')) {
        error = 'Model is empty — likely a missing font. Use font_name = "Liberation Sans:style=Bold".';
      } else if (stderr.length > 0) {
        error = stderr.join('\n');
      }
      self.postMessage({ type: 'error', id, error, stdout: stdout.join('\n'), stderr: stderr.join('\n') });
      return;
    }

    // Encode ASCII STL as UTF-8 bytes and transfer the buffer
    const encoded = new TextEncoder().encode(stlText);
    const buffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);

    self.postMessage({
      type: 'result',
      id,
      stl: buffer,
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
    }, [buffer]);

  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      error: err.message || String(err),
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
    });
  }
};
