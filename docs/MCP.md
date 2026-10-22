# Forge3D MCP: local modeling tools

Forge3D includes a local [Model Context Protocol (MCP)](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) stdio server. An MCP-compatible client can inspect a model, edit OpenSCAD source or parameters, run native OpenSCAD, export STL, and receive an actual viewport image.

![Reinforced mounting bracket created, resized, rendered, exported, and captured through the Forge3D MCP tools](screenshots/forge3d-mcp-bracket.png)

The live demo creates a reinforced mounting bracket, changes its width from 64 to 72 mm, and exports a 1,076-triangle native STL. The screenshot above is the viewport image returned by the MCP tool, not a mockup. The demo also exercises stale-edit rejection, atomic parameter validation, quick/final export guards, and recovery after an intentional OpenSCAD parser error.

**Each connection starts a new, visible, isolated Forge3D window. It does not attach to an already-open Forge3D window or read that window's unsaved model.** The MCP window has a fresh temporary user-data directory. Normal settings, recent files, and workspace state are not reused. You can inspect the changes in the MCP window while the client works.

## Trust boundary

**This is a trusted local-code integration, not a filesystem sandbox.** OpenSCAD `include`, `use`, `import`, and `surface` can read files with the application's OS permissions. A fresh app profile does not restrict that access. Connect only clients you trust, review proposed source and tool calls, and do not render untrusted source. If you need stronger isolation, run the entire application under a separate, restricted OS account or an appropriate sandbox.

The server opens no HTTP/TCP listener, creates no API keys, and edits no global MCP configuration. Its only control channel is private, inherited Node IPC from the stdio launcher to its own Electron child. The ordinary desktop app does not expose MCP controls. These tools do not provide arbitrary shell execution, source-file saving, or arbitrary export paths. Forge3D itself does not call an AI provider through this integration; your MCP client controls its own model/provider use.

## Prerequisites and launch

This first implementation supports a **source checkout** with:

- Node.js 22 or later and npm 10 or later.
- Project dependencies installed, including Electron.
- A built renderer in `dist/`.
- Native OpenSCAD installed and discoverable by Forge3D for rendering.
- A working graphical desktop. The MCP session is a real Electron window, not a headless mesh service.

From the repository root:

```sh
npm install
npm run build
node electron/mcp-server.mjs
```

The launcher waits for MCP JSON on stdin. No terminal prompt or startup text is written to stdout. Electron and OpenSCAD diagnostics go to stderr.

The convenient npm equivalent is `npm run --silent mcp`. When configuring a client, prefer invoking `node` directly: plain `npm run mcp` may add npm banners to stdout and break stdio framing.

An optional executable override is available:

```sh
node electron/mcp-server.mjs --electron /absolute/path/to/electron
```

This selects an Electron executable to run this checkout, not an arbitrary packaged Forge3D executable. The launcher never invokes a shell or automatically adds `--no-sandbox`. Run under a normal desktop user with the normal Electron sandbox enabled. Packaged-app registration and attaching to existing desktop sessions are not included in this version.

## Connect an MCP client

Add an entry using your client's documented MCP configuration format. For clients using an `mcpServers` object, the entry is:

```json
{
  "mcpServers": {
    "forge3d": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/forge3d/electron/mcp-server.mjs"]
    }
  }
}
```

Use absolute paths appropriate to your machine; Windows JSON paths require doubled backslashes. There is no need to start Vite or run `npm run dev`: the MCP session loads the built `dist/` renderer. Rebuild after renderer changes, then reconnect the client. This documentation does not install or modify any client configuration automatically.

## Available tools

| Tool | Arguments | Result / behavior |
| --- | --- | --- |
| `forge3d_get_model` | `{}` | Source code, filename/path, revision, dirty state, mode, editable parameters, render status, and diagnostics. |
| `forge3d_set_code` | `code`, `expectedRevision` | Replaces the active unsaved Design buffer. Requires the latest revision. No source file is saved or overwritten. |
| `forge3d_set_parameters` | `values: [{id, value}]`, `expectedRevision` | Changes supported literal parameters in the unsaved buffer. Validates the entire edit before applying it. |
| `forge3d_render` | Optional `profile`: `"quick"` or `"final"` | Runs native OpenSCAD against the active Design source and returns model/render state. Defaults to `"final"`. |
| `forge3d_export_stl` | Optional `filename`, e.g. `"bracket.stl"` | Requires a successful **final** render that still matches the current model. Returns the exported local path and mesh information. |
| `forge3d_capture_viewport` | `{}` | Requires a current rendered Design model. Returns PNG image content, not a fabricated preview or a full-desktop screenshot. |

