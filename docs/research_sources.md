# Research sources

Every code pattern this project builds on, with where it came from and what it taught.

**Method:** each source page was found and read first. Its code blocks were then copied word for
word into "Code pattern from source", and the build uses only those patterns. Where something is
our own design rather than a source's, the code says `OURS`. The Midnight docs site blocks
automated downloads, so Midnight blocks were copied from the page source files in
github.com/midnightntwrk/midnight-docs and checked by SHA-256 against the live page.

**Fallback (not needed):** an Ethereum test network if Midnight could not be set up by
30 November 2026. Midnight worked, see `build_log.md`.

---

## Topic 1: Midnight developer setup
What to find: how to install the toolchain, get on the test network and get test tokens.
- URL: https://docs.midnight.network/getting-started/installation (toolchain)
  Also: https://docs.midnight.network/guides/acquire-tokens (test tokens)
  Also: https://docs.midnight.network/guides/networks-and-environments (endpoints, faucet URLs, Blockfrost token)
- Where on the page:
  - Installation page: "Install Compact", "Update the compiler version", "Verify the Compact installation", "Set up the proof server" > "Run the proof server", "Install the Compact VS Code extension".
  - Funding page ("Funding a wallet"): "Prerequisites", then "Getting tNIGHT from the faucet" > Procedure, then "Registering NIGHT for DUST generation in Lace" (the "Generate tDUST" step).
  - Networks page: "Environment reference" (endpoints and faucet URLs per network), "Blockfrost: the Preprod and Mainnet indexer and RPC provider", "Getting a Blockfrost project token", "Passing the token", and "Funding and transaction cost".
- What it taught:
  - Install: prerequisites are Chrome, VS Code and Docker Desktop (Linux/Mac; WSL for Windows). Compact is installed with an installer script and the compiler version is pinned with `compact update`. The proof server runs locally in Docker on port 6300. The installation page has no faucet instructions.
  - Faucet steps: copy your unshielded address (starts mn_addr_; the faucet rejects shielded and DUST addresses), open the faucet for your network, paste the address, complete the captcha and select "Request tokens". The page states 5,000 tNIGHT per request, rate limited. You then register the tNIGHT to generate tDUST, which pays fees. The funding page states no email requirement for the faucet. I could not read the faucet pages themselves (they load their content with JavaScript), so please open them and confirm what they ask for.
  - Why there are two Preview faucet addresses: the Environment reference lists both https://faucet.preview.midnight.network/ and https://midnight-tmnight-preview.nethermind.dev/ for Preview, and only https://midnight-tmnight-preprod.nethermind.dev/ for Preprod. The page does not say why there are two. The raw page source of both Preview addresses shows the same "Midnight Faucet" app configured for the preview network, so they look like two addresses for the same faucet. That is my reading of the page source, not something the docs state.
  - Where email or sign-up comes in: this is the Blockfrost token, not the faucet. Preprod and Mainnet indexer and RPC endpoints need a Blockfrost project token. Steps under "Getting a Blockfrost project token": sign up or sign in at blockfrost.io, create a project and select "Midnight Preprod", copy the project ID (starts with nightpreprod), store it in a gitignored .env file. The page does not mention an email requirement; it says only "Sign up or sign in". Preview does not need a token: the page says "Only the preview endpoints are Midnight-hosted and need no token."
  - Checked 2026-11-25 in Chrome: both Preview faucet addresses do appear under "Environment reference" (the first is also under "The Midnight networks", the second under "Network selection at a glance"). The reviewer's fetch missed the table; this reading stands.
  - Practical consequence: if you cannot get a Blockfrost token, Preview is the route that avoids it. The Topic 3 Preprod section assumes a token. Preview's endpoint addresses are in "Environment reference".
  - Ledger 9 caveat: Preview was relaunched as a new chain on 7 November 2026 (re-request tNIGHT and redeploy). Preprod upgraded in place on 9 November 2026 (re-register DUST).
- Code pattern from source: (transcribed 2026-11-25. The Midnight docs site blocks automated downloads, so each block was copied from the page's own source file in github.com/midnightntwrk/midnight-docs, then its SHA-256 was checked against the same block on the live page in Chrome. Every block matched.)

  Installation page, "Install Compact":

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

  Installation page, "Update your shell PATH":

```bash
source ~/.zshrc # for zsh
# or
source ~/.bashrc # for bash
```

  Installation page, "Update your shell PATH":

```bash
export PATH="$HOME/.local/bin:$PATH"
```

  Installation page, "Update the compiler version":

```bash
compact update 0.36.1
```

  Installation page, "Verify the Compact installation":

```bash
compact --version # print the version of Compact
compact compile --version # print the version of the compiler
which compact     # print the installation path
```

  Installation page, "Run the proof server":

```bash
docker run -p 6300:6300 -e MIDNIGHT_PROOF_SERVER_VERBOSE=true midnightntwrk/proof-server:9.0.2
```

  Networks page, "Getting a Blockfrost project token" (.env):

```bash
BLOCKFROST_PROJECT_ID=<your Midnight Preprod or Midnight Mainnet project ID>
```

  Networks page, "Passing the token" (config.ts):

```typescript
function withBlockfrostKey(url: string, projectId: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}project_id=${encodeURIComponent(projectId)}`;
}

function blockfrostProjectId(): string {
  const projectId = process.env.BLOCKFROST_PROJECT_ID?.trim();
  if (!projectId) throw new Error('BLOCKFROST_PROJECT_ID is not set.');
  return projectId;
}

export function preprodConfig() {
  const projectId = blockfrostProjectId();
  return {
    networkId: 'preprod',
    node: withBlockfrostKey('https://rpc.midnight-preprod.blockfrost.io', projectId),
    nodeWS: withBlockfrostKey('wss://rpc.midnight-preprod.blockfrost.io', projectId),
    indexer: withBlockfrostKey('https://midnight-preprod.blockfrost.io/api/v0', projectId),
    indexerWS: withBlockfrostKey('wss://midnight-preprod.blockfrost.io/api/v0/ws', projectId),
    proofServer: 'http://localhost:6300',
  } as const;
}

export function mainnetConfig() {
  const projectId = blockfrostProjectId();
  return {
    networkId: 'mainnet',
    node: withBlockfrostKey('https://rpc.midnight-mainnet.blockfrost.io', projectId),
    nodeWS: withBlockfrostKey('wss://rpc.midnight-mainnet.blockfrost.io', projectId),
    indexer: withBlockfrostKey('https://midnight-mainnet.blockfrost.io/api/v0', projectId),
    indexerWS: withBlockfrostKey('wss://midnight-mainnet.blockfrost.io/api/v0/ws', projectId),
    proofServer: 'http://localhost:6300',
  } as const;
}
```

  Funding page, "Getting tNIGHT from the faucet" > Procedure (the faucet's success message):

```text
Transaction submitted. You will shortly receive 5000 tNight in your wallet. This is the transaction ID: 00f15defb8d3...
```

## Topic 2: Compact smart contract basics
What to find: a minimal Compact contract that stores and reads a value, and how to compile it.
- URL: https://docs.midnight.network/getting-started/hello-world
- Where on the page:
  Headings "Write the contract" and "Compile the contract". The contract file comes from the example repo cloned under "Set up the project". "Test the contract on a local network" shows the value being read back; the test file path (src/test/hw.test.ts) appears in the sample output, not in the prose.
- What it taught:
  A minimal Compact contract with a public ledger field `message` and a circuit `storeMessage` that writes to it. Compile with `yarn compile`; the page describes the generated circuit and output files. The local-network test stores "Hello World!" and reads it back. It runs on a local network, not on Preview or Preprod. It stores one value only; see Topic 8 for storing many records.
- Code pattern from source: (transcribed 2026-11-25. The Midnight docs site blocks automated downloads, so each block was copied from the page's own source file in github.com/midnightntwrk/midnight-docs, then its SHA-256 was checked against the same block on the live page in Chrome. Every block matched.)

  "Set up the project":

```bash
git clone https://github.com/midnightntwrk/example-hello-world.git
cd example-hello-world
yarn install
```

  "Write the contract" (contracts/hello-world.compact):

```compact
pragma language_version 0.28;

export ledger message: Opaque<"string">;

