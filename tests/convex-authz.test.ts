// @vitest-environment edge-runtime
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.*s");

// Identity subjects are Clerk user ids (the JWT `sub` claim).
const USERS = {
  seller: { name: "QA Seller", email: "qa-seller@example.test" },
  buyer: { name: "QA Buyer", email: "qa-buyer@example.test" },
  stranger: { name: "QA Stranger", email: "qa-stranger@example.test" },
};

let SELLER: { subject: string };
let BUYER: { subject: string };
let STRANGER: { subject: string };

function mandateFor(role: "buyer" | "seller") {
  return {
    role,
    price_min: role === "buyer" ? 800 : 1000,
    price_max: role === "buyer" ? 1500 : 2000,
    delivery_days_min: 5,
    delivery_days_max: 14,
    revisions_min: 1,
    revisions_max: 3,
    deposit_pct_min: 20,
    deposit_pct_max: 50,
  };
}

async function setup() {
  const t = convexTest(schema, modules);
  // Materialize the `users` rows and use each Clerk id as the identity subject,
  // exactly how the Clerk JWT `sub` claim maps to a user in production.
  for (const [key, u] of Object.entries(USERS)) {
    const clerkId = `clerktest_${key}`;
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { clerkId, name: u.name, email: u.email });
    });
    if (key === "seller") SELLER = { subject: clerkId };
    if (key === "buyer") BUYER = { subject: clerkId };
    if (key === "stranger") STRANGER = { subject: clerkId };
  }
  return t;
}

async function makeTentativeDeal(t: ReturnType<typeof convexTest>) {
  const asSeller = t.withIdentity(SELLER);
  const { dealId, inviteToken } = await asSeller.mutation(api.deals.createDealWithInvite, {
    title: "QA authz deal",
    description: "authz test",
    creatorRole: "seller",
    mandate: mandateFor("seller"),
    maxRounds: 6,
  });
  const asBuyer = t.withIdentity(BUYER);
  await asBuyer.mutation(api.deals.joinViaMagicLink, {
    token: inviteToken,
    mandate: mandateFor("buyer"),
  });
  // Drive one valid offer + acceptance straight through the validated public mutations
  await asSeller.mutation(api.deals.appendEvent, {
    dealId,
    actor: "seller_agent",
    type: "offer",
    payload: { price: 1200, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "seller offer" },
  });
  await asSeller.mutation(api.deals.updateDeal, {
    dealId,
    patch: {
      standingOffer: { price: 1200, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "seller offer" },
    },
  });
  await asBuyer.mutation(api.deals.updateDeal, {
    dealId,
    patch: {
      status: "tentative_agreement",
      tentativeTerms: { price: 1200, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "seller offer" },
      confirmations: { buyer: false, seller: false },
    },
  });
  return { dealId, inviteToken };
}

describe("authz: unauthenticated access", () => {
  it("list returns [] and get returns null without identity", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    expect(await t.query(api.deals.list)).toEqual([]);
    expect(await t.query(api.deals.get, { dealId })).toBeNull();
  });

  it("mutations reject without identity", async () => {
    const t = await setup();
    await expect(
      t.mutation(api.deals.createDealWithInvite, {
        title: "x",
        description: "x",
        creatorRole: "seller",
        mandate: mandateFor("seller"),
      })
    ).rejects.toThrow(/not authenticated/i);
  });
});

describe("authz: participant scoping", () => {
  it("a stranger cannot read the deal, list it, or sign it", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    const asStranger = t.withIdentity(STRANGER);
    expect(await asStranger.query(api.deals.get, { dealId })).toBeNull();
    expect(await asStranger.query(api.deals.list)).toEqual([]);
    await expect(asStranger.mutation(api.deals.confirmTentativeAgreement, { dealId })).rejects.toThrow(
      /not a participant/i
    );
  });

  it("self-dealing is blocked: creator cannot join their own link", async () => {
    const t = await setup();
    const asSeller = t.withIdentity(SELLER);
    const { inviteToken } = await asSeller.mutation(api.deals.createDealWithInvite, {
      title: "self deal",
      description: "x",
      creatorRole: "seller",
      mandate: mandateFor("seller"),
    });
    await expect(
      asSeller.mutation(api.deals.joinViaMagicLink, { token: inviteToken, mandate: mandateFor("buyer") })
    ).rejects.toThrow(/own deal link/i);
  });
});

