import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getAuthedConvex } from "@/lib/convex";
import { SettlementExecutor } from "@/lib/paypal/executor";
import { toDealData, type DealData } from "@/lib/deal-store";
import { SettlementKernel } from "@/lib/settlement-kernel";
import type { DealContract } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const convex = await getAuthedConvex();
    if (!convex && (!body.deal || body.deal.id !== id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if id is a Convex ID or client/demo ID
    let doc: Record<string, unknown> | null = null;
    let isConvexDoc = false;
    if (convex && (!id.includes("-") || id.length > 20)) {
      try {
        doc = await convex.query(api.deals.get, { dealId: id as Id<"deals"> });
        if (doc) isConvexDoc = true;
      } catch {
        isConvexDoc = false;
      }
    }

    let deal: DealData | null = null;
    if (doc) {
      deal = toDealData(doc);
    } else if (body.deal && body.deal.id === id) {
      deal = body.deal;
    } else {
      deal = null;
    }

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (body.action === "invoice") {
      // Ensure contract exists
      if (!deal.contract) {
        if (deal.standingOffer) {
          const timestamp = new Date().toISOString();
          deal.contract = {
            deal_id: id,
            terms: deal.standingOffer,
            hash: SettlementKernel.hashContract(deal.standingOffer, id, timestamp),
            accepted_by_buyer: true,
            accepted_by_seller: true,
            created_at: timestamp,
          };
        } else {
          return NextResponse.json({ error: "No contract or standing offer on deal" }, { status: 400 });
        }
      }

      const contractHash = deal.contract.hash;

      // Idempotency check 1: If completed invoice already exists for this contract hash, return immediately
      if (
        deal.paypalInvoice &&
        deal.paypalInvoice.contractHash === contractHash &&
        deal.paypalInvoice.status !== "invoice_pending"
      ) {
        return NextResponse.json({ success: true, invoice: deal.paypalInvoice, cached: true });
      }

      // If stored in Convex, run atomic pending reservation
      if (isConvexDoc) {
        try {
          await convex.mutation(api.deals.reserveInvoicePending, {
            dealId: id as Id<"deals">,
            contractHash,
          });
        } catch (reserveErr: unknown) {
          const errorMsg = reserveErr instanceof Error ? reserveErr.message : String(reserveErr);
          const freshDoc = await convex.query(api.deals.get, { dealId: id as Id<"deals"> });
          const freshDeal = freshDoc ? toDealData(freshDoc) : null;
          if (
            freshDeal?.paypalInvoice &&
            freshDeal.paypalInvoice.contractHash === contractHash &&
            freshDeal.paypalInvoice.status !== "invoice_pending"
          ) {
            return NextResponse.json({
              success: true,
              invoice: freshDeal.paypalInvoice,
              cached: true,
            });
          }
          return NextResponse.json(
            {
              error: "Concurrent invoice creation in progress. Please retry in a few seconds.",
              details: errorMsg,
            },
            { status: 409 }
          );
        }
      }

      // Call PayPal executor (only executor calls PayPal!)
      let invoice;
      try {
        invoice = await SettlementExecutor.createDepositInvoice(
          deal.contract as DealContract,
          deal.buyer.email,
          deal.seller.email
        );
      } catch (payPalErr: unknown) {
        if (isConvexDoc) {
          await convex
            .mutation(api.deals.clearInvoicePending, {
              dealId: id as Id<"deals">,
              contractHash,
            })
            .catch(() => {});
        }
        throw payPalErr;
      }

      // Store in Convex if Convex doc
      if (isConvexDoc) {
        await convex.mutation(api.deals.storeInvoiceResult, {
          dealId: id as Id<"deals">,
          contractHash,
          invoice,
        });
      }

      return NextResponse.json({ success: true, invoice });
    }

    if (body.action === "paid" || body.action === "simulate_payment") {
      if (!deal.paypalInvoice) {
        return NextResponse.json({ error: "No invoice to mark paid" }, { status: 400 });
      }
      if (!isConvexDoc) {
        return NextResponse.json(
          { error: "Payment state is only recorded server-side for persisted deals." },
          { status: 400 }
        );
      }

      // If explicitly requested, record simulated payment against the live PayPal Sandbox invoice
      if (body.action === "simulate_payment") {
        try {
          await SettlementExecutor.recordSandboxPayment(deal.paypalInvoice.invoiceId);
        } catch (simErr: unknown) {
          return NextResponse.json(
            { error: simErr instanceof Error ? simErr.message : "Failed to record payment in PayPal Sandbox" },
            { status: 502 }
          );
        }
      }

      // Payment confirmation must come from the provider, never from a client assertion.
      try {
        const verification = await convex.action(api.deals.confirmDepositPayment, { dealId: id });
        const freshDoc = await convex.query(api.deals.get, { dealId: id as Id<"deals"> });
        return NextResponse.json({
          success: true,
          verifiedStatus: verification.status,
          deal: freshDoc ? toDealData(freshDoc) : null,
        });
      } catch (providerErr) {
        return NextResponse.json(
          { error: providerErr instanceof Error ? providerErr.message : "Could not verify invoice with PayPal" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const convex = await getAuthedConvex();
    if (!convex) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    let doc: Record<string, unknown> | null = null;
    if (!id.includes("-") || id.length > 20) {
      try {
        doc = await convex.query(api.deals.get, { dealId: id as Id<"deals"> });
      } catch {
        doc = null;
      }
    }

    let deal: DealData | null = null;
    if (doc) {
      deal = toDealData(doc);
    } else {
      deal = null;
    }

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Authorized status polling: pull fresh state from PayPal Sandbox when an
    // invoice exists, and record any provider-confirmed payment.
    if (deal.paypalInvoice?.invoiceId && deal.paypalInvoice.invoiceId !== "pending") {
      try {
        await convex.action(api.deals.confirmDepositPayment, { dealId: id });
        const refreshed = await convex.query(api.deals.get, { dealId: id as Id<"deals"> });
        if (refreshed) deal = toDealData(refreshed);
      } catch {
        // Keep last persisted state if PayPal is unreachable; report existing state.
      }
    }

    return NextResponse.json({
      success: true,
      status: deal.status,
      invoice: deal.paypalInvoice,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
