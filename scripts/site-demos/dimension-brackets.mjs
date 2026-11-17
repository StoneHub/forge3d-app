// Dimension brackets demo: turn brackets on, orbit, then resize the part.
import { sleep, framesDir } from './lib.mjs';
import { timeline, actions, sliderTracks, sliderPoint } from './stop.mjs';
import { bracket } from './bracket-setup.mjs';

const { app, win } = await bracket();
const T = timeline(win, framesDir('dimension-brackets'));
const A = actions(win, T);
const viewOptions = win.locator('button[title="View options"]');
const dimensions = win.getByRole('button', { name: 'Dimensions', exact: true });

// Start with brackets off so turning them on is the reveal.
await viewOptions.click(); await sleep(400);
await dimensions.click(); await sleep(400);
await viewOptions.click(); await sleep(1200);
await T.shot();
T.hold(900);
await A.clickLoc(viewOptions);
await A.clickLoc(dimensions, { wait: 1200 });
T.hold(900);
await A.clickLoc(viewOptions);
T.hold(400);

// Orbit left and back; the brackets re-anchor to the visible faces.
let p = { x: 1180, y: 300 };
T.glide(p, 650);
T.hold(120, true);
await win.mouse.move(p.x, p.y);
await win.mouse.down();
for (let i = 0; i < 12; i++) {
  const q = { x: p.x + (i < 6 ? -22 : 22), y: p.y + (i < 6 ? 4 : -4) };
  T.glide(q, 110, true);
  await win.mouse.move(q.x, q.y, { steps: 2 });
  p = q;
  await sleep(700);
  await T.shot();
  T.hold(40, true);
}
await win.mouse.up();
T.hold(700);

// Resize the part; the bracket values follow the rebuilt geometry.
const [width, leg] = await sliderTracks(win);
async function setValue(track, value) {
  const q = sliderPoint(track, value);
  T.glide(q, 550);
  T.hold(80, true);
  await win.mouse.click(q.x, q.y);
  await T.shot();
  T.hold(400);
  await T.settle();
  await T.shot();
  T.hold(1000);
}
await setValue(width, 56);
await setValue(leg, 44);
T.glide({ x: 1150, y: 200 }, 700);
T.hold(1500);
T.save();
await app.close();
