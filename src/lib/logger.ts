/**
 * Lightweight client-side logger.
 *
 * - Batches inserts into public.client_error_logs (max BATCH_SIZE, or every FLUSH_MS).
 * - Captures uncaught errors (window.onerror + unhandledrejection).
 * - Never blocks the UI; all failures swallowed silently.
 * - Optional per-event dedupe key to avoid runaway loops.
 */
import { supabase } from "@/integrations/supabase/client";

type Level = "error" | "warning" | "info";

interface LogEntry {
  user_id: string | null;
  error_message: string;
  stack_trace: string | null;
  route: string | null;
  context: Record<string, unknown> | null;
  level: Level;
}

const BATCH_SIZE = 5;
const FLUSH_MS = 10_000;
const MAX_QUEUE = 50;
const DEDUPE_WINDOW_MS = 30_000;

let queue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUserId: string | null = null;
let installed = false;
const recentKeys = new Map<string, number>();

export function setLoggerUser(id: string | null) {
  currentUserId = id;
}

function route(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname + window.location.search;
}

function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
}

async function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    // supabase-js client. Fire-and-forget; silent on error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db.from("client_error_logs").insert(batch);
  } catch {
    // swallow: never let logging break the app.
  }
}

function enqueue(entry: LogEntry, dedupeKey?: string) {
  if (dedupeKey) {
    const now = Date.now();
    // Purge stale keys occasionally.
    if (recentKeys.size > 100) {
      for (const [k, t] of recentKeys)
        if (now - t > DEDUPE_WINDOW_MS) recentKeys.delete(k);
    }
    const last = recentKeys.get(dedupeKey);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recentKeys.set(dedupeKey, now);
  }
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(entry);
  if (queue.length >= BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush();
  } else {
    schedule();
  }
}

/** Log a structured event (success, failure, metric). */
export function logEvent(
  name: string,
  level: Level = "info",
  context?: Record<string, unknown>,
  dedupeKey?: string,
) {
  enqueue(
    {
      user_id: currentUserId,
      error_message: name,
      stack_trace: null,
      route: route(),
      context: context ?? null,
      level,
    },
    dedupeKey,
  );
}

/** Log a caught error with optional extra context. */
export function logError(
  err: unknown,
  context?: Record<string, unknown>,
  dedupeKey?: string,
) {
  const e = err as { message?: string; stack?: string } | null;
  const message =
    (e && typeof e.message === "string" && e.message) ||
    (typeof err === "string" ? err : "Unknown error");
  enqueue(
    {
      user_id: currentUserId,
      error_message: message.slice(0, 500),
      stack_trace: e?.stack?.slice(0, 4000) ?? null,
      route: route(),
      context: context ?? null,
      level: "error",
    },
    dedupeKey ?? message,
  );
}

/** Install global uncaught error handlers. Idempotent. */
export function installGlobalErrorLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    try {
      logError(event.error ?? event.message, {
        source: "window.onerror",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    } catch {}
  });

  window.addEventListener("unhandledrejection", (event) => {
    try {
      logError(event.reason, { source: "unhandledrejection" });
    } catch {}
  });

  // Best-effort flush on page hide.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => {
    void flush();
  });
}