export circuit storeMessage(newMessage: Opaque<"string">): [] {
  message = disclose(newMessage);
}
```

  "Compile the contract":

```bash
yarn compile
```

  "Test the contract on a local network":

```bash
yarn env:up
```

  "Test the contract on a local network":

```bash
yarn wait:dust
```

  "Test the contract on a local network":

```bash
yarn test:local
```

## Topic 3: Deploying and calling a contract from TypeScript
What to find: the Midnight client library (likely Midnight.js), deploying a contract, then
reading its state from a script.
- URL: https://docs.midnight.network/guides/deploy-and-operate
  Also (required, for ledger 9): https://docs.midnight.network/relnotes/ledger-9
  Also: https://docs.midnight.network/tutorials/leaderboard/api-layer (a ledger 9 TypeScript example, see Topic 8)
- Where on the page:
  Deploy page, top-level headings in page order: "Prerequisites"; "The transaction pipeline and its providers"; "Configuring providers for a contract" > Procedure (levelPrivateStateProvider, indexerPublicDataProvider, NodeZkConfigProvider, httpClientProofProvider); "Deploying a contract" > Procedure (CompiledContract.make, deployContract, findDeployedContract, callTx); "Promoting a deployment to Preprod" > Procedure; "Observing contract and chain state" > Procedure (queryContractState, ledger(state.data)).
  Ledger 9 page: "Ledger version on each network", "What DApp developers need to do", "Move to the ledger 9 SDK set", "Check your deployed contracts". Also read "Known issues" > "A trie insert can produce a malformed trie" and "Fixed issues" > "Contract state could fail to load after a map write": the registry is a Map.
  Leaderboard API page (ledger 9 template, use in place of the deploy page's ledger 8 code): "Run it against a live network" (`buildProviders`, all six providers plus `config`) and "LeaderboardAPI" (`deploy()` calls `deployContract(providers, {...})`). It runs against Preview, which needs no Blockfrost token.
- What it taught:
  - The Midnight.js flow: configure six providers (private state, public data/indexer, ZK config, proof, wallet, Midnight/submission), build a CompiledContract, call deployContract, keep the contract address, reconnect with findDeployedContract, and call a circuit with callTx. Reading is done from the indexer by querying contract state for the address and decoding it with the generated `ledger` function.
  - Caveat 1: the deploy page says "This page still uses ledger 8 versions, which no public network runs anymore." It links to the Ledger 9 upgrade page. That page lists the ledger 9 set: Midnight.js 5.0.1, Compact.js 3.0.2, Compact toolchain 0.36.1, Wallet SDK 2.0.1, and says Midnight.js 5 requires `providers.config` with networkId and ttlSeconds, and that `setNetworkId()` was removed. The deploy page's procedure uses setNetworkId, so expect to adapt it.
  - Caveat 2: the deploy page's example is a private-bid contract, not hello world. The callTx example calls a bidding circuit (placeBid), so you will need to substitute your own circuit name.
  - Caveat 3 (corrected 2026-11-25, checked against the page source): the Preprod procedure has one code block, in step 2, and it is bash (the `.env.preprod` file with the wallet seed and `BLOCKFROST_PROJECT_ID`). Steps 1, 3 and 4 have no code. Preprod needs a Blockfrost token (see Topic 1).
  - Second source on the same site: https://docs.midnight.network/guides/node-server-wallet (a Node.js service that deploys from a seed-based wallet, closest to a script-driven agent). Checked 2026-11-25: it is out of date. It carries the same ledger 8 banner as the deploy page, pins Midnight.js 4.1.1 and calls `setNetworkId`.
- Code pattern from source: (transcribed 2026-11-25. The Midnight docs site blocks automated downloads, so each block was copied from the page's own source file in github.com/midnightntwrk/midnight-docs, then its SHA-256 was checked against the same block on the live page in Chrome. Every block matched.)

  Ledger 9 template first (leaderboard API page), then the deploy page's ledger 8 steps, which show the flow but need adapting (Midnight.js 4, `setNetworkId`).

  Leaderboard API page, "Run it against a live network" (src/providers.ts: the six providers plus config):

```typescript
export function buildProviders(wallet: MidnightWalletProvider, config: NetworkConfig): LeaderboardProviders {
  const zkConfigProvider = new NodeZkConfigProvider<LeaderboardCircuitKeys>(zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `leaderboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      // this password has requirements (capital/special chars >= 3)
      privateStoragePasswordProvider: () => 'Leaderboard-Test-Password',
      accountId: wallet.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      config.proofServer,
      zkConfigProvider,
    ),
    // Midnight.js 5 providers are tagged with the ledger eras they serve. The
    // wallet is ledger 9 only; these lift it into the tagged interfaces.
    walletProvider: createLedger9WalletProvider(wallet),
    midnightProvider: createLedger9MidnightProvider((tx) => wallet.submitTx(tx)),
    config: { networkId: config.networkId, ttlSeconds: TX_TTL_SECONDS },
  };
}
```

  Leaderboard API page, "LeaderboardAPI" (deploy):

```typescript
  /** Deploys a new leaderboard contract. */
  static async deploy(providers: LeaderboardProviders, secretKey: Uint8Array, logger?: Logger): Promise<LeaderboardAPI> {
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledLeaderboardContract,
      privateStateId: leaderboardPrivateStateKey,
      initialPrivateState: createLeaderboardPrivateState(secretKey),
    });
    logger?.info({ address: deployedContract.deployTxData.public.contractAddress }, 'Deployed leaderboard');
    return new LeaderboardAPI(deployedContract, providers, logger);
  }
```

  Leaderboard API page, "LeaderboardAPI" (join an existing contract):

```typescript
  /** Joins an existing leaderboard contract. */
  static async join(
    providers: LeaderboardProviders,
    contractAddress: ContractAddress,
    secretKey: Uint8Array,
    logger?: Logger,
  ): Promise<LeaderboardAPI> {
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledLeaderboardContract,
      privateStateId: leaderboardPrivateStateKey,
      initialPrivateState: createLeaderboardPrivateState(secretKey),
    });
    logger?.info({ address: contractAddress }, 'Joined leaderboard');
    return new LeaderboardAPI(deployedContract, providers, logger);
  }
```

  Deploy page, "Deploying a contract" > Procedure (CompiledContract.make), ledger 8:

```typescript
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { Contract } from './managed/private-bid/contract/index.js';
import { witnesses } from './witnesses.js';

const compiled = CompiledContract.make('private-bid', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('/path/to/managed/private-bid'),
);
```

  Deploy page, "Deploying a contract" > Procedure (deployContract), ledger 8:

```typescript
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { createPrivateBidPrivateState } from './witnesses.js';

const privateState = createPrivateBidPrivateState(); // 32 random bytes as the bidder's secret key

const deployed = await deployContract(providers, {
  compiledContract: compiled,
  privateStateId: 'privateBidPrivateState',
  initialPrivateState: privateState,
  args: [100n], // constructor(minimum: Uint<64>)
});

const contractAddress = deployed.deployTxData.public.contractAddress;
```

  Deploy page, "Deploying a contract" > Procedure (findDeployedContract), ledger 8:

```typescript
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

const found = await findDeployedContract(providers, {
  contractAddress,
  compiledContract: compiled,
  privateStateId: 'privateBidPrivateState',
  initialPrivateState: privateState,
});
```

  Deploy page, "Deploying a contract" > Procedure (callTx), ledger 8:

```typescript
const call = await found.callTx.placeBid(250n);
// call.public.txId, call.public.blockHeight
```

  Deploy page, "Observing contract and chain state" > Procedure (read state), ledger 8:

```typescript
const state = await providers.publicDataProvider.queryContractState(contractAddress);
const bids = ledger(state.data);
// bids.minimumBid, bids.bidCommitments.size(), bids.revealedBids.lookup(bidderKey): typed getters, no manual decoding
```

  Ledger 9 page, "Confirm the upgrade":

```bash
curl -s -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"midnight_ledgerVersion","params":[]}' \
  "https://rpc.midnight-mainnet.blockfrost.io?project_id=$BLOCKFROST_PROJECT_ID"
```

## Topic 4: MIP-0029, the proposed Midnight Agent Identity Standard
What to find: what an agent record must contain. The advert says we may build on it, extend it
or do it differently.
- URL: https://github.com/midnightntwrk/midnight-improvement-proposals/blob/main/mips/mip-0029-midnight-agent-identity-standard.md
  Related: https://github.com/midnightntwrk/midnight-improvement-proposals/blob/main/mps/mps-0015-agent-identity.md
  Related: https://forum.midnight.network/t/rfc-mip-midnight-agent-identity-standard-mais/1231
- Where on the page:
  MIP-0029 (headings are as they appear on the page; "1." to "7." are the numbered subsections of "Specification", and "2.1" to "2.4" sit under "2. Identity Registry"):
  - "Specification" > "2. Identity Registry" > "2.4 Metadata Schema" (the record fields) and "2.3 Standard Interface" (exists, getMetadata, updateMetadata, and so on).
  - "2.1 Public Mode Registration" and "2.2 Private Mode Registration".
  - "7. Standard Interface Summary" (MAISAgent interface).
  - Under "Implementation" (the subsections are not numbered): "Existing Reference Implementation", "Dependencies" and "SDK Interface Design".
  - The status and metadata are in the table at the top of the file.
  MPS-0015: section "Open Questions", question 4.
  Forum thread: heading "Ecosystem Questions", question 9.
- What it taught:
  - Status is Proposed (not Accepted or Active), created 2026-05-18. It defines four registries: Identity, Reputation, Validation and Disclosure Tier.
  - The Metadata Schema has name, description, capabilities (PAYMENT, TRADING, GOVERNANCE, COMPLIANCE, DATA), version, optional homepage and optional erc8004TokenId.
  - Registration: public mode gives the agent a unique numeric AgentId (2.1). For private mode, 2.2 says only that the agent gets a unique AgentId, stored in private state, so "numeric" is stated for public mode only.
  - The schema has no field for a service endpoint or for what the agent charges. The related pages show this was raised as an open question: MPS-0015 Open Question 4 asks "Should agent metadata include a field for payment information such as what the agent charges and how to pay it?", and forum question 9 asks "Should agent metadata include a field for x402 payment info, like what the agent charges and how to pay it?" This is source material for your "extend it" angle.
  - "SDK Interface Design" is an illustrative sketch of usage, not an installable library. "Existing Reference Implementation" names midnight-agent-did-manager and says only its Identity Registry is functional.
  - Under "Acceptance Criteria", Accepted needs a tested testnet reference implementation, so details may still change.
- Code pattern from source: (transcribed 2026-11-25, copied byte for byte from raw.githubusercontent.com, branch main)

  MIP-0029, "2.3 Standard Interface":

```
// Query whether an agent exists, works for both modes
function exists(agentId: AgentId): bool

// Get public metadata, returns null for private agents
function getMetadata(agentId: AgentId): Metadata?

// Prove agent identity to a verifier
// Public mode returns the agent address from public state
// Private mode returns a ZK proof of credential knowledge
function proveIdentity(agentId: AgentId): IdentityProof

// Update metadata, operator only
function updateMetadata(agentId: AgentId, newMetadata: Metadata)

// Transfer operator control, needs multi sig or ZK proof
function transferOperator(agentId: AgentId, newOperator: CompactAddress, transferProof: TransferProof)

// Deactivate agent, operator only
function deactivate(agentId: AgentId)
```

  MIP-0029, "2.4 Metadata Schema":

```
struct Metadata {
    name: string,           // Human readable agent name
    description: string,    // What the agent does
    capabilities: [Capability],  // PAYMENT, TRADING, GOVERNANCE, COMPLIANCE, DATA
    version: string,        // Semantic version
    homepage: string?,      // Optional URL
    erc8004TokenId: u256?,  // Optional cross chain link to ERC-8004 NFT
}
```

  MIP-0029, "7. Standard Interface Summary":

```
interface MAISAgent {
    // Identity
    function getAgentId(): AgentId
    function getOperator(): CompactAddress
    function getMetadata(): Metadata
    function getIdentityMode(): IdentityMode  // PUBLIC or PRIVATE

    // Reputation
    function getReputationScore(): u8
    function getReputationTier(): ReputationTier
    function proveReputation(minScore: u8): ReputationProof

    // Validation
    function getValidators(): [ValidatorId]
    function getValidatorCount(): u16

    // Disclosure
    function getDisclosureTier(): DisclosureTier
    function isAuditor(auditorAddress: CompactAddress): bool

    // Cross chain (optional)
    function getErc8004TokenId(): u256?
    function isErc8004Linked(): bool
}
```

  MIP-0029, "SDK Interface Design" (an illustrative sketch, not an installable library):

```typescript
// Initialize agent identity
const agent = new MAISAgent({
  identityMode: 'public' | 'private',
  operator: midnightWallet,
  metadata: {
    name: 'TradingBot Alpha',
    description: 'Automated DEX arbitrage agent',
    capabilities: ['TRADING', 'PAYMENT'],
    version: '1.0.0',
  },
  disclosureTier: 'public',
  // Optional
  erc8004TokenId: 12345,
});

// Register on Midnight
await agent.register();

// Get reputation
const reputation = await agent.getReputation();
// => { score: 85, tier: 'PROVEN', evidenceCount: 42, lastUpdated: '2026-05-15' }

// Prove reputation, ZK proof that score meets threshold
const proof = await agent.proveReputation({ minScore: 60 });
// Submit proof to counterparty contract for verification

// Add evidence as validator
await validator.addEvidence({
  agentId: agent.id,
  evidence: { type: 'TRANSACTION_SUCCESS', positive: true },
  proof: observationProof,
});

// Read audit trail at auditor tier
const auditTrail = await agent.getAuditTrail({
  from: '2026-05-01',
  to: '2026-05-18',
  disclosureTier: 'auditor',
});
```

## Topic 5: Agent2Agent (A2A) protocol
What to find: the Agent Card (how an agent describes itself) and a minimal agent-to-agent call.
- URL: https://a2a-protocol.org/latest/specification/ (normative; Agent Card fields)
  Also: https://a2a-protocol.org/latest/topics/agent-discovery/ (how cards are discovered)
  Also: https://a2a-protocol.org/latest/tutorials/python/3-agent-skills-and-card/ (Agent Card in Python)
  Also: https://a2a-protocol.org/latest/tutorials/python/6-interact-with-server/ (minimal client call, Python)
- Where on the page:
  - Specification: "4.4.1. AgentCard" (fields), "4.4.6. AgentInterface" (url, protocolBinding, tenant, protocolVersion), "8.5. Sample Agent Card" (JSON example), "6.1. Basic Task Execution" (HTTP example: POST /message:send, labelled Request and Response), "9.4.1. SendMessage" (JSON-RPC; its params are only a placeholder, not a real message). Concrete JSON-RPC params appear under "9.4.3. GetTask" and "9.4.5. CancelTask", not SendMessage.
  - Discovery page: "The Role of the Agent Card", "1. Well-Known URI" (/.well-known/agent-card.json), "2. Curated Registries (Catalog-Based Discovery)".
  - Card tutorial: headings "Agent Skills" and "Agent Card" (variable public_agent_card).
  - Client tutorial: under the heading "Understanding the Client Code", the steps "Fetching the Agent Card" and "Initializing the Client & Sending a Non-Streaming Message" are numbered list labels, not headings (A2ACardResolver, get_agent_card(), create_client(), SendMessageRequest, send_message()).
- What it taught:
  - Correction: spec v1.0 section 4.4.1 AgentCard has no top-level `url` field. Its fields are name, description, supportedInterfaces, provider, version, documentationUrl, capabilities, securitySchemes, securityRequirements, defaultInputModes, defaultOutputModes, skills, signatures and iconUrl. The service address is the `url` inside each AgentInterface in `supportedInterfaces` (4.4.6), alongside protocolBinding and protocolVersion. The discovery page's prose still says the card has a service endpoint `url`; go with the spec. The Python card tutorial follows the spec (it uses a supported interface with a URL).
  - Cards are normally served at /.well-known/agent-card.json. The registry approach is described, but the spec does not define a registry API. A Midnight record could point to an agent's card address or interface.
  - Minimal call: fetch the card, create a client from it, build a text message with a user role, wrap it in a send-message request, send it.
  - The spec has no ready-made SendMessage JSON-RPC example. The concrete message example is the REST one in 6.1 (POST /message:send).
  - Skill-name inconsistency on the card tutorial: prose says "hello_world", code says id 'echo_bot'. Trust the code.
  - All of these pages are Python or language-neutral. For TypeScript, see Topic 7.
- Code pattern from source: (transcribed 2026-11-25, copied byte for byte from the fetched page)

  Specification, "8.5. Sample Agent Card":

```json
{
  "name": "GeoSpatial Route Planner Agent",
  "description": "Provides advanced route planning, traffic analysis, and custom map generation services. This agent can calculate optimal routes, estimate travel times considering real-time traffic, and create personalized maps with points of interest.",
  "supportedInterfaces": [
    {"url": "https://georoute-agent.example.com/a2a/v1", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"},
    {"url": "https://georoute-agent.example.com/a2a/grpc", "protocolBinding": "GRPC", "protocolVersion": "1.0"},
    {"url": "https://georoute-agent.example.com/a2a/json", "protocolBinding": "HTTP+JSON", "protocolVersion": "1.0"}
  ],
  "provider": {
    "organization": "Example Geo Services Inc.",
    "url": "https://www.examplegeoservices.com"
  },
  "iconUrl": "https://georoute-agent.example.com/icon.png",
  "version": "1.2.0",
  "documentationUrl": "https://docs.examplegeoservices.com/georoute-agent/api",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": true
  },
  "securitySchemes": {
    "google": {
      "openIdConnectSecurityScheme": {
        "openIdConnectUrl": "https://accounts.google.com/.well-known/openid-configuration"
      }
    }
  },
  "securityRequirements": [{ "schemes": { "google": { "list": ["openid", "profile", "email"] } } }],
  "defaultInputModes": ["application/json", "text/plain"],
  "defaultOutputModes": ["application/json", "image/png"],
  "skills": [
    {
      "id": "route-optimizer-traffic",
      "name": "Traffic-Aware Route Optimizer",
      "description": "Calculates the optimal driving route between two or more locations, taking into account real-time traffic conditions, road closures, and user preferences (e.g., avoid tolls, prefer highways).",
      "tags": ["maps", "routing", "navigation", "directions", "traffic"],
      "examples": [
        "Plan a route from '1600 Amphitheatre Parkway, Mountain View, CA' to 'San Francisco International Airport' avoiding tolls.",
        "{\"origin\": {\"lat\": 37.422, \"lng\": -122.084}, \"destination\": {\"lat\": 37.7749, \"lng\": -122.4194}, \"preferences\": [\"avoid_ferries\"]}"
      ],
      "inputModes": ["application/json", "text/plain"],
      "outputModes": [
        "application/json",
        "application/vnd.geo+json",
        "text/html"
      ]
    },
    {
      "id": "custom-map-generator",
      "name": "Personalized Map Generator",
      "description": "Creates custom map images or interactive map views based on user-defined points of interest, routes, and style preferences. Can overlay data layers.",
      "tags": ["maps", "customization", "visualization", "cartography"],
      "examples": [
        "Generate a map of my upcoming road trip with all planned stops highlighted.",
        "Show me a map visualizing all coffee shops within a 1-mile radius of my current location."
      ],
      "inputModes": ["application/json"],
      "outputModes": [
        "image/png",
        "image/jpeg",
        "application/json",
        "text/html"
      ]
    }
  ],
  "signatures": [
    {
      "protected": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpPU0UiLCJraWQiOiJrZXktMSIsImprdSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vYWdlbnQvandrcy5qc29uIn0",
      "signature": "QFdkNLNszlGj3z3u0YQGt_T9LixY3qtdQpZmsTdDHDe3fXV9y9-B3m2-XgCpzuhiLt8E0tV6HXoZKHv4GtHgKQ"
    }
  ]
}
```

  Specification, "6.1. Basic Task Execution" (Request):

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "What is the weather today?"}],
    "messageId": "msg-uuid"
  }
}
```

  Specification, "6.1. Basic Task Execution" (Response):

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "task-uuid",
    "contextId": "context-uuid",
    "status": {"state": "TASK_STATE_COMPLETED"},
    "artifacts": [{
      "artifactId": "artifact-uuid",
      "name": "Weather Report",
      "parts": [{"text": "Today will be sunny with a high of 75°F"}]
    }]
  }
}
```

  Card tutorial, "Agent Skills":

