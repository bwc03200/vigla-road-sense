import { dlog } from "@/lib/debug";
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

  // First NON-EMPTY answer wins and returns at once: we no longer wait for the
  // slowest mirror (which used to fix the latency at its full timeout). An
  // empty `elements` array is only used when no mirror had data, once all of
  // them have settled.
  const outcome = await new Promise<RaceOutcome | null>((resolve) => {
    let pending = endpoints.length;
    let emptyAnswer: RaceOutcome | null = null;
    let done = false;
    const finish = (value: RaceOutcome | null) => {
      if (done) return;
      done = true;
      abortAll();
      resolve(value);
    };

    endpoints.forEach(async (url, i) => {
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
        if (!Array.isArray(json.elements)) throw new Error("malformed response");
        const out = { json, mirror: host, ms: Date.now() - started } satisfies RaceOutcome;
        if ((json.elements?.length ?? 0) > 0) {
          dlog(`🟢 [${label}] ${host} won in ${(out.ms / 1000).toFixed(1)}s`);
          finish(out);
        } else {
          emptyAnswer ??= out;
        }
      } catch (err) {
        failures.push(`${host}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        clearTimeout(timer);
        pending -= 1;
        if (pending === 0) {
          if (emptyAnswer) {
            dlog(`🟡 [${label}] aucun résultat (réponse vide de ${emptyAnswer.mirror})`);
          }
          finish(emptyAnswer);
        }
      }
    });
  });

  if (outcome) return outcome;

  // Some mirrors answer 500 to POST but serve GET fine (and vice versa).
  // One automatic retry with the other verb before declaring failure.
  if (method === "POST") {
    dlog(`🔁 [${label}] POST échoué sur tous les miroirs — retry GET`);
    return raceOverpassMirrors({ endpoints, query, timeoutMs, method: "GET", label });
  }
  throw new Error(`overpass unreachable — ${failures.join(" | ")}`);

}
