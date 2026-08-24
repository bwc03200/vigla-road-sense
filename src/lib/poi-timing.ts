/**
 * Lightweight instrumentation proving the POI layers (radars, restaurants,
 * fuel, traffic signals) are fetched in PARALLEL rather than one after the
 * other. Purely observational — it never delays or blocks a fetch.
 */

export type PoiLayer = "RADARS" | "RESTAURANTS" | "ESSENCE" | "FEUX";

let inFlight = 0;
let cycleStart = 0;
let results: string[] = [];

export async function trackPoiFetch<T>(layer: PoiLayer, run: () => Promise<T>): Promise<T> {
  if (inFlight === 0) {
    cycleStart = Date.now();
    results = [];
    console.log("🟢 [OVERPASS PARALLEL START]");
  }
  inFlight += 1;
  const started = Date.now();
  try {
    return await run();
  } finally {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`🟢 [${layer} FETCHED: ${secs}s]`);
    results.push(`${layer} ${secs}s`);
    inFlight -= 1;
    if (inFlight === 0) {
      const total = ((Date.now() - cycleStart) / 1000).toFixed(1);
      console.log(`🟢 [TOTAL: ${total}s] — ${results.join(" | ")} (en parallèle)`);
    }
  }
}