```python
# Defines the abilities or functions that agent can perform.
skill = AgentSkill(
    id='echo_bot',
    name='Echo Bot',
    description='An example agent that acknowledges client request and responds with a "Hello World" message.',
    input_modes=['text/plain'],
    output_modes=['text/plain'],
    tags=['a2a', 'echo-example'],
    examples=['hi', 'how are you'],
)
```

  Card tutorial, "Agent Card":

```python
# Define a public-facing agent card that allows clients to discover your agent's capabilities.
public_agent_card = AgentCard(
    # Basic identity information of A2A server
    name='Hello World Agent',  # Identity
    description='Just a hello world agent',
    version='0.0.1',
    # Default Media Types for the agent's interactions
    default_input_modes=['text/plain'],  # Supported media types
    default_output_modes=['text/plain'],
    # Supported A2A features (like streaming or extended config)
    capabilities=AgentCapabilities(streaming=True, extended_agent_card=True),
    # Ordered list of endpoints and protocols where the service can be reached
    supported_interfaces=[
        AgentInterface(
            protocol_binding='JSONRPC',
            url='http://127.0.0.1:9999',
            protocol_version='1.0',
        )
    ],
    # The list of AgentSkill objects that this agent offers
    skills=[skill],
    # Optional attributes (omitted here for simplicity):
    # icon_url                         -> A URL to an icon representing the agent
)
```

  Client tutorial, "Understanding the Client Code", step "Fetching the Agent Card":

```python
import httpx  # noqa: PLC0415

from a2a.client import A2ACardResolver  # noqa: PLC0415

# Initializes the A2ACardResolver instance with an HTTP client, base URL,
# and uses the default path for the agent card.
async with httpx.AsyncClient() as httpx_client:
    resolver = A2ACardResolver(
        httpx_client=httpx_client,
        base_url='http://127.0.0.1:9999',
        # Provide agent_card_path, if your agent uses a different path
        # agent_card_path=''  # noqa: ERA001
    )
    public_agent_card = await resolver.get_agent_card()
```

  Client tutorial, "Understanding the Client Code", step "Initializing the Client & Sending a Non-Streaming Message":

```python
from a2a.client import ClientConfig, create_client  # noqa: PLC0415
from a2a.helpers import new_text_message  # noqa: PLC0415
from a2a.types import Role, SendMessageRequest  # noqa: PLC0415

print('\nInitializing a non-streaming client.')
config = ClientConfig(streaming=False)
client = await create_client(agent=public_agent_card, client_config=config)

# Creates a new text message to be sent to the A2A Server.
# Ex: text_query = 'Why is the sky blue?'  # noqa: ERA001
message = new_text_message(text_query, role=Role.ROLE_USER)
request = SendMessageRequest(message=message)

print('Response:')
async for chunk in client.send_message(request):
    print(chunk)
```

## Topic 6 (stretch): x402 per-request payments
What to find: how a server asks for payment over HTTP 402 and how a client pays.
- URL: https://docs.x402.org/getting-started/quickstart-for-sellers (server)
  Also: https://docs.x402.org/getting-started/quickstart-for-buyers (client)
  Also: https://docs.x402.org/core-concepts/http-402 (the 402 flow and headers)
- Where on the page:
  - Sellers page: "Prerequisites", "2. Add Payment Middleware" (unpaid requests get HTTP 402 with a PAYMENT-REQUIRED header), "3. Test Your Integration" (retry with a PAYMENT-SIGNATURE header).
  - Buyers page: "Prerequisites", "2. Create a Wallet Signer", "3. Make Paid Requests Automatically" (wrapFetchWithPayment, wrapAxiosWithPayment), "Spend Controls".
  - Core concepts page: "Payment Headers in V2" (PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE).
- What it taught:
  - Server: middleware is configured with a facilitator, the protected routes and your receiving wallet address. An unpaid request gets a 402 with payment requirements in PAYMENT-REQUIRED. The client signs a payment and retries with PAYMENT-SIGNATURE. Clients can wrap fetch or Axios so this happens automatically.
  - Wallet wording: the buyers page "Prerequisites" says "A crypto wallet with USDC (any EVM or SVM compatible wallet)". The sellers page "Prerequisites" says only "A crypto wallet to receive funds". The sellers page mentions USDC only in "Running on Mainnet", step "4. Update Your Wallet". I did not find a seller-side statement that a buyer must hold USDC to pay, so the buyer claim rests on the buyers page alone. The "Spend Controls" section says clients pay only recognised USD-pegged assets such as USDC and cap each payment at $1 by default.
  - None of these pages mention Midnight, so payment would settle on a separate network.
  - Alternative: https://docs.cdp.coinbase.com/x402/seller/quickstart and https://docs.cdp.coinbase.com/x402/buyer/quickstart.
- Code pattern from source: (transcribed 2026-11-25, copied byte for byte from the fetched page)

  TypeScript (Express and fetch) versions only; the pages also show Next.js, Hono, Fastify, Go and Python.

  Sellers page, "1. Install Dependencies" (Express):

```bash
npm install @x402/express @x402/core @x402/evm @x402/svm @x402/avm
```

  Sellers page, "2. Add Payment Middleware" (Express):

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();

// Your receiving wallet addresses
const evmAddress = "0xYourEvmAddress";
const svmAddress = "YourSolanaAddress";
const avmAddress = "YourAlgorandAddress";

// Create facilitator client (testnet)
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:84532", // Base Sepolia
            payTo: evmAddress,
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet
            payTo: svmAddress,
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe", // Algorand Testnet
            payTo: avmAddress,
          },
        ],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient)
      .register("eip155:84532", new ExactEvmScheme())
      .register("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", new ExactSvmScheme())
      .register("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe", new ExactAvmScheme()),
  ),
);

