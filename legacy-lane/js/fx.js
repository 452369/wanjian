'use strict';
// ===== 特效：粒子 / 伤害数字 / 飘字 / 全屏闪光 / 晋升横幅（全部对象池化）=====
const FX = {
  parts: new EntityList(new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: '', kind: 0, target: null }))),
  nums: new EntityList(new Pool(() => ({ x: 0, y: 0, vy: 0, life: 0, max: 0, val: '', size: 0, color: '' }))),
  flashA: 0, flashColor: '#ffffff',
  banner: null, bannerT: 0,

  // 命中火花
  spark(x, y, color, n = 6, spd = 180) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(spd * 0.3, spd);
      this.parts.spawn(p => {
        p.kind = 0; p.x = x; p.y = y;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.life = p.max = rand(0.15, 0.4); p.size = rand(2, 4); p.color = color;
      });
    }
  },
  // 击杀灵魂粒子：飞向玩家（收集感）
  soul(x, y, target, n = 4) {
    for (let i = 0; i < n; i++) {
      this.parts.spawn(p => {
        p.kind = 1; p.x = x + rand(-10, 10); p.y = y + rand(-10, 10);
        p.vx = rand(-60, 60); p.vy = rand(-80, -20);
        p.life = p.max = rand(0.5, 0.9); p.size = rand(2, 3.5);
        p.color = '#7dd8ff'; p.target = target;
      });
    }
  },
  // 环形爆发（护盾碎/晋升）
  ring(x, y, color, n = 16, spd = 260) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.parts.spawn(p => {
        p.kind = 0; p.x = x; p.y = y;
        p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd;
        p.life = p.max = 0.35; p.size = 3; p.color = color;
      });
    }
  },
  // 伤害数字
  num(x, y, val, crit) {
    if (!CFG.feel.dmgNum) return;
    this.nums.spawn(n => {
      n.x = x + rand(-8, 8); n.y = y; n.vy = -90;
      n.life = n.max = crit ? 0.8 : 0.55;
      n.val = String(val); n.size = crit ? 26 : 15;
      n.color = crit ? '#ff5a5a' : '#ffffff';
    });
  },
  // 普通飘字（拾取/晋升提示）
  text(x, y, str, color = '#7dd8ff', size = 18) {
    this.nums.spawn(n => {
      n.x = x; n.y = y; n.vy = -50;
      n.life = n.max = 0.9;
      n.val = str; n.size = size; n.color = color;
    });
  },
  flash(a = 0.35, color = '#ffffff') { this.flashA = Math.max(this.flashA, a); this.flashColor = color; },
  showBanner(title, sub) { this.banner = { title, sub }; this.bannerT = 1.8; },

  update(dt) {
    for (const p of this.parts.list) {
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      if (p.kind === 1 && p.target) { // 灵魂追踪玩家
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 1400 * dt; p.vy += (dy / d) * 1400 * dt;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 900) { p.vx *= 900 / sp; p.vy *= 900 / sp; }
        if (d < 24) p.life = Math.min(p.life, 0.08);
      } else { // 普通粒子：阻尼 + 微重力
        p.vx *= (1 - 3 * dt); p.vy = p.vy * (1 - 3 * dt) + 60 * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts.sweep();

    for (const n of this.nums.list) {
      n.life -= dt;
      if (n.life <= 0) { n.dead = true; continue; }
      n.y += n.vy * dt; n.vy *= (1 - 2 * dt);
    }
    this.nums.sweep();
  },

  // UI 层计时（真实时间推进，暂停/顿帧时横幅照常走）
  updateUI(dt) {
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 1.8);
    if (this.bannerT > 0) this.bannerT -= dt;
  },

  draw(ctx) {
    for (const p of this.parts.list) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 1) ctx.drawImage(glowSprite(p.color), p.x - 6, p.y - 6, 12, 12);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const n of this.nums.list) {
      const a = clamp(n.life / n.max, 0, 1);
      const pop = n.max - n.life < 0.08 ? 1.35 : 1; // 出生瞬间放大
      ctx.globalAlpha = a;
      ctx.fillStyle = n.color;
      ctx.font = `bold ${Math.round(n.size * pop)}px ${Fonts.ui}`;
      ctx.fillText(n.val, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  },

  // 全屏闪光 + 晋升横幅（画在 UI 层，不参与震屏）
  // 升级面板占据上半屏，此时横幅移到底部避免遮挡
  drawScreenFx(ctx, W, H, state) {
    const by = state === 'levelup' ? 886 : 250;
    const sy = state === 'levelup' ? 922 : 292;
    if (this.flashA > 0) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.bannerT > 0 && this.banner) {
      const t = this.bannerT;
      const a = t > 1.5 ? (1.8 - t) / 0.3 : t < 0.4 ? t / 0.4 : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9b8';
      ctx.font = `bold ${state === 'levelup' ? 30 : 42}px ${Fonts.title}`;
      ctx.shadowColor = '#c9a45a'; ctx.shadowBlur = 18;
      ctx.fillText(this.banner.title, W / 2, by);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8fa3d8';
      ctx.font = `17px ${Fonts.ui}`;
      ctx.fillText(this.banner.sub, W / 2, sy);
      ctx.globalAlpha = 1;
    }
  },

  clear() { this.parts.clear(); this.nums.clear(); this.flashA = 0; this.bannerT = 0; this.banner = null; },
};
