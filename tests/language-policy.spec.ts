import { test, expect } from "@playwright/test";
import { initialLanguage, LANGUAGE_POLICY_VERSION } from "../src/i18n/language-policy";

test("old automatically saved Dutch is reset to French", () => {
  expect(initialLanguage("nl", null)).toBe("fr");
});
test("a fresh install defaults to French", () => {
  expect(initialLanguage(null, null)).toBe("fr");
});
test("unsupported saved languages fall back to French", () => {
  expect(initialLanguage("de", LANGUAGE_POLICY_VERSION)).toBe("fr");
});
test("subsequent explicit language choices are preserved", () => {
  expect(initialLanguage("nl", LANGUAGE_POLICY_VERSION)).toBe("nl");
});