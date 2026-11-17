# forge3d.space site

Static landing page served by Firebase Hosting site `forge3d-space` (project `possible-haven-471616-f0`, target `forge3d-site` in `.firebaserc`). Security headers, including a strict CSP with no inline scripts or styles, are set in the root `firebase.json`.

Deploy (needs a Firebase login with access to the project):

```bash
npm run deploy:site
```

Screenshots are WebP copies of `docs/screenshots/`. If you add a third-party script, font or image host, add it to the CSP in `firebase.json` first.

## Feature demos

The Live build, Dimension brackets and Measure tool cards link to looping MP4s in `assets/demos/`. `demos.js` opens them in a dialog (the links still work without JavaScript). To re-record them after UI changes, see `scripts/site-demos/README.md`.
