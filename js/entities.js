'use strict';
// ===== 战斗实体：玩家(剑仙) / 飞剑 / 妖兽 / Boss / 拾取道具 =====

// 剑身绘制（剑尖朝上），玩家脚下御剑与飞剑共用
function drawBlade(ctx, x, y, len, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -len / 2);
  ctx.lineTo(3.2, -len * 0.15);
  ctx.lineTo(2.2, len * 0.32);
  ctx.lineTo(-2.2, len * 0.32);
  ctx.lineTo(-3.2, -len * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#caa04a'; // 剑格
  ctx.fillRect(-5, len * 0.3, 10, 2.6);
  ctx.fillStyle = '#6b4a2b'; // 剑柄
  ctx.fillRect(-1.6, len * 0.32, 3.2, len * 0.2);
  ctx.restore();
}

// ===== 玩家：御剑的剑仙 =====
class Player {
  constructor() {
    const P = CFG.player, S = CFG.sword;
    this.x = CFG.view.w / 2;
    this.y = P.laneY;
    this.r = P.radius;
    this.level = 1;
    this.stats = {
      maxHp: P.hp, swordCount: 1, volleysPerSec: S.volleysPerSec, damage: S.damage,
      speed: S.speed, critRate: S.critRate, critMult: S.critMult,
      magnetRadius: P.magnetRadius, pierce: S.pierce,
    };
    this.hp = this.stats.maxHp;
    this.fireCd = 0;
    this.invuln = 0;
    this.shield = 0;
    this.bob = 0;
    this.buffs = {}; // {sword2: 剩余秒, rage: 剩余秒}
    this.trail = [];
  }

  // 当前剑品档位（随等级晋升）
  get tier() {
    let t = CFG.swordTiers[0];
    for (const x of CFG.swordTiers) if (this.level >= x.lv) t = x;
    return t;
  }
  // 剑品序号（用于选择 sword_tierN 贴图）
  get tierIndex() {
    let idx = 0;
    CFG.swordTiers.forEach((t, i) => { if (this.level >= t.lv) idx = i; });
    return idx;
  }
  get effSwordCount() { return this.stats.swordCount + (this.buffs.sword2 ? 2 : 0); }
  get effRate() { return this.stats.volleysPerSec * (this.buffs.rage ? 2 : 1); }

  update(dt, game) {
    this.bob += dt * 6;
    // 纵向航道：只左右移动（拖动横向增量 + 键盘左右），纵向锁定
    const d = game.moveDelta, k = Input.keyAxis();
    this.x = clamp(this.x + d.x * CFG.player.touchSens + k.x * CFG.player.keySpeed * dt, 30, CFG.view.w - 30);
    this.y = CFG.player.laneY;
    // 御剑尾迹
    this.trail.push({ x: this.x, y: this.y + 28 });
    if (this.trail.length > 12) this.trail.shift();
    // buff 计时
    for (const key in this.buffs) {
      this.buffs[key] -= dt;
      if (this.buffs[key] <= 0) delete this.buffs[key];
    }
    if (this.invuln > 0) this.invuln -= dt;
    // 自动开火：朝最近敌人扇形齐射
    this.fireCd -= dt;
    while (this.fireCd <= 0) {
      this.fireCd += 1 / this.effRate;
      this.volley(game);
    }
  }

