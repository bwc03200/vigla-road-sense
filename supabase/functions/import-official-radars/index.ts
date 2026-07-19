// Supabase Edge Function: import-official-radars
// Fetches the official French speed camera dataset from data.gouv.fr
// and upserts each radar into public.official_radars.
//
// Run manually via: supabase.functions.invoke("import-official-radars")
// or GET the function URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RadarRow {
  id: string;
  latitude: number;
  longitude: number;
  type: string | null;
  route: string | null;
  vitesse_controlee: number | null;
  date_installation: string | null;
}

function parseNum(v: string | undefined | null): number | null {
  if (v == null || v === "") return null;
  const cleaned = String(v).replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  // French dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}

// Very tolerant CSV parser: expects ; separator, may have quoted fields.
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === sep && !inQuote) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = (cols[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

function pick(row: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) {
    const found = Object.keys(row).find((h) => h.includes(k));
    if (found && row[found] !== "") return row[found];
  }
  return null;
}

function normalizeRow(
  row: Record<string, string>,
  idx: number,
): RadarRow | null {
  const lat = parseNum(pick(row, ["latitude", "lat"]));
  const lng = parseNum(pick(row, ["longitude", "lon", "lng"]));
  if (lat == null || lng == null) return null;
  const idRaw =
    pick(row, ["id_radar", "identifiant", "id"]) ??
    `${lat.toFixed(5)}_${lng.toFixed(5)}_${idx}`;
  return {
    id: String(idRaw),
    latitude: lat,
    longitude: lng,
    type: pick(row, ["type", "categorie"]),
    route: pick(row, ["route", "voie", "axe", "emplacement", "departement"]),
    vitesse_controlee: (() => {
      const v =
        parseNum(pick(row, ["vitesse_vehicules_leger", "vitesse_leger", "vma"])) ??
        parseNum(pick(row, ["vitesse"]));
      return v == null ? null : Math.round(v);
    })(),
    date_installation: parseDate(pick(row, ["date_installation", "date_mise_en_service", "date"])),
  };
}

function normalizeJson(items: unknown[]): RadarRow[] {
  const out: RadarRow[] = [];
  items.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return;
    const obj = raw as Record<string, unknown>;
    // GeoJSON feature?
    if (obj.geometry && (obj.geometry as Record<string, unknown>).coordinates) {
      const coords = (obj.geometry as { coordinates: [number, number] })
        .coordinates;
      const props = (obj.properties ?? {}) as Record<string, unknown>;
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(props)) {
        flat[k.toLowerCase()] = v == null ? "" : String(v);
      }
      flat["longitude"] = String(coords[0]);
      flat["latitude"] = String(coords[1]);
      const n = normalizeRow(flat, idx);
      if (n) out.push(n);
      return;
    }
    // flat object
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      flat[k.toLowerCase()] = v == null ? "" : String(v);
    }
    const n = normalizeRow(flat, idx);
    if (n) out.push(n);
  });
  return out;
}

async function findDataset(): Promise<{ id: string; title: string } | null> {
  const res = await fetch(
    "https://www.data.gouv.fr/api/1/datasets/?q=radars+automatiques&page_size=5",
  );
  if (!res.ok) return null;
  const data = await res.json();
  const items = (data?.data ?? []) as Array<{
    id: string;
    title: string;
    organization?: { name?: string };
  }>;
  // Prefer official Ministère de l'Intérieur / Sécurité Routière.
  const official = items.find((d) => {
    const org = (d.organization?.name ?? "").toLowerCase();
    const title = (d.title ?? "").toLowerCase();
    return (
      org.includes("intérieur") ||
      org.includes("interieur") ||
      org.includes("sécurité routière") ||
      org.includes("securite routiere") ||
      title.includes("radars automatiques")
    );
  });
  const chosen = official ?? items[0];
  return chosen ? { id: chosen.id, title: chosen.title } : null;
}

async function pickResource(datasetId: string): Promise<{
  url: string;
  format: string;
} | null> {
  const res = await fetch(
    `https://www.data.gouv.fr/api/1/datasets/${datasetId}/`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const items = ((data?.resources ?? []) as Array<{
    url: string;
    format?: string;
    title?: string;
    last_modified?: string;
  }>);
  const scored = items
    .map((r) => {
      const fmt = (r.format ?? "").toLowerCase();
      let score = 0;
      if (fmt === "csv") score = 3;
      else if (fmt === "json" || fmt === "geojson") score = 2;
      else score = 0;
      return { r, fmt, score, ts: r.last_modified ?? "" };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => (b.score - a.score) || b.ts.localeCompare(a.ts));
  const first = scored[0];
  return first ? { url: first.r.url, format: first.fmt } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[import-official-radars] start");
    const dataset = await findDataset();
    if (!dataset) throw new Error("Dataset radars introuvable sur data.gouv.fr");
    console.log("[import-official-radars] dataset:", dataset.id, dataset.title);

    const resource = await pickResource(dataset.id);
    if (!resource) throw new Error("Aucune ressource CSV/JSON exploitable");
    console.log("[import-official-radars] resource:", resource.format, resource.url);

    const fileRes = await fetch(resource.url);
    if (!fileRes.ok)
      throw new Error(`Téléchargement ressource échoué (${fileRes.status})`);

    let rows: RadarRow[] = [];
    if (resource.format === "csv") {
      const text = await fileRes.text();
      rows = parseCSV(text)
        .map((r, i) => normalizeRow(r, i))
        .filter((r): r is RadarRow => r !== null);
    } else {
      const json = await fileRes.json();
      const arr = Array.isArray(json)
        ? json
        : Array.isArray((json as Record<string, unknown>).features)
          ? ((json as Record<string, unknown>).features as unknown[])
          : Array.isArray((json as Record<string, unknown>).data)
            ? ((json as Record<string, unknown>).data as unknown[])
            : [];
      rows = normalizeJson(arr);
    }

    // Deduplicate by id.
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    console.log("[import-official-radars] parsed rows:", rows.length);
    if (rows.length === 0) throw new Error("Aucun radar exploitable");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Upsert in batches.
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((r) => ({
        ...r,
        source: "data.gouv.fr",
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("official_radars")
        .upsert(batch, { onConflict: "id" });
      if (error) {
        console.error("[import-official-radars] upsert error at batch", i, error);
        throw error;
      }
      inserted += batch.length;
    }
    console.log("[import-official-radars] upserted:", inserted);

    return new Response(
      JSON.stringify({
        success: true,
        dataset: dataset.title,
        format: resource.format,
        count: inserted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("import-official-radars error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
