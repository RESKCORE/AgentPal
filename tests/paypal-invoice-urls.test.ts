import { describe, it, expect } from "vitest";
import { formatPayPalInvoiceUrls } from "../lib/paypal/executor";

describe("formatPayPalInvoiceUrls", () => {
  it("sanitizes legacy URLs containing #INV2- and hyphens", () => {
    const result = formatPayPalInvoiceUrls(
      "INV2-SB-9941-AZ82",
      "https://sandbox.paypal.com/invoice/p/#INV2-SB-9941-AZ82"
    );
    expect(result.viewUrl).toBe("https://sandbox.paypal.com/invoice/p/#SB9941AZ82");
    expect(result.invoicerUrl).toBe("https://www.sandbox.paypal.com/invoice/details/INV2-SB-9941-AZ82");
    expect(result.cleanHash).toBe("SB9941AZ82");
  });

  it("handles valid official recipient URLs without altering valid hashes", () => {
    const result = formatPayPalInvoiceUrls(
      "INV2-S736-W5PT-V8Z2-D57M",
      "https://www.sandbox.paypal.com/invoice/p/#S736W5PTV8Z2D57M",
      "https://www.sandbox.paypal.com/invoice/details/INV2-S736-W5PT-V8Z2-D57M"
    );
    expect(result.viewUrl).toBe("https://www.sandbox.paypal.com/invoice/p/#S736W5PTV8Z2D57M");
    expect(result.invoicerUrl).toBe("https://www.sandbox.paypal.com/invoice/details/INV2-S736-W5PT-V8Z2-D57M");
  });

  it("generates payer and invoicer URLs from invoiceId when raw URLs are missing", () => {
    const result = formatPayPalInvoiceUrls("INV2-1234-5678-ABCD");
    expect(result.viewUrl).toBe("https://www.sandbox.paypal.com/invoice/p/#12345678ABCD");
    expect(result.invoicerUrl).toBe("https://www.sandbox.paypal.com/invoice/details/INV2-1234-5678-ABCD");
    expect(result.cleanHash).toBe("12345678ABCD");
  });

  it("safely handles undefined, null, or pending IDs", () => {
    expect(formatPayPalInvoiceUrls()).toEqual({ viewUrl: null, invoicerUrl: null, cleanHash: null });
    expect(formatPayPalInvoiceUrls("pending")).toEqual({
      viewUrl: "https://www.sandbox.paypal.com/invoice/p/#pending",
      invoicerUrl: null,
      cleanHash: "pending",
    });
  });
});
