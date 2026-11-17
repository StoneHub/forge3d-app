import { sleep, framesDir } from './lib.mjs';
import { timeline, actions } from './stop.mjs';
import { bracket } from './bracket-setup.mjs';
const { app, win } = await bracket();
const T = timeline(win, framesDir('dimension-brackets')); const A = actions(win, T);
// start with dimensions off so turning them on is the reveal
await win.locator('button[title="View options"]').click(); await sleep(400);
await win.getByRole('button', { name: 'Dimensions', exact: true }).click(); await sleep(400);
await win.locator('button[title="View options"]').click(); await sleep(1200);
await T.shot(); T.hold(900);
await A.clickLoc(win.locator('button[title="View options"]'));
await A.clickLoc(win.getByRole('button', { name: 'Dimensions', exact: true }), { wait: 1200 });
T.hold(900);
await A.clickLoc(win.locator('button[title="View options"]'));
T.hold(400);
// orbit
let p = { x: 1180, y: 300 };
T.glide(p, 650); T.hold(120, true);
await win.mouse.move(p.x, p.y); await win.mouse.down();
for (let i = 0; i < 12; i++) {
  const q = { x: p.x + (i < 6 ? -22 : 22), y: p.y + (i < 6 ? 4 : -4) };
  T.glide(q, 110, true); await win.mouse.move(q.x, q.y, { steps: 2 }); p = q;
  await sleep(700); await T.shot(); T.hold(40, true);
}
await win.mouse.up(); T.hold(700);
// param changes: brackets follow the geometry
const ranges = await win.locator('input[type=range]').evaluateAll(els => els.map(e => { const b = e.getBoundingClientRect(); return { min: +e.min, max: +e.max, x: b.x, y: b.y + b.height / 2, w: b.width }; }));
const px = (r, v) => ({ x: Math.round(r.x + 7 + (v - r.min) / (r.max - r.min) * (r.w - 14)), y: Math.round(r.y) });
async function drag(r, from, vals) {
  const s = px(r, from); T.glide(s, 650); T.hold(120, true);
  await win.mouse.move(s.x, s.y); await win.mouse.down();
  for (const v of vals) { const q = px(r, v); T.glide(q, 90, true); await win.mouse.move(q.x, q.y); await T.settle(); await T.shot(); T.hold(220, true); }
  await win.mouse.up(); T.hold(900);
}
await drag(ranges[0], 40, [44, 48, 52, 56, 60, 64]);
await drag(ranges[1], 60, [56, 52, 48, 44, 40]);
T.glide({ x: 1150, y: 200 }, 700); T.hold(1500);
T.save();
await app.close();
