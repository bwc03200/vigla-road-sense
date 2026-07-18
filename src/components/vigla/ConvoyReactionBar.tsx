import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import { vibrateConfirm } from "@/lib/haptics";
import { reactionLabel, reactionText } from "@/lib/i18n-helpers";
import { type ConvoyReactionKind } from "@/types/vigla";

type AnyClient = { from: (t: string) => any };
const db = supabase as unknown as AnyClient;

const REACTIONS: ConvoyReactionKind[] = ["wait", "join", "break", "fuel"];
const REACTION_EMOJI: Record<ConvoyReactionKind, string> = {
  wait: "🖐️",
  join: "👋",
  break: "☕",
  fuel: "⛽",
  message: "💬",
};

export function ConvoyReactionBar({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const convoy = useVigla((s) => s.convoy);
  const displayName = useVigla((s) => s.displayName);
  if (!convoy) return null;

  async function send(kind: ConvoyReactionKind) {
    vibrateConfirm();
    const { error } = await db.from("convoy_alerts").insert({
      convoy_id: convoy!.id,
      user_id: userId,
      display_name: displayName || t("convoy.reactions.message"),
      kind,
      payload: { text: reactionText(kind) },
    });
    if (error) toast.error(t("convoy.sendFailed"));
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[700] flex justify-center px-3">
      <div className="pointer-events-auto flex gap-2 rounded-full bg-slate-900/95 p-2 shadow-[0_8px_24px_rgba(15,23,42,0.35)]">
        {REACTIONS.map((k) => (
          <button
            key={k}
            onClick={() => send(k)}
            className="flex flex-col items-center gap-0.5 rounded-full bg-white/5 px-3 py-2 text-white transition hover:bg-white/15"
            aria-label={reactionLabel(k)}
          >
            <span className="text-lg leading-none">{REACTION_EMOJI[k]}</span>
            <span className="text-[10px] font-medium">{reactionLabel(k)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConvoyMessageBubbles() {
  const alerts = useVigla((s) => s.convoyAlerts);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  void tick;

  if (alerts.length === 0) return null;
  const now = Date.now();
  const active = alerts
    .filter((a) => new Date(a.expires_at).getTime() > now)
    .slice(-3);
  if (active.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-[800] flex flex-col items-center gap-2 px-3">
      {active.map((a) => {
        const msLeft = new Date(a.expires_at).getTime() - now;
        const expiring = msLeft < 800;
        return (
          <div
            key={a.id}
            className={`pointer-events-auto animate-in fade-in slide-in-from-top-2 rounded-full bg-white px-4 py-2 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.15)] ring-1 ring-slate-200 ${
              expiring ? "vigla-bubble-expiring" : ""
            }`}
          >
            <span className="mr-1 text-base">{REACTION_EMOJI[a.kind]}</span>
            <span className="font-semibold text-slate-900">{a.display_name}</span>
            <span className="text-slate-600">: {a.payload?.text ?? reactionText(a.kind)}</span>
          </div>
        );
      })}
    </div>
  );
}
