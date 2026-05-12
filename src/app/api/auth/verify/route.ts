// Deprecated — signature verification removed in favour of Privy auth.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Auth is handled by Privy.' },
    { status: 410 },
  );
}
