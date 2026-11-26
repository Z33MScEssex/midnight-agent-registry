// In-memory tests for x402 request binding (Topic 14): no network, no wallet, no tNIGHT.
// The indexer is replaced by a stub that returns one made-up transaction, so the facilitator's own checks
// are what is tested. Keys are random throwaway keys. Run: npm run test:sim.

import fs from 'node:fs'; // temp claim file
import os from 'node:os'; // temp folder
import path from 'node:path'; // temp file path
import { randomBytes } from 'node:crypto'; // random keys and transaction ids
import { afterEach, describe, expect, it, vi } from 'vitest'; // test runner
import { createKeystore } from '@midnightntwrk/wallet-sdk'; // Topic 9 keystore
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types'; // x402 shapes
import {
  MIDNIGHT_PREVIEW,
  NIGHT_ASSET,
  MidnightExactFacilitator,
  bindingPayload,
  prefixMessage,
  type MidnightPayload,
} from '../../demo/midnight-x402.js'; // the code under test

const keystore = () => createKeystore({ kind: 'schnorr', secret: new Uint8Array(randomBytes(32)) }, 'preview'); // throwaway key
const PAYER = keystore(); // the honest buyer
const THIEF = keystore(); // someone who saw the payment on chain
const AGENT_A = keystore().getBech32Address().asString(); // the seller's receiving address
const TX = randomBytes(33).toString('hex'); // a made-up transaction identifier

// The payment requirements Agent A's paywall sends (same fields as demo/agent-a.ts).
const req: PaymentRequirements = {
  scheme: 'exact',
  network: MIDNIGHT_PREVIEW,
  asset: NIGHT_ASSET,
  amount: '100000',
  payTo: AGENT_A,
  maxTimeoutSeconds: 600,
  extra: { paymentFlow: 'upfront' },
};

// What a payer's client would send, signed by `signer` over `signedReq` (default: the real requirements).
function proof(signer = PAYER, signedReq = req, tx = TX, prefixed = true): PaymentPayload {
  const message = bindingPayload(signedReq, tx); // what is being bound
  const payload: MidnightPayload = {
    transaction: tx,
    verifyingKey: signer.getPublicKey(),
    signature: signer.signData(prefixed ? prefixMessage(message) : message),
  };
  return { x402Version: 2, accepted: req, payload };
}

// The indexer's answer for TX: PAYER spent, AGENT_A received 100000 NIGHT, just now, successfully.
function stubIndexer(spender = PAYER.getBech32Address().asString()) {
  const tx = {
    hash: 'aa',
    block: { timestamp: Date.now() },
    unshieldedCreatedOutputs: [{ owner: AGENT_A, value: '100000', tokenType: NIGHT_ASSET }],
    unshieldedSpentOutputs: [{ owner: spender }],
    transactionResult: { status: 'SUCCESS' },
  };
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ data: { transactions: [tx] } })));
}

const facilitator = () =>
  new MidnightExactFacilitator('http://indexer.invalid', path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'x402-')), 'claims.json'), 0);

afterEach(() => vi.unstubAllGlobals());

describe('x402 request binding on Midnight', () => {
  it('accepts the payer, then refuses the same payment a second time', async () => {
    stubIndexer();
    const f = facilitator();
    expect(await f.verify(proof(), req)).toMatchObject({ isValid: true, payer: PAYER.getBech32Address().asString() });
    expect(await f.settle(proof(), req)).toMatchObject({ success: true });
    expect(await f.settle(proof(), req)).toMatchObject({ success: false, errorReason: 'payment_already_used' });
  });

  it('refuses a thief who signs the payer\'s transaction with their own key, and holds no claim', async () => {
    stubIndexer();
    const f = facilitator();
    expect(await f.settle(proof(THIEF), req)).toMatchObject({ success: false, errorReason: 'payer_mismatch' });
    expect(await f.settle(proof(), req)).toMatchObject({ success: true }); // the real payer is not blocked
  });

  it('refuses a signature made for different requirements (a lower amount)', async () => {
    stubIndexer();
    const cheaper = { ...req, amount: '1' };
    expect(await facilitator().settle(proof(PAYER, cheaper), req)).toMatchObject({ errorReason: 'invalid_signature' });
  });

  it('refuses a signature over a different transaction id', async () => {
    stubIndexer();
    const other = randomBytes(33).toString('hex');
    const p = proof(PAYER, req, other); // signed for `other`
    (p.payload as MidnightPayload).transaction = TX; // but presented for TX
    expect(await facilitator().settle(p, req)).toMatchObject({ errorReason: 'invalid_signature' });
  });

  it('refuses a signature without the midnight_signed_message prefix', async () => {
    stubIndexer();
    expect(await facilitator().settle(proof(PAYER, req, TX, false), req)).toMatchObject({ errorReason: 'invalid_signature' });
  });

  it('refuses a proof with no signature (the version 1 format) and a non-Schnorr key', async () => {
    stubIndexer();
    const f = facilitator();
    const bare = { x402Version: 2, accepted: req, payload: { transaction: TX } } as PaymentPayload;
    expect(await f.settle(bare, req)).toMatchObject({ errorReason: 'invalid_payload' });
    const p = proof();
    (p.payload as MidnightPayload).verifyingKey = { tag: 'ecdsa', value: '02' + 'ab'.repeat(32) };
    expect(await f.settle(p, req)).toMatchObject({ errorReason: 'invalid_payload' });
  });

  it('refuses a payer who did not spend all the inputs', async () => {
    stubIndexer(THIEF.getBech32Address().asString()); // someone else spent the inputs
    expect(await facilitator().settle(proof(), req)).toMatchObject({ errorReason: 'payer_mismatch' });
  });
});
