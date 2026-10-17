import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getAuthedConvex } from "@/lib/convex";
import { SettlementKernel } from "@/lib/settlement-kernel";
import { generateAgentTurnWithOpenRouter } from "@/lib/openrouter";
import { toDealData, type DealData, type Offer, type DealOfferEvent } from "@/lib/deal-store";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: dealId } = await params;
    const body = await request.json().catch(() => ({}));
    const convex = await getAuthedConvex();
    if (!convex && (!body.deal || body.deal.id !== dealId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const attackMode = Boolean(body.attackMode);
    const preferredActor = body.preferredActor as "buyer_agent" | "seller_agent" | undefined;

    // Check if deal exists in Convex or client/demo storage
    let doc: Record<string, unknown> | null = null;
    let isConvexDoc = false;
    if (convex) {
      try {
        // Prefer getForReferee to get both mandates for the server referee
        doc = await convex.query(api.deals.getForReferee, { dealId: dealId as Id<"deals"> });
        if (doc) isConvexDoc = true;
      } catch {
        try {
          doc = await convex.query(api.deals.get, { dealId: dealId as Id<"deals"> });
          if (doc) isConvexDoc = true;
        } catch {
          isConvexDoc = false;
        }
      }
    }

    let deal: DealData | null = null;
    if (doc) {
      deal = toDealData(doc);
      if (!deal.buyerMandate && body.deal?.buyerMandate) {
        deal.buyerMandate = body.deal.buyerMandate;
      }
      if (!deal.sellerMandate && body.deal?.sellerMandate) {
        deal.sellerMandate = body.deal.sellerMandate;
      }
    } else if (body.deal && body.deal.id === dealId) {
      deal = body.deal;
    } else {
      deal = null;
    }

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // If both mandates exist and deal is still in setup, promote status to open
    if (deal.status === "setup" && deal.buyerMandate && deal.sellerMandate) {
      deal.status = "open";
      if (isConvexDoc) {
        await convex.mutation(api.deals.updateDeal, {
          dealId: dealId as Id<"deals">,
          patch: { status: "open" },
        }).catch(() => {});
      }
    }

    if (deal.status !== "open") {
      return NextResponse.json(
        { error: `Deal is in status '${deal.status}' (must be 'open' to negotiate)`, deal },
        { status: 400 }
      );
    }

    if (!deal.buyerMandate || !deal.sellerMandate) {
      return NextResponse.json(
        { error: "Both mandates must be set before negotiation starts.", deal },
        { status: 400 }
      );
    }

    // Helper functions for updating event log and state
    const recordEvent = async (
      actor: DealOfferEvent["actor"],
      type: DealOfferEvent["type"],
      payload: DealOfferEvent["payload"]
    ) => {
      const seq = deal.events.length > 0 ? deal.events[deal.events.length - 1].seq + 1 : 1;
      const evt: DealOfferEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        seq,
        actor,
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      deal.events.push(evt);
      if (isConvexDoc) {
        try {
          await convex.mutation(api.deals.recordRefereeTurn, {
            dealId: dealId as Id<"deals">,
            actor,
            type,
            payload,
          });
        } catch {
          await convex.mutation(api.deals.appendEvent, {
            dealId: dealId as Id<"deals">,
            actor,
            type,
            payload,
          }).catch(() => {});
        }
      }
      return evt;
    };

    const updateDealState = async (patch: Partial<DealData>) => {
      Object.assign(deal, patch);
      if (isConvexDoc) {
        await convex.mutation(api.deals.updateDeal, {
          dealId: dealId as Id<"deals">,
          patch: patch as Record<string, unknown>,
        }).catch(() => {});
      }
    };

    const lastEvent = deal.events[deal.events.length - 1];
    const isSellerTurn = preferredActor
      ? preferredActor === "seller_agent"
      : !lastEvent
      ? deal.creatorRole === "buyer"
      : lastEvent.actor === "buyer_agent" || lastEvent.actor === "human_buyer";

    const actingRole: "buyer" | "seller" = isSellerTurn ? "seller" : "buyer";
    const actingMandate = isSellerTurn ? deal.sellerMandate : deal.buyerMandate;
    const actingName = isSellerTurn ? "Seller AI Helper" : "Buyer AI Helper";
    const clientName = isSellerTurn ? "Seller" : "Buyer";

    const publicHistory = deal.events.map((e) => ({
      actor: e.actor,
      type: e.type,
      price: (e.payload as { price?: number })?.price,
      delivery_days: (e.payload as { delivery_days?: number })?.delivery_days,
      revisions: (e.payload as { revisions?: number })?.revisions,
      deposit_pct: (e.payload as { deposit_pct?: number })?.deposit_pct,
      message: (e.payload as { message?: string })?.message,
    }));

    // Live AI Turn generation via Google Gemini (primary) with OpenRouter & algorithmic safety fallbacks
    const llmResult = await generateAgentTurnWithOpenRouter({
      role: actingRole,
      agentName: actingName,
      clientName,
      mandate: actingMandate,
      dealTitle: deal.title,
      dealDescription: deal.description,
      history: publicHistory,
      standingOffer: deal.standingOffer,
      attackMode,
    });

    const response = llmResult.response;

    let appendedOfferActor: "seller_agent" | "buyer_agent" | null = null;
    let appendedOffer: Offer | null = null;
    let dealClosedThisTurn = false;

    if (response.action === "accept" && deal.standingOffer && !attackMode) {
      const acceptanceCheck = SettlementKernel.validateAcceptance(
        { accepted_offer_seq: lastEvent?.seq ?? 1 },
        deal.standingOffer,
        actingMandate
      );

      if (acceptanceCheck.valid) {
        dealClosedThisTurn = true;
        await recordEvent(
          isSellerTurn ? "seller_agent" : "buyer_agent",
          "accept",
          {
            price: deal.standingOffer.price,
            delivery_days: deal.standingOffer.delivery_days,
            revisions: deal.standingOffer.revisions,
            deposit_pct: deal.standingOffer.deposit_pct,
            message: response.message || `Agreed to standing offer of $${deal.standingOffer.price}!`,
            modelUsed: llmResult.modelUsed,
          }
        );

        // Agents only propose: hold at tentative_agreement until BOTH humans sign.
        await recordEvent("kernel", "tentative_match", {
          message: "Agents reached matching terms. Awaiting dual-human confirmation.",
        });
        await updateDealState({
          status: "tentative_agreement",
          tentativeTerms: deal.standingOffer,
          confirmations: { buyer: false, seller: false },
        });
      } else {
        await recordEvent(
          isSellerTurn ? "seller_agent" : "buyer_agent",
          "blocked",
          {
            message: response.message,
            blocked_reason: `Acceptance rejected by Settlement Referee: ${acceptanceCheck.violations.join("; ")}`,
            modelUsed: llmResult.modelUsed,
          }
        );
      }
    } else {
      const offer: Offer = {
        price: response.price,
        delivery_days: response.delivery_days,
        revisions: response.revisions,
        deposit_pct: response.deposit_pct,
        message: response.message,
      };

      const kernelCheck = SettlementKernel.validateOffer(offer, actingMandate);

      if (kernelCheck.valid && !attackMode) {
        // Message leak guard
        const leakCheck = SettlementKernel.checkMessageLeak(offer.message, offer, actingMandate);
        if (leakCheck.leaked) {
          await recordEvent(
            isSellerTurn ? "seller_agent" : "buyer_agent",
            "blocked",
            {
              ...offer,
              blocked_reason: `mandate leak: ${leakCheck.violations.join("; ")}`,
              modelUsed: llmResult.modelUsed,
            }
          );

          // Retry the agent once with instruction to omit private limits
          try {
            const retryResult = await generateAgentTurnWithOpenRouter({
              role: actingRole,
              agentName: actingName,
              clientName,
              mandate: actingMandate,
              dealTitle: deal.title,
              dealDescription: deal.description,
              history: [
                ...publicHistory,
                {
                  actor: "referee",
                  type: "blocked",
                  message: "Your message leaked confidential mandate limits. Rephrase your offer message to omit private boundary numbers.",
                },
              ],
              standingOffer: deal.standingOffer,
              attackMode: false,
            });

            const retryLeak = SettlementKernel.checkMessageLeak(
              retryResult.response.message,
              offer,
              actingMandate
            );

            if (!retryLeak.leaked) {
              offer.message = retryResult.response.message;
            } else {
              offer.message = `I propose $${offer.price}, ${offer.delivery_days} days delivery, with ${offer.revisions} revisions and ${offer.deposit_pct}% deposit upfront.`;
            }
          } catch {
            offer.message = `I propose $${offer.price}, ${offer.delivery_days} days delivery, with ${offer.revisions} revisions and ${offer.deposit_pct}% deposit upfront.`;
          }
        }

        await recordEvent(
          isSellerTurn ? "seller_agent" : "buyer_agent",
          "offer",
          { ...offer, modelUsed: llmResult.modelUsed }
        );
        appendedOfferActor = isSellerTurn ? "seller_agent" : "buyer_agent";
        appendedOffer = offer;

        await updateDealState({
          standingOffer: offer,
          attackMode: false,
          currentRound: Math.min(deal.maxRounds, Math.ceil((deal.events.length + 1) / 2)),
        });
      } else {
        await recordEvent(
          isSellerTurn ? "seller_agent" : "buyer_agent",
          "blocked",
          {
            ...offer,
            blocked_reason:
              kernelCheck.violations.join("; ") ||
              "Settlement Referee blocked offer: outside private limits.",
            modelUsed: llmResult.modelUsed,
          }
        );
        await updateDealState({ attackMode: false });
      }
    }

    // Close the loop at maxRounds: force an acceptance via the kernel if the
    // standing offer is in the non-offering side's mandate, else no_deal.
    const eventDelta = 1;
    const currentRoundEff = Math.min(
      deal.maxRounds,
      Math.ceil((deal.events.length + eventDelta) / 2)
    );
    if (!dealClosedThisTurn && currentRoundEff >= deal.maxRounds) {
      const lastOfferEvent = [...deal.events]
        .reverse()
        .find((e) => e.type === "offer");
      const standerStanding = appendedOffer ?? deal.standingOffer;
      const standerActor = appendedOfferActor ?? lastOfferEvent?.actor ?? null;

      const accepterRole: "buyer" | "seller" | null = standerActor
        ? standerActor.includes("seller")
          ? "buyer"
          : "seller"
        : null;
      const accepterMandate =
        accepterRole === "buyer" ? deal.buyerMandate : deal.sellerMandate;

      const acceptance =
        standerStanding && accepterMandate
          ? SettlementKernel.validateAcceptance(
              { accepted_offer_seq: appendedOffer ? deal.events.length : lastOfferEvent?.seq ?? 1 },
              standerStanding,
              accepterMandate
            )
          : null;

      if (acceptance?.valid && standerStanding && accepterRole) {
        await recordEvent(
          accepterRole === "buyer" ? "buyer_agent" : "seller_agent",
          "accept",
          {
            message: `Accepted after ${deal.maxRounds} rounds: $${standerStanding.price}.`,
          }
        );
        await recordEvent("kernel", "tentative_match", {
          message: "Agents reached matching terms. Awaiting dual-human confirmation.",
        });
        await updateDealState({
          status: "tentative_agreement",
          tentativeTerms: standerStanding,
          confirmations: { buyer: false, seller: false },
        });
      } else {
        await updateDealState({ status: "no_deal" });
      }
    }

    let finalDeal = deal;
    if (isConvexDoc) {
      const updated = await convex.query(api.deals.get, { dealId: dealId as Id<"deals"> }).catch(() => null);
      if (updated) {
        finalDeal = toDealData(updated);
        if (deal.events.length > finalDeal.events.length) {
          finalDeal.events = deal.events;
        }
        if (deal.standingOffer && !finalDeal.standingOffer) {
          finalDeal.standingOffer = deal.standingOffer;
        }
        if (deal.currentRound > finalDeal.currentRound) {
          finalDeal.currentRound = deal.currentRound;
        }
        if (!finalDeal.buyerMandate && deal.buyerMandate) {
          finalDeal.buyerMandate = deal.buyerMandate;
        }
        if (!finalDeal.sellerMandate && deal.sellerMandate) {
          finalDeal.sellerMandate = deal.sellerMandate;
        }
        if (finalDeal.status === "setup") {
          finalDeal.status = deal.status;
        }
      }
    }

    return NextResponse.json({
      success: true,
      deal: finalDeal,
      turnMetadata: {
        modelUsed: llmResult.modelUsed,
        isRealLLM: llmResult.isRealLLM,
        actor: isSellerTurn ? "seller_agent" : "buyer_agent",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

