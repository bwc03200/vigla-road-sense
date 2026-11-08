import { test, expect } from "@playwright/test";
import { isVigilanceInRange, vigilanceProgress, VIGILANCE_DURATION_MS } from "../src/lib/navigation-hud";
import { formatDistance } from "../src/lib/geo";

test("distance to next turn uses lowercase metres with a space, never a lone uppercase M", () => {
  expect(formatDistance(41)).toBe("41 m");
  expect(formatDistance(149)).toBe("149 m");
  expect(formatDistance(41)).not.toMatch(/M/);
});
test("longer distances use kilometres with a space", () => {
  expect(formatDistance(41000)).toBe("41.0 km");
});

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