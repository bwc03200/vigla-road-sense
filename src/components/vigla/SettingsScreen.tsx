import { useState } from "react";
import { ChevronLeft, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useVigla } from "@/lib/vigla-store";
import { savePreferences } from "@/hooks/usePreferences";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import type { AlertLeadTime, UserPreferences } from "@/types/vigla";

interface Props {
  userId: string;
  email: string;
  onBack: () => void;
}

export function SettingsScreen({ userId, email, onBack }: Props) {
  const prefs = useVigla((s) => s.preferences);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<0 | 1 | 2>(0);
  const deleteFn = useServerFn(deleteMyAccount);

  async function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    await savePreferences(userId, { [key]: value } as Partial<UserPreferences>);
  }

  async function handleDelete() {
    if (confirmDelete !== 2) {
      setConfirmDelete((c) => (c === 0 ? 1 : 2));
      return;
    }
    setDeleting(true);
    try {
      await deleteFn();
      toast.success("Compte supprimé");
      await supabase.auth.signOut();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast.error(`Suppression impossible : ${msg}`);
      setDeleting(false);
      setConfirmDelete(0);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-900">Paramètres</h1>
      </div>

      <Section title="Affichage">
        <SegmentedRow
          label="Unité de vitesse"
          value={prefs.speed_unit}
          options={[
            { value: "kmh", label: "km/h" },
            { value: "mph", label: "mph" },
          ]}
          onChange={(v) => update("speed_unit", v as "kmh" | "mph")}
        />
        <SegmentedRow
          label="Fond de carte"
          value={prefs.map_theme}
          options={[
            { value: "light", label: "Clair" },
            { value: "dark", label: "Sombre" },
          ]}
          onChange={(v) => update("map_theme", v as "light" | "dark")}
        />
        <ToggleRow
          label="Recentrage automatique"
          description="Suit ta position en permanence pendant la conduite."
          value={prefs.auto_recenter}
          onChange={(v) => update("auto_recenter", v)}
        />
      </Section>

      <Section title="Alertes">
        <ToggleRow
          label="Alertes vocales"
          description="Annonces à voix haute des zones de danger."
          value={prefs.voice_alerts}
          onChange={(v) => update("voice_alerts", v)}
          disabled
          badge="Bientôt disponible"
        />
        <ToggleRow
          label="Son des alertes"
          description="Bip court à l'approche d'une zone."
          value={prefs.sound_alerts}
          onChange={(v) => update("sound_alerts", v)}
        />
        <ToggleRow
          label="Vibration"
          description="Vibration à l'approche d'une zone de danger."
          value={prefs.vibration_alerts}
          onChange={(v) => update("vibration_alerts", v)}
        />
        <SegmentedRow
          label="Délai d'anticipation"
          value={prefs.alert_lead_time}
          options={[
            { value: "short", label: "Court" },
            { value: "normal", label: "Normal" },
            { value: "long", label: "Long" },
          ]}
          onChange={(v) => update("alert_lead_time", v as AlertLeadTime)}
        />
        <ToggleRow
          label="Mode moto"
          description="Types de signalements et alertes adaptés aux motards."
          value={prefs.moto_mode}
          onChange={(v) => update("moto_mode", v)}
          disabled
          badge="Bientôt disponible"
        />
      </Section>

      <Section title="Compte">
        <div className="px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500">Email</div>
          <div className="mt-1 truncate text-sm font-medium text-slate-900">{email}</div>
        </div>
        <div className="px-4 pb-3">
          <Button
            variant="secondary"
            className="h-11 w-full"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="text-xs uppercase tracking-widest text-red-600">Zone dangereuse</div>
          {confirmDelete === 0 && (
            <Button
              variant="outline"
              className="mt-2 h-11 w-full border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer mon compte
            </Button>
          )}
          {confirmDelete === 1 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-600">
                Cette action est <strong>définitive</strong> et supprime toutes tes données
                (contacts, trajets, roadbooks). Confirmer ?
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="h-11 flex-1" onClick={() => setConfirmDelete(0)}>
                  Annuler
                </Button>
                <Button
                  className="h-11 flex-1 bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDelete}
                >
                  Oui, continuer
                </Button>
              </div>
            </div>
          )}
          {confirmDelete === 2 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-red-600">
                Dernière confirmation. Ton compte sera supprimé immédiatement.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="h-11 flex-1" onClick={() => setConfirmDelete(0)} disabled={deleting}>
                  Annuler
                </Button>
                <Button
                  className="h-11 flex-1 bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Suppression…" : "Supprimer définitivement"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mx-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
  badge,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          value ? "bg-[#FF6B35]" : "bg-slate-300"
        } ${disabled ? "cursor-not-allowed" : ""}`}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            value ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="mb-2 text-sm font-semibold text-slate-900">{label}</div>
      <div className="flex rounded-xl bg-slate-100 p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              value === opt.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
