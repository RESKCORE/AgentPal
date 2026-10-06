import { describe, it, expect, beforeEach } from "vitest";
import { DealStore, type DealData } from "../lib/deal-store";

const storageMap: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => storageMap[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMap[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storageMap[key];
  },
  clear: () => {
    for (const k of Object.keys(storageMap)) {
      delete storageMap[k];
    }
  },
  get length() {
    return Object.keys(storageMap).length;
  },
  key: (i: number) => Object.keys(storageMap)[i] ?? null,
};

// Polyfill window and localStorage for Node.js test environment
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

describe("Data Authenticity and Storage Isolation", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("fresh account does NOT auto-seed demo deals (returns empty array)", () => {
    const deals = DealStore.getDeals();
    expect(deals).toEqual([]);
    expect(deals.length).toBe(0);
  });

  it("purges legacy demo records (logo-asha-ravi, landing-page, translation) if present in storage", () => {
    const createStubDeal = (id: string, title: string, status: DealData["status"]): DealData => ({
      id,
      title,
      description: "Test deal description",
      creatorRole: "buyer",
      inviteToken: "token-123",
      status,
      currentRound: 0,
      maxRounds: 5,
      deadline: "2026-12-31",
      createdAt: "2026-10-05T00:00:00.000Z",
      buyer: { id: "b1", name: "Buyer", email: "buyer@test.local", mandateSet: true },
      seller: { id: "s1", name: "Seller", email: "seller@test.local", mandateSet: true },
      buyerMandate: { role: "buyer", price_min: 500, price_max: 1000, delivery_days_min: 7, delivery_days_max: 14, revisions_min: 1, revisions_max: 2, deposit_pct_min: 20, deposit_pct_max: 50 },
      sellerMandate: { role: "seller", price_min: 600, price_max: 1200, delivery_days_min: 10, delivery_days_max: 20, revisions_min: 1, revisions_max: 3, deposit_pct_min: 30, deposit_pct_max: 50 },
      events: [],
      standingOffer: null,
      tentativeTerms: null,
      confirmations: { buyer: false, seller: false },
      contract: null,
      paypalInvoice: null,
      attackMode: false,
    });

    const legacyDeals: DealData[] = [
      createStubDeal("logo-asha-ravi", "Logo Design", "open"),
      createStubDeal("qa-genuine-deal-123", "Real Client Contract", "setup"),
    ];

    mockStorage.setItem("agentpal_deals_v1", JSON.stringify(legacyDeals));

    // Calling getDeals() should purge the legacy deal and keep only genuine user deals
    const activeDeals = DealStore.getDeals();
    expect(activeDeals.length).toBe(1);
    expect(activeDeals[0].id).toBe("qa-genuine-deal-123");
    expect(activeDeals[0].title).toBe("Real Client Contract");

    // The legacy item must not be retrievable by getDeal
    expect(DealStore.getDeal("logo-asha-ravi")).toBeNull();
    expect(DealStore.getDeal("landing-page")).toBeNull();
    expect(DealStore.getDeal("translation")).toBeNull();
  });

  it("stores, updates, and retrieves genuine user deals faithfully", () => {
    const createStubDeal = (id: string, title: string, status: DealData["status"]): DealData => ({
      id,
      title,
      description: "Test deal description",
      creatorRole: "buyer",
      inviteToken: "token-123",
      status,
      currentRound: 0,
      maxRounds: 5,
      deadline: "2026-12-31",
      createdAt: "2026-10-05T00:00:00.000Z",
      buyer: { id: "b1", name: "Buyer", email: "buyer@test.local", mandateSet: true },
      seller: { id: "s1", name: "Seller", email: "seller@test.local", mandateSet: true },
      buyerMandate: { role: "buyer", price_min: 1000, price_max: 2000, delivery_days_min: 10, delivery_days_max: 20, revisions_min: 1, revisions_max: 2, deposit_pct_min: 25, deposit_pct_max: 50 },
      sellerMandate: { role: "seller", price_min: 1200, price_max: 2500, delivery_days_min: 14, delivery_days_max: 30, revisions_min: 1, revisions_max: 3, deposit_pct_min: 30, deposit_pct_max: 50 },
      events: [],
      standingOffer: null,
      tentativeTerms: null,
      confirmations: { buyer: false, seller: false },
      contract: null,
      paypalInvoice: null,
      attackMode: false,
    });

    const newDeal = createStubDeal("real-deal-xyz", "Custom Security Audit", "setup");

    DealStore.saveDeal(newDeal);
    const retrieved = DealStore.getDeal("real-deal-xyz");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Custom Security Audit");
    expect(retrieved?.id).toBe("real-deal-xyz");

    // Update status
    retrieved!.status = "open";
    DealStore.saveDeal(retrieved!);
    expect(DealStore.getDeal("real-deal-xyz")?.status).toBe("open");
  });
});
