import { useTranslation } from "react-i18next";
import { Map, AlertTriangle, BookOpen, Users, User } from "lucide-react";

export type Tab = "map" | "report" | "roadbooks" | "convoy" | "profile";

const TAB_ORDER: { id: Tab; icon: React.ComponentType<{ className?: string }>; key: string }[] = [
  { id: "map", icon: Map, key: "map" },
  { id: "report", icon: AlertTriangle, key: "report" },
  { id: "roadbooks", icon: BookOpen, key: "roadbooks" },
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
  return (
    <nav
      aria-label={t("tabs.map")}
      className="fixed inset-x-0 bottom-0 z-[700] border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {TAB_ORDER.map(({ id, icon: Icon, key }) => {
          const active = value === id;
          const label = t(`tabs.${key}`);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition ${
                active ? "text-slate-900" : "text-slate-500"
              }`}
            >
              <Icon
                aria-hidden="true"
                className={`h-5 w-5 ${active ? "text-[#FF6B35] scale-110" : ""} transition`}
              />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}

      </div>
    </nav>
  );
}
