/**
 * 
 * ACE Protocol — Devnet Transaction Seeder
 *
 * Creates REAL on-chain devnet transactions so the ACE treasury dashboard
 * has genuine wallet history to fetch, parse, and analyze.
 *
 * Usage:
 *   npm run seed:devnet            → show wallet info + balances
 *   npm run seed:devnet --run      → execute all transactions
 *
 * ⚠️  Devnet funds only — no real SOL at risk.
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── ESM-safe __dirname ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── CLI args ──────────────────────────────────────────────────────────────────
const RUN_MODE = process.argv.includes('--run');

// ── Load pre-generated wallets ────────────────────────────────────────────────
const WALLETS_FILE = resolve(__dirname, '.devnet-wallets.json');
const WALLETS = JSON.parse(readFileSync(WALLETS_FILE, 'utf-8')) as {
  treasury: { address: string; key: string };
  clientA:  { address: string; key: string };
  clientB:  { address: string; key: string };
};

const treasury = Keypair.fromSecretKey(bs58.decode(WALLETS.treasury.key));
const clientA  = Keypair.fromSecretKey(bs58.decode(WALLETS.clientA.key));

// ── RPC ───────────────────────────────────────────────────────────────────────
const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC ?? clusterApiUrl('devnet');

const connection = new Connection(DEVNET_RPC, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60_000,
});

const TX_DELAY_MS = 1400;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function getSol(kp: Keypair): Promise<number> {
  return (await connection.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL;
}

async function transfer(
  from: Keypair,
  to: PublicKey,
  solAmount: number,
  label: string,
): Promise<void> {
  const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports }),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [from], {
    commitment: 'confirmed',
  });
  console.log(`  ✔ ${label.padEnd(34)} ${solAmount.toFixed(4)} SOL  [${sig.slice(0, 14)}…]`);
  await sleep(TX_DELAY_MS);
}

// ── Info mode ─────────────────────────────────────────────────────────────────

async function printInfo() {
  const [tBal, caBal, cbBal] = await Promise.all([
    connection.getBalance(treasury.publicKey),
    connection.getBalance(clientA.publicKey),
    connection.getBalance(Keypair.fromSecretKey(bs58.decode(WALLETS.clientB.key)).publicKey),
  ]);
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACE Protocol · Devnet Seeder — Wallet Info
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  WALLETS
  ───────
  treasury  ${treasury.publicKey.toBase58()}   ${(tBal / LAMPORTS_PER_SOL).toFixed(4)} SOL
  clientA   ${clientA.publicKey.toBase58()}   ${(caBal / LAMPORTS_PER_SOL).toFixed(4)} SOL
  clientB   ${WALLETS.clientB.address}   ${(cbBal / LAMPORTS_PER_SOL).toFixed(4)} SOL

  Need at least: treasury ≥ 1.5 SOL, clientA ≥ 1.0 SOL
  Fund at: https://faucet.solana.com

  TREASURY WALLET — IMPORT INTO YOUR WALLET APP
  ───────────────────────────────────────────────
  Address     : ${treasury.publicKey.toBase58()}
  Private key : ${WALLETS.treasury.key}

  Then run:  npm run seed:devnet --run

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

// ── Run mode ──────────────────────────────────────────────────────────────────

async function runSeed() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACE Protocol · Devnet Transaction Seeder  [--run]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  // ── Check balances ───────────────────────────────────────────────────────
  console.log('◆ Checking balances…');
  const tBal  = await getSol(treasury);
  const caBal = await getSol(clientA);
  console.log(`  treasury  ${tBal.toFixed(4)} SOL`);
  console.log(`  clientA   ${caBal.toFixed(4)} SOL\n`);

  if (tBal  < 1.5) throw new Error(`Treasury has only ${tBal.toFixed(4)} SOL — fund at https://faucet.solana.com`);
  if (caBal < 1.0) throw new Error(`clientA has only ${caBal.toFixed(4)} SOL — fund at https://faucet.solana.com`);

  // ── Generate fresh ephemeral counterparties (receive-only, no sends) ────────
  const payroll  = Keypair.generate();
  const vendorA  = Keypair.generate();
  const vendorB  = Keypair.generate();
  const protocol = Keypair.generate();
  const reserveVault = Keypair.generate();

  // ── INCOMING: clientA → treasury (revenue / invoices) ───────────────────────
  console.log('◆ Incoming — clientA revenue → treasury…');
  await transfer(clientA, treasury.publicKey, 0.30, 'Client A — Invoice #001');
  await transfer(clientA, treasury.publicKey, 0.30, 'Client A — Invoice #002');
  await transfer(clientA, treasury.publicKey, 0.30, 'Client A — Invoice #003');

  // ── OUTGOING: payroll (recurring, same address → ACE detects the pattern) ───
  console.log('\n◆ Outgoing — payroll (5× same recipient, recurring)…');
  await transfer(treasury, payroll.publicKey, 0.12, 'Payroll — Week 1');
  await transfer(treasury, payroll.publicKey, 0.12, 'Payroll — Week 2');
  await transfer(treasury, payroll.publicKey, 0.12, 'Payroll — Week 3');
  await transfer(treasury, payroll.publicKey, 0.12, 'Payroll — Week 4');
  await transfer(treasury, payroll.publicKey, 0.12, 'Payroll — Week 5');

  // ── OUTGOING: vendor / SaaS bills (two vendors, recurring) ──────────────────
  console.log('\n◆ Outgoing — vendor & SaaS bills (recurring)…');
  await transfer(treasury, vendorA.publicKey, 0.04, 'Vendor A — Infra bill #1');
  await transfer(treasury, vendorB.publicKey, 0.05, 'Vendor B — Tooling sub #1');
  await transfer(treasury, vendorA.publicKey, 0.04, 'Vendor A — Infra bill #2');
  await transfer(treasury, vendorB.publicKey, 0.05, 'Vendor B — Tooling sub #2');
  await transfer(treasury, vendorA.publicKey, 0.04, 'Vendor A — Infra bill #3');

  // ── OUTGOING: protocol fees (small, varied) ──────────────────────────────────
  console.log('\n◆ Outgoing — protocol interaction fees…');
  await transfer(treasury, protocol.publicKey, 0.002, 'Protocol fee — op #1');
  await transfer(treasury, protocol.publicKey, 0.002, 'Protocol fee — op #2');
  await transfer(treasury, protocol.publicKey, 0.003, 'Protocol fee — op #3');
  await transfer(treasury, protocol.publicKey, 0.002, 'Protocol fee — op #4');

  // ── OUTGOING: internal reserve rebalance ─────────────────────────────────────
  console.log('\n◆ Outgoing — internal treasury rebalance…');
  await transfer(treasury, reserveVault.publicKey, 0.12, 'Treasury → Reserve vault #1');
  await transfer(treasury, reserveVault.publicKey, 0.12, 'Treasury → Reserve vault #2');

  // ── Done ────────────────────────────────────────────────────────────────────
  const finalBal = await getSol(treasury);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Seeding complete — 23 real devnet transactions created
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Final treasury balance : ${finalBal.toFixed(4)} SOL

  YOUR DEVNET TREASURY WALLET
  ────────────────────────────
  Address     : ${treasury.publicKey.toBase58()}
  Private key : ${WALLETS.treasury.key}

  NEXT STEPS
  ──────────
  1. Import private key into Phantom / Solflare (if not done yet)
     Settings → Manage Wallets → Add Wallet → Import Private Key
  2. Switch wallet to Devnet
  3. Open ACE dashboard → toggle "Devnet" → connect this wallet
     The treasury engine will fetch & classify all 23 transactions

  Verify on Solana Explorer:
  https://explorer.solana.com/address/${treasury.publicKey.toBase58()}?cluster=devnet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

// ── Entry ─────────────────────────────────────────────────────────────────────

if (RUN_MODE) {
  runSeed().catch((err) => {
    console.error('\n✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
} else {
  printInfo().catch((err) => {
    console.error('\n✗', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
