# Build log

What was built, in order, and what each step proved. Topic numbers refer to
[`research_sources.md`](research_sources.md). Trimmed run logs are in [`logs/`](logs/).

## 1. Midnight developer setup (2026-11-25)

- **Compact compiler** installed with the official installer (compact 0.5.3), then pinned with
  `compact update 0.36.1`, the ledger 9 toolchain.
- **Proof server** running in Docker: `midnightntwrk/proof-server:9.0.2`, container
  `midnight-proof-server`.
  - Bound to `127.0.0.1:6300` on purpose, not all interfaces. The proof server sees private
    inputs in the clear, so it stays local.
  - After a reboot: `docker start midnight-proof-server`.
- **Browser wallet** (Lace) set to the Preview network, funded with 5,000 tNIGHT from the Preview
  faucet, and the tNIGHT registered for DUST. DUST pays transaction fees. This was only a first
  check; the code uses its own wallet (step 3).

## 2. Compact basics: hello-world locally (2026-11-25)

- Node 22 via nvm (`.nvmrc` says 22). Yarn 1.22.22 via `corepack enable`.
- Cloned `midnightntwrk/example-hello-world` (commit 8a3bd8b, Midnight.js 5.0.0). Not part of this
  repo; clone it yourself to repeat this step.
- Contract copied from Topic 2 and compiled. Every output file the docs list was produced.
- **First local test run failed, 2 of 2.** Cause: `contracts/index.ts` built a path with
  `new URL(import.meta.url).pathname`, which leaves a space as `%20`, so a folder name containing
  a space breaks it. Fixed with Node's `fileURLToPath`. **Second run: 2 of 2 passed.**
  Every path in this repo uses `fileURLToPath` for that reason.
  Log: [`logs/topic2_local_test.log`](logs/topic2_local_test.log).

## 3. A wallet the code controls (2026-11-25)

- Package [`wallet/`](../wallet): wallet SDK 2.0.1, Midnight.js protocol 5.0.1 (Topic 9).
- `npm run create` makes a master seed and writes it straight to `wallet/.env.preview`
  (mode 600, gitignored, never printed). The Topic 9 page prints the seed to the console; this
  build deliberately does not.
- Funded from the Preview faucet. `npm run register-dust` waited for the tNIGHT, synced, waited
  for enough DUST to pay its own fee, registered, and reached **11.45 DUST** in about 6 minutes.
  Log: [`logs/register_dust.log`](logs/register_dust.log).
- Log lines such as `RPC-CORE ... Normal Closure` and `API/INIT: FATAL` are harmless connection
  closures. The hello-world troubleshooting table lists them as "Not an error".

## 4. First deploy to Preview (2026-11-25)

- The hello-world tests run against **Preview** with the code's wallet. The seed was passed
  through the shell, never copied or printed.
- **2 of 2 passed** on the public test network. Contract
  `2b500cdbc179127045413736d4bbebd2292b62e76ecfadc263c6c8689ecf4b44`.
- That proved compile, deploy, call and read back work from TypeScript, paid by the code's own
  DUST. Log: [`logs/topic3_preview_test.log`](logs/topic3_preview_test.log).

## 5. The registry contract (2026-11-26)

Design choices: add an endpoint and a price to MIP-0029's fields, only the owner can update a
record, and IDs come from a counter. Reasons are in [`DESIGN.md`](DESIGN.md).

- [`registry/`](../registry) was started from `midnightntwrk/midnight-examples`
  `examples/leaderboard` (commit c37451a), which the Topic 8 tutorial links to. The template's
  original tests are kept in `registry/template_ref/` to show where the patterns came from.
- Contract [`registry.compact`](../registry/contract/registry.compact): circuits `register`,
  `updateRecord` and `verifyOwnership`.
- **In-memory tests: 9 of 9 passed** (`npm run test:sim`). They include: a different key cannot
  redirect an agent's endpoint; an update keeps the same owner and ID; no secret key appears in
  public state.
- **Preview network test: 6 of 6 passed** (`src/test/registry.test.ts`). It covers deploy,
  register (ID 1), a second party joins and finds the agent, the owner updates endpoint and price,
  another key's update is refused with "not the owner", and no secret key appears on chain.
  - Registry contract: **`05cb427aef81572d8b211ffb4f5ab6242b3c04f3604c0fb77dfa61d3c6235a8a`**
  - One funded wallet paid for both "owners". Ownership comes from the secret key, not the wallet.
  - Log: [`logs/registry_preview_test.log`](logs/registry_preview_test.log).
