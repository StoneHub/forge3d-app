import { launch, newWithCode, showParams, sleep, modelPath } from './lib.mjs';
export async function bracket() {
  const { app, win } = await launch();
  await newWithCode(app, win, modelPath('shelf_bracket.scad'));
  await showParams(win);
  await sleep(2000);
  await win.getByRole('button', { name: 'Build', exact: true }).click();
  await sleep(4000);
  await win.mouse.move(1100, 250);
  return { app, win };
}
