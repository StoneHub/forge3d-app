# Feedback capture delivery in Forge3D

Research and dogfood run: 2026-08-21

## Decision

Do not ship Dev Feedback Capture inside Forge3D as a Chrome extension.

The browser extension remains the browser product. Electron apps should use a small development package that provides a Forge3D-owned **Capture feedback** menu action, reuses the Capture Record format, and hands records to the same local MCP companion.

Keep the unpacked-extension loader only as a compatibility experiment. Electron can load the directory, but the current extension does not initialize on Electron 33.

## Observed Forge3D result

The experiment ran from isolated branch `codex/feedback-extension-dogfood`, based on clean Forge3D release-candidate commit `521ae6b`.

Command:

```sh
FORGE3D_FEEDBACK_EXTENSION=/Users/monroe/Developer/GitRepos/webDevFeedbackExt \
FORGE3D_SKIP_START_PREVIEWS=1 \
npm run dev
```

The source extension was `codex/browser-capture-core@c0a39da`.

Electron 33.4.11 loaded the unpacked directory and assigned extension ID `fnmbjammjfpnjephkchgpkeehoehiell`. The background worker then failed:

```text
Uncaught TypeError: Cannot read properties of undefined (reading 'onCommand')
Service worker registration failed. Status code: 15
```

This separates two facts:

- Electron can load the unpacked directory into Forge3D's persistent default session.
- The extension is not usable because its Chrome command and MV3 background contract does not hold in Electron 33.

Vite served Forge3D successfully at `http://localhost:5173/` over IPv6 loopback. The extension failure occurred after the host app started and before any feedback UI became available.

## Why the Chrome menu cannot control Forge3D

Chrome and Electron run separate Chromium sessions. Chrome's `chrome.action` API owns icons and popups in the Chrome toolbar. Electron has no equivalent extension toolbar or `chrome://extensions` user flow, and its documented extension support does not include `chrome.action`.

Electron only loads unpacked extension directories. It does not install Chrome Web Store packages or `.crx` files. The host app must call `loadExtension` after Electron is ready and repeat that call on every launch.

Sources:

- [Electron Chrome Extension Support](https://www.electronjs.org/docs/latest/api/extensions/)
- [Electron Extensions API](https://www.electronjs.org/docs/latest/api/extensions-api)
- [Chrome `chrome.action`](https://developer.chrome.com/docs/extensions/reference/api/action)

## Recommended package interface

The Electron integration should be a deep module with a small interface:

```js
import { installDevFeedback } from '@dev-feedback/electron/main'

installDevFeedback({
  app,
  mainWindow,
  projectRoot,
})
```

The package should own:

- the Forge3D menu item and shortcut;
- the renderer overlay and Region screenshot flow;
- local Capture Record persistence;
- export into the configured local MCP inbox; and
- the preload and IPC implementation needed by Electron.

Forge3D should know only the installation call and the explicit project/inbox configuration. Tests should cross that interface, not reach through it to Electron internals.

The browser and Electron adapters should share the Capture Record constructor and validation. They should not share Chrome-specific activation code.

## Privacy boundary

The adapter may capture only what Monroe explicitly selects or includes in a Region screenshot. Forge3D source, local paths, terminal text, build logs, and clipboard contents must not be gathered automatically.

Records stay local until an explicit export or MCP import. Implementation and verification remain separate proof gates.

## Delivery sequence

1. Build an Element-only development adapter and Forge3D menu entry.
2. Dogfood selector, visible text, note, History, and MCP import in Forge3D.
3. Add Region capture through Electron's `webContents.capturePage` behind the same package interface.
4. Package the adapter with the host app only after the development workflow is useful.

Do not add native messaging first. Chrome native messaging needs an OS-installed host manifest, per-platform registration, and a new extension permission. It helps Chrome talk to an installed app, but it does not solve feedback UI inside Electron.

Sources:

- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)

## Next gate

Forge3D PR #14 is still a draft. This experiment is disposable and pinned to its clean tip. Durable adapter work should start from updated `main` after that release candidate merges.

The next implementation decision is whether the Electron adapter belongs in the Dev Feedback Capture repository as a package, or starts as a Forge3D-local module and moves only after a second Electron host exists. The recommended answer is the package now because the browser adapter is already the second implementation at the shared Capture Record seam.
