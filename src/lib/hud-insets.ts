import { useEffect, useState, type RefObject } from "react";

/**
 * Lets the panels that dock to the top or bottom of the map tell the rest of
 * the HUD how much room they take, through two CSS variables on the map root:
 *
 *   --vigla-inset-top     distance from the top of the map to the bottom of
 *                         the lowest top-docked panel
 *   --vigla-inset-bottom  distance from the bottom of the map to the top of
 *                         the highest bottom-docked panel
 *
 * Floating controls are then positioned relative to those variables instead
 * of hard-coded offsets, so they cannot end up underneath a panel whose
 * height depends on its content (a two-line instruction, a long destination
 * name, a larger system font…). That guessing is what kept producing
 * overlapping widgets.
 */

type Edge = "top" | "bottom";

const ROOT_SELECTOR = ".vigla-map-root";
const reports = new WeakMap<HTMLElement, Record<Edge, Map<HTMLElement, number>>>();

const listeners = new WeakMap<HTMLElement, Set<() => void>>();

function currentInset(root: HTMLElement, edge: Edge): number {
  const entries = reports.get(root)?.[edge];
  let max = 0;
  if (entries) for (const v of entries.values()) max = Math.max(max, v);
  return Math.round(max);
}

function publish(root: HTMLElement, edge: Edge) {
  const max = currentInset(root, edge);
  // Also on <html>, for what is rendered outside the map root (toasts).
  for (const target of [root, document.documentElement]) {
    if (max > 0) target.style.setProperty(`--vigla-inset-${edge}`, `${max}px`);
    else target.style.removeProperty(`--vigla-inset-${edge}`);
  }
  listeners.get(root)?.forEach((notify) => notify());
}

/**
 * Current insets as numbers, for layout that has to be computed in script
 * (where to put the vehicle on screen). `ref` is any element inside the map
 * root.
 */
export function useHudInsetValues(ref: RefObject<HTMLElement | null>): { top: number; bottom: number } {
  const [values, setValues] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>(ROOT_SELECTOR);
    if (!root) return;
    const read = () =>
      setValues((prev) => {
        const next = { top: currentInset(root, "top"), bottom: currentInset(root, "bottom") };
        return prev.top === next.top && prev.bottom === next.bottom ? prev : next;
      });
    let set = listeners.get(root);
    if (!set) {
      set = new Set();
      listeners.set(root, set);
    }
    set.add(read);
    read();
    return () => {
      set.delete(read);
    };
  }, [ref]);
  return values;
}

/**
 * Reports the space taken by `ref`'s element on one edge of the map for as
 * long as it is mounted. `active = false` withdraws the report (for a panel
 * that stays mounted but is currently not docked).
 */
export function useHudInset(
  ref: RefObject<HTMLElement | null>,
  edge: Edge,
  active = true,
) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof ResizeObserver === "undefined") return;
    const root = el.closest<HTMLElement>(ROOT_SELECTOR);
    if (!root) return;

    let record = reports.get(root);
    if (!record) {
      record = { top: new Map(), bottom: new Map() };
      reports.set(root, record);
    }
    const entries = record[edge];

    const measure = () => {
      const rootBox = root.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      // A hidden map tab reports zero-size boxes: keep the last good value.
      if (rootBox.height === 0 || box.height === 0) return;
      const value =
        edge === "top" ? box.bottom - rootBox.top : rootBox.bottom - box.top;
      entries.set(el, Math.max(0, value));
      publish(root, edge);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      entries.delete(el);
      publish(root, edge);
    };
  }, [ref, edge, active]);
}
