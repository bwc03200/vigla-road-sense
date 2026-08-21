import { useEffect, useRef } from "react";
import type L from "leaflet";

/**
 * Heading lock — rotates the Leaflet map panes so the direction of travel
 * points up.
 *
 * - Listens to the GPS heading (0–360°)
 * - Smooths the rotation (eased over ~2.5 s, jitter-filtered)
 * - Freezes on the last known bearing when the GPS heading is lost
 * - Rotates map panes only, so markers/HUD containers can be kept upright
 */
export function useHeadingLock(
  map: L.Map | null,
  heading: number | null | undefined,
  enabled = true,
) {
  const targetRef = useRef(0);
  const lastTargetAtRef = useRef(0);

  // Track the desired bearing (freeze on last known value when GPS drops).
  useEffect(() => {
    if (!enabled) return;
    if (heading == null || !Number.isFinite(heading)) return;
    const now = Date.now();
    const delta = Math.abs(((heading - targetRef.current + 540) % 360) - 180);
    if (now - lastTargetAtRef.current < 200 && delta < 15) return;
    lastTargetAtRef.current = now;
    targetRef.current = heading;
    console.log(
      `🧭 [NAV HEADING] Bearing: ${Math.round(heading)}° • Rotation applied`,
    );
  }, [heading, enabled]);

  useEffect(() => {
    if (!map || !enabled) return;
    const controller = new AbortController();
    const el = map.getContainer();
    const panes = () =>
      [
        map.getPane("tilePane"),
        map.getPane("overlayPane"),
        map.getPane("shadowPane"),
        map.getPane("markerPane"),
        map.getPane("popupPane"),
      ].filter(Boolean) as HTMLElement[];

    let current = 0;
    let from = 0;
    let to = 0;
    let startedAt = performance.now();
    let raf = 0;
    const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const frame = (now: number) => {
      if (controller.signal.aborted) return;
      const target = targetRef.current;
      if (target !== to) {
        from = current;
        to = target;
        startedAt = now;
      }
      const p = Math.min(1, (now - startedAt) / 2500);
      const diff = ((to - from + 540) % 360) - 180;
      current = from + diff * easeInOutQuad(p);
      const rot = -current;
      const origin = map.latLngToLayerPoint(map.getCenter());
      for (const pane of panes()) {
        pane.style.transformOrigin = `${origin.x}px ${origin.y}px`;
        pane.style.transform = `rotate(${rot.toFixed(2)}deg)`;
      }
      el.style.setProperty("--vigla-map-rot", `${rot.toFixed(2)}deg`);
      raf = requestAnimationFrame(frame);
    };

    el.classList.add("vigla-heading-lock");
    raf = requestAnimationFrame(frame);

    controller.signal.addEventListener("abort", () => {
      cancelAnimationFrame(raf);
      el.classList.remove("vigla-heading-lock");
      for (const pane of panes()) {
        pane.style.transform = "";
        pane.style.transformOrigin = "";
      }
      el.style.removeProperty("--vigla-map-rot");
    });

    return () => controller.abort();
  }, [map, enabled]);
}
