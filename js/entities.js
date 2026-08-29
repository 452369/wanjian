'use strict';
// ===== 战斗实体：玩家(剑仙) / 飞剑 / 妖兽 / Boss / 拾取道具（Survivor 化，世界坐标）=====

// 剑身绘制（剑尖朝上），程序化兜底用
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
  ctx.fillStyle = '#caa04a';
  ctx.fillRect(-5, len * 0.3, 10, 2.6);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(-1.6, len * 0.32, 3.2, len * 0.2);
  ctx.restore();
}

// ===== 玩家：剑仙（360° 走位，技能全自动）=====
class Player {
  constructor() {
    this.x = CFG.arena.w / 2; this.y = CFG.arena.h / 2; // 开局在结界中央
    this.r = CFG.player.radius;
    this.level = 1;
    this.stats = { maxHp: CFG.player.hp };
    this.hp = this.stats.maxHp;
    this.skills = { yujian: 2, jianqi: 1 }; // 开局强力：双剑齐射 + 剑气斩护身
    this.eff = {};                 // 被动加成（Skills.recompute 填充）
    this.buffs = {};               // 拾取临时增益 {sword2, rage}
    this.shield = 0;
    this.invuln = 0;
    this.bob = 0;
    this.face = { x: 0, y: -1 };   // 朝向（走位方向）
    this.trail = [];
  }

  get tier() {
    let t = CFG.swordTiers[0];
    for (const x of CFG.swordTiers) if (this.level >= x.lv) t = x;
    return t;
  }
  get tierIndex() {
    let idx = 0;
    CFG.swordTiers.forEach((t, i) => { if (this.level >= t.lv) idx = i; });
    return idx;
  }

