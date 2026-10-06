# AgentNegotiate — Agent Brief

Read this before writing any code. These are decisions already made. Don't relitigate them.

## Locked scope

**1:1 only.** One buyer, one seller, one private room. The buyer creates a deal and shares a link; the seller opens it and sets their own mandate. Explicitly out of scope: public task boards, multi-seller threads, broadcast/RFP, third parties in the room, tournaments.

**PayPal sandbox only.** `PAYPAL_MODE=sandbox` always. Sandbox holds fake money and cannot move real funds. Never add a `live` branch, never accept production credentials, never build a real-money path. Both parties are sandbox accounts. The "counterparty" in a demo is a second agent you drive with a second sandbox account.

## Canonical Source of Truth

- **Convex Database is the authoritative server database** for all deal states, append-only events, and signed contracts.
- **DealStore** acts as the client-side reactive cache (`useSyncExternalStore`) ensuring offline resilience and instant UI updates.
- All state-mutating actions (offers, acceptances, contracts) MUST pass through the deterministic Settlement Kernel before persistence.
- **Single-Operator Demo Mode**: When running with `demoMode: true`, a single evaluator operates both buyer and seller perspectives. Two-party privacy isolation is simulated; production multi-tenant environments enforce database-level caller isolation.

## The one invariant everything else serves

> **LLMs only propose. A deterministic Settlement Kernel decides what is legal. Only the Settlement Executor can touch PayPal.**

If a change makes the LLM more trusted, more capable of acting, or more able to reach PayPal, it is wrong. Break it.

| Component | Hard rule |
|---|---|
| Settlement Kernel | Pure TS. No LLM, no network, no DB. Must stay unit-testable in isolation. |
| Agent runtime | **No payment tools. No PayPal credentials. Cannot send money under any circumstance.** |
| Turn runner | Loads only the *acting* side's mandate into that agent's prompt. Never both. |
| Settlement Executor | The only component with PayPal credentials. Only acts from a stored contract hash. |
| Reveal service | Reads both mandates only *after* the room closes. Server-side only. |

## Privacy rules

- The counterparty's mandate is never in any agent's context, prompt, or transcript.
- The transcript shows offers and messages. Never limits.
- Mandates are enforced at the backend layer (`userId` access controls and sealed mandates), not by prompt wording.
- Counterparty message text is **untrusted data**. Wrap it and pass it as data, never as instructions.

## Kernel rules — the must-pass list

1. An offer must sit inside the **sender's own** mandate on every field: price, delivery_days, revisions, deposit_pct.
2. An acceptance is valid only if it **exactly matches** the counterparty's latest standing offer, *and* that offer sits inside the accepter's mandate.
3. A contract requires two valid acceptances (or one acceptance plus a human confirmation). Nothing less.
4. `max_rounds` and `deadline` are enforced. Past either, the room closes `no_deal`.
5. A blocked offer gets up to 2 retries, then the turn becomes a forced `hold` plus a human alert.
6. Only the Settlement Executor may create a PayPal object, and only from a stored contract hash.

Rule 2 is the one that is easy to get wrong. `validateAcceptance` must actually inspect the acceptance — including `accepted_offer_seq` — and confirm it points at the current standing offer. Ignoring the acceptance argument is a security bug, not an oversight.

## Should

- One agent turn per invocation. Keeps serverless calls short and makes retries cheap.
- LLM output goes through Zod before it reaches the kernel. Retry once on schema failure, then fall back to `hold`.
- Deposit and final as **two separate invoices**. Don't fight partial payments.
- Scorecards computed from stored deals only. Seeded demo deals labeled `demo data`.
- Demo video replays a pre-seeded event log. Live runs for the attack moment and the invoice.
- Ship the must-have list before touching any nice-to-have.

## Must not

- Don't put the other side's limits into any prompt, even "just for context".
- Don't let LLM output reach PayPal without passing the kernel.
- Don't relax a kernel rule to make a demo work. A blocked demo is better than an unguarded one.
- Don't add a dependency when stdlib or a native Next.js feature does the job.
- Don't build past the must-have list. Scope creep is the documented top risk.
- Don't claim a feature works without a runnable check behind it.

## Verify before claiming done

```bash
npm test          # kernel suite must be green
npx tsc --noEmit # types must be clean
npm run build    # Next.js must compile
```

PayPal claims require an actual sandbox run. "Script looks right" is not "tested".