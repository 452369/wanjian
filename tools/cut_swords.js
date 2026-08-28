// 六剑合一图 → 切割为 6 张单独飞剑贴图（黑场扣除 + 裁边 + 校直）
// 用法: node tools/cut_swords.js <输入.png> <输出前缀>   → 输出 前缀0.png ~ 前缀5.png
// 处理管线：擦角部UI水印 → 按列亮度分割6段 → 逐段包围盒裁剪 → PCA校直 → 黑场扣除（供 additive 绘制）
const fs = require('fs');
const { decode, encode } = require('./png_key.js');

const [,, src, outPrefix] = process.argv;
if (!src || !outPrefix) { console.log('用法: node tools/cut_swords.js <输入.png> <输出前缀>'); process.exit(1); }

const img = decode(fs.readFileSync(src));
const { w, h } = img;
const px = (x, y) => (y * w + x) * 4;
const lum = (i) => Math.max(img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]);

// 1) 擦掉截图工具的角部UI（左下"编辑"、右下上传图标）
function wipe(x0, y0, x1, y1) {
  for (let y = y0; y < Math.min(y1, h); y++)
    for (let x = x0; x < Math.min(x1, w); x++) {
      const i = px(x, y);
      img.rgba[i] = img.rgba[i + 1] = img.rgba[i + 2] = 0;
    }
}
wipe(0, h - 70, Math.floor(w * 0.15), h);
wipe(Math.floor(w * 0.92), h - 60, w, h);

// 2) 估计背景黑场（边缘环采样）
let bp = [0, 0, 0];
{
  const samples = [[], [], []];
  for (let x = 0; x < w; x += 3) for (const y of [1, 2, h - 3, h - 4]) samples[(x + y) % 3].push(px(x, y));
  for (let y = 0; y < h; y += 3) for (const x of [1, 2, w - 3, w - 4]) samples[(x + 2 * y) % 3].push(px(x, y));
  for (let c = 0; c < 3; c++) {
    samples[c].sort((a, b) => img.rgba[a + c] - img.rgba[b + c]);
    // 50分位+余量并封顶40：贴紧真实黑底，避免把边缘辉光算进背景压暗剑身
    bp[c] = Math.min(40, img.rgba[samples[c][Math.floor(samples[c].length * 0.5)]] + 4);
  }
}
console.log('黑场:', bp.join(','));

// 3) 按列分割 6 段：统计每列"高亮像素数"（>90），忽略微光和零星水晶碎粒
const maxBp = Math.max(bp[0], bp[1], bp[2]);
const colBright = new Array(w).fill(0);
for (let x = 0; x < w; x++) {
  let n = 0;
  for (let y = 0; y < h; y++) if (lum(px(x, y)) - maxBp > 90) n++;
  colBright[x] = n;
}
const ON = 3;
let segs = [];
let start = -1;
for (let x = 0; x < w; x++) {
  const on = colBright[x] >= ON;
  if (on && start < 0) start = x;
  if ((!on || x === w - 1) && start >= 0) { segs.push([start, on ? x : x - 1]); start = -1; }
}
// 相邻段间隔小于 8px 视为同一把剑，合并
segs = segs.filter(s => s[1] - s[0] > 20);
for (let i = segs.length - 1; i > 0; i--) {
  if (segs[i][0] - segs[i - 1][1] < 8) { segs[i - 1][1] = segs[i][1]; segs.splice(i, 1); }
}
console.log('分割段:', JSON.stringify(segs));
if (segs.length !== 6) { // 兜底：等分6段
  console.log('自动分割不是6段，改用等宽切分');
  segs = Array.from({ length: 6 }, (_, i) => [Math.floor(w * i / 6), Math.floor(w * (i + 1) / 6) - 1]);
}

// 4) 逐段处理：包围盒 → PCA校直 → 黑场扣除
function processSeg([x0, x1]) {
  let minY = h, maxY = 0;
  for (let x = x0; x <= x1; x++) for (let y = 0; y < h; y++) {
    if (lum(px(x, y)) - maxBp > 70) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxY <= minY) return null;
  const sw = x1 - x0 + 1, sh = maxY - minY + 1;
  const buf = Buffer.alloc(sw * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const si = px(x0 + x, minY + y), di = (y * sw + x) * 4;
    buf[di] = img.rgba[si]; buf[di + 1] = img.rgba[si + 1]; buf[di + 2] = img.rgba[si + 2]; buf[di + 3] = 255;
  }
  let piece = { w: sw, h: sh, rgba: buf };

  // PCA 求亮核主轴倾角（亮像素 = 剑体）
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = (y * sw + x) * 4;
    if (Math.max(piece.rgba[i], piece.rgba[i + 1], piece.rgba[i + 2]) > 110) { sx += x; sy += y; n++; }
  }
  if (n > 50) {
    sx /= n; sy /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      if (Math.max(piece.rgba[i], piece.rgba[i + 1], piece.rgba[i + 2]) > 110) {
        const dx = x - sx, dy = (sh - y) - (sh - sy); // y 翻转成数学坐标
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
      }
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy); // 主轴与x轴夹角
    let tilt = Math.PI / 2 - Math.abs(angle);          // 与竖直的偏差
    tilt = angle < 0 ? tilt : -tilt;                    // 保持倾斜方向
    if (Math.abs(tilt) > 0.05) {                        // >3° 才旋转
      piece = rotate(piece, tilt);
      console.log(`  段[${x0},${x1}] 倾角 ${(tilt * 180 / Math.PI).toFixed(1)}° 已校直`);
    }
  }

  // 黑场扣除 + 亮度键控：L<120 全透明，120→200 渐变，>200 不透明
  // 彻底消除切片里的彩色辉光底板，输出带真 alpha 的透明贴图
  for (let i = 0; i < piece.w * piece.h; i++) {
    const di = i * 4;
    let L = 0;
    for (let c = 0; c < 3; c++) {
      let v = piece.rgba[di + c] - bp[c];
      v = v > 0 ? Math.min(255, Math.round(v * 1.05)) : 0;
      piece.rgba[di + c] = v;
      if (v > L) L = v;
    }
    piece.rgba[di + 3] = Math.max(0, Math.min(255, Math.round((L - 120) * (255 / 80))));
  }
  return piece;
}

function rotate(img, rad) { // 最近邻旋转，绕中心
  const { w: iw, h: ih, rgba } = img;
  const cos = Math.cos(-rad), sin = Math.sin(-rad);
  const nw = Math.ceil(Math.abs(iw * cos) + Math.abs(ih * sin));
  const nh = Math.ceil(Math.abs(iw * sin) + Math.abs(ih * cos));
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const dx = x - nw / 2, dy = y - nh / 2;
    const sxr = cos * dx - sin * dy + iw / 2;
    const syr = sin * dx + cos * dy + ih / 2;
    const sx = Math.round(sxr), sy = Math.round(syr);
    if (sx >= 0 && sx < iw && sy >= 0 && sy < ih) {
      const si = (sy * iw + sx) * 4, di = (y * nw + x) * 4;
      out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = 255;
    }
  }
  return { w: nw, h: nh, rgba: out };
}

segs.forEach(([x0, x1], idx) => {
  const piece = processSeg([x0, x1]);
  if (!piece) { console.log(`段${idx} 为空，跳过`); return; }
  const out = `${outPrefix}${idx}.png`;
  fs.writeFileSync(out, encode(piece.w, piece.h, piece.rgba));
  console.log(`已写出 ${out} (${piece.w}x${piece.h})`);
});
