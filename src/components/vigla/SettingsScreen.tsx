import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useVigla } from "@/lib/vigla-store";
import { savePreferences } from "@/hooks/usePreferences";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { setLanguage, currentLang, type Lang } from "@/i18n/i18n";
import type { AlertLeadTime, UserPreferences } from "@/types/vigla";

interface Props {
  userId: string;
  email: string;
  onBack: () => void;
}

export function SettingsScreen({ userId, email, onBack }: Props) {
  const { t, i18n } = useTranslation();
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
      toast.success(t("settings.deleted"));
      await supabase.auth.signOut();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.unknownError");
      toast.error(t("settings.deleteFailed", { msg }));
      setDeleting(false);
      setConfirmDelete(0);
    }
  }

  const lang = currentLang();

  return (
    <div className="h-full overflow-y-auto bg-slate-50 pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
          aria-label={t("common.back")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-900">{t("settings.title")}</h1>
      </div>

      <Section title={t("settings.sectionDisplay")}>
        <SegmentedRow
          label={t("settings.language")}
          value={lang}
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
          ]}
          onChange={(v) => {
            setLanguage(v as Lang);
            // trigger a light re-render for consumers using currentLang() only
            i18n.emit("languageChanged", v);
          }}
        />
        <SegmentedRow
          label={t("settings.speedUnit")}
          value={prefs.speed_unit}
          options={[
            { value: "kmh", label: "km/h" },
            { value: "mph", label: "mph" },
          ]}
          onChange={(v) => update("speed_unit", v as "kmh" | "mph")}
        />
        <SegmentedRow
          label={t("settings.mapTheme")}
          value={prefs.map_theme}
          options={[
            { value: "light", label: t("settings.themeLight") },
            { value: "dark", label: t("settings.themeDark") },
          ]}
          onChange={(v) => update("map_theme", v as "light" | "dark")}
        />
        <ToggleRow
          label={t("settings.autoRecenter")}
          description={t("settings.autoRecenterDesc")}
          value={prefs.auto_recenter}
          onChange={(v) => update("auto_recenter", v)}
        />
      </Section>

      <Section title={t("settings.sectionAlerts")}>
        <ToggleRow
          label={t("settings.voiceAlerts")}
          description={t("settings.voiceAlertsDesc")}
          value={prefs.voice_alerts}
          onChange={(v) => update("voice_alerts", v)}
          disabled
          badge={t("settings.comingSoon")}
        />
        <ToggleRow
          label={t("settings.soundAlerts")}
          description={t("settings.soundAlertsDesc")}
          value={prefs.sound_alerts}
          onChange={(v) => update("sound_alerts", v)}
        />
        <ToggleRow
          label={t("settings.vibration")}
          description={t("settings.vibrationDesc")}
          value={prefs.vibration_alerts}
          onChange={(v) => update("vibration_alerts", v)}
        />
        <SegmentedRow
          label={t("settings.leadTime")}
          value={prefs.alert_lead_time}
          options={[
            { value: "short", label: t("settings.leadShort") },
            { value: "normal", label: t("settings.leadNormal") },
            { value: "long", label: t("settings.leadLong") },
          ]}
          onChange={(v) => update("alert_lead_time", v as AlertLeadTime)}
        />
        <ToggleRow
          label={t("settings.motoMode")}
          description={t("settings.motoModeDesc")}
          value={prefs.moto_mode}
          onChange={(v) => update("moto_mode", v)}
          disabled
          badge={t("settings.comingSoon")}
        />
      </Section>

      <Section title={t("settings.sectionAccount")}>
        <div className="px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500">{t("settings.email")}</div>
          <div className="mt-1 truncate text-sm font-medium text-slate-900">{email}</div>
        </div>
        <div className="px-4 pb-3">
          <Button
            variant="secondary"
            className="h-11 w-full"
            onClick={async () => { await supabase.auth.signOut(); }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("profile.signOut")}
          </Button>
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="text-xs uppercase tracking-widest text-red-600">{t("settings.dangerZone")}</div>
          {confirmDelete === 0 && (
            <Button
              variant="outline"
              className="mt-2 h-11 w-full border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("settings.deleteAccount")}
            </Button>
          )}
          {confirmDelete === 1 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-600">{t("settings.deleteConfirm1")}</p>
              <div className="flex gap-2">
                <Button variant="ghost" className="h-11 flex-1" onClick={() => setConfirmDelete(0)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  className="h-11 flex-1 bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDelete}
                >
                  {t("settings.deleteYes")}
                </Button>
              </div>
            </div>
          )}
          {confirmDelete === 2 && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-red-600">{t("settings.deleteConfirm2")}</p>
              <div className="flex gap-2">
                <Button variant="ghost" className="h-11 flex-1" onClick={() => setConfirmDelete(0)} disabled={deleting}>
                  {t("common.cancel")}
                </Button>
                <Button
                  className="h-11 flex-1 bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t("settings.deleting") : t("settings.deleteFinal")}
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
  label, description, value, onChange, disabled, badge,
}: {
  label: string; description?: string; value: boolean;
  onChange: (v: boolean) => void; disabled?: boolean; badge?: string;
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
  label, value, options, onChange,
}: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
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
