import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search, X } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  onSelect: (lat: number, lng: number, label: string) => void | Promise<void>;
  routing?: boolean;
  dark?: boolean;
  /** Live map centre — used as the search bias when the user has panned away. */
  center?: { lat: number; lng: number } | null;
  /** Live map zoom — scales how tight the search box is. */
  zoom?: number;
}

/** Half-size (in degrees) of the search bias box for a given zoom level. */
function bboxDeltaForZoom(zoom: number | undefined): number {
  if (zoom == null) return 0.1;
  if (zoom < 12) return 0.3;
  if (zoom <= 14) return 0.1;
  return 0.05;
}

/**
 * Address autocomplete (Nominatim) shown top-left of the map.
 * Picking a suggestion hands the coordinates back to MapView, which reuses the
 * existing OSRM routing + navigation start logic (same path as POI taps).
 */
export function AddressSearchBox({ onSelect, routing = false, dark = false }: Props) {
  const { t } = useTranslation();
  const position = useVigla((s) => s.position);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", query.trim());
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "6");
        if (position) {
          const d = 0.1;
          // left,top,right,bottom — bounded=1 hard-restricts results to the box
          url.searchParams.set(
            "viewbox",
            `${position.lng - d},${position.lat + d},${position.lng + d},${position.lat - d}`,
          );
          url.searchParams.set("bounded", "1");
        }
        const res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("nominatim");
        let list = (await res.json()) as NominatimResult[];
        // Nothing nearby? widen the search so the field is never a dead end.
        if (list.length === 0 && position) {
          url.searchParams.delete("bounded");
          const wide = await fetch(url.toString(), {
            signal: ctrl.signal,
            headers: { Accept: "application/json" },
          });
          if (wide.ok) list = (await wide.json()) as NominatimResult[];
        }
        setResults(list);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, position]);

  const panel = dark
    ? "bg-[#14171b] text-white ring-white/10"
    : "bg-white text-slate-900 ring-slate-200";

  return (
    <div className="pointer-events-auto w-[15rem] max-w-[70vw]">
      <div className={`flex items-center gap-2 rounded-xl px-3 shadow-md ring-1 ${panel}`}>
        <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("route.searchPlaceholder")}
          aria-label={t("route.searchPlaceholder")}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:opacity-60"
        />
        {(searching || routing) && <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />}
        {!searching && !routing && query.length > 0 && (
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="shrink-0 rounded p-0.5 opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <ul className={`mt-1 max-h-[200px] overflow-y-auto rounded-xl shadow-lg ring-1 ${panel}`}>
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                disabled={routing}
                onClick={() => {
                  setResults([]);
                  setQuery("");
                  void onSelect(parseFloat(r.lat), parseFloat(r.lon), r.display_name);
                }}
                className="w-full px-3 py-2 text-left text-xs leading-snug transition hover:opacity-80 disabled:opacity-50"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