- Template changes are marked `LOCAL CHANGE` in the files:
  - the env-file root and the wallet-state folder;
  - the network test uses one wallet instead of two;
  - leaderboard names swapped for registry names.

## 6. Agent A and Agent B over A2A (2026-11-26)

- `@a2a-js/sdk` 1.3.0 (A2A spec 1.0) and Express 5.
- **Agent A** ([`demo/agent-a.ts`](../registry/demo/agent-a.ts)): the SDK's sample server with our
  Agent Card, "Echo agent". Its logic, [`agent_executor.ts`](../registry/demo/agent_executor.ts),
  is the SDK sample verbatim except for the import paths.
- **Registration** ([`demo/register-agent-a.ts`](../registry/demo/register-agent-a.ts)):
  - Agent A's owner key is made once (mode 600, gitignored, never printed).
  - A second run updates the record instead of registering again.
  - Result: **registered as agent 2**. Log: [`logs/register_agent_a.log`](logs/register_agent_a.log).
- **Agent B** ([`demo/agent-b.ts`](../registry/demo/agent-b.ts)):
  - It reads the registry from the indexer, which needs **no wallet and no fee**.
  - It picks an agent by name and downloads its Agent Card from the on-chain endpoint.
  - It refuses a card whose name differs from the record, then calls the agent.
  - Result: found #2, card checked, task SUBMITTED, WORKING, COMPLETED, reply received.
    Log: [`logs/agent_b_demo.log`](logs/agent_b_demo.log).
- Pointed at record #1, whose URL is made up, Agent B stops with `fetch failed`. That's the right
  outcome, but the message could be clearer.
- The A2A samples don't fit the template's `verbatimModuleSyntax` TypeScript rule. So the demo has
  its own `tsconfig.demo.json` with that rule off, and the sample code stays verbatim.

## 7. x402 payments on Midnight (2026-11-26)

Agent B now pays Agent A per call, in tNIGHT on Midnight, using the x402 protocol. Topics 10 to 13 in
[`research_sources.md`](research_sources.md) hold the sources.

- **Design, all from the x402 specs:** the `exact` scheme in the "client-submitted (payment proof)"
  family, which the generic `exact` spec says must use the `upfront` flow. Agent B pays first and sends
  the transaction identifier as proof. The facilitator looks it up on Midnight's indexer and claims it
  once (spec 7.2: settle may consist of "marking a transaction as used").
- [`demo/midnight-x402.ts`](../registry/demo/midnight-x402.ts): the scheme, written as the three
  plug-ins the x402 SDK defines (server, client, facilitator).
- [`demo/facilitator.ts`](../registry/demo/facilitator.ts): the x402 basic facilitator example with our
  scheme registered for `midnight:preview`.
- Agent A puts an x402 paywall on its A2A endpoint. Its Agent Card stays free.
- Agent B caps what it will pay at the price in Agent A's on-chain record.

Results on Preview:
1. **Unpaid call:** HTTP 402 with a spec-shaped `PAYMENT-REQUIRED` header (100,000 STAR, payTo Agent A, `upfront`).
2. **Overpriced paywall** (the record said 0, the paywall asked 100,000): the x402 SDK's spend control
   refused, and Agent B's wallet never opened. [`logs/x402_refusal_test.log`](logs/x402_refusal_test.log)
3. **Paid call, pass:** Agent B paid 100,000 STAR (0.1 tNIGHT) in transaction
   `0021c641126186897eb11d3937fc22e4235f96995a42a17eb0f8ea9f9dd164e7b4`. The facilitator confirmed the
   payer, recipient, asset and amount on the indexer, and Agent A answered.
   [`logs/x402_paid_test.log`](logs/x402_paid_test.log), [`logs/facilitator.log`](logs/facilitator.log)
4. **Replay refused:** the same proof sent again got 402 `payment_already_used`, and Agent A handled
   exactly one message.

Known limit: the spec asks each payment to be bound to one request. A Midnight public transfer carries
no memo, so this version uses the spec's fallback: one facilitator per receiving address, with a
single-use store. See [`DESIGN.md`](DESIGN.md#payments-x402).
