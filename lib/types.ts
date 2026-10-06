import { z } from 'zod';

// Core domain types
export const MandateSchema = z.object({
  role: z.enum(['buyer', 'seller']),
  price_min: z.number().positive(),
  price_max: z.number().positive(),
  delivery_days_min: z.number().int().positive(),
  delivery_days_max: z.number().int().positive(),
  revisions_min: z.number().int().nonnegative(),
  revisions_max: z.number().int().nonnegative(),
  deposit_pct_min: z.number().min(0).max(100),
  deposit_pct_max: z.number().min(0).max(100),
});

export type Mandate = z.infer<typeof MandateSchema>;

export const OfferSchema = z.object({
  price: z.number().positive(),
  delivery_days: z.number().int().positive(),
  revisions: z.number().int().nonnegative(),
  deposit_pct: z.number().min(0).max(100),
  message: z.string().max(500),
});

export type Offer = z.infer<typeof OfferSchema>;

export const AcceptanceSchema = z.object({
  accepted_offer_seq: z.number().int().positive(),
  message: z.string().max(500).optional(),
});

export type Acceptance = z.infer<typeof AcceptanceSchema>;

// Event types
export type EventType = 
  | 'offer' 
  | 'accept' 
  | 'blocked' 
  | 'takeover' 
  | 'contract' 
  | 'payment'
  | 'hold';

export type ActorType = 
  | 'buyer_agent' 
  | 'seller_agent' 
  | 'human_buyer' 
  | 'human_seller' 
  | 'kernel' 
  | 'paypal';

export interface DealEvent {
  id: string;
  deal_id: string;
  seq: number;
  actor: ActorType;
  type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  status: 'open' | 'agreed' | 'no_deal' | 'paid';
  created_at: string;
  max_rounds: number;
  deadline: string;
  buyer_id: string;
  seller_id: string;
}

export interface DealContract {
  deal_id: string;
  terms: Offer;
  hash: string;
  accepted_by_buyer: boolean;
  accepted_by_seller: boolean;
  created_at: string;
}

// Validation result types
export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export interface KernelCheckResult extends ValidationResult {
  offer?: Offer;
  blocked_reason?: string;
}

export interface MessageLeakCheckResult {
  leaked: boolean;
  leakedValues: number[];
  violations: string[];
}

