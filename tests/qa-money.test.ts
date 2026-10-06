import { describe, it, expect } from "vitest";
import { SettlementKernel } from "../lib/settlement-kernel";

// Money & data-integrity probes (Stage 1, STEP 8)
describe("QA money integrity", () => {
  it("deposit cents: 25% of 29,501 cents rounds to the cent (7,375)", () => {
    expect(SettlementKernel.calculateDepositCents(29501, 25)).toBe(7375);
  });

  it("deposit cents: odd percentages never produce fractional cents", () => {
    for (const total of [1, 7, 99, 29501, 99999999]) {
      for (const pct of [1, 3, 7, 25, 33, 50, 99]) {
        const dep = SettlementKernel.calculateDepositCents(total, pct);
        expect(Number.isInteger(dep)).toBe(true);
        expect(dep).toBeGreaterThanOrEqual(0);
        expect(dep).toBeLessThanOrEqual(total);
      }
    }
  });

  it("toCents/centsToDollars round-trip is exact for 2dp values", () => {
    for (const dollars of [0.01, 1.5, 73.75, 295.0, 1234.56]) {
      expect(SettlementKernel.centsToDollars(SettlementKernel.toCents(dollars))).toBeCloseTo(dollars, 10);
    }
  });

  it("contract hash is stable for identical terms+timestamp and differs on tamper", () => {
    const offer = { price: 295, delivery_days: 5, revisions: 2, deposit_pct: 25, message: "m" };
    const ts = "2026-10-04T00:00:00.000Z";
    const h1 = SettlementKernel.hashContract(offer, "deal-x", ts);
    const h2 = SettlementKernel.hashContract(offer, "deal-x", ts);
    const h3 = SettlementKernel.hashContract({ ...offer, price: 296 }, "deal-x", ts);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});
