// Launches a coin on pump.fun with no initial buy. Standard library only (Node 22+).
// Usage: node tools/launch.mjs <keypair.json> --coin coins/<name>.json [--budget-lamports N] [--send]
// Without --send it only simulates and prints the cost. The coin file names the coin, its description lines,
// its logo and the public metadata file this repository serves for it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const RPC = 'https://api.mainnet-beta.solana.com';
const BUDGET_LAMPORTS = Number(arg('--budget-lamports', '10000000')); // default cap 0.01 SOL
const SEND = process.argv.includes('--send');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const b58enc = (buf) => {
  let n = BigInt('0x' + Buffer.from(buf).toString('hex')), s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of buf) { if (b === 0) s = '1' + s; else break; }
  return s;
};
const pkcs8 = (seed) => createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });

const kp = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const wallet = { seed: Buffer.from(kp.slice(0, 32)), pub: Buffer.from(kp.slice(32)) };
const mj = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
const mint = { seed: Buffer.from(mj.d, 'base64url'), pub: Buffer.from(mj.x, 'base64url') };

const coin = JSON.parse(readFileSync(arg('--coin'), 'utf8'));
const NAME = coin.name, SYMBOL = coin.symbol, LINK = coin.website;
const DESCRIPTION = coin.description.join('\n');
if (!DESCRIPTION.includes('make.fun/bounty/makefun-coin-promo-01') || !LINK.startsWith('https://make.fun/')) throw new Error('description or website misses the bounty link');

const rpc = async (method, params) => {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(method + ': ' + JSON.stringify(j.error));
  return j.result;
};

const before = (await rpc('getBalance', [b58enc(wallet.pub)])).value;
console.log('wallet', b58enc(wallet.pub), 'balance lamports', before);

// 1. metadata: a public JSON file in this repository (pump.fun's own uploader sits behind a bot challenge)
const RAW = 'https://raw.githubusercontent.com/itsjusttu/coin-promo/main/';
const metadata = { name: NAME, symbol: SYMBOL, description: DESCRIPTION, image: RAW + coin.logo, showName: true, createdOn: 'https://pump.fun', website: LINK };
writeFileSync(coin.metadata, JSON.stringify(metadata, null, 2) + '\n');
const meta = { metadataUri: RAW + coin.metadata };
const served = await fetch(meta.metadataUri);
if (!served.ok || JSON.stringify(await served.json()) !== JSON.stringify(metadata)) throw new Error('push ' + coin.metadata + ' and ' + coin.logo + ' to the main branch first');
console.log('metadata uri', meta.metadataUri);

// 2. unsigned create transaction, amount 0 = no initial buy
const tr = await fetch('https://pumpportal.fun/api/trade-local', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ publicKey: b58enc(wallet.pub), action: 'create', tokenMetadata: { name: NAME, symbol: SYMBOL, uri: meta.metadataUri },
    mint: b58enc(mint.pub), denominatedInSol: 'true', amount: 0, slippage: 10, priorityFee: 0, pool: 'pump' }),
});
if (!tr.ok) throw new Error('trade-local ' + tr.status + ' ' + (await tr.text()).slice(0, 300));
const tx = Buffer.from(await tr.arrayBuffer());

// 3. sign: layout is [compact-u16 n][n * 64-byte signatures][message]
if (tx[0] >= 0x80) throw new Error('unexpected signature count encoding');
const n = tx[0];
const msgStart = 1 + 64 * n;
const msg = tx.subarray(msgStart);
let o = msg[0] >= 0x80 ? 1 : 0; // versioned message prefix
const required = msg[o]; o += 3;
const keyCount = msg[o]; o += 1;
if (keyCount >= 0x80 || required !== n) throw new Error('unexpected message layout');
const keys = []; for (let i = 0; i < keyCount; i++) keys.push(msg.subarray(o + 32 * i, o + 32 * i + 32));
for (let i = 0; i < n; i++) {
  const k = [wallet, mint].find((x) => x.pub.equals(keys[i]));
  if (!k) throw new Error('unknown signer ' + b58enc(keys[i]));
  sign(null, msg, pkcs8(k.seed)).copy(tx, 1 + 64 * i);
}
const b64 = tx.toString('base64');

// 4. simulate and bound the cost
const sim = await rpc('simulateTransaction', [b64, { encoding: 'base64', sigVerify: true, commitment: 'confirmed', accounts: { encoding: 'base64', addresses: [b58enc(wallet.pub)] } }]);
const after = sim.value.accounts?.[0]?.lamports;
console.log('simulation err', JSON.stringify(sim.value.err), 'units', sim.value.unitsConsumed, 'lamports after', after);
if (sim.value.err || after === undefined) { console.log((sim.value.logs ?? []).slice(-8).join('\n')); throw new Error('simulation failed'); }
const cost = before - after;
console.log('estimated total cost lamports', cost, '(~' + (cost / 1e9).toFixed(5) + ' SOL)');
if (cost > BUDGET_LAMPORTS) throw new Error('over budget, stopping');
if (!SEND) { console.log('dry run only'); process.exit(0); }

// 5. send and confirm
const signature = b58enc(tx.subarray(1, 65)); // the fee payer's signature is the transaction id
await rpc('sendTransaction', [b64, { encoding: 'base64', skipPreflight: false, maxRetries: 5 }]);
for (let i = 0; i < 60; i++) {
  const st = (await rpc('getSignatureStatuses', [[signature], { searchTransactionHistory: true }])).value[0];
  if (st?.err) throw new Error('transaction failed ' + JSON.stringify(st.err));
  if (st && st.confirmationStatus === 'finalized') break;
  await new Promise((r) => setTimeout(r, 2000));
}
const launch = { mint: b58enc(mint.pub), create_signature: signature };
writeFileSync('LAUNCH.json', JSON.stringify(launch, null, 2) + '\n');
console.log('LAUNCHED', JSON.stringify(launch));
