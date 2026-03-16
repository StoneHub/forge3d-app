export const DEFAULT_HISTORY_LIMIT = 100;

export function createHistoryState(initialPresent) {
  return {
    past: [],
    present: initialPresent,
    future: [],
  };
}

export function pushHistoryState(current, nextPresent, { limit = DEFAULT_HISTORY_LIMIT } = {}) {
  if (!current || typeof nextPresent === 'undefined' || Object.is(nextPresent, current.present)) {
    return current;
  }

  return {
    past: [...current.past, current.present].slice(-limit),
    present: nextPresent,
    future: [],
  };
}

export function replaceHistoryState(nextPresent) {
  return createHistoryState(nextPresent);
}

export function updateHistoryPresent(current, updater) {
  const nextPresent = typeof updater === 'function' ? updater(current.present) : updater;
  if (!current || typeof nextPresent === 'undefined' || Object.is(nextPresent, current.present)) {
    return current;
  }

  return {
    ...current,
    present: nextPresent,
  };
}

export function undoHistoryState(current) {
  if (!current || current.past.length === 0) {
    return { changed: false, state: current };
  }

  const previous = current.past[current.past.length - 1];
  return {
    changed: true,
    state: {
      past: current.past.slice(0, -1),
      present: previous,
      future: [current.present, ...current.future],
    },
  };
}

export function redoHistoryState(current, { limit = DEFAULT_HISTORY_LIMIT } = {}) {
  if (!current || current.future.length === 0) {
    return { changed: false, state: current };
  }

  const [nextPresent, ...rest] = current.future;
  return {
    changed: true,
    state: {
      past: [...current.past, current.present].slice(-limit),
      present: nextPresent,
      future: rest,
    },
  };
}
