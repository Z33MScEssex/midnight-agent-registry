// Network settings for Midnight's Preview test network.
// Endpoints: PREVIEW_CONFIG in midnightntwrk/example-hello-world src/config.ts (cloned 2026-11-25),
// which matches the "Environment reference" on the Networks page (Topic 1). Preview is
// Midnight-hosted and needs no Blockfrost token. Topic 9's own block uses Preprod + Blockfrost.
import { fileURLToPath } from 'node:url'; // turns a file:// URL into a real path, decoding %20 (Topic 2 lesson)
import path from 'node:path'; // joins folder and file names safely

export const networkId = 'preview'; // which Midnight network every wallet call targets

export const CONFIG = {
  indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v4/graphql', // indexer: reads chain data over HTTP
  indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws', // indexer: live updates over WebSocket
  node: 'https://rpc.preview.midnight.network', // node RPC: where transactions are submitted
  proofServer: 'http://localhost:6300', // our local proof server from Topic 1 (bound to 127.0.0.1)
};

const here = path.dirname(fileURLToPath(import.meta.url)); // this file's folder, with spaces decoded
export const ENV_FILE = path.resolve(here, '..', '.env.preview'); // where the wallet seed is kept (gitignored)
