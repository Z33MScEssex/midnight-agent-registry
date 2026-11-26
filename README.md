# Agent registry on Midnight

AI agents that find, check and pay each other on a blockchain.

**Agent A** publishes a record on Midnight's Preview test network: what it does, where its
A2A Agent Card lives, and what it charges. **Agent B** reads the registry, finds Agent A, checks
its card against the on-chain record, **pays the on-chain price in tNIGHT using x402**, and calls it
over the Agent2Agent (A2A) protocol.

The record follows Midnight's proposed agent identity standard, **MIP-0029**, and extends it with
the two fields that standard leaves open: an **endpoint** and a **price**. Payment plugs Midnight
into x402 as a new network, through x402's documented extension points. Why, and how ownership and
payment work, are in [`docs/DESIGN.md`](docs/DESIGN.md).

## It works

Run on Midnight's Preview network, 2026-11-26 ([`docs/logs/x402_paid_test.log`](docs/logs/x402_paid_test.log)):

```
[AgentB] Registry 05cb427a... lists 2 agent(s):
  #1 Weather agent | DATA | price 2500 | https://weather.example/agent-card.json
  #2 Echo agent | DATA | price 100000 | http://localhost:41241/.well-known/agent-card.json
[AgentB] Chose #2 Echo agent, Agent Card at http://localhost:41241/.well-known/agent-card.json
[AgentB] Will pay at most 100000 STAR per call (the on-chain price)
[AgentB] Card checked: "Echo agent" v1.0.0 matches the on-chain record
[AgentB] Sending "hello, here is my payment"
[AgentB] Payment needed: starting wallet (first sync takes a few minutes)...
[x402] Paid 100000 STAR to mn_addr_preview1wejrdqkp... in transaction 0021c641126186897eb11d3937fc22e4235f96995a42a17eb0f8ea9f9dd164e7b4
[AgentB] Task created id=6d11dba5-5e8c-4967-a47c-24d306000614 state=TASK_STATE_SUBMITTED
[AgentB] statusUpdate state=TASK_STATE_WORKING
[AgentB] Reply from Echo agent: Hello World! Nice to meet you!
[AgentB] statusUpdate state=TASK_STATE_COMPLETED
```

- Registry contract on Preview: `05cb427aef81572d8b211ffb4f5ab6242b3c04f3604c0fb77dfa61d3c6235a8a`
- Contract tests: **9 of 9** in memory and **6 of 6** on the Preview network. They include a
  different key trying to redirect an agent's endpoint (refused) and a check that no secret key
  appears anywhere on chain.
- Payment checks on Preview:
  - an unpaid call gets HTTP 402;
  - a price above the on-chain record is refused before any money moves;
  - a paid call goes through (above);
  - **the same payment sent twice is refused** (`payment_already_used`).
- Record #1 was left by the network test. Its URL is made up on purpose.

## How it fits together

```
 Agent A                          Midnight (Preview)                    Agent B
 -------                          ------------------                    -------
 register(name, ..., endpoint, price) ─► registry contract
   (ZK proof, paid in DUST)              Map<ID, AgentRecord> ─ indexer ─► read records (free, no wallet)
                                                                          fetch Agent Card, check name
 x402 paywall ◄──────────────────────── A2A call ───────────────────────  (no payment yet)
   402 + PAYMENT-REQUIRED ─────────────────────────────────────────────►  price <= on-chain price?
                                         tNIGHT transfer ◄──────────────  pay Agent A
 facilitator ◄─ check on indexer,  ◄──── A2A call + PAYMENT-SIGNATURE ───  retry with transaction id
   claim once                                                              
 answer ───────────────────────────────────────────────────────────────►  reply
```

## Repo layout

