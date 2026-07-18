import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import {
  currentPermission,
  disablePush,
  enablePush,
  isPushEnabled,
  pushBlockedInPreview,
  pushSupported,
} from "@/lib/push-client";

export function PushNotificationsRow({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const supported = pushSupported();
  const preview = pushBlockedInPreview();
  const permission = currentPermission();

  useEffect(() => {
    let mounted = true;
    isPushEnabled().then((v) => {
      if (mounted) {
        setEnabled(v);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const disabled = !supported || preview || permission === "denied" || busy || !ready;

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const res = await enablePush(userId);
        if (res.ok) {
          setEnabled(true);
          toast.success(t("push.enabled"));
        } else {
          if (res.reason === "denied") toast.error(t("push.denied"));
          else if (res.reason === "unsupported") toast.error(t("push.unsupported"));
          else if (res.reason === "preview") toast.error(t("push.previewBlocked"));
          else toast.error(t("push.enableFailed", { msg: res.reason }));
        }
      } else {
        await disablePush(userId);
        setEnabled(false);
        toast(t("push.disabled"));
      }
    } finally {
      setBusy(false);
    }
  }

  let hint: string | null = null;
  if (!supported) hint = t("push.unsupported");
  else if (preview) hint = t("push.previewBlocked");
  else if (permission === "denied") hint = t("push.deniedHint");

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{t("push.title")}</div>
        <p className="mt-0.5 text-xs text-slate-500">{hint ?? t("push.description")}</p>
      </div>
      <button
        disabled={disabled}
        onClick={() => toggle(!enabled)}
        aria-pressed={enabled}
        aria-label={t("push.title")}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          enabled ? "bg-[#FF6B35]" : "bg-slate-300"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            enabled ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