  volley(game) {
    const n = this.effSwordCount;
    const m = game.nearestMonster(this.x, this.y);
    const base = m ? Math.atan2(m.y - this.y, m.x - this.x) : -Math.PI / 2;
    const spread = 0.16;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      game.spawnSword(this.x, this.y - 16, a);
    }
    if (n > 2) AudioSys.shoot(); // 剑少时不铺底噪
  }

  hurt(dmg, game) {
    if (this.invuln > 0 || this.hp <= 0) return;
    if (this.shield > 0) {
      this.shield--;
      this.invuln = 0.6;
      FX.ring(this.x, this.y, '#6fd8ff', 18, 300);
      FX.text(this.x, this.y - 34, '罡气碎！', '#6fd8ff', 16);
      AudioSys.kill(); Cam.shake(5);
      return;
    }
    this.hp -= dmg;
    this.invuln = CFG.player.invulnTime;
    FX.spark(this.x, this.y, '#ff6b6b', 10, 220);
    FX.num(this.x, this.y - 24, '-' + dmg, true);
    Cam.shake(7, 0.25);
    AudioSys.hurt();
    if (this.hp <= 0) { this.hp = 0; game.onPlayerDead(); }
  }

  draw(ctx) {
    const x = this.x, y = this.y, t = this.bob;
    // 御剑尾迹
    if (this.trail.length > 2) {
      ctx.strokeStyle = 'rgba(120,220,255,0.22)';
      ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (const p of this.trail) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    // AI 贴图优先：assets/player.png 存在则整体替换程序化造型
    const blinkA = this.invuln > 0 && ((this.invuln * 14) | 0) % 2 === 0 ? 0.35 : 1;
    if (drawSprite(ctx, 'player', x, y, { size: 78, alpha: blinkA })) {
      if (this.shield > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(t) * 0.15;
        ctx.strokeStyle = '#6fd8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      return;
    }
    // 程序化造型整体放大 1.6 倍
    if (blinkA < 1) ctx.globalAlpha = blinkA;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.6, 1.6);
    ctx.translate(-x, -y);
    // 脚下飞剑（御剑）
    ctx.save();
    ctx.translate(x, y + 22);
    ctx.rotate(-0.6 + Math.sin(t * 0.7) * 0.05);
    drawBlade(ctx, 0, 0, 30, this.tier.color);
    ctx.restore();
    // 飘带（先画，压在袍子后）    ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 20);
    ctx.quadraticCurveTo(x - 10 - Math.sin(t) * 4, y - 6, x - 14 - Math.sin(t * 1.3) * 5, y + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 20);
    ctx.quadraticCurveTo(x + 10 + Math.sin(t + 1) * 4, y - 6, x + 14 + Math.sin(t * 1.1 + 2) * 5, y + 6);
    ctx.stroke();
    // 道袍
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x - 11, y - 6);
    ctx.lineTo(x - 14, y + 18);
    ctx.lineTo(x - 6, y + 15);
    ctx.lineTo(x, y + 19);
    ctx.lineTo(x + 6, y + 15);
    ctx.lineTo(x + 14, y + 18);
    ctx.lineTo(x + 11, y - 6);
    ctx.closePath(); ctx.fill();
    // 腰带
    ctx.fillStyle = '#c9a45a';
    ctx.fillRect(x - 8, y + 2, 16, 3);
    // 头 / 发髻 / 冠
    ctx.fillStyle = '#ffe2c4';
    ctx.beginPath(); ctx.arc(x, y - 24, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath(); ctx.arc(x, y - 26, 6.2, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 32, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9a45a';
    ctx.fillRect(x - 4, y - 31, 8, 1.6);
    ctx.restore(); // 结束 1.6 放大
    // 护体罡气
    if (this.shield > 0) {
      ctx.globalAlpha = blinkA * (0.5 + Math.sin(t) * 0.15);
      ctx.strokeStyle = '#6fd8ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ===== 飞剑 =====
function spawnSwordInit(s, x, y, a, game) {
  const st = game.player.stats;
  const spd = st.speed * rand(0.94, 1.06);
  const crit = Math.random() < st.critRate;
  s.x = x; s.y = y;
  s.vx = Math.cos(a) * spd; s.vy = Math.sin(a) * spd;
  s.dmg = Math.round(st.damage * (crit ? st.critMult : 1));
  s.crit = crit;
  s.pierce = st.pierce;
  s.life = CFG.sword.life;
  s.color = crit ? '#ffd75a' : game.player.tier.color; // 暴击剑金色，肉眼可见
  s.tier = game.player.tierIndex; // 剑品序号 → sword_tierN 贴图
  s.trail.length = 0;
  s.hits.length = 0;
}

function drawSword(ctx, s) {
  // 残影拖尾
  if (s.trail.length > 1) {
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'round';
    for (let i = 1; i < s.trail.length; i++) {
      const a = i / s.trail.length;
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = 5 * a;
      ctx.beginPath();
      ctx.moveTo(s.trail[i - 1].x, s.trail[i - 1].y);
      ctx.lineTo(s.trail[i].x, s.trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const a = Math.atan2(s.vy, s.vx);
  // AI 贴图优先：带透明通道的发光贴图（亮度键控抠底），按速度方向旋转
  if (drawSprite(ctx, 'sword_tier' + (s.tier || 0), s.x, s.y, { size: 48, angle: a + Math.PI / 2 })) return;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(a + Math.PI / 2);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(glowSprite(s.color), -14, -14, 28, 28);
  ctx.globalAlpha = 1;
  drawBlade(ctx, 0, 0, 26, s.color);
  ctx.restore();
}

// ===== 妖兽 =====
let MID = 0;
class Monster {
  init(type, x, opts = {}) {
    const c = CFG.monsters[type];
    this.id = ++MID;
    this.type = type; this.cfg = c; this.name = c.name;
    this.x = x;
    this.y = opts.y !== undefined ? opts.y : -40;
    this.maxHp = c.hp * (opts.hpMul || 1);
    this.hp = this.maxHp;
    this.r = c.radius;
    this.dmg = c.dmg;
    this.speed = c.speed * (opts.spdMul || 1);
    this.t = rand(0, 10);
    this.flash = 0;
    this.dead = false;
    this.shootCd = rand(0.6, c.shootGap || 1);
    this.baseX = x;
    this.sine = rand(0, TAU);
    this.stopY = rand(140, 300);
    this.boss = type === 'boss';
    this.elite = type === 'elite';
    if (this.boss) {
      this.phase = 1;
      this.radialCd = 2;
      this.dashCd = 3.5;
      this.dashState = 0;
      this.dashT = 0;
      this.dvx = 0; this.dvy = 0;
      this.spiralA = 0; this.spiralCd = 0;
    }
    return this;
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    const p = game.player;
    switch (this.type) {
      case 'wolf':
      case 'elite': { // 直线扑向玩家
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.x += Math.cos(a) * this.speed * dt;
        this.y += Math.sin(a) * this.speed * dt;
        break;
      }
      case 'bat': { // 下压 + 正弦横飘
        this.y += this.speed * dt;
        this.sine += dt * this.cfg.sineFreq;
        this.x = this.baseX + Math.sin(this.sine) * this.cfg.sineAmp;
        break;
      }
      case 'ghost': { // 降到火力线后悬停吐符
        if (this.y < this.stopY) this.y += this.speed * dt;
        else this.x += Math.sin(this.t * 0.8) * this.speed * 0.6 * dt;
        this.shootCd -= dt;
        if (this.shootCd <= 0 && this.y > 40) {
          this.shootCd = this.cfg.shootGap;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          game.spawnBullet(this.x, this.y, a, this.cfg.bulletSpeed, this.cfg.bulletDmg);
          AudioSys.eshoot();
        }
        break;
      }
      case 'boss':
        this.updateBoss(dt, game);
        break;
    }
    if (!this.boss && this.y > CFG.view.h + 60) this.dead = true;
  }

  updateBoss(dt, game) {
    const p = game.player;
    // 二阶段：狂暴
    if (this.phase === 1 && this.hp < this.maxHp * this.cfg.phase2At) {
      this.phase = 2;
      this.speed *= 1.3;
      game.clearBullets(); // 转阶段清弹，给玩家喘息
      FX.flash(0.5, '#ff6666');
      FX.showBanner('黑山老妖 · 狂暴', '第二形态');
      Cam.shake(9, 0.5); Cam.hitStop(0.12);
      AudioSys.boom();
    }
    // 径向弹幕
    this.radialCd -= dt;
    if (this.radialCd <= 0) {
      this.radialCd = this.phase === 2 ? this.cfg.radialGap * 0.65 : this.cfg.radialGap;
      const n = this.phase === 2 ? this.cfg.radialCount + 4 : this.cfg.radialCount;
      const off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        game.spawnBullet(this.x, this.y, a, this.cfg.bulletSpeed, 15);
      }
      AudioSys.eshoot();
    }
    // 二阶段螺旋弹
    if (this.phase === 2) {
      this.spiralCd -= dt;
      if (this.spiralCd <= 0) {
        this.spiralCd = 0.14;
        this.spiralA += 0.5;
        game.spawnBullet(this.x, this.y, this.spiralA, 240, 12);
        game.spawnBullet(this.x, this.y, this.spiralA + Math.PI, 240, 12);
      }
    }
    // 冲撞（蓄力预警→突进）
    if (this.dashState === 0) {
      this.dashCd -= dt;
      if (this.y < 170) this.y += this.speed * dt;
      this.x += Math.sign(p.x - this.x) * 30 * dt;
      if (this.dashCd <= 0) { this.dashState = 1; this.dashT = 0.55; }
    } else if (this.dashState === 1) { // 蓄力：闪烁预警
      this.dashT -= dt;
      this.flash = (this.dashT % 0.2) < 0.1 ? 0.08 : 0; // 闪烁而非常白
      if (this.dashT <= 0) {
        this.dashState = 2; this.dashT = 0.5;
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.dvx = Math.cos(a) * this.cfg.dashSpeed;
        this.dvy = Math.sin(a) * this.cfg.dashSpeed;
        Cam.shake(5); AudioSys.kill();
      }
    } else { // 突进中
      this.dashT -= dt;
      this.x += this.dvx * dt; this.y += this.dvy * dt;
      if (this.dashT <= 0) { this.dashState = 0; this.dashCd = this.cfg.dashGap; }
    }
    this.x = clamp(this.x, 50, CFG.view.w - 50);
    this.y = clamp(this.y, 60, CFG.view.h * 0.6);
  }

  hit(dmg, crit, game, hx, hy) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.08;
    const px = hx !== undefined ? hx : this.x;
    const py = hy !== undefined ? hy : this.y;
    FX.num(px, py - 10, dmg, crit);
    FX.spark(px, py, crit ? '#ffd75a' : game.player.tier.color, crit ? 10 : 5, crit ? 260 : 170);
    if (crit) AudioSys.crit();
    AudioSys.hit(game.combo);
    const isBig = this.boss || this.elite;
    if (crit || isBig) Cam.hitStop(crit ? 0.045 : 0.035); // 顿帧只给大目标/暴击，避免连射卡顿感
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    if (this.dead) return;
    this.dead = true;
    game.addKill(this);
    FX.soul(this.x, this.y, game.player, this.boss ? 18 : this.elite ? 10 : 4);
    FX.spark(this.x, this.y, '#a8e6ff', 12, 260);
    if (this.cfg.xp > 0) game.spawnOrbs(this.x, this.y, this.cfg.xp);
    if (this.elite) {
      game.spawnPickup(this.x, this.y);
      game.spawnOrbs(this.x, this.y, this.cfg.orbBurst);
      Cam.shake(6); AudioSys.boom();
    }
    if (this.boss) game.onBossDead(this);
    AudioSys.kill();
  }

  draw(ctx, game) {
    const fl = this.flash > 0;
    switch (this.type) {
      case 'wolf': this.drawWolf(ctx, game, fl); break;
      case 'bat': this.drawBat(ctx, fl); break;
      case 'ghost': this.drawGhost(ctx, fl); break;
      case 'elite': this.drawElite(ctx, game, fl); break;
      case 'boss': this.drawBoss(ctx, fl); break;
    }
  }

  drawWolf(ctx, game, fl) {
    const a = Math.atan2(game.player.y - this.y, game.player.x - this.x);
    const r = this.r;
    // AI 贴图优先（贴图面朝屏幕下方，按运动方向旋转）
    if (drawSprite(ctx, 'monster_wolf', this.x, this.y, { size: r * 2.7, angle: a - Math.PI / 2 })) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    const body = fl ? '#ffffff' : '#5a5470';
    const dark = fl ? '#ffffff' : '#423c58';
    // 尾
    ctx.strokeStyle = dark; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(-r * 1.6, -r * 0.5);
    ctx.stroke();
    // 身体与头
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.75, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.75, 0, r * 0.55, 0, TAU); ctx.fill();
    // 双耳
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.4); ctx.lineTo(r * 1.05, -r * 0.9); ctx.lineTo(r * 1.2, -r * 0.25);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.7, r * 0.4); ctx.lineTo(r * 1.05, r * 0.9); ctx.lineTo(r * 1.2, r * 0.25);
    ctx.closePath(); ctx.fill();
    // 红眼
    if (!fl) {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(r * 1.05, -3, 2.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 1.05, 3, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawBat(ctx, fl) {
    if (drawSprite(ctx, 'monster_bat', this.x, this.y, { size: this.r * 2.6 })) return;
    const r = this.r;
    const w = Math.sin(this.t * 13) * 0.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = fl ? '#ffffff' : '#7a5a9a';
    for (const s of [-1, 1]) { // 双翼扇动
      ctx.beginPath();
      ctx.moveTo(s * 4, 0);
      ctx.quadraticCurveTo(s * 16, -10 + w * 10, s * 22, -2 + w * 14);
      ctx.quadraticCurveTo(s * 14, 4 + w * 6, s * 5, 6);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.fill();
    if (!fl) {
      ctx.fillStyle = '#ffd75a';
      ctx.beginPath(); ctx.arc(-2.5, -1, 1.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(2.5, -1, 1.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawGhost(ctx, fl) {
    if (drawSprite(ctx, 'monster_ghost', this.x, this.y, { size: this.r * 2.6, angle: Math.sin(this.t * 2.2) * 0.14 })) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.t * 2.2) * 0.14);
    ctx.globalAlpha = 0.4;
    ctx.drawImage(glowSprite('#ffcf5a'), -20, -20, 40, 40);
    ctx.globalAlpha = 1;
    // 符纸
    rr(ctx, -10, -16, 20, 32, 3);
    ctx.fillStyle = fl ? '#ffffff' : '#e6d089'; ctx.fill();
    ctx.strokeStyle = '#b09a55'; ctx.lineWidth = 1.5; ctx.stroke();
    if (!fl) {
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -5, 4.5, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5, 7); ctx.lineTo(5, 7);
      ctx.moveTo(-4, 11); ctx.lineTo(4, 11);
      ctx.stroke();
      ctx.fillStyle = '#ff3a3a';
      ctx.beginPath(); ctx.arc(-3.5, -8, 1.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(3.5, -8, 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawElite(ctx, game, fl) {
    const a = Math.atan2(game.player.y - this.y, game.player.x - this.x);
    const r = this.r;
    // AI 贴图优先（血条两种路径都要画）
    if (drawSprite(ctx, 'monster_elite', this.x, this.y, { size: r * 2.5, angle: a - Math.PI / 2 })) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - 26, this.y - r - 16, 52, 5);
      ctx.fillStyle = '#e85a6b';
      ctx.fillRect(this.x - 25, this.y - r - 15, 50 * clamp(this.hp / this.maxHp, 0, 1), 3);
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(glowSprite('#ff4a6a'), -r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
    ctx.globalAlpha = 1;
    const body = fl ? '#ffffff' : '#7c2f4a';
    const dark = fl ? '#ffffff' : '#5a1f36';
    ctx.strokeStyle = dark; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(-r * 1.5, -r * 0.45);
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.7, 0, r * 0.55, 0, TAU); ctx.fill();
    // 双角
    ctx.fillStyle = fl ? '#ffffff' : '#d8c8a8';
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.4); ctx.lineTo(r * 1.05, -r * 1.1); ctx.lineTo(r * 1.15, -r * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.5, r * 0.4); ctx.lineTo(r * 1.05, r * 1.1); ctx.lineTo(r * 1.15, r * 0.2);
    ctx.closePath(); ctx.fill();
    if (!fl) {
      ctx.fillStyle = '#ffd75a';
      ctx.beginPath(); ctx.arc(r * 1.02, -4, 2.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 1.02, 4, 2.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // 血条
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.x - 26, this.y - r - 16, 52, 5);
    ctx.fillStyle = '#e85a6b';
    ctx.fillRect(this.x - 25, this.y - r - 15, 50 * clamp(this.hp / this.maxHp, 0, 1), 3);
  }

  drawBoss(ctx, fl) {
    const r = this.r;
    // AI 贴图优先（狂暴形态单独一张）
    if (drawSprite(ctx, this.phase === 2 ? 'boss_heishan_rage' : 'boss_heishan', this.x, this.y, { size: r * 2.5 })) return;
    // 妖气
    ctx.globalAlpha = 0.5 + Math.sin(this.t * 3) * 0.15;
    ctx.drawImage(glowSprite('#ff3a3a'), this.x - r * 2, this.y - r * 2, r * 4, r * 4);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    const body = fl ? '#ffffff' : '#2e2140';
    // 犄角
    ctx.fillStyle = fl ? '#ffffff' : '#cbb894';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, -r * 0.55);
      ctx.quadraticCurveTo(s * r * 1.15, -r * 1.15, s * r * 0.75, -r * 1.5);
      ctx.quadraticCurveTo(s * r * 0.8, -r * 0.95, s * r * 0.6, -r * 0.62);
      ctx.closePath(); ctx.fill();
    }
    // 巨体
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r, 0, 0, TAU); ctx.fill();
    if (!fl) {
      ctx.fillStyle = '#4a3260';
      ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.85, r * 0.5, 0, 0, TAU); ctx.fill();
      // 双眼（阶段二更大）
      const er = this.phase === 2 ? 7 : 5.5;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(glowSprite('#ff4040'), -r * 0.45 - er * 2, -r * 0.3 - er * 2, er * 4, er * 4);
      ctx.drawImage(glowSprite('#ff4040'), r * 0.45 - er * 2, -r * 0.3 - er * 2, er * 4, er * 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.3, er * 0.45, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.3, er * 0.45, 0, TAU); ctx.fill();
      // 口与獠牙
      ctx.strokeStyle = '#120a18'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#e8e0d0';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.3, r * 0.33);
        ctx.lineTo(s * r * 0.22, r * 0.5);
        ctx.lineTo(s * r * 0.14, r * 0.33);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ===== 拾取道具（雷霆战机式）=====
const PK_STYLE = {
  sword2: { ch: '剑', color: '#ffd75a', label: '剑阵加身！' },
  rage:   { ch: '狂', color: '#ff7a4a', label: '狂剑诀！' },
  shield: { ch: '盾', color: '#6fd8ff', label: '护体罡气！' },
  nova:   { ch: '灭', color: '#ff4a6a', label: '万剑归宗！' },
  vacuum: { ch: '灵', color: '#7dffd0', label: '万灵来朝！' },
};

function drawPickup(ctx, p) {
  const st = PK_STYLE[p.kind];
  const bob = Math.sin(p.t * 4) * 3;
  const remain = CFG.pickups.life - p.t;
  if (remain < 2 && ((p.t * 6) | 0) % 2 === 0) return; // 消失前闪烁
  const x = p.x, y = p.y + bob;
  // AI 贴图优先（圆形符咒徽章）
  if (drawSprite(ctx, 'pickup_' + p.kind, x, y, { size: 40 })) return;
  ctx.globalAlpha = 0.55;
  ctx.drawImage(glowSprite(st.color), x - 22, y - 22, 44, 44);
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU);
  ctx.fillStyle = 'rgba(8,12,28,0.85)'; ctx.fill();
  ctx.strokeStyle = st.color; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = st.color;
  ctx.font = `bold 17px ${Fonts.ui}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(st.ch, x, y + 1);
  ctx.textBaseline = 'alphabetic';
}
