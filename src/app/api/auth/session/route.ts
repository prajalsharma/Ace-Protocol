import { NextRequest, NextResponse } from 'next/server';
import { createSessionFromSignature, getSessionFromAuthHeader } from '@root/services/sessionService';

// GET — validate an existing session JWT
export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 });
  }
  return NextResponse.json(session);
}

// POST — exchange a signed sign-in challenge (SIWS) for a session JWT
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    wallet?: string;
    nonce?: string;
    iat?: number;
    nonceSig?: string;
    signature?: string;
  } | null;

  if (!body?.wallet || !body.nonce || body.iat == null || !body.nonceSig || !body.signature) {
    return NextResponse.json(
      { error: 'wallet, nonce, iat, nonceSig and signature are required' },
      { status: 400 },
    );
  }

  try {
    const session = createSessionFromSignature({
      wallet: body.wallet,
      nonce: body.nonce,
      iat: Number(body.iat),
      nonceSig: body.nonceSig,
      signature: body.signature,
    });
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Session creation failed' },
      { status: 401 },
    );
  }
}
