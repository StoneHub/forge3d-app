import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { getThemeColors } from '../src/forge3d/theme.js';

// Exercise the production component's hooks with controlled frames and terminal
// disposables. The opt-in Electron companion covers real xterm/DOM behavior.
const source = fs.readFileSync(new URL('../src/forge3d/terminal.jsx', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export default TerminalPane;', 'globalThis.TerminalPane = TerminalPane;');
const compiled = transformSync(source, { loader: 'jsx', jsx: 'transform' }).code;

function createHarness() {
  const refs = [];
  const effects = [];
  const frames = new Map();
  const timers = new Map();
  const terminals = [];
  const observers = [];
  const listeners = new Set();
  const calls = { writes: [], resizes: [], subscriptions: 0, unsubscriptions: 0 };
  const container = { offsetParent: {}, clientWidth: 760, clientHeight: 340, handlers: new Map(),
    addEventListener(name, handler) { this.handlers.set(name, handler); },
    removeEventListener(name, handler) { assert.equal(this.handlers.get(name), handler); this.handlers.delete(name); } };
  const windowHandlers = new Map();
  const documentHandlers = new Map();
  const document = { visibilityState: 'visible',
    addEventListener: (name, handler) => documentHandlers.set(name, handler),
    removeEventListener: (name, handler) => { assert.equal(documentHandlers.get(name), handler); documentHandlers.delete(name); } };
  const api = {
    writeTerminal: (text) => calls.writes.push(text),
    resizeTerminal: (...size) => calls.resizes.push(size),
    onTerminalData(listener) {
      listeners.add(listener); calls.subscriptions++;
      return () => { assert.ok(listeners.delete(listener)); calls.unsubscriptions++; };
    },
  };
  let refIndex = 0;
  let effectIndex = 0;
  let nextFrame = 0;
  let pending = [];
  class Terminal {
    constructor(options) {
      this.options = options; this.cols = 80; this.rows = 24; this.history = ''; this.opens = 0; this.focuses = 0;
      terminals.push(this);
    }
    loadAddon(addon) { this.addon = addon; addon.terminal = this; }
    open(target) { assert.equal(target, container); assert.equal(this.disposed, undefined); this.opens++; }
    onData(listener) { this.input = listener; return { dispose: () => { this.input = null; this.inputDisposed = true; } }; }
    attachCustomKeyEventHandler(handler) { this.keys = handler; }
    write(text) { assert.equal(this.disposed, undefined); this.history += text; }
    writeln(text) { this.write(`${text}\n`); }
    reset() { this.history = ''; this.resets = (this.resets || 0) + 1; }
    clear() { this.history = ''; }
    getSelection() { return ''; }
    focus() { assert.equal(this.disposed, undefined); this.focuses++; }
    dispose() { assert.equal(this.disposed, undefined); this.disposed = true; }
  }
  const context = vm.createContext({
    React: { createElement(_tag, props) { props.ref.current = container; return null; } },
    forwardRef: (component) => component,
    useRef(initial) { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useEffect(setup, deps) {
      const index = effectIndex++;
      const previous = effects[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) pending.push({ index, setup, deps });
    },
    useImperativeHandle(ref, create) { ref.current = create(); },
    requireForgeAPI: () => api,
    Terminal,
    FitAddon: class { fit() { assert.equal(this.terminal.opens, 1); this.terminal.cols = 90; this.terminal.rows = 20; } },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target) { assert.equal(target, container); }
      disconnect() { this.disconnected = true; }
    },
    window: { addEventListener: (name, handler) => windowHandlers.set(name, handler),
      removeEventListener: (name, handler) => { assert.equal(windowHandlers.get(name), handler); windowHandlers.delete(name); } },
    document,
    navigator: {},
    requestAnimationFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback) => { timers.set(++nextFrame, callback); return nextFrame; },
    clearTimeout: (id) => timers.delete(id),
    Promise,
  });
  vm.runInContext(compiled, context);
  const ref = {};
  function render(changes = {}) {
    harness.props = { ...harness.props, ...changes };
    refIndex = effectIndex = 0; pending = [];
    context.TerminalPane(harness.props, ref);
    for (const { index, setup, deps } of pending) {
      effects[index]?.cleanup?.();
      effects[index] = { setup, deps, cleanup: setup() };
    }
  }
  const harness = {
    props: { active: false, colors: getThemeColors(), sessionState: { status: 'running', pid: 123 } },
    render, terminals, calls, container, document, windowHandlers, documentHandlers, observers, frames, timers, listeners, ref,
    flush() { const current = [...frames.values()]; frames.clear(); current.forEach((callback) => callback()); },
    strictReplay() { effects.forEach((effect) => effect.cleanup?.()); effects.forEach((effect) => { effect.cleanup = effect.setup(); }); },
    emit(text) { listeners.forEach((listener) => listener(text)); },
    unmount() { effects.forEach((effect) => effect.cleanup?.()); },
  };
  return harness;
}

