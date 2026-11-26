// The x402 `exact` scheme on Midnight, "client-submitted (payment proof)" family, `upfront` flow.
// Sources (research plan): the generic exact spec's client-submitted rules (Topic 10, added 2026-11-26),
// spec 6.1 upfront flow and 7.2 "marking a transaction as used" (Topic 10), the SDK plug-in interfaces
// SchemeNetworkServer / SchemeNetworkClient / SchemeNetworkFacilitator (types in @x402/core 2.32.0),
// transferNight (Topic 12), the indexer `transactions` query (Topic 13), and request binding by a payer
// signature (Topic 14: prefixMessage, keystore signData, ledger verifySignature and addressFromKey).
// Everything that joins these together is OURS and marked so.
import fs from 'node:fs'; // the claim store survives restarts
import { MidnightBech32m, UnshieldedAddress } from '@midnightntwrk/wallet-sdk'; // address parsing (Topic 12, manage-dust step 1)
import { nativeToken } from '@midnight-ntwrk/midnight-js-protocol/v9'; // NIGHT's token id (Topic 12, transferNight)
import * as ledger from '@midnightntwrk/ledger-v9'; // verifySignature and addressFromKey (Topic 14, ledger 9 records)
import type {
  AssetAmount,
  Network,
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkClient,
  SchemeNetworkFacilitator,
  SchemeNetworkServer,
  SettleResponse,
  SupportedKind,
  VerifyResponse,
} from '@x402/core/types'; // the SDK's plug-in interfaces
import type { MidnightWalletProvider } from '../src/wallet.js'; // the template wallet, with transferNight added

// OURS: human-readable network id in CAIP-2 syntax, following the Cardano spec's `cardano:preview` choice.
export const MIDNIGHT_PREVIEW: Network = 'midnight:preview';
// NIGHT's token type as the indexer reports it (hex). The same value transferNight pays in.
export const NIGHT_ASSET: string = nativeToken().raw;
// The payload this scheme carries: the identifier submitTransaction returned (Topic 12), plus the payer's
// key and its signature binding that identifier to these payment requirements (Topic 14, ledger 9 records).
export type MidnightPayload = {
  transaction: string; // what was paid
  verifyingKey: ledger.SignatureVerifyingKey; // { tag, value }: the key that spent the tNIGHT
  signature: ledger.Signature; // { tag, value }: that key's signature over bindingMessage(...)
};

// ---------------------------------------------------------------- request binding (Topic 14)

// OURS: what the payer signs. MIP-0031 section 1 asks for the app's own identity in the payload, so a
// signature made for this cannot be reused elsewhere. The rest is the payment requirements plus the proof.
// The SDK's scheme client is not given the resource URL, so it cannot be included (DESIGN.md, limits).
const BINDING_TAG = 'agent-registry:x402-midnight:v1';
export function bindingPayload(req: PaymentRequirements, transaction: string): Uint8Array {
  const fields = [BINDING_TAG, req.network, req.payTo, req.amount, req.asset, transaction]; // order is fixed
  return new TextEncoder().encode(fields.join('|')); // '|' cannot appear in any field (all hex, Bech32m or digits)
}

// Topic 14, Build a wallet step 5, verbatim: the connector spec's prefix, so this can never sign a transaction.
export function prefixMessage(data: Uint8Array): Uint8Array {
  const header = new TextEncoder().encode(`midnight_signed_message:${data.length}:`); // size in bytes
  const message = new Uint8Array(header.length + data.length); // room for both
  message.set(header); // prefix first
  message.set(data, header.length); // then the payload
  return message;
}

// OURS: the wire form MIP-0031 section 5 sets for Schnorr (64 hex key, 128 hex signature, lowercase),
// applied to the ledger 9 records. v1 accepts Schnorr only, the kind our wallets use (Topic 14, Item 4).
function isSchnorrRecord(x: unknown, hexLength: number): x is { tag: 'schnorr'; value: string } {
  if (typeof x !== 'object' || x === null) return false; // must be an object
  const r = x as { tag?: unknown; value?: unknown }; // read each field once
  return r.tag === 'schnorr' && typeof r.value === 'string' && new RegExp(`^[0-9a-f]{${hexLength}}$`).test(r.value);
}

// ---------------------------------------------------------------- server side (Agent A)

// What Agent A's x402 middleware uses to build its 402 response.
export class MidnightExactServer implements SchemeNetworkServer {
  readonly scheme = 'exact'; // x402's fixed-price scheme
  readonly defaultAssetTransferMethod = 'default'; // SDK plumbing: this scheme has one transfer method
  // Generic exact spec: client-submitted methods "MUST use `upfront`".
  readonly paymentFlows = { default: { supported: ['upfront'] as const, default: 'upfront' as const } };

  // Prices are explicit STAR amounts. A "$0.01" string needs a default stablecoin, which Midnight lacks (Topic 10).
  async parsePrice(price: unknown): Promise<AssetAmount> {
    if (typeof price === 'object' && price !== null && 'amount' in price && 'asset' in price) {
      return price as AssetAmount; // already { amount, asset }
    }
    throw new Error('midnight exact: give the price as { amount: "<STAR>", asset: NIGHT_ASSET }');
  }

