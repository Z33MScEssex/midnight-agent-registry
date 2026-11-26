// Step 1 of Option 1: create (or reuse) the code's own wallet and show its public address.
// Prints the unshielded address only, which is what the faucet pays. The seed is never printed.
import { Buffer } from 'buffer'; // hex decoding (Topic 9 block 3)
import { WalletSeeds, createKeystore } from '@midnightntwrk/wallet-sdk'; // Topic 9 blocks 3, 6, 7
import { networkId, ENV_FILE } from './config.js'; // Preview settings and seed file path
import { loadOrCreateSeed } from './seed.js'; // reads or safely creates the seed

const { seed, created } = loadOrCreateSeed(); // the master seed, kept in .env.preview
const seeds = WalletSeeds.fromMasterSeed(Buffer.from(seed, 'hex')); // Topic 9 step 1: three sub-wallet seeds
const unshieldedKeystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, networkId); // Topic 9 step 2

console.log(created ? `New wallet created. Seed saved to ${ENV_FILE} (owner-only).` : 'Using the existing wallet.'); // which case ran
console.log(`Send tNIGHT to: ${unshieldedKeystore.getBech32Address()}`); // Topic 9 "Registering..." step 1 line
