// 擦除 PNG 指定矩形区域（如 AI 水印）
// 用法: node tools/clear_rect.js <文件.png> <x> <y> <宽> <高>
const fs = require('fs');
const { decode, encode } = require('./png_key.js');

const [,, src, x, y, w, h] = process.argv.map((v, i) => (i >= 2 ? v : v));
const img = decode(fs.readFileSync(src));
const rx = +x, ry = +y, rw = +w, rh = +h;
for (let yy = ry; yy < Math.min(ry + rh, img.h); yy++) {
  for (let xx = rx; xx < Math.min(rx + rw, img.w); xx++) {
    img.rgba[(yy * img.w + xx) * 4 + 3] = 0;
  }
}
fs.writeFileSync(src, encode(img.w, img.h, img.rgba));
console.log(`已擦除 (${rx},${ry}) ${rw}x${rh}`);
