# ACE Protocol

ACE (Autonomous Capital Engine) is a treasury OS for Solana. Connect your wallet, define allocation rules, and let the protocol manage disbursements, staking, and private transfers according to your policy — no manual signing required for routine operations.

The protocol runs a deployed Solana program (`DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY`) that holds a vault per user with four sub-buckets: Yield, Reserve, Liquid, and Payments. Capital flows between these buckets automatically based on treasury rules you configure. Outbound payments execute through a queue that the AI policy engine approves against your on-chain caps.

---

## Bounty Tracks

This project was built for [Colosseum Frontier](https://arena.colosseum.org) and qualifies for the following side tracks:

**Jupiter — Not Your Regular Bounty**
ACE integrates Jupiter Swap V2, Price API, and Recurring (DCA) to execute automated rebalancing inside the vault. When the yield bucket overflows, ACE routes the surplus through Jupiter to the configured reserve token. Limit orders via Jupiter Trigger are queued and executed by the AI policy engine based on cap rules. The integration lives in `src/lib/adapters/` and `src/app/api/protocol/`.

**Cloak — Private Execution Layer**
The private transfers module uses the Cloak SDK to move USDC and USDT between shielded accounts without exposing amounts on-chain. Payroll-style batch disbursements fan out from the vault to recipient lists through a single shielded transaction. Viewing keys are generated per disbursement and surfaced in the audit UI so an admin or external auditor can verify the payment history without touching the ZK mechanics. See `src/app/(app)/private-transfers/` and `src/app/api/protocol/private-transfer/`.

**Tether / QVAC — Local AI Side Track**
The treasury intelligence layer uses QVAC for on-device LLM inference. Spending pattern analysis, anomaly detection, and natural-language treasury summaries run locally through `@qvac/sdk` — no data leaves the user's device, no cloud API key required. The QVAC chat interface lives at `/qvac`. The integration is in `src/app/(app)/qvac/` and `src/app/api/ai/chat/`.

**Encrypt + Ika — Bridgeless and Encrypted Capital Markets**
The architecture module exposes Ika dWallet support for cross-chain vault control and Encrypt FHE for confidential execution of treasury rules. This lets an organization use a Solana program as the control layer for assets sitting on other chains, with sensitive amounts never decrypted during execution. See `src/app/(app)/architecture/`.

---

## What the product does

You connect a Solana wallet. ACE scans your transaction history using Helius RPC and builds a treasury picture: recurring counterparties, spending categories, cash flow patterns, reserve health. From there you set allocation percentages across the four buckets and pick an operation mode.

**Safe mode** — every outbound transaction needs your approval. ACE queues the payment and notifies you.

**Autopilot mode** — ACE approves payments under your configured cap automatically. Anything over the cap comes back to you for a one-time signature.

The QVAC AI engine watches the vault in real time and surfaces insights: irregular spend, depleting reserves, counterparty concentration, yield opportunities. These appear in the dashboard and can be acted on directly.

---

## Program

- **Network:** Devnet (Mainnet migration ready)
- **Program ID:** `DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY`
- **Explorer:** [View on Solana Explorer](https://explorer.solana.com/address/DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY?cluster=devnet)

The vault PDA is derived per wallet: `[Buffer("vault"), owner.toBuffer()]` against the program ID. Payments are stored as PDAs too: `[Buffer("payment"), vault.toBuffer(), paymentId as u64 LE]`.

---

## Tech stack

- Next.js 16 (App Router, Turbopack)
- Solana / Anchor — `@coral-xyz/anchor`, `@solana/web3.js`
- Privy — wallet auth and embedded wallets
- Helius RPC — real on-chain transaction data
- Jupiter Developer Platform — Swap V2, Price, Recurring, Trigger
- Cloak SDK — `@cloak.dev/sdk` — shielded USDC/USDT transfers
- QVAC SDK — `@qvac/sdk` — local LLM inference for treasury analysis
- Recharts — data visualization
- Framer Motion — animations
- Fastify backend — `backend/server.ts`
- SQLite — local activity log via `better-sqlite3`

---

## Setup

### Prerequisites

- Node.js 20+
- A Privy app ID (get one at [privy.io](https://privy.io))
- A Helius API key (get one at [helius.dev](https://helius.dev))
- A Jupiter Developer Platform API key ([developers.jup.ag](https://developers.jup.ag))

### Environment

Create a `.env.local` in the project root:

```
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
HELIUS_API_KEY=your_helius_key
JUPITER_API_KEY=your_jupiter_key
NEXT_PUBLIC_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=your_helius_key
```

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

To run the Fastify backend alongside the frontend:

```bash
npm run backend:dev
```

The backend handles payment execution, vault state writes, and the QVAC inference endpoint.

---

## Key routes

| Path | What it is |
|------|------------|
| `/` | Landing page |
| `/dashboard` | Live vault overview, KPI cards, AI insights feed |
| `/treasury` | Transaction history, cash flow charts, spending analysis |
| `/payments` | Payment queue, scheduled disbursements |
| `/private-transfers` | Cloak-powered shielded transfer interface |
| `/qvac` | On-device AI chat with treasury context |
| `/staking` | Yield strategy config |
| `/settings` | Operation mode, allocation caps, wallet config |
| `/architecture` | Ika and Encrypt integration surface |

---

## Repository structure

```
src/
  app/
    (app)/          # Authenticated app shell routes
    api/            # Next.js API routes (vault, payments, treasury, AI)
    page.tsx        # Landing page
  components/
    charts/         # Recharts wrappers (YieldChart, AllocationChart)
    dashboard/      # InsightsFeed, CashflowSummary, ExecutionQuality
    treasury/       # TreasuryView, useTreasury hook
    layout/         # AppShell, navigation
  lib/
    adapters/       # Jupiter, Cloak, pay.sh, x402 adapters
    solana/         # Program constants, PDA helpers, vault state
    ai/             # QVAC policy engine
    store/          # Zustand protocol store
  types/            # Shared TypeScript types
backend/
  server.ts         # Fastify API server
```

---

## Demo

A walkthrough video is included in the submission covering:

1. Wallet connection and vault creation
2. Treasury scan and cash flow visualization
3. Autopilot mode with cap-based autonomous payments
4. A private batch disbursement through Cloak
5. QVAC treasury analysis (fully local, offline capable)
6. Jupiter Swap V2 rebalance triggered by yield overflow

---

## Contact

Built by the ACE Protocol team for Colosseum Frontier 2026.
