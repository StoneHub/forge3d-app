// Stop-motion capture helpers: the real app is screenshotted after each settled step,
// and compose.py later replays the frames with an eased cursor drawn on top.
import fs from 'fs';
import { sleep } from './lib.mjs';

export function timeline(win, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const segments = [];
  let frame = 0;
  let cursor = { x: 1100, y: 600 };
  let last = null;
  return {
    // Screenshot the window; later hold/glide segments show this frame.
    async shot() {
      last = `${dir}/${String(frame++).padStart(4, '0')}.png`;
      await win.screenshot({ path: last });
      return last;
    },
    hold(ms, pressed = false) {
      segments.push({ img: last, from: cursor, to: cursor, ms, pressed });
    },
    glide(to, ms = 600, pressed = false) {
      segments.push({ img: last, from: cursor, to, ms, pressed });
      cursor = to;
    },
    // Wait for Auto Render's 400 ms debounce, the build, and a few WebGL frames.
    async settle() {
      await sleep(550);
      const start = Date.now();
      while (Date.now() - start < 30000) {
        if (!await win.locator('button:has-text("Cancel")').count()) break;
        await sleep(100);
      }
      await sleep(900);
    },
    save() {
      fs.writeFileSync(`${dir}/timeline.json`, JSON.stringify(segments));
    },
  };
}

export function actions(win, T) {
  return {
    async click(p, { glideMs = 650, wait = 900 } = {}) {
      T.glide(p, glideMs);
      T.hold(90, true);
      await win.mouse.click(p.x, p.y);
      await sleep(wait);
      await T.shot();
      T.hold(60, true);
      T.hold(250);
    },
    async clickLoc(loc, opts) {
      const b = await loc.boundingBox();
      return this.click({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }, opts);
    },
  };
}

// Screen geometry of each parameter slider, in sidebar order.
export async function sliderTracks(win) {
  return win.locator('input[type=range]').evaluateAll((els) => els.map((e) => {
    const b = e.getBoundingClientRect();
    return { min: +e.min, max: +e.max, x: b.x, y: b.y + b.height / 2, w: b.width };
  }));
}

// Point on a slider track for a value (the thumb is about 14 px wide).
export function sliderPoint(track, value) {
  const t = (value - track.min) / (track.max - track.min);
  return { x: Math.round(track.x + 7 + t * (track.w - 14)), y: Math.round(track.y) };
}
