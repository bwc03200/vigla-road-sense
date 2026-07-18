import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BIPEvent | null = null;
const listeners = new Set<(e: BIPEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    listeners.forEach((l) => l(deferredPrompt));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l(null));
  });
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BIPEvent | null>(deferredPrompt);
  useEffect(() => {
    const l = (e: BIPEvent | null) => setPrompt(e);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return prompt;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari legacy
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Discrete banner shown on map when installable and user hasn't dismissed it. */
export function InstallBanner() {
  const { t } = useTranslation();
  const prompt = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    const stored = window.localStorage.getItem("vigla:install:dismissed");
    if (stored === "1") return;
    // Show after brief delay so it doesn't compete with GPS overlay
    const timer = window.setTimeout(() => setDismissed(false), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  if (dismissed || isStandalone()) return null;
  if (!prompt && !isIOS()) return null;

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vigla:install:dismissed", "1");
    }
  }

  async function install() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      deferredPrompt = null;
      dismiss();
    } else if (isIOS()) {
      setIosHint(true);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[650] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{t("pwa.installTitle")}</div>
          <div className="truncate text-xs text-slate-500">{t("pwa.installSubtitle")}</div>
        </div>
        <Button size="sm" onClick={install} className="h-9">
          {t("pwa.installCta")}
        </Button>
        <button
          onClick={dismiss}
          aria-label={t("common.close", { defaultValue: "Fermer" })}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {iosHint && (
        <div className="pointer-events-auto absolute inset-x-4 bottom-24 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <Share className="h-4 w-4" /> {t("pwa.iosTitle")}
          </div>
          <p>{t("pwa.iosSteps")}</p>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setIosHint(false)}>
            OK
          </Button>
        </div>
      )}
    </div>
  );
}

/** Row inside Settings to trigger install (or explain iOS flow). */
export function InstallSettingsRow() {
  const { t } = useTranslation();
  const prompt = useInstallPrompt();
  const [showIos, setShowIos] = useState(false);
  const installed = isStandalone();

  if (installed) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {t("pwa.installed")}
      </div>
    );
  }

  async function onClick() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      deferredPrompt = null;
    } else if (isIOS()) {
      setShowIos(true);
    } else {
      setShowIos(true);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full justify-start" onClick={onClick}>
        <Download className="mr-2 h-4 w-4" />
        {t("pwa.installAction")}
      </Button>
      {showIos && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="mb-1 flex items-center gap-1 font-medium text-slate-800">
            <Share className="h-3.5 w-3.5" /> {t("pwa.iosTitle")}
          </div>
          {t("pwa.iosSteps")}
        </div>
      )}
    </div>
  );
}
