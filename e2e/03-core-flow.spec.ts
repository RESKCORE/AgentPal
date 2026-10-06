import { test, expect, request as pwRequest } from "@playwright/test";
import fs from "fs";
import path from "path";

function envValue(key: string): string {
  const text = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
  const m = text.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim() : "";
}
const CONVEX_URL = envValue("NEXT_PUBLIC_CONVEX_URL");
const BASE = "http://localhost:3000";

// Batch 1 proof: the authenticated core flow is covered by
// tests/convex-authz.test.ts (create → join → tentative → dual-sign → seal).
// These tests pin that the UNAUTHENTICATED versions of those paths are closed.

test.describe("Auth gates on the core flow (post-Batch-1)", () => {
  test("createDealWithInvite rejects anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/mutation`, {
      data: {
        path: "deals:createDealWithInvite",
        args: {
          title: "anon",
          description: "anon",
          creatorRole: "seller",
          mandate: { role: "seller", price_min: 100, price_max: 200, delivery_days_min: 1, delivery_days_max: 5, revisions_min: 0, revisions_max: 2, deposit_pct_min: 10, deposit_pct_max: 50 },
        },
        format: "json",
      },
    });
    const body = await res.json();
    console.log(`anonymous create: ${JSON.stringify(body).slice(0, 160)}`);
    expect(JSON.stringify(body)).toMatch(/not authenticated/i);
  });

  test("joinViaMagicLink rejects anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/mutation`, {
      data: {
        path: "deals:joinViaMagicLink",
        args: {
          token: "whatever",
          mandate: { role: "buyer", price_min: 100, price_max: 200, delivery_days_min: 1, delivery_days_max: 5, revisions_min: 0, revisions_max: 2, deposit_pct_min: 10, deposit_pct_max: 50 },
        },
        format: "json",
      },
    });
    expect(JSON.stringify(await res.json())).toMatch(/not authenticated/i);
  });

  test("turn endpoint rejects anonymous callers with 401", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${BASE}/api/deals/some-deal/turn`, { data: {} });
    expect(res.status()).toBe(401);
  });

  test("settle endpoint rejects anonymous callers with 401", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${BASE}/api/deals/qa-test-deal/settle`, { data: { action: "invoice" } });
    expect(res.status()).toBe(401);
  });

  test("deal API rejects anonymous callers with 401", async () => {
    const req = await pwRequest.newContext();
    const res = await req.get(`${BASE}/api/deals/qa-test-deal`);
    expect(res.status()).toBe(401);
  });
});
