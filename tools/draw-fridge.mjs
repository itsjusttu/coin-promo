// Draws the $FRIDGE logo: a child-style crayon drawing of a robot with a gold star sticker, pinned to a shiny
// fridge door by a red magnet. Gradients, shadows and crayon grain keep it from looking flat at thumbnail size.
// No dependencies. Usage: node tools/draw-fridge.mjs assets/fridge.png
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const SIZE = 512, SS = 3, W = SIZE * SS;
const buf = new Float32Array(W * W * 3);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const noise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

// color may be an array or a function (x, y) => array; alpha blends over what is there
function paint(color, bb, test, alpha = 1) {
  const x0 = Math.max(0, Math.floor(bb[0] * SS)), x1 = Math.min(W - 1, Math.ceil(bb[2] * SS));
  const y0 = Math.max(0, Math.floor(bb[1] * SS)), y1 = Math.min(W - 1, Math.ceil(bb[3] * SS));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = (x + 0.5) / SS, py = (y + 0.5) / SS;
    if (!test(px, py)) continue;
    const c = typeof color === 'function' ? color(px, py) : color;
    const i = (y * W + x) * 3;
    for (let k = 0; k < 3; k++) buf[i + k] = buf[i + k] * (1 - alpha) + c[k] * alpha;
  }
}
const ALL = [0, 0, SIZE, SIZE];
const circle = (c, cx, cy, r, a = 1) => paint(c, [cx - r, cy - r, cx + r, cy + r], (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, a);
function inPoly(p, px, py) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > py) !== (p[j][1] > py) && px < ((p[j][0] - p[i][0]) * (py - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) ins = !ins;
  }
  return ins;
}
const bbox = (p, pad = 0) => [Math.min(...p.map((q) => q[0])) - pad, Math.min(...p.map((q) => q[1])) - pad, Math.max(...p.map((q) => q[0])) + pad, Math.max(...p.map((q) => q[1])) + pad];
const polygon = (c, p, a = 1) => paint(c, bbox(p), (x, y) => inPoly(p, x, y), a);
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// paper space: a sheet rotated by ANG around its centre
const PCX = 236, PCY = 282, ANG = -0.08;
const T = ([x, y]) => [PCX + x * Math.cos(ANG) - y * Math.sin(ANG), PCY + x * Math.sin(ANG) + y * Math.cos(ANG)];

// a crayon stroke along a path in paper space: wobbly, grainy, thick
function crayon(col, pts, w) {
  const path = [];
  pts.forEach((p, i) => {
    if (i === 0) { path.push(p); return; }
    const [ax, ay] = pts[i - 1], [bx, by] = p;
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 6));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      path.push([ax + (bx - ax) * t + (noise(k, i) - 0.5) * 2.2, ay + (by - ay) * t + (noise(i, k) - 0.5) * 2.2]);
    }
  });
  const q = path.map(T);
  for (let i = 0; i + 1 < q.length; i++) {
    const [ax, ay] = q[i], [bx, by] = q[i + 1];
    paint((x, y) => mix(col, [255, 255, 255], noise(Math.floor(x * 3), Math.floor(y * 3)) > 0.82 ? 0.55 : 0),
      [Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w],
      (x, y) => distSeg(x, y, ax, ay, bx, by) <= w / 2);
  }
}
// crayon fill: hatched scribble inside a paper-space polygon
function scribble(col, poly, step = 7, w = 6) {
  const q = poly.map(T);
  paint((x, y) => mix(col, [255, 255, 255], noise(Math.floor(x * 2), Math.floor(y * 2)) > 0.7 ? 0.45 : 0.08), bbox(q),
    (x, y) => inPoly(q, x, y) && ((x + y) % step) < w);
}
const ellipsePts = (cx, cy, rx, ry, n = 40) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI), cy + ry * Math.sin((i / n) * 2 * Math.PI)]);

// ---- fridge door: vertical gradient with a soft sheen ----
const TOP = hex('#5FE3D0'), BOT = hex('#1E9E9A');
paint((x, y) => mix(TOP, BOT, y / SIZE), ALL, () => true);
paint([255, 255, 255], ALL, (x, y) => Math.abs(x - y * 0.35 - 40) < 26, 0.18); // diagonal sheen
// chrome handle on the right
paint((x) => mix(hex('#F4F7FA'), hex('#7D8A99'), Math.abs(x - 478) / 14), [462, 40, 494, 472], (x, y) => Math.abs(x - 478) < 14 && y > 50 && y < 462 || (x - 478) ** 2 + (y - 50) ** 2 < 196 || (x - 478) ** 2 + (y - 462) ** 2 < 196);