app.get("/weather", (req, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:4021`);
});
```

  Buyers page, "1. Install Dependencies":

```bash
# For fetch-based clients
npm install @x402/fetch @x402/evm

# For axios-based clients
npm install @x402/axios @x402/evm

# For Solana support, also add:
npm install @x402/svm

# For Algorand support, also add:
npm install @x402/avm

# For Aptos support, also add:
npm install @x402/aptos

# For Stellar support, also add:
npm install @x402/stellar

# For Keeta support, also add:
npm install @x402/keeta

# For Hedera support, also add:
npm install @x402/hedera

# For Concordium support, also add:
npm install @x402/concordium

# For TON (TVM) support, also add:
npm install @x402/tvm

# For NEAR support, also add:
npm install @x402/near

# For XRPL support, also add:
npm install @x402/xrpl
```

  Buyers page, "2. Create a Wallet Signer" (EVM):

```bash
npm install viem
```

  Buyers page, "2. Create a Wallet Signer" (EVM):

```typescript
import { privateKeyToAccount } from "viem/accounts";

// Create a signer from private key (use environment variable)
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
```

  Buyers page, "3. Make Paid Requests Automatically" (fetch):

```typescript
import { wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Create signer
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

// Create x402 client and register EVM scheme
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

// Wrap fetch with payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

// Make request - payment is handled automatically
const response = await fetchWithPayment("https://api.example.com/paid-endpoint", {
  method: "GET",
});

// Parse the payment result (status, body, and decoded payment header)
const result = await httpClient.processResponse(response);
console.log("Response:", result.body);

if (result.paymentStatus === "settled") {
  console.log("Payment settled:", result.header);
} else if (result.paymentStatus === "settle_failed") {
  console.error("Settlement failed:", result.header);
}
```

  Buyers page, "Spend Controls":

```typescript
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const client = x402Client.fromConfig({
  schemes: [
    { network: "eip155:*", client: new ExactEvmScheme(signer) },
  ],
  spendControls: {
    maxAmountPerPayment: "$5",          // raise the USD cap (default: "$1")
    allowedAssets: [
      // opt into a non-default token with an atomic cap
      { network: "eip155:8453", asset: "0xCustomToken", maxAmountPerPayment: "2000000" },
    ],
  },
});
```

## Topic 7 (added): A2A in TypeScript
What to find: whether the official A2A SDK exists for TypeScript, so both agents can use the same language as Midnight.js.
- URL: https://github.com/a2aproject/a2a-js/blob/main/README.md (official TypeScript SDK, @a2a-js/sdk)
  Also: https://github.com/a2aproject/a2a-js/blob/main/docs/migration-guide.md
  Also: https://github.com/a2aproject/a2a-js/releases
  Also: https://a2a-protocol.org/latest/tutorials/ (lists a JavaScript tutorial, "Movie research agent using JavaScript")
  Also: https://github.com/a2aproject/a2a-js/blob/main/src/samples/agents/sample-agent/index.ts (server)
  Also: https://github.com/a2aproject/a2a-js/blob/main/src/samples/agents/sample-agent/agent_executor.ts (agent logic)
  Also: https://github.com/a2aproject/a2a-js/blob/main/src/samples/agents/cancellable-agent/client.ts (client)
- Where on the page:
  - README: "Compatibility" (spec v1.0.0), "Samples" (runnable examples under src/samples), "Capability overview" > "Servers" (AgentExecutor, DefaultRequestHandler, and the Express transport adapters `jsonRpcHandler` and `restHandler` from `@a2a-js/sdk/server/express`) and "Clients" (ClientFactory, sendMessage). Opt-in v0.3 support has its own heading, "v0.3 backward compatibility".
  - Migration guide: "1.5 Other Protocol-Level Data Model Changes" (AgentCard url becomes supportedInterfaces), "2.1 A2AClient Class Removed" (replaced by ClientFactory), "2.2 Parameter Type and Method Renames", "3.1 A2AExpressApp Removed".
  - Releases page: latest release v1.3.0 (29 Sep 2026); v1.0.0 (22 Jul 2026) is the first general release.
  - sample-agent/index.ts: whole file. The Agent Card (`sampleAgentCard`, with `supportedInterfaces`), then `main()`: InMemoryTaskStore, DefaultRequestHandler, and the Express app using `agentCardHandler` and `jsonRpcHandler`.
  - sample-agent/agent_executor.ts: whole file. `SampleAgentExecutor`, the class that runs when the agent is called.
  - cancellable-agent/client.ts: whole file. `ClientFactory` with `JsonRpcTransportFactory`, `createFromUrl`, then `sendMessageStream` and reading the events.
- What it taught:
  - It is the official TypeScript / JavaScript SDK. It implements A2A spec v1.0.0 over JSON-RPC, HTTP+JSON/REST and gRPC, with opt-in v0.3 compatibility.
  - Warning: the npm page for @a2a-js/sdk showed a Quickstart written for A2A protocol 0.3.0. It uses A2AClient.fromCardUrl, A2AExpressApp and a card `url` field, all of which the migration guide says were removed or changed in v1.0 (sections 2.1, 3.1, 1.5). The npm page also showed inconsistent version numbers in my searches. Use the GitHub README and migration guide instead of the npm Quickstart, and check the version you install.
  - The main README has no inline quickstart. It points to src/samples; the server, agent logic and client files used here are listed under URL above.
  - I did not find a TypeScript tutorial page for v1.0 on a2a-protocol.org. The JavaScript tutorial listed there does not state which SDK or spec version it targets, so check that before relying on it.
- Code pattern from source: (transcribed 2026-11-25, copied byte for byte from raw.githubusercontent.com, branch main)
  Note: the samples import from relative paths inside the repo (`../../../index.js`, `../../../server/index.js`). An app using the npm package imports from `@a2a-js/sdk` instead; the README's "Installation" section has the package paths.

  `sample-agent/index.ts`:

```ts
import express from 'express';
import { A2A_PROTOCOL_VERSION, AgentCard, AGENT_CARD_PATH } from '../../../index.js';
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  DefaultRequestHandler,
} from '../../../server/index.js';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '../../../server/express/index.js';
import { SampleAgentExecutor } from './agent_executor.js';

// --- Server Setup ---

const sampleAgentCard: AgentCard = {
  name: 'Sample Agent',
  description:
    'A sample agent to test the stream functionality and simulate the flow of tasks statuses.',
  supportedInterfaces: [
    {
      url: 'http://localhost:41241/',
      protocolBinding: 'JSONRPC',
      tenant: '',
      protocolVersion: A2A_PROTOCOL_VERSION,
    },
  ],
  provider: {
    organization: 'A2A Samples',
    url: 'https://example.com/a2a-samples',
  },
  version: '1.0.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    extensions: [],
    extendedAgentCard: false,
  },
  securitySchemes: {},
  securityRequirements: [],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'task-status'], // task-status is a common output mode
  skills: [
    {
      id: 'sample_agent',
      name: 'Sample Agent',
      description: 'Simulate the general flow of a streaming agent.',
      tags: ['sample'],
      examples: ['hi', 'hello world', 'how are you', 'goodbye'],
      inputModes: ['text'], // Explicitly defining for skill
      outputModes: ['text', 'task-status'], // Explicitly defining for skill
      securityRequirements: [],
    },
  ],
  documentationUrl: '',
  signatures: [],
};

async function main() {
  // 1. Create TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. Create AgentExecutor
  const agentExecutor: AgentExecutor = new SampleAgentExecutor();

  // 3. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(sampleAgentCard, taskStore, agentExecutor);

  // 4. Create and setup Express app
  const app = express();

  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

  // 5. Start the server
  const PORT = process.env.PORT || 41241;
  app.listen(PORT, (err) => {
    if (err) {
      throw err;
    }
    console.log(`[SampleAgent] Server using new framework started on http://localhost:${PORT}`);
    console.log(`[SampleAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log('[SampleAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);
```

  `sample-agent/agent_executor.ts`:

```ts
import {
  Task,
  TaskState,
  TaskStatusUpdateEvent,
  Message,
  TaskArtifactUpdateEvent,
  Artifact,
  Role,
} from '../../../index.js';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  AgentEvent,
} from '../../../server/index.js';

/**
 * SampleAgentExecutor implements the agent's core logic.
 *
 * Cancellation is supported via the standard SDK pattern: `cancelTask` records
 * the taskId in an in-memory Set, and `execute` checks the flag at every
 * yield point. A `try/finally` block guarantees the entry is removed from
 * the Set regardless of how `execute` returns. Without this, a client call to
 * `client.cancelTask({ id })` (the SDK's invocation of the A2A "Cancel Task"
 * operation, exposed as `CancelTask` over JSON-RPC and
 * `POST /tasks/{id}:cancel` over HTTP+JSON/REST) issued against a streaming
 * request would block the request handler in
 * `DefaultRequestHandler.cancelTask` until a terminal event is published —
 * see `src/server/request_handler/default_request_handler.ts`.
 */
export class SampleAgentExecutor implements AgentExecutor {
  private readonly cancelledTasks = new Set<string>();

  public cancelTask = async (taskId: string, _eventBus: ExecutionEventBus): Promise<void> => {
    console.log(`[SampleAgentExecutor] Cancellation requested for task ${taskId}`);
    this.cancelledTasks.add(taskId);
  };

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    // Determine IDs for the task and context
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(
      `[SampleAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    try {
      // 1. Every streaming turn must begin with a Task or Message event.
      const taskSnapshot: Task = existingTask ?? {
        id: taskId,
        contextId: contextId,
        status: {
          state: TaskState.TASK_STATE_SUBMITTED,
          timestamp: new Date().toISOString(),
          message: undefined,
        },
        artifacts: [],
        history: [userMessage],
        metadata: userMessage.metadata,
      };
      eventBus.publish(AgentEvent.task(taskSnapshot));

      // 2. Publish "working" status update
      const workingStatusUpdate: TaskStatusUpdateEvent = {
        taskId: taskId,
        contextId: contextId,
        status: {
          state: TaskState.TASK_STATE_WORKING,
          message: {
            role: Role.ROLE_AGENT,
            messageId: crypto.randomUUID(),
            parts: [
              {
                content: { $case: 'text', value: 'Processing your question' },
                metadata: undefined,
                filename: '',
                mediaType: 'text/plain',
              },
            ],
            taskId: taskId,
            contextId: contextId,
            extensions: [],
            metadata: {},
            referenceTaskIds: [],
          },
          timestamp: new Date().toISOString(),
        },
        metadata: {},
      };
      eventBus.publish(AgentEvent.statusUpdate(workingStatusUpdate));

      // 3. Compute the response and (briefly) yield, checking for cancellation.
      const agentReplyText = this.parseInputMessage(userMessage);
      console.info(`[SampleAgentExecutor] Prompt response: ${agentReplyText}`);

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate processing delay.

      if (this.cancelledTasks.has(taskId)) {
        console.log(`[SampleAgentExecutor] Aborting task ${taskId} after working step.`);
        eventBus.publish(
          AgentEvent.statusUpdate({
            taskId,
            contextId,
            status: {
              state: TaskState.TASK_STATE_CANCELED,
              timestamp: new Date().toISOString(),
              message: undefined,
            },
            metadata: {},
          })
        );
        return;
      }

      // 4. Publish artifact with the result
      const artifactId = crypto.randomUUID();
      const resultArtifact: Artifact = {
        artifactId: artifactId,
        name: 'Result',
        description: 'The final result from the agent.',
        parts: [
          {
            content: { $case: 'text', value: agentReplyText },
            metadata: undefined,
            filename: '',
            mediaType: 'text/plain',
          },
        ],
        metadata: undefined,
        extensions: [],
      };

      const artifactUpdate: TaskArtifactUpdateEvent = {
        taskId: taskId,
        contextId: contextId,
        artifact: resultArtifact,
        lastChunk: true,
        append: false,
        metadata: undefined,
      };
      eventBus.publish(AgentEvent.artifactUpdate(artifactUpdate));

      // 5. Publish final task status update (completed, no message)
      const finalUpdate: TaskStatusUpdateEvent = {
        taskId: taskId,
        contextId: contextId,
        status: {
          state: TaskState.TASK_STATE_COMPLETED,
          timestamp: new Date().toISOString(),
          message: undefined,
        },
        metadata: undefined,
      };
      eventBus.publish(AgentEvent.statusUpdate(finalUpdate));

      console.log(`[SampleAgentExecutor] Task ${taskId} finished with state: completed`);
    } finally {
      this.cancelledTasks.delete(taskId);
    }
  }

  parseInputMessage(message: Message): string {
    /** Process the user query and return a response. */
    const textPart = message.parts.find((part) => part.content?.$case === 'text');
    const query = textPart?.content?.$case === 'text' ? textPart.content.value.trim() : '';

    if (!query) {
      return 'Hello! Please provide a message for me to respond to.';
    }

    // Simple responses based on input
    const queryLower = query.toLowerCase();
    if (queryLower.includes('hello') || queryLower.includes('hi')) {
      return 'Hello World! Nice to meet you!';
    } else if (queryLower.includes('how are you')) {
      return "I'm doing great! Thanks for asking. How can I help you today?";
    } else if (queryLower.includes('goodbye') || queryLower.includes('bye')) {
      return 'Goodbye! Have a wonderful day!';
    } else {
      return `Hello World! You said: '${query}'. Thanks for your message!`;
    }
  }
}
```

  `cancellable-agent/client.ts`:

```ts
import {
  ClientFactory,
  ClientFactoryOptions,
  JsonRpcTransportFactory,
} from '../../../client/index.js';
import { Role, TaskState, taskStateToJSON } from '../../../index.js';
import { SendMessageRequest } from '../../../types/pb/a2a.js';

/**
 * Demonstrates user-initiated task cancellation.
 *
 * Flow:
 *   1. Open a streaming send-message call.
 *   2. Capture the taskId from the first `task` event.
 *   3. After a short delay, call `client.cancelTask({ id: taskId })`.
 *   4. Continue consuming the stream until the agent publishes the final
 *      `TASK_STATE_CANCELED` status update.
 */

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:41241';
const CANCEL_AFTER_MS = Number(process.env.CANCEL_AFTER_MS || 2500);

async function main() {
  const factory = new ClientFactory(
    ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
      transports: [new JsonRpcTransportFactory()],
    })
  );
  const client = await factory.createFromUrl(AGENT_URL);

  const params: SendMessageRequest = {
    tenant: '',
    metadata: {},
    message: {
      messageId: crypto.randomUUID(),
      role: Role.ROLE_USER,
      parts: [
        {
          content: { $case: 'text', value: 'Please run a long task.' },
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

  console.log(`[Client] Sending streaming message to ${AGENT_URL}`);
  const stream = client.sendMessageStream(params);

  let taskId: string | undefined;
  let cancelTimer: NodeJS.Timeout | undefined;

  for await (const event of stream) {
    const payload = event.payload;
    if (!payload) {
      continue;
    }

    switch (payload.$case) {
      case 'task': {
        const task = payload.value;
        taskId = task.id;
        console.log(
          `[Client] Task created id=${task.id} state=${taskStateToJSON(task.status!.state)}`
        );

        // Schedule a cancellation request once we know the taskId.
        cancelTimer = setTimeout(async () => {
          console.log(`[Client] Sending cancelTask for ${taskId} after ${CANCEL_AFTER_MS}ms`);
          try {
            const cancelled = await client.cancelTask({
              tenant: '',
              id: taskId!,
              metadata: {},
            });
            console.log(
              `[Client] cancelTask returned state=${taskStateToJSON(cancelled.status!.state)}`
            );
          } catch (err) {
            console.error(`[Client] cancelTask failed:`, err);
          }
        }, CANCEL_AFTER_MS);
        break;
      }
      case 'statusUpdate': {
        const update = payload.value;
        console.log(
          `[Client] statusUpdate task=${update.taskId} state=${taskStateToJSON(update.status!.state)}`
        );
        if (update.status?.state === TaskState.TASK_STATE_CANCELED) {
          console.log(`[Client] Confirmed task ${update.taskId} was cancelled.`);
        }
        break;
      }
      case 'artifactUpdate': {
        const update = payload.value;
        console.log(
          `[Client] artifactUpdate task=${update.taskId} artifact=${update.artifact?.name}`
        );
        break;
      }
      case 'message':
        console.log(`[Client] Received direct message event.`);
        break;
    }
  }

  if (cancelTimer) {
    clearTimeout(cancelTimer);
  }
  console.log('[Client] Stream complete.');
}

main().catch((err) => {
  console.error('[Client] Error:', err);
  process.exit(1);
});
```

## Topic 8 (added): Storing many records in a Compact contract
What to find: how a contract keeps many records keyed by ID and how a script reads them back.
- URL: https://docs.midnight.network/tutorials/leaderboard/smart-contract (many records in a Map)
  Also: https://docs.midnight.network/tutorials/leaderboard/api-layer (reading them from TypeScript, ledger 9)
  Also: https://docs.midnight.network/compact/reference/ledger-adt (Map reference)
- Where on the page:
  - Smart contract tutorial: heading "State and witnesses" (the Map declaration; struct ScoreEntry; ledger fields scores and nextId) and the circuit heading "submitScore" (inserts an entry).
  - API layer tutorial: heading "Decode the public state" (decodeLedger, deriveState, which iterates over the map) and "LeaderboardAPI" (deploy, join, and reading updates through publicDataProvider.contractStateObservable).
  - Ledger data types reference: heading "Map<key_type, value_type>" with its operations list (insert, lookup, member, remove, size, isEmpty, and others).
- What it taught:
  - The leaderboard contract stores a struct in a Map keyed by an auto-incrementing counter. That is the same shape a registry needs: many agent records, each under an ID.
  - On the TypeScript side, the API layer decodes the contract state, checks it is a ledger v9 state, and iterates the map to build rows. This is how you would list agents. Single-key read, checked 2026-11-25: the Map reference says `lookup` is available from TypeScript as `lookup(key: key_type): value_type` and `member` as `member(key: key_type): boolean`, so Agent B can read one agent's record without walking the whole map.
  - The Map reference page says a looked-up value may be another ledger type, but does not say whether a Map value can be a struct. The leaderboard contract shows a struct value working.
  - The tutorial pages are written for ledger 9 (the API layer checks for v9), which makes them a better template than the ledger 8 deploy page.
- Code pattern from source: (transcribed 2026-11-25. The Midnight docs site blocks automated downloads, so each block was copied from the page's own source file in github.com/midnightntwrk/midnight-docs, then its SHA-256 was checked against the same block on the live page in Chrome. Every block matched.)

  Smart contract tutorial, "State and witnesses":

```compact
pragma language_version 0.28;

import CompactStandardLibrary;

struct ScoreEntry {
  score: Uint<64>,
  displayName: Bytes<32>,
  ownerHash: Bytes<32>
}

export ledger scores: Map<Uint<64>, ScoreEntry>;
export ledger nextId: Counter;

witness localSecretKey(): Bytes<32>;
witness getCustomName(): Bytes<32>;
```

  Smart contract tutorial, "submitScore":

```compact
export circuit submitScore(
  score: Uint<64>,
  useCustomName: Boolean
): [] {
  const sk = localSecretKey();
  const ownerHash = ownerCommitment(sk);

  nextId.increment(1);
  const entryId = disclose(nextId.read() as Uint<64>);

  if (disclose(useCustomName)) {
    const customName = getCustomName();
    scores.insert(entryId, ScoreEntry {
      score: disclose(score),
      displayName: disclose(customName),
      ownerHash: disclose(ownerHash)
    });
  } else {
    scores.insert(entryId, ScoreEntry {
      score: disclose(score),
      displayName: disclose(persistentHash<Bytes<32>>(sk)),
      ownerHash: disclose(ownerHash)
    });
  }
}
```

  API layer tutorial, "Decode the public state":

```typescript
export const decodeLedger = (read: ContractStateRead): Ledger => {
  if (read.contractState.era !== 'v9') throw new Error('expected a Ledger 9 contract state');
  return ledger(read.contractState.deserialize({ v9: ContractState }).data);
};
```

  API layer tutorial, "Decode the public state":

```typescript
export const deriveState = (ledgerState: Ledger): LeaderboardDerivedState => {
  const entries: LeaderboardEntry[] = [];
  for (const [key, entry] of ledgerState.scores) {
    entries.push({
      id: Number(key),
      score: Number(entry.score),
      displayName: utils.decodeDisplayName(entry.displayName, Number(key), Number(entry.score)),
      ownerHash: utils.toHex(entry.ownerHash),
    });
  }
  entries.sort((a, b) => b.score - a.score);
  return { entryCount: Number(ledgerState.nextId), entries };
};
```

  Smart contract tutorial, "ownerCommitment" (added 2026-11-26 for the owner-only update; same page, copied from the page's source file in midnight-docs):

```compact
export circuit ownerCommitment(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "leaderboard:owner:"), sk]);
}
```

  Smart contract tutorial, "verifyOwnership" (added 2026-11-26, same source):

```compact
export circuit verifyOwnership(targetEntryId: Uint<64>): [] {
  assert(scores.member(disclose(targetEntryId)), "entry not found");
  const entry = scores.lookup(disclose(targetEntryId));
  const callerHash = ownerCommitment(localSecretKey());
  assert(callerHash == entry.ownerHash, "not the owner");
}
```

  Ledger data types reference, "Map<key_type, value_type>" > "insert" (page wording, 2026-11-26): "Updates this Map to include a new value at a given key." So an insert on an existing ID replaces the record, which is how updateRecord works.

  Ledger data types reference, "Map<key_type, value_type>" > "insert":

```compact
insert(key: key_type, value: value_type): []
```

  Ledger data types reference, "Map<key_type, value_type>" > "lookup":

```compact
lookup(key: key_type): value_type
```

  Ledger data types reference, "Map<key_type, value_type>" > "member":

```compact
member(key: key_type): Boolean
```

  Ledger data types reference, "Map<key_type, value_type>" > "[Symbol.iterator]":

```typescript
[Symbol.iterator](): Iterator<[key_type, value_type]>
```

## Topic 9 (added 2026-11-25): A wallet the code controls (Option 1)
What to find: how a Node.js script builds its own wallet from a seed and registers its tNIGHT for
DUST, so the agents can sign transactions without a browser wallet.
- URL: https://docs.midnight.network/guides/acquire-tokens (the Topic 1 page)
- Where on the page:
  - "Setting up the wallet SDK project" > Procedure (package.json, install, the imports and network config).
  - "Building a wallet from a seed" > Procedure (WalletSeeds.fromMasterSeed, the three sub-wallets behind a WalletFacade).
  - "Registering NIGHT for DUST generation with the wallet SDK" > Procedure (watch for tNIGHT, register it, watch DUST).
- What it taught:
  - The page is written for the ledger 9 set: Midnight.js 5.0.1 and `@midnightntwrk/wallet-sdk` 2.0.1 (that scope has no hyphen).
  - One master seed makes three sub-wallets: shielded, unshielded and DUST. The faucet pays the unshielded address.
  - Registration needs a fully synced wallet and enough DUST already generated to pay its own fee, so the code waits for both before registering.
  - Amounts are whole numbers in the smallest unit: 1 NIGHT = 10^6 STAR, 1 DUST = 10^15 SPECK. 5,000 tNIGHT reads as 5000000000.
  - Deviation planned (original applied work): the page prints a newly generated seed to the console. Our script will instead write it straight into the gitignored `.env.preview` with owner-only file permissions and print only the public address, so the seed never appears in a terminal or chat.
- Code pattern from source: (transcribed 2026-11-25 from the page's source file in github.com/midnightntwrk/midnight-docs; every block's SHA-256 matched the live page in Chrome)

  "Setting up the wallet SDK project" > Procedure (package.json):

```json
{
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@midnight-ntwrk/midnight-js-protocol": "5.0.1",
    "@midnightntwrk/wallet-sdk": "2.0.1",
    "rxjs": "^7.8.1",
    "ws": "^8.19.0"
  },
  "devDependencies": {
    "@types/ws": "^8.18.1",
    "tsx": "^4.19.0"
  }
}
```

  "Setting up the wallet SDK project" > Procedure (install):

```bash
curl http://localhost:6300/health
```

  "Setting up the wallet SDK project" > Procedure (imports and config):

```typescript
import { WebSocket } from 'ws';
(globalThis as any).WebSocket = WebSocket;

