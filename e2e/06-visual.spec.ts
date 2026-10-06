import { test } from "@playwright/test";
import fs from "fs";
import path from "path";

const ROUTES: [string, string][] = [
  ["sign-in", "/sign-in"],
  ["join-invalid", "/deals/x/join?token=bogus"],
  ["dashboard-redirect", "/"],
  ["deals-new-redirect", "/deals/new"],
  ["deal-room-redirect", "/deals/deal-test-id"],
];

const VIEWPORTS: [string, { width: number; height: number }][] = [
  ["1440x900", { width: 1440, height: 900 }],
  ["1024x768", { width: 1024, height: 768 }],
  ["768x1024", { width: 768, height: 1024 }],
  ["390x844", { width: 390, height: 844 }],
];

const DIR = path.resolve(process.cwd(), "docs/qa-screenshots");

test.describe("visual sweep", () => {
  test.beforeAll(() => fs.mkdirSync(DIR, { recursive: true }));

  for (const [name, route] of ROUTES) {
    for (const [vpName, viewport] of VIEWPORTS) {
      test(`${name} @ ${vpName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2800);
        await page.screenshot({
          path: path.join(DIR, `${name}-${vpName}.png`),
          fullPage: true,
        });
        const overflowX = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        if (overflowX) console.log(`H-OVERFLOW: ${name} @ ${vpName} scrolls horizontally`);
      });
    }
  }
});
