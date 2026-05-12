import crypto from 'crypto';
import { backendConfig } from '@root/backend/config';
import type { ScheduledPayment, X402SettlementRecord } from '@root/src/types';

export interface X402PolicyInput {
  wallet: string;
  payment: ScheduledPayment;
  reserveRatio: number;
  spendCapUsd: number;
}

export interface X402SettlementResult {
  ok: boolean;
  record: X402SettlementRecord;
}

export function settleX402Payment(input: X402PolicyInput): X402SettlementResult {
  const endpoint = input.payment.endpoint ?? '';
  const allowed = backendConfig.x402Allowlist.some((host) => endpoint.includes(host));
  const amount = input.payment.amountUsd;
  const overCap = amount > input.spendCapUsd;
  const lowReserve = input.reserveRatio < 15;

  let status: X402SettlementRecord['status'] = 'settled';
  let reason = 'HTTP 402 payment simulated and settled under treasury policy.';

  if (!allowed) {
    status = 'blocked';
    reason = 'Endpoint is not in the x402 allowlist.';
  } else if (overCap) {
    status = 'blocked';
    reason = 'x402 payment exceeds configured policy cap.';
  } else if (lowReserve) {
    status = 'blocked';
    reason = 'Reserve ratio is below the safe execution threshold.';
  }

  const record: X402SettlementRecord = {
    id: `x402-${crypto.randomUUID()}`,
    endpoint,
    wallet: input.wallet,
    amountUsd: amount,
    status,
    reason,
    paymentId: input.payment.id,
    idempotencyKey: input.payment.idempotencyKey ?? `idem-${input.payment.id}`,
    authorizationToken: status === 'settled' ? `x402_${crypto.randomUUID().replace(/-/g, '')}` : undefined,
    receipt: status === 'settled' ? `receipt_${crypto.randomUUID().replace(/-/g, '')}` : undefined,
    createdAt: Math.floor(Date.now() / 1000),
  };

  return {
    ok: status === 'settled',
    record,
  };
}