describe("authz: mandate privacy", () => {
  it("while open, buyer sees only own mandate; seller mandate is stripped", async () => {
    const t = await setup();
    const asSeller = t.withIdentity(SELLER);
    const { dealId, inviteToken } = await asSeller.mutation(api.deals.createDealWithInvite, {
      title: "privacy deal",
      description: "x",
      creatorRole: "seller",
      mandate: mandateFor("seller"),
    });
    const asBuyer = t.withIdentity(BUYER);
    await asBuyer.mutation(api.deals.joinViaMagicLink, {
      token: inviteToken,
      mandate: mandateFor("buyer"),
    });

    const buyerView = await asBuyer.query(api.deals.get, { dealId });
    expect(buyerView?.buyerMandate?.price_max).toBe(1500);
    expect(buyerView?.sellerMandate).toBeNull();
    expect(buyerView?.viewerRole).toBe("buyer");

    const sellerView = await asSeller.query(api.deals.get, { dealId });
    expect(sellerView?.sellerMandate?.price_max).toBe(2000);
    expect(sellerView?.buyerMandate).toBeNull();

    const buyerList = await asBuyer.query(api.deals.list);
    expect(buyerList[0]?.sellerMandate).toBeNull();
  });

  it("no_deal does not unseal counterparty mandates", async () => {
    const t = await setup();
    const asSeller = t.withIdentity(SELLER);
    const { dealId, inviteToken } = await asSeller.mutation(api.deals.createDealWithInvite, {
      title: "failed deal",
      description: "x",
      creatorRole: "seller",
      mandate: mandateFor("seller"),
    });
    const asBuyer = t.withIdentity(BUYER);
    await asBuyer.mutation(api.deals.joinViaMagicLink, {
      token: inviteToken,
      mandate: mandateFor("buyer"),
    });
    // A failed negotiation is not mutual consensus.
    await asSeller.mutation(api.deals.updateDeal, {
      dealId,
      patch: { status: "no_deal" },
    });

    const buyerView = await asBuyer.query(api.deals.get, { dealId });
    expect(buyerView?.status).toBe("no_deal");
    expect(buyerView?.sellerMandate).toBeNull();
    expect(buyerView?.buyerMandate?.price_max).toBe(1500);

    const sellerView = await asSeller.query(api.deals.get, { dealId });
    expect(sellerView?.buyerMandate).toBeNull();
  });

  it("after the deal closes, both mandates become visible to participants", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    await t.withIdentity(BUYER).mutation(api.deals.confirmTentativeAgreement, { dealId });
    await t.withIdentity(SELLER).mutation(api.deals.confirmTentativeAgreement, { dealId });

    const buyerView = await t.withIdentity(BUYER).query(api.deals.get, { dealId });
    expect(buyerView?.status).toBe("agreed");
    expect(buyerView?.sellerMandate?.price_max).toBe(2000);
  });
});

