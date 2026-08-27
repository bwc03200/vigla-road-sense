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
  method = "POST",
  label,
}: RaceOptions): Promise<RaceOutcome> {
  const started = Date.now();
  const failures: string[] = [];
  // One controller PER mirror: a shared one made the first timeout abort every
  // other in-flight mirror ("The operation was aborted"), killing the race.
  const controllers = endpoints.map(() => new AbortController());
  const abortAll = () => controllers.forEach((c) => c.abort());

  const attempts = endpoints.map(async (url, i) => {
    const host = new URL(url).host;
    const controller = controllers[i]!;
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
      // An empty `elements` array is a VALID answer (no POI in this bbox) —
      // treating it as a failure made whole layers error out.
      if (!Array.isArray(json.elements)) throw new Error("malformed response");
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
    abortAll();
    console.log(`🟢 [${label}] ${winner.mirror} won in ${(winner.ms / 1000).toFixed(1)}s`);
    return winner;
  } catch {
    abortAll();
    throw new Error(`overpass unreachable — ${failures.join(" | ")}`);
  }
}
