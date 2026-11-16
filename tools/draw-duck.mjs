// Draws the $QUACK "Duck Race" logo: a cool rubber duck with sunglasses, a gold medal and a checkered flag.
// No dependencies. Usage: node tools/draw-duck.mjs assets/duck.png
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
const full = (c) => paint(c, [0, 0, SIZE, SIZE], () => true);
const circle = (c, cx, cy, r) => paint(c, [cx - r, cy - r, cx + r, cy + r], (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
const ellipse = (c, cx, cy, rx, ry) => paint(c, [cx - rx, cy - ry, cx + rx, cy + ry], (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
const rect = (c, x, y, w, h) => paint(c, [x, y, x + w, y + h], () => true);
function roundRect(c, x, y, w, h, r) {
  paint(c, [x, y, x + w, y + h], (px, py) => {
    const qx = Math.max(x + r - px, px - (x + w - r), 0), qy = Math.max(y + r - py, py - (y + h - r), 0);
    return qx * qx + qy * qy <= r * r;
  });
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const line = (c, ax, ay, bx, by, w) => paint(c, [Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w],
  (x, y) => distSeg(x, y, ax, ay, bx, by) <= w / 2);
function inPoly(p, px, py) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > py) !== (p[j][1] > py) && px < ((p[j][0] - p[i][0]) * (py - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) ins = !ins;
  }
  return ins;
}
const polygon = (c, p) => paint(c, [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))], (x, y) => inPoly(p, x, y));

const BLUE = hex('#2B6CFF'), SUN = hex('#5E9BFF'), INK = hex('#0A1030');
const YEL = hex('#FFD21F'), YEL_DARK = hex('#F2A900'), ORANGE = hex('#FF8A1F'), WHITE = hex('#FFFFFF');
const WATER = hex('#9AD7FF'), WATER_DARK = hex('#4FB0FF'), GOLD = hex('#FFC107'), GOLD_LIGHT = hex('#FFE680'), RED = hex('#FF3D5A');

full(BLUE);
circle(SUN, 256, 250, 236);

// checkered flag on a pole, top right
line(INK, 446, 30, 446, 190, 8);
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) rect((r + c) % 2 ? INK : WHITE, 446 + c * 14, 30 + r * 14, 14, 14);
for (const [dx, dy] of [[0, 0], [56, 0], [0, 42], [56, 42]]) circle(INK, 446 + dx, 30 + dy, 1);

// outlines first so the duck reads as one silhouette
const tail = [[96, 300], [56, 236], [150, 268]];
ellipse(INK, 240, 330, 162, 117);
circle(INK, 330, 200, 97);
polygon(INK, tail.map(([x, y]) => [x + (x < 100 ? -8 : 0), y - 6]));
ellipse(INK, 430, 228, 64, 32);

// fills
polygon(YEL, tail);
ellipse(YEL, 240, 330, 150, 105);
circle(YEL, 330, 200, 85);
ellipse(ORANGE, 430, 228, 54, 22);
line(INK, 392, 232, 470, 232, 4); // beak line
ellipse(YEL_DARK, 215, 335, 78, 50); // wing
ellipse(INK, 215, 335, 78, 50 + 0); // placeholder outline, redrawn below
ellipse(YEL_DARK, 215, 335, 72, 44);
ellipse(WHITE, 292, 150, 14, 8); // head highlight

// sunglasses
roundRect(INK, 296, 168, 54, 42, 14); roundRect(INK, 354, 168, 54, 42, 14);
line(INK, 346, 182, 358, 182, 8);
line(INK, 292, 178, 270, 170, 8);
ellipse(hex('#3DF5E6'), 312, 182, 9, 5); ellipse(hex('#3DF5E6'), 370, 182, 9, 5);

// gold medal on a red ribbon
line(RED, 292, 258, 306, 296, 12); line(RED, 340, 252, 318, 296, 12);
circle(INK, 312, 316, 34); circle(GOLD, 312, 316, 28); circle(GOLD_LIGHT, 312, 316, 19);
line(INK, 308, 308, 314, 304, 5); line(INK, 314, 304, 314, 328, 5); line(INK, 307, 328, 322, 328, 5);

// water covering the lower body
const wave = (y0, amp) => { const p = [[0, 512]]; for (let x = 0; x <= 512; x += 8) p.push([x, y0 + amp * Math.sin(x / 34)]); p.push([512, 512]); return p; };
polygon(INK, wave(368, 9).map(([x, y], i, a) => (i === 0 || i === a.length - 1 ? [x, y] : [x, y - 6])));
polygon(WATER, wave(370, 9));
polygon(WATER_DARK, wave(420, 8));
for (const [x, y] of [[90, 395], [180, 392], [420, 398], [470, 440], [60, 460], [250, 470]]) line(WHITE, x, y, x + 34, y, 5);

// confetti
[[50, 60, '#FF3D8B'], [120, 30, '#8BE04E'], [190, 80, '#FFE14D'], [420, 300, '#FF3D8B'], [30, 180, '#FFE14D'], [480, 340, '#8BE04E']]
  .forEach(([x, y, c]) => polygon(hex(c), [[x, y], [x + 22, y + 6], [x + 18, y + 16], [x - 4, y + 10]]));

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
const out = process.argv[2] ?? 'assets/duck.png';
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
