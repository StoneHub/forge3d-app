import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TerminalPane from '../../../src/forge3d/terminal.jsx';
import { getThemeColors } from '../../../src/forge3d/theme.js';

const listeners = new Set();
const calls = { subscriptions: 0, unsubscriptions: 0, sessions: 0, writes: [], resizes: [] };
window.forgeAPI = {
  writeTerminal: (text) => { calls.writes.push(text); },
  resizeTerminal: (cols, rows) => { calls.resizes.push([cols, rows]); },
  onTerminalData: (listener) => {
    calls.subscriptions++;
    listeners.add(listener);
    return () => { calls.unsubscriptions++; listeners.delete(listener); };
  },
};
window.terminalLifecycle = {
  calls,
  errors: [],
  sendData: (text) => { for (const listener of listeners) listener(text); },
};
window.addEventListener('error', (event) => {
  window.terminalLifecycle.errors.push(event.error?.stack || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  window.terminalLifecycle.errors.push(event.reason?.stack || String(event.reason));
});

function Harness({ initialActive = false }) {
  const [state, setState] = useState({ active: initialActive, theme: 'dark', focusToken: 0, resetToken: 0, revision: 0, width: 760, height: 340 });
  window.terminalLifecycle.update = (changes = {}) => setState((current) => ({ ...current, ...changes, revision: current.revision + 1 }));
  return <div style={{ width: state.width, height: state.height, display: state.active ? 'block' : 'none' }}>
    <TerminalPane active={state.active} colors={getThemeColors(state.theme)} focusToken={state.focusToken}
      resetToken={state.resetToken} onEnsureSession={() => { calls.sessions++; return Promise.resolve(); }}
      sessionState={{ status: 'running', pid: 123 }} />
  </div>;
}
let root;
window.terminalLifecycle.mount = (initialActive = false) => {
  root = createRoot(document.getElementById('root'));
  root.render(<React.StrictMode><Harness initialActive={initialActive} /></React.StrictMode>);
};
window.terminalLifecycle.unmount = () => root.unmount();
window.terminalLifecycle.mount();
