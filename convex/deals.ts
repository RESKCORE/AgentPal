import { v } from "convex/values";
import { internalMutation, mutation, query, action, QueryCtx, MutationCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { SettlementKernel } from "../lib/settlement-kernel";

const mandateValidator = v.object({
  role: v.union(v.literal("buyer"), v.literal("seller")),
  price_min: v.number(),
  price_max: v.number(),
  delivery_days_min: v.number(),
  delivery_days_max: v.number(),
  revisions_min: v.number(),
  revisions_max: v.number(),
  deposit_pct_min: v.number(),
  deposit_pct_max: v.number(),
});

// Only a mutually-agreed or settled deal reveals counterparty mandates.
// no_deal is not mutual consensus: private constraints stay sealed after failed negotiations.
const CLOSED_STATUSES = ["agreed", "deposit_invoiced", "paid"];

interface AuthUser {
  userId: string;
  name: string;
  email: string;
}

type DealCtx = QueryCtx | MutationCtx;
type DealDoc = Doc<"deals">;

// Clerk identity: `subject` is the Clerk user id. Name/email live in our own
// `users` table (synced from the client) with the JWT claims as fallback.
async function getAuthUser(ctx: DealCtx): Promise<AuthUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const clerkId = identity.subject;
  const record = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
  return {
    userId: clerkId,
    name: record?.name ?? identity.name ?? "Unknown",
    email: record?.email ?? identity.email ?? "",
  };
}

async function requireAuthUser(ctx: DealCtx): Promise<AuthUser> {
  const user = await getAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

// Upsert the caller's profile from Clerk after sign-in. Idempotent.
export const syncUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkId = identity.subject;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (existing) {
      if (existing.name !== args.name || existing.email !== args.email) {
        await ctx.db.patch(existing._id, { name: args.name, email: args.email });
      }
    } else {
      await ctx.db.insert("users", { clerkId, name: args.name, email: args.email });
    }
  },
});

function roleOf(deal: DealDoc, userId: string, email?: string): "buyer" | "seller" | null {
  if (deal.buyerUserId === userId) return "buyer";
  if (deal.sellerUserId === userId) return "seller";
  if (deal.buyer?.id === userId) return "buyer";
  if (deal.seller?.id === userId) return "seller";
  if (email && email.trim().length > 0) {
    const cleanEmail = email.trim().toLowerCase();
    if (deal.buyer?.email && deal.buyer.email.trim().toLowerCase() === cleanEmail) return "buyer";
    if (deal.seller?.email && deal.seller.email.trim().toLowerCase() === cleanEmail) return "seller";
  }
  return null;
}

// The caller only ever sees their own mandate while the deal is live.
// The counterparty mandate is included only after the deal closes.
function stripForViewer(deal: DealDoc, role: "buyer" | "seller" | null) {
  const closed = CLOSED_STATUSES.includes(deal.status);
  if (closed) return deal;
  if (role === "buyer") return { ...deal, sellerMandate: null };
  if (role === "seller") return { ...deal, buyerMandate: null };
  return { ...deal, buyerMandate: null, sellerMandate: null };
}

async function resolveDeal(ctx: DealCtx, dealId: string) {
  const normId = ctx.db.normalizeId("deals", dealId);
  if (normId) {
    const deal = await ctx.db.get(normId);
    if (deal) return { deal, id: normId };
  }
  const all = await ctx.db.query("deals").collect();
  const match = all.find((d: DealDoc) => {
    if (String(d._id) === dealId || String(d._id).startsWith(dealId)) return true;
    const contract = d.contract as { deal_id?: string } | null;
    if (contract?.deal_id === dealId) return true;
    return d.title.toLowerCase().replace(/\s+/g, "-") === dealId.toLowerCase();
  });
  if (match) return { deal: match, id: match._id };
  return null;
}

