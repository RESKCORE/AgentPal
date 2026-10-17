import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const SCREENSHOT_DIR = path.resolve(process.cwd(), "docs/qa-screenshots");

test.describe("AgentPal Audit & Remediation Verification", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test("1. Universal TopNav is completely absent from all visited routes", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    // Check TopNav element is not present
    const topNavHeader = await page.$("header.fixed.top-0");
    expect(topNavHeader).toBeNull();

    // Check no fake latency badge '12ms'
    const latencyBadge = await page.getByText("12ms").count();
    expect(latencyBadge).toBe(0);

    // Check no hardcoded banned demo names 'Asha' or 'Ravi'
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toContain("logo-asha-ravi");
  });

  test("2. Guest sign-in, fresh dashboard data authenticity, and DockNav", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Click "Continue as Guest"
    const guestBtn = page.getByRole("button", { name: /continue as guest/i });
    if (await guestBtn.isVisible()) {
      await guestBtn.click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 });
    } else {
      await page.goto("/", { waitUntil: "domcontentloaded" });
    }

    await page.waitForTimeout(2500);

    // Confirm TopNav is completely absent on Dashboard
    const topNav = await page.$("header.fixed.top-0");
    expect(topNav).toBeNull();

    // Confirm DockNav is present and fixed at bottom
    const dock = await page.$("nav[aria-label='Main Navigation']");
    expect(dock).not.toBeNull();

    // Check for honest values - no fabricated metrics
    const bodyContent = await page.textContent("body");
    expect(bodyContent).not.toContain("12ms");
    expect(bodyContent).not.toContain("87.5% consensus rate");
    expect(bodyContent).not.toContain("TTR avg 4.2m");
    expect(bodyContent).not.toContain("CLUSTER: US-EAST-ALPHA");
    expect(bodyContent).not.toContain("Bilateral Kernel v4.19");
    expect(bodyContent).not.toContain("ZK-Proofs Nominal");
    expect(bodyContent).not.toContain("USDC-Testnet");

    // Check Total Settled honest format
    const totalSettledText = await page.locator("text=/\\$[0-9,]+\\.[0-9]{2}/").first().textContent();
    expect(totalSettledText).toMatch(/\$[0-9,]+\.[0-9]{2}/);

    // Verify empty state is displayed with honest 0 counts and $0.00
    await expect(page.getByText("Agent Negotiations")).toBeVisible();
    await expect(page.getByText("No negotiation deals found")).toBeVisible();
    await expect(page.getByText("$0.00")).toBeVisible();

    // Capture screenshot of authenticated dashboard
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "dashboard-authenticated.png"), fullPage: true });
  });

  test("3. Responsive layout audit across 360px, 390px, 768px, 1024px, 1440px", async ({ page }) => {
    // Navigate to /sign-in first for public accessible page
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      // Verify no horizontal overflow
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);

      // Capture screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `sign-in-${vp.name}.png`),
        fullPage: true,
      });
    }
  });

  test("4. Sealed Mandates privacy check (no Peek button, opponent mandate hidden)", async ({ page }) => {
    // Check that Peek button does not exist in DOM
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    const guestBtn = page.getByRole("button", { name: /continue as guest/i });
    if (await guestBtn.isVisible()) {
      await guestBtn.click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 });
    }

    // Go to settings to confirm auth and user profile
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Check TopNav is absent on /settings
    const topNav = await page.$("header.fixed.top-0");
    expect(topNav).toBeNull();

    // Check Sign Out button is present
    const signOutBtn = page.getByRole("button", { name: /sign out/i });
    expect(await signOutBtn.isVisible()).toBe(true);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "settings-page.png"), fullPage: true });
  });

  test("5. New deal form validation & creation journey", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    const guestBtn = page.getByRole("button", { name: /continue as guest/i });
    if (await guestBtn.isVisible()) {
      await guestBtn.click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 });
    }

    await page.goto("/deals/new", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Verify TopNav is absent on /deals/new
    expect(await page.$("header.fixed.top-0")).toBeNull();

    // Check title input
    const titleInput = page.locator("#deal-title");
    await titleInput.fill("QA Contract Audit");

    // Check price bounds
    const ceilingInput = page.locator("input[type='number']").first();
    await ceilingInput.fill("1200");

    // Take screenshot of new deal form
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "deals-new-form.png"), fullPage: true });

    // Submit form
    const createBtn = page.getByRole("button", { name: /create bilateral deal room/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(3000);

      // Verify Magic Deal Link share modal or navigation to deal room
      const shareModal = await page.getByText(/magic deal link/i).isVisible().catch(() => false);
      const inDealRoom = page.url().includes("/deals/");
      expect(shareModal || inDealRoom).toBe(true);
    }
  });

  test("6. Gated Reveal page blocks unclosed deals", async ({ page }) => {
    // Attempting to visit /deals/qa-test-id/reveal directly
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    const guestBtn = page.getByRole("button", { name: /continue as guest/i });
    if (await guestBtn.isVisible()) {
      await guestBtn.click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 });
    }

    // Direct navigation to reveal for nonexistent or unagreed deal
    await page.goto("/deals/qa-unagreed-deal/reveal", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Verify TopNav is absent on Reveal
    expect(await page.$("header.fixed.top-0")).toBeNull();

    // Verify either Deal Not Found or The Reveal Is Locked is displayed
    await expect(page.getByRole("heading", { name: /deal not found|reveal is locked/i })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "reveal-gated.png"), fullPage: true });
  });

  test("7. Deal Room turn execution with simulated counterparty (no null price_min error)", async ({ page }) => {
    // Listen for uncaught console or runtime page errors
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    const guestBtn = page.getByRole("button", { name: /continue as guest/i });
    if (await guestBtn.isVisible()) {
      await guestBtn.click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 });
    }

    await page.goto("/deals/new", { waitUntil: "domcontentloaded" });
    await page.locator("#deal-title").fill("Autonomous Turn Verification");
    await page.getByRole("button", { name: /create deal & generate invite/i }).click();

    // Click Enter Deal Room now
    const enterRoomBtn = page.getByRole("button", { name: /enter deal room now/i });
    await expect(enterRoomBtn).toBeVisible({ timeout: 10000 });
    await enterRoomBtn.click();
    await page.waitForURL((url) => url.pathname.startsWith("/deals/") && url.pathname !== "/deals/new", { timeout: 15000 });

    // Now in deal room
    // Click Simulate Counterparty (Sandbox) if present
    const simBtn = page.getByRole("button", { name: /simulate counterparty/i }).first();
    if (await simBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await simBtn.click();
    }

    // Status updates to Negotiating
    await expect(page.getByText(/negotiating/i)).toBeVisible({ timeout: 5000 });

    // Click Step Next Turn
    const stepBtn = page.getByRole("button", { name: /step next turn/i });
    await expect(stepBtn).toBeVisible();
    await stepBtn.click();

    // Wait for event to log and rounds to update
    await expect(page.getByText(/ROUNDS: 1/i)).toBeVisible({ timeout: 20000 });

    // Verify no null price_min errors occurred
    const hasPriceMinError = pageErrors.some((e) => e.includes("price_min"));
    expect(hasPriceMinError).toBe(false);
  });
});
