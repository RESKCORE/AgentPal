import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

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

const offerValidator = v.object({
  price: v.number(),
  delivery_days: v.number(),
  revisions: v.number(),
  deposit_pct: v.number(),
  message: v.string(),
});

const eventValidator = v.object({
  id: v.string(),
  seq: v.number(),
  actor: v.string(),
  type: v.string(),
  payload: v.any(),
  timestamp: v.string(),
});

const participantValidator = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  mandateSet: v.boolean(),
});

const confirmationsValidator = v.object({
  buyer: v.boolean(),
  seller: v.boolean(),
  buyerConfirmedAt: v.optional(v.string()),
  sellerConfirmedAt: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,
  deals: defineTable({
    title: v.string(),
    description: v.string(),
    creatorRole: v.union(v.literal("buyer"), v.literal("seller")),
    inviteToken: v.string(),
    buyerUserId: v.optional(v.string()),
    sellerUserId: v.optional(v.string()),
    status: v.union(
      v.literal("setup"),
      v.literal("open"),
      v.literal("tentative_agreement"),
      v.literal("agreed"),
      v.literal("deposit_invoiced"),
      v.literal("paid"),
      v.literal("no_deal")
    ),
    currentRound: v.number(),
    maxRounds: v.number(),
    deadline: v.string(),
    createdAt: v.string(),
    buyer: participantValidator,
    seller: participantValidator,
    buyerMandate: v.union(mandateValidator, v.null()),
    sellerMandate: v.union(mandateValidator, v.null()),
    events: v.array(eventValidator),
    standingOffer: v.union(offerValidator, v.null()),
    tentativeTerms: v.union(offerValidator, v.null()),
    confirmations: confirmationsValidator,
    contract: v.union(v.any(), v.null()),
    paypalInvoice: v.union(v.any(), v.null()),
    attackMode: v.boolean(),
  })
    .index("by_inviteToken", ["inviteToken"])
    .index("by_buyer", ["buyerUserId"])
    .index("by_seller", ["sellerUserId"]),
});