async function requireParticipant(ctx: DealCtx, dealId: string) {
  const user = await requireAuthUser(ctx);
  const resolved = await resolveDeal(ctx, dealId);
  if (!resolved) throw new Error("Deal not found");
  const role = roleOf(resolved.deal, user.userId, user.email);
  if (!role) throw new Error("Not a participant of this deal");

  // Keep participant userId in sync with authenticated identity
  if ("patch" in ctx.db) {
    if (role === "buyer" && resolved.deal.buyerUserId !== user.userId) {
      await ctx.db.patch(resolved.id, {
        buyerUserId: user.userId,
        buyer: { ...resolved.deal.buyer, id: user.userId },
      });
    } else if (role === "seller" && resolved.deal.sellerUserId !== user.userId) {
      await ctx.db.patch(resolved.id, {
        sellerUserId: user.userId,
        seller: { ...resolved.deal.seller, id: user.userId },
      });
    }
  }

  return { user, role, deal: resolved.deal, id: resolved.id };
}

/* ------------------------------ Queries ------------------------------ */

export const viewer = query({
  handler: async (ctx) => {
    return await getAuthUser(ctx);
  },
});

export const list = query({
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) return [];
    const all = await ctx.db.query("deals").collect();
    const mine = all.filter((d) => roleOf(d, user.userId, user.email) !== null);
    mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mine.map((d) => stripForViewer(d, roleOf(d, user.userId, user.email)));
  },
});

export const get = query({
  args: { dealId: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return null;
    const resolved = await resolveDeal(ctx, args.dealId);
    if (!resolved) return null;
    const role = roleOf(resolved.deal, user.userId, user.email);
    if (!role) return null;
    return { ...stripForViewer(resolved.deal, role), viewerRole: role };
  },
});

export const getForReferee = query({
  args: { dealId: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return null;
    const resolved = await resolveDeal(ctx, args.dealId);
    if (!resolved) return null;
    const role = roleOf(resolved.deal, user.userId, user.email);
    if (!role) return null;
    return { ...resolved.deal, viewerRole: role };
  },
});


// Public by design: the invite landing page shows non-sensitive fields only.
export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const deal = await ctx.db
      .query("deals")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .unique();
    if (!deal) return null;
    const creator = deal.creatorRole === "buyer" ? deal.buyer : deal.seller;
    return {
      dealId: deal._id,
      title: deal.title,
      description: deal.description,
      status: deal.status,
      creatorRole: deal.creatorRole,
      creatorName: creator.name,
      inviteeRole: deal.creatorRole === "buyer" ? "seller" : "buyer",
    };
  },
});

/* --------------------------- Deal lifecycle --------------------------- */

function makeInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

const EMPTY_PARTICIPANT = {
  id: "",
  name: "Invited counterparty",
  email: "",
  mandateSet: false,
};

export const createDealWithInvite = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    creatorRole: v.union(v.literal("buyer"), v.literal("seller")),
    mandate: mandateValidator,
    maxRounds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const inviteToken = makeInviteToken();
    const creatorParticipant = {
      id: user.userId,
      name: user.name,
      email: user.email,
      mandateSet: true,
    };
    const dealId = await ctx.db.insert("deals", {
      title: args.title,
      description: args.description,
      creatorRole: args.creatorRole,
      inviteToken,
      buyerUserId: args.creatorRole === "buyer" ? user.userId : undefined,
      sellerUserId: args.creatorRole === "seller" ? user.userId : undefined,
      status: "setup",
      currentRound: 1,
      maxRounds: args.maxRounds ?? 6,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      buyer: args.creatorRole === "buyer" ? creatorParticipant : { ...EMPTY_PARTICIPANT },
      seller: args.creatorRole === "seller" ? creatorParticipant : { ...EMPTY_PARTICIPANT },
      buyerMandate: args.creatorRole === "buyer" ? args.mandate : null,
      sellerMandate: args.creatorRole === "seller" ? args.mandate : null,
      events: [],
      standingOffer: null,
      tentativeTerms: null,
      confirmations: { buyer: false, seller: false },
      contract: null,
      paypalInvoice: null,
      attackMode: false,
    });
    return { dealId, inviteToken };
  },
});

