import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { patchVault } from '@root/services/treasuryService';
import type { Vault } from '@root/src/types';

export async function PATCH(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const patch = await req.json() as Partial<Vault>;
  return NextResponse.json(patchVault(session.wallet, patch));
}