Ordinary model results contain JSON encoded in an MCP text content item. The viewport result uses `{"type":"image","mimeType":"image/png","data":"...base64..."}`. Clients should display or save that image content using their normal MCP support.

Only model inspection and viewport capture advertise `readOnlyHint: true`. Other tools carry conservative mutation/destruction annotations; these hints are not substitutes for client permissions or review.

### Revisions and parameters

Always get the current model before editing. Pass the returned `revision` as `expectedRevision`; if the model changes in the UI or through another call, an old revision fails instead of overwriting newer work. Read again and reassess the edit. Do not blindly retry stale edits. Reading the model is allowed while a render is running, but editing is not.

The parameter list contains safely editable, top-level number, string, and boolean literal assignments, with annotation metadata where present. Derived expressions, vectors, nested variables, and commented-out assignments are not presented as editable parameters. Use the exact returned parameter `id`; IDs include source line identity and can change when source lines move. Numeric ranges and enum options are checked, and string values are encoded as literals rather than interpolated as code.

After a source or parameter edit, explicitly render again. A failed render, a changed model, or a non-final render cannot be exported as the current final STL. Tools that edit, render, or export operate in Design mode; they fail if the user has switched to another mode.

### Export ownership and durability

`filename` is a basename ending in `.stl`, at most 200 UTF-8 bytes. Paths, directory separators, control characters, and reserved filename characters are rejected. The app chooses a unique prefixed filename under the session's temporary `exports` directory and uses exclusive creation, so an existing file is never overwritten.

Export uses the successful native OpenSCAD STL bytes, not a reconstruction of whatever happens to be visible. Copy the returned file to your chosen durable location before relying on it: the output and isolated session profile live in the OS temporary directory and may be cleaned up by the OS. The tools do not promise permanent storage or automatically save the edited `.scad` source. The isolated app may autosave its editor state inside its temporary profile, not into the normal app's profile or the source file.

## A complete demonstration

Once connected, ask the client:

> In the isolated Forge3D session, read the current model, replace the unsaved source with a parameterized 30 × 20 × 4 mm plate with a centered 6 mm hole, render it at final quality, show me the actual viewport capture, and export a new STL named plate.stl. Do not overwrite a source file.

A correct tool sequence is:

1. `forge3d_get_model` to learn the current revision.
2. `forge3d_set_code` with that revision and trusted source such as:

   ```scad
   width = 30;
   depth = 20;
   thickness = 4;
   hole_diameter = 6;
   difference() {
     cube([width, depth, thickness], center=true);
     cylinder(h=thickness + 2, d=hole_diameter, center=true, $fn=64);
   }
   ```

3. `forge3d_render` with `{"profile":"final"}`. Check `isError` and the returned diagnostics/current-render status.
4. `forge3d_capture_viewport` and display its image content.
5. `forge3d_export_stl` with `{"filename":"plate.stl"}` and report the actual returned path.
6. To demonstrate a parameter edit, read the latest model, locate the returned `width` parameter ID, call `forge3d_set_parameters` with its current revision and a new width, then render and capture again. The previous render must not be exported after the edit.

The initial revision is session-specific; do not assume it is zero or hard-code parameter IDs in a reusable client.

## Reproducible desktop smoke test

With a built renderer, a graphical desktop, and native OpenSCAD available, run:

```sh
node scripts/mcp-demo.mjs --output /absolute/path/to/a/new-demo-directory
```

Add `--keep-open` to leave the completed model visible until Ctrl+C. Without it, the script closes the MCP connection and verifies shutdown. The default output directory is `output/mcp-demo`; **the demo script writes fixed artifact names and can overwrite prior demo artifacts there**, so choose a new output directory when preserving previous runs matters. This is separate from the MCP STL tool's non-overwriting temporary exports.

