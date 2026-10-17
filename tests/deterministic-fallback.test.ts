import { describe, it, expect } from "vitest";
import { getDeterministicFallback } from "../lib/openrouter";
import { SettlementKernel } from "../lib/settlement-kernel";
import type { Mandate } from "../lib/types";

describe("Deterministic Fallback Policy", () => {
  const buyerMandate: Mandate = {
    role: "buyer",
    price_min: 300,
    price_max: 500,
    delivery_days_min: 3,
    delivery_days_max: 7,
    revisions_min: 1,
    revisions_max: 3,
    deposit_pct_min: 15,
    deposit_pct_max: 30,
  };

  const sellerMandate: Mandate = {
    role: "seller",
    price_min: 250,
    price_max: 400,
    delivery_days_min: 4,
    delivery_days_max: 8,
    revisions_min: 1,
    revisions_max: 2,
    deposit_pct_min: 20,
    deposit_pct_max: 40,
  };

  it("never proposes price 270 when buyer mandate min is 300", () => {
    const turn = getDeterministicFallback({
      role: "buyer",
      agentName: "Buyer Agent",
      clientName: "Buyer",
      mandate: buyerMandate,
      dealTitle: "Mobile App Prototype",
      dealDescription: "Prototype build",
      history: [],
    });

    expect(turn.action).toBe("offer");
    expect(turn.price).toBeGreaterThanOrEqual(buyerMandate.price_min);
    expect(turn.price).toBeLessThanOrEqual(buyerMandate.price_max);

    // Verify SettlementKernel accepts it
    const check = SettlementKernel.validateOffer(turn, buyerMandate);
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });

  it("never violates seller mandate bounds on opening or concessions", () => {
    const opening = getDeterministicFallback({
      role: "seller",
      agentName: "Seller Agent",
      clientName: "Seller",
      mandate: sellerMandate,
      dealTitle: "Mobile App Prototype",
      dealDescription: "Prototype build",
      history: [],
    });

    expect(opening.price).toBeGreaterThanOrEqual(sellerMandate.price_min);
    expect(opening.price).toBeLessThanOrEqual(sellerMandate.price_max);
    expect(SettlementKernel.validateOffer(opening, sellerMandate).valid).toBe(true);

    const concession = getDeterministicFallback({
      role: "seller",
      agentName: "Seller Agent",
      clientName: "Seller",
      mandate: sellerMandate,
      dealTitle: "Mobile App Prototype",
      dealDescription: "Prototype build",
      history: [{ actor: "buyer_agent", type: "offer", price: 300 }],
      standingOffer: { price: 300, delivery_days: 5, revisions: 2, deposit_pct: 25, message: "buyer offer" },
    });

    expect(concession.price).toBeGreaterThanOrEqual(sellerMandate.price_min);
    expect(concession.price).toBeLessThanOrEqual(sellerMandate.price_max);
    expect(SettlementKernel.validateOffer(concession, sellerMandate).valid).toBe(true);
  });

  it("includes all terms when accepting a standing offer", () => {
    const standing = {
      price: 320,
      delivery_days: 5,
      revisions: 2,
      deposit_pct: 25,
      message: "Proposing $320",
    };

    const turn = getDeterministicFallback({
      role: "buyer",
      agentName: "Buyer Agent",
      clientName: "Buyer",
      mandate: buyerMandate,
      dealTitle: "Mobile App Prototype",
      dealDescription: "Prototype build",
      history: [
        { actor: "seller_agent", type: "offer", price: 350 },
        { actor: "buyer_agent", type: "offer", price: 310 },
        { actor: "seller_agent", type: "offer", price: 320 },
      ],
      standingOffer: standing,
    });

    expect(turn.action).toBe("accept");
    expect(turn.price).toBe(320);
    expect(turn.delivery_days).toBe(5);
    expect(turn.revisions).toBe(2);
    expect(turn.deposit_pct).toBe(25);
  });

  it("guarantees valid offers across diverse mandate ranges", () => {
    const ranges = [
      { min: 50, max: 100 },
      { min: 1000, max: 2500 },
      { min: 15, max: 25 },
      { min: 300, max: 300 }, // zero-spread corner case
    ];

    for (const r of ranges) {
      const customMandate: Mandate = {
        role: "buyer",
        price_min: r.min,
        price_max: r.max,
        delivery_days_min: 2,
        delivery_days_max: 10,
        revisions_min: 0,
        revisions_max: 5,
        deposit_pct_min: 10,
        deposit_pct_max: 50,
      };

      const result = getDeterministicFallback({
        role: "buyer",
        agentName: "Buyer Agent",
        clientName: "Buyer",
        mandate: customMandate,
        dealTitle: "Custom range test",
        dealDescription: "Test",
        history: [],
      });

      const check = SettlementKernel.validateOffer(result, customMandate);
      expect(check.valid).toBe(true);
      expect(result.price).toBeGreaterThanOrEqual(r.min);
      expect(result.price).toBeLessThanOrEqual(r.max);
    }
  });
});
