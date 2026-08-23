/**
 * Parallel Overpass mirror racing.
 *
 * Previously each POI query walked its mirror list sequentially: a dead or
 * slow mirror burned its full timeout before the next one was even tried
 * (up to 3 x timeout per layer). Here every mirror is queried at the SAME
 * time and the first usable answer wins; the losers are aborted.
 */

export interface RaceOptions {
  endpoints: string[];
  query: string;
  timeoutMs: number;
  method?: "GET" | "POST";
  label: string;
}

export interface RaceOutcome {
  json: { elements?: unknown[] };
  mirror: string;
  ms: number;
}

export async function raceOverpassMirrors({
  endpoints,
  query,
  timeoutMs,
  method = "GET",
  label,
}: RaceOptions): Promise<RaceOutcome> {
  const started = Date.now();
  const controller = new AbortController();
  const failures: string[] = [];

  const attempts = endpoints.map(async (url) => {
    const host = new URL(url).host;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res =
        method === "POST"
          ? await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "VIGLA/1.0",
                Accept: "application/json",
              },
              body: new URLSearchParams({ data: query }).toString(),
              signal: controller.signal,
            })
          : await fetch(`${url}?data=${encodeURIComponent(query)}`, {
              method: "GET",
              headers: { "User-Agent": "VIGLA/1.0", Accept: "application/json" },
              signal: controller.signal,
            });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements?: unknown[] };
      if (!Array.isArray(json.elements) || json.elements.length === 0) {
        throw new Error("0 results");
      }
      return { json, mirror: host, ms: Date.now() - started } satisfies RaceOutcome;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${host}: ${msg}`);
      throw new Error(msg);
    } finally {
      clearTimeout(timer);
    }
  });

  try {
    const winner = await Promise.any(attempts);
    // Cancel the slower mirrors as soon as one answered.
    controller.abort();
    console.log(`🟢 [${label}] ${winner.mirror} won in ${(winner.ms / 1000).toFixed(1)}s`);
    return winner;
  } catch {
    controller.abort();
    throw new Error(`overpass unreachable — ${failures.join(" | ")}`);
  }
}
