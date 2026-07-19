import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { HazardReport, HazardType } from "@/types/vigla";

const QUEUE_KEY = "vigla:offline-hazard-queue";

export interface QueuedHazard {
  tempId: string;
  type: HazardType;
  latitude: number;
  longitude: number;
  reported_by: string;
  queuedAt: number;
}

function readQueue(): QueuedHazard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedHazard[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedHazard[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded — drop silently, we already have the item in memory.
  }
}

export function getQueuedHazardCount(): number {
  return readQueue().length;
}

/** Enqueue a hazard for later sync + optimistic local render. */
export function enqueueHazard(item: Omit<QueuedHazard, "tempId" | "queuedAt">) {
  const q = readQueue();
  const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: QueuedHazard = { ...item, tempId, queuedAt: Date.now() };
  q.push(entry);
  writeQueue(q);

  // Optimistically show on the map (best-effort — pending id).
  const now = new Date();
  const optimistic: HazardReport = {
    id: tempId,
    type: item.type,
    latitude: item.latitude,
    longitude: item.longitude,
    reported_by: item.reported_by,
    confidence_score: 1,
    confirmed_count: 0,
    denied_count: 0,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 60 * 60_000).toISOString(),
  } as HazardReport;
  useVigla.getState().upsertHazard(optimistic);
  return entry;
}

/**
 * Attempts to flush queued hazard reports to Supabase.
 * Returns the number successfully synced.
 */
export async function syncQueuedHazards(): Promise<number> {
  const q = readQueue();
  if (q.length === 0) return 0;
  let synced = 0;
  const remaining: QueuedHazard[] = [];
  for (const item of q) {
    try {
      const { error } = await supabase.from("hazard_reports").insert({
        type: item.type,
        latitude: item.latitude,
        longitude: item.longitude,
        reported_by: item.reported_by,
        confidence_score: 1,
      });
      if (error) {
        remaining.push(item);
      } else {
        synced += 1;
        // Drop optimistic pending row; realtime/next fetch will bring the real one.
        useVigla.getState().removeHazard(item.tempId);
      }
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return synced;
}