import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import {
  WalletSeeds,
  generateRandomSeed,
  WalletFacade,
  ShieldedWallet,
  DustWallet,
  UnshieldedWallet,
  createKeystore,
  PublicKey,
  InMemoryTransactionHistoryStorage,
  WalletEntrySchema,
  mergeWalletEntries,
  DustAddress,
  MidnightBech32m,
} from '@midnightntwrk/wallet-sdk';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/v9';

const networkId = 'preprod';

// The Preprod indexer and node RPC are served by Blockfrost and need a project token.
const projectId = process.env.BLOCKFROST_PROJECT_ID?.trim();
if (!projectId) throw new Error('BLOCKFROST_PROJECT_ID is not set.');
const withBlockfrostKey = (url: string) => `${url}?project_id=${encodeURIComponent(projectId)}`;

const CONFIG = {
  indexerHttpUrl: withBlockfrostKey('https://midnight-preprod.blockfrost.io/api/v0'),
  indexerWsUrl: withBlockfrostKey('wss://midnight-preprod.blockfrost.io/api/v0/ws'),
  node: withBlockfrostKey('https://rpc.midnight-preprod.blockfrost.io'),
  proofServer: 'http://localhost:6300',
};
```

  "Building a wallet from a seed" > Procedure, step 1:

```typescript
const seed = process.env.WALLET_SEED ?? Buffer.from(generateRandomSeed()).toString('hex');
if (!process.env.WALLET_SEED) {
  console.log(`New wallet seed, save this and set WALLET_SEED to reuse it: ${seed}`);
}

const seeds = WalletSeeds.fromMasterSeed(Buffer.from(seed, 'hex'));
```

  "Building a wallet from a seed" > Procedure, step 2:

```typescript
const unshieldedKeystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, networkId);

const configuration = {
  networkId,
  indexerClientConnection: {
    indexerHttpUrl: CONFIG.indexerHttpUrl,
    indexerWsUrl: CONFIG.indexerWsUrl,
  },
  provingServerUrl: new URL(CONFIG.proofServer),
  relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
  txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
  costParameters: {
    // Optional amount added to every fee the wallet declares. A DUST spend does not return it. Defaults to 0n.
    additionalFeeOverhead: 300_000_000_000_000n, // 0.3 DUST
    // Blocks to allow for finalization when estimating the fee.
    feeBlocksMargin: 5,
  },
};

const wallet = await WalletFacade.init({
  configuration,
  shielded: (config) => ShieldedWallet(config).startWithSeed(seeds.shielded),
  unshielded: (config) => UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
  dust: (config) => DustWallet(config).startWithSeed(seeds.dust),
});
await wallet.start(seeds);
```

  "Registering NIGHT for DUST generation with the wallet SDK" > Procedure, step 1:

```typescript
const formatNight = (raw: bigint) =>
  `${raw / 1_000_000n}.${(raw % 1_000_000n).toString().padStart(6, '0')}`;

const formatDust = (raw: bigint) =>
  `${raw / 1_000_000_000_000_000n}.${(raw % 1_000_000_000_000_000n).toString().padStart(15, '0')}`;

console.log(`Send tNIGHT to: ${unshieldedKeystore.getBech32Address()}`);

const nightBalance = await Rx.firstValueFrom(
  wallet.state().pipe(
    Rx.throttleTime(10_000),
    Rx.map((state) => state.unshielded.balances[unshieldedToken().raw] ?? 0n),
    Rx.filter((balance) => balance > 0n),
  ),
);
console.log(`tNIGHT received: ${formatNight(nightBalance)}`);
```

  "Registering NIGHT for DUST generation with the wallet SDK" > Procedure, step 2:

```typescript
const state = await wallet.waitForSyncedState();

const unregistered = state.unshielded.availableCoins.filter(
  (coin) => coin.meta?.registeredForDustGeneration !== true,
);