export const joinViaMagicLink = mutation({
  args: {
    token: v.string(),
    mandate: mandateValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const deal = await ctx.db
      .query("deals")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .unique();
    if (!deal) throw new Error("Invalid or expired deal link");
    if (deal.status !== "setup") {
      throw new Error(`This deal is already ${deal.status === "open" ? "underway" : deal.status}`);
    }
    const inviteeRole = deal.creatorRole === "buyer" ? "seller" : "buyer";
    const creatorUserId = deal.creatorRole === "buyer" ? deal.buyerUserId : deal.sellerUserId;
    if (creatorUserId === user.userId) {
      throw new Error("You cannot join your own deal link");
    }
    if (args.mandate.role !== inviteeRole) {
      throw new Error(`Mandate role must be '${inviteeRole}' for this deal`);
    }
    const participant = {
      id: user.userId,
      name: user.name,
      email: user.email,
      mandateSet: true,
    };
    await ctx.db.patch(deal._id, {
      status: "open",
      ...(inviteeRole === "buyer"
        ? { buyer: participant, buyerMandate: args.mandate, buyerUserId: user.userId }
        : { seller: participant, sellerMandate: args.mandate, sellerUserId: user.userId }),
    });
    return { dealId: deal._id, role: inviteeRole };
  },
});

/* ------------------------- Event log (validated) ------------------------- */

export const appendEventInternal = internalMutation({
  args: {
    dealId: v.string(),
    actor: v.string(),
    type: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveDeal(ctx, args.dealId);
    if (!resolved) throw new Error("Deal not found");
    const { deal, id } = resolved;
    const seq = deal.events.length > 0 ? deal.events[deal.events.length - 1].seq + 1 : 1;
    const event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seq,
      actor: args.actor,
      type: args.type,
      payload: args.payload,
      timestamp: new Date().toISOString(),
    };
    await ctx.db.patch(id, { events: [...deal.events, event] });
    return event;
  },
});

const ALLOWED_EVENT_TYPES = ["offer", "takeover", "accept", "contract", "payment", "blocked", "tentative_match", "adjustment", "signature"];

