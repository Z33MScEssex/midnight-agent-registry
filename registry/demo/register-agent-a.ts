// Puts Agent A's record in the registry on Preview, or updates it if Agent A is already registered.
// Wallet and providers: the template's startWallet/buildProviders (as in src/test/registry.test.ts).
// Contract calls: our RegistryAPI (api/index.ts).
//
//   MIDNIGHT_NETWORK=preview MIDNIGHT_PREVIEW_ALICE_SEED=... MIDNIGHT_WALLET_STATE=off npx tsx demo/register-agent-a.ts
import fs from 'node:fs'; // key and registration files
import path from 'node:path'; // file paths
import { randomBytes } from 'node:crypto'; // new owner key
import { fileURLToPath } from 'node:url'; // %20-safe paths (Topic 2 lesson)
import { WebSocket } from 'ws'; // WebSocket for Node
import pino from 'pino'; // logging
import { type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js'; // wallet config shape
import { AGENT_CARD_PATH } from '@a2a-js/sdk'; // '.well-known/agent-card.json'
import { getConfig } from '../src/config.js'; // network endpoints
import { startWallet } from '../src/wallet.js'; // template wallet
import { buildProviders } from '../src/providers.js'; // template providers
import { RegistryAPI, lookupAgent, type AgentFields } from '../api/index.js'; // our API

// @ts-expect-error WebSocket global assignment for apollo (template)
globalThis.WebSocket = WebSocket;

const here = path.dirname(fileURLToPath(import.meta.url)); // demo/ folder
const KEY_FILE = path.resolve(here, '..', '.agent-a-owner.key'); // Agent A's owner key, gitignored, owner-only
const REG_FILE = path.resolve(here, 'agent-a.registration.json'); // public facts: registry address and agent ID
const REGISTRY = JSON.parse(fs.readFileSync(path.resolve(here, 'registry.json'), 'utf8')).address as string; // which registry

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', transport: { target: 'pino-pretty' } });

// Same rule as wallet/src/seed.ts: create once with 'wx' (never overwrite), mode 600, never print.
function loadOrCreateOwnerKey(): Uint8Array {
  if (fs.existsSync(KEY_FILE)) return new Uint8Array(Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex'));
  const key = new Uint8Array(randomBytes(32)); // fresh 32-byte owner key
  fs.writeFileSync(KEY_FILE, Buffer.from(key).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
  logger.info(`New owner key saved to ${KEY_FILE} (owner-only).`);
  return key;
}

const baseUrl = process.env.AGENT_A_URL || 'http://localhost:41241/'; // must match agent-a.ts
const fields: AgentFields = {
  name: 'Echo agent', // same as the Agent Card
  description: 'Replies to a short text message. Demo agent for the Midnight agent registry.',
  capabilities: 'DATA', // MIP-0029 capability, as text
  version: '1.0.0',
  endpoint: new URL(AGENT_CARD_PATH, baseUrl).toString(), // full Agent Card URL
  price: BigInt(process.env.AGENT_A_PRICE ?? '0'), // per request; not charged until x402 (stretch)
};

const config = getConfig(); // reads MIDNIGHT_NETWORK
const env: EnvironmentConfiguration = { walletNetworkId: config.networkId, ...config }; // as scripts/wait-for-dust.ts does
const wallet = await startWallet(logger, env, {
  network: process.env['MIDNIGHT_NETWORK'] ?? 'local',
  role: 'ALICE', // the one funded wallet
  faucet: config.faucet,
  syncTimeoutMs: 60 * 60_000,
});
try {
  const ownerKey = loadOrCreateOwnerKey();
  const api = await RegistryAPI.join(buildProviders(wallet, config), REGISTRY, ownerKey, logger); // attach to the deployed registry
  const previous = fs.existsSync(REG_FILE) ? JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) : undefined;

  let agentId: bigint;
  if (previous && previous.registry === REGISTRY) {
    agentId = BigInt(previous.agentId); // already registered: update instead
    await api.updateRecord(agentId, fields);
    logger.info(`Updated agent ${agentId}`);
  } else {
    agentId = await api.register(fields); // new record, ID from the counter
    fs.writeFileSync(REG_FILE, JSON.stringify({ registry: REGISTRY, agentId: agentId.toString() }, null, 2) + '\n');
    logger.info(`Registered as agent ${agentId}`);
  }
  const rec = lookupAgent(await api.readLedger(), agentId); // read it back from the chain
  logger.info({ record: { ...rec, price: rec?.price.toString() } }, 'On-chain record');
} finally {
  await wallet.stop();
}
