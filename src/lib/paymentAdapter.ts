// ============================================================
// ACE Protocol — Payment Adapter
//
// Validates payments against real vault state before allowing
// execution. Simulates payment rail (Sphere-inspired).
// Production: replace executePayment body with real SPL transfer.
// ============================================================

import type { ScheduledPayment, Vault } from '@/types';

export type PaymentValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface PaymentExecutionResult {
  success: boolean;
  txSig?: string;
  failureReason?: string;
  reserveAfter: number;
  liquidAfter: number;
}

/**
 * Validate payment against live vault state.
 * Returns failure reason if payment cannot proceed.
 */
export function validatePayment(
  payment: ScheduledPayment,
  vault: Vault,
): PaymentValidationResult {
  // Check payment is still scheduled
  if (payment.status !== 'scheduled') {
    return { ok: false, reason: `Payment is already ${payment.status}.` };
  }

  // Check reserve sufficiency
  if (payment.amountUsd > vault.reserveBalance + vault.liquidBalance) {
    return {
      ok: false,
      reason: `Insufficient funds. Need $${payment.amountUsd.toFixed(2)}, available $${(vault.reserveBalance + vault.liquidBalance).toFixed(2)}.`,
    };
  }

  // Check idempotency (would already be caught by status check, but be explicit)
  if (payment.executedAt !== undefined) {
    return { ok: false, reason: 'Payment has already been executed (duplicate prevention).' };
  }

  return { ok: true };
}

/**
 * Simulate executing a payment.
 * Deducts from reserve first, then liquid.
 * Returns updated balances so UI can update state.
 */
export function simulatePaymentExecution(
  payment: ScheduledPayment,
  vault: Vault,
): PaymentExecutionResult {
  const validation = validatePayment(payment, vault);
  if (!validation.ok) {
    return {
      success: false,
      failureReason: validation.reason,
      reserveAfter: vault.reserveBalance,
      liquidAfter: vault.liquidBalance,
    };
  }

  // Deduct from reserve first, overflow from liquid
  let remaining = payment.amountUsd;
  let reserveAfter = vault.reserveBalance;
  let liquidAfter = vault.liquidBalance;

  if (reserveAfter >= remaining) {
    reserveAfter -= remaining;
    remaining = 0;
  } else {
    remaining -= reserveAfter;
    reserveAfter = 0;
    liquidAfter -= remaining;
  }

  // Simulate a devnet tx hash
  const fakeHash = Array.from({ length: 44 }, (_, i) =>
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[
      Math.floor(Math.abs(Math.sin(i * 999 + payment.amountUsd * 123)) * 58)
    ],
  ).join('');

  return {
    success: true,
    txSig: fakeHash,
    reserveAfter,
    liquidAfter,
  };
}
