# Vendored Electron Inspector

`dev-feedback-electron-0.2.1.tgz` preserves Forge3D's existing private
`@dev-feedback/electron` 0.2.0 package and backports the window-close lifecycle
repair from StoneHub/webDevFeedbackExt commit
`5a0e413117c5bfc8b43fdb72dc1227a6a7701840`.

Only `register.cjs`, the package version and the package changelog differ from
the previous archive. The renderer, preload, main adapter and capture-record
bundle are unchanged. This avoids adding unrelated inspector UI or dependency
changes to the close-crash repair.

The private vendored package remains a development dependency; this is not an
npm registry publication or a migration to the separately named public package.

Run `node --test scripts/feedback-inspector-lifecycle.test.mjs` to extract the
declared archive and verify listener cleanup against Electron's destroyed-window
getter behavior. Real Mac Electron app closure was also verified with the same
registration source, without an exception suppression handler.
