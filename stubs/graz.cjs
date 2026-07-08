// Stub for the optional 'graz' (Cosmos) peer dependency.
// ACE Protocol only uses Para's Solana connector, so Para's Cosmos
// connector is never activated (no cosmosConnector config is passed).
// Para dynamically imports @getpara/cosmos-wallet-connectors, which
// statically imports 'graz'; this CJS stub satisfies that import at
// build time without pulling in the full Cosmos stack. Named imports
// resolve to undefined and are never called at runtime.
module.exports = {};
