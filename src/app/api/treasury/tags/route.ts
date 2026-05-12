import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { applyUserTag, getUserTags } from '@root/services/patternEngine';
import type { TagRequest, UserTag } from '@root/src/types';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tags = getUserTags(session.wallet);
  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json() as TagRequest;

  if (!body.tag) {
    return NextResponse.json({ error: 'tag is required' }, { status: 400 });
  }

  const tag: UserTag = {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
    wallet: session.wallet,
    targetAddress: body.targetAddress,
    txSignature: body.txSignature,
    tag: body.tag,
    label: body.label,
    note: body.note,
    createdAt: Math.floor(Date.now() / 1000),
  };

  applyUserTag(session.wallet, tag);
  return NextResponse.json({ ok: true, tag });
}
