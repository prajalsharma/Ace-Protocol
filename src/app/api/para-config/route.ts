import { NextResponse } from 'next/server';

// Serves Para's public client config at RUNTIME, so the app doesn't depend on
// NEXT_PUBLIC_PARA_API_KEY being inlined at build time (which breaks on build
// caches / env scoping on Vercel). The Para API key is a publishable client
// key — it is meant to be shipped to the browser, so returning it here is safe.
//
// Diagnostic: open /api/para-config on the deployment. If `apiKey` is empty,
// the environment variable isn't reaching this environment on your host.
export const dynamic = 'force-dynamic';

export function GET() {
  const apiKey =
    process.env.PARA_API_KEY ??
    process.env.NEXT_PUBLIC_PARA_API_KEY ??
    '';

  const environment =
    (process.env.PARA_ENVIRONMENT ??
      process.env.NEXT_PUBLIC_PARA_ENVIRONMENT ??
      'BETA').toUpperCase() === 'PROD'
      ? 'PROD'
      : 'BETA';

  return NextResponse.json({
    apiKey,
    environment,
    configured: /^(beta|prod)_/.test(apiKey),
  });
}