  // Nothing to add: payTo, amount and asset already describe the payment.
  async enhancePaymentRequirements(requirements: PaymentRequirements, _kind: SupportedKind, _ext: string[]): Promise<PaymentRequirements> {
    return requirements;
  }
}

// ---------------------------------------------------------------- client side (Agent B)

// What Agent B's x402 client calls when it meets a 402: pay on Midnight, sign the proof, return both.
export class MidnightExactClient implements SchemeNetworkClient {
  readonly scheme = 'exact';
  // The wallet is opened only when a payment is actually made (OURS): a refused 402 costs no wallet sync.
  constructor(private readonly getWallet: () => Promise<MidnightWalletProvider>, private readonly networkId: string) {}

  async createPaymentPayload(x402Version: number, req: PaymentRequirements, context?: { maxAmountPerPayment?: string }) {
    if (req.asset !== NIGHT_ASSET) throw new Error(`midnight exact: unsupported asset ${req.asset}`); // OURS: NIGHT only
    const amount = BigInt(req.amount); // atomic units (STAR)
    if (context?.maxAmountPerPayment !== undefined && amount > BigInt(context.maxAmountPerPayment)) {
      throw new Error(`midnight exact: ${amount} STAR is above the cap of ${context.maxAmountPerPayment}`); // spend control
    }
    const to = MidnightBech32m.parse(req.payTo).decode(UnshieldedAddress, this.networkId); // rejects another network's address
    const ttl = new Date(Date.now() + req.maxTimeoutSeconds * 1000); // OURS: payment must land inside the 402's window
    const wallet = await this.getWallet(); // synced and funded wallet
    const transaction = await wallet.transferNight(to, amount, ttl); // Topic 12: returns the identifier
    console.log(`[x402] Paid ${amount} STAR to ${req.payTo.slice(0, 24)}... in transaction ${transaction}`); // OURS: progress line
    // Topic 14: sign the prefixed binding message with the same unshielded key that spent the tNIGHT.
    const keystore = wallet.unshieldedKeystore; // the key transferNight signed the inputs with
    const signature = keystore.signData(prefixMessage(bindingPayload(req, transaction))); // ledger 9: { tag, value }
    const payload: MidnightPayload = { transaction, verifyingKey: keystore.getPublicKey(), signature };
    return { x402Version, payload };
  }
}

// ---------------------------------------------------------------- facilitator side

// Topic 13: one indexer query, by identifier. Fields combined from the page's two examples (OURS).
const TX_QUERY = `query ($id: HexEncoded!) {
  transactions(offset: { identifier: $id }) {
    hash
    block { timestamp }
    unshieldedCreatedOutputs { owner value tokenType }
    unshieldedSpentOutputs { owner }
    ... on RegularTransaction { transactionResult { status } }
  }
}`;

type IndexedTx = {
  hash: string;
  block: { timestamp: number } | null;
  unshieldedCreatedOutputs: { owner: string; value: string; tokenType: string }[];
  unshieldedSpentOutputs: { owner: string }[];
  transactionResult?: { status: string };
};