if (unregistered.length === 0) {
  console.log('All NIGHT is already registered for DUST generation.');
} else {
  // Send the DUST elsewhere by replacing this with another wallet's address.
  const target = String(DustAddress.encodePublicKey(networkId, state.dust.publicKey));
  const dustReceiver = MidnightBech32m.parse(target).decode(DustAddress, networkId);

  // Wait until the NIGHT has generated enough DUST to pay the registration's own fee.
  const { fee } = await wallet.estimateRegistration(unregistered);
  await wallet.waitForGeneratedDust(unregistered, fee);

  const recipe = await wallet.registerNightUtxosForDustGeneration(
    unregistered,
    unshieldedKeystore.getPublicKey(),
    async (payload) => unshieldedKeystore.signData(payload),
    dustReceiver,
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized);
}
```

  "Registering NIGHT for DUST generation with the wallet SDK" > Procedure, step 3:

```typescript
await Rx.firstValueFrom(
  wallet.state().pipe(
    Rx.throttleTime(5_000),
    Rx.filter((s) => s.isSynced),
    Rx.filter((s) => s.dust.balance(new Date()) > 0n),
  ),
);
const dustBalance = (await Rx.firstValueFrom(wallet.state())).dust.balance(new Date());
console.log(`DUST balance: ${formatDust(dustBalance)}`);
await wallet.stop();
```

---

## x402 on Midnight (added 2026-11-26)

**Goal:** Agent A answers an unpaid call with HTTP 402 and its price. Agent B pays in tNIGHT on Midnight,
retries with proof of payment, and gets the answer. A facilitator we run ourselves checks the payment
on chain before Agent A replies. We use x402's real headers and its plug-in interfaces, not a
look-alike.

**Design calls already made (from the registry work):**
- The price Agent A asks for must not be more than the `price` in its on-chain record. Agent B
  checks this before paying (OURS).
- Each payment can be used once. The facilitator remembers transaction IDs it has accepted (OURS).

**Needs no research (already in the project or the installed packages):**

| Need | Where it is already |
|---|---|
| The 402 flow and the three V2 headers (PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE) | Topic 6 |
| Express seller middleware and fetch buyer wrapper, as used for USDC | Topic 6 |
| Plug-in names: `SchemeNetworkClient.createPaymentPayload`, `SchemeNetworkFacilitator` (verify, settle), `x402Facilitator.register(network, facilitator)` | Type definitions in `@x402/core` 2.32.0 (checked 2026-11-26). Names only; Topic 10 must give the documented way to use them |
| A wallet that pays its own fees | Topic 9 and `wallet/` |
| Sending tNIGHT: `transferTransaction`, `signRecipe`, `finalizeRecipe`, submit | Partly: node-server-wallet page, "Funding the wallet on the local network". That page is ledger 8 era (Topic 3 caveat), so Topic 12 confirms it for wallet SDK 2.0.1 / ledger 9 |

## Topic 10: x402, adding a new payment scheme or network
What to find: the documented way to plug a new network into x402, and the exact fields of the payment request and payment proof.
- URL: https://docs.x402.org/core-concepts/network-and-token-support (how to add a network)
  Also: https://github.com/x402-foundation/x402/blob/main/specs/CONTRIBUTING.md (how to propose a new scheme or chain spec)
  Also: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md (field definitions)
  Also: https://docs.x402.org/schemes/overview (schemes in a 402 response)
- Where on the page:
  - Networks page: headings "Production Network Support" (protocol, runtime and production support), "Adding Support for New Networks" > "Runtime Registration", "Production checklist for a new EVM network", "Contributing a New Default Asset".
  - CONTRIBUTING: headings "Specification Types" > "Schemes", "Proposing a New Spec" > "Step 1: Open a Discussion", "Step 2: Write the Spec", "Step 3: Submit PR", and "Templates" > "Scheme Implementation Template" (the file scheme_impl_template.md in the specs/ folder).
  - Spec v2: "5.1 PaymentRequired Schema" > "5.1.2 Field Descriptions" (fields of the payment request); "5.2 PaymentPayload Schema" > "5.2.2 Field Descriptions" (fields of the payment proof); "6. Payment Schemes (The Logic)".
  - Schemes overview: heading "Schemes in a 402 Response" and "Specs".
- What it taught:
  - Three levels of support: protocol (x402 can express the requirements and payload), runtime (a network and scheme are registered in your code), and production (a settlement path exists, through a facilitator or self-facilitation).
  - "Runtime Registration" says you can use any EVM network in your own server code without changing x402 source or sending a PR, by registering a scheme with a CAIP-2 network ID (eip155:<chainId>). It names x402ResourceServer, HTTPFacilitatorClient and ExactEvmScheme (TypeScript), with Go and Python equivalents. It also says you need a facilitator that supports the network, or you run your own. The registration section is written for EVM networks only. For a non-EVM network such as Midnight, the page gives no registration route; the specs process in CONTRIBUTING is the nearest documented path (my reading, not stated on either page).
  - CONTRIBUTING: open a GitHub discussion first (problem, approach, why existing schemes don't suffice), write the spec from the template, then send a PR. Scheme specs go under specs/schemes/<scheme_name>/, with scheme_<name>.md for the overview and scheme_<name>_<chain>.md per chain. It describes no separate networks folder or network-only process.
  - Payment request (spec v2, 5.1.2): PaymentRequired has x402Version, error, resource, accepts, extensions. Each entry in accepts (PaymentRequirements) has scheme, network, amount, asset, payTo, maxTimeoutSeconds, extra. The resource object has url, description, mimeType, serviceName, tags, iconUrl.
  - Payment proof (spec v2, 5.2.2): PaymentPayload has x402Version, resource, accepted, payload, extensions. `accepted` repeats the chosen PaymentRequirements. The spec lists payload sub-fields signature and authorization (from, to, value, validAfter, validBefore, nonce). Those look specific to the EVM exact scheme, so the payload content for a new network would be defined by that scheme's own spec. That is my reading; check the exact scheme page under specs/schemes/exact.
  - The schemes overview page shows example accepts entries but gives no formal field definition, so use the spec for field names.
  - Not found: any mention of Midnight on these pages.
- Checked (2026-11-26): all four pages reachable, headings as described.
  - Confirmed: the spec says `payload` is "Scheme-specific payment data" and gives the EVM fields only "For example". Your reading is right.
  - Confirmed: Runtime Registration is written for EVM only.
  - Added from the same pages, because it shapes the Midnight design. Spec 6.1 defines an `upfront` payment flow (settle, then serve), "Required by networks with no pull-settlement primitive". Spec 7.2 says that for "client-prepaid methods, settle MAY bind a payment proof to the request (for example, consuming a challenge or marking a transaction as used) after read-only observation of ledger or backend state". The schemes overview says "The `exact` scheme supports both `authorization` (default) and `upfront` flows on all networks. Servers opt in per route by setting `extra.paymentFlow: "upfront"`". So a Midnight payment fits as `exact` with the `upfront` flow: the buyer pays first, and settle checks the ledger and marks the payment used.
  - Networks page, "Specifying Payment Amounts": a price string like "$0.01" needs a chain default stablecoin; "TokenAmount ... Works on any chain". tNIGHT has no USD default, so price must be an explicit amount in atomic units (STAR).
  - Not transcribed: the schemes overview JSON (spec 5.1.1 covers the same shape).
  - Model chain (added below): specs/schemes/exact/ has per-chain files, including scheme_exact_cardano.md. Cardano is a UTXO chain like Midnight's NIGHT ledger, so it may be the closest model for a Midnight scheme spec. Read into the plan below.
- Code pattern from source: (transcribed 2026-11-26. GitHub files copied byte for byte from raw.githubusercontent.com, x402-foundation/x402 main at 17f6f4f. docs.x402.org blocks copied from the page's own markdown and checked by SHA-256 against the rendered live page: match.)

  Networks page, "Adding Support for New Networks" > "Runtime Registration" (TypeScript tab):

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://your-facilitator.com"  // Facilitator that supports your network
});

const server = new x402ResourceServer(facilitatorClient);
server.register("eip155:*", new ExactEvmScheme());

const routes = {
  "GET /api/data": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: "eip155:43114",  // Avalanche mainnet
      payTo: "0xYourAddress",
    }],
  },
};
```

  Spec v2, "5.1.1 JSON Payload" (example PaymentRequired):

```json
{
  "x402Version": 2,
  "error": "PAYMENT-SIGNATURE header is required",
  "resource": {
    "url": "https://api.example.com/premium-data",
    "description": "Access to premium market data",
    "mimeType": "application/json",
    "serviceName": "Example Market Data",
    "tags": ["market-data", "finance"],
    "iconUrl": "https://api.example.com/icon.png"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "amount": "10000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      "maxTimeoutSeconds": 60,
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ],
  "extensions": {}
}
```

  Spec v2, "5.2.1 JSON Structure" (example PaymentPayload):

```json
{
  "x402Version": 2,
  "resource": {
    "url": "https://api.example.com/premium-data",
    "description": "Access to premium market data",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:84532",
    "amount": "10000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "maxTimeoutSeconds": 60,
    "extra": {
      "name": "USDC",
      "version": "2"
    }
  },
  "payload": {
    "signature": "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
    "authorization": {
      "from": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
      "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      "value": "10000",
      "validAfter": "1740672089",
      "validBefore": "1740672154",
      "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
    }
  },
  "extensions": {}
}
```

  CONTRIBUTING, "Templates" > "Scheme Implementation Template":

```markdown
# Scheme: `<name>` `<network kind>`

## Summary

Summarize the purpose and behavior of your scheme here. Include example use cases.

## Payment header payload

Document how to construct the payment header payload for your scheme.

## Verification

Document the steps needed to verify a payment for your scheme is valid.

## Settlement

Document how to settle a payment for your scheme.

## Appendix
```

  - Added 2026-11-26: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact.md (the generic `exact` spec, linked from the schemes overview) and https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_cardano.md (closest model chain). Both read from main at 17f6f4f.
    - Generic exact spec, "Asset Transfer Method Families" > "Client-submitted (payment proof)": "The client submits the payment itself and presents a proof of it; settle validates that proof and binds it to the request." Methods in this family "MUST use `upfront`". Each method must satisfy: instrument and proof advertised in the requirements, proof carried in `PaymentPayload.payload`; request binding (one of: an instrument unique to the request, a server-issued nonce carried in the payment, a payer signature over the requirements, or a payee commitment); a single-use claim keyed on the CAIP-2 network joined to the payment's transaction id; a retention bound; amount acceptance rules; a declared finality event; and failure disposition. This is the family our Midnight design belongs to.
    - Request binding gap (ours to note): a Midnight unshielded transfer has no memo field to carry a nonce, and verifying a payer signature server-side is not in our sources. Version 1 relies on the spec's own fallback: an unbound proof "would have to be checked against a store shared by every facilitator serving that `payTo`". We run exactly one facilitator per `payTo`, so its single-use store is that shared store. Signature binding is a later topic.
    - Cardano spec: every Cardano method is "facilitator-submitted" (the client signs, the facilitator broadcasts) with the `authorization` flow, so it is the other family. Useful as a model for: network ids `cardano:preview` style (human-readable, CAIP-2 syntax), the Facilitator Verification Rules (network, recipient, amount, asset exact match, replay, confirmation), the pending-settlement handling, and "Duplicate Settlement Mitigation": key on the canonical transaction id, insert the claim atomically before the first await, keep it until the payment can no longer land.

  Cardano spec, "Protocol Flow" > "`PaymentRequired`" > "Default Schema":

```js
{
  "x402Version": 2,
  "error": "PAYMENT-SIGNATURE header is required",
  "resource": {
    "url": "https://api.example.com/premium-data",
    "description": "Access to premium market data",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "cardano:mainnet", // cardano:preprod or cardano:preview for public testnets
      "amount": "10000", // atomic units of `asset`; USDM has 6 decimals, so 1 USDM = 1000000
      "asset": "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad.0014df105553444d", // ${policyId}.${assetNameHex} — USDM on Cardano Mainnet. BOTH parts differ on Preprod: policy id e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c9, asset name 0014df10745553444d. The asset name is the CIP-68 (333) label followed by the hex of 'USDM' (mainnet) / 'tUSDM' (preprod)
      "payTo": "addr1...",
      "maxTimeoutSeconds": 600, // Has to be set to a higher amount of time because of the Cardano Network speed
      "extra": {
        "confirmationPolicy": { "l1Confirmations": 1 }, // optional; defaults to 1
        // In case of default address-to-address payments, this may be empty or contain additional metadata
      }
    }
  ]
}
```

  Cardano spec, "`PAYMENT-SIGNATURE` Header Payload" (payload example):

```js
{
  "transaction": "hKQA2QECgYJYIGYsv2RfzYkU64kRW4OXCpUEk90vuvOd6juW6MvcEyk5AAGCglgdYSIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiKCGgAQC/ihWBzEjLs9XlftVuJ2vEX5mrOavpTmzXrDn7QC2ketoUgAFN8QVVNETRknEIJYOQEP3HgAI9i+fJ/zpr3A2NOyY70MwSRIxAlI779C5VeJA1IJXxz2/St9Gijjw8sCn0jPNP+JCijRdoIaAR6EM6FYHMSMuz1eV+1W4na8Rfmas5q+lObNesOftALaR62hSAAU3xBVU0RNGgAPGzACGgACnNUDGgviTxGhANkBAoGCWCB+oJo0rrsTyYQccTl7HKv+xd35UEBSk97klsrC9DdIClhAtDdExgNy1HNn3MLUiJR/xTpzZ7pa719nxZtGwL9HBdwc4y56ZTibS5eLe3Z2h8gPKsqyBxZSJ418iB1DR4ENA/X2",
  "nonce": "662cbf645fcd8914eb89115b83970a950493dd2fbaf39dea3b96e8cbdc132939#0"
}
```

  Cardano spec, "`PAYMENT-RESPONSE` Header Payload":

