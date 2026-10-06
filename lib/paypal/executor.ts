/**
 * Settlement Executor — The only component with PayPal access.
 * Enforces:
 * 1. PayPal sandbox only (PAYPAL_MODE=sandbox or unset; anything else is a config error).
 * 2. Only acts from a valid contract hash.
 * 3. No fabricated invoices: missing credentials or provider errors surface as errors,
 *    never as fake success.
 */

import type { DealContract, Offer } from '@/lib/types';
import { SettlementKernel } from '@/lib/settlement-kernel';

export interface PayPalInvoiceResult {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
  contractHash?: string;
  kind: 'deposit' | 'final';
  amount: number;
  amountCents?: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'invoice_pending';
  recipientEmail: string;
  invoicerEmail: string;
  viewUrl: string;
  createdAt: string;
  paidAt?: string;
  mode: 'sandbox';
  isLiveApi: boolean;
  error?: string;
}

export interface SandboxConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox';
}

export function getSandboxConfig(): SandboxConfig {
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  if (mode !== 'sandbox') {
    throw new Error(
      `PayPal configuration error: PAYPAL_MODE must be 'sandbox' (got '${process.env.PAYPAL_MODE}'). Live payment mode is not supported by this project.`
    );
  }
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const placeholder = (v: string | undefined) =>
    !v || v === 'your_paypal_sandbox_client_id' || v === 'your_paypal_sandbox_client_id_here' || v === 'your_sandbox_client_id' || v === 'your_sandbox_client_id_here' || v === 'your_paypal_sandbox_client_secret' || v === 'your_paypal_sandbox_client_secret_here' || v === 'your_sandbox_client_secret' || v === 'your_sandbox_client_secret_here';
  if (placeholder(clientId) || placeholder(clientSecret)) {
    throw new Error(
      'PayPal Sandbox configuration error: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set to real PayPal Developer Sandbox credentials.'
    );
  }
  return { clientId: clientId!, clientSecret: clientSecret!, mode: 'sandbox' };
}

export class SettlementExecutor {
  /**
   * Creates and dispatches a deposit invoice via PayPal Sandbox.
   * Throws a clear configuration or provider error on failure — never a fabricated success.
   */
  static async createDepositInvoice(
    contract: DealContract,
    buyerEmail: string = process.env.PAYPAL_BUYER_EMAIL || '',
    sellerEmail: string = process.env.PAYPAL_SELLER_EMAIL || ''
  ): Promise<PayPalInvoiceResult> {
    if (!contract.hash) {
      throw new Error('Settlement Executor refused: No valid contract hash present.');
    }

    const config = getSandboxConfig();

    const terms: Offer = contract.terms;
    const depositPct = terms.deposit_pct || 25;
    const totalCents = SettlementKernel.toCents(terms.price);
    const depositCents = SettlementKernel.calculateDepositCents(totalCents, depositPct);
    const depositAmountString = (depositCents / 100).toFixed(2);
    const depositAmountNumber = depositCents / 100;
    const invoiceNumber = `DEP-${contract.deal_id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const today = new Date().toISOString().split('T')[0];

    const token = await this.getAccessToken(config.clientId, config.clientSecret);
    const invoicePayload = {
      detail: {
        invoice_number: invoiceNumber,
        invoice_date: today,
        currency_code: 'USD',
        note: `AgentPal Deal Deposit (${depositPct}% upfront for ${terms.message || 'agreed terms'}). Contract Hash: ${contract.hash}`,
      },
      invoicer: {
        email_address: sellerEmail,
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: buyerEmail,
          },
        },
      ],
      items: [
        {
          name: `Deposit Payment (${depositPct}%)`,
          quantity: 1,
          unit_amount: {
            currency_code: 'USD',
            value: depositAmountString,
          },
          description: `Agreed Deal Total: $${terms.price}. Delivery in ${terms.delivery_days} days with ${terms.revisions} revisions.`,
        },
      ],
    };

    const res = await fetch('https://api-m.sandbox.paypal.com/v2/invoicing/invoices', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `inv-${contract.hash.slice(0, 32)}`,
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PayPal Sandbox invoice creation failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const hrefParts = (data.href || '').split('/');
    const invoiceId = data.id || hrefParts[hrefParts.length - 1];
    if (!invoiceId) {
      throw new Error('PayPal Sandbox returned an invoice without an ID.');
    }

    const sendRes = await fetch(`https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ send_to_recipient: true }),
    });
    if (!sendRes.ok && sendRes.status !== 202 && sendRes.status !== 204) {
      throw new Error(`PayPal Sandbox invoice send failed (HTTP ${sendRes.status}).`);
    }

    return {
      success: true,
      invoiceId,
      invoiceNumber,
      contractHash: contract.hash,
      kind: 'deposit',
      amount: depositAmountNumber,
      amountCents: depositCents,
      currency: 'USD',
      status: 'SENT',
      recipientEmail: buyerEmail,
      invoicerEmail: sellerEmail,
      viewUrl: `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`,
      createdAt: new Date().toISOString(),
      mode: 'sandbox',
      isLiveApi: true,
    };
  }

  /**
   * Retrieves the authoritative status of an invoice from PayPal Sandbox.
   * Used to confirm payment server-side before marking anything paid.
   */
  static async getInvoiceStatus(invoiceId: string): Promise<{ status: string; paidAt?: string }> {
    const config = getSandboxConfig();
    const token = await this.getAccessToken(config.clientId, config.clientSecret);
    const res = await fetch(`https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`PayPal Sandbox invoice retrieval failed (HTTP ${res.status}).`);
    }
    const data = await res.json();
    return { status: data.status, paidAt: data.metadata?.paid_date || data.paid_date };
  }

  private static async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`PayPal Sandbox OAuth error: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }
}