export const appendEvent = mutation({
  args: {
    dealId: v.string(),
    actor: v.string(),
    type: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const { role, deal } = await requireParticipant(ctx, args.dealId);

    if (!ALLOWED_EVENT_TYPES.includes(args.type)) {
      throw new Error(`Unauthorized event type: ${args.type}`);
    }

    // Actor consistency: a participant may only write their own side's events,
    // or neutral referee events (kernel/system) that carry no mandate data.
    const allowedActors = [`${role}_agent`, `human_${role}`, "kernel", "system"];
    if (!allowedActors.includes(args.actor)) {
      throw new Error(`Actor '${args.actor}' is not valid for your role ('${role}')`);
    }

    if (args.type === "offer") {
      if (deal.status !== "open") {
        throw new Error(`Cannot propose offer when deal status is '${deal.status}'`);
      }
      const mandate = role === "buyer" ? deal.buyerMandate : deal.sellerMandate;
      if (!mandate) throw new Error(`Mandate missing for ${role}`);
      const offerTerms = {
        price: Number(args.payload?.price),
        delivery_days: Number(args.payload?.delivery_days),
        revisions: Number(args.payload?.revisions),
        deposit_pct: Number(args.payload?.deposit_pct),
        message: String(args.payload?.message || ""),
      };
      const checkResult = SettlementKernel.validateOffer(offerTerms, mandate);
      if (!checkResult.valid) {
        throw new Error(`Settlement Invariant Error: Offer violates mandate: ${checkResult.violations.join("; ")}`);
      }
      const leakResult = SettlementKernel.checkMessageLeak(offerTerms.message, offerTerms, mandate);
      if (leakResult.leaked) {
        throw new Error(`Mandate Leak Error: Message leaks private limits: ${leakResult.violations.join("; ")}`);
      }
    } else if (args.type === "accept") {
      if (!deal.standingOffer) throw new Error("Cannot accept: no standing offer exists");
      const mandate = role === "buyer" ? deal.buyerMandate : deal.sellerMandate;
      if (!mandate) throw new Error(`Mandate missing for accepting party`);
      const acceptResult = SettlementKernel.validateAcceptance(
        { accepted_offer_seq: deal.events.length },
        deal.standingOffer,
        mandate
      );
      if (!acceptResult.valid) {
        throw new Error(`Settlement Invariant Error: Acceptance violates mandate limits: ${acceptResult.violations.join("; ")}`);
      }
      if (args.payload?.message) {
        const leakResult = SettlementKernel.checkMessageLeak(String(args.payload.message), deal.standingOffer, mandate);
        if (leakResult.leaked) {
          throw new Error(`Mandate Leak Error: Acceptance message leaks private limits: ${leakResult.violations.join("; ")}`);
        }
      }
    } else if (args.type === "takeover") {
      const mandate = role === "buyer" ? deal.buyerMandate : deal.sellerMandate;
      if (!mandate) throw new Error(`Mandate missing for ${role}`);
      if (args.payload?.price !== undefined) {
        const offerTerms = {
          price: Number(args.payload.price),
          delivery_days: Number(args.payload.delivery_days),
          revisions: Number(args.payload.revisions),
          deposit_pct: Number(args.payload.deposit_pct),
          message: String(args.payload.message || ""),
        };
        const checkResult = SettlementKernel.validateOffer(offerTerms, mandate);
        if (!checkResult.valid) {
          throw new Error(`Settlement Invariant Error: Takeover offer violates mandate: ${checkResult.violations.join("; ")}`);
        }
        const leakResult = SettlementKernel.checkMessageLeak(offerTerms.message, offerTerms, mandate);
        if (leakResult.leaked) {
          throw new Error(`Mandate Leak Error: Takeover message leaks private limits: ${leakResult.violations.join("; ")}`);
        }
      } else if (args.payload?.message) {
        const fallbackOffer = deal.standingOffer || {
          price: 0, delivery_days: 0, revisions: 0, deposit_pct: 0, message: "",
        };
        const leakResult = SettlementKernel.checkMessageLeak(String(args.payload.message), fallbackOffer, mandate);
        if (leakResult.leaked) {
          throw new Error(`Mandate Leak Error: Takeover message leaks private limits: ${leakResult.violations.join("; ")}`);
        }
      }
    } else if (args.type === "contract") {
      throw new Error("Contract events are written by the confirmation gate only");
    } else if (args.type === "payment") {
      throw new Error("Payment events are written by the settlement path only");
    }

    return await ctx.runMutation(internal.deals.appendEventInternal, args);
  },
});

export const populateSandboxCounterparty = mutation({
  args: {
    dealId: v.string(),
    mandate: mandateValidator,
    participantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deal, id, role } = await requireParticipant(ctx, args.dealId);
    const counterRole = role === "buyer" ? "seller" : "buyer";
    const name = args.participantName || `Simulated ${counterRole === "seller" ? "Seller" : "Buyer"} (Sandbox)`;
    const participant = {
      id: `simulated-${counterRole}`,
      name,
      email: `${counterRole}-sandbox@agentpal.local`,
      mandateSet: true,
    };
    await ctx.db.patch(id, {
      status: "open",
      ...(counterRole === "buyer"
        ? { buyer: participant, buyerMandate: args.mandate }
        : { seller: participant, sellerMandate: args.mandate }),
    });
    return { success: true };
  },
});

