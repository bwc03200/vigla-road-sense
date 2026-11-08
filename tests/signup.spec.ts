import { test, expect } from "@playwright/test";
import { SHOW_AUTH_SCREEN } from "../src/lib/access-mode";

test.skip(!SHOW_AUTH_SCREEN, "Account screen is preserved but currently disabled for guest access.");

test("signup without a session does not navigate before email confirmation", async ({ page }) => {
  let calls = 0;
  await page.route("**/auth/v1/signup**", async (route) => {
    calls++;
    const payload = route.request().postDataJSON();
    expect(payload.email).toBe("signup-check@example.com");
    expect(payload.password).toBe("Unique-test-passphrase-482!");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "signup-test", aud: "authenticated", email: payload.email, identities: [] }, session: null }) });
  });
  await page.goto("/auth");
  await page.getByRole("button", { name: "Pas encore de compte ? S'inscrire" }).click();
  await page.getByLabel("Email", { exact: true }).fill(" signup-check@example.com ");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Unique-test-passphrase-482!");
  await page.getByRole("button", { name: "S'inscrire", exact: true }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page).toHaveURL(/\/auth$/);
  expect(calls).toBe(1);
});

test("short signup password is rejected before calling auth", async ({ page }) => {
  let calls = 0;
  await page.route("**/auth/v1/signup**", async (route) => { calls++; await route.abort(); });
  await page.goto("/auth");
  await page.getByRole("button", { name: "Pas encore de compte ? S'inscrire" }).click();
  await page.getByLabel("Email", { exact: true }).fill("signup-check@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("123");
  await page.getByRole("button", { name: "S'inscrire", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(calls).toBe(0);
});