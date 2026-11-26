// In-memory tests for the agent registry: no network, no proofs.
// Pattern: template_ref/leaderboard.sim.test.ts (Topic 8 page, "Test the contract in memory").
// Run: npm run compile:fast, then npm run test:sim.

import { randomBytes } from 'node:crypto'; // random 32-byte secret keys
import { describe, expect, it } from 'vitest'; // test runner
import { Sim, assertNotInPublicState, expectRejects } from './sim.js'; // template's in-memory harness
import { Contract, ledger, pureCircuits } from '../../contract/managed/registry/contract/index.js'; // compiled contract
import { createRegistryPrivateState, witnesses } from '../../contract/witnesses.js'; // our witness

const bytes32 = () => new Uint8Array(randomBytes(32)); // a fresh secret key

const ALICE_SK = bytes32(); // operator of agent A
const BOB_SK = bytes32(); // operator of agent B

// Deploys a fresh registry with Alice as the caller (template's deploy()).
const deploy = () =>
  Sim.deploy({
    contract: new Contract(witnesses), // the compiled registry with our witness
    ledger, // decodes public state
    privateState: createRegistryPrivateState(ALICE_SK), // Alice's key
  });

// A sample record, the fields in circuit order.
const AGENT_A = ['Weather agent', 'Gives a forecast for a city', 'DATA', '1.0.0', 'http://localhost:41241/.well-known/agent-card.json', 1000n] as const;

describe('agent registry (in memory)', () => {
  it('starts empty', async () => {
    const l = (await deploy()).ledger(); // public state straight after deploy
    expect(l.agents.isEmpty()).toBe(true); // no records yet
    expect(l.nextId).toBe(0n); // counter not moved
  });

  it('registers an agent under ID 1 and returns that ID', async () => {
    const sim = await deploy();
    const { result, ledger: l } = await sim.call('register', ...AGENT_A); // Alice registers agent A
    expect(result).toBe(1n); // the circuit hands back the new ID
    expect(l.nextId).toBe(1n); // counter moved to 1
    const rec = l.agents.lookup(1n); // read the record back by ID (Topic 8: lookup)
    expect(rec.name).toBe('Weather agent');
    expect(rec.capabilities).toBe('DATA');
    expect(rec.endpoint).toBe(AGENT_A[4]); // the extension field survives intact, longer than 32 bytes
    expect(rec.price).toBe(1000n); // the extension field
    expect(rec.ownerHash).toEqual(pureCircuits.ownerCommitment(ALICE_SK)); // owner stored as a hash
  });

  it('gives each new agent the next counter ID', async () => {
    const sim = await deploy();
    await sim.call('register', ...AGENT_A); // ID 1, Alice
    sim.privateState = createRegistryPrivateState(BOB_SK); // act as Bob
    const { result, ledger: l } = await sim.call('register', 'Translator', 'Translates text', 'DATA', '0.1.0', 'http://localhost:41242/.well-known/agent-card.json', 0n);
    expect(result).toBe(2n); // second agent gets 2
    expect(l.agents.size()).toBe(2n); // two records
    expect(l.agents.lookup(2n).ownerHash).not.toEqual(l.agents.lookup(1n).ownerHash); // different owners
  });

  it('lets the owner update their record and keeps the owner', async () => {
    const sim = await deploy();
    await sim.call('register', ...AGENT_A);
    const { ledger: l } = await sim.call('updateRecord', 1n, 'Weather agent', 'Forecast and alerts', 'DATA', '1.1.0', 'https://weather.example/agent-card.json', 2500n);
    const rec = l.agents.lookup(1n);
    expect(rec.version).toBe('1.1.0'); // changed
    expect(rec.endpoint).toBe('https://weather.example/agent-card.json'); // changed
    expect(rec.price).toBe(2500n); // changed
    expect(rec.ownerHash).toEqual(pureCircuits.ownerCommitment(ALICE_SK)); // owner unchanged
    expect(l.nextId).toBe(1n); // an update does not make a new ID
  });

  it('rejects an update from another key and leaves the record alone', async () => {
    const sim = await deploy();
    await sim.call('register', ...AGENT_A);
    sim.privateState = createRegistryPrivateState(BOB_SK); // Bob tries to hijack agent 1
    await expectRejects(() => sim.call('updateRecord', 1n, 'Hijacked', 'x', 'x', 'x', 'https://evil.example', 0n), 'not the owner');
    expect(sim.ledger().agents.lookup(1n).endpoint).toBe(AGENT_A[4]); // endpoint not redirected
  });

  it('rejects an update to an ID that does not exist', async () => {
    const sim = await deploy();
    await expectRejects(() => sim.call('updateRecord', 7n, 'a', 'b', 'c', 'd', 'e', 0n), 'agent not found');
  });

  it('lets the owner prove ownership, and rejects anyone else', async () => {
    const sim = await deploy();
    await sim.call('register', ...AGENT_A);
    await sim.call('verifyOwnership', 1n); // Alice: passes
    sim.privateState = createRegistryPrivateState(BOB_SK);
    await expectRejects(() => sim.call('verifyOwnership', 1n), 'not the owner'); // Bob: refused
  });

  it('lists every agent by walking the map', async () => {
    const sim = await deploy();
    await sim.call('register', ...AGENT_A);
    await sim.call('register', 'Translator', 'Translates text', 'DATA', '0.1.0', 'http://localhost:41242/.well-known/agent-card.json', 0n);
    // Topic 8 deriveState: iterate the map. Map order is not insertion order, so sort by ID.
    const names = [...sim.ledger().agents].sort((a, b) => Number(a[0] - b[0])).map(([, r]) => r.name);
    expect(names).toEqual(['Weather agent', 'Translator']);
  });

  it('never puts a secret key in public state', async () => {
    const sim = await deploy();
    await sim.call('register', ...AGENT_A);
    await sim.call('updateRecord', 1n, ...AGENT_A);
    sim.privateState = createRegistryPrivateState(BOB_SK);
    await sim.call('register', ...AGENT_A);
    assertNotInPublicState(sim.ledger(), { aliceSecretKey: ALICE_SK, bobSecretKey: BOB_SK }); // template's leak check
  });
});
