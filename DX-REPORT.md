# Jupiter API — Developer Experience Report
**ACE Protocol · Solana Colosseum Frontier Hackathon**
*Prepared by: ACE Protocol engineering team*

---

## Overview

This report documents the developer experience integrating Jupiter's APIs into ACE Protocol — an AI-assisted treasury and recurring payments system on Solana. The integration covers Price API v2, Swap v6, and the Recurring DCA API.

---

## Integrations Attempted

| API | Status | Notes |
|-----|--------|-------|
| Price API v2 | ✅ Working | Clean JSON, fast response |
| Swap v6 Quote | ✅ Working | Rich route data, good slippage info |
| Swap v6 Execute | ⚠️ Partial | Requires signed wallet tx — blocked in server-side context |
| Recurring (DCA) API | 🟡 Documented | Could not test end-to-end; docs incomplete |

---

## Price API v2

### What worked
- `GET https://api.jup.ag/price/v2?ids=<mint>` — clean, simple, fast
- Returns `{ data: { <mint>: { price: "148.23" } } }` — predictable shape
- No auth required — great for dashboards

### Pain Points
1. **No 24h price change in the response.** The previous Price API v1 included `vsTokenSymbol` and change data. v2 dropped this. For a treasury dashboard we need trend context, not just spot price.
   - **Suggestion:** Add optional `include=change24h` query param

2. **No batch error granularity.** If one mint in a batch request fails or is unknown, the entire response still returns 200 — but the missing mint is silently absent from `data`. There's no `errors` key.
   - **Suggestion:** Add `errors: { <mint>: "not found" }` field to surface partial failures

3. **Rate limits undocumented.** The public endpoint occasionally returns 429 without any `Retry-After` header. It's unclear what the threshold is.
   - **Suggestion:** Document rate limits and add `X-RateLimit-Remaining` headers

---

## Swap v6 Quote API

### What worked
- `GET https://api.jup.ag/swap/v6/quote?inputMint=...&outputMint=...&amount=...&slippageBps=...`
- Returns detailed route plan with DEX labels — excellent for "execution quality" UI
- `priceImpactPct` is well-formatted and reliable
- `routePlan` array gives per-hop breakdown

### Pain Points

1. **Amount in lamports only — not human-readable units.** You must know the token's decimal count to convert. There's no `humanAmount` field.
   - **Suggestion:** Accept `humanAmount` as optional alternative to `amount`

2. **`otherAmountThreshold` is a raw integer string.** Confusing name and format — took time to understand this is the minimum output in base units.
   - **Suggestion:** Rename to `minOutputAmount` and document the calculation

3. **No explicit "route unavailable" error shape.** When a route doesn't exist for a pair, the API returns a 400 with varied error messages. No stable `code` field.
   - **Suggestion:** Add structured error codes (`ROUTE_NOT_FOUND`, `AMOUNT_TOO_SMALL`, `INSUFFICIENT_LIQUIDITY`)

4. **Slippage enforcement gap.** The quote endpoint accepts `slippageBps`, but there's no confirmation in the response that the slippage was actually applied vs. reverted to a default.
   - **Suggestion:** Echo `appliedSlippageBps` in the response

---

## Swap v6 Execute (Transaction Construction)

### What worked
- `POST /swap/v6/swap` correctly constructs the transaction
- The `prioritizationFeeLamports` option is a nice touch for urgent execution

### Pain Points

1. **Server-side wallet signing is unsupported by design**, which is expected — but the docs don't clearly explain what wallet adapters are compatible in a non-browser context (e.g. keypair signing for bots/automated systems).
   - **Suggestion:** Add a "headless / server-side signing" section to docs with code example

2. **Transaction version confusion.** The API returns versioned transactions (v0 with lookup tables) but the docs don't always distinguish from legacy transactions. Anchor programs on older versions may fail silently.
   - **Suggestion:** Add explicit `transactionVersion: "versioned" | "legacy"` field

3. **`dynamicComputeUnitLimit` interaction.** When combined with custom priority fees, the actual cost can differ significantly from the estimated cost shown in the quote. No warning is surfaced.
   - **Suggestion:** Add `estimatedComputeUnits` and `estimatedPriorityFeeLamports` to the quote response

---

## Recurring (DCA) API

### What worked
- Concept is well-suited for ACE's reserve topup use case (auto-buy USDC when reserve drops)
- Documentation for creating DCA orders is clear

### Pain Points

1. **No trigger-based DCA.** The API only supports time-based intervals (e.g. every N minutes). ACE needs condition-based triggers (e.g. "buy when reserve ratio < 15%").
   - **Suggestion:** Add `triggerType: "price" | "time" | "condition"` with webhook callback

2. **Order status webhooks are undocumented.** To build a real-time dashboard, you need to know when a DCA order executes. There's no webhook or event subscription system documented.
   - **Suggestion:** Add webhook endpoint registration for order fills

3. **Cancellation requires on-chain tx.** Canceling a DCA order requires a wallet signature, making it hard to automate in server-side contexts.
   - **Suggestion:** Provide a server-signed cancellation path for program-controlled orders

---

## General DX Observations

### What Jupiter does well
- **Fast, stable endpoints** — Price and Quote APIs are consistently sub-100ms
- **No API key required for public endpoints** — dramatically reduces onboarding friction
- **Rich route data** — DEX labels, hop counts, and impact data are genuinely useful
- **Clear Swagger/OpenAPI docs** — most endpoints are well-documented

### Missing
- **Unified SDK for all APIs.** There's `@jup-ag/core` but it's inconsistently maintained across API versions. A unified `@jup-ag/sdk` that wraps Price, Quote, Swap, and Recurring would be transformative.
- **TypeScript types for responses.** The API has no official TypeScript response types. We had to type everything manually.
- **Devnet parity.** Some tokens/routes available on mainnet are not available on devnet, which makes end-to-end testing difficult.
- **Error response standardization.** Every endpoint has slightly different error formats. A unified `{ code, message, details }` format would help.

---

## Suggestions Summary

| Priority | Suggestion |
|----------|-----------|
| High | Add `change24h` to Price API v2 response |
| High | Publish official TypeScript response types |
| High | Add structured error codes to Swap v6 |
| Medium | Add `humanAmount` alternative to lamport-only amounts |
| Medium | Document rate limits with headers |
| Medium | Add trigger-based DCA (condition-triggered) |
| Medium | Document headless/server-side signing patterns |
| Low | Add order fill webhooks for Recurring API |
| Low | Improve devnet/mainnet parity for test tokens |

---

## Integration Quality: ACE Protocol Assessment

Overall, Jupiter's APIs are among the cleanest in the Solana ecosystem. The Price and Quote APIs are production-ready and reliable. The main gap for treasury automation use cases is the lack of conditional/trigger-based execution and server-side signing patterns.

For ACE Protocol specifically, Jupiter fills the critical role of execution-quality routing and stablecoin liquidity. The integration works well for the demo flow. The DCA/Recurring API would be transformative for the reserve topup use case once trigger conditions are supported.

---

*Hackathon: Solana Colosseum Frontier · May 2026*
*Integration surface: Price API v2, Swap v6 Quote, Swap v6 Execute, Recurring API*
