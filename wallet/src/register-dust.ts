// Step 3 of Option 1: wait for the faucet's tNIGHT, register it for DUST, and wait for DUST to appear.
// Assembled from Topic 9: "Building a wallet from a seed" steps 1-2 and
// "Registering NIGHT for DUST generation with the wallet SDK" steps 1-3. Config swapped to Preview.
import { WebSocket } from 'ws'; // Topic 9 block 3: the SDK needs a WebSocket in Node
(globalThis as any).WebSocket = WebSocket; // make it global, as the source does

import { Buffer } from 'buffer'; // hex decoding
import * as Rx from 'rxjs'; // streams of wallet state
import {
  WalletSeeds, // derives the three sub-wallet seeds
  WalletFacade, // one object in front of the three sub-wallets
  ShieldedWallet, // shielded sub-wallet
  DustWallet, // DUST sub-wallet
  UnshieldedWallet, // unshielded sub-wallet (holds tNIGHT)
  createKeystore, // signing keys for the unshielded wallet
  PublicKey, // public key from the keystore
  InMemoryTransactionHistoryStorage, // transaction history kept in memory
  WalletEntrySchema, // history record format
  mergeWalletEntries, // history merge rule
  DustAddress, // DUST address encoding
  MidnightBech32m, // address parser, also validates the network
} from '@midnightntwrk/wallet-sdk';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/v9'; // the NIGHT token id
import { networkId, CONFIG } from './config.js'; // Preview endpoints
import { readSeed } from './seed.js'; // the saved seed (never created here)

const seed = readSeed(); // this script must reuse the wallet create-wallet.ts made
if (!seed) throw new Error('No wallet yet. Run "npm run create" first.'); // stop rather than make a new wallet

// Topic 9 "Registering..." step 1: unit formatters (1 NIGHT = 10^6 STAR, 1 DUST = 10^15 SPECK).
const formatNight = (raw: bigint) =>
  `${raw / 1_000_000n}.${(raw % 1_000_000n).toString().padStart(6, '0')}`;
const formatDust = (raw: bigint) =>
  `${raw / 1_000_000_000_000_000n}.${(raw % 1_000_000_000_000_000n).toString().padStart(15, '0')}`;

// Topic 9 "Building a wallet from a seed" step 1: derive the sub-wallet seeds.
const seeds = WalletSeeds.fromMasterSeed(Buffer.from(seed, 'hex'));

// Topic 9 "Building a wallet from a seed" step 2: build the three sub-wallets behind a facade.
const unshieldedKeystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, networkId);

const configuration = {
  networkId,
  indexerClientConnection: {
    indexerHttpUrl: CONFIG.indexerHttpUrl,
    indexerWsUrl: CONFIG.indexerWsUrl,
  },
  provingServerUrl: new URL(CONFIG.proofServer),
  relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
  txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
  costParameters: {
    // Optional amount added to every fee the wallet declares. A DUST spend does not return it. Defaults to 0n.
    additionalFeeOverhead: 300_000_000_000_000n, // 0.3 DUST
    // Blocks to allow for finalization when estimating the fee.
    feeBlocksMargin: 5,
  },
};

const wallet = await WalletFacade.init({
  configuration,
  shielded: (config) => ShieldedWallet(config).startWithSeed(seeds.shielded),
  unshielded: (config) => UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
  dust: (config) => DustWallet(config).startWithSeed(seeds.dust),
});
await wallet.start(seeds);

// Topic 9 "Registering..." step 1: wait for the faucet's tNIGHT.
console.log(`Send tNIGHT to: ${unshieldedKeystore.getBech32Address()}`);

const nightBalance = await Rx.firstValueFrom(
  wallet.state().pipe(
    Rx.throttleTime(10_000),
    Rx.map((state) => state.unshielded.balances[unshieldedToken().raw] ?? 0n),
    Rx.filter((balance) => balance > 0n),
  ),
);
console.log(`tNIGHT received: ${formatNight(nightBalance)}`);

// Topic 9 "Registering..." step 2: sync, then register unregistered NIGHT for DUST.
console.log('Waiting for full sync (can take a while on a new wallet)...'); // progress line, ours
const state = await wallet.waitForSyncedState();

const unregistered = state.unshielded.availableCoins.filter(
  (coin) => coin.meta?.registeredForDustGeneration !== true,
);

if (unregistered.length === 0) {
  console.log('All NIGHT is already registered for DUST generation.');
} else {
  // Send the DUST elsewhere by replacing this with another wallet's address.
  const target = String(DustAddress.encodePublicKey(networkId, state.dust.publicKey));
  const dustReceiver = MidnightBech32m.parse(target).decode(DustAddress, networkId);

  // Wait until the NIGHT has generated enough DUST to pay the registration's own fee.
  const { fee } = await wallet.estimateRegistration(unregistered);
  console.log('Waiting for enough DUST to pay the registration fee...'); // progress line, ours
  await wallet.waitForGeneratedDust(unregistered, fee);

  const recipe = await wallet.registerNightUtxosForDustGeneration(
    unregistered,
    unshieldedKeystore.getPublicKey(),
    async (payload) => unshieldedKeystore.signData(payload),
    dustReceiver,
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized);
  console.log('Registration submitted.'); // progress line, ours
}

// Topic 9 "Registering..." step 3: wait until the DUST balance is positive.
await Rx.firstValueFrom(
  wallet.state().pipe(
    Rx.throttleTime(5_000),
    Rx.filter((s) => s.isSynced),
    Rx.filter((s) => s.dust.balance(new Date()) > 0n),
  ),
);
const dustBalance = (await Rx.firstValueFrom(wallet.state())).dust.balance(new Date());
console.log(`DUST balance: ${formatDust(dustBalance)}`);
await wallet.stop();
