import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert } from "lucide-react";

const DEMO_ALERT_SEEN_KEY = "vigla:demoAlertSeen";

export function DemoAlertModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(DEMO_ALERT_SEEN_KEY);
      if (!seen) setVisible(true);
    } catch {
      // Fallback: show once per session if localStorage is unavailable.
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DEMO_ALERT_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#e2313f]/30 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
        <div className="bg-gradient-to-r from-[#e2313f] to-[#FF6B35] p-6 text-white">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold">🛡️ Alerte démo</h2>
          </div>
          <p className="text-sm font-medium text-white/90">
            Ceci est une simulation pour te montrer comment VIGLA t'alerte en route.
          </p>
        </div>

        <div className="p-6">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#e2313f]/15 bg-[#e2313f]/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#e2313f]" />
            <p className="text-sm font-semibold leading-relaxed text-slate-900">
              Zone 70 km/h à 500m - Tu roules à 85 km/h - RÉDUIS VITESSE
            </p>
          </div>

          <Button
            onClick={dismiss}
            className="h-12 w-full bg-[#e2313f] text-base font-semibold text-white hover:bg-[#c41d2b]"
          >
            Compris
          </Button>
        </div>
      </div>
    </div>
  );
}
