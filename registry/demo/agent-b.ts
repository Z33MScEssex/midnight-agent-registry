// Agent B: finds an agent in the on-chain registry and calls it over A2A.
// Reading the registry needs no wallet and no fee: it is a query to the Preview indexer.
// Registry read: Topic 8 (decodeLedger, deriveState). A2A call: a2a-js cancellable-agent/client.ts (Topic 7),
// with the cancel timer removed and the text of the result printed.
//
//   MIDNIGHT_NETWORK=preview npx tsx demo/agent-b.ts "Echo agent" "hello there"
import fs from 'node:fs'; // read registry.json
import path from 'node:path'; // file paths
import { fileURLToPath } from 'node:url'; // %20-safe paths
import { WebSocket } from 'ws'; // WebSocket for Node
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'; // read-only chain access
import { ClientFactory, ClientFactoryOptions, JsonRpcTransportFactory } from '@a2a-js/sdk/client'; // A2A client
import { Role, taskStateToJSON, type SendMessageRequest } from '@a2a-js/sdk'; // message types
import { getConfig } from '../src/config.js'; // network endpoints
import pino from 'pino'; // logging for the wallet (template)
import { type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js'; // wallet config shape
import { startWallet, type MidnightWalletProvider } from '../src/wallet.js'; // template wallet, with transferNight
import { x402Client } from '@x402/core/client'; // x402 buyer client (Topic 6)
import { wrapFetchWithPayment } from '@x402/fetch'; // pays a 402 and retries (Topic 6)
import { MIDNIGHT_PREVIEW, NIGHT_ASSET, MidnightExactClient } from './midnight-x402.js'; // our Midnight scheme
import { decodeLedger, deriveState } from '../api/index.js'; // Topic 8 decoders

// @ts-expect-error WebSocket global assignment for apollo (template)
globalThis.WebSocket = WebSocket;

const here = path.dirname(fileURLToPath(import.meta.url)); // demo/ folder
const REGISTRY = JSON.parse(fs.readFileSync(path.resolve(here, 'registry.json'), 'utf8')).address as string;
const wanted = process.argv[2] ?? 'Echo agent'; // which agent to look for, by name
const text = process.argv[3] ?? 'hello'; // what to send it

// 1. Look the agent up on chain.
const config = getConfig(); // reads MIDNIGHT_NETWORK
const reader = indexerPublicDataProvider(config.indexer, config.indexerWS); // no wallet needed
const read = await reader.queryContractState(REGISTRY); // current registry state
if (!read) throw new Error(`No registry at ${REGISTRY}`);
const { agents } = deriveState(decodeLedger(read)); // every record, lowest ID first
console.log(`[AgentB] Registry ${REGISTRY.slice(0, 8)}... lists ${agents.length} agent(s):`);
for (const a of agents) console.log(`  #${a.id} ${a.name} | ${a.capabilities} | price ${a.price} | ${a.endpoint}`);

const matches = agents.filter((a) => a.name === wanted); // name search (OURS)
if (matches.length === 0) throw new Error(`No agent named "${wanted}" in the registry`);
const agent = matches[matches.length - 1]; // newest record with that name
console.log(`[AgentB] Chose #${agent.id} ${agent.name}, Agent Card at ${agent.endpoint}`);

// 2a. x402 payments. The cap is the price in Agent A's on-chain record, so Agent A cannot charge more (OURS).
let wallet: MidnightWalletProvider | undefined; // opened only if a payment is needed
const getWallet = async () => {
  if (!wallet) {
    console.log('[AgentB] Payment needed: starting wallet (first sync takes a few minutes)...');
    const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'warn', transport: { target: 'pino-pretty' } });
    const env: EnvironmentConfiguration = { walletNetworkId: config.networkId, ...config };
    wallet = await startWallet(logger, env, { network: 'preview', role: 'ALICE', faucet: config.faucet, syncTimeoutMs: 60 * 60_000 });
  }
  return wallet;
};
const payer = x402Client.fromConfig({ // Topic 6 "Spend Controls" pattern
  schemes: [{ network: MIDNIGHT_PREVIEW, client: new MidnightExactClient(getWallet, config.networkId) }],
  spendControls: {
    allowedAssets: [{ network: MIDNIGHT_PREVIEW, asset: NIGHT_ASSET, maxAmountPerPayment: agent.price.toString() }], // opt in to tNIGHT, capped
  },
});
const fetchWithPayment = wrapFetchWithPayment(fetch, payer); // Topic 6: handles 402 automatically
console.log(`[AgentB] Will pay at most ${agent.price} STAR per call (the on-chain price)`);

// 2b. Download its Agent Card from the endpoint the registry gave (client.ts: createFromUrl).
const factory = new ClientFactory(
  ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
    transports: [new JsonRpcTransportFactory({ fetchImpl: fetchWithPayment })], // A2A calls go through the payer (OURS)
  })
);
const client = await factory.createFromUrl(agent.endpoint, ''); // '' = the endpoint already is the card URL
const card = await client.getAgentCard(); // the card the agent serves
if (card.name !== agent.name) throw new Error(`Card name "${card.name}" does not match the registry record "${agent.name}"`); // OURS: refuse a mismatched card
console.log(`[AgentB] Card checked: "${card.name}" v${card.version} matches the on-chain record`);

// 3. Call it (client.ts: SendMessageRequest + sendMessageStream).
const params: SendMessageRequest = {
  tenant: '',
  metadata: {},
  message: {
    messageId: crypto.randomUUID(),
    role: Role.ROLE_USER,
    parts: [
      {
        content: { $case: 'text', value: text },
        metadata: undefined,
        filename: '',
        mediaType: 'text/plain',
      },
    ],
    taskId: '',
    contextId: '',
    extensions: [],
    metadata: {},
    referenceTaskIds: [],
  },
  configuration: undefined,
};

console.log(`[AgentB] Sending "${text}"`);
for await (const event of client.sendMessageStream(params)) {
  const payload = event.payload;
  if (!payload) continue;
  switch (payload.$case) {
    case 'task':
      console.log(`[AgentB] Task created id=${payload.value.id} state=${taskStateToJSON(payload.value.status!.state)}`);
      break;
    case 'statusUpdate':
      console.log(`[AgentB] statusUpdate state=${taskStateToJSON(payload.value.status!.state)}`);
      break;
    case 'artifactUpdate': {
      const parts = payload.value.artifact?.parts ?? []; // the result's parts
      const reply = parts.map((p) => (p.content?.$case === 'text' ? p.content.value : '')).join(''); // OURS: print the text
      console.log(`[AgentB] Reply from ${agent.name}: ${reply}`);
      break;
    }
    case 'message':
      console.log(`[AgentB] Received direct message event.`);
      break;
  }
}
console.log('[AgentB] Done.');
// Close the wallet if it was opened. Bounded: wallet.stop() hung after register-agent-a on 2026-11-26 (OURS).
if (wallet) await Promise.race([wallet.stop(), new Promise((r) => setTimeout(r, 10_000))]);
process.exit(0); // the indexer client keeps a socket open
