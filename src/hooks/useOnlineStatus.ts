import { useEffect } from "react";
import { useVigla } from "@/lib/vigla-store";

/**
 * Tracks navigator.onLine and wires online/offline events into the store.
 * Should be mounted once at the app root.
 */
export function useOnlineStatus() {
  const setOnline = useVigla((s) => s.setOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOnline]);
}
