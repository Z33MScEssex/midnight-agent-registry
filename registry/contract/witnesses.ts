// This file is part of example-leaderboard.
// Modified 2026-11-26 for agent_registry: names changed, the custom-name witness removed.
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

// This file also runs in the browser (the UI imports it), so it must not import
// any `node:*` module.
import { type Ledger } from './managed/registry/contract/index.js'; // generated ledger type
import { type WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime'; // what a witness receives

// The private state each agent operator keeps locally. Only its hash reaches the chain.
export type RegistryPrivateState = {
  readonly secretKey: Uint8Array; // 32-byte key that proves ownership of a record
};

// Builds the private state from a secret key (template: createLeaderboardPrivateState).
export const createRegistryPrivateState = (secretKey: Uint8Array): RegistryPrivateState => ({
  secretKey, // stored as given
});

// The one witness the contract declares. Returns [unchanged private state, the key] as the template does.
export const witnesses = {
  localSecretKey: ({
    privateState, // the caller's private state
  }: WitnessContext<Ledger, RegistryPrivateState>): [RegistryPrivateState, Uint8Array] => [
    privateState, // private state is not changed
    privateState.secretKey, // key handed to the circuit as a private proof input
  ],
};
