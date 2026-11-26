// Reads or creates the wallet's master seed in .env.preview.
// Original applied work (Topic 9 "Deviation planned"): the source prints a new seed to the console.
// Here the seed goes straight into an owner-only file and is never printed.
import fs from 'node:fs'; // read and write the .env file
import { Buffer } from 'buffer'; // hex encoding, as in Topic 9 block 3
import { generateRandomSeed } from '@midnightntwrk/wallet-sdk'; // random master seed (Topic 9 block 3 import)
import { ENV_FILE } from './config.js'; // path of the seed file

const KEY = 'WALLET_SEED'; // variable name used by Topic 9 step 1

// Returns the saved seed as hex, or undefined if there is none yet.
export function readSeed(): string | undefined {
  if (!fs.existsSync(ENV_FILE)) return undefined; // no file means no wallet yet
  const line = fs.readFileSync(ENV_FILE, 'utf8') // read the whole file
    .split('\n') // one setting per line
    .find((l) => l.startsWith(`${KEY}=`)); // the seed line
  return line?.slice(KEY.length + 1).trim() || undefined; // value after "WALLET_SEED="
}

// Returns the saved seed, creating and saving one on the first run only.
// Topic 9's warning: a fresh seed every run strands the funds in the old wallet, so never overwrite.
export function loadOrCreateSeed(): { seed: string; created: boolean } {
  const existing = readSeed(); // reuse the saved wallet if there is one
  if (existing) return { seed: existing, created: false }; // same wallet as last time
  const seed = Buffer.from(generateRandomSeed()).toString('hex'); // Topic 9 step 1: new seed as hex
  fs.writeFileSync(ENV_FILE, `${KEY}=${seed}\n`, { mode: 0o600, flag: 'wx' }); // owner-only; 'wx' refuses to overwrite
  return { seed, created: true }; // caller prints only the public address
}
