// The x402 `exact` scheme on Midnight, "client-submitted (payment proof)" family, `upfront` flow.
// Sources (research plan): the generic exact spec's client-submitted rules (Topic 10, added 2026-11-26),
// spec 6.1 upfront flow and 7.2 "marking a transaction as used" (Topic 10), the SDK plug-in interfaces
// SchemeNetworkServer / SchemeNetworkClient / SchemeNetworkFacilitator (types in @x402/core 2.32.0),
// transferNight (Topic 12) and the indexer `transactions` query (Topic 13).
// Everything that joins these together is OURS and marked so.
import fs from 'node:fs'; // the claim store survives restarts
import { MidnightBech32m, UnshieldedAddress } from '@midnightntwrk/wallet-sdk'; // address parsing (Topic 12, manage-dust step 1)
import { nativeToken } from '@midnight-ntwrk/midnight-js-protocol/v9'; // NIGHT's token id (Topic 12, transferNight)
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
// The payload this scheme carries: the identifier submitTransaction returned (Topic 12).
export type MidnightPayload = { transaction: string };

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

// What Agent B's x402 client calls when it meets a 402: pay on Midnight, return the proof.
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
    const payload: MidnightPayload = { transaction };
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

// Checks a Midnight payment on the indexer, then claims it once. Settle is where the claim happens
// (spec 7.2: "marking a transaction as used"); verify is read-only.
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

  // The checks, modelled on the Cardano spec's Facilitator Verification Rules (OURS for Midnight).
  private check(tx: IndexedTx, req: PaymentRequirements): string | undefined {
    if (tx.transactionResult?.status !== 'SUCCESS') return 'transaction_not_successful'; // finality: applied in full
    const paid = tx.unshieldedCreatedOutputs
      .filter((o) => o.owner === req.payTo && o.tokenType === req.asset) // recipient and asset must match exactly
      .reduce((sum, o) => sum + BigInt(o.value), 0n);
    if (paid < BigInt(req.amount)) return 'insufficient_amount'; // below the price: rejected, not refunded
    const ageMs = Date.now() - (tx.block?.timestamp ?? 0); // retention bound: proofs expire
    if (ageMs > req.maxTimeoutSeconds * 1000) return 'payment_too_old';
    return undefined; // at or above the price, recent, successful: accepted (overpayment is kept)
  }

  async verify(payload: PaymentPayload, req: PaymentRequirements): Promise<VerifyResponse> {
    const { transaction } = payload.payload as MidnightPayload;
    if (typeof transaction !== 'string' || !/^[0-9a-f]+$/i.test(transaction)) return { isValid: false, invalidReason: 'invalid_payload' };
    if (this.claims.has(this.key(req.network, transaction))) return { isValid: false, invalidReason: 'payment_already_used' };
    const tx = await this.lookup(transaction);
    if (!tx) return { isValid: false, invalidReason: 'transaction_not_found' };
    const reason = this.check(tx, req);
    return reason ? { isValid: false, invalidReason: reason } : { isValid: true, payer: tx.unshieldedSpentOutputs[0]?.owner };
  }

  async settle(payload: PaymentPayload, req: PaymentRequirements): Promise<SettleResponse> {
    const { transaction } = payload.payload as MidnightPayload;
    const fail = (errorReason: string): SettleResponse => ({ success: false, errorReason, transaction: transaction ?? '', network: req.network });
    if (typeof transaction !== 'string' || !/^[0-9a-f]+$/i.test(transaction)) return fail('invalid_payload');
    const key = this.key(req.network, transaction);
    // Single-use claim, taken before the first await so two concurrent calls cannot both pass (Cardano spec, mitigation step 3).
    if (this.claims.has(key)) return fail('payment_already_used');
    this.claims.set(key, Date.now());
    try {
      let tx: IndexedTx | undefined;
      const deadline = Date.now() + this.waitMs;
      while (!(tx = await this.lookup(transaction)) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000)); // wait for the block, as Topic 12 warns submit is not settle
      }
      if (!tx) { this.claims.delete(key); return fail('settlement_pending'); } // not landed yet: release the claim, retry later
      const reason = this.check(tx, req);
      if (reason) return fail(reason); // a bad payment stays claimed: it can never become good
      fs.writeFileSync(this.claimFile, JSON.stringify(Object.fromEntries(this.claims))); // keep the claim across restarts
      return { success: true, payer: tx.unshieldedSpentOutputs[0]?.owner, transaction, network: req.network, amount: req.amount };
    } catch (e) {
      this.claims.delete(key); // indexer error: nothing was decided, so release the claim
      throw e;
    }
  }
}