test('StrictMode cancels opening before disposal; hidden startup waits for a measurable active pane', () => {
  const h = createHarness();
  h.document.visibilityState = 'hidden';
  h.render({ active: true });
  h.strictReplay();
  assert.equal(h.terminals[0].disposed, true);
  assert.equal(h.terminals[0].opens, 0);
  h.flush();
  assert.equal(h.terminals[1].opens, 0);
  h.document.visibilityState = 'visible';
  h.container.clientHeight = 0;
  h.documentHandlers.get('visibilitychange')(); h.flush();
  assert.equal(h.terminals[1].opens, 0);
  h.container.clientHeight = 340;
  h.observers.at(-1).callback(); h.flush();
  assert.equal(h.terminals[1].opens, 1);
  assert.equal(h.terminals[1].focuses, 1);
  h.unmount();
});

test('cosmetic rerenders, themes and inactive panels retain buffer and one live terminal subscription', () => {
  const h = createHarness();
  h.render(); h.flush();
  const terminal = h.terminals[0];
  h.emit('background output\n');
  h.render({ active: true }); h.flush();
  const initialResizes = h.calls.resizes.length;
  for (let i = 0; i < 12; i++) {
    h.render({ colors: getThemeColors(i % 2 ? 'dark' : 'light'), focusToken: i + 1 }); h.flush();
  }
  assert.equal(h.terminals.length, 1);
  assert.equal(h.calls.subscriptions, 1);
  assert.equal(terminal.history, 'background output\n');
  assert.equal(terminal.options.theme.background, getThemeColors().bgPanel);
  h.render({ active: false });
  h.container.offsetParent = null;
  h.windowHandlers.get('resize')(); h.flush();
  const inactiveResizes = h.calls.resizes.length;
  h.emit('still running\n');
  h.render({ active: true });
  h.container.offsetParent = {}; h.flush();
  assert.ok(h.calls.resizes.length > inactiveResizes && inactiveResizes > initialResizes);
  assert.equal(terminal.history, 'background output\nstill running\n');
  terminal.input('typed text');
  assert.deepEqual(h.calls.writes, ['typed text']);
  h.render({ resetToken: 1 });
  assert.equal(terminal.history, '');
  h.unmount();
  assert.equal(terminal.inputDisposed, true);
  assert.equal(h.calls.unsubscriptions, 1);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.container.handlers.size, 0);
  assert.equal(h.windowHandlers.size, 0);
  assert.equal(h.documentHandlers.size, 0);
  assert.ok(h.observers.every((observer) => observer.disconnected));
  assert.doesNotThrow(() => h.ref.current.focus());
});

test('unmount before a scheduled open cancels it; a fresh mount creates exactly one new terminal', () => {
  const h = createHarness();
  h.render({ active: true });
  h.unmount(); h.flush();
  assert.equal(h.terminals[0].opens, 0);
  assert.equal(h.terminals[0].disposed, true);
  const next = createHarness();
  next.render({ active: true }); next.flush();
  assert.equal(next.terminals.length, 1);
  assert.equal(next.terminals[0].opens, 1);
  next.unmount();
});

test('activating an idle terminal requests one session; cosmetic changes reuse a running session', async () => {
  const h = createHarness();
  let sessions = 0;
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  h.render({ sessionState: { status: 'idle' }, onEnsureSession: () => { sessions++; return pending; } });
  assert.equal(sessions, 0);
  h.render({ active: true }); h.flush();
  for (let i = 0; i < 5; i++) h.render({ colors: getThemeColors(), onEnsureSession: () => { sessions++; return pending; } });
  assert.equal(sessions, 1);
  finish(); await pending;
  h.render({ sessionState: { status: 'running', pid: 123 } });
  h.render({ active: false });
  h.render({ active: true }); h.flush();
  assert.equal(sessions, 1);
  assert.equal(h.calls.subscriptions, 1);
  h.unmount();
});
