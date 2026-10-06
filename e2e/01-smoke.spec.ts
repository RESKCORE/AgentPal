import { test, expect } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/",
  "/deals/new",
  "/deals/deal-test-id",
  "/deals/deal-test-id/reveal",
  "/transactions",
  "/notifications",
  "/settings",
];

const PUBLIC_ROUTES = ["/sign-in", "/deals/anything/join?token=bogus-token-qa"];

const consoleLog: { route: string; type: string; text: string }[] = [];

test.describe("Route smoke + auth redirects", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated ${route} redirects to /sign-in`, async ({ page }) => {
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleLog.push({ route, type: "console.error", text: msg.text() });
      });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/sign-in/, { timeout: 20000 });
      expect(page.url()).toContain("/sign-in");
    });
  }

  for (const route of PUBLIC_ROUTES) {
    test(`public ${route} serves 200`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(resp?.status()).toBe(200);
      await page.waitForTimeout(2000);
      expect(errors).toEqual([]);
    });
  }

  test("unknown route redirects to /sign-in when unauthenticated", async ({ page }) => {
    // Middleware runs before routing: unauthenticated hits on any path go to
    // sign-in first. (404 after sign-in requires a live session — see UNTESTED.)
    await page.goto("/nonexistent-qa-route", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/sign-in/, { timeout: 20000 });
    expect(page.url()).toContain("/sign-in");
  });

  test.afterAll(async () => {
    if (consoleLog.length) {
      console.log("CONSOLE ERRORS BY ROUTE:");
      for (const e of consoleLog) console.log(`  [${e.route}] ${e.text.slice(0, 300)}`);
    }
  });
});
