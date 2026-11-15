// Draws the $ZZZ "Night Shift" logo: a sleeping crescent moon (you) and a wide-awake robot at a glowing laptop
// (your agent) with a stack of USDC-gold coins. No dependencies. Usage: node tools/draw-nightshift.mjs assets/nightshift.png
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
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const circle = (c, cx, cy, r) => paint(c, [cx - r, cy - r, cx + r, cy + r], (x, y) => inCircle(x, y, cx, cy, r));
const ellipse = (c, cx, cy, rx, ry) => paint(c, [cx - rx, cy - ry, cx + rx, cy + ry], (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const line = (c, ax, ay, bx, by, w) => paint(c, [Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w],
  (x, y) => distSeg(x, y, ax, ay, bx, by) <= w / 2);
function polyline(c, pts, w) { for (let i = 0; i + 1 < pts.length; i++) { line(c, ...pts[i], ...pts[i + 1], w); circle(c, ...pts[i + 1], w / 2); } }
function roundRect(c, x, y, w, h, r) {
  paint(c, [x, y, x + w, y + h], (px, py) => {
    const qx = Math.max(x + r - px, px - (x + w - r), 0), qy = Math.max(y + r - py, py - (y + h - r), 0);
    return qx * qx + qy * qy <= r * r;
  });
}
const arc = (cx, cy, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
function zee(c, x, y, s, w) { polyline(c, [[x, y], [x + s, y], [x, y + s], [x + s, y + s]], w); }

// palette
const SKY = hex('#0B1238'), STAR = hex('#E8ECFF'), MOON = hex('#FFD84D'), MOON_DARK = hex('#7A5200');
const INK = hex('#05081C'), CYAN = hex('#3DF5E6'), ROBOT = hex('#C9D2F2'), ROBOT_SHADE = hex('#8E99C4');
const GOLD = hex('#FFC107'), GOLD_LIGHT = hex('#FFE680'), PINK = hex('#FF8FB1');

paint(SKY, [0, 0, SIZE, SIZE], () => true);
for (const [x, y, r] of [[40, 40, 3], [120, 28, 2], [470, 120, 3], [430, 230, 2], [60, 470, 2], [250, 30, 2], [495, 300, 2], [20, 300, 2], [180, 480, 2]]) circle(STAR, x, y, r);

// the sleeping crescent moon: a disc with a disc cut out of its upper right
const MX = 200, MY = 236, MR = 176, CX = 292, CY = 168, CR = 158;
paint(MOON, [MX - MR, MY - MR, MX + MR, MY + MR], (x, y) => inCircle(x, y, MX, MY, MR) && !inCircle(x, y, CX, CY, CR));
// closed eye, rosy cheek and a sleepy smile on the fat part of the crescent
polyline(MOON_DARK, arc(118, 214, 30, Math.PI * 0.15, Math.PI * 0.85), 10);
circle(PINK, 96, 268, 16);
polyline(MOON_DARK, arc(150, 300, 26, Math.PI * 0.2, Math.PI * 0.75), 8);
// Zzz drifting up from the moon
zee(STAR, 300, 54, 44, 11); zee(STAR, 362, 22, 30, 8); zee(STAR, 410, 6, 20, 6);

// the robot on the night shift, awake at its laptop
const RX = 352, RY = 300;
line(INK, RX + 50, RY - 4, RX + 50, RY - 34, 10); circle(hex('#FF3D8B'), RX + 50, RY - 40, 11); // antenna
roundRect(INK, RX - 6, RY - 6, 124, 96, 26);
roundRect(ROBOT, RX, RY, 112, 84, 22);
roundRect(INK, RX + 12, RY + 14, 88, 52, 14); // visor
roundRect(CYAN, RX + 24, RY + 24, 22, 28, 6); roundRect(CYAN, RX + 66, RY + 24, 22, 28, 6);
circle(hex('#FFFFFF'), RX + 32, RY + 31, 4); circle(hex('#FFFFFF'), RX + 74, RY + 31, 4);
roundRect(INK, RX + 4, RY + 86, 104, 70, 20); roundRect(ROBOT_SHADE, RX + 10, RY + 90, 92, 62, 16); // body
// laptop: back of the lid facing us, screen glow spilling on the robot
paint(hex('#2A3570'), [RX - 30, RY + 100, RX + 142, RY + 190], (x, y) => y > RY + 112 && y < RY + 176 && x > RX - 26 + (y - (RY + 112)) * 0.08 && x < RX + 138 - (y - (RY + 112)) * 0.08);
line(CYAN, RX - 24, RY + 112, RX + 136, RY + 112, 6);
roundRect(INK, RX - 46, RY + 176, 204, 14, 6);
circle(CYAN, RX + 56, RY + 144, 10); // glowing badge on the lid

// stack of gold coins earned overnight
for (const [i, y] of [458, 440, 422, 404].entries()) {
  ellipse(INK, 80, y, 54, 22); ellipse(GOLD, 80, y - 2, 48, 17); ellipse(GOLD_LIGHT, 80, y - 5, 30, 9);
  if (i === 3) ellipse(GOLD, 80, y - 5, 22, 6);
}

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
const out = process.argv[2] ?? 'assets/nightshift.png';
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