// ---- the paper: drop shadow, then the sheet ----
const sheet = [[-170, -190], [170, -190], [170, 190], [-170, 190]];
polygon([10, 40, 45], sheet.map(T).map(([x, y]) => [x + 12, y + 16]), 0.35);
polygon((x, y) => mix([255, 253, 246], [236, 232, 222], ((y - 90) / 380) * 0.6), sheet.map(T));

// ---- the crayon drawing ----
// sun in the corner
scribble(hex('#FFC400'), ellipsePts(-118, -128, 30, 30));
crayon(hex('#FF9F00'), ellipsePts(-118, -128, 30, 30), 6);
for (let i = 0; i < 8; i++) { const a = (i / 8) * 2 * Math.PI; crayon(hex('#FF9F00'), [[-118 + 40 * Math.cos(a), -128 + 40 * Math.sin(a)], [-118 + 54 * Math.cos(a), -128 + 54 * Math.sin(a)]], 6); }
// robot head and body
scribble(hex('#3D8BFF'), [[-70, -95], [70, -95], [70, 5], [-70, 5]]);
crayon(hex('#1449C8'), [[-70, -95], [70, -95], [70, 5], [-70, 5], [-70, -95]], 9);
crayon(hex('#1449C8'), [[0, -95], [0, -130]], 8); circle(hex('#FF2E4D'), ...T([0, -138]), 13);
scribble(hex('#9B5CFF'), [[-90, 15], [90, 15], [90, 140], [-90, 140]]);
crayon(hex('#5A23C8'), [[-90, 15], [90, 15], [90, 140], [-90, 140], [-90, 15]], 9);
// big happy eyes and smile
circle([20, 20, 30], ...T([-32, -58]), 14); circle([20, 20, 30], ...T([32, -58]), 14);
circle([255, 255, 255], ...T([-27, -63]), 5); circle([255, 255, 255], ...T([37, -63]), 5);
crayon([20, 20, 30], [[-36, -26], [-18, -14], [0, -11], [18, -14], [36, -26]], 7);
// heart on the chest
scribble(hex('#FF2E4D'), [[0, 100], [-34, 66], [-34, 48], [-17, 40], [0, 54], [17, 40], [34, 48], [34, 66]], 5, 5);
crayon(hex('#D90E35'), [[0, 100], [-34, 66], [-34, 48], [-17, 40], [0, 54], [17, 40], [34, 48], [34, 66], [0, 100]], 6);
// arms up in a cheer
crayon(hex('#1449C8'), [[-90, 40], [-128, 0], [-142, -40]], 9);
crayon(hex('#1449C8'), [[90, 40], [128, 0], [142, -40]], 9);
// legs
crayon(hex('#1449C8'), [[-45, 140], [-50, 175]], 9); crayon(hex('#1449C8'), [[45, 140], [50, 175]], 9);

// ---- gold star sticker, glossy, slightly overlapping the sheet ----
const star = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rad = i % 2 ? r : R; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; });
const [sx, sy] = T([128, -150]);
polygon([10, 40, 45], star(sx + 5, sy + 7, 62, 28), 0.3);
polygon((x, y) => mix(hex('#FFE680'), hex('#E8A200'), (y - sy + 60) / 120), star(sx, sy, 62, 28));
polygon([255, 255, 255], star(sx - 10, sy - 14, 18, 8), 0.7);
paint(hex('#B87800'), bbox(star(sx, sy, 64, 30)), (x, y) => inPoly(star(sx, sy, 62, 28), x, y) && !inPoly(star(sx, sy, 56, 25), x, y));

// ---- red magnet pinning the top of the sheet ----
const [mx, my] = T([0, -186]);
circle([10, 40, 45], mx + 6, my + 10, 36, 0.35);
paint((x, y) => mix(hex('#FF6B7A'), hex('#B80F2A'), Math.min(1, Math.hypot(x - mx + 12, y - my + 12) / 56)), [mx - 36, my - 36, mx + 36, my + 36], (x, y) => (x - mx) ** 2 + (y - my) ** 2 <= 34 * 34);
circle([255, 255, 255], mx - 12, my - 13, 9, 0.75);

// ---- downsample and encode as PNG ----
const row = SIZE * 3 + 1, px = Buffer.alloc(SIZE * row);
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) for (let ch = 0; ch < 3; ch++) {
  let s = 0;
  for (let sy2 = 0; sy2 < SS; sy2++) for (let sx2 = 0; sx2 < SS; sx2++) s += buf[((y * SS + sy2) * W + x * SS + sx2) * 3 + ch];
  px[y * row + 1 + x * 3 + ch] = Math.max(0, Math.min(255, Math.round(s / (SS * SS))));
}
const chunk = (t, d) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const body = Buffer.concat([Buffer.from(t, 'ascii'), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = process.argv[2] ?? 'assets/fridge.png';
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
