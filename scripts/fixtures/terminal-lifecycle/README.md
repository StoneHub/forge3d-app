# Terminal lifecycle regression

`npm run test:node` runs the controlled production-component hook tests.

To exercise the real React component, xterm and fit addon in Electron on a graphical desktop:

```sh
FORGE3D_RUN_ELECTRON_TESTS=1 node --test scripts/terminal-lifecycle-electron.test.mjs
```

The fixture uses a fresh temporary Electron profile and its own Vite server on port 5175. It keeps Electron's sandbox defaults unchanged. It checks hidden/inactive startup under StrictMode, repeated cosmetic renders and theme changes, scrollback retention, focus, sizing, hide/show, explicit reset, remount, keyboard input and balanced bridge subscriptions after teardown.

The fixture supplies a controlled terminal bridge; it does not launch a real shell or replace testing the full app with a functioning native `node-pty` build. It also does not establish rapid reset-to-unmount safety for every pending callback inside xterm 5.3.