  update(dt, game) {
    this.bob += dt * 6;
    // 360° 走位
    const j = Input.joy();
    if (j.x || j.y) {
      const d = Math.hypot(j.x, j.y);
      this.face = { x: j.x / d, y: j.y / d };
      this.trail.push({ x: this.x - this.face.x * 6, y: this.y + 26 });
      if (this.trail.length > 12) this.trail.shift();
    }
    this.x += j.x * this.eff.speed * dt;
    this.y += j.y * this.eff.speed * dt;
    // 灵气结界边界
    this.x = clamp(this.x, CFG.arena.margin, CFG.arena.w - CFG.arena.margin);
    this.y = clamp(this.y, CFG.arena.margin, CFG.arena.h - CFG.arena.margin);
    // buff 计时
    for (const key in this.buffs) {
      this.buffs[key] -= dt;
      if (this.buffs[key] <= 0) delete this.buffs[key];
    }
    if (this.invuln > 0) this.invuln -= dt;
    Skills.update(dt, game);
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
    dmg = Math.round(dmg * (1 - (this.eff.dmgReduce || 0))); // 铁壁减伤
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
    // AI 贴图优先：assets/player.png
    const blinkA = this.invuln > 0 && ((this.invuln * 14) | 0) % 2 === 0 ? 0.35 : 1;
    if (drawSprite(ctx, 'player', x, y, { size: 78, alpha: blinkA })) {
      if (this.shield > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(t) * 0.15;
        ctx.strokeStyle = '#6fd8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      return;
    }
    // 程序化造型兜底（放大 1.6 倍）
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
    // 飘带
    ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 2;
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
    ctx.restore(); // 结束放大
    // 护体罡气
    if (this.shield > 0) {
      ctx.globalAlpha = blinkA * (0.5 + Math.sin(t) * 0.15);
      ctx.strokeStyle = '#6fd8ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ===== 飞剑（御剑术弹道）=====
function spawnSwordInit(s, x, y, a, game) {
  const e = game.player.eff;
  const spd = CFG.sword.speed * rand(0.94, 1.06);
  const crit = Math.random() < e.critRate;
  s.x = x; s.y = y;
  s.vx = Math.cos(a) * spd; s.vy = Math.sin(a) * spd;
  s.dmg = Math.round(CFG.sword.damage * e.dmgMul * (crit ? e.critMult : 1));
  s.crit = crit;
  s.life = CFG.sword.life;
  s.color = crit ? '#ffd75a' : game.player.tier.color;
  s.tier = game.player.tierIndex;
  s.pierce = CFG.sword.pierce; // 光束穿透
  s.trail.length = 0;
  s.hits.length = 0;
}

function drawSword(ctx, s) {
  // 青色光束拖尾（additive 长条，参考视频的穿透光束观感）
  if (s.trail.length > 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(84,232,255,0.4)';
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.trail[0].x, s.trail[0].y);
    for (const p of s.trail) ctx.lineTo(p.x, p.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.restore();
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
  init(type, x, y, opts = {}) {
    const c = CFG.monsters[type];
    this.id = ++MID;
    this.type = type; this.cfg = c; this.name = c.name;
    this.x = x; this.y = y;
    this.maxHp = c.hp * (opts.hpMul || 1);
    this.hp = this.maxHp;
    this.r = c.radius;
    this.dmg = c.dmg;
    this.speed = c.speed * (opts.spdMul || 1);
    this.t = rand(0, 10);
    this.flash = 0;
    this.dead = false;
    this.shootCd = rand(0.6, c.shootGap || 1);
    this.sine = rand(0, TAU);
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    // 动画与攻击状态
    this.lungeCd = rand(1.2, 2.2); // 狼妖扑击冷却
    this.lungeT = 0; this.lvx = 0; this.lvy = 0;
    this.windup = 0;               // 蓄力预警（狼扑/妖将震地）
    this.slamCd = rand(2.5, 3.5);  // 妖将震地冷却
    this.slamT = 0;
    this.tell = false;             // 符鬼施法预警
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
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    switch (this.type) {
      case 'wolf': { // 追击 + 周期扑击（蓄力→突进，攻击动画）
        this.lungeCd -= dt;
        if (this.lungeT > 0) {
          this.lungeT -= dt;
          this.x += this.lvx * dt; this.y += this.lvy * dt;
        } else if (this.windup > 0) {
          this.windup -= dt;
          if (this.windup <= 0) {
            this.lungeT = 0.22;
            const sp = this.speed * 2.6;
            this.lvx = nx * sp; this.lvy = ny * sp;
            AudioSys.eshoot();
          }
        } else {
          this.x += nx * this.speed * dt;
          this.y += ny * this.speed * dt;
          if (this.lungeCd <= 0 && dist < 190) { this.windup = 0.22; this.lungeCd = rand(1.6, 2.4); }
        }
        break;
      }
      case 'elite': { // 追击 + 震地拍击（蓄力圈预警→范围伤害）
        this.slamCd -= dt;
        if (this.slamT > 0) {
          this.slamT -= dt;
          if (this.slamT <= 0) {
            FX.ring(this.x, this.y, '#ff4a6a', 22, 320);
            Cam.shake(5);
            if (dist < 120) p.hurt(14, game);
            AudioSys.boom();
          }
          break;
        }
        if (this.windup > 0) {
          this.windup -= dt;
          if (this.windup <= 0) this.slamT = 0.18;
          break;
        }
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
        if (this.slamCd <= 0 && dist < 170) {
          this.windup = 0.45; this.slamCd = 3.2;
          FX.text(this.x, this.y - this.r - 14, '震地！', '#ff4a6a', 14);
        }
        break;
      }
      case 'bat': { // 追击 + 垂直正弦摆动
        const sway = Math.sin(this.t * this.cfg.sineFreq) * this.cfg.sineAmp * 0.4;
        this.x += (nx * this.speed + -ny * sway) * dt;
        this.y += (ny * this.speed + nx * sway) * dt;
        break;
      }
      case 'ghost': { // 保持距离放风筝 + 吐符（出手前红光预警）
        if (dist > this.cfg.keepDist) {
          this.x += nx * this.speed * dt;
          this.y += ny * this.speed * dt;
        } else {
          this.x += -ny * this.speed * 0.6 * this.strafe * dt;
          this.y += nx * this.speed * 0.6 * this.strafe * dt;
          if (Math.random() < dt * 0.4) this.strafe *= -1;
        }
        this.shootCd -= dt;
        this.tell = this.shootCd > 0 && this.shootCd < 0.35;
        if (this.shootCd <= 0 && dist < 560) {
          this.shootCd = this.cfg.shootGap;
          this.tell = false;
          const a = Math.atan2(dy, dx);
          game.spawnBullet(this.x, this.y, a, this.cfg.bulletSpeed, this.cfg.bulletDmg);
          AudioSys.eshoot();
        }
        break;
      }
      case 'boss':
        this.updateBoss(dt, game, nx, ny, dist);
        break;
    }
  }

  updateBoss(dt, game, nx, ny, dist) {
    const p = game.player;
    // 二阶段：狂暴
    if (this.phase === 1 && this.hp < this.maxHp * this.cfg.phase2At) {
      this.phase = 2;
      this.speed *= 1.25;
      game.clearBullets();
      FX.flash(0.5, '#ff6666');
      FX.showBanner('黑山老妖 · 狂暴', '第二形态');
      Cam.shake(9, 0.5); Cam.hitStop(0.12);
      AudioSys.boom();
    }
    // 径向弹幕
    this.radialCd -= dt;
    if (this.radialCd <= 0 && dist < 620) {
      this.radialCd = this.phase === 2 ? this.cfg.radialGap * 0.65 : this.cfg.radialGap;
      const n = this.phase === 2 ? this.cfg.radialCount + 4 : this.cfg.radialCount;
      const off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        game.spawnBullet(this.x, this.y, off + (i / n) * TAU, this.cfg.bulletSpeed, 15);
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
    // 追击 + 冲撞（蓄力闪烁→突进）
    if (this.dashState === 0) {
      this.dashCd -= dt;
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * dt;
      if (this.dashCd <= 0 && dist < 480) { this.dashState = 1; this.dashT = 0.55; }
    } else if (this.dashState === 1) {
      this.dashT -= dt;
      this.flash = (this.dashT % 0.2) < 0.1 ? 0.08 : 0; // 闪烁预警
      if (this.dashT <= 0) {
        this.dashState = 2; this.dashT = 0.5;
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.dvx = Math.cos(a) * this.cfg.dashSpeed;
        this.dvy = Math.sin(a) * this.cfg.dashSpeed;
        Cam.shake(5); AudioSys.kill();
      }
    } else {
      this.dashT -= dt;
      this.x += this.dvx * dt; this.y += this.dvy * dt;
      if (this.dashT <= 0) { this.dashState = 0; this.dashCd = this.cfg.dashGap; }
    }
  }

  hit(dmg, crit, game, hx, hy, silent) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.08;
    const px = hx !== undefined ? hx : this.x;
    const py = hy !== undefined ? hy : this.y;
    if (!silent) FX.num(px, py - 10, dmg, crit);
    FX.spark(px, py, crit ? '#ffd75a' : game.player.tier.color, crit ? 10 : 5, crit ? 260 : 170);
    if (crit) AudioSys.crit();
    if (!silent) AudioSys.hit(game.combo);
    const isBig = this.boss || this.elite;
    if (crit || isBig) Cam.hitStop(crit ? 0.045 : 0.035);
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    if (this.dead) return;
    this.dead = true;
    game.addKill(this);
    FX.soul(this.x, this.y, game.player, this.boss ? 18 : this.elite ? 10 : 4);
    FX.spark(this.x, this.y, '#a8e6ff', 12, 260);
    if (this.elite) { // 斩妖将：掉宝 + 直升小半级
      game.spawnPickup(this.x, this.y);
      game.addKillProgress(4);
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
    // 行走起伏 + 扑击拉伸 + 蓄力脉冲
    const moving = this.lungeT <= 0 && this.windup <= 0;
    const hop = moving ? Math.abs(Math.sin(this.t * 10)) * 3 : 0;
    const lk = this.lungeT > 0 ? this.lungeT / 0.22 : 0;
    const wind = this.windup > 0 ? 1 + 0.12 * Math.sin(this.windup * 45) : 1;
    if (drawSprite(ctx, 'monster_wolf', this.x, this.y - hop, {
      size: r * 2.7 * wind, angle: a - Math.PI / 2, sx: 1 + lk * 0.35, sy: 1 - lk * 0.18,
    })) return;
    ctx.save();
    ctx.translate(this.x, this.y - hop);
    ctx.rotate(a);
    ctx.scale(1 + lk * 0.35, 1 - lk * 0.18);
    const body = fl ? '#ffffff' : '#5a5470';
    const dark = fl ? '#ffffff' : '#423c58';
    ctx.strokeStyle = dark; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(-r * 1.6, -r * 0.5);
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.75, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.75, 0, r * 0.55, 0, TAU); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.4); ctx.lineTo(r * 1.05, -r * 0.9); ctx.lineTo(r * 1.2, -r * 0.25);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.7, r * 0.4); ctx.lineTo(r * 1.05, r * 0.9); ctx.lineTo(r * 1.2, r * 0.25);
    ctx.closePath(); ctx.fill();
    if (!fl) {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(r * 1.05, -3, 2.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 1.05, 3, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawBat(ctx, fl) {
    // 扇翅挤压动画
    if (drawSprite(ctx, 'monster_bat', this.x, this.y, { size: this.r * 2.6, sy: 1 + Math.sin(this.t * 13) * 0.1 })) return;
    const r = this.r;
    const w = Math.sin(this.t * 13) * 0.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = fl ? '#ffffff' : '#7a5a9a';
    for (const s of [-1, 1]) {
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
    // 施法红光预警 + 漂浮起伏
    if (this.tell && !fl) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glowSprite('#ff4040'), this.x - 24, this.y - 24, 48, 48);
      ctx.globalAlpha = 1;
    }
    const bob = Math.sin(this.t * 2) * 3;
    if (drawSprite(ctx, 'monster_ghost', this.x, this.y + bob, { size: this.r * 2.6, angle: Math.sin(this.t * 2.2) * 0.14 })) return;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(Math.sin(this.t * 2.2) * 0.14);
    ctx.globalAlpha = 0.4;
    ctx.drawImage(glowSprite('#ffcf5a'), -20, -20, 40, 40);
    ctx.globalAlpha = 1;
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
    // 震地预警圈（蓄力进度可视化）
    if (this.windup > 0 && !fl) {
      const k = 1 - this.windup / 0.45;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff4a6a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, 110, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,74,106,0.16)';
      ctx.beginPath(); ctx.arc(this.x, this.y, 110 * k, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const wind = this.windup > 0 ? 1 + 0.15 * Math.sin(this.windup * 40) : 1;
    if (drawSprite(ctx, 'monster_elite', this.x, this.y, { size: r * 2.5 * wind, angle: a - Math.PI / 2 })) {
      this.drawHpBar(ctx, r);
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
    this.drawHpBar(ctx, r);
  }

  drawHpBar(ctx, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.x - 26, this.y - r - 16, 52, 5);
    ctx.fillStyle = '#e85a6b';
    ctx.fillRect(this.x - 25, this.y - r - 15, 50 * clamp(this.hp / this.maxHp, 0, 1), 3);
  }

  drawBoss(ctx, fl) {
    const r = this.r;
    if (drawSprite(ctx, this.phase === 2 ? 'boss_heishan_rage' : 'boss_heishan', this.x, this.y, { size: r * 2.5 })) return;
    ctx.globalAlpha = 0.5 + Math.sin(this.t * 3) * 0.15;
    ctx.drawImage(glowSprite('#ff3a3a'), this.x - r * 2, this.y - r * 2, r * 4, r * 4);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    const body = fl ? '#ffffff' : '#2e2140';
    ctx.fillStyle = fl ? '#ffffff' : '#cbb894';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.35, -r * 0.55);
      ctx.quadraticCurveTo(s * r * 1.15, -r * 1.15, s * r * 0.75, -r * 1.5);
      ctx.quadraticCurveTo(s * r * 0.8, -r * 0.95, s * r * 0.6, -r * 0.62);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r, 0, 0, TAU); ctx.fill();
    if (!fl) {
      ctx.fillStyle = '#4a3260';
      ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.85, r * 0.5, 0, 0, TAU); ctx.fill();
      const er = this.phase === 2 ? 7 : 5.5;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(glowSprite('#ff4040'), -r * 0.45 - er * 2, -r * 0.3 - er * 2, er * 4, er * 4);
      ctx.drawImage(glowSprite('#ff4040'), r * 0.45 - er * 2, -r * 0.3 - er * 2, er * 4, er * 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.3, er * 0.45, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.3, er * 0.45, 0, TAU); ctx.fill();
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

// ===== 拾取道具（精英掉落）=====
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
  if (remain < 2 && ((p.t * 6) | 0) % 2 === 0) return;
  const x = p.x, y = p.y + bob;
  if (drawSprite(ctx, 'pickup_' + p.kind, x, y, { size: 46 })) return;
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
