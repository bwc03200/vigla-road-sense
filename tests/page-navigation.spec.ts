import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page, context }) => {
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  test.skip(!key || !session, "Requires the requesting user's managed preview session");
  if (!key || !session) return;
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 46.565, longitude: 3.333 });
  await page.goto("/");
  await page.evaluate(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.setItem("vigla:demoAlertSeen", "1");
  }, [key, session]);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Carte", exact: true })).toBeVisible();
});

test("Retour from history opens the map without remounting it", async ({ page }) => {
  await page.locator(".leaflet-container").evaluate((element) => element.setAttribute("data-navigation-instance", "preserved"));
  await page.getByRole("button", { name: "Historique", exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeHidden();
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toHaveAttribute("data-navigation-instance", "preserved");
});

test("the Carte tab exits settings", async ({ page }) => {
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page.getByRole("button", { name: "Voir les paramètres", exact: true }).click();
  await page.getByRole("button", { name: "Carte", exact: true }).click();
  await expect(page.locator(".vigla-page-content")).toHaveCount(0);
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("the seventh control toggles foot mode and returns to the map", async ({ page }) => {
  await page.getByRole("button", { name: "Historique", exact: true }).click();
  const foot = page.getByRole("button", { name: "Piéton", exact: true });
  const wasPressed = await foot.getAttribute("aria-pressed");
  await foot.click();
  await expect(foot).toHaveAttribute("aria-pressed", wasPressed === "true" ? "false" : "true");
  await expect(page.locator(".leaflet-container")).toBeVisible();
});