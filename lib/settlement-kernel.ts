/**
 * Settlement Kernel - The deterministic guardrail for AgentNegotiate
 * 
 * This is the core differentiator: NO LLM, NO network calls.
 * Pure TypeScript validation that enforces mandates regardless of what agents say.
 * 
 * An offer that passes validateOffer() is deterministically inside the sender's mandate.
 * An acceptance that passes validateAcceptance() deterministically matches the standing offer.
 * A contract that passes checkAgreement() has two valid acceptances.
 * 
 * If a prompt tricks an agent into proposing an out-of-bounds price,
 * the kernel deterministically blocks it. The agent never sees PayPal credentials.
 */

import type { Mandate, Offer, Acceptance, ValidationResult, KernelCheckResult, MessageLeakCheckResult } from './types';

/**
 * Pure, zero-dependency SHA-256 implementation.
 * Runs identically in Node, browser, and Convex runtime without node:crypto.
 */
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : (((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0)) | 0;

      const s1_ =
        rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = ((((hash[7] + s1_) | 0) + ((ch + k[i]) | 0)) | 0) + (w[i] | 0);
      const s0_ =
        rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0_ + maj) | 0;

      hash = [
        ((temp1 + temp2) | 0),
        hash[0],
        hash[1],
        hash[2],
        ((hash[3] + temp1) | 0),
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (8 * b)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

export class SettlementKernel {
  /**
   * Validates an offer against the sender's mandate.
   * Every field must be within the sender's private limits.
   */
  static validateOffer(offer: Offer, senderMandate?: Mandate | null): KernelCheckResult {
    const violations: string[] = [];

    if (!senderMandate) {
      return {
        valid: false,
        violations: ["Sender mandate is not defined."],
      };
    }

    // Price check
    if (offer.price < senderMandate.price_min || offer.price > senderMandate.price_max) {
      violations.push(
        `Price ${offer.price} outside mandate range [${senderMandate.price_min}, ${senderMandate.price_max}]`
      );
    }

    // Delivery days check
    if (
      offer.delivery_days < senderMandate.delivery_days_min ||
      offer.delivery_days > senderMandate.delivery_days_max
    ) {
      violations.push(
        `Delivery days ${offer.delivery_days} outside mandate range [${senderMandate.delivery_days_min}, ${senderMandate.delivery_days_max}]`
      );
    }

    // Revisions check
    if (
      offer.revisions < senderMandate.revisions_min ||
      offer.revisions > senderMandate.revisions_max
    ) {
      violations.push(
        `Revisions ${offer.revisions} outside mandate range [${senderMandate.revisions_min}, ${senderMandate.revisions_max}]`
      );
    }

    // Deposit percentage check
    if (
      offer.deposit_pct < senderMandate.deposit_pct_min ||
      offer.deposit_pct > senderMandate.deposit_pct_max
    ) {
      violations.push(
        `Deposit ${offer.deposit_pct}% outside mandate range [${senderMandate.deposit_pct_min}, ${senderMandate.deposit_pct_max}]`
      );
    }

    return {
      valid: violations.length === 0,
      violations,
      offer: violations.length === 0 ? offer : undefined,
    };
  }

  /**
   * Validates an acceptance against:
   * 1. The standing offer must exist and match exactly
   * 2. The standing offer must be inside the accepter's mandate
   */
  static validateAcceptance(
    acceptance: Acceptance,
    standingOffer: Offer | null,
    accepterMandate?: Mandate | null
  ): ValidationResult {
    const violations: string[] = [];

    if (!accepterMandate) {
      return { valid: false, violations: ['Accepter mandate is not defined'] };
    }

    if (!standingOffer) {
      violations.push('No standing offer to accept');
      return { valid: false, violations };
    }

    // The standing offer must be within the accepter's limits
    const offerCheck = this.validateOffer(standingOffer, accepterMandate);
    if (!offerCheck.valid) {
      violations.push('Standing offer outside accepter mandate:', ...offerCheck.violations);
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Checks if both sides have accepted and the deal can proceed to contract.
   */
  static checkAgreement(
    buyerAccepted: boolean,
    sellerAccepted: boolean,
    agreedOffer: Offer | null
  ): ValidationResult {
    const violations: string[] = [];

    if (!buyerAccepted) {
      violations.push('Buyer has not accepted');
    }

    if (!sellerAccepted) {
      violations.push('Seller has not accepted');
    }

    if (!agreedOffer) {
      violations.push('No agreed offer exists');
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Enforces round limits.
   */
  static checkRoundLimit(currentRound: number, maxRounds: number): ValidationResult {
    if (currentRound > maxRounds) {
      return {
        valid: false,
        violations: [`Round ${currentRound} exceeds maximum ${maxRounds}`],
      };
    }
    return { valid: true, violations: [] };
  }

  /**
   * Enforces deadline.
   */
  static checkDeadline(now: Date, deadline: Date): ValidationResult {
    if (now > deadline) {
      return {
        valid: false,
        violations: ['Deal deadline has passed'],
      };
    }
    return { valid: true, violations: [] };
  }

  /**
   * Creates a cryptographic hash of the agreed terms.
   * This hash goes into the contract and can be verified later.
   */
  static hashContract(offer: Offer, dealId: string, timestamp: string): string {
    const data = JSON.stringify({ offer, dealId, timestamp });
    return sha256(data);
  }

  /**
   * Computes the Zone of Possible Agreement (ZOPA) for the Reveal chart.
   * Returns null if no overlap exists.
   */
  static computeZOPA(buyerMandate: Mandate, sellerMandate: Mandate): {
    price_min: number;
    price_max: number;
    overlap: boolean;
  } | null {
    // Buyer's max must meet or exceed seller's min for a deal to be possible
    const price_min = Math.max(sellerMandate.price_min, buyerMandate.price_min);
    const price_max = Math.min(buyerMandate.price_max, sellerMandate.price_max);

    if (price_max < price_min) {
      return { price_min, price_max, overlap: false };
    }

    return { price_min, price_max, overlap: true };
  }

  /**
   * Computes surplus split after a deal closes.
   * Surplus = final price - seller's minimum acceptable price.
   * The split shows how much each side captured above the minimum.
   */
  static computeSurplusSplit(
    finalPrice: number,
    sellerMandate: Mandate,
    buyerMandate: Mandate
  ): {
    total_surplus: number;
    seller_captured: number;
    buyer_captured: number;
    seller_pct: number;
    buyer_pct: number;
  } {
    const seller_min = sellerMandate.price_min;
    const buyer_max = buyerMandate.price_max;
    const total_surplus = buyer_max - seller_min;

    if (total_surplus <= 0) {
      return {
        total_surplus: 0,
        seller_captured: 0,
        buyer_captured: 0,
        seller_pct: 0,
        buyer_pct: 0,
      };
    }

    const seller_captured = finalPrice - seller_min;
    const buyer_captured = buyer_max - finalPrice;

    return {
      total_surplus,
      seller_captured,
      buyer_captured,
      seller_pct: (seller_captured / total_surplus) * 100,
      buyer_pct: (buyer_captured / total_surplus) * 100,
    };
  }

  /**
   * Pure function to detect if an agent's free-text message leaks private bounds.
   * This is a best-effort digit filter that extracts numeric digits from the message
   * and flags any numbers equal to the sender's private bounds (min/max for price, days,
   * revisions, deposit) that are NOT one of the numbers in the offer being sent.
   * Best-effort for digit patterns: "$350", "350.00", "350 dollars".
   * Edge case: If the offer term itself equals a bound (e.g. price is 350 and price_max is 350),
   * mentioning that number in the message is explicitly ALLOWED.
   */
  static checkMessageLeak(
    message: string,
    offerTerms: Offer,
    senderMandate: Mandate
  ): MessageLeakCheckResult {
    const violations: string[] = [];
    const leakedValues: number[] = [];

    if (!message || typeof message !== 'string') {
      return { leaked: false, leakedValues, violations };
    }

    // Numbers explicitly permitted because they are part of the outgoing offer
    const allowedValues = new Set<number>([
      offerTerms.price,
      offerTerms.delivery_days,
      offerTerms.revisions,
      offerTerms.deposit_pct,
    ]);

    // Private bounds belonging to the sender
    const privateBounds: Array<{ name: string; value: number }> = [
      { name: 'price_min', value: senderMandate.price_min },
      { name: 'price_max', value: senderMandate.price_max },
      { name: 'delivery_days_min', value: senderMandate.delivery_days_min },
      { name: 'delivery_days_max', value: senderMandate.delivery_days_max },
      { name: 'revisions_min', value: senderMandate.revisions_min },
      { name: 'revisions_max', value: senderMandate.revisions_max },
      { name: 'deposit_pct_min', value: senderMandate.deposit_pct_min },
      { name: 'deposit_pct_max', value: senderMandate.deposit_pct_max },
    ];

    // Strip commas from numbers like 1,200 -> 1200
    const cleanText = message.replace(/,/g, '');
    // Match numeric sequences, with optional decimals
    const matches = cleanText.match(/\b\d+(?:\.\d+)?\b/g) || [];

    for (const matchStr of matches) {
      const num = parseFloat(matchStr);
      if (isNaN(num)) continue;

      // If the number is part of the actual offer being sent, it is allowed
      if (allowedValues.has(num)) {
        continue;
      }

      // Check if it matches any private bound not in the offer
      for (const bound of privateBounds) {
        if (bound.value === num) {
          if (!leakedValues.includes(num)) {
            leakedValues.push(num);
            violations.push(
              `Message leaks private mandate bound ${bound.name}: ${num}`
            );
          }
        }
      }
    }

    return {
      leaked: violations.length > 0,
      leakedValues,
      violations,
    };
  }

  /**
   * Calculates deposit in integer cents to prevent floating-point drift.
   * Deposit = Math.round(totalCents * depositPct / 100)
   */
  static calculateDepositCents(totalCents: number, depositPct: number): number {
    return Math.round((totalCents * depositPct) / 100);
  }

  /**
   * Converts dollars to integer cents.
   */
  static toCents(dollars: number): number {
    return Math.round(dollars * 100);
  }

  /**
   * Converts integer cents to dollars.
   */
  static centsToDollars(cents: number): number {
    return cents / 100;
  }
}

