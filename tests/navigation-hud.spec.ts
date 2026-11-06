import { test, expect } from "@playwright/test";
import { isVigilanceInRange, vigilanceProgress, VIGILANCE_DURATION_MS } from "../src/lib/navigation-hud";

test("radar vigilance is strictly below 300 metres", () => {
  expect(isVigilanceInRange("radar", 299)).toBe(true);
  expect(isVigilanceInRange("radar", 300)).toBe(false);
});
test("hazard vigilance is strictly below 500 metres", () => {
  expect(isVigilanceInRange("hazard", 499)).toBe(true);
  expect(isVigilanceInRange("hazard", 500)).toBe(false);
  expect(isVigilanceInRange("signal", 100)).toBe(false);
});
test("vigilance dismisses after ten seconds", () => {
  expect(VIGILANCE_DURATION_MS).toBe(10_000);
});
test("vigilance progress is distance divided by the kind's maximum", () => {
  expect(vigilanceProgress(150, "radar")).toBe(50);
  expect(vigilanceProgress(125, "hazard")).toBe(25);
  expect(vigilanceProgress(600, "hazard")).toBe(100);
});