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

test.describe("Authorization & security pass (unauthenticated, post-Batch-1)", () => {
  test("deals:list returns NOTHING to anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/query`, {
      data: { path: "deals:list", args: {}, format: "json" },
    });
    const body = await res.json();
    const deals = body.value ?? body;
    expect(Array.isArray(deals) ? deals.length : -1).toBe(0);
  });

  test("deals:get returns null to anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/query`, {
      data: { path: "deals:get", args: { dealId: "anything" }, format: "json" },
    });
    const body = await res.json();
    expect(body.value ?? null).toBeNull();
  });

  test("appendEvent rejects anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/mutation`, {
      data: {
        path: "deals:appendEvent",
        args: { dealId: "x", actor: "seller_agent", type: "offer", payload: { price: 1, delivery_days: 1, revisions: 0, deposit_pct: 0, message: "x" } },
        format: "json",
      },
    });
    expect(JSON.stringify(await res.json())).toMatch(/not authenticated/i);
  });

  test("confirmTentativeAgreement rejects anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/mutation`, {
      data: { path: "deals:confirmTentativeAgreement", args: { dealId: "x" }, format: "json" },
    });
    expect(JSON.stringify(await res.json())).toMatch(/not authenticated/i);
  });

  test("reserveInvoicePending rejects anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/mutation`, {
      data: { path: "deals:reserveInvoicePending", args: { dealId: "x", contractHash: "y" }, format: "json" },
    });
    expect(JSON.stringify(await res.json())).toMatch(/not authenticated/i);
  });

  test("updateDeal rejects anonymous callers", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/mutation`, {
      data: { path: "deals:updateDeal", args: { dealId: "x", patch: { status: "paid" } }, format: "json" },
    });
    expect(JSON.stringify(await res.json())).toMatch(/not authenticated/i);
  });

  test("API routes all reject anonymous callers with 401", async () => {
    const req = await pwRequest.newContext();
    const turn = await req.post(`${BASE}/api/deals/x/turn`, { data: {} });
    const settle = await req.post(`${BASE}/api/deals/x/settle`, { data: { action: "invoice" } });
    const deal = await req.get(`${BASE}/api/deals/x`);
    expect([turn.status(), settle.status(), deal.status()]).toEqual([401, 401, 401]);
  });

  test("invite-token lookup stays public but exposes no mandates", async () => {
    const req = await pwRequest.newContext();
    const res = await req.post(`${CONVEX_URL}/api/query`, {
      data: { path: "deals:getByInviteToken", args: { token: "nonexistent" }, format: "json" },
    });
    const body = await res.json();
    // null for a bad token; and the shape can never include mandate fields
    expect(body.value ?? null).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/Mandate/);
  });
});
