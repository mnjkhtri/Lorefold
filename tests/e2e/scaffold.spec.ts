import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders current mailing-list activity", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "latest activity" })).toBeVisible();
  await expect(page.locator(".activity-card__title").first()).toBeVisible();
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute("content", /default-src 'self'/u);
});

test("opens and directly reloads a generated thread", async ({ page }) => {
  await page.goto("./");
  await page.locator(".activity-card__title").first().click();
  await expect(page.locator("#thread-title")).toBeVisible();
  await expect(page.locator(".message-article").first()).toBeVisible();
  await page.reload();
  await expect(page.locator("#thread-title")).toBeVisible();
  await expect(page.locator(".message-article").first()).toBeVisible();
});

test("has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".activity-card__title").first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});

test("keeps primary controls keyboard reachable", async ({ page }) => {
  await page.goto("./");
  const search = page.getByRole("searchbox");
  await search.focus();
  await expect(search).toBeFocused();
});

test("stays readable on a narrow dark reduced-motion screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "latest activity" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 15, 20)");
});

test("keeps the document within an Android-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("./");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});
