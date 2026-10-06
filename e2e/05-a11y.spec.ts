import { test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "fs";
import path from "path";

// Post-Batch-1: unauthenticated visitors only ever see these pages.
// Authenticated-route a11y requires an interactive OAuth session (see UNTESTED list).
const ROUTES = [
  "/sign-in",
  "/deals/x/join?token=bogus-token",
  "/nonexistent-qa-route",
];

const OUT = path.resolve(process.cwd(), "docs/qa-axe.json");

const results: Record<string, { violations: number; details: unknown[] }> = {};

test.describe("axe accessibility", () => {
  for (const route of ROUTES) {
    test(`axe: ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const axe = await new AxeBuilder({ page }).analyze();
      results[route] = {
        violations: axe.violations.length,
        details: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          summary: v.help,
        })),
      };
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
      console.log(`axe ${route}: ${axe.violations.length} violations`);
    });
  }
});
