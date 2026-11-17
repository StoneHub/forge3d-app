// Live build demo: set slider values on a twisted vessel and let Auto Render rebuild.
// Each step releases the slider, so every rebuild in the clip follows a real stop.
import { launch, newWithCode, showParams, sleep, modelPath, framesDir } from './lib.mjs';
import { timeline, sliderTracks, sliderPoint } from './stop.mjs';

const { app, win } = await launch();
await newWithCode(app, win, modelPath('twisted_vessel.scad'));
await showParams(win);
await win.getByRole('button', { name: 'Build', exact: true }).click();
await sleep(4000);

const T = timeline(win, framesDir('live-build'));
const [height, lobes, twist, flare] = await sliderTracks(win);
await win.mouse.move(1100, 600);
await T.shot();
T.hold(900);

async function setValue(track, value) {
  const p = sliderPoint(track, value);
  T.glide(p, 550);
  T.hold(80, true);
  await win.mouse.click(p.x, p.y);
  await T.shot();           // slider and code updated; rebuild waits for the 400 ms pause
  T.hold(450);
  await T.settle();
  await T.shot();           // rebuilt model
  T.hold(1000);
}

await setValue(twist, 180);
await setValue(lobes, 8);
await setValue(flare, 1.6);
await setValue(lobes, 4);
await setValue(flare, 0.8);
await setValue(height, 86);
await setValue(twist, 45);
T.glide({ x: 1100, y: 520 }, 700);
T.hold(1200);
T.save();
await app.close();
