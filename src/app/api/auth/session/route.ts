import { NextRequest, NextResponse } from 'next/server';
import { createSessionFromPrivyToken, getSessionFromAuthHeader } from '@root/services/sessionService';

// GET — validate an existing session JWT
export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 });
  }
  return NextResponse.json(session);
}

// POST — exchange a Privy access token for a session JWT
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    privyToken?: string;
    wallet?: string;
  } | null;

  if (!body?.privyToken || !body.wallet) {
    return NextResponse.json({ error: 'privyToken and wallet are required' }, { status: 400 });
  }

  try {
    const session = await createSessionFromPrivyToken(body.privyToken, body.wallet);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Session creation failed' },
      { status: 401 },
    );
  }
}
