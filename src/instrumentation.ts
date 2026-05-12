// Next.js instrumentation hook — runs once when the server starts.
// Pre-initializes the SQLite database so the first wallet connection
// doesn't hit a cold-start error on the auth/nonce endpoint.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import keeps this out of the edge runtime bundle
    const { getDb } = await import('../backend/db');
    try {
      getDb(); // Opens and migrates the DB
    } catch {
      // Non-fatal: if the DB can't open here, the API routes will surface the error properly
    }
  }
}