export const recordRefereeTurn = mutation({
  args: {
    dealId: v.string(),
    actor: v.string(),
    type: v.string(),
    payload: v.any(),
    mandate: v.optional(mandateValidator),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const { deal, id } = await requireParticipant(ctx, args.dealId);

    if (deal.status !== "open") {
      throw new Error(`Cannot record turn when deal status is '${deal.status}'`);
    }

    const allowedActors = ["buyer_agent", "seller_agent", "kernel", "system"];
    if (!allowedActors.includes(args.actor)) {
      throw new Error(`Actor '${args.actor}' is not allowed for referee turns`);
    }

    if (!ALLOWED_EVENT_TYPES.includes(args.type)) {
      throw new Error(`Unauthorized event type: ${args.type}`);
    }

    const actingRole: "buyer" | "seller" = args.actor.includes("seller") ? "seller" : "buyer";
    let actingMandate = actingRole === "buyer" ? deal.buyerMandate : deal.sellerMandate;

    if (!actingMandate && args.mandate) {
      actingMandate = args.mandate;
      if (actingRole === "seller") {
        await ctx.db.patch(id, {
          sellerMandate: args.mandate,
          seller: { ...deal.seller, mandateSet: true },
        });
      } else {
        await ctx.db.patch(id, {
          buyerMandate: args.mandate,
          buyer: { ...deal.buyer, mandateSet: true },
        });
      }
    }

    if (args.type === "offer") {
      if (!actingMandate) {
        throw new Error(`Mandate missing for acting role '${actingRole}'`);
      }
      const offerTerms = {
        price: Number(args.payload?.price),
        delivery_days: Number(args.payload?.delivery_days),
        revisions: Number(args.payload?.revisions),
        deposit_pct: Number(args.payload?.deposit_pct),
        message: String(args.payload?.message || ""),
      };
      const checkResult = SettlementKernel.validateOffer(offerTerms, actingMandate);
      if (!checkResult.valid) {
        throw new Error(`Settlement Invariant Error: Offer violates mandate: ${checkResult.violations.join("; ")}`);
      }
      const leakResult = SettlementKernel.checkMessageLeak(offerTerms.message, offerTerms, actingMandate);
      if (leakResult.leaked) {
        throw new Error(`Mandate Leak Error: Message leaks private limits: ${leakResult.violations.join("; ")}`);
      }
    } else if (args.type === "accept") {
      if (!deal.standingOffer) throw new Error("Cannot accept: no standing offer exists");
      if (!actingMandate) throw new Error(`Mandate missing for accepting party`);
      const acceptResult = SettlementKernel.validateAcceptance(
        { accepted_offer_seq: deal.events.length },
        deal.standingOffer,
        actingMandate
      );
      if (!acceptResult.valid) {
        throw new Error(`Settlement Invariant Error: Acceptance violates mandate limits: ${acceptResult.violations.join("; ")}`);
      }
      if (args.payload?.message) {
        const leakResult = SettlementKernel.checkMessageLeak(String(args.payload.message), deal.standingOffer, actingMandate);
        if (leakResult.leaked) {
          throw new Error(`Mandate Leak Error: Acceptance message leaks private limits: ${leakResult.violations.join("; ")}`);
        }
      }
    }

    return await ctx.runMutation(internal.deals.appendEventInternal, {
      dealId: args.dealId,
      actor: args.actor,
      type: args.type,
      payload: args.payload,
    });
  },
});

/* ---------------------------- State changes ---------------------------- */

