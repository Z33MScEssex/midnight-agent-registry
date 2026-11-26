// This file is part of example-leaderboard.
// Copyright (C) Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Modified 2026-11-26 for agent_registry: leaderboard calls swapped for register, updateRecord, lookup.

// Shared logic for the registry contract. Platform-agnostic; must not import any `node:*` module.
import { type ContractAddress, ContractState } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime'; // address type, state decoder
import { type ContractStateRead } from '@midnight-ntwrk/midnight-js-types'; // what the indexer returns
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts'; // deploy and join
import { type Logger } from 'pino'; // optional logging
import { map, type Observable } from 'rxjs'; // live state stream
import { CompiledRegistryContract, createRegistryPrivateState, ledger, type Ledger } from '../contract/index.js'; // our contract
import {
  type AgentEntry,
  type DeployedRegistryContract,
  type RegistryDerivedState,
  type RegistryProviders,
  registryPrivateStateKey,
} from './common-types.js';

/** The fields an agent publishes (everything but the ID and owner). */
export interface AgentFields {
  name: string;
  description: string;
  capabilities: string;
  version: string;
  endpoint: string;
  price: bigint;
}

// Bytes to hex without node:crypto or Buffer, so the file stays browser-safe (OURS; template used utils.toHex).
const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Topic 8 "Decode the public state": decodeLedger, unchanged. */
export const decodeLedger = (read: ContractStateRead): Ledger => {
  if (read.contractState.era !== 'v9') throw new Error('expected a Ledger 9 contract state');
  return ledger(read.contractState.deserialize({ v9: ContractState }).data);
};

// One map entry to a plain record (OURS, field copy).
const toEntry = (key: bigint, r: Ledger['agents'] extends { lookup(k: bigint): infer V } ? V : never): AgentEntry => ({
  id: Number(key),
  name: r.name,
  description: r.description,
  capabilities: r.capabilities,
  version: r.version,
  endpoint: r.endpoint,
  price: r.price,
  ownerHash: toHex(r.ownerHash),
});

/** Topic 8 deriveState pattern: iterate the map to list every agent, sorted by ID. */
export const deriveState = (ledgerState: Ledger): RegistryDerivedState => {
  const agents: AgentEntry[] = [];
  for (const [key, record] of ledgerState.agents) agents.push(toEntry(key, record)); // walk the map
  agents.sort((a, b) => a.id - b.id); // map order is not insertion order
  return { agentCount: Number(ledgerState.nextId), agents };
};

/** Topic 8 single-key read: member then lookup, without walking the map. Undefined if no such agent. */
export const lookupAgent = (ledgerState: Ledger, id: bigint): AgentEntry | undefined =>
  ledgerState.agents.member(id) ? toEntry(id, ledgerState.agents.lookup(id)) : undefined;

/** API for a deployed registry. Create with RegistryAPI.deploy() or RegistryAPI.join(). */
export class RegistryAPI {
  private constructor(
    public readonly deployedContract: DeployedRegistryContract,
    private readonly providers: RegistryProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress; // where it lives
    this.state$ = providers.publicDataProvider // live view of the registry, as in the template
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(map(({ value }) => deriveState(decodeLedger(value))));
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<RegistryDerivedState>;

  /** Reads the current public ledger once from the indexer (template test's queryLedger). */
  async readLedger(): Promise<Ledger> {
    const read = await this.providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    if (!read) throw new Error('registry state not found on the indexer');
    return decodeLedger(read);
  }

  /** Registers an agent and returns its new ID (the circuit's return value). */
  async register(f: AgentFields): Promise<bigint> {
    this.logger?.info({ name: f.name, endpoint: f.endpoint }, 'Registering agent');
    const tx = await this.deployedContract.callTx.register(f.name, f.description, f.capabilities, f.version, f.endpoint, f.price);
    return tx.private.result; // the Uint<64> the circuit returned
  }

  /** Replaces an agent's record. Fails with "not the owner" unless this key registered it. */
  async updateRecord(id: bigint, f: AgentFields): Promise<void> {
    this.logger?.info({ id, endpoint: f.endpoint }, 'Updating agent');
    await this.deployedContract.callTx.updateRecord(id, f.name, f.description, f.capabilities, f.version, f.endpoint, f.price);
  }

  /** Proves this key owns a record, revealing nothing about the key. */
  async verifyOwnership(id: bigint): Promise<void> {
    this.logger?.info({ id }, 'Proving ownership');
    await this.deployedContract.callTx.verifyOwnership(id);
  }

  /** Deploys a new registry contract. */
  static async deploy(providers: RegistryProviders, secretKey: Uint8Array, logger?: Logger): Promise<RegistryAPI> {
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledRegistryContract,
      privateStateId: registryPrivateStateKey,
      initialPrivateState: createRegistryPrivateState(secretKey),
    });
    logger?.info({ address: deployedContract.deployTxData.public.contractAddress }, 'Deployed registry');
    return new RegistryAPI(deployedContract, providers, logger);
  }

  /** Joins an existing registry contract. */
  static async join(
    providers: RegistryProviders,
    contractAddress: ContractAddress,
    secretKey: Uint8Array,
    logger?: Logger,
  ): Promise<RegistryAPI> {
    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: CompiledRegistryContract,
      privateStateId: registryPrivateStateKey,
      initialPrivateState: createRegistryPrivateState(secretKey),
    });
    logger?.info({ address: contractAddress }, 'Joined registry');
    return new RegistryAPI(deployedContract, providers, logger);
  }
}

export * from './common-types.js';
