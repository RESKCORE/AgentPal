import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSandboxConfig } from "../lib/paypal/executor";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.PAYPAL_MODE;
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("PayPal Sandbox-only configuration enforcement", () => {
  it("rejects live mode explicitly", () => {
    process.env.PAYPAL_MODE = "live";
    process.env.PAYPAL_CLIENT_ID = "real-id";
    process.env.PAYPAL_CLIENT_SECRET = "real-secret";
    expect(() => getSandboxConfig()).toThrow(/sandbox/);
  });

  it("rejects production spelling", () => {
    process.env.PAYPAL_MODE = "production";
    process.env.PAYPAL_CLIENT_ID = "real-id";
    process.env.PAYPAL_CLIENT_SECRET = "real-secret";
    expect(() => getSandboxConfig()).toThrow(/sandbox/);
  });

  it("rejects missing credentials with a clear configuration error", () => {
    process.env.PAYPAL_MODE = "sandbox";
    expect(() => getSandboxConfig()).toThrow(/PAYPAL_CLIENT_ID/);
  });

  it("rejects placeholder credentials", () => {
    process.env.PAYPAL_MODE = "sandbox";
    process.env.PAYPAL_CLIENT_ID = "your_paypal_sandbox_client_id_here";
    process.env.PAYPAL_CLIENT_SECRET = "your_paypal_sandbox_client_secret_here";
    expect(() => getSandboxConfig()).toThrow(/PayPal Sandbox configuration error/);
  });

  it("accepts a real sandbox configuration", () => {
    process.env.PAYPAL_MODE = "sandbox";
    process.env.PAYPAL_CLIENT_ID = "AQreal-sandbox-id";
    process.env.PAYPAL_CLIENT_SECRET = "EKreal-sandbox-secret";
    expect(getSandboxConfig()).toEqual({
      clientId: "AQreal-sandbox-id",
      clientSecret: "EKreal-sandbox-secret",
      mode: "sandbox",
    });
  });

  it("defaults to sandbox when PAYPAL_MODE is unset", () => {
    process.env.PAYPAL_CLIENT_ID = "AQreal-sandbox-id";
    process.env.PAYPAL_CLIENT_SECRET = "EKreal-sandbox-secret";
    expect(getSandboxConfig().mode).toBe("sandbox");
  });
});
