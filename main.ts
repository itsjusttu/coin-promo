// Entry for makefun-coin-promo-01 (Node 22, standard library only, no network):
// copies LAUNCH.json (the coin's mint and create signature) from the repository root to the output directory.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(join(BOT_DIR, 'LAUNCH.json'), join(OUTPUT_DIR, 'LAUNCH.json'));
} catch (err) {
  console.error(`could not copy LAUNCH.json from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}
