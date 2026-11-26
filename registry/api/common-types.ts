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

// Modified 2026-11-26 for agent_registry: leaderboard types swapped for registry types.

// Types shared by the registry API and its callers. Must not import any `node:*` module.
import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types'; // provider bundle type
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts'; // a deployed contract handle
import { type Contract, type ImpureCircuits, type RegistryPrivateState } from '../contract/index.js'; // generated types

export const registryPrivateStateKey = 'registryPrivateState'; // name of our slot in the private-state store
export type PrivateStateId = typeof registryPrivateStateKey; // that name as a type

/** The circuits that need proofs: register, updateRecord, verifyOwnership. */
export type RegistryCircuitKeys = keyof ImpureCircuits<RegistryPrivateState>;

export type RegistryProviders = MidnightProviders<RegistryCircuitKeys, PrivateStateId, RegistryPrivateState>; // everything a call needs

export type RegistryContract = Contract<RegistryPrivateState>; // the compiled contract class
export type DeployedRegistryContract = FoundContract<RegistryContract>; // a deployed or joined instance

/** One agent record as plain values, ready for Agent B to read (template: LeaderboardEntry). */
export interface AgentEntry {
  readonly id: number; // agent ID from the counter
  readonly name: string;
  readonly description: string;
  readonly capabilities: string;
  readonly version: string;
  readonly endpoint: string; // Agent Card URL
  readonly price: bigint; // kept as bigint so a large price is not rounded
  readonly ownerHash: string; // owner commitment as hex
}

/** Whole-registry view (template: LeaderboardDerivedState). */
export interface RegistryDerivedState {
  readonly agentCount: number; // how many IDs have been handed out
  readonly agents: AgentEntry[]; // every record, lowest ID first
}
