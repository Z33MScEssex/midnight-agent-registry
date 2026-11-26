// Agent A's receiving address on Preview. Only the address is needed to be paid, so no sync, no DUST.
// Pattern: wallet/src/create-wallet.ts + wallet/src/seed.ts (Topic 9): seed made once, owner-only file, never printed.
import fs from 'node:fs'; // seed file
import path from 'node:path'; // file path
import { fileURLToPath } from 'node:url'; // %20-safe paths
import { Buffer } from 'buffer'; // hex encoding
import { WalletSeeds, createKeystore, generateRandomSeed } from '@midnightntwrk/wallet-sdk'; // Topic 9

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.resolve(here, '..', '.agent-a-wallet.seed'); // gitignored, mode 600

// Returns Agent A's unshielded address (mn_addr_preview...), creating the seed on first use.
export function agentAAddress(networkId: string): string {
  if (!fs.existsSync(SEED_FILE)) {
    const seed = Buffer.from(generateRandomSeed()).toString('hex'); // Topic 9 step 1
    fs.writeFileSync(SEED_FILE, seed + '\n', { mode: 0o600, flag: 'wx' }); // never overwrite: funds would be stranded
  }
  const seed = fs.readFileSync(SEED_FILE, 'utf8').trim();
  const seeds = WalletSeeds.fromMasterSeed(Buffer.from(seed, 'hex')); // three sub-wallet seeds
  const keystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, networkId); // Topic 9 step 2
  return String(keystore.getBech32Address()); // public address only
}
