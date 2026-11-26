// Network test for the agent registry: the in-memory flow again, through RegistryAPI,
// with a real wallet, real proofs and the Preview indexer.
// Template: template_ref/leaderboard.test.ts.txt (midnight-examples leaderboard).
//
//   MIDNIGHT_PREVIEW_ALICE_SEED=... npm run test:preview
//
// LOCAL CHANGE: the template funds two wallets (Alice, Bob). We have one funded wallet, and record
// ownership comes from the secret key, not the wallet, so one wallet pays for both "owners" and
// each owner is a different secret key with its own private-state store.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'; // test runner
import { randomBytes } from 'node:crypto'; // fresh secret keys
import { WebSocket } from 'ws'; // WebSocket for Node
import { type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js'; // wallet config shape
import pino from 'pino'; // logging
import { firstValueFrom } from 'rxjs'; // read one value from the live state stream

import { getConfig } from '../config.js'; // network endpoints
import { MidnightWalletProvider, startWallet } from '../wallet.js'; // template wallet
import { buildProviders } from '../providers.js'; // template providers
import { RegistryAPI, lookupAgent, type RegistryProviders } from '../../api/index.js'; // our API
import { pureCircuits } from '../../contract/index.js'; // off-chain ownerCommitment
import { assertNotInPublicState } from './sim.js'; // template leak check

// Required for GraphQL subscriptions in Node.js (template)
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', transport: { target: 'pino-pretty' } });

const network = process.env['MIDNIGHT_NETWORK'] ?? 'local'; // which network
const syncTimeoutMs = Number(process.env['MIDNIGHT_SYNC_TIMEOUT_MS'] ?? 60 * 60_000); // first sync can be slow

const AGENT_A = {
  name: 'Weather agent',
  description: 'Gives a forecast for a city',
  capabilities: 'DATA',
  version: '1.0.0',
  endpoint: 'http://localhost:41241/.well-known/agent-card.json',
  price: 1000n,
};

describe(`Agent registry (${network})`, () => {
  let wallet: MidnightWalletProvider; // the one funded wallet
  let ownerProviders: RegistryProviders; // providers for owner A's key
  let otherProviders: RegistryProviders; // providers for owner B's key
  let ownerA: RegistryAPI; // agent A's operator
  let ownerB: RegistryAPI; // a different operator
  let agentId: bigint; // ID handed back by register

  const config = getConfig();
  const skA = new Uint8Array(randomBytes(32)); // owner A's secret key
  const skB = new Uint8Array(randomBytes(32)); // owner B's secret key

  beforeAll(async () => {
    const envConfig: EnvironmentConfiguration = {
      walletNetworkId: config.networkId,
      networkId: config.networkId,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };
    wallet = await startWallet(logger, envConfig, { network, role: 'ALICE', faucet: config.faucet, syncTimeoutMs });
    ownerProviders = buildProviders(wallet, config); // own private-state store
    otherProviders = buildProviders(wallet, config); // a second, separate store
  });

  afterAll(async () => {
    if (wallet) await wallet.stop();
  });

  it('deploys an empty registry', async () => {
    ownerA = await RegistryAPI.deploy(ownerProviders, skA, logger);
    logger.info(`Registry deployed at: ${ownerA.deployedContractAddress}`);
    const l = await ownerA.readLedger();
    expect(l.agents.isEmpty()).toBe(true);
    expect(l.nextId).toBe(0n);
  });

  it('agent A registers and gets ID 1', async () => {
    agentId = await ownerA.register(AGENT_A);
    expect(agentId).toBe(1n);
    const rec = lookupAgent(await ownerA.readLedger(), agentId);
    expect(rec?.endpoint).toBe(AGENT_A.endpoint);
    expect(rec?.price).toBe(1000n);
  });

  it('a second party joins and finds agent A by ID', async () => {
    ownerB = await RegistryAPI.join(otherProviders, ownerA.deployedContractAddress, skB, logger);
    const state = await firstValueFrom(ownerB.state$);
    expect(state.agentCount).toBe(1);
    expect(state.agents[0].name).toBe('Weather agent');
  });

  it('the owner updates the endpoint and price', async () => {
    await ownerA.updateRecord(agentId, { ...AGENT_A, version: '1.1.0', endpoint: 'https://weather.example/agent-card.json', price: 2500n });
    const l = await ownerA.readLedger();
    const rec = l.agents.lookup(agentId);
    expect(rec.endpoint).toBe('https://weather.example/agent-card.json');
    expect(rec.price).toBe(2500n);
    expect(rec.ownerHash).toEqual(pureCircuits.ownerCommitment(skA));
  });

  it('another key cannot update the record', async () => {
    await expect(ownerB.updateRecord(agentId, { ...AGENT_A, endpoint: 'https://evil.example' })).rejects.toThrow(/not the owner/);
    expect((await ownerA.readLedger()).agents.lookup(agentId).endpoint).toBe('https://weather.example/agent-card.json');
  });

  it('no secret key appears in public state', async () => {
    assertNotInPublicState(await ownerA.readLedger(), { ownerKeyA: skA, ownerKeyB: skB });
  });
});
