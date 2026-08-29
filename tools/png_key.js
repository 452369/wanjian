// PNG 工具：解码(8bit RGB/RGBA非隔行) + 洋红底抠图 + 编码
// 用法：
//   node tools/png_key.js <输入.png> <输出.png> key     # 抠洋红底
//   node tools/png_key.js <输入.png> <输出.png> copy    # 原样转存（顺便报告透明度信息）
const zlib = require('zlib');
const fs = require('fs');

// ---------- 解码 ----------
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是PNG');
  let pos = 8, w = 0, h = 0, depth = 8, colorType = 6, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error('仅支持8bit深度，实际' + depth);
  if (interlace !== 0) throw new Error('不支持隔行PNG');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('不支持的颜色类型' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      switch (filter) {
        case 0: break;
        case 1: line[i] = (line[i] + a) & 0xff; break;
        case 2: line[i] = (line[i] + b) & 0xff; break;
        case 3: line[i] = (line[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
      }
    }
    for (let x = 0; x < w; x++) {
      const si = x * channels, di = (y * w + x) * 4;
      if (colorType === 6) { out[di] = line[si]; out[di + 1] = line[si + 1]; out[di + 2] = line[si + 2]; out[di + 3] = line[si + 3]; }
      else if (colorType === 2) { out[di] = line[si]; out[di + 1] = line[si + 1]; out[di + 2] = line[si + 2]; out[di + 3] = 255; }
      else if (colorType === 0) { out[di] = out[di + 1] = out[di + 2] = line[si]; out[di + 3] = 255; }
      else if (colorType === 4) { out[di] = out[di + 1] = out[di + 2] = line[si]; out[di + 3] = line[si + 1]; }
      else throw new Error('暂不支持调色板PNG，请另存为RGB后重试');
    }
    prev = line;
  }
  return { w, h, rgba: out };
}

// ---------- 编码 ----------
function crc32(buf) {
  if (!crc32.table) {
    crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encode(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 洋红抠图 ----------
// AI 生成的洋红底常偏暗（如 RGB 185,20,90，洋红度仅~72），可用可选参数放宽阈值：
//   node tools/png_key.js in.png out.png key [清除阈值=90] [柔边阈值=30]
function keyMagenta(img, clearTh = 90, softTh = 30) {
  const { w, h, rgba } = img;
  let cleared = 0, soft = 0;
  for (let i = 0; i < w * h; i++) {
    const di = i * 4;
    let r = rgba[di], g = rgba[di + 1], b = rgba[di + 2];
    const m = Math.min(r, b) - g; // 洋红度：纯#FF00FF = 255，白/青/金 ≤ 0
    if (m > clearTh) { rgba[di + 3] = 0; cleared++; }
    else if (m > softTh) { // 边缘半透明 + 去洋红镶边
      const t = (m - softTh) / (clearTh - softTh);
      rgba[di + 3] = Math.round(rgba[di + 3] * (1 - t));
      r = Math.max(g, r - (m - softTh));
      b = Math.max(g, b - (m - softTh));
      rgba[di] = r; rgba[di + 2] = b;
      soft++;
    }
  }
  return { cleared, soft };
}

// ---------- 绿幕抠图 ----------
// 绿幕背景生成（角色含黑色/白色时用绿幕最稳）
function keyGreen(img, clearTh = 60, softTh = 25) {
  const { w, h, rgba } = img;
  let cleared = 0, soft = 0;
  for (let i = 0; i < w * h; i++) {
    const di = i * 4;
    let r = rgba[di], g = rgba[di + 1], b = rgba[di + 2];
    const m = g - Math.max(r, b); // 绿度：纯绿=255，白/黑/红/紫 ≤ 0
    if (m > clearTh) { rgba[di + 3] = 0; cleared++; }
    else if (m > softTh) {
      const t = (m - softTh) / (clearTh - softTh);
      rgba[di + 3] = Math.round(rgba[di + 3] * (1 - t));
      g = Math.max(Math.max(r, b), g - (m - softTh)); // 去绿镶边
      rgba[di + 1] = g;
      soft++;
    }
  }
  return { cleared, soft };
}

// ---------- 主流程 ----------
function main() {
  const [,, src, dst, mode, clearTh, softTh] = process.argv;
  if (!src || !dst) { console.log('用法: node tools/png_key.js <输入.png> <输出.png> key|keyg|copy [清除阈值] [柔边阈值]'); process.exit(1); }
  const img = decode(fs.readFileSync(src));
  let transparent = 0;
  for (let i = 0; i < img.w * img.h; i++) if (img.rgba[i * 4 + 3] < 128) transparent++;
  console.log(`尺寸 ${img.w}x${img.h}，原透明像素 ${(100 * transparent / (img.w * img.h)).toFixed(1)}%`);
  if (mode === 'key') {
    const { cleared, soft } = keyMagenta(img, clearTh ? +clearTh : 90, softTh ? +softTh : 30);
    console.log(`抠图完成：清除 ${cleared} 像素，柔边 ${soft} 像素`);
  } else if (mode === 'keyg') {
    const { cleared, soft } = keyGreen(img, clearTh ? +clearTh : 60, softTh ? +softTh : 25);
    console.log(`绿幕抠图完成：清除 ${cleared} 像素，柔边 ${soft} 像素`);
  }
  fs.writeFileSync(dst, encode(img.w, img.h, img.rgba));
  console.log('已写出', dst);
}
if (require.main === module) main();
module.exports = { decode, encode };
