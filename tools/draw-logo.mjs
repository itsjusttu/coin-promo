// Draws the $WHACK logo (a robot-faced star pinata spilling gold coins) with no dependencies:
// a tiny supersampling rasteriser plus a hand-rolled PNG encoder. Usage: node tools/draw-logo.mjs assets/logo.png
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const SIZE = 512; // output edge in pixels
const SS = 3; // supersampling factor per axis
const W = SIZE * SS;
const buf = new Uint8ClampedArray(W * W * 3);

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function fillAll(c) {
  for (let i = 0; i < W * W; i++) { buf[i * 3] = c[0]; buf[i * 3 + 1] = c[1]; buf[i * 3 + 2] = c[2]; }
}

// Paints every sample for which test(x, y) (in 512-space) is true.
function paint(c, bbox, test) {
  const x0 = Math.max(0, Math.floor(bbox[0] * SS)), x1 = Math.min(W - 1, Math.ceil(bbox[2] * SS));
  const y0 = Math.max(0, Math.floor(bbox[1] * SS)), y1 = Math.min(W - 1, Math.ceil(bbox[3] * SS));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (test((x + 0.5) / SS, (y + 0.5) / SS)) {
        const i = (y * W + x) * 3;
        buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
      }
    }
  }
}

function inPoly(poly, px, py) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bboxOf(poly, pad = 0) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

const polygon = (c, poly) => paint(c, bboxOf(poly), (x, y) => inPoly(poly, x, y));
const circle = (c, cx, cy, r) => paint(c, [cx - r, cy - r, cx + r, cy + r], (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
const ring = (c, cx, cy, r0, r1) => paint(c, [cx - r1, cy - r1, cx + r1, cy + r1], (x, y) => {
  const d = (x - cx) ** 2 + (y - cy) ** 2;
  return d <= r1 * r1 && d >= r0 * r0;
});

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const line = (c, ax, ay, bx, by, w) => paint(c, [Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w],
  (x, y) => distSeg(x, y, ax, ay, bx, by) <= w / 2);

function rotRect(cx, cy, w, h, ang) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]);
}

function roundRect(c, x, y, w, h, r) {
  paint(c, [x, y, x + w, y + h], (px, py) => {
    const qx = Math.max(x + r - px, px - (x + w - r), 0), qy = Math.max(y + r - py, py - (y + h - r), 0);
    return qx * qx + qy * qy <= r * r;
  });
}

// ---- the picture ----
const NAVY = hex('#150F33'), INK = hex('#0A0720'), CREAM = hex('#F4EBD0');
const ARMS = ['#FF3D8B', '#FF9F1C', '#FFE14D', '#2EE6D6', '#8BE04E'].map(hex);
const LIGHT = ['#FF8DBB', '#FFC56B', '#FFF1A0', '#8CF3EA', '#C0F08F'].map(hex);

fillAll(NAVY);

// soft burst of confetti behind the star
const confetti = [[60, 70, 0.4], [450, 90, 1.1], [470, 250, 0.2], [40, 290, 1.3], [90, 400, 0.7], [440, 420, 1.0], [180, 40, 0.9], [350, 35, 0.3], [30, 180, 0.1], [485, 160, 0.8]];
confetti.forEach(([x, y, a], i) => polygon(ARMS[i % 5], rotRect(x, y, 26, 9, a)));

// string and hook
line(CREAM, 256, 0, 256, 78, 7);

const CX = 256, CY = 272, R = 188, r = 96;
const verts = [];
for (let i = 0; i < 10; i++) {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const rad = i % 2 === 0 ? R : r;
  verts.push([CX + rad * Math.cos(a), CY + rad * Math.sin(a)]);
}

// thick dark outline (drawn first, slightly grown), then the paper arms
for (let i = 0; i < 10; i++) {
  const [ax, ay] = verts[i], [bx, by] = verts[(i + 1) % 10];
  line(INK, ax, ay, bx, by, 26);
  circle(INK, ax, ay, 13);
}
polygon(INK, verts);

for (let k = 0; k < 5; k++) {
  const tip = verts[2 * k], left = verts[(2 * k + 9) % 10], right = verts[2 * k + 1];
  const arm = [[CX, CY], left, tip, right];
  polygon(ARMS[k], arm);
  // crepe-paper fringe: lighter bands across the arm
  for (const t of [0.42, 0.62, 0.8]) {
    const lerp = (p, q, s) => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
    const a = lerp(left, tip, t), b = lerp(right, tip, t);
    const c = lerp(left, tip, t + 0.07), d = lerp(right, tip, t + 0.07);
    polygon(LIGHT[k], [a, b, d, c]);
  }
}
// redraw outline edges on top so the fringe stays inside
for (let i = 0; i < 10; i++) {
  const [ax, ay] = verts[i], [bx, by] = verts[(i + 1) % 10];
  line(INK, ax, ay, bx, by, 9);
  circle(INK, ax, ay, 4.5);
}

// the robot face
roundRect(INK, CX - 78, CY - 52, 156, 112, 28);
roundRect(hex('#1D1650'), CX - 70, CY - 44, 140, 96, 22);
roundRect(hex('#41F5E3'), CX - 48, CY - 22, 28, 34, 6); // eyes
roundRect(hex('#41F5E3'), CX + 20, CY - 22, 28, 34, 6);
circle(hex('#FFFFFF'), CX - 38, CY - 14, 5);
circle(hex('#FFFFFF'), CX + 30, CY - 14, 5);
for (let i = 0; i < 5; i++) { // grin
  const x = CX - 44 + i * 18;
  const y = CY + 22 + (i === 0 || i === 4 ? -6 : 0);
  roundRect(hex('#41F5E3'), x, y, 12, 12, 3);
}
line(INK, CX, CY - 52, CX, CY - 72, 6); // antenna
circle(hex('#FF3D8B'), CX, CY - 76, 10);

// coins spilling out of the bottom
const gold = hex('#FFC107'), goldLight = hex('#FFE680');
const coins = [[128, 462, 32], [232, 482, 28], [330, 466, 34], [418, 440, 26], [74, 392, 22]];
for (const [x, y, rr] of coins) {
  circle(INK, x, y, rr + 6);
  circle(gold, x, y, rr);
  ring(goldLight, x, y, rr * 0.62, rr * 0.74);
  polygon(goldLight, rotRect(x, y, rr * 0.18, rr * 0.9, 0)); // a stylised bar through the coin
}

// ---- downsample and encode ----
const px = Buffer.alloc(SIZE * (SIZE * 3 + 1));
for (let y = 0; y < SIZE; y++) {
  px[y * (SIZE * 3 + 1)] = 0;
  for (let x = 0; x < SIZE; x++) {
    for (let ch = 0; ch < 3; ch++) {
      let sum = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) sum += buf[((y * SS + sy) * W + x * SS + sx) * 3 + ch];
      px[y * (SIZE * 3 + 1) + 1 + x * 3 + ch] = Math.round(sum / (SS * SS));
    }
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(process.argv[2] ?? 'assets/logo.png', png);
console.log(`wrote ${process.argv[2] ?? 'assets/logo.png'} (${png.length} bytes)`);
