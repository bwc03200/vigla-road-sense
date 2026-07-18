import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";

export function OfflineBadge() {
  const { t } = useTranslation();
  const online = useVigla((s) => s.online);
  if (online) return null;
  return (
    <div className="pointer-events-none absolute right-3 top-24 z-[600]">
      <div className="flex items-center gap-1.5 rounded-full bg-destructive/90 px-3 py-1 text-xs font-medium text-destructive-foreground shadow-lg backdrop-blur">
        <WifiOff className="h-3 w-3" />
        {t("map.offline")}
      </div>
    </div>
  );
}
