// Live check of request binding (Topic 14): a thief copies a real payment's transaction id from the chain,
// signs it with their own key, and presents it to the facilitator. Expected: refused with payer_mismatch.
// No wallet, no tNIGHT: the thief's key is random and thrown away. All of this file is OURS.
//
//   MIDNIGHT_NETWORK=preview npx tsx --tsconfig tsconfig.demo.json demo/thief-test.ts <transaction id>
import { randomBytes } from 'node:crypto'; // the thief's throwaway key
import { createKeystore } from '@midnightntwrk/wallet-sdk'; // Topic 9 keystore
import type { PaymentRequirements } from '@x402/core/types'; // x402 shape
import { bindingPayload, prefixMessage, type MidnightPayload } from './midnight-x402.js'; // our scheme

const transaction = process.argv[2]; // a real payment to Agent A, read from the chain
if (!transaction) throw new Error('give a transaction id');
const AGENT_A = process.env.AGENT_A_URL || 'http://localhost:41241/'; // Agent A's paywalled endpoint
const FACILITATOR = process.env.FACILITATOR_URL || 'http://localhost:4022'; // our facilitator

// 1. Ask Agent A without paying, to get its real payment requirements from the 402.
const res = await fetch(AGENT_A, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
const required = JSON.parse(Buffer.from(res.headers.get('payment-required') ?? '', 'base64').toString('utf8'));
const req = required.accepts[0] as PaymentRequirements; // the Midnight requirement
console.log(`[Thief] Agent A answered ${res.status}, asking ${req.amount} STAR to ${req.payTo.slice(0, 24)}...`);

// 2. Sign the copied transaction id with the thief's own key, exactly as an honest client would.
const thief = createKeystore({ kind: 'schnorr', secret: new Uint8Array(randomBytes(32)) }, 'preview');
const payload: MidnightPayload = {
  transaction,
  verifyingKey: thief.getPublicKey(),
  signature: thief.signData(prefixMessage(bindingPayload(req, transaction))),
};
const body = JSON.stringify({ x402Version: 2, paymentPayload: { x402Version: 2, accepted: req, payload }, paymentRequirements: req });

// 3. Present it to the facilitator, read-only first, then as a claim.
for (const route of ['verify', 'settle']) {
  const r = await fetch(`${FACILITATOR}/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  console.log(`[Thief] /${route} -> ${JSON.stringify(await r.json())}`);
}
