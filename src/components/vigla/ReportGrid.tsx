import { useState } from "react";
import { toast } from "sonner";
import { Camera, Siren, Construction, TriangleAlert, Turtle, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { HazardType } from "@/types/vigla";

const OPTIONS: {
  type: HazardType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { type: "radar_fixe", label: "Radar fixe", icon: Camera, color: "bg-danger" },
  { type: "radar_mobile", label: "Radar mobile", icon: Radar, color: "bg-orange-500" },
  { type: "accident", label: "Accident", icon: Siren, color: "bg-red-500" },
  { type: "travaux", label: "Travaux", icon: Construction, color: "bg-amber-500" },
  { type: "obstacle", label: "Obstacle", icon: TriangleAlert, color: "bg-yellow-500" },
  { type: "ralentissement", label: "Ralentissement", icon: Turtle, color: "bg-info" },
];

export function ReportGrid({ onReported }: { onReported?: () => void }) {
  const position = useVigla((s) => s.position);
  const [pending, setPending] = useState<HazardType | null>(null);

  async function report(type: HazardType) {
    if (!position) {
      toast.error("Position GPS indisponible");
      return;
    }
    setPending(type);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Connectez-vous pour signaler");
      setPending(null);
      return;
    }
    const { error } = await supabase.from("hazard_reports").insert({
      type,
      latitude: position.lat,
      longitude: position.lng,
      reported_by: uid,
      confidence_score: 1,
    });
    setPending(null);
    if (error) {
      toast.error("Signalement échoué", {
        description: error.message,
        action: { label: "Réessayer", onClick: () => report(type) },
      });
      return;
    }
    toast.success("Signalement envoyé", {
      description: OPTIONS.find((o) => o.type === type)?.label,
    });
    onReported?.();
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {OPTIONS.map(({ type, label, icon: Icon, color }) => (
        <button
          key={type}
          onClick={() => report(type)}
          disabled={pending !== null}
          className="group flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl bg-card p-4 ring-1 ring-border transition active:scale-95 disabled:opacity-50"
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full ${color} text-white shadow-lg ${
              pending === type ? "animate-pulse" : ""
            }`}
          >
            <Icon className="h-6 w-6" />
          </span>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </button>
      ))}
    </div>
  );
}
