import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Camera, Siren, Construction, TriangleAlert, Turtle, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import { hazardLabel } from "@/lib/i18n-helpers";
import type { HazardType } from "@/types/vigla";

const OPTIONS: {
  type: HazardType;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { type: "radar_fixe", icon: Camera, color: "bg-danger" },
  { type: "radar_mobile", icon: Radar, color: "bg-orange-500" },
  { type: "accident", icon: Siren, color: "bg-red-500" },
  { type: "travaux", icon: Construction, color: "bg-amber-500" },
  { type: "obstacle", icon: TriangleAlert, color: "bg-yellow-500" },
  { type: "ralentissement", icon: Turtle, color: "bg-info" },
];

export function ReportGrid({ onReported }: { onReported?: () => void }) {
  const { t } = useTranslation();
  const position = useVigla((s) => s.position);
  const [pending, setPending] = useState<HazardType | null>(null);

  async function report(type: HazardType) {
    if (!position) {
      toast.error(t("hazard.report.gpsUnavailable"));
      return;
    }
    setPending(type);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error(t("hazard.report.loginRequired"));
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
      toast.error(t("hazard.report.failed"), {
        description: error.message,
        action: { label: t("common.retry"), onClick: () => report(type) },
      });
      return;
    }
    toast.success(t("hazard.report.sent"), {
      description: hazardLabel(type),
    });
    onReported?.();
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {OPTIONS.map(({ type, icon: Icon, color }) => (
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
          <span className="text-sm font-medium text-foreground">{hazardLabel(type)}</span>
        </button>
      ))}
    </div>
  );
}
