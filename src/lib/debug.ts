/**
 * Debug logging: active in development only. Production builds keep the
 * console clean (no internal URLs, timings or state dumps).
 */
export const dlog: (...args: unknown[]) => void = import.meta.env.DEV
  ? (...args: unknown[]) => console.log(...args)
  : () => {};
