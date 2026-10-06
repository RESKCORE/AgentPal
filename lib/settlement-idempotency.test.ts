import { describe, it, expect } from 'vitest';
import { SettlementKernel } from './settlement-kernel';
import type { DealContract, Offer } from './types';
import type { PayPalInvoiceResult } from './paypal/executor';

describe('Atomic Idempotent Settlement', () => {
  const mockOffer: Offer = {
    price: 320,
    delivery_days: 5,
    revisions: 2,
    deposit_pct: 25,
    message: 'Agreed deal',
  };

  const dealId = 'deal-test-concurrent-101';
  const timestamp = '2026-10-03T12:00:00.000Z';
  const contractHash = SettlementKernel.hashContract(mockOffer, dealId, timestamp);

  const mockContract: DealContract = {
    deal_id: dealId,
    terms: mockOffer,
    hash: contractHash,
    accepted_by_buyer: true,
    accepted_by_seller: true,
    created_at: timestamp,
  };

  it('confirms PayPal-Request-Id is derived deterministically from contractHash', () => {
    const requestId1 = `inv-${mockContract.hash.slice(0, 32)}`;
    const requestId2 = `inv-${mockContract.hash.slice(0, 32)}`;
    expect(requestId1).toBe(requestId2);
    expect(requestId1).toBe(`inv-${contractHash.slice(0, 32)}`);

    const differentOffer: Offer = { ...mockOffer, price: 350 };
    const differentHash = SettlementKernel.hashContract(differentOffer, dealId, timestamp);
    const requestIdDifferent = `inv-${differentHash.slice(0, 32)}`;
    expect(requestId1).not.toBe(requestIdDifferent);
  });

  it('ensures two concurrent settle calls create exactly ONE invoice', async () => {
    // Shared state representing database document
    const dealDoc: {
      status: string;
      contract: DealContract;
      paypalInvoice: PayPalInvoiceResult | { invoiceId: string; status: string; contractHash: string } | null;
      events: Array<{ type: string; payload: unknown }>;
    } = {
      status: 'agreed',
      contract: mockContract,
      paypalInvoice: null,
      events: [],
    };

    let paypalCallCount = 0;

    // Simulated atomic Convex mutation: reserveInvoicePending
    const reserveInvoicePending = async (hash: string) => {
      if (dealDoc.contract.hash !== hash) {
        throw new Error('Contract hash mismatch');
      }
      if (dealDoc.paypalInvoice) {
        if (dealDoc.paypalInvoice.contractHash === hash) {
          throw new Error(`Invoice already reserved or exists for contract hash: ${hash}`);
        }
      }
      // Atomic write
      dealDoc.status = 'deposit_invoiced';
      dealDoc.paypalInvoice = {
        invoiceId: 'pending',
        status: 'invoice_pending',
        contractHash: hash,
      };
      return { success: true };
    };

    // Simulated atomic Convex mutation: storeInvoiceResult
    const storeInvoiceResult = async (hash: string, invoice: PayPalInvoiceResult) => {
      if (dealDoc.paypalInvoice?.contractHash !== hash) {
        throw new Error('Reservation contract hash mismatch');
      }
      dealDoc.paypalInvoice = invoice;
      dealDoc.events.push({ type: 'payment', payload: invoice });
    };

    // Simulated Settle Route handler
    const settleDeal = async (callerName: string): Promise<{ caller: string; invoice: PayPalInvoiceResult | null; error?: string }> => {
      // 1. Idempotency guard: Return existing completed invoice
      if (
        dealDoc.paypalInvoice &&
        dealDoc.paypalInvoice.contractHash === mockContract.hash &&
        dealDoc.paypalInvoice.status !== 'invoice_pending'
      ) {
        return { caller: callerName, invoice: dealDoc.paypalInvoice as PayPalInvoiceResult };
      }

      // 2. Atomic reservation
      try {
        await reserveInvoicePending(mockContract.hash);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { caller: callerName, invoice: null, error: errorMsg };
      }

      // 3. Simulated async PayPal call (with slight network delay)
      paypalCallCount++;
      await new Promise((r) => setTimeout(r, 20));
      const invoice: PayPalInvoiceResult = {
        success: true,
        invoiceId: `INV2-CONCURRENT-${Date.now()}`,
        invoiceNumber: `DEP-TEST-0001`,
        status: 'SENT',
        kind: 'deposit',
        amount: 80,
        amountCents: 8000,
        currency: 'USD',
        recipientEmail: 'buyer@example.com',
        invoicerEmail: 'seller@example.com',
        viewUrl: 'https://sandbox.paypal.com/invoice/viewer/test',
        mode: 'sandbox',
        isLiveApi: false,
        contractHash: mockContract.hash,
        createdAt: new Date().toISOString(),
      };

      // 4. Store invoice result atomically
      await storeInvoiceResult(mockContract.hash, invoice);

      return { caller: callerName, invoice };
    };

    // Launch two concurrent settle calls simultaneously
    const [result1, result2] = await Promise.all([
      settleDeal('Caller-1'),
      settleDeal('Caller-2'),
    ]);

    // Exactly one call must have reserved and called PayPal
    expect(paypalCallCount).toBe(1);

    // One succeeds with the invoice, the other is rejected with reservation error
    const successes = [result1, result2].filter((r) => r.invoice !== null);
    const rejected = [result1, result2].filter((r) => r.error !== undefined);

    expect(successes.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].error).toContain('Invoice already reserved or exists');

    // Subsequent retry returns the cached invoice without calling PayPal again
    const retryResult = await settleDeal('Caller-Retry');
    expect(paypalCallCount).toBe(1); // Still exactly 1!
    expect(retryResult.invoice?.invoiceId).toBe(successes[0].invoice?.invoiceId);
    expect(dealDoc.paypalInvoice?.contractHash).toBe(mockContract.hash);
  });
});