describe("authz: signatures & forgery", () => {
  it("signing role is derived from identity — there is no role argument to forge", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    // Buyer signs; the mutation must record 'buyer' without being told a role.
    const res = await t.withIdentity(BUYER).mutation(api.deals.confirmTentativeAgreement, { dealId });
    expect(res).toMatchObject({ sealed: false, waitingOn: "seller" });
    const doc = await t.withIdentity(BUYER).query(api.deals.get, { dealId });
    expect(doc?.confirmations.buyer).toBe(true);
    expect(doc?.confirmations.seller).toBe(false);
  });

  it("dual signatures seal the contract with a verifiable hash", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    await t.withIdentity(BUYER).mutation(api.deals.confirmTentativeAgreement, { dealId });
    const sealed = await t.withIdentity(SELLER).mutation(api.deals.confirmTentativeAgreement, { dealId });
    expect(sealed).toMatchObject({ sealed: true });
    const doc = await t.withIdentity(SELLER).query(api.deals.get, { dealId });
    expect(doc?.status).toBe("agreed");
    expect(doc?.contract?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("forged actor in appendEvent is rejected (buyer cannot write seller_agent events)", async () => {
    const t = await setup();
    const asSeller = t.withIdentity(SELLER);
    const { dealId, inviteToken } = await asSeller.mutation(api.deals.createDealWithInvite, {
      title: "actor deal",
      description: "x",
      creatorRole: "seller",
      mandate: mandateFor("seller"),
    });
    const asBuyer = t.withIdentity(BUYER);
    await asBuyer.mutation(api.deals.joinViaMagicLink, { token: inviteToken, mandate: mandateFor("buyer") });
    await expect(
      asBuyer.mutation(api.deals.appendEvent, {
        dealId,
        actor: "seller_agent",
        type: "offer",
        payload: { price: 1200, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "forged" },
      })
    ).rejects.toThrow(/not valid for your role/i);
  });

  it("out-of-mandate forged offer is still rejected by the kernel", async () => {
    const t = await setup();
    const asSeller = t.withIdentity(SELLER);
    const { dealId, inviteToken } = await asSeller.mutation(api.deals.createDealWithInvite, {
      title: "kernel deal",
      description: "x",
      creatorRole: "seller",
      mandate: mandateFor("seller"),
    });
    await t.withIdentity(BUYER).mutation(api.deals.joinViaMagicLink, { token: inviteToken, mandate: mandateFor("buyer") });
    await expect(
      asSeller.mutation(api.deals.appendEvent, {
        dealId,
        actor: "seller_agent",
        type: "offer",
        payload: { price: 999999, delivery_days: 1, revisions: 99, deposit_pct: 0, message: "forged" },
      })
    ).rejects.toThrow(/violates mandate/i);
  });

  it("contract and payment event types are not writable via appendEvent", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    await expect(
      t.withIdentity(BUYER).mutation(api.deals.appendEvent, {
        dealId,
        actor: "buyer_agent",
        type: "contract",
        payload: { hash: "fake", terms: {} },
      })
    ).rejects.toThrow(/confirmation gate/i);
    await expect(
      t.withIdentity(BUYER).mutation(api.deals.appendEvent, {
        dealId,
        actor: "buyer_agent",
        type: "payment",
        payload: { action: "invoice_paid" },
      })
    ).rejects.toThrow(/settlement path/i);
  });
});

