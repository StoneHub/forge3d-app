// Stop-motion capture helpers: real app, frames taken after each settled step.
import fs from 'fs';
import { sleep } from './lib.mjs';
export function timeline(win, dir) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const segs = []; let n = 0; let cursor = { x: 1100, y: 600 }; let last = null;
  const api = {
    get cursor() { return cursor; },
    async shot() { const f = `${dir}/${String(n++).padStart(4, '0')}.png`; await win.screenshot({ path: f }); last = f; return f; },
    hold(ms, pressed = false) { segs.push({ img: last, from: cursor, to: cursor, ms, pressed }); },
    glide(to, ms = 600, pressed = false) { segs.push({ img: last, from: cursor, to, ms, pressed }); cursor = to; },
    async settle() {
      await sleep(550);
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        const busy = await win.locator('button:has-text("Cancel")').count();
        if (!busy) break;
        await sleep(100);
      }
      await sleep(900);
    },
    save() { fs.writeFileSync(`${dir}/timeline.json`, JSON.stringify(segs)); },
  };
  return api;
}
export function actions(win, T) {
  return {
    async click(p, { glideMs = 650, wait = 900 } = {}) {
      T.glide(p, glideMs); T.hold(90, true);
      await win.mouse.move(p.x, p.y); await win.mouse.click(p.x, p.y);
      await sleep(wait); await T.shot(); T.hold(60, true); T.hold(250);
    },
    async clickLoc(loc, opts) {
      const b = await loc.boundingBox(); return this.click({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }, opts);
    },
  };
}