export const updateDealInternal = internalMutation({
  args: {
    dealId: v.string(),
    patch: v.object({
      status: v.optional(
        v.union(
          v.literal("setup"),
          v.literal("open"),
          v.literal("tentative_agreement"),
          v.literal("agreed"),
          v.literal("deposit_invoiced"),
          v.literal("paid"),
          v.literal("no_deal")
        )
      ),
      currentRound: v.optional(v.number()),
      standingOffer: v.optional(v.union(v.any(), v.null())),
      tentativeTerms: v.optional(v.union(v.any(), v.null())),
      confirmations: v.optional(v.any()),
      contract: v.optional(v.union(v.any(), v.null())),
      paypalInvoice: v.optional(v.union(v.any(), v.null())),
      attackMode: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveDeal(ctx, args.dealId);
    if (!resolved) throw new Error("Deal not found");
    const { deal, id } = resolved;

    if (args.patch.status && args.patch.status !== deal.status) {
      const from = deal.status;
      const to = args.patch.status;
      const validTransitions: Record<string, string[]> = {
        setup: ["open"],
        open: ["tentative_agreement", "no_deal"],
        tentative_agreement: ["open", "agreed", "no_deal"],
        agreed: ["deposit_invoiced", "no_deal"],
        deposit_invoiced: ["paid"],
        paid: [],
        no_deal: [],
      };
      if (!validTransitions[from]?.includes(to)) {
        throw new Error(`Illegal status transition from '${from}' to '${to}'`);
      }
      if (to === "agreed") {
        const contract = args.patch.contract || deal.contract;
        if (!contract || !contract.hash) {
          throw new Error("Cannot transition to 'agreed' without a valid contract hash");
        }
      }
      if (to === "paid") {
        throw new Error("paid status may only be set by the settlement path");
      }
    }

    if (args.patch.contract) {
      const contract = args.patch.contract;
      const expectedHash = SettlementKernel.hashContract(contract.terms, id, contract.created_at);
      if (contract.hash !== expectedHash) {
        throw new Error("Contract Tampering Error: Hash does not match contract terms");
      }
    }

    if (args.patch.standingOffer) {
      const terms = args.patch.standingOffer;
      if (
        typeof terms.price !== "number" ||
        typeof terms.delivery_days !== "number" ||
        typeof terms.revisions !== "number" ||
        typeof terms.deposit_pct !== "number"
      ) {
        throw new Error("Invalid standing offer terms");
      }
    }

    await ctx.db.patch(id, args.patch);
  },
});

export const updateDeal = mutation({
  args: {
    dealId: v.string(),
    patch: v.object({
      status: v.optional(
        v.union(
          v.literal("setup"),
          v.literal("open"),
          v.literal("tentative_agreement"),
          v.literal("agreed"),
          v.literal("deposit_invoiced"),
          v.literal("paid"),
          v.literal("no_deal")
        )
      ),
      currentRound: v.optional(v.number()),
      standingOffer: v.optional(v.union(v.any(), v.null())),
      tentativeTerms: v.optional(v.union(v.any(), v.null())),
      confirmations: v.optional(v.any()),
      contract: v.optional(v.union(v.any(), v.null())),
      paypalInvoice: v.optional(v.union(v.any(), v.null())),
      attackMode: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args): Promise<unknown> => {
    await requireParticipant(ctx, args.dealId);
    return await ctx.runMutation(internal.deals.updateDealInternal, args);
  },
});

/* ---------------------- Dual-human confirmation gate ---------------------- */

export const confirmTentativeAgreement = mutation({
  args: { dealId: v.string() },
  handler: async (ctx, args) => {
    // The signing role is derived from the authenticated user — never from the request.
    const { role, deal, id } = await requireParticipant(ctx, args.dealId);
    if (deal.status !== "tentative_agreement") {
      throw new Error(`Cannot sign when deal status is '${deal.status}'`);
    }
    if (!deal.tentativeTerms) throw new Error("No tentative terms to sign");

    const now = new Date().toISOString();
    const confirmations = {
      ...deal.confirmations,
      [role]: true,
      [`${role}ConfirmedAt`]: now,
    };

    const events = [...deal.events];
    const nextSeq = () => (events.length > 0 ? events[events.length - 1].seq + 1 : 1);
    events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seq: nextSeq(),
      actor: `human_${role}`,
      type: "signature",
      payload: { role, message: `${role} confirmed and signed the tentative terms.` },
      timestamp: now,
    });

    const bothSigned = confirmations.buyer && confirmations.seller;
    if (!bothSigned) {
      await ctx.db.patch(id, { confirmations, events });
      return { sealed: false, waitingOn: role === "buyer" ? "seller" : "buyer" };
    }

    const contractHash = SettlementKernel.hashContract(deal.tentativeTerms, String(id), now);
    const contract = {
      deal_id: String(id),
      terms: deal.tentativeTerms,
      hash: contractHash,
      accepted_by_buyer: true,
      accepted_by_seller: true,
      created_at: now,
    };
    events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seq: nextSeq(),
      actor: "kernel",
      type: "contract",
      payload: { hash: contractHash, terms: deal.tentativeTerms, created_at: now },
      timestamp: now,
    });
    await ctx.db.patch(id, { confirmations, events, status: "agreed", contract });
    return { sealed: true, contractHash };
  },
});

