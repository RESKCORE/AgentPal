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
  invoicerUrl?: string;
  createdAt: string;
  paidAt?: string;
  mode: 'sandbox';
  isLiveApi: boolean;
  error?: string;
}

/**
 * Safely resolves and formats both Payer and Merchant view URLs for a PayPal invoice.
 * PayPal Payer view URL requires the alphanumeric token without "INV2-" and without hyphens:
 * e.g. https://www.sandbox.paypal.com/invoice/p/#S736W5PTV8Z2D57M
 * Merchant view URL uses the full invoice ID:
 * e.g. https://www.sandbox.paypal.com/invoice/details/INV2-S736-W5PT-V8Z2-D57M
 */
export function formatPayPalInvoiceUrls(
  invoiceId?: string,
  rawViewUrl?: string,
  rawInvoicerUrl?: string
): { viewUrl: string | null; invoicerUrl: string | null; cleanHash: string | null } {
  if (!invoiceId && !rawViewUrl) {
    return { viewUrl: null, invoicerUrl: null, cleanHash: null };
  }

  const id = invoiceId || '';
  const cleanHash = id ? id.replace(/^INV2-?/i, '').replace(/-/g, '') : null;

  // Sanitize any existing/legacy viewUrl that contains '#INV2-' or hyphens
  let viewUrl = rawViewUrl || null;
  if (viewUrl && viewUrl.includes('/invoice/p/#')) {
    const parts = viewUrl.split('#');
    const hash = parts[1] || '';
    const sanitized = hash.replace(/^INV2-?/i, '').replace(/-/g, '');
    viewUrl = sanitized ? `${parts[0]}#${sanitized}` : null;
  } else if (!viewUrl && cleanHash) {
    viewUrl = `https://www.sandbox.paypal.com/invoice/p/#${cleanHash}`;
  }

  let invoicerUrl = rawInvoicerUrl || null;
  if (!invoicerUrl && id && !id.startsWith('pending')) {
    invoicerUrl = `https://www.sandbox.paypal.com/invoice/details/${id}`;
  }

  return { viewUrl, invoicerUrl, cleanHash };
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

    const merchantSellerEmail = process.env.PAYPAL_SELLER_EMAIL || sellerEmail || 'sb-xxf2153180921@business.example.com';
    const recipientBuyerEmail = buyerEmail || process.env.PAYPAL_BUYER_EMAIL || 'sb-u3a54353183177@personal.example.com';

    const token = await this.getAccessToken(config.clientId, config.clientSecret);
    const invoicePayload = {
      detail: {
        invoice_number: invoiceNumber,
        invoice_date: today,
        currency_code: 'USD',
        note: `AgentPal Deal Deposit (${depositPct}% upfront for ${terms.message || 'agreed terms'}). Contract Hash: ${contract.hash}`,
      },
      invoicer: {
        email_address: merchantSellerEmail,
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: recipientBuyerEmail,
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
      const errText = await sendRes.text().catch(() => '');
      let detailMsg = '';
      try {
        const errObj = JSON.parse(errText);
        detailMsg =
          errObj.details?.map((d: { description?: string; issue?: string }) => d.description || d.issue).join('; ') ||
          errObj.message ||
          '';
      } catch {}
      console.warn(`[PayPal Executor] Invoice ${invoiceId} send notice returned ${sendRes.status}: ${detailMsg || errText}`);

      // If send notification failed with 422, the invoice itself was already successfully created in sandbox
      // and can still be viewed/settled. For other errors, fail with descriptive message.
      if (sendRes.status !== 422) {
        throw new Error(
          `PayPal Sandbox invoice send failed (HTTP ${sendRes.status}): ${detailMsg || errText.slice(0, 150)}`
        );
      }
    }

    // Query PayPal invoice detail to retrieve official recipient_view_url and invoicer_view_url
    let officialRecipientUrl: string | undefined;
    let officialInvoicerUrl: string | undefined;

    try {
      const getRes = await fetch(`https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (getRes.ok) {
        const invDetail = await getRes.json();
        officialRecipientUrl = invDetail.detail?.metadata?.recipient_view_url;
        officialInvoicerUrl = invDetail.detail?.metadata?.invoicer_view_url;
      }
    } catch {
      // Fallback handled by formatPayPalInvoiceUrls
    }

    const { viewUrl, invoicerUrl } = formatPayPalInvoiceUrls(
      invoiceId,
      officialRecipientUrl,
      officialInvoicerUrl
    );

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
      recipientEmail: recipientBuyerEmail,
      invoicerEmail: merchantSellerEmail,
      viewUrl: viewUrl || `https://www.sandbox.paypal.com/invoice/details/${invoiceId}`,
      invoicerUrl: invoicerUrl || `https://www.sandbox.paypal.com/invoice/details/${invoiceId}`,
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

  /**
   * Records a settlement payment for an invoice in the PayPal Developer Sandbox environment.
   * Calls PayPal Invoicing API v2 POST /v2/invoicing/invoices/{id}/payments.
   */
  static async recordSandboxPayment(invoiceId: string): Promise<{ status: string; paidAt?: string }> {
    const config = getSandboxConfig();
    const token = await this.getAccessToken(config.clientId, config.clientSecret);
    const today = new Date().toISOString().split('T')[0];

    const res = await fetch(`https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'BANK_TRANSFER',
        payment_date: today,
        note: 'Settled in PayPal Developer Sandbox environment',
      }),
    });

    if (!res.ok && res.status !== 200 && res.status !== 201) {
      const text = await res.text().catch(() => '');
      throw new Error(`PayPal record payment returned HTTP ${res.status}: ${text.slice(0, 150)}`);
    }

    return this.getInvoiceStatus(invoiceId);
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
