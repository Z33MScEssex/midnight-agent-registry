// Agent A: an A2A server that other agents can find through the registry and call.
// Pattern: a2a-js src/samples/agents/sample-agent/index.ts (Topic 7). Changes: npm import paths,
// our card's name, description, skill and port; the card URL comes from AGENT_A_URL.
import express from 'express'; // web server
import { A2A_PROTOCOL_VERSION, AgentCard, AGENT_CARD_PATH } from '@a2a-js/sdk'; // card type, protocol version, card path
import { InMemoryTaskStore, TaskStore, AgentExecutor, DefaultRequestHandler } from '@a2a-js/sdk/server'; // server pieces
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express'; // Express adapters
import { SampleAgentExecutor } from './agent_executor.js'; // what the agent does when called

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
  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler })); // serves the Agent Card
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
