import { useEffect, useMemo, useState } from "react";
import { useVigla } from "@/lib/vigla-store";
import { matchAlongRoute } from "@/lib/route-index";
import { cumulativeDistances } from "@/lib/geo";
import { getGasStations } from "@/lib/gas-stations.functions";
import { getFastfoods } from "@/lib/fastfoods.functions";
import { dlog } from "@/lib/debug";

/**
 * Fuel stations and restaurants lying close to the planned route, in the order
 * they are passed. Nothing is searched around the driver: the route is cut into
 * ~15 km stretches, each stretch is queried once (cached), and only the places
 * within STOP_CORRIDOR_M of the line are kept. A stop on the motorway therefore
 * costs no detour.
 */
export type StopKind = "fuel" | "food";

export interface RouteStop {
  id: string;
  kind: StopKind;
  name: string;
  lat: number;
  lng: number;
  /** Distance from the start of the route to the stop (m). */
  alongM: number;
  /** Distance from the stop to the route line (m). */
  offsetM: number;
}

const STOP_CORRIDOR_M = 400;
const CHUNK_M = 15_000;
const PAD_DEG = 0.006;
const MAX_STOPS = 60;

type Bbox = { south: number; north: number; west: number; east: number };
type Raw = { id: string; kind: StopKind; name: string; lat: number; lng: number };

/** Module cache: a stretch already queried is never queried again this session. */
const chunkCache = new Map<string, Raw[]>();

function chunkBoxes(coords: [number, number][]): { key: string; box: Bbox }[] {
  const cum = cumulativeDistances(coords);
  const total = cum[cum.length - 1] ?? 0;
  const count = Math.max(1, Math.ceil(total / CHUNK_M));
  const out: { key: string; box: Bbox }[] = [];
  for (let c = 0; c < count; c++) {
    const from = (c * total) / count;
    const to = ((c + 1) * total) / count;
    let box: Bbox | null = null;
    for (let i = 0; i < coords.length; i++) {
      if (cum[i] < from || cum[i] > to) continue;
      const [la, ln] = coords[i];
      if (!box) box = { south: la, north: la, west: ln, east: ln };
      box.south = Math.min(box.south, la);
      box.north = Math.max(box.north, la);
      box.west = Math.min(box.west, ln);
      box.east = Math.max(box.east, ln);
    }
    if (!box) continue;
    const padded: Bbox = {
      south: box.south - PAD_DEG,
      north: box.north + PAD_DEG,
      west: box.west - PAD_DEG,
      east: box.east + PAD_DEG,
    };
    const key = [padded.south, padded.west, padded.north, padded.east].map((n) => n.toFixed(3)).join(",");
    out.push({ key, box: padded });
  }
  return out;
}

async function fetchChunk(box: Bbox): Promise<Raw[]> {
  const [fuel, food] = await Promise.all([
    getGasStations({ data: box }).catch(() => null),
    getFastfoods({ data: { ...box, zoom: 14 } }).catch(() => null),
  ]);
  const rows: Raw[] = [];
  if (fuel && fuel.ok) {
    for (const s of fuel.stations) {
      rows.push({ id: s.id, kind: "fuel", name: s.name ?? s.brand ?? "Station", lat: s.latitude, lng: s.longitude });
    }
  }
  if (food && food.ok) {
    for (const p of food.data) {
      rows.push({ id: p.id, kind: "food", name: p.name, lat: p.latitude, lng: p.longitude });
    }
  }
  return rows;
}

export function useRouteStops(enabled: boolean): { stops: RouteStop[]; loading: boolean; progress: number } {
  const coords = useVigla((s) => s.route?.coords ?? null);
  const [raw, setRaw] = useState<Raw[]>([]);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled || !coords || coords.length < 2) {
      setRaw([]);
      setDone(0);
      setTotal(0);
      return;
    }
    let cancelled = false;
    const boxes = chunkBoxes(coords);
    setTotal(boxes.length);
    setDone(0);
    const collected = new Map<string, Raw>();
    (async () => {
      for (const { key, box } of boxes) {
        if (cancelled) return;
        let rows = chunkCache.get(key);
        if (!rows) {
          rows = await fetchChunk(box);
          chunkCache.set(key, rows);
        }
        for (const r of rows) collected.set(r.id, r);
        if (!cancelled) {
          setRaw([...collected.values()]);
          setDone((d) => d + 1);
        }
      }
      dlog("🛣️ [ROUTE STOPS]", collected.size, "lieux sur", boxes.length, "tronçons");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, coords]);

  const stops = useMemo<RouteStop[]>(() => {
    if (!coords || raw.length === 0) return [];
    const points = raw.map((r) => ({ ...r, latitude: r.lat, longitude: r.lng }));
    return matchAlongRoute(coords, points, STOP_CORRIDOR_M)
      .map((m) => ({
        id: m.item.id,
        kind: m.item.kind,
        name: m.item.name,
        lat: m.item.lat,
        lng: m.item.lng,
        alongM: m.alongM,
        offsetM: m.offsetM,
      }))
      .sort((a, b) => a.alongM - b.alongM)
      .slice(0, MAX_STOPS);
  }, [coords, raw]);

  return {
    stops,
    loading: total > 0 && done < total,
    progress: total > 0 ? done / total : 0,
  };
}
