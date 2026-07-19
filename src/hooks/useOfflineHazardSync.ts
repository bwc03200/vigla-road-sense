import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useVigla } from "@/lib/vigla-store";
import { getQueuedHazardCount, syncQueuedHazards } from "@/lib/offline-hazard-queue";

/**
 * Watches for online-status transitions and drains the offline hazard queue.
 * Also runs a one-shot sync at mount in case a queue survived a page reload.
 */
export function useOfflineHazardSync() {
  const { t } = useTranslation();
  const online = useVigla((s) => s.online);
  const prevOnlineRef = useRef<boolean | null>(null);
  const inFlightRef = useRef(false);

  async function drain() {
    if (inFlightRef.current) return;
    if (getQueuedHazardCount() === 0) return;
    inFlightRef.current = true;
    try {
      const count = await syncQueuedHazards();
      if (count > 0) {
        toast.success(t("hazard.report.synced", { count }));
      }
    } finally {
      inFlightRef.current = false;
    }
  }

  // Mount: try once (covers reloads while online with a leftover queue).
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void drain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transition offline → online: drain.
  useEffect(() => {
    const prev = prevOnlineRef.current;
    prevOnlineRef.current = online;
    if (prev === false && online === true) {
      void drain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);
}
