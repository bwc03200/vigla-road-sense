import { Map, AlertTriangle, History, User } from "lucide-react";

export type Tab = "map" | "report" | "history" | "profile";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "map", label: "Carte", icon: Map },
  { id: "report", label: "Signaler", icon: AlertTriangle },
  { id: "history", label: "Historique", icon: History },
  { id: "profile", label: "Profil", icon: User },
];

export function BottomTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[700] border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition`} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
