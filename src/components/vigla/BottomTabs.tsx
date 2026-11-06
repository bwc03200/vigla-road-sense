import { useTranslation } from "react-i18next";
import { Map, AlertTriangle, BookOpen, Users, User, History, Footprints } from "lucide-react";
import { useFootModeStore } from "@/lib/foot-mode-store";
import { Button } from "@/components/ui/button";

export type Tab = "map" | "report" | "roadbooks" | "history" | "convoy" | "profile";

const TAB_ORDER: { id: Tab; icon: React.ComponentType<{ className?: string }>; key: string }[] = [
  { id: "map", icon: Map, key: "map" },
  { id: "report", icon: AlertTriangle, key: "report" },
  { id: "roadbooks", icon: BookOpen, key: "roadbooks" },
  { id: "history", icon: History, key: "history" },
  { id: "convoy", icon: Users, key: "convoy" },
  { id: "profile", icon: User, key: "profile" },
];

export function BottomTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  const { t } = useTranslation();
  const isFootMode = useFootModeStore((s) => s.isFootMode);
  const toggleFootMode = useFootModeStore((s) => s.toggleFootMode);

  return (
    <nav
      aria-label={t("tabs.map")}
      className="fixed inset-x-0 bottom-0 z-[800] border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {TAB_ORDER.map(({ id, icon: Icon, key }) => {
          const active = value === id;
          const label = t(`tabs.${key}`);
          return (
            <Button
              variant="ghost"
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`h-16 min-w-0 flex-1 flex-col gap-1 rounded-none px-0 py-2.5 transition ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon
                aria-hidden="true"
                className={`h-5 w-5 ${active ? "text-primary scale-110" : ""} transition`}
              />
              <span className="text-[10px] font-semibold">{label}</span>
            </Button>
          );
        })}

        <Button
          variant="ghost"
          type="button"
          onClick={() => { toggleFootMode(); onChange("map"); }}
          aria-label={t("tabs.foot")}
          aria-pressed={isFootMode}
          className={`h-16 min-w-0 flex-1 flex-col gap-1 rounded-none px-0 py-2.5 transition ${
            isFootMode ? "text-info" : "text-muted-foreground"
          }`}
        >
          <Footprints
            aria-hidden="true"
            className={`h-5 w-5 ${isFootMode ? "text-info scale-110" : ""} transition`}
          />
          <span className="text-[10px] font-semibold">{t("tabs.foot")}</span>
        </Button>
      </div>
    </nav>
  );
}

