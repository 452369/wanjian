'use strict';
// ===== 通用工具 =====
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = arr => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const hitCircle = (ax, ay, ar, bx, by, br) => dist2(ax, ay, bx, by) <= (ar + br) * (ar + br);
const fmtTime = t => { const m = (t / 60) | 0, s = (t % 60) | 0; return m + ':' + String(s).padStart(2, '0'); };

function hexRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`;
}

// 预渲染光晕贴图：shadowBlur 太贵，发光一律用缓存贴图
const _glowCache = {};
function glowSprite(color) {
  if (_glowCache[color]) return _glowCache[color];
  const r = 32, c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d');
  const rgb = hexRgb(color);
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},0.85)`);
  gr.addColorStop(0.45, `rgba(${rgb},0.28)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, r * 2, r * 2);
  return (_glowCache[color] = c);
}

// 圆角矩形路径
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 本地存档（微信端换成 wx.setStorageSync 即可）
const Meta = {
  data: { gold: 0, bestKills: 0, bestCombo: 0, runs: 0 },
  load() { try { Object.assign(this.data, JSON.parse(localStorage.getItem('wjgz_meta') || '{}')); } catch (e) { } },
  save() { try { localStorage.setItem('wjgz_meta', JSON.stringify(this.data)); } catch (e) { } },
};
Meta.load();
