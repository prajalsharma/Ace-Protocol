import { NextRequest, NextResponse } from 'next/server';
import { issueSignInChallenge } from '@root/services/sessionService';

// GET /api/auth/nonce?wallet=<base58> — issue a stateless sign-in challenge.
export function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ error: 'wallet query param is required' }, { status: 400 });
  }
  try {
    return NextResponse.json(issueSignInChallenge(wallet));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not issue challenge' },
      { status: 400 },
    );
  }
}
