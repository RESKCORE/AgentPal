/**
 * PayPal Agent Toolkit Test Script
 * 
 * This script tests the PayPal sandbox integration before building the full app.
 * It verifies:
 * 1. PayPal credentials work
 * 2. Invoice creation
 * 3. Invoice sending
 * 
 * SETUP REQUIRED:
 * 1. Create PayPal developer account: https://developer.paypal.com/
 * 2. Create sandbox business account (seller)
 * 3. Create sandbox personal account (buyer)
 * 4. Get client ID and secret from your app
 * 5. Set environment variables:
 *    - PAYPAL_CLIENT_ID
 *    - PAYPAL_CLIENT_SECRET
 *    - PAYPAL_MODE=sandbox
 *    - PAYPAL_SELLER_EMAIL (sandbox business account email)
 *    - PAYPAL_BUYER_EMAIL (sandbox personal account email)
 */

// NOTE: This is a placeholder. You'll need to integrate the actual PayPal Agent Toolkit
// or use the PayPal REST API directly. The toolkit documentation should be consulted
// for exact tool names and parameters.

interface InvoiceItem {
  name: string;
  quantity: number;
  unit_amount: {
    currency_code: string;
    value: string;
  };
  description?: string;
}

interface Invoice {
  detail: {
    invoice_number: string;
    invoice_date: string;
    currency_code: string;
    note?: string;
  };
  invoicer: {
    email_address: string;
  };
  primary_recipients: Array<{
    billing_info: {
      email_address: string;
    };
  }>;
  items: InvoiceItem[];
  configuration?: {
    allow_tip?: boolean;
    partial_payment?: {
      allow_partial_payment: boolean;
    };
  };
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
  }

  const baseURL = 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseURL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createInvoice(accessToken: string, invoice: Invoice): Promise<{ id: string; [key: string]: unknown }> {
  const baseURL = 'https://api-m.sandbox.paypal.com';

  const response = await fetch(`${baseURL}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invoice),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create invoice: ${response.status} ${error}`);
  }

  return response.json();
}

async function sendInvoice(accessToken: string, invoiceId: string): Promise<void> {
  const baseURL = 'https://api-m.sandbox.paypal.com';


  const response = await fetch(`${baseURL}/v2/invoicing/invoices/${invoiceId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      send_to_invoicer: true,
      send_to_recipient: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send invoice: ${response.status} ${error}`);
  }
}

async function main() {
  console.log('🚀 AgentNegotiate - PayPal Integration Test\n');

  // Check environment variables
  const requiredVars = [
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_SELLER_EMAIL',
    'PAYPAL_BUYER_EMAIL',
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nSet these in a .env.local file or export them in your shell.');
    process.exit(1);
  }

  try {
    // Step 1: Get access token
    console.log('1️⃣  Getting PayPal access token...');
    const accessToken = await getPayPalAccessToken();
    console.log('✅ Access token obtained\n');

    // Step 2: Create a test invoice (deposit)
    console.log('2️⃣  Creating test deposit invoice...');
    const invoiceNumber = `DEP${Date.now().toString().slice(-8)}`;
    const today = new Date().toISOString().split('T')[0];

    const depositInvoice: Invoice = {
      detail: {
        invoice_number: invoiceNumber,
        invoice_date: today,
        currency_code: 'USD',
        note: 'Test deposit invoice from AgentNegotiate (40% of $1200 deal)',
      },
      invoicer: {
        email_address: process.env.PAYPAL_SELLER_EMAIL!,
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: process.env.PAYPAL_BUYER_EMAIL!,
          },
        },
      ],
      items: [
        {
          name: 'Deposit for negotiated service',
          quantity: 1,
          unit_amount: {
            currency_code: 'USD',
            value: '480.00', // 40% of 1200
          },
          description: 'Deposit payment (40%) for agreed deal',
        },
      ],
    };

    const createdInvoice = await createInvoice(accessToken, depositInvoice);
    const invoiceId = Array.isArray(createdInvoice.links)
      ? String(createdInvoice.links.find((l: { rel: string }) => l.rel === 'self')?.href || '').split('/').pop()
      : undefined;
    const resolvedInvoiceId = invoiceId || String((createdInvoice as { href?: string }).href || '').split('/').pop();
    console.log(`✅ Invoice created: ${resolvedInvoiceId}`);
    console.log(`   Invoice number: ${invoiceNumber}`);
    const cleanHash = (resolvedInvoiceId || '').replace(/^INV2-?/i, '').replace(/-/g, '');
    console.log(`   Payer view: https://www.sandbox.paypal.com/invoice/p/#${cleanHash}`);
    console.log(`   Merchant view: https://www.sandbox.paypal.com/invoice/details/${resolvedInvoiceId}\n`);

    // Step 3: Send the invoice
    console.log('3️⃣  Sending invoice to buyer...');
    await sendInvoice(accessToken, resolvedInvoiceId!);
    console.log('✅ Invoice sent successfully\n');

    console.log('✨ SUCCESS! PayPal integration is working.\n');
    console.log('Next steps:');
    console.log('  1. Check the buyer sandbox email for the invoice');
    console.log('  2. Log into sandbox.paypal.com with buyer credentials');
    console.log('  3. Pay the invoice');
    console.log('  4. Set up webhook listeners for payment events\n');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
