// Keep the account screens available for a later reactivation.
export const SHOW_AUTH_SCREEN = false;
export const GUEST_USER_ID = "guest-local";
export const isGuestUser = (userId: string | null | undefined) => userId === GUEST_USER_ID;

export function readGuestData<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(`vigla:guest:${key}`) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeGuestData<T>(key: string, value: T): void {
  localStorage.setItem(`vigla:guest:${key}`, JSON.stringify(value));
}