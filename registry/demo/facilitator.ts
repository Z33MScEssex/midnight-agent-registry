// The facilitator Agent A's server asks to check Midnight payments: POST /verify, POST /settle, GET /supported.
// Pattern: x402-foundation/x402 examples/typescript/facilitator/basic/index.ts (Topic 11).
// Changes: the EVM and SVM signers and schemes are replaced by our Midnight scheme, and the
// EVM-only payload check is dropped. Routes, hooks and error handling follow the example.
import path from 'node:path'; // claim file path
import { fileURLToPath } from 'node:url'; // %20-safe paths
import { x402Facilitator } from '@x402/core/facilitator'; // the SDK's facilitator core
import { PaymentPayload, PaymentRequirements, SettleResponse, VerifyResponse } from '@x402/core/types';
import express from 'express'; // web server
import { getConfig } from '../src/config.js'; // Preview indexer address
import { MIDNIGHT_PREVIEW, MidnightExactFacilitator } from './midnight-x402.js'; // our scheme

const PORT = process.env.PORT || '4022'; // example's default port
const here = path.dirname(fileURLToPath(import.meta.url));
const CLAIMS = path.resolve(here, '..', '.x402-claims.json'); // used payments, kept between restarts (gitignored)

// Hooks log each step, as in the example.
const facilitator = new x402Facilitator()
  .onBeforeVerify(async () => console.log('[Facilitator] Before verify'))
  .onAfterVerify(async (context) => console.log('[Facilitator] After verify', context.result))
  .onVerifyFailure(async (context) => console.log('[Facilitator] Verify failure', context.error))
  .onBeforeSettle(async () => console.log('[Facilitator] Before settle'))
  .onAfterSettle(async (context) => console.log('[Facilitator] After settle', context.result))
  .onSettleFailure(async (context) => console.log('[Facilitator] Settle failure', context.error));

// Register the Midnight scheme for Preview (example: facilitator.register(network, scheme)).
facilitator.register(MIDNIGHT_PREVIEW, new MidnightExactFacilitator(getConfig().indexer, CLAIMS));

const app = express();
app.use(express.json());

// Shared request checks from the example's /verify and /settle routes.
function readRequest(req: express.Request, res: express.Response) {
  const { paymentPayload, paymentRequirements } = req.body as {
    paymentPayload: PaymentPayload;
    paymentRequirements: PaymentRequirements;
  };
  if (!paymentPayload || !paymentRequirements) {
    res.status(400).json({ error: 'Missing paymentPayload or paymentRequirements' });
    return undefined;
  }
  const payloadField: unknown = paymentPayload.payload;
  if (typeof payloadField !== 'object' || payloadField === null || Array.isArray(payloadField)) {
    res.status(400).json({ error: 'paymentPayload.payload must be an object' });
    return undefined;
  }
  const supportedKind = facilitator
    .getSupported()
    .kinds.some(
      (kind) =>
        kind.x402Version === paymentPayload.x402Version &&
        kind.scheme === paymentRequirements.scheme &&
        kind.network === paymentRequirements.network,
    );
  return { paymentPayload, paymentRequirements, supportedKind };
}

app.post('/verify', async (req, res) => {
  try {
    const r = readRequest(req, res);
    if (!r) return;
    if (!r.supportedKind) return res.json({ isValid: false, invalidReason: 'unsupported_scheme' });
    const response: VerifyResponse = await facilitator.verify(r.paymentPayload, r.paymentRequirements);
    res.json(response);
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/settle', async (req, res) => {
  try {
    const r = readRequest(req, res);
    if (!r) return;
    if (!r.supportedKind) {
      return res.json({ success: false, errorReason: 'unsupported_scheme', transaction: '', network: r.paymentRequirements.network || 'unknown' });
    }
    const response: SettleResponse = await facilitator.settle(r.paymentPayload, r.paymentRequirements);
    res.json(response);
  } catch (error) {
    console.error('Settle error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/supported', async (_req, res) => {
  try {
    res.json(facilitator.getSupported());
  } catch (error) {
    console.error('Supported error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.listen(parseInt(PORT), () => {
  console.log(`[Facilitator] Listening on http://localhost:${PORT} (network ${MIDNIGHT_PREVIEW})`);
});
