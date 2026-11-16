// Draws the $FEED logo: a pink egg-shaped virtual pet whose pixel screen shows a hungry robot and a coin.
// No dependencies. Usage: node tools/draw-pet.mjs assets/pet.png
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const SIZE = 512, SS = 3, W = SIZE * SS;
const buf = new Uint8ClampedArray(W * W * 3);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function paint(c, bb, test) {
  const x0 = Math.max(0, Math.floor(bb[0] * SS)), x1 = Math.min(W - 1, Math.ceil(bb[2] * SS));
  const y0 = Math.max(0, Math.floor(bb[1] * SS)), y1 = Math.min(W - 1, Math.ceil(bb[3] * SS));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!test((x + 0.5) / SS, (y + 0.5) / SS)) continue;
    const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
  }
}
const circle = (c, cx, cy, r) => paint(c, [cx - r, cy - r, cx + r, cy + r], (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
const ring = (c, cx, cy, r0, r1) => paint(c, [cx - r1, cy - r1, cx + r1, cy + r1], (x, y) => { const d = (x - cx) ** 2 + (y - cy) ** 2; return d <= r1 * r1 && d >= r0 * r0; });
// an egg: the upper half is taller than the lower half
const egg = (c, cx, cy, rx, ryTop, ryBot) => paint(c, [cx - rx, cy - ryTop, cx + rx, cy + ryBot], (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / (y < cy ? ryTop : ryBot)) ** 2 <= 1);
const rect = (c, x, y, w, h) => paint(c, [x, y, x + w, y + h], () => true);
function roundRect(c, x, y, w, h, r) {
  paint(c, [x, y, x + w, y + h], (px, py) => {
    const qx = Math.max(x + r - px, px - (x + w - r), 0), qy = Math.max(y + r - py, py - (y + h - r), 0);
    return qx * qx + qy * qy <= r * r;
  });
}

const YELLOW = hex('#FFD93D'), INK = hex('#1A0B2E'), PINK = hex('#FF4F9A'), PINK_LIGHT = hex('#FF9CC6');
const LCD = hex('#C6F28B'), LCD_DARK = hex('#1A2B0E'), BUTTON = hex('#3DD6F5'), GOLD = hex('#FFC107');

rect(YELLOW, 0, 0, SIZE, SIZE);
// sparkles
for (const [x, y, s] of [[60, 70, 14], [450, 80, 18], [470, 350, 12], [40, 350, 12], [90, 470, 10], [430, 470, 14]]) {
  rect(INK, x - s, y - 3, s * 2, 6); rect(INK, x - 3, y - s, 6, s * 2);
}
// keychain loop
ring(INK, 256, 40, 18, 32); ring(hex('#9AA3B5'), 256, 40, 23, 27);

// egg body with shine
egg(INK, 256, 280, 204, 236, 204);
egg(PINK, 256, 280, 192, 224, 192);
egg(PINK_LIGHT, 170, 120, 26, 42, 30);

// LCD screen
roundRect(INK, 120, 120, 272, 232, 40);
roundRect(LCD, 132, 132, 248, 208, 30);

// pixel robot (11 x 9 grid, 14 px cells), hungry mouth open
const P = 14, GX = 148, GY = 168;
const robot = [
  '....#.#....',
  '....###....',
  '.#########.',
  '##.......##',
  '##.##.##.##',
  '##.##.##.##',
  '##.......##',
  '##..###..##',
  '.#########.',
];
robot.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') rect(LCD_DARK, GX + c * P, GY + r * P, P, P); }));
// falling pixel coin, about to be eaten
circle(LCD_DARK, 340, 160, 22); circle(GOLD, 340, 160, 16);
rect(LCD_DARK, 337, 150, 6, 20);
// hunger hearts
for (const hx of [148, 184, 220]) {
  [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]].forEach(([c, r]) => rect(LCD_DARK, hx + c * 8, 300 + r * 8, 8, 8));
}

// three buttons
for (const bx of [170, 256, 342]) { circle(INK, bx, 420, 28); circle(BUTTON, bx, 420, 21); circle(hex('#BDF4FF'), bx - 7, 412, 6); }

// downsample and encode as PNG
const row = SIZE * 3 + 1, px = Buffer.alloc(SIZE * row);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) for (let ch = 0; ch < 3; ch++) {
  let s = 0;
  for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) s += buf[((y * SS + sy) * W + x * SS + sx) * 3 + ch];
  px[y * row + 1 + x * 3 + ch] = Math.round(s / (SS * SS));
}
const chunk = (t, d) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const body = Buffer.concat([Buffer.from(t, 'ascii'), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = process.argv[2] ?? 'assets/pet.png';
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
