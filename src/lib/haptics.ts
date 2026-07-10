// Client-side haptic feedback helpers. Silent fallback when Vibration API
// is not supported (iOS Safari) or the user disabled vibrations in settings.

const STORAGE_KEY = "vigla:vibrate";

export function isVibrationSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function getVibrationEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "0";
}

export function setVibrationEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

function vibrate(pattern: number | number[]): void {
  if (!isVibrationSupported() || !getVibrationEnabled()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

/** Very short tap confirmation (buttons, taps). */
export function vibrateTap(): void {
  vibrate(12);
}

/** Send confirmation (convoy actions, form submits). */
export function vibrateConfirm(): void {
  vibrate(20);
}

/** Danger-zone alert — distinct pattern. */
export function vibrateAlert(): void {
  vibrate([100, 50, 100]);
}
