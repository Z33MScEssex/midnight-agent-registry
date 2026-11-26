# Design

## The problem

AI agents are starting to call each other. The Agent2Agent protocol (A2A) covers *how* one
agent calls another: each agent publishes an **Agent Card**, a JSON file saying what it does and
where to send requests. It does not cover how an agent *finds* another one in the first place.
The usual answer is a well-known URL, which only works if you already know the domain.

Midnight has a proposal for agent identity, **MIP-0029** (status: Proposed). It defines an on-chain
registry where each agent gets an ID and a metadata record: name, description, capabilities and
version. However, the record has no field for where to reach the agent or what it charges. That
gap is raised as an open question in MIP-0029's companion problem statement, MPS-0015 ("Should
agent metadata include a field for payment information such as what the agent charges and how to
pay it?"), and again in the forum RFC.

## What this project does

It joins the two. The chain says **who** an agent is and **where** its card lives. A2A says
**how** to call it.

1. Agent A runs an A2A server and registers on Midnight. Its record carries MIP-0029's fields plus
   two extensions: the URL of its Agent Card and its price per request.
2. Agent B reads the registry, picks an agent, downloads the card from the URL on chain, checks
   the card matches the record, and calls the agent over A2A.

Reading the registry is a query to Midnight's indexer. It needs no wallet and costs nothing.
Only registering and updating are transactions, paid in DUST.

## The record

| Field | Type | Source |
|---|---|---|
| `name` | text | MIP-0029 2.4 |
| `description` | text | MIP-0029 2.4 |
| `capabilities` | text, e.g. `"DATA,PAYMENT"` | MIP-0029 2.4 (stored as text, see below) |
| `version` | text | MIP-0029 2.4 |
| `endpoint` | text: Agent Card URL | **extension** |
| `price` | `Uint<64>`, smallest unit | **extension** |
| `ownerHash` | `Bytes<32>` | ownership commitment, see below |

Records live in `Map<Uint<64>, AgentRecord>`. IDs come from a `Counter`, so the first agent is 1.
MIP-0029 2.1 says public registration hands back a numeric AgentId, and `register` returns it.

Text uses Compact's `Opaque<"string">`, not `Bytes<32>`. A URL is usually longer than 32 bytes.
In TypeScript these fields arrive as plain strings, so an agent can read them directly.

## Who can change a record

Only the key that registered it, matching MIP-0029's "updateMetadata, operator only".

- The operator holds a 32-byte secret key. It stays off chain; the contract gets it through a
  *witness*, a private input to the zero-knowledge proof.
- On registration the contract stores `ownerHash = persistentHash("agent-registry:owner:", key)`.
  The text at the front is a domain separator, so this hash can't be confused with one made from
  the same key for another purpose.
- `updateRecord` recomputes the hash from the caller's key and refuses with `not the owner` unless
  it matches. The write is a Map `insert` at the same ID, which replaces the record. The owner
  hash is carried over, so an update cannot change the owner.
- `verifyOwnership` lets an operator prove they own a record without revealing who they are.

The owner key is separate from the wallet that pays the fee. One wallet can pay for many agents
with different owners. This pattern comes from Midnight's leaderboard tutorial.

## Public and private

| On chain, readable by anyone | Kept private |
|---|---|
| Every record field, including `ownerHash` | The owner's secret key |
| The counter | The wallet seed |
| That someone proved ownership of an ID | Who that someone was |

The tests check this directly: after every run, no secret key appears anywhere in public state.
One thing to note is that records registered with the same key share an `ownerHash`. They can be
linked to each other, though not to a wallet or a person.

## How Agent B decides to trust a card

Agent B downloads the card from the endpoint on chain and refuses it if the card's name differs
from the record's. This catches a stale or wrong URL. It does not stop a malicious endpoint,
because whoever runs the URL writes the card. A stronger check would store a hash of the card on
chain and compare it. That is listed under next steps.

## Where this differs from MIP-0029

- **Capabilities are text**, not an enum list. It's simpler to store, and the demo needs none of
  the list operations. MIP-0029's values (PAYMENT, TRADING, GOVERNANCE, COMPLIANCE, DATA) are used
  as the text.
- **Not included:** the optional `homepage` and `erc8004TokenId`, `deactivate`,
  `transferOperator`, private-mode registration, and the Reputation, Validation and Disclosure
  registries.
- **Added:** `endpoint` and `price`.

## Known limits

- **Names are not unique.** Anyone can register any name. Agent B picks the newest record with
  the name it asked for, so a later impostor record would win. Looking agents up by ID, or by a
  trusted `ownerHash`, avoids this. It is the first thing to fix.
- **Agent A's endpoint is `localhost`.** Only the same machine can reach it. A public demo needs
  hosting or a tunnel.
- **The price is stored, not charged.** Charging it per request is the x402 stretch goal.
- **No size limit on text fields.** The writer pays for what they store, but a reader should not
  trust field lengths.
- **Unreachable endpoints** end Agent B with `fetch failed`. The result is right, but the message
  is not friendly.

## Next steps

1. Look up by ID or owner, not only by name.
2. Store a hash of the Agent Card on chain and check it.
3. x402: Agent A answers `402 Payment Required` with the on-chain price, and Agent B pays and retries.
4. A public endpoint for Agent A.
5. `deactivate`, to match MIP-0029.
