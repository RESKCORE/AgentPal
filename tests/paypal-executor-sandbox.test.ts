import { describe, it, expect } from "vitest";
import { SettlementExecutor } from "../lib/paypal/executor";
import { SettlementKernel } from "../lib/settlement-kernel";

describe("SettlementExecutor Live Sandbox Integration", () => {
  it("successfully creates and sends a deposit invoice even when deal parties have arbitrary Clerk emails", async () => {
    // If sandbox credentials are present, run live end-to-end check
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return;
    }

    const terms = {
      price: 320,
      delivery_days: 5,
      revisions: 2,
      deposit_pct: 25,
      message: "Accepted after 6 rounds: $320.",
    };
    const dealId = "j57242z4";
    const timestamp = new Date().toISOString();
    const hash = SettlementKernel.hashContract(terms, dealId, timestamp);

    const contract = {
      deal_id: dealId,
      terms,
      hash,
      accepted_by_buyer: true,
      accepted_by_seller: true,
      created_at: timestamp,
    };

    // Buyer and Seller with Clerk session emails (like in the user screenshot)
    const result = await SettlementExecutor.createDepositInvoice(
      contract,
      "reddy.santosh@example.com",
      "santosh.reddy@example.com"
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe("SENT");
    expect(result.amount).toBe(80);
    expect(result.invoiceId).toMatch(/^INV2-/);
    expect(result.viewUrl).toContain("sandbox.paypal.com/invoice/p/#");
    expect(result.viewUrl).not.toContain("#INV2-"); // Must be clean hash!
  }, 15000);
});