```js
{
  "success": true, // true or false
  "network": "cardano:mainnet",
  "transaction": "2f9a7b3c...", // Transaction hash of the payment if successful
  "extra": {
    "status": "confirmed", // "mempool" when authenticated mempool evidence is strongest
    "confirmations": 1
  },
  // Optional error field in case of failure
  "errorReason": "Utxo not found in utxo set" // Example error reason
}
```

## Topic 11: x402, running your own facilitator
What to find: an example facilitator server with its "verify" and "settle" endpoints, and how a server points at it.
- URL: https://github.com/x402-foundation/x402/tree/main/examples/typescript/facilitator (example folder; the basic/ subfolder is described as a minimal facilitator exposing /verify and /settle)
  Also: https://docs.x402.org/core-concepts/facilitator (how a server points at a facilitator)
  Also: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md (endpoint definitions)
  Also: https://docs.x402.org/core-concepts/network-and-token-support and https://docs.x402.org/dev-tools/facilitators
- Where on the page:
  - Example repo: the facilitator/ folder lists basic/ (minimal, /verify and /settle), advanced/, upto/, batch-settlement/, auth-capture/ and builder-code/. Go and Python example folders also exist under examples/.
  - Facilitator concepts page: headings "Choosing a Facilitator Path", "Interaction Flow", "Facilitator HTTP request timeout (resource server side)" (shows an HTTPFacilitatorClient built with a url and timeoutMs).
  - Spec v2: "7. Facilitator Interface" > "7.1 POST /verify", "7.2 POST /settle", "7.3 GET /supported".
  - Networks page: "Running Your Own Facilitator" (prerequisites).
  - Facilitators page: heading "Running your own or self-facilitating".
- What it taught:
  - A facilitator is an optional service that verifies a payment payload and settles it onchain for the resource server. The server can also verify and settle on its own.
  - Spec endpoints: POST /verify takes x402Version, paymentPayload and paymentRequirements, and returns isValid and payer (or invalidReason on failure). POST /settle takes the same three fields and returns success, payer, transaction and network (or errorReason on failure). GET /supported lists what the facilitator supports.
  - Pointing a server at it: the concepts page shows the server creating an HTTPFacilitatorClient with the facilitator's base url. The Runtime Registration section on the networks page uses the same class with a placeholder facilitator URL.
  - "Running Your Own Facilitator" lists three prerequisites: an RPC endpoint for the network, a wallet with native tokens for gas, and the x402 facilitator code. The facilitators page gives no setup steps or code for self-hosting.
  - I could not open the basic/ subfolder or its files, so I have not confirmed the file names or its README. (Answered below.)
  - Also on the facilitator page: "Settlement pending and auto-recovery" explains that a settle result can be pending, which matters if you build a Midnight settlement.
- Checked (2026-11-26):
  - Your open question is answered: basic/ holds index.ts, README.md, package.json, tsconfig.json and eslint.config.js. index.ts is the whole server and is transcribed below. It builds an `x402Facilitator`, calls `facilitator.register(network, scheme)` once per network, and wraps `facilitator.verify`, `facilitator.settle` and `facilitator.getSupported` in three Express routes. It pins express ^4.22.3; we use Express 5, so check the routes still behave.
  - The two docs pages import HTTPFacilitatorClient from different paths: "@x402/core/http" (facilitator page) and "@x402/core/server" (networks page). Checked in the installed @x402/core 2.32.0: both paths export it, so either works.
  - Facilitator page, "Duplicate Settlement (Solana)": a buyer could reuse one payment for several requests, and "If you are a merchant settling payments directly (without a facilitator), you must implement equivalent duplicate detection yourself." That backs our "each payment used once" rule.
- Code pattern from source: (transcribed 2026-11-26, same sources and checks as Topic 10)

  examples/typescript/facilitator/basic/index.ts (whole file):

```typescript
import { base58 } from "@scure/base";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { x402Facilitator } from "@x402/core/facilitator";
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { UptoEvmScheme } from "@x402/evm/upto/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { ExactSvmScheme } from "@x402/svm/exact/facilitator";
import dotenv from "dotenv";
import express from "express";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

dotenv.config();

// Configuration
const PORT = process.env.PORT || "4022";

// Validate required environment variables
if (!process.env.EVM_PRIVATE_KEY) {
  console.error("❌ EVM_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

if (!process.env.SVM_PRIVATE_KEY) {
  console.error("❌ SVM_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// Initialize the EVM account from private key
const evmAccount = privateKeyToAccount(
  process.env.EVM_PRIVATE_KEY as `0x${string}`,
);
console.info(`EVM Facilitator account: ${evmAccount.address}`);

// Initialize the SVM account from private key
const svmAccount = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY as string),
);
console.info(`SVM Facilitator account: ${svmAccount.address}`);

// Create a Viem client with both wallet and public capabilities
const viemClient = createWalletClient({
  account: evmAccount,
  chain: baseSepolia,
  transport: http(),
}).extend(publicActions);

// Initialize the x402 Facilitator with EVM and SVM support

const evmSigner = toFacilitatorEvmSigner({
  getCode: (args: { address: `0x${string}` }) => viemClient.getCode(args),
  address: evmAccount.address,
  readContract: (args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }) =>
    viemClient.readContract({
      ...args,
      args: args.args || [],
    }),
  verifyTypedData: (args: {
    address: `0x${string}`;
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
    signature: `0x${string}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) => viemClient.verifyTypedData(args as any),
  writeContract: (args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }) =>
    viemClient.writeContract({
      ...args,
      args: args.args || [],
    }),
  sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
    viemClient.sendTransaction(args),
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
    viemClient.waitForTransactionReceipt(args),
});

// Facilitator can now handle all Solana networks with automatic RPC creation
const svmRpcUrl = process.env.SVM_RPC_URL;
const svmSigner = toFacilitatorSvmSigner(
  svmAccount,
  svmRpcUrl ? { defaultRpcUrl: svmRpcUrl } : undefined,
);

const facilitator = new x402Facilitator()
  .onBeforeVerify(async (context) => {
    console.log("Before verify", context);
  })
  .onAfterVerify(async (context) => {
    console.log("After verify", context);
  })
  .onVerifyFailure(async (context) => {
    console.log("Verify failure", context);
  })
  .onBeforeSettle(async (context) => {
    console.log("Before settle", context);
  })
  .onAfterSettle(async (context) => {
    console.log("After settle", context);
  })
  .onSettleFailure(async (context) => {
    console.log("Settle failure", context);
  });

// Register EVM and SVM schemes
facilitator.register(
  "eip155:84532",
  new ExactEvmScheme(evmSigner, {
    // Add trusted ERC-6492 factory addresses here (e.g. your chosen ERC-4337 smart wallet factory).
    // A non-empty array enables smart wallet deployment; an empty array denies all factory calls.
    eip6492AllowedFactories: [],
  }),
); // Base Sepolia
facilitator.register("eip155:84532", new UptoEvmScheme(evmSigner));
facilitator.register(
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  new ExactSvmScheme(svmSigner),
); // Devnet

// Initialize Express app
const app = express();
app.use(express.json());

/**
 * POST /verify
 * Verify a payment against requirements
 *
 * Note: Payment tracking and bazaar discovery are handled by lifecycle hooks
 */
app.post("/verify", async (req, res) => {
  const endpointT0 = performance.now();
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    const payloadField: unknown = paymentPayload.payload;
    if (
      typeof payloadField !== "object" ||
      payloadField === null ||
      Array.isArray(payloadField)
    ) {
      return res.status(400).json({
        error: "paymentPayload.payload must be an object",
      });
    }

    const supportedKind = facilitator
      .getSupported()
      .kinds.some(
        (kind) =>
          kind.x402Version === paymentPayload.x402Version &&
          kind.scheme === paymentRequirements.scheme &&
          kind.network === paymentRequirements.network,
      );
    if (!supportedKind) {
      return res.json({
        isValid: false,
        invalidReason: "unsupported_scheme",
      });
    }

    if (
      paymentRequirements.scheme === "exact" &&
      paymentRequirements.network.startsWith("eip155:") &&
      !("authorization" in payloadField) &&
      !("permit2Authorization" in payloadField)
    ) {
      return res.status(400).json({
        error:
          "paymentPayload.payload must include authorization or permit2Authorization",
      });
    }

    // Hooks will automatically:
    // - Track verified payment (onAfterVerify)
    // - Extract and catalog discovery info (onAfterVerify)
    const response: VerifyResponse = await facilitator.verify(
      paymentPayload,
      paymentRequirements,
    );

    res.json(response);
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    console.log(
      `/verify completed in ${((performance.now() - endpointT0) / 1000).toFixed(3)}s`,
    );
  }
});

/**
 * POST /settle
 * Settle a payment on-chain
 *
 * Note: Verification validation and cleanup are handled by lifecycle hooks
 */
app.post("/settle", async (req, res) => {
  const endpointT0 = performance.now();
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    const payloadField: unknown = paymentPayload.payload;
    if (
      typeof payloadField !== "object" ||
      payloadField === null ||
      Array.isArray(payloadField)
    ) {
      return res.status(400).json({
        error: "paymentPayload.payload must be an object",
      });
    }

    const supportedKind = facilitator
      .getSupported()
      .kinds.some(
        (kind) =>
          kind.x402Version === paymentPayload.x402Version &&
          kind.scheme === paymentRequirements.scheme &&
          kind.network === paymentRequirements.network,
      );
    if (!supportedKind) {
      return res.json({
        success: false,
        errorReason: "unsupported_scheme",
        transaction: "",
        network: paymentRequirements.network || "unknown",
      });
    }

    if (
      paymentRequirements.scheme === "exact" &&
      paymentRequirements.network.startsWith("eip155:") &&
      !("authorization" in payloadField) &&
      !("permit2Authorization" in payloadField)
    ) {
      return res.status(400).json({
        error:
          "paymentPayload.payload must include authorization or permit2Authorization",
      });
    }

    // Hooks will automatically:
    // - Validate payment was verified (onBeforeSettle - will abort if not)
    // - Check verification timeout (onBeforeSettle)
    // - Clean up tracking (onAfterSettle / onSettleFailure)
    const response: SettleResponse = await facilitator.settle(
      paymentPayload,
      paymentRequirements,
    );

    res.json(response);
  } catch (error) {
    console.error("Settle error:", error);

    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    console.log(
      `/settle completed in ${((performance.now() - endpointT0) / 1000).toFixed(3)}s`,
    );
  }
});

/**
 * GET /supported
 * Get supported payment kinds and extensions
 */
