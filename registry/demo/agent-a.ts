// Agent A: an A2A server that other agents can find through the registry and call.
// Pattern: a2a-js src/samples/agents/sample-agent/index.ts (Topic 7). Changes: npm import paths,
// our card's name, description, skill and port; the card URL comes from AGENT_A_URL.
import express from 'express'; // web server
import { A2A_PROTOCOL_VERSION, AgentCard, AGENT_CARD_PATH } from '@a2a-js/sdk'; // card type, protocol version, card path
import { InMemoryTaskStore, TaskStore, AgentExecutor, DefaultRequestHandler } from '@a2a-js/sdk/server'; // server pieces
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express'; // Express adapters
import { SampleAgentExecutor } from './agent_executor.js'; // what the agent does when called
import { paymentMiddleware, x402ResourceServer } from '@x402/express'; // x402 seller middleware (Topic 6)
import { HTTPFacilitatorClient } from '@x402/core/server'; // talks to our facilitator (Topics 6 and 11)
import { MIDNIGHT_PREVIEW, NIGHT_ASSET, MidnightExactServer } from './midnight-x402.js'; // our Midnight scheme
import { agentAAddress } from './agent-a-wallet.js'; // Agent A's receiving address
import { getConfig } from '../src/config.js'; // Preview network id

const BASE_URL = process.env.AGENT_A_URL || 'http://localhost:41241/'; // where Agent A listens (OURS: from env)
const PORT = Number(new URL(BASE_URL).port || 41241); // port taken from that URL

// The Agent Card: what Agent B downloads from the endpoint stored in the registry.
export const agentACard: AgentCard = {
  name: 'Echo agent', // must match the name in the registry record (Agent B checks this)
  description: 'Replies to a short text message. Demo agent for the Midnight agent registry.',
  supportedInterfaces: [
    {
      url: BASE_URL, // where JSON-RPC calls go
      protocolBinding: 'JSONRPC', // transport, as in the sample
      tenant: '',
      protocolVersion: A2A_PROTOCOL_VERSION, // A2A spec version the SDK speaks
    },
  ],
  provider: {
    organization: 'agent_registry demo',
    url: 'https://github.com/a2aproject/a2a-js',
  },
  version: '1.0.0', // same version as the registry record
  capabilities: {
    streaming: true, // the sample executor streams status and result events
    pushNotifications: false,
    extensions: [],
    extendedAgentCard: false,
  },
  securitySchemes: {},
  securityRequirements: [],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'task-status'],
  skills: [
    {
      id: 'echo',
      name: 'Echo',
      description: 'Answers greetings and echoes anything else back.',
      tags: ['demo'],
      examples: ['hello', 'how are you', 'goodbye'],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
      securityRequirements: [],
    },
  ],
  documentationUrl: '',
  signatures: [],
};

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore(); // 1. where tasks are kept
  const agentExecutor: AgentExecutor = new SampleAgentExecutor(); // 2. the agent's logic
  const requestHandler = new DefaultRequestHandler(agentACard, taskStore, agentExecutor); // 3. A2A request handling

  const app = express(); // 4. the web app
  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler })); // serves the Agent Card, free

  // 4b. x402 paywall on the A2A endpoint (Topic 6 seller pattern; Topic 10 runtime registration).
  // Price in STAR, the same number as the registry record, so Agent B can check it (OURS).
  const price = process.env.AGENT_A_PRICE ?? '100000'; // 0.1 tNIGHT
  const payTo = agentAAddress(getConfig().networkId); // where Agent B's tNIGHT goes
  const facilitatorClient = new HTTPFacilitatorClient({
    url: process.env.FACILITATOR_URL || 'http://localhost:4022', // our facilitator (demo/facilitator.ts)
    timeoutMs: 180_000, // Topic 11: settle waits for a Midnight block, so allow longer than usual
  });
  app.use(
    paymentMiddleware(
      {
        'POST /': { // every A2A JSON-RPC call
          accepts: [
            {
              scheme: 'exact',
              price: { amount: price, asset: NIGHT_ASSET }, // TokenAmount: works on any chain (Topic 10)
              network: MIDNIGHT_PREVIEW,
              payTo,
              maxTimeoutSeconds: 600, // the payment must land within 10 minutes of the 402
              extra: { paymentFlow: 'upfront' }, // spec 6.1: settle before the handler runs
            },
          ],
          description: 'One call to the Echo agent',
          mimeType: 'application/json',
        },
      },
      new x402ResourceServer(facilitatorClient).register(MIDNIGHT_PREVIEW, new MidnightExactServer()),
    ),
  );
  console.log(`[AgentA] Paywall: ${price} STAR per call, paid to ${payTo}`);
  app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication })); // serves A2A calls

  app.listen(PORT, (err) => { // 5. start listening
    if (err) {
      throw err;
    }
    console.log(`[AgentA] Listening on ${BASE_URL}`);
    console.log(`[AgentA] Agent Card: ${new URL(AGENT_CARD_PATH, BASE_URL)}`);
  });
}

main().catch(console.error);