export const requestAgreementAdjustment = mutation({
  args: {
    dealId: v.string(),
    feedback: v.string(),
  },
  handler: async (ctx, args) => {
    const { role, deal, id } = await requireParticipant(ctx, args.dealId);
    if (deal.status !== "tentative_agreement") {
      throw new Error(`Cannot request adjustment when deal status is '${deal.status}'`);
    }
    const now = new Date().toISOString();
    const seq = deal.events.length > 0 ? deal.events[deal.events.length - 1].seq + 1 : 1;
    const event = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seq,
      actor: `human_${role}`,
      type: "adjustment",
      payload: { role, feedback: args.feedback, message: `${role} requested adjustment: ${args.feedback}` },
      timestamp: now,
    };
    await ctx.db.patch(id, {
      status: "open",
      tentativeTerms: null,
      confirmations: { buyer: false, seller: false },
      events: [...deal.events, event],
    });
    return { reopened: true };
  },
});

/* ------------------------------ Settlement ------------------------------ */

export const reserveInvoicePending = mutation({
  args: {
    dealId: v.string(),
    contractHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { deal, id } = await requireParticipant(ctx, args.dealId);
    // The dual-human gate: settlement requires a contract sealed by both signatures.
    if (!deal.contract || deal.contract.hash !== args.contractHash) {
      throw new Error(`Contract hash mismatch or deal not agreed. Expected: ${deal.contract?.hash}, received: ${args.contractHash}`);
    }
    if (!deal.contract.accepted_by_buyer || !deal.contract.accepted_by_seller) {
      throw new Error("Contract is not signed by both parties");
    }
    if (deal.status !== "agreed" && deal.status !== "deposit_invoiced") {
      throw new Error(`Cannot invoice when deal status is '${deal.status}'`);
    }
    if (deal.paypalInvoice) {
      if (deal.paypalInvoice.contractHash === args.contractHash) {
        throw new Error(`Invoice already reserved or created for contract hash: ${args.contractHash}`);
      }
    }
    await ctx.db.patch(id, {
      status: "deposit_invoiced",
      paypalInvoice: {
        invoiceId: "pending",
        status: "invoice_pending",
        contractHash: args.contractHash,
        reservedAt: new Date().toISOString(),
      },
    });
    return { success: true, contractHash: args.contractHash };
  },
});