The script acts as an actual stdio MCP client. It discovers all six tools, edits and resizes a reinforced mounting bracket to 72 × 30 × 38 mm, performs native quick/final renders, rejects stale revisions and invalid/partial parameter edits, checks export/path protections, deliberately triggers a native syntax failure, and recovers to a valid final model. It saves:

- `mounting-bracket.scad`, `mounting-bracket.stl`, and the actual `mounting-bracket.png` viewport capture.
- `report.json` with checks, model bounds, and result status.
- `transcript.json` with MCP requests/responses (image data abbreviated), plus `electron.log`.
- `shutdown.json` after the session exits.

Inspect the image and mesh as well as the report. A successful protocol-only unit test is not a substitute for this native desktop run.

## Protocol and lifecycle

- Transport: newline-delimited UTF-8 JSON-RPC 2.0 over stdin/stdout. No LSP `Content-Length` framing. Embedded newlines in source are JSON-escaped.
- Supported protocol versions: `2024-11-05`, `2025-03-26`, `2025-06-18`, and `2025-11-25`. An unknown version is negotiated to `2025-11-25`; the client decides whether it supports that version.
- Lifecycle: send `initialize` with `protocolVersion`, `capabilities`, and `clientInfo`; wait for its response, then send `notifications/initialized`. `ping`, `tools/list`, and `tools/call` are supported. No resources, prompts, subscriptions, sampling, or MCP tasks are advertised.
- JSON-RPC batches are supported only for an initialized `2025-03-26` session, the revision that specified them. Initialization is never batched; later revisions use individual messages.
- Malformed JSON, invalid request shapes, unknown methods/tools, and lifecycle errors use JSON-RPC errors. Known-tool validation or execution failures use MCP tool results with `isError: true`, so the client can correct the request.
- Source input is limited to 2 MiB UTF-8; an input frame is limited to 4 MiB. A session admits at most 32 pending calls. Main processes model calls serially so edits and renders do not race each other.
- Electron must report renderer readiness within 60 seconds. Each tool call has a six-minute maximum including queued time. Native rendering and renderer requests have their own shorter bounds.
- On a call timeout the session closes, rather than allowing a late queued mutation to run after a retry. A timed-out operation may already have completed; reconnect and inspect before retrying.
- Closing client stdin ends the session. The launcher asks Electron to quit and clean up active native work, then falls back to `SIGTERM` and `SIGKILL` if it does not exit. Closing/reloading the MCP window, an IPC disconnect, or a child crash also ends the session. An existing ordinary Forge3D window is unaffected.
- This implementation does not offer per-call cancellation. Close the MCP connection to terminate the whole session. Notification messages never execute model tools.

The framing and lifecycle follow the official [transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), and [tool](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) specifications.

## Troubleshooting and verification

- **Renderer build not found:** run `npm run build` in this checkout, then reconnect.
- **Electron does not become ready:** inspect the client's captured stderr. Confirm graphical desktop access, dependencies, sandbox support, and a current renderer build. Do not work around this by disabling the sandbox.
- **OpenSCAD missing or render failure:** inspect the tool's diagnostics and configure/install the native OpenSCAD executable using the normal Forge3D workflow. Startup alone does not prove a native renderer is available.
- **Model changed:** read `forge3d_get_model` and use its current revision. Keep the human's newer edits.
- **No current final render:** render at `"final"` after the last edit, then export.
- **Viewport not drawing:** restore the visible MCP window and retry capture. A minimized/background window may suspend drawing; the tool fails rather than returning a made-up image.
- **Invalid protocol output:** configure `node` directly, not a noisy shell/npm wrapper. All stdout lines must be JSON; stderr logs are expected.

Run transport/protocol checks with:

```sh
node --check electron/mcp-protocol.mjs
node --check electron/mcp-server.mjs
node --test scripts/mcp-protocol.test.mjs scripts/mcp-bridge.test.mjs
npm run test:node
npm run build
```

The focused tests cover framing, lifecycle/version negotiation, schemas, revision argument checks, error envelopes, IPC correlation, timeouts, shutdown, and a real Node child-process IPC round trip. That process fixture is **not** an Electron/OpenSCAD end-to-end test. Before claiming native modeling works on a platform, run the demonstration in a real graphical Electron session with native OpenSCAD and inspect the captured image and exported mesh.