describe("authz: settlement gating", () => {
  it("reserve fails before dual signatures (tentative state)", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    await expect(
      t.withIdentity(BUYER).mutation(api.deals.reserveInvoicePending, {
        dealId,
        contractHash: "whatever",
      })
    ).rejects.toThrow(/contract hash mismatch/i);
  });

  it("reserve succeeds after dual signatures; stranger cannot reserve", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    await t.withIdentity(BUYER).mutation(api.deals.confirmTentativeAgreement, { dealId });
    const sealed = await t.withIdentity(SELLER).mutation(api.deals.confirmTentativeAgreement, { dealId });
    const hash = (sealed as { contractHash: string }).contractHash;

    await expect(
      t.withIdentity(STRANGER).mutation(api.deals.reserveInvoicePending, { dealId, contractHash: hash })
    ).rejects.toThrow(/not a participant/i);

    const res = await t.withIdentity(BUYER).mutation(api.deals.reserveInvoicePending, { dealId, contractHash: hash });
    expect(res).toMatchObject({ success: true });

    // Second reservation for the same contract fails (idempotency slot)
    await expect(
      t.withIdentity(BUYER).mutation(api.deals.reserveInvoicePending, { dealId, contractHash: hash })
    ).rejects.toThrow(/already reserved/i);
  });

  it("updateDeal cannot set paid directly (settlement path only)", async () => {
    const t = await setup();
    const { dealId } = await makeTentativeDeal(t);
    await expect(
      t.withIdentity(BUYER).mutation(api.deals.updateDeal, {
        dealId,
        patch: { status: "paid" },
      })
    ).rejects.toThrow();
  });

  it("recordRefereeTurn allows participant to record validated AI agent turns", async () => {
    const t = await setup();
    const asSeller = t.withIdentity(SELLER);
    const { dealId, inviteToken } = await asSeller.mutation(api.deals.createDealWithInvite, {
      title: "bilateral referee turn deal",
      description: "x",
      creatorRole: "seller",
      mandate: mandateFor("seller"),
    });
    const asBuyer = t.withIdentity(BUYER);
    await asBuyer.mutation(api.deals.joinViaMagicLink, { token: inviteToken, mandate: mandateFor("buyer") });

    // Buyer stepping a seller_agent turn via recordRefereeTurn
    await asBuyer.mutation(api.deals.recordRefereeTurn, {
      dealId,
      actor: "seller_agent",
      type: "offer",
      payload: { price: 1200, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "Valid opening quote" },
    });

    const doc = await t.run(async (ctx) => {
      const match = await ctx.db.query("deals").first();
      return match;
    });
    expect(doc?.events.length).toBe(1);
    expect(doc?.events[0].actor).toBe("seller_agent");

    // Rejected if out-of-mandate
    await expect(
      asBuyer.mutation(api.deals.recordRefereeTurn, {
        dealId,
        actor: "seller_agent",
        type: "offer",
        payload: { price: 999999, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "Invalid quote" },
      })
    ).rejects.toThrow(/violates mandate/i);

    // Rejected if human actor attempted via referee endpoint
    await expect(
      asBuyer.mutation(api.deals.recordRefereeTurn, {
        dealId,
        actor: "human_seller",
        type: "offer",
        payload: { price: 1200, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "Impersonation" },
      })
    ).rejects.toThrow(/not allowed for referee turns/i);
  });

  it("populateSandboxCounterparty enables solo sandbox negotiation with simulated counterparty", async () => {
    const t = await setup();
    const asBuyer = t.withIdentity(BUYER);
    const { dealId } = await asBuyer.mutation(api.deals.createDealWithInvite, {
      title: "sandbox mobile app deal",
      description: "Mobile app prototype",
      creatorRole: "buyer",
      mandate: mandateFor("buyer"),
    });

    const simulatedSellerMandate = mandateFor("seller");
    await asBuyer.mutation(api.deals.populateSandboxCounterparty, {
      dealId,
      mandate: simulatedSellerMandate,
      participantName: "Simulated Seller (Sandbox)",
    });

    const dealDoc = await asBuyer.query(api.deals.get, { dealId });
    expect(dealDoc?.status).toBe("open");
    expect(dealDoc?.seller?.name).toBe("Simulated Seller (Sandbox)");
    expect(dealDoc?.seller?.mandateSet).toBe(true);

    // Turn 1: Seller proposes opening bid
    await asBuyer.mutation(api.deals.recordRefereeTurn, {
      dealId,
      actor: "seller_agent",
      type: "offer",
      payload: { price: 1200, delivery_days: 10, revisions: 2, deposit_pct: 30, message: "Opening seller bid" },
    });

    // Turn 2: Buyer responds with counter-offer
    await asBuyer.mutation(api.deals.recordRefereeTurn, {
      dealId,
      actor: "buyer_agent",
      type: "offer",
      payload: { price: 1000, delivery_days: 12, revisions: 2, deposit_pct: 25, message: "Buyer counter-offer" },
    });

    const updatedDoc = await t.run(async (ctx) => {
      const match = await ctx.db.query("deals").first();
      return match;
    });

    expect(updatedDoc?.events.length).toBe(2);
    expect(updatedDoc?.events[0].actor).toBe("seller_agent");
    expect(updatedDoc?.events[1].actor).toBe("buyer_agent");
  });
});

