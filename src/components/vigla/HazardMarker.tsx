import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { confirmHazard, denyHazard } from "@/hooks/useHazards";
import { supabase } from "@/integrations/supabase/client";
import type { HazardReport, HazardType } from "@/types/vigla";

const HAZARD_COLORS: Record<HazardType, string> = {
  radar_fixe: "#FF6B35",
  radar_mobile: "#F97316",
  accident: "#EF4444",
  travaux: "#F59E0B",
  obstacle: "#EAB308",
  ralentissement: "#0EA5E9",
};

const HAZARD_EMOJI: Record<HazardType, string> = {
  radar_fixe: "📷",
  radar_mobile: "🚔",
  accident: "💥",
  travaux: "🚧",
  obstacle: "⚠️",
  ralentissement: "🐌",
};

const HAZARD_LABELS: Record<HazardType, string> = {
  radar_fixe: "Radar fixe",
  radar_mobile: "Radar mobile",
  accident: "Accident",
  travaux: "Travaux",
  obstacle: "Obstacle",
  ralentissement: "Ralentissement",
};

const VOTES_KEY = "vigla:hazard-votes";

function loadVotes(): Record<string, "confirm" | "deny"> {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVote(id: string, kind: "confirm" | "deny") {
  try {
    const v = loadVotes();
    v[id] = kind;
    localStorage.setItem(VOTES_KEY, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

function hazardIcon(type: HazardType) {
  const color = HAZARD_COLORS[type];
  return L.divIcon({
    className: "vigla-hazard-icon",
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,.25),0 0 0 3px #ffffff;font-size:18px;">${HAZARD_EMOJI[type]}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h} h`;
}

export function HazardMarker({ hazard }: { hazard: HazardReport }) {
  const [pending, setPending] = useState<null | "confirm" | "deny">(null);
  const [voted, setVoted] = useState<"confirm" | "deny" | null>(
    () => loadVotes()[hazard.id] ?? null,
  );
  const [authed, setAuthed] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthed(!!data.user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function vote(kind: "confirm" | "deny") {
    if (pending || voted) return;
    if (!authed) {
      toast.error("Connecte-toi pour voter");
      return;
    }
    setPending(kind);
    try {
      if (kind === "confirm") await confirmHazard(hazard.id);
      else await denyHazard(hazard.id);
      saveVote(hazard.id, kind);
      setVoted(kind);
      toast.success(kind === "confirm" ? "Merci pour ta confirmation" : "Signalement infirmé");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!navigator.onLine) {
        toast.error("Impossible d'envoyer ta réponse, réessaie plus tard");
      } else {
        toast.error("Échec du vote", { description: msg });
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <Marker position={[hazard.latitude, hazard.longitude]} icon={hazardIcon(hazard.type)}>
      <Popup closeButton={false} minWidth={220}>
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{HAZARD_EMOJI[hazard.type]}</span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {HAZARD_LABELS[hazard.type]}
              </span>
              <span className="text-xs text-muted-foreground">
                Signalé {formatAge(hazard.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>✅ {hazard.confirmed_count}</span>
            <span>❌ {hazard.denied_count}</span>
          </div>
          {voted ? (
            <div className="rounded-md bg-muted px-2 py-1.5 text-center text-xs text-muted-foreground">
              {voted === "confirm" ? "Déjà confirmé" : "Déjà infirmé"}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => vote("confirm")}
                disabled={pending !== null || !authed}
                className="flex-1 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                {pending === "confirm" ? "…" : "✅ Confirmer"}
              </button>
              <button
                type="button"
                onClick={() => vote("deny")}
                disabled={pending !== null || !authed}
                className="flex-1 rounded-md bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                {pending === "deny" ? "…" : "❌ Fausse alerte"}
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
