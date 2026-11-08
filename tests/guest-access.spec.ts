import { test, expect } from "@playwright/test";
import { SHOW_AUTH_SCREEN, GUEST_USER_ID, isGuestUser, readGuestData, writeGuestData } from "../src/lib/access-mode";

test("startup does not require the account screen", () => {
  expect(SHOW_AUTH_SCREEN).toBe(false);
});

test("guest identity is distinct from an authenticated user", () => {
  expect(isGuestUser(GUEST_USER_ID)).toBe(true);
  expect(isGuestUser("a-real-account-id")).toBe(false);
});

test("guest reports and history persist locally without overwriting account data", () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    values.set("vigla:trips:account-id", "preserved");
    writeGuestData("hazards", [{ type: "travaux", latitude: 46.56, longitude: 3.33 }]);
    writeGuestData("saved-trips", [{ end_name: "Moulins", distance_m: 10000 }]);
    expect(readGuestData("hazards", [])).toEqual([{ type: "travaux", latitude: 46.56, longitude: 3.33 }]);
    expect(readGuestData("saved-trips", [])).toEqual([{ end_name: "Moulins", distance_m: 10000 }]);
    expect(values.get("vigla:trips:account-id")).toBe("preserved");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});