import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import './terminal.css';
import { requireForgeAPI } from './forge-api.js';

function getTerminalTheme(colors) {
  return {
    background: colors.bgPanel,
    foreground: colors.text,
    cursor: colors.accent,
    selectionBackground: `${colors.accent}44`,
    black: '#000000',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#d19a66',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#d19a66',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  };
}

const TerminalPane = forwardRef(function TerminalPane({ active, colors, focusToken = 0, onEnsureSession, resetToken = 0, sessionState = {} }, ref) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const scheduleLayoutRef = useRef(null);
  const activeRef = useRef(active);
  const colorsRef = useRef(colors);
  activeRef.current = active;
  colorsRef.current = colors;
  const lastErrorRef = useRef('');
  const requestingSessionRef = useRef(false);
  const forgeAPI = requireForgeAPI();

  const writeClipboardText = async (text) => {
    if (!text) return false;
    try {
      await navigator.clipboard?.writeText?.(text);
      return true;
    } catch (_) {
      try {
        await forgeAPI.writeClipboardText?.(text);
        return true;
      } catch {
        return false;
      }
    }
  };

  const copySelection = async () => {
    const selection = terminalRef.current?.getSelection?.() || '';
    if (!selection) return false;
    return writeClipboardText(selection);
  };

  const pasteText = (text) => {
    if (!text) return false;
    forgeAPI.writeTerminal(text);
    return true;
  };

  const pasteClipboard = async () => {
    try {
      const text = await forgeAPI.readClipboardText?.();
      return pasteText(text);
    } catch (_) {
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    copySelection,
    pasteClipboard,
    focus() {
      terminalRef.current?.focus();
    },
  }), [forgeAPI]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      convertEol: true,
      theme: getTerminalTheme(colorsRef.current),
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    let opened = false;
    let frameId = null;
    let focusPending = false;

    // Opening xterm schedules viewport work that must not outlive StrictMode's
    // first setup/cleanup pass. Wait for a visible, measurable terminal pane.
    const scheduleLayout = (focus = false) => {
      focusPending ||= focus;
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (!activeRef.current || document.visibilityState === 'hidden' || container.offsetParent === null
          || container.clientWidth <= 0 || container.clientHeight <= 0) return;
        if (!opened) {
          terminal.open(container);
          opened = true;
        }
        fitAddon.fit();
        forgeAPI.resizeTerminal(terminal.cols, terminal.rows);
        if (focusPending) terminal.focus();
        focusPending = false;
      });
    };

    terminalRef.current = terminal;
    scheduleLayoutRef.current = scheduleLayout;

    const inputSubscription = terminal.onData((data) => {
      forgeAPI.writeTerminal(data);
    });

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      const key = String(event.key || '').toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.shiftKey && key === 'c') {
        void copySelection();
        return false;
      }

      if (mod && event.shiftKey && key === 'v') {
        void pasteClipboard();
        return false;
      }

      if (event.ctrlKey && key === 'insert') {
        void copySelection();
        return false;
      }

      if (event.shiftKey && key === 'insert') {
        void pasteClipboard();
        return false;
      }

      return true;
    });

    const unsubscribe = forgeAPI.onTerminalData((data) => {
      terminal.write(data);
    });

    const handleResize = () => scheduleLayout();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    document.addEventListener('visibilitychange', handleResize);

    window.addEventListener('resize', handleResize);
    const handlePaste = (event) => {
      const text = event.clipboardData?.getData('text/plain') || '';
      if (!text) return;
      event.preventDefault();
      pasteText(text);
    };
    const handleCopy = (event) => {
      const selection = terminal.getSelection();
      if (!selection) return;
      event.preventDefault();
      event.clipboardData?.setData('text/plain', selection);
      void writeClipboardText(selection);
    };
    container.addEventListener('paste', handlePaste);
    container.addEventListener('copy', handleCopy);
    scheduleLayout();

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleResize);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('paste', handlePaste);
      container.removeEventListener('copy', handleCopy);
      unsubscribe();
      inputSubscription.dispose();
      scheduleLayoutRef.current = null;
      terminalRef.current = null;
      terminal.dispose();
    };
  }, [forgeAPI]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = getTerminalTheme(colors);
  }, [colors.bgPanel, colors.text, colors.accent]);

  useEffect(() => {
    if (!active || sessionState?.status !== 'idle' || requestingSessionRef.current) return;
    requestingSessionRef.current = true;
    Promise.resolve(onEnsureSession?.()).finally(() => {
      requestingSessionRef.current = false;
    });
  }, [active, onEnsureSession, sessionState?.status]);

  useEffect(() => {
    if (sessionState?.status === 'running' || sessionState?.status === 'error' || sessionState?.status === 'exited') {
      requestingSessionRef.current = false;
    }
  }, [sessionState?.status]);

  useEffect(() => {
    if (sessionState?.status !== 'error' || !sessionState.error || lastErrorRef.current === sessionState.error) return;
    lastErrorRef.current = sessionState.error;
    terminalRef.current?.writeln(`\x1b[31m${sessionState.error}\x1b[0m`);
  }, [sessionState?.error, sessionState?.status]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.reset();
    terminal.clear();
  }, [resetToken]);

  useEffect(() => {
    if (!active) return;
    scheduleLayoutRef.current?.(true);
  }, [active, focusToken, forgeAPI, sessionState?.pid]);

  return (
    <div
      ref={containerRef}
      onMouseDown={() => terminalRef.current?.focus()}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: colors.bgPanel,
      }}
    />
  );
});

export default TerminalPane;
