import { launch, newWithCode, showParams, sleep, modelPath, framesDir } from './lib.mjs';
import { timeline } from './stop.mjs';
const { app, win } = await launch();
await newWithCode(app, win, modelPath('twisted_vessel.scad'));
await showParams(win);
await win.getByRole('button', { name: 'Build', exact: true }).click();
await sleep(4000);
const T = timeline(win, framesDir('live-build'));
const ranges = await win.locator('input[type=range]').evaluateAll(els => els.map(e => { const b = e.getBoundingClientRect(); return { min: +e.min, max: +e.max, x: b.x, y: b.y + b.height / 2, w: b.width }; }));
const [height, lobes, twist, flare] = ranges;
const px = (r, v) => ({ x: Math.round(r.x + 7 + (v - r.min) / (r.max - r.min) * (r.w - 14)), y: Math.round(r.y) });
await win.mouse.move(1100, 600);
await T.shot(); T.hold(900);
async function drag(r, from, path, stepHold = 140, endHold = 700) {
  const start = px(r, from);
  T.glide(start, 650);
  await win.mouse.move(start.x, start.y); await win.mouse.down();
  T.hold(120, true);
  let v = from;
  for (const target of path) {
    const vals = target.vals;
    for (const nv of vals) {
      const p = px(r, nv);
      T.glide(p, 90, true);
      await win.mouse.move(p.x, p.y);
      await T.settle(); await T.shot(); T.hold(stepHold, true);
      v = nv;
    }
    T.hold(endHold, true);
  }
  await win.mouse.up();
  T.hold(150);
}
const range = (a, b, s) => { const o = []; for (let x = a + s * Math.sign(b - a); Math.sign(b - a) * (b - x) >= -1e-9; x += s * Math.sign(b - a)) o.push(+x.toFixed(3)); return o; };
await drag(twist, 90, [{ vals: range(90, 0, 15) }, { vals: range(0, 180, 15) }]);
await drag(lobes, 6, [{ vals: range(6, 3, 1) }, { vals: range(3, 8, 1) }], 260);
await drag(flare, 1.3, [{ vals: range(1.3, 0.7, 0.1) }, { vals: range(0.7, 1.7, 0.1) }]);
await drag(height, 64, [{ vals: range(64, 88, 4) }]);
T.glide({ x: 1100, y: 520 }, 700); T.hold(1500);
T.save();
await app.close();