| Folder | What it is |
|---|---|
| [`registry/contract/`](registry/contract) | `registry.compact`: the contract. `witnesses.ts` supplies the owner key to proofs. |
| [`registry/api/`](registry/api) | `RegistryAPI`: deploy, join, register, update, read. |
| [`registry/demo/`](registry/demo) | Agent A, its registration script, Agent B, the x402 Midnight scheme (`midnight-x402.ts`) and the facilitator. |
| [`registry/src/test/`](registry/src/test) | In-memory tests and the Preview network test. |
| [`wallet/`](wallet) | Makes and funds the wallet the code uses, and registers its tNIGHT for DUST. |
| [`docs/`](docs) | [`DESIGN.md`](docs/DESIGN.md), [`BUILD_LOG.md`](docs/BUILD_LOG.md), [`research_sources.md`](docs/research_sources.md), [`logs/`](docs/logs). |

## Run it

You need Node 22 (`nvm use` reads `.nvmrc`), Docker, and the Compact compiler 0.36.1
(`compact update 0.36.1`). Paying needs a funded Preview wallet with DUST (below).

```bash
# 1. Proof server, local only
docker run -d --name midnight-proof-server -p 127.0.0.1:6300:6300 \
  midnightntwrk/proof-server:9.0.2 midnight-proof-server

# 2. Compile the contract and run the in-memory tests (no network)
cd registry
npm install
npm run compile
npm run test:sim

# 3. The facilitator and Agent A, each in its own terminal
npm run facilitator
AGENT_A_PRICE=100000 npm run agent-a

# 4. Agent B in another: finds Agent A on Preview, pays it, calls it
MIDNIGHT_PREVIEW_ALICE_SEED="$(sed -n 's/^WALLET_SEED=//p' ../wallet/.env.preview)" \
  MIDNIGHT_MIN_DUST=5 npm run agent-b -- "Echo agent" "hello"
```

Agent B reads the registry with no wallet. It opens its wallet only when Agent A asks for payment, and
the first sync takes a few minutes. Agent A's receiving address is made the first time it starts.

**A funded Preview wallet**, also needed to register your own agent or deploy your own registry:

```bash
cd wallet && npm install
npm run create          # makes a seed in wallet/.env.preview (never printed), shows the address
# send tNIGHT to that address from https://faucet.preview.midnight.network/
npm run register-dust   # registers the tNIGHT so it generates DUST for fees

cd ../registry
MIDNIGHT_PREVIEW_ALICE_SEED="$(sed -n 's/^WALLET_SEED=//p' ../wallet/.env.preview)" \
  MIDNIGHT_MIN_DUST=5 AGENT_A_PRICE=100000 npm run register-agent-a
```

The Preview network test (`npm run test:preview`) takes the same seed variable and deploys a
fresh registry.

## Built on

- [MIP-0029](https://github.com/midnightntwrk/midnight-improvement-proposals/blob/main/mips/mip-0029-midnight-agent-identity-standard.md), Midnight Agent Identity Standard (Proposed)
- [midnight-examples `leaderboard`](https://github.com/midnightntwrk/midnight-examples): the
  registry started from this template (Apache-2.0). Changes are marked `LOCAL CHANGE` or `OURS`.
- [`@a2a-js/sdk`](https://github.com/a2aproject/a2a-js) 1.3.0, A2A spec 1.0: Agent A's server and
  Agent B's client follow its samples.
- [x402](https://github.com/x402-foundation/x402) v2 (`@x402/core`, `@x402/express`, `@x402/fetch`
  2.32.0): the `exact` scheme, client-submitted family, `upfront` flow. The facilitator follows the
  repo's basic example.
- Midnight.js 5.0.1, wallet SDK 2.0.1, Compact 0.36.1, ledger 9.

Every code pattern is traced to its source page in
[`docs/research_sources.md`](docs/research_sources.md). Code that is new design rather than a
source pattern is marked `OURS`.

## Limits

The main ones:
- names in the registry are not unique;
- Agent A runs on `localhost`;
- payments are not yet bound to one request (one facilitator per receiving address stands in for it).

The full list and next steps are in [`docs/DESIGN.md`](docs/DESIGN.md#known-limits).

## Licence

Apache-2.0, the same as the templates it builds on. See [`LICENSE`](LICENSE).
