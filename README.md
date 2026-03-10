# Forge3D — Parametric 3D Modeling IDE

A modern, browser-based parametric 3D modeling environment inspired by OpenSCAD.
Write code, see instant 3D previews with live parameter sliders.

![Forge3D](https://img.shields.io/badge/version-2.1-blue)

## Quick Start

### Option 1: Web App (any PC with a browser)

```bash
# Clone or copy this project folder
cd forge3d-app

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` in any browser. That's it.

To build a static site you can host anywhere:

```bash
npm run build
# Output in ./dist — deploy to any static host (Netlify, Vercel, GitHub Pages, etc.)
```

### Option 2: Desktop App (Electron — Windows, Mac, Linux)

```bash
npm install

# Run in dev mode (hot-reload)
npm run electron:dev

# Build distributable installer
npm run electron:build
# Output in ./release — .exe (Windows), .dmg (Mac), .AppImage (Linux)
```

### Option 3: Self-host on your network

```bash
npm run build
npx serve dist -l 3000
# Anyone on your network can access it at http://YOUR_IP:3000
```

## Supported OpenSCAD Syntax

### Primitives
- `cube([x,y,z], center=true)`
- `sphere(r=5, $fn=32)`
- `cylinder(h=10, r=5, $fn=32)` — also supports `r1`, `r2`, `d`, `d1`, `d2`

### Transforms
- `translate([x,y,z])` `rotate([x,y,z])` `scale([x,y,z])`
- `color("#hex")` or `color([r,g,b])` (0-1 range)
- `mirror([x,y,z])`

### Boolean Operations
- `union() { ... }` `difference() { ... }` `intersection() { ... }`
- `hull() { ... }` `minkowski() { ... }`

### Control Flow
- `for (i = [0:10])` — ranges with optional step: `[start:step:end]`
- `if (condition) { ... } else { ... }`
- `let (x=5, y=10)` — scoped variable binding

### Math Functions
`sin` `cos` `tan` `asin` `acos` `atan` `atan2` `sqrt` `abs` `pow`
`floor` `ceil` `round` `min` `max` `len` `norm` `log` `exp` `sign`

### Variables & Expressions
- Assignment: `my_var = 42;`
- Arrays: `[1, 2, 3]`
- Ranges: `[0:10]` or `[0:0.5:10]`
- Array indexing: `my_array[2]`
- Ternary: `x > 5 ? "big" : "small"`
- All standard operators: `+ - * / % < > <= >= == != && || !`

### Utilities
- `echo("message", variable)` — prints to console
- `$fn` — fragment count for curved surfaces

## Project Structure

```
forge3d-app/
├── index.html           # Entry point
├── package.json         # Dependencies & scripts
├── vite.config.js       # Build config
├── electron/
│   └── main.mjs         # Electron wrapper (optional desktop)
├── src/
│   ├── main.jsx         # React mount
│   └── Forge3D.jsx      # The entire IDE (single-file)
└── public/
    └── (put icon.png here for desktop builds)
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Insert 2 spaces |
| Ctrl+Click Build | Manual build |
| Scroll | Zoom viewport |
| Left-drag | Orbit camera |

## Roadmap Ideas

- [ ] File save/load (.scad files)
- [ ] STL export for 3D printing
- [ ] Custom module support
- [ ] True CSG boolean operations
- [ ] Undo/redo in editor
- [ ] Dark/light theme toggle
- [ ] Import external .scad libraries

## License

MIT — use it however you want.