export const storeInvoiceResult = mutation({
  args: {
    dealId: v.string(),
    contractHash: v.string(),
    invoice: v.any(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const { deal, id } = await requireParticipant(ctx, args.dealId);
    if (!deal.contract || deal.contract.hash !== args.contractHash) {
      throw new Error("Contract hash mismatch on invoice store");
    }
    if (deal.paypalInvoice?.contractHash !== args.contractHash) {
      throw new Error("Reservation contract hash mismatch");
    }
    await ctx.db.patch(id, {
      status: "deposit_invoiced",
      paypalInvoice: args.invoice,
    });
    return await ctx.runMutation(internal.deals.appendEventInternal, {
      dealId: String(id),
      actor: "system",
      type: "payment",
      payload: {
        action: "invoice_created",
        invoiceId: args.invoice.invoiceId,
        invoiceNumber: args.invoice.invoiceNumber,
        amount: args.invoice.amount,
        amountCents: args.invoice.amountCents,
        status: args.invoice.status,
        contractHash: args.contractHash,
      },
    });
  },
});

export const clearInvoicePending = mutation({
  args: {
    dealId: v.string(),
    contractHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { deal, id } = await requireParticipant(ctx, args.dealId);
    if (deal.paypalInvoice?.contractHash === args.contractHash && deal.paypalInvoice?.status === "invoice_pending") {
      await ctx.db.patch(id, { status: "agreed", paypalInvoice: null });
    }
  },
});

// Applies a payment status that was verified against PayPal (poll or webhook).
// Never accepts a client-supplied "paid" flag.
export const applyVerifiedPayment = internalMutation({
  args: {
    dealId: v.string(),
    invoiceStatus: v.string(),
    paidAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveDeal(ctx, args.dealId);
    if (!resolved) throw new Error("Deal not found");
    const { deal, id } = resolved;
    if (!deal.paypalInvoice) throw new Error("No invoice on deal");
    if (args.invoiceStatus !== "PAID" && args.invoiceStatus !== "MARKED_AS_PAID") {
      return { applied: false, status: args.invoiceStatus };
    }
    if (deal.status === "paid") return { applied: false, status: "paid" };
    const paidAt = args.paidAt ?? new Date().toISOString();
    await ctx.db.patch(id, {
      status: "paid",
      paypalInvoice: { ...deal.paypalInvoice, status: "PAID", paidAt },
    });
    await ctx.runMutation(internal.deals.appendEventInternal, {
      dealId: String(id),
      actor: "paypal",
      type: "payment",
      payload: {
        action: "invoice_paid",
        invoiceId: deal.paypalInvoice.invoiceId,
        amount: deal.paypalInvoice.amount,
        amountCents: deal.paypalInvoice.amountCents,
        contractHash: deal.contract?.hash,
      },
    });
    return { applied: true };
  },
});

/* ------------------------- Provider-verified payment ------------------------- */

// Verifies the invoice directly against PayPal Sandbox, then records the result
// through the internal mutation. A client can never assert "PAID" by itself.
export const confirmDepositPayment = action({
  args: { dealId: v.string() },
  handler: async (ctx, args): Promise<{ status: string; applied: boolean }> => {
    // Participant gate: api.deals.get returns null for non-participants.
    const deal = await ctx.runQuery(api.deals.get, { dealId: args.dealId });
    if (!deal) throw new Error("Deal not found");
    const invoiceId = (deal.paypalInvoice as { invoiceId?: string } | null)?.invoiceId;
    if (!invoiceId || invoiceId === "pending") throw new Error("No invoice on deal");

    const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
    if (mode !== "sandbox") throw new Error("PayPal mode must be 'sandbox'");
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("PayPal Sandbox credentials are not configured on the server");
    }

    const auth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenRes.ok) throw new Error(`PayPal Sandbox OAuth error: ${tokenRes.status}`);
    const tokenData = await tokenRes.json();

    const invRes = await fetch(
      `https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${invoiceId}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    if (!invRes.ok) throw new Error(`PayPal Sandbox invoice retrieval failed (HTTP ${invRes.status})`);
    const inv = await invRes.json();

    const applied = await ctx.runMutation(internal.deals.applyVerifiedPayment, {
      dealId: args.dealId,
      invoiceStatus: inv.status,
      paidAt: inv.metadata?.paid_date,
    });
    return { status: inv.status, applied: Boolean((applied as { applied?: boolean })?.applied) };
  },
});

/* ------------------------------ Demo reset ------------------------------ */

// Participant-gated. Batch 3 replaces the event-wipe semantics with cancel/close.
export const resetDeal = mutation({
  args: { dealId: v.string() },
  handler: async (ctx, args) => {
    const { deal, id } = await requireParticipant(ctx, args.dealId);
    await ctx.db.patch(id, {
      status: deal.buyerMandate ? "open" : "setup",
      currentRound: 1,
      events: [],
      standingOffer: null,
      tentativeTerms: null,
      confirmations: { buyer: false, seller: false },
      contract: null,
      paypalInvoice: null,
      attackMode: false,
    });
  },
});
