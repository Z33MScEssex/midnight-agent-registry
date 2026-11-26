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
   the card matches the record, pays the price over x402, and calls the agent over A2A.

Reading the registry is a query to Midnight's indexer. It needs no wallet and costs nothing.
Registering, updating and paying Agent A are transactions. Fees are paid in DUST; the payment itself is tNIGHT.

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

## Payments (x402)

Agent A charges per call, and Agent B pays in tNIGHT on Midnight, using the x402 protocol's real
messages and SDK.

1. Agent B calls Agent A's A2A endpoint. Agent A answers **HTTP 402** with a `PAYMENT-REQUIRED`
   header: scheme `exact`, network `midnight:preview`, an amount in STAR (the smallest unit of NIGHT),
   Agent A's address, and the `upfront` payment flow.
2. Agent B checks the amount against the `price` in Agent A's **on-chain record**, and refuses anything
   higher. This uses the x402 SDK's own spend control, set from the registry.
3. Agent B sends the tNIGHT on Midnight, then repeats the call with the transaction identifier in a
   `PAYMENT-SIGNATURE` header.
4. Agent A's facilitator looks the transaction up on Midnight's indexer. It checks that the payment
   succeeded, went to Agent A's address, was NIGHT, was at least the price, and is recent. Then it
   **claims it once**. Only after that does Agent A answer.

**Why this shape.** x402's generic `exact` spec defines a "client-submitted (payment proof)" family for
networks where the payer submits the payment itself, and says it must use the `upfront` flow (settle,
then serve). Spec section 7.2 allows settle to be "marking a transaction as used" after reading the
ledger. So nothing here is a custom protocol: it is a new network plugged into x402's documented
extension points.

**Claims.** The single-use key is the network joined to the transaction identifier, as the spec asks.
It is taken before the facilitator waits on anything, so two copies of one proof cannot both pass.
Claims are written to disk, so a restart does not reopen old payments. Proofs older than the 402's
time window are refused.

**Amounts.** Less than the price is refused and not returned. More than the price is accepted and kept.

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
- **Payments are not bound to one request.** The x402 spec asks each payment proof to be tied to the
  request it pays for. A Midnight public transfer has no memo field to carry a request id, so this
  version uses the spec's fallback: one facilitator per receiving address, whose single-use store sees
  every claim. Binding with a payer signature over the payment request is the next step.
- **Agent B's first payment waits for its wallet to sync,** a few minutes on a fresh start.
- **No size limit on text fields.** The writer pays for what they store, but a reader should not
  trust field lengths.
- **Unreachable endpoints** end Agent B with `fetch failed`. The result is right, but the message
  is not friendly.

## Next steps

1. Look up by ID or owner, not only by name.
2. Store a hash of the Agent Card on chain and check it.
3. Bind each payment to its request with a payer signature over the payment request.
4. A public endpoint for Agent A.
5. `deactivate`, to match MIP-0029.
