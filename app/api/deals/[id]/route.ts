import { NextResponse } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexHttp } from "@/lib/convex";
import { SettlementKernel } from "@/lib/settlement-kernel";
import { toDealData } from "@/lib/deal-store";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function authedConvex() {
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  const convex = getConvexHttp();
  convex.setAuth(token);
  return convex;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const convex = await authedConvex();
  if (!convex) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const doc = await convex.query(api.deals.get, { dealId: id as Id<"deals"> });
  if (!doc) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  return NextResponse.json({ deal: toDealData(doc) });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const convex = await authedConvex();
  if (!convex) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (body.action === "reset") {
    await convex.mutation(api.deals.resetDeal, { dealId: id as Id<"deals"> });
    return NextResponse.json({ success: true });
  }

  if (body.action === "takeover") {
    const doc = await convex.query(api.deals.get, { dealId: id as Id<"deals"> });
    if (!doc) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    const deal = toDealData(doc);
    // Role is derived from the authenticated user's slot in the deal.
    const role = (doc as { viewerRole?: "buyer" | "seller" }).viewerRole;
    if (!role) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    const { offer } = body;

    const mandate = role === "buyer" ? deal.buyerMandate : deal.sellerMandate;
    if (!mandate) {
      return NextResponse.json({ success: false, reason: "Mandate not set for this role." });
    }
    const check = SettlementKernel.validateOffer(offer, mandate);

    if (!check.valid) {
      await convex.mutation(api.deals.appendEvent, {
        dealId: id as Id<"deals">,
        actor: role === "buyer" ? "human_buyer" : "human_seller",
        type: "blocked",
        payload: { ...offer, blocked_reason: `Referee Blocked: ${check.violations.join("; ")}` },
      });
      return NextResponse.json({ success: false, reason: check.violations.join("; ") });
    }

    // Message leak check
    const leakCheck = SettlementKernel.checkMessageLeak(offer.message, offer, mandate);
    if (leakCheck.leaked) {
      await convex.mutation(api.deals.appendEvent, {
        dealId: id as Id<"deals">,
        actor: role === "buyer" ? "human_buyer" : "human_seller",
        type: "blocked",
        payload: { ...offer, blocked_reason: `mandate leak: ${leakCheck.violations.join("; ")}` },
      });
      return NextResponse.json({ success: false, reason: `mandate leak: ${leakCheck.violations.join("; ")}` });
    }

    await convex.mutation(api.deals.appendEvent, {
      dealId: id as Id<"deals">,
      actor: role === "buyer" ? "human_buyer" : "human_seller",
      type: "offer",
      payload: offer,
    });
    await convex.mutation(api.deals.updateDeal, {
      dealId: id as Id<"deals">,
      patch: { standingOffer: offer },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
