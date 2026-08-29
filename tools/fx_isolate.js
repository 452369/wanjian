// 特效帧主形状提取：从抽帧JSON中剥离细线光斑，只保留主特效形状，统一居中拼横排雪碧图
// 用法: node tools/fx_isolate.js <frames.json> <输出.png> [帧数上限] [亮度阈值]
const fs = require('fs');
const path = require('path');
const { decode, encode } = require(path.join(__dirname, 'png_key.js'));

const [,, src, dst, maxFramesArg, lumThArg] = process.argv;
const maxFrames = +(maxFramesArg || 8);
const LUM = +(lumThArg || 40);
const S = 256;
const frames = JSON.parse(fs.readFileSync(src, 'utf8')).slice(0, maxFrames);

const clamp01 = v => Math.max(0, Math.min(1, v));
const erode = (m, w, h) => {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    out[i] = (m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w]) ? 1 : 0;
  }
  return out;
};
const dilate = (m, w, h) => {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    out[i] = (m[i] || m[i - 1] || m[i + 1] || m[i - w] || m[i + w]) ? 1 : 0;
  }
  return out;
};
function components(m, w, h) {
  const seen = new Uint8Array(w * h);
  const comps = [];
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (!m[start] || seen[start]) continue;
    const px = [];
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(); px.push(i);
      const x = i % w, y = (i / w) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x2 = x + ox, y2 = y + oy;
        if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h) continue;
        const j = y2 * w + x2;
        if (m[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    comps.push({ size: px.length, px });
  }
  return comps;
}
function soften(m, w, h) {
  let cur = Float32Array.from(m);
  for (let pass = 0; pass < 2; pass++) {
    const t = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      t[i] = (cur[i] + cur[i - 1] + cur[i + 1] + cur[i - w] + cur[i + w]
            + cur[i - w - 1] + cur[i - w + 1] + cur[i + w - 1] + cur[i + w + 1]) / 9;
    }
    cur = t;
  }
  return cur;
}

// ===== 第一步：逐帧隔离主形状（开运算去细线光斑 → 连通域 → 膨胀回填 → 亮度alpha）=====
const isolated = [];
for (const f of frames) {
  const img = decode(Buffer.from(f.d.split(',')[1], 'base64'));
  const mask = new Uint8Array(S * S);
  for (let p = 0; p < S * S; p++) {
    const L = Math.max(img.rgba[p * 4], img.rgba[p * 4 + 1], img.rgba[p * 4 + 2]);
    mask[p] = L > LUM ? 1 : 0;
  }
  let m = erode(mask, S, S); m = erode(m, S, S); m = erode(m, S, S);
  const comps = components(m, S, S).filter(c => c.size > 30);
  let keep = new Uint8Array(S * S);
  for (const c of comps) for (const idx of c.px) keep[idx] = 1;
  for (let it = 0; it < 4; it++) keep = dilate(keep, S, S);
  const soft = soften(keep, S, S);
  const fc = Buffer.alloc(S * S * 4);
  for (let p = 0; p < S * S; p++) {
    const di = p * 4;
    const L = Math.max(img.rgba[di], img.rgba[di + 1], img.rgba[di + 2]);
    const keyed = Math.max(0, Math.min(255, Math.round((L - 28) * (255 / 62))));
    fc[di] = img.rgba[di]; fc[di + 1] = img.rgba[di + 1]; fc[di + 2] = img.rgba[di + 2];
    fc[di + 3] = Math.round(keyed * clamp01(soft[p]));
  }
  isolated.push(fc);
}

// ===== 第二步：全帧内容包围盒（union），统一居中裁到正方形单帧 =====
let ux0 = S, uy0 = S, ux1 = 0, uy1 = 0, any = false;
for (const fc of isolated) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (fc[(y * S + x) * 4 + 3] > 20) {
      any = true;
      if (x < ux0) ux0 = x; if (x > ux1) ux1 = x;
      if (y < uy0) uy0 = y; if (y > uy1) uy1 = y;
    }
  }
}
if (!any) { console.log('警告：未检测到内容'); process.exit(1); }
const PAD = 16;
const bw = ux1 - ux0 + 1 + PAD * 2, bh = uy1 - uy0 + 1 + PAD * 2;
const FS = Math.min(S, Math.max(bw, bh)); // 单帧边长（正方形）
const fcx = (ux0 + ux1 + 1) / 2, fcy = (uy0 + uy1 + 1) / 2;
console.log(`内容包围盒 (${ux0},${uy0})-(${ux1},${uy1})，单帧边长 ${FS}`);

// ===== 第三步：拼横排雪碧图（居中）=====
const strip = Buffer.alloc(S * frames.length * S * 4);
frames.forEach((f, i) => {
  const fc = isolated[i];
  const dx = Math.round(i * S + S / 2 - fcx), dy = Math.round(S / 2 - fcy);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sx = x - dx, sy = y - dy; // 单帧内坐标
    if (sx < 0 || sy < 0 || sx >= S || sy >= S) continue;
    const si = (sy * S + sx) * 4, di = (y * S + i * S + x) * 4;
    if (di + 3 >= strip.length) continue;
    strip[di] = fc[si]; strip[di + 1] = fc[si + 1]; strip[di + 2] = fc[si + 2]; strip[di + 3] = fc[si + 3];
  }
});
fs.writeFileSync(dst, encode(S * frames.length, S, strip));
console.log(`隔离完成 → ${dst}（${frames.length} 帧，单帧 ${S}）`);
