# Native editor lifecycle regression

Run on a graphical desktop with `FORGE3D_RUN_ELECTRON_TESTS=1 node --test scripts/editor-lifecycle-electron.test.mjs`.

This fixture mounts the production CodeEditor, real Monaco React wrapper and real Monaco under React StrictMode. It checks cold startup, three Diff/normal transitions, themes, whole-component unmount, normal editing and remount. It observes model disposal calls and the app's mouse subscriptions, verifies no owned models leak, and retains an unrelated shared model. Electron uses an isolated disposable profile and default sandbox settings; no native shell or project data is involved.

Settled Diff teardown must produce zero errors. A final controlled close during model creation verifies teardown before the wrapper's later onMount callback, and checks the target disposal error is absent with balanced creation subscriptions. That early probe records (and permits only) Monaco's separately reproduced `no diff result available` in-flight worker cancellation error; the production code does not suppress it.
