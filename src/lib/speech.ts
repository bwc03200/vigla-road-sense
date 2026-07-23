// Web Speech API wrapper with priority queue and silent fallback.
import { currentLang } from "@/i18n/i18n";

export type SpeechPriority = "low" | "high";

interface Item {
  text: string;
  priority: SpeechPriority;
  lang: string;
}

let queue: Item[] = [];
let speaking = false;

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

function langCode(): string {
  return currentLang() === "en" ? "en-US" : "fr-FR";
}

function playNext() {
  if (!supported()) return;
  const item = queue.shift();
  if (!item) {
    speaking = false;
    return;
  }
  speaking = true;
  try {
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang;
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;
    u.onend = () => playNext();
    u.onerror = () => playNext();
    window.speechSynthesis.speak(u);
  } catch {
    speaking = false;
  }
}

/**
 * Speak `text`. `high` priority cancels any ongoing/queued speech
 * (e.g. imminent maneuver overrides a distant hazard). `low` queues.
 * No-op when Web Speech API is unavailable.
 */
export function speak(text: string, priority: SpeechPriority = "low"): void {
  if (!supported() || !text) return;
  const item: Item = { text, priority, lang: langCode() };
  if (priority === "high") {
    queue = [item];
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    speaking = false;
    playNext();
    return;
  }
  queue.push(item);
  if (!speaking) playNext();
}

export function cancelSpeech(): void {
  if (!supported()) return;
  queue = [];
  speaking = false;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function isSpeechSupported(): boolean {
  return supported();
}
