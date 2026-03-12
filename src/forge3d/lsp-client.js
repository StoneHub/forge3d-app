// LSP JSON-RPC client for OpenSCAD Language Server (Electron-only)
// Only activates when window.forgeAPI.lspSend is available.
// Sends textDocument/didOpen and didChange, receives publishDiagnostics.

import { useEffect, useRef, useCallback } from 'react';

let _msgId = 1;
function nextId() { return _msgId++; }

/**
 * useLSP — React hook
 * @param {string} code — current editor content
 * @param {string|null} filePath — current file path (used as document URI)
 * @param {function} onDiagnostics — called with { errors: string[], warnings: string[] }
 */
export function useLSP(code, filePath, onDiagnostics) {
  const initializedRef = useRef(false);
  const openedUriRef = useRef(null);
  const versionRef = useRef(0);
  const changeTimerRef = useRef(null);
  const removeListenerRef = useRef(null);

  // Stable reference to send — only works in Electron
  const send = useCallback((msg) => {
    try { window.forgeAPI?.lspSend?.(msg); } catch (_) {}
  }, []);

  // Map a file path / null → a stable URI for the LSP
  const getUri = useCallback((fp) => {
    if (fp) return 'file:///' + fp.replace(/\\/g, '/');
    return 'file:///untitled.scad';
  }, []);

  // Initialize LSP once and register diagnostics listener
  useEffect(() => {
    if (!window.forgeAPI?.lspSend) return; // not in Electron
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Send initialize request
    send({
      jsonrpc: '2.0',
      id: nextId(),
      method: 'initialize',
      params: {
        processId: null,
        rootUri: null,
        capabilities: {
          textDocument: {
            publishDiagnostics: { relatedInformation: false },
          },
        },
      },
    });

    // Register for LSP messages
    const removeListener = window.forgeAPI.onLspReceive((msg) => {
      try {
        // Handle initialize result
        if (msg.id && msg.result?.capabilities) {
          send({ jsonrpc: '2.0', method: 'initialized', params: {} });
        }
        // Handle diagnostics
        if (msg.method === 'textDocument/publishDiagnostics') {
          const diags = msg.params?.diagnostics ?? [];
          const errors = [];
          const warnings = [];
          for (const d of diags) {
            // severity: 1=Error, 2=Warning, 3=Info, 4=Hint
            const line = (d.range?.start?.line ?? 0) + 1; // 1-based
            const text = `[line ${line}] ${d.message}`;
            if (d.severity === 1) errors.push(text);
            else warnings.push(text);
          }
          onDiagnostics({ errors, warnings });
        }
      } catch (_) {}
    });
    removeListenerRef.current = removeListener;

    return () => {
      removeListenerRef.current?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open / reopen document when filePath changes
  useEffect(() => {
    if (!window.forgeAPI?.lspSend || !initializedRef.current) return;
    const uri = getUri(filePath);

    if (openedUriRef.current && openedUriRef.current !== uri) {
      // Close old document
      send({
        jsonrpc: '2.0',
        method: 'textDocument/didClose',
        params: { textDocument: { uri: openedUriRef.current } },
      });
    }

    versionRef.current = 1;
    openedUriRef.current = uri;

    send({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri,
          languageId: 'openscad',
          version: versionRef.current,
          text: code,
        },
      },
    });
  }, [filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send didChange on code edits (throttled 300ms)
  useEffect(() => {
    if (!window.forgeAPI?.lspSend || !initializedRef.current) return;
    if (!openedUriRef.current) return;

    clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => {
      versionRef.current += 1;
      send({
        jsonrpc: '2.0',
        method: 'textDocument/didChange',
        params: {
          textDocument: {
            uri: openedUriRef.current,
            version: versionRef.current,
          },
          contentChanges: [{ text: code }],
        },
      });
    }, 300);

    return () => clearTimeout(changeTimerRef.current);
  }, [code, send]);
}
