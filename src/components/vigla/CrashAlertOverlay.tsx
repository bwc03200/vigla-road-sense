import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Phone, Check } from "lucide-react";
import { useVigla } from "@/lib/vigla-store";

const COUNTDOWN_S = 120;

export function CrashAlertOverlay() {
  const { t } = useTranslation();
  const crashState = useVigla((s) => s.crashState);
  const setCrashState = useVigla((s) => s.setCrashState);
  const contacts = useVigla((s) => s.emergencyContacts);
  const position = useVigla((s) => s.position);
  const [remaining, setRemaining] = useState(COUNTDOWN_S);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (crashState.status !== "suspected") {
      setRemaining(COUNTDOWN_S);
      setSent(false);
      return;
    }
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [crashState.status]);

  useEffect(() => {
    if (crashState.status !== "suspected") return;
    if (remaining > 0 || sent) return;
    triggerContacts();
    setSent(true);
     
  }, [remaining, crashState.status, sent]);

  function triggerContacts() {
    const lat = position?.lat.toFixed(5);
    const lng = position?.lng.toFixed(5);
    const mapLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : "";
    const msg = t("crash.smsBody", { lat: lat ?? "?", lng: lng ?? "?", link: mapLink });
    for (const c of contacts) {
      if (c.phone) {
        window.open(`sms:${c.phone}?body=${encodeURIComponent(msg)}`, "_blank");
      } else if (c.email) {
        window.open(
          `mailto:${c.email}?subject=${encodeURIComponent(t("crash.emailSubject"))}&body=${encodeURIComponent(msg)}`,
          "_blank",
        );
      }
    }
  }

  if (crashState.status !== "suspected") return null;

  const pct = remaining / COUNTDOWN_S;
  const dash = 2 * Math.PI * 70;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-red-600/95 p-6 text-white backdrop-blur">
      <AlertOctagon className="mb-3 h-12 w-12" />
      <div className="text-lg font-semibold uppercase tracking-widest">{t("crash.title")}</div>
      <div className="mt-1 text-sm text-white/80">
        {sent ? t("crash.sent") : t("crash.confirmOk")}
      </div>

      <div className="relative my-8 h-48 w-48">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.2)" strokeWidth="10" fill="none" />
          <circle
            cx="80" cy="80" r="70" stroke="white" strokeWidth="10" fill="none"
            strokeDasharray={dash}
            strokeDashoffset={dash * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold tabular-nums">{remaining}</div>
          <div className="text-xs uppercase tracking-widest text-white/70">{t("crash.seconds")}</div>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <a
          href="tel:112"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white text-lg font-semibold text-red-600"
        >
          <Phone className="h-5 w-5" /> {t("crash.callEmergency")}
        </a>
        <button
          onClick={() => setCrashState({ status: "idle" })}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/60 text-lg font-semibold text-white"
        >
          <Check className="h-5 w-5" /> {t("crash.imOk")}
        </button>
        {contacts.length === 0 && (
          <p className="text-center text-xs text-white/70">
            {t("crash.noContacts")}
          </p>
        )}
      </div>
    </div>
  );
}
