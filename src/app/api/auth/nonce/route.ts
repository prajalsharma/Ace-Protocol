// Deprecated — nonce/SIWS challenge flow removed in favour of Para auth.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Auth is handled by Para.' },
    { status: 410 },
  );
}
