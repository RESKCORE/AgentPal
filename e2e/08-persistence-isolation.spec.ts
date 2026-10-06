import { test, expect } from "@playwright/test";

async function guestSignIn(page: import("@playwright/test").Page) {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const btn = page.getByRole("button", { name: /continue as guest/i });
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 });
  }
}

test.describe("Server-side persistence and participant isolation", () => {
  test("created deal persists across reloads and is invisible to a stranger session", async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await guestSignIn(page1);

    // Create a fresh deal
    await page1.goto("/deals/new", { waitUntil: "domcontentloaded" });
    await page1.waitForTimeout(1000);
    await page1.locator("#deal-title").fill("Persistence QA Deal");
    const createBtn = page1.getByRole("button", { name: /create deal & generate invite/i });
    await createBtn.click();
    await page1.waitForTimeout(3000);
    const dealId = await page1.evaluate(() => {
      const key = Object.keys(window.localStorage).find((k) => k.startsWith("agentpal_role_"));
      return key ? key.replace("agentpal_role_", "") : "";
    });
    expect(dealId.length).toBeGreaterThan(3);
    const dealUrl = `${new URL(page1.url()).origin}/deals/${dealId}`;

    // Go to the deal room, then reload: state must come from the server
    await page1.goto(dealUrl, { waitUntil: "domcontentloaded" });
    await page1.reload({ waitUntil: "domcontentloaded" });
    await page1.waitForTimeout(2500);
    await expect(page1.getByRole("heading", { name: /deal room: persistence qa deal/i })).toBeVisible({
      timeout: 15000,
    });

    // Second, independent session (different anonymous user) cannot read the deal
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await guestSignIn(page2);
    await page2.goto(dealUrl, { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(2500);
    const body2 = await page2.textContent("body");
    expect(body2).toMatch(/Deal Room Not Found|not authenticated|sign in/i);

    await ctx1.close();
    await ctx2.close();
  });
});
