import Fastify from 'fastify';
import cors from '@fastify/cors';
import { backendConfig } from './config';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import {
  createPayment,
  dismissInsight,
  getProtocolState,
  patchPayment,
  patchVault,
  recordTransaction,
} from '@root/services/treasuryService';
import { executePaymentForWallet } from '@root/engine/paymentEngine';
import type { ScheduledPayment, TransactionRecord, Vault } from '@root/src/types';

const server = Fastify({ logger: true });

async function main() {
  await server.register(cors, { origin: true, credentials: true });

  server.get('/health', async () => ({ status: 'healthy', service: 'ace-backend' }));

  // Auth is handled by Privy + /api/auth/session (Next.js route).
  // These stubs return 410 so any legacy clients get a clear message.
  server.post('/auth/nonce', async (_req, reply) =>
    reply.code(410).send({ error: 'Deprecated. Auth is handled by Privy.' }),
  );
  server.post('/auth/verify', async (_req, reply) =>
    reply.code(410).send({ error: 'Deprecated. Auth is handled by Privy.' }),
  );

  server.get('/auth/session', async (request, reply) => {
    const session = getSessionFromAuthHeader(request.headers.authorization ?? null);
    if (!session) return reply.code(401).send({ error: 'invalid session' });
    return session;
  });

  server.get('/protocol/state/:wallet', async (request) => {
    const { wallet } = request.params as { wallet: string };
    return getProtocolState(wallet);
  });

  server.post('/protocol/payments/:wallet', async (request) => {
    const { wallet } = request.params as { wallet: string };
    const payment = request.body as ScheduledPayment;
    return createPayment(wallet, payment);
  });

  server.patch('/protocol/payments/:wallet/:paymentId', async (request) => {
    const { wallet, paymentId } = request.params as { wallet: string; paymentId: string };
    return patchPayment(wallet, paymentId, request.body as Partial<ScheduledPayment>);
  });

  server.post('/protocol/payments/:wallet/:paymentId/execute', async (request, reply) => {
    const { wallet, paymentId } = request.params as { wallet: string; paymentId: string };
    try {
      return await executePaymentForWallet(wallet, paymentId);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'execution failed' });
    }
  });

  server.patch('/protocol/vault/:wallet', async (request) => {
    const { wallet } = request.params as { wallet: string };
    return patchVault(wallet, request.body as Partial<Vault>);
  });

  server.post('/protocol/transactions/:wallet', async (request) => {
    const { wallet } = request.params as { wallet: string };
    return recordTransaction(wallet, request.body as TransactionRecord);
  });

  server.post('/protocol/insights/:wallet/:insightId/dismiss', async (request) => {
    const { wallet, insightId } = request.params as { wallet: string; insightId: string };
    dismissInsight(wallet, insightId);
    return { ok: true };
  });

  await server.listen({ port: backendConfig.port, host: backendConfig.host });
}

main().catch((error) => {
  server.log.error(error);
  process.exit(1);
});