app.get("/supported", async (req, res) => {
  try {
    const response = facilitator.getSupported();
    res.json(response);
  } catch (error) {
    console.error("Supported error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Start the server
app.listen(parseInt(PORT), () => {
  console.log(`🚀 Facilitator listening on http://localhost:${PORT}`);
  console.log();
});
```

  Facilitator page, "Facilitator HTTP request timeout (resource server side)":

```typescript
import { HTTPFacilitatorClient } from "@x402/core/http";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://your-facilitator.com",
  timeoutMs: 30_000, // 30 seconds
});
```

  Spec v2, "7.1 POST /verify", request (Exact Scheme):

```json
{
  "x402Version": 2,
  "paymentPayload": {
    /* PaymentPayload schema */
  },
  "paymentRequirements": {
    /* PaymentRequirements schema */
  }
}
```

  Spec v2, "7.1 POST /verify", Successful Response:

```json
{
  "isValid": true,
  "payer": "0x857b06519E91e3A54538791bDbb0E22373e36b66"
}
```

  Spec v2, "7.1 POST /verify", Error Response:

```json
{
  "isValid": false,
  "invalidReason": "insufficient_funds",
  "payer": "0x857b06519E91e3A54538791bDbb0E22373e36b66"
}
```

  Spec v2, "7.2 POST /settle", Successful Response:

```json
{
  "success": true,
  "payer": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
  "transaction": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "network": "eip155:84532"
}
```

  Spec v2, "7.2 POST /settle", Error Response:

```json
{
  "success": false,
  "errorReason": "insufficient_funds",
  "payer": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
  "transaction": "",
  "network": "eip155:84532"
}
```

  Spec v2, "7.3 GET /supported", Response:

```json
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:84532"
    },
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:8453"
    },
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:43113"
    },
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:43114"
    }
  ],
  "extensions": [],
  "signers": {
    "eip155:*": ["0x1234567890abcdef1234567890abcdef12345678"],
    "solana:*": ["CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"]
  }
}
```

## Topic 12: Midnight, sending tNIGHT from code (ledger 9)
What to find: a public tNIGHT transfer for ledger 9 and wallet SDK 2.x, and how to get the transaction ID back.
- URL: https://docs.midnight.network/guides/manage-dust (ledger 9, Wallet SDK 2.0.0; the page says submitTransaction returns an identifier)
  Also: https://github.com/midnightntwrk/midnight-examples/blob/main/examples/private-party/src/wallet.ts (official example source, ledger 9)
  Also: https://github.com/midnightntwrk/midnight-examples/blob/main/README.md (its pinned versions)
  Fallback (ledger 8, Wallet SDK 1.2.0): https://docs.midnight.network/guides/node-server-wallet
  Also: https://docs.midnight.network/relnotes/wallet/wallet-2-0-0 (what changed in Wallet SDK 2)
- Where on the page:
  - manage-dust: headings "How a transaction pays its fee", "Estimating a fee before submitting" > Procedure, "Sending several transactions from one wallet" > Procedure. A search excerpt shows a NIGHT transfer built without its fee in this guide; I did not confirm which heading holds it, so check those three procedures. Function names on the page: submitTransaction, resultOf, waitUntilSettled, indexedTransaction.
  - private-party wallet.ts: the method `transferNight` on the MidnightWalletProvider class (docblock "Sends unshielded NIGHT to another wallet, paying this wallet's own fees.").
  - midnight-examples README: heading "Pinned toolchain".
  - node-server-wallet (fallback): heading "Funding the wallet on the local network" > Procedure (transferTransaction, signRecipe, finalizeRecipe, submitWithRetry) and > Verification (shows the transaction ID).
  - Wallet 2.0.0 release notes: heading "Breaking changes" > "Facade" (TokenTransfer now needs typed ShieldedAddress or UnshieldedAddress values).
- What it taught:
  - Ledger 9 and Wallet SDK 2: the examples README says all its examples target ledger 9 and pins Wallet SDK 2.0.1 and Midnight.js 5.0.1. The private-party wallet.ts imports the v9 protocol package and the wallet SDK. Its `transferNight` method builds an unshielded NIGHT transfer to an address and amount, signs the recipe with the wallet's unshielded keystore, finalizes it, submits it, and returns the string from submitTransaction. The sender pays its own fees. The default TTL is one hour.
  - Transaction ID: the manage-dust page says "To read the result of one transaction, look it up in the indexer by the identifier that `submitTransaction` returns." So the returned string is the identifier to keep. The page also says a resolved submitTransaction does not mean the wallet has applied the result, and points to waitUntilSettled and resultOf for that.
  - Fee warning: ledger 9 changes fees (a min_block_price floor), so do not copy fee numbers from older examples. The sender needs DUST. The Wallet SDK 2 release notes say wallets now take typed address objects instead of strings, and the ledger 9 page says methods no longer take a secretKeys argument.
  - Ledger 8 pages still on the docs site: node-server-wallet (SDK 1.2.0), wallet-developer-guide "Make transfers" > "Unshielded transfers", api-reference/wallet-sdk "Transfers", build-a-wallet and tokens/unshielded-token all carry a ledger 8 warning. The wallet-sdk API reference does not state what submitTransaction returns. Use them for the call sequence only: transferTransaction, signRecipe, finalizeRecipe, submitTransaction.
  - The node-server-wallet example is local-network only and sends NIGHT from the genesis wallet. For Preview or Preprod it says to use the faucet instead.
- Checked (2026-11-26):
  - Your open question is answered: the NIGHT transfer is under "Estimating a fee before submitting" > Procedure, step 1 (built with `payFees: false`). The same procedure's step 5 shows `const identifier = await wallet.submitTransaction(finalized);`. Both blocks transcribed below.
  - `transferNight` confirmed verbatim, midnight-examples main at c37451a. Our registry/src/wallet.ts is the same MidnightWalletProvider class from the same repo but without this method, so adding it is a copy, not new code.
  - The two ledger 9 sources use slightly different names: private-party uses `nativeToken().raw` and `signDataAsync`; manage-dust uses `unshieldedToken().raw` and `signData`. Both are ledger 9.
- Code pattern from source: (transcribed 2026-11-26. wallet.ts copied byte for byte from midnightntwrk/midnight-examples main at c37451a. manage-dust blocks copied from the page's source file in midnightntwrk/midnight-docs main at 549bd62, then checked by SHA-256 against the live page in Chrome: both match.)

  private-party src/wallet.ts, method `transferNight` (lines 188 to 216):

```typescript
  /**
   * Sends unshielded NIGHT to another wallet, paying this wallet's own fees.
   *
   * Whether the NIGHT sent here goes on to generate DUST depends entirely on the
   * RECIPIENT's key: the ledger creates a DUST UTXO only when a NIGHT UTXO is
   * created under a key that already has an entry in its Registration Table. So an
   * unregistered recipient ends up holding NIGHT while still having zero DUST —
   * which is exactly the precondition the sponsorship demo needs.
   */
  async transferNight(
    to: UnshieldedAddress,
    amount: bigint,
    ttl: Date = ttlOneHour(),
  ): Promise<string> {
    const recipe = await this.wallet.transferTransaction(
      [
        {
          type: 'unshielded',
          outputs: [{ type: nativeToken().raw, receiverAddress: to, amount }],
        },
      ],
      { ttl },
    );
    const signed = await this.wallet.signRecipe(recipe, (payload) =>
      this.unshieldedKeystore.signDataAsync(payload),
    );
    const finalized = await this.wallet.finalizeRecipe(signed);
    return await this.wallet.submitTransaction(finalized);
  }
```

  manage-dust, "Estimating a fee before submitting" > Procedure, step 1:

```typescript
const ttl = new Date(Date.now() + 30 * 60 * 1000);
const recipient = String(unshieldedKeystore.getBech32Address());
const receiverAddress = MidnightBech32m.parse(recipient).decode(UnshieldedAddress, networkId);

const recipe = await wallet.transferTransaction(
  [{ type: 'unshielded', outputs: [{ type: unshieldedToken().raw, receiverAddress, amount: 1_000_000n }] }],
  { ttl, payFees: false },
);
```

  manage-dust, "Estimating a fee before submitting" > Procedure, step 5:

```typescript
// The fee a transaction declares: the sum of `vFee` over every DUST spend in every intent.
const sumDeclaredFees = (handle: WalletTransaction) => {
  // The wallet returns transactions as handles. Read the ledger transaction that the handle carries.
  const tx =
    handle.stage === 'Finalized'
      ? ledger.Transaction.deserialize('signature', 'proof', 'binding', handle.serialize())
      : ledger.Transaction.deserialize('signature', 'pre-proof', 'pre-binding', handle.serialize());
  let total = 0n;
  for (const [, intent] of tx.intents ?? []) {
    for (const spend of intent.dustActions?.spends ?? []) total += spend.vFee;
  }
  return total;
};

const declared = sumDeclaredFees(finalized);
const identifier = await wallet.submitTransaction(finalized);
```

## Topic 13: Midnight, confirming a payment arrived
What to find: how code checks that a given transaction paid a given amount to a given address.
- URL: https://docs.midnight.network/api-reference/midnight-indexer (Midnight Indexer API v4, GraphQL)
  Also: https://docs.midnight.network/api-reference/midnight-indexer/types/objects/unshielded-utxo
  Also: https://docs.midnight.network/api-reference/midnight-indexer/operations/subscriptions/unshielded-transactions
  Also: https://docs.midnight.network/relnotes/wallet/wallet-2-0-0 (wallet transaction history)
  Also: https://docs.midnight.network/guides/manage-dust (looking up one transaction's result)
- Where on the page:
  - Indexer page: "Example queries and mutations" > "transactions(offset: TransactionOffset!): [Transaction!]!" > "Example: Query transactions by hash" and "Example: Query transactions by identifier"; "Input types" > "TransactionOffset (oneOf)"; "Transaction type" (fields) > "TransactionResult type"; "Unshielded token types" > "UnshieldedUtxo"; "Subscriptions: Real-time updates" > "Unshielded transactions subscription" > "Parameters" and "Event types".
  - Wallet 2.0.0 release notes: heading "New features" > "Unshielded transaction history with UTXOs", and "Known issues".
  - Build a wallet page: section on history (mentions the facade's getAllFromTxHistory()).
  - manage-dust: the sentence beginning "To read the result of one transaction" and the indexedTransaction helper.
- What it taught:
  - Look up a transaction: the indexer's transactions query takes a TransactionOffset with two options, hash or identifier. The identifier is what submitTransaction returns (see Topic 12). The transaction has fields including id, hash, block, unshieldedCreatedOutputs, unshieldedSpentOutputs, and for regular transactions transactionResult, fee and identifiers.
  - Check the payment: each unshielded output (UnshieldedUtxo) has owner (Bech32m address), value (a string, to hold u128), tokenType, intentHash, outputIndex, createdAtTransaction and spentAtTransaction (null if unspent). So a check would read the transaction's created outputs and compare owner, value and token type. The indexer pages describe these fields but do not show a worked "verify a payment" example, so the comparison logic is yours to write.
  - Check it succeeded: read transactionResult as well. The manage-dust page says indexedTransaction polls the indexer's transactions query for the fee and transactionResult of a submitted transaction.
  - Live alternative: the unshieldedTransactions subscription takes an address (and an optional transactionId) and sends UnshieldedTransaction events (transaction, createdUtxos, spentUtxos) and UnshieldedTransactionsProgress events (highestTransactionId).
  - Wallet alternative: Wallet SDK 2.0.0 gives each unshielded history entry createdUtxos and spentUtxos with value, owner, tokenType, intentHash and outputIndex. Its known issues say only the unshielded wallet keeps history. The wallet SDK pages I read show history storage being configured but no query example; the build-a-wallet page names getAllFromTxHistory().
  - Caveats: the Preprod indexer address on the networks page is a Blockfrost URL under /api/v0, while the indexer page is the v4 API (/api/v4 locally). I did not verify that the same queries work on the Blockfrost endpoint, so test that. The indexer page also marks parts of the API as beta.
  - Not found: a guide that ties a payment check to a specific address, amount and transaction in one place.
- Checked (2026-11-26):
  - Both example queries confirmed. The "by identifier" example selects only id, hash and the unshielded outputs. `transactionResult` appears only in the "by hash" example, inside `... on RegularTransaction { ... }`. Asking for both in one query is ours to combine.
  - Gap confirmed: manage-dust names `indexedTransaction` and `resultOf` and describes them, but does not show their code. The query itself therefore comes from the indexer page, not from manage-dust.
  - Your Blockfrost caveat applies to Preprod only. We use Preview, whose indexer is already the v4 endpoint in our config (indexer.preview.midnight.network/api/v4/graphql) and has answered every query so far.
  - Not transcribed: the subscription and wallet-history routes. The one-off query by identifier covers what the facilitator needs.
- Code pattern from source: (transcribed 2026-11-26 from the page's source file in midnightntwrk/midnight-docs main at 549bd62, then checked by SHA-256 against the live page in Chrome: all three match.)

  Indexer page, "API endpoints" > "HTTP endpoint (queries and mutations)":

```shell
POST https://<host>:<port>/api/v4/graphql
Content-Type: application/json
```

  Indexer page, "transactions(offset: TransactionOffset!)" > "Example: Query transactions by identifier":

```graphql
query {
  transactions(offset: { identifier: "abc123..." }) {
    id
    hash
    unshieldedCreatedOutputs {
      owner
      value
      tokenType
    }
    unshieldedSpentOutputs {
      owner
      value
      tokenType
    }
  }
}
```

  Indexer page, "transactions(offset: TransactionOffset!)" > "Example: Query transactions by hash":

```graphql
query {
  transactions(offset: { hash: "3031323..." }) {
    id
    hash
    protocolVersion
    block {
      height
      hash
    }
    raw
    contractActions {
      __typename
      ... on ContractDeploy {
        address
        state
        zswapState
        unshieldedBalances {
          tokenType
          amount
        }
      }
      ... on ContractCall {
        address
        state
        entryPoint
        zswapState
        unshieldedBalances {
          tokenType
          amount
        }
      }
      ... on ContractUpdate {
        address
        state
        zswapState
        unshieldedBalances {
          tokenType
          amount
        }
      }
    }
    ... on RegularTransaction {
      zswapMerkleTreeRoot
      identifiers
      fee
      transactionResult {
        status
        segments {
          id
          success
        }
      }
    }
    unshieldedCreatedOutputs {
      owner
      value
      tokenType
      intentHash
      outputIndex
    }
    unshieldedSpentOutputs {
      owner
      value
      tokenType
      intentHash
      outputIndex
    }
  }
}
```
