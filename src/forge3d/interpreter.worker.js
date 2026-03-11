import { interpret } from './interpreter.js';

self.onmessage = (e) => {
  const { code, id } = e.data;
  try {
    const result = interpret(code);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({
      id,
      result: {
        objects: [],
        logs: [],
        errors: [err.message || String(err)],
        warnings: [],
        variables: {},
      },
    });
  }
};
