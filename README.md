# Forge3D — Parametric 3D Modeling IDE

A modern parametric 3D modeling environment inspired by OpenSCAD.
Write code, see instant 3D previews, and iterate quickly in the browser or an Electron shell.

![Forge3D](https://img.shields.io/badge/version-2.1-blue)

## What this repo contains

- **Web app** powered by Vite + React
- **Optional Electron shell** for desktop packaging
- **Single-package npm workflow** with a checked-in lockfile for reproducible installs

## Runtime expectations

This repo is currently aligned to the toolchain used on the host:

- **Node.js:** `22.21.0` (`.nvmrc` and `.node-version` included)
- **npm:** `10.x`
- **Package manager:** npm (`package-lock.json` is the source of truth)

If you use `nvm`:

```bash
nvm use
```

## Quick start

### Option 1: Web app (local browser)

```bash
cd forge3d-app
npm install
npm run dev
```

Open `http://localhost:5173`.

### Option 2: Hosted Linux / remote dev box

For development on a shared or hosted Linux ARM machine, bind Vite to all interfaces:

```bash
cd forge3d-app
npm install
npm run dev:host
```

Then open:

```text
http://HOSTNAME_OR_IP:5173
```

Notes:
- `dev:host` uses `--strictPort` so other agents/scripts do not silently hop to a different port.
- Prefer one shared install per branch/worktree; avoid multiple concurrent `npm install` runs in the same checkout.
- Keep Node aligned with `.nvmrc` / `.node-version` to reduce "works on one box only" drift.

### Option 3: Preview a production build on a host

```bash
npm run build
npm run preview:host
```

Default preview URL:

```text
http://HOSTNAME_OR_IP:4173
```

### Option 4: Electron desktop app

```bash
npm install
npm run electron:dev
```

To build a distributable:

```bash
npm run electron:build
```

Output goes to `./release`.

## Repo hygiene / multi-agent notes

These conventions help when several agents or humans are touching the repo on a remote host:

- **Use npm only** in this repo unless/until lockfile strategy changes.
- **Commit `package-lock.json` updates** alongside dependency changes.
- **Do not store secrets in `.env`** unless the app actually needs them; `.env.example` is the placeholder contract for future config.
- **Use `npm run check`** as the lightweight validation step before handing work off.
- **Prefer non-destructive edits** and avoid changing default ports unless coordinated.

Recommended handoff flow:

```bash
git status
npm run check
```

## Available scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local Vite development |
| `npm run dev:host` | Hosted/remote Vite dev server on `0.0.0.0:5173` |
| `npm run build` | Production web build |
| `npm run check` | Lightweight validation (`build`) |
| `npm run preview` | Local preview of production build |
| `npm run preview:host` | Hosted preview server on `0.0.0.0:4173` |
| `npm run electron:dev` | Electron dev mode with Vite |
| `npm run electron:build` | Build Electron distributable |

## Self-hosting

To build a static site you can host anywhere:

```bash
npm run build
```

Deploy `./dist` to any static host (Netlify, Vercel, GitHub Pages, nginx, Caddy, etc.).

## Supported OpenSCAD syntax

### Primitives
- `cube([x,y,z], center=true)`
- `sphere(r=5, $fn=32)`
- `cylinder(h=10, r=5, $fn=32)` — also supports `r1`, `r2`, `d`, `d1`, `d2`

### Transforms
- `translate([x,y,z])` `rotate([x,y,z])` `scale([x,y,z])`
- `color("#hex")` or `color([r,g,b])` (0-1 range)
- `mirror([x,y,z])`

### Boolean operations
- `union() { ... }` `difference() { ... }` `intersection() { ... }`
- `hull() { ... }` `minkowski() { ... }`

### Control flow
- `for (i = [0:10])` — ranges with optional step: `[start:step:end]`
- `if (condition) { ... } else { ... }`
- `let (x=5, y=10)` — scoped variable binding

### Math functions
`sin` `cos` `tan` `asin` `acos` `atan` `atan2` `sqrt` `abs` `pow`
`floor` `ceil` `round` `min` `max` `len` `norm` `log` `exp` `sign`

### Variables & expressions
- Assignment: `my_var = 42;`
- Arrays: `[1, 2, 3]`
- Ranges: `[0:10]` or `[0:0.5:10]`
- Array indexing: `my_array[2]`
- Ternary: `x > 5 ? "big" : "small"`
- All standard operators: `+ - * / % < > <= >= == != && || !`

### Utilities
- `echo("message", variable)` — prints to console
- `$fn` — fragment count for curved surfaces

## Project structure

```text
forge3d-app/
├── .env.example         # Future runtime config contract
├── .node-version        # asdf/nodenv-compatible Node pin
├── .nvmrc               # nvm-compatible Node pin
├── index.html           # Entry point
├── package.json         # Dependencies & scripts
├── vite.config.js       # Build config
├── electron/
│   └── main.mjs         # Electron wrapper (optional desktop)
├── src/
│   ├── main.jsx         # React mount
│   └── Forge3D.jsx      # Main IDE implementation
└── public/
    └── (put icon.png here for desktop builds)
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Tab | Insert 2 spaces |
| Ctrl/Cmd + S | Save current `.scad` file |
| Ctrl/Cmd + O | Open a local `.scad` file |
| Ctrl/Cmd + N | Reset to a fresh workspace |
| Shift + Enter / F5 | Manual build |
| Scroll | Zoom viewport |
| Left-drag | Orbit camera |

## Known host caveats

- Electron packaging on Linux ARM can require extra host libraries depending on distro and target format.
- The web build currently emits a large JS chunk warning during `vite build`; this is not a build failure, but it is a future optimization target.

## Roadmap ideas

- [x] File save/load (.scad files)
- [x] Local workspace persistence between refreshes
- [ ] STL export for 3D printing
- [ ] Custom module support
- [ ] True CSG boolean operations
- [ ] Undo/redo in editor
- [ ] Dark/light theme toggle
- [ ] Import external .scad libraries

## License

MIT — use it however you want.
