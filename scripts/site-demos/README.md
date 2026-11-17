# Site feature demos

Records the looping MP4 demos used in the Features section of forge3d.space (`site/assets/demos/`). Each script drives the real Electron app with Playwright, takes a screenshot after every settled step (stop-motion), and `compose.py` turns those frames into a video with an eased cursor drawn on top. Recording step by step keeps the result smooth on machines with slow software WebGL, such as a headless Linux box, so playback is faster than real time.

Needs: Node 22 with `npm ci` done, Playwright installed globally (or on `NODE_PATH`), OpenSCAD on `PATH`, Python 3 with Pillow, and ffmpeg. On Linux, run under Xvfb with a 1440x900 screen.

```bash
npx vite --port 5173 &                     # the app loads its renderer from the dev server
Xvfb :99 -screen 0 1440x900x24 & export DISPLAY=:99   # Linux only

node scripts/site-demos/live-build.mjs
node scripts/site-demos/dimension-brackets.mjs
node scripts/site-demos/measure-tool.mjs

F=${DEMO_FRAMES_DIR:-$(node -p "require('os').tmpdir()")/forge3d-site-demos}
for d in live-build dimension-brackets measure-tool; do
  python3 scripts/site-demos/compose.py "$F/$d" site/assets/demos/$d.mp4
  ffmpeg -v error -y -i site/assets/demos/$d.mp4 -frames:v 1 -c:v libwebp -quality 80 site/assets/demos/$d.webp
done
```

The demo models live in `models/`. Each script loads its model with New and a paste, so the file has no path on disk; editing an opened file currently shows a "Disk changed" banner on every parameter change.
