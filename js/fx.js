'use strict';
// ===== 特效系统 2.0：多层反馈（闪光→粒子→击退→顿帧→震屏→音效）=====
// 粒子类型：0 光点(阻尼+微重力) 1 灵魂(追踪玩家) 2 拖尾光条(沿速度拉长) 3 光斑(glowSprite) 4 闪烁星尘
const FX = {
  parts: new EntityList(new Pool(() => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: '',
    kind: 0, target: null, drag: 3, grav: 60,
  }))),
  nums: new EntityList(new Pool(() => ({ x: 0, y: 0, vy: 0, life: 0, max: 0, val: '', size: 0, color: '' }))),
  flashA: 0, flashColor: '#ffffff',
  banner: null, bannerT: 0,
  hurtVin: 0,          // 受击红晕强度
  _lastImpact: 0,      // 命中反馈节流
  CAP: 420,            // 粒子总量上限（性能红线）

  canSpawn() { return this.parts.list.length < this.CAP; },

  // 命中火花
  spark(x, y, color, n = 6, spd = 180) {
    for (let i = 0; i < n; i++) {
      if (!this.canSpawn()) return;
      const a = rand(0, TAU), s = rand(spd * 0.3, spd);
      this.parts.spawn(p => {
        p.kind = 0; p.x = x; p.y = y;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.life = p.max = rand(0.15, 0.4); p.size = rand(2, 4); p.color = color;
        p.drag = 3; p.grav = 60;
      });
    }
  },
  // 方向性拖尾光条喷溅（命中打击感核心，40ms 节流）
  hitImpact(x, y, color) {
    const now = performance.now();
    if (now - this._lastImpact < 40) return;
    this._lastImpact = now;
    if (!this.canSpawn()) return;
    for (let i = 0; i < 9; i++) {
      if (!this.canSpawn()) return;
      const a = rand(0, TAU), s = rand(260, 480);
      this.parts.spawn(p => {
        p.kind = 2; p.x = x; p.y = y;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.life = p.max = rand(0.12, 0.22); p.size = rand(1.5, 2.5); p.color = color;
        p.drag = 6; p.grav = 0;
      });
    }
    this.ring(x, y, color, 10, 180);
  },
  // 灵魂粒子：飞向玩家（收集感）
  soul(x, y, target, n = 4) {
    for (let i = 0; i < n; i++) {
      if (!this.canSpawn()) return;
      this.parts.spawn(p => {
        p.kind = 1; p.x = x + rand(-10, 10); p.y = y + rand(-10, 10);
        p.vx = rand(-60, 60); p.vy = rand(-80, -20);
        p.life = p.max = rand(0.5, 0.9); p.size = rand(2, 3.5);
        p.color = '#7dd8ff'; p.target = target; p.drag = 0; p.grav = 0;
      });
    }
  },
  // 冲击环
  ring(x, y, color, n = 16, spd = 260) {
    for (let i = 0; i < n; i++) {
      if (!this.canSpawn()) return;
      const a = (i / n) * TAU;
      this.parts.spawn(p => {
        p.kind = 0; p.x = x; p.y = y;
        p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd;
        p.life = p.max = 0.35; p.size = 3; p.color = color;
        p.drag = 5; p.grav = 0;
      });
    }
  },
  // 爆炸合成器：冲击环 + 拖尾光条 + 大光斑 + 微闪（一次调用全齐）
  explosion(x, y, color, size = 1) {
    this.ring(x, y, color, Math.round(14 * size), 300 * size);
    for (let i = 0; i < Math.round(10 * size); i++) {
      if (!this.canSpawn()) break;
      const a = rand(0, TAU), s = rand(160, 420) * size;
      this.parts.spawn(p => {
        p.kind = 2; p.x = x; p.y = y;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.life = p.max = rand(0.18, 0.35); p.size = rand(2, 3.5); p.color = color;
        p.drag = 5; p.grav = 0;
      });
    }
    for (let i = 0; i < Math.round(6 * size); i++) {
      if (!this.canSpawn()) break;
      const a = rand(0, TAU), d = rand(0, 26 * size);
      this.parts.spawn(p => {
        p.kind = 3; p.x = x + Math.cos(a) * d; p.y = y + Math.sin(a) * d;
        p.vx = Math.cos(a) * 60; p.vy = Math.sin(a) * 60;
        p.life = p.max = rand(0.25, 0.5); p.size = rand(14, 30) * size; p.color = color;
        p.drag = 2; p.grav = 0;
      });
    }
    FX.flash(0.1 * size, color);
  },
  // 闪烁星尘（升级/暴击点缀）
  sparkle(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      if (!this.canSpawn()) return;
      const a = rand(0, TAU), d = rand(10, 46);
      this.parts.spawn(p => {
        p.kind = 4; p.x = x + Math.cos(a) * d; p.y = y + Math.sin(a) * d;
        p.vx = rand(-30, 30); p.vy = rand(-50, -10);
        p.life = p.max = rand(0.3, 0.6); p.size = rand(2, 4.5); p.color = color;
        p.drag = 1; p.grav = -20;
      });
    }
  },
  // 伤害数字（红色，参考视频风格）
  num(x, y, val, crit) {
    if (!CFG.feel.dmgNum) return;
    this.nums.spawn(n => {
      n.x = x + rand(-8, 8); n.y = y; n.vy = -90;
      n.life = n.max = crit ? 0.8 : 0.55;
      n.val = String(val); n.size = crit ? 26 : 15;
      n.color = '#ff5a5a';
    });
  },
  text(x, y, str, color = '#7dd8ff', size = 18) {
    this.nums.spawn(n => {
      n.x = x; n.y = y; n.vy = -50;
      n.life = n.max = 0.9;
      n.val = str; n.size = size; n.color = color;
    });
  },
  flash(a = 0.35, color = '#ffffff') { this.flashA = Math.max(this.flashA, a); this.flashColor = color; },
  showBanner(title, sub) { this.banner = { title, sub }; this.bannerT = 1.8; },
  // 受击红晕
  hurt() { this.hurtVin = 0.55; },

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
      } else { // 阻尼 + 微重力
        p.vx *= (1 - p.drag * dt); p.vy = p.vy * (1 - p.drag * dt) + p.grav * dt;
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

  // UI 层计时（真实时间推进，顿帧/暂停时横幅红晕照常走）
  updateUI(dt) {
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 1.8);
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.hurtVin > 0) this.hurtVin = Math.max(0, this.hurtVin - dt * 1.4);
  },

  draw(ctx) {
    for (const p of this.parts.list) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 2) { // 拖尾光条
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === 3) { // 光斑
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(glowSprite(p.color), p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.kind === 4) { // 闪烁星尘
        ctx.save();
        ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(p.life * 40));
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        if (p.kind === 1) ctx.drawImage(glowSprite(p.color), p.x - 6, p.y - 6, 12, 12);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const n of this.nums.list) {
      const a = clamp(n.life / n.max, 0, 1);
      const pop = n.max - n.life < 0.08 ? 1.35 : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = n.color;
      ctx.font = `bold ${Math.round(n.size * pop)}px ${Fonts.ui}`;
      ctx.fillText(n.val, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  },

  // UI 层：受击红晕 + 全屏闪光 + 横幅
  drawScreenFx(ctx, W, H, state) {
    if (this.hurtVin > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.72);
      g.addColorStop(0, 'rgba(200,30,30,0)');
      g.addColorStop(1, `rgba(200,30,30,${clamp(this.hurtVin, 0, 0.6)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
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
      ctx.fillText(this.banner.title, W / 2, state === 'levelup' ? 886 : 250);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8fa3d8';
      ctx.font = `17px ${Fonts.ui}`;
      ctx.fillText(this.banner.sub, W / 2, state === 'levelup' ? 922 : 292);
      ctx.globalAlpha = 1;
    }
  },

  clear() {
    this.parts.clear(); this.nums.clear();
    this.flashA = 0; this.bannerT = 0; this.banner = null; this.hurtVin = 0;
  },
};