// Checks a Midnight payment on the indexer and that the signer paid it, then claims it once.
// Order (OURS): the cheap signature check first, then the indexer, then the claim taken synchronously after
// the last await. Only the payer can produce a valid signature, so nobody else can ever hold a claim.
export class MidnightExactFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = 'exact';
  readonly caipFamily = 'midnight:*';
  private readonly claims: Map<string, number>; // claim key -> time claimed (ms)

  constructor(
    private readonly indexerUrl: string, // Preview indexer, v4 GraphQL (Topic 13)
    private readonly claimFile: string, // where claims are kept between restarts
    private readonly waitMs = 120_000, // how long settle waits for the transaction to be indexed
  ) {
    this.claims = fs.existsSync(claimFile) ? new Map(Object.entries(JSON.parse(fs.readFileSync(claimFile, 'utf8')))) : new Map();
  }

  getExtra(): Record<string, unknown> | undefined { return undefined; } // nothing scheme-specific to advertise
  getSigners(): string[] { return []; } // client-submitted: the facilitator signs nothing

  // Generic exact spec: claim key = CAIP-2 network joined to the payment's transaction id.
  private key(network: string, tx: string) { return `${network}:${tx}`; }

  private async lookup(identifier: string): Promise<IndexedTx | undefined> {
    const res = await fetch(this.indexerUrl, { // Topic 13: POST .../api/v4/graphql, JSON body
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: TX_QUERY, variables: { id: identifier } }),
    });
    const body = (await res.json()) as { data?: { transactions?: IndexedTx[] }; errors?: unknown };
    if (body.errors) throw new Error(`indexer: ${JSON.stringify(body.errors)}`);
    return body.data?.transactions?.[0]; // undefined until the transaction is in a block
  }

  // Topic 14: shape, then signature. Returns the payer's Bech32m address, or a reason to refuse.
  // The expected message is rebuilt here from the requirements the resource server sent (MIP-0031 section 7,
  // step 7): nothing signed is read back from the payload.
  private checkSignature(payload: PaymentPayload, req: PaymentRequirements): { reason: string } | { transaction: string; payer: string } {
    const p = payload.payload as Partial<MidnightPayload>; // untrusted
    const transaction = p.transaction; // read once
    if (typeof transaction !== 'string' || !/^[0-9a-f]+$/i.test(transaction)) return { reason: 'invalid_payload' };
    const vk = p.verifyingKey; // read once
    const sig = p.signature; // read once
    if (!isSchnorrRecord(vk, 64) || !isSchnorrRecord(sig, 128)) return { reason: 'invalid_payload' }; // MIP-0031 s5 wire form
    let valid = false; // MIP-0031 s7: every input reaches a verdict, a throw is a refusal
    try {
      valid = ledger.verifySignature(vk, prefixMessage(bindingPayload(req, transaction)), sig); // Topic 14, Item 3
    } catch {
      valid = false;
    }
    if (!valid) return { reason: 'invalid_signature' };
    const networkId = req.network.split(':')[1]; // 'midnight:preview' -> 'preview' (OURS)
    // Topic 14, Item 4: key -> address (hex) -> Bech32m for this network, the form the indexer reports as owner.
    const payer = MidnightBech32m.encode(networkId, new UnshieldedAddress(Buffer.from(ledger.addressFromKey(vk), 'hex'))).toString();
    return { transaction, payer };
  }

  // The on-chain checks, modelled on the Cardano spec's Facilitator Verification Rules (OURS for Midnight).
  private check(tx: IndexedTx, req: PaymentRequirements, payer: string): string | undefined {
    if (tx.transactionResult?.status !== 'SUCCESS') return 'transaction_not_successful'; // finality: applied in full
    // Request binding: the signer must be who spent the inputs. Every input, so nobody can sign for a shared one.
    const spenders = tx.unshieldedSpentOutputs.map((o) => o.owner);
    if (spenders.length === 0 || spenders.some((owner) => owner !== payer)) return 'payer_mismatch';
    const paid = tx.unshieldedCreatedOutputs
      .filter((o) => o.owner === req.payTo && o.tokenType === req.asset) // recipient and asset must match exactly
      .reduce((sum, o) => sum + BigInt(o.value), 0n);
    if (paid < BigInt(req.amount)) return 'insufficient_amount'; // below the price: rejected, not refunded
    const ageMs = Date.now() - (tx.block?.timestamp ?? 0); // retention bound: proofs expire
    if (ageMs > req.maxTimeoutSeconds * 1000) return 'payment_too_old';
    return undefined; // at or above the price, recent, successful, paid by the signer: accepted
  }

  async verify(payload: PaymentPayload, req: PaymentRequirements): Promise<VerifyResponse> {
    const signed = this.checkSignature(payload, req);
    if ('reason' in signed) return { isValid: false, invalidReason: signed.reason };
    const tx = await this.lookup(signed.transaction);
    if (!tx) return { isValid: false, invalidReason: 'transaction_not_found' };
    const reason = this.check(tx, req, signed.payer);
    if (reason) return { isValid: false, invalidReason: reason };
    if (this.claims.has(this.key(req.network, signed.transaction))) return { isValid: false, invalidReason: 'payment_already_used' };
    return { isValid: true, payer: signed.payer };
  }

  async settle(payload: PaymentPayload, req: PaymentRequirements): Promise<SettleResponse> {
    const raw = (payload.payload as { transaction?: unknown }).transaction; // for the failure reply only
    const fail = (errorReason: string): SettleResponse => ({ success: false, errorReason, transaction: typeof raw === 'string' ? raw : '', network: req.network });
    const signed = this.checkSignature(payload, req); // refused before any claim, so a forger can block nobody
    if ('reason' in signed) return fail(signed.reason);
    let tx: IndexedTx | undefined;
    const deadline = Date.now() + this.waitMs;
    while (!(tx = await this.lookup(signed.transaction)) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000)); // wait for the block, as Topic 12 warns submit is not settle
    }
    if (!tx) return fail('settlement_pending'); // not landed yet: nothing claimed, retry later
    const reason = this.check(tx, req, signed.payer);
    if (reason) return fail(reason); // nothing claimed: a refused proof never blocks the payer
    // Single-use claim. No await between this check and the set, so two concurrent settles cannot both pass.
    const key = this.key(req.network, signed.transaction);
    if (this.claims.has(key)) return fail('payment_already_used');
    this.claims.set(key, Date.now());
    fs.writeFileSync(this.claimFile, JSON.stringify(Object.fromEntries(this.claims))); // keep the claim across restarts
    return { success: true, payer: signed.payer, transaction: signed.transaction, network: req.network, amount: req.amount };
  }
}
