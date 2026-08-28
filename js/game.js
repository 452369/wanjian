'use strict';
// ===== 主循环 / 状态机 / 碰撞 / 掉落 / 广告点位 =====

function fitCanvas(g) {
  const w = CFG.view.w, h = CFG.view.h;
  const s = Math.min(innerWidth / w, innerHeight / h);
  const dpr = window.devicePixelRatio || 1;
  g.cv.style.width = Math.floor(w * s) + 'px';
  g.cv.style.height = Math.floor(h * s) + 'px';
  g.cv.width = Math.floor(w * s * dpr);
  g.cv.height = Math.floor(h * s * dpr);
  g.ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
}

// 背景：夜空 + 明月 + 山峦下滚（御剑飞行感）+ 灵尘
class Background {
  constructor() {
    const W = CFG.view.w, H = CFG.view.h;
    const c = document.createElement('canvas');
    c.width = 16; c.height = H;
    const cg = c.getContext('2d');
    const gr = cg.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#070a1c');
    gr.addColorStop(0.5, '#0c1130');
    gr.addColorStop(1, '#181246');
    cg.fillStyle = gr;
    cg.fillRect(0, 0, 16, H);
    this.sky = c;
    this.stars = Array.from({ length: 46 }, () => ({ x: rand(0, W), y: rand(0, H * 0.75), r: rand(0.5, 1.7), tw: rand(0, TAU) }));
    this.peaks = [];
    let y = -100;
    for (let i = 0; i < 7; i++) {
      this.peaks.push({ x: rand(40, W - 40), y, w: rand(190, 330), h: rand(110, 200), far: i % 2 === 0 });
      y -= rand(280, 400);
    }
    this.span = -y + 260;
    this.motes = Array.from({ length: 26 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(40, 110), r: rand(0.6, 1.8) }));
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const W = CFG.view.w;
    for (const p of this.peaks) {
      p.y += (p.far ? 26 : 60) * dt;
      if (p.y - p.h > CFG.view.h + 40) {
        p.y -= this.span;
        p.x = rand(40, W - 40); p.w = rand(190, 330); p.h = rand(110, 200);
      }
    }
    for (const m of this.motes) {
      m.y += m.v * dt;
      if (m.y > CFG.view.h + 4) { m.y = -4; m.x = rand(0, W); }
    }
  }
  draw(ctx) {
    const W = CFG.view.w, H = CFG.view.h;
    // AI 贴图优先：assets/bg_ch1_*.png 存在则用三层视差，否则用程序化夜山
    const sky = Assets.img('bg_ch1_sky');
    if (sky) {
      ctx.drawImage(sky, 0, 0, W, H);
      this.drawStrip(ctx, Assets.img('bg_ch1_far'), 26);
      this.drawStrip(ctx, Assets.img('bg_ch1_near'), 60);
    } else {
      ctx.drawImage(this.sky, 0, 0, 16, H, 0, 0, W, H);
      // 明月
      ctx.globalAlpha = 0.9;
      ctx.drawImage(glowSprite('#f0ead0'), W - 150, 60, 150, 150);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#efe8cf';
      ctx.beginPath(); ctx.arc(W - 75, 135, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,190,160,0.5)';
      ctx.beginPath(); ctx.arc(W - 86, 126, 6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(W - 66, 146, 4, 0, TAU); ctx.fill();
      // 星
      ctx.fillStyle = '#cfd8ff';
      for (const s of this.stars) {
        ctx.globalAlpha = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 1.7 + s.tw));
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
      // 山峦（远慢近快，视差下滚）
      for (const p of this.peaks) {
        ctx.globalAlpha = p.far ? 0.4 : 0.85;
        ctx.fillStyle = p.far ? '#243056' : '#141a38';
        ctx.beginPath();
        ctx.moveTo(p.x - p.w / 2, p.y);
        ctx.lineTo(p.x, p.y - p.h);
        ctx.lineTo(p.x + p.w / 2, p.y);
        ctx.closePath(); ctx.fill();
        if (!p.far) {
          ctx.fillStyle = 'rgba(210,225,255,0.5)';
          ctx.beginPath();
          ctx.moveTo(p.x - p.w * 0.09, p.y - p.h * 0.78);
          ctx.lineTo(p.x, p.y - p.h);
          ctx.lineTo(p.x + p.w * 0.09, p.y - p.h * 0.78);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    // 灵尘（速度感，两条路径都画）
    ctx.fillStyle = 'rgba(150,190,255,0.35)';
    for (const m of this.motes) {
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    }
  }

  // 竖向无缝循环的滚动层（贴图上下边缘做渐变透明即可无缝）
  drawStrip(ctx, img, speed) {
    if (!img) return;
    const W = CFG.view.w, H = CFG.view.h;
    const dh = (img.height / img.width) * W;
    const off = ((this.t * speed) % dh + dh) % dh;
    for (let y = off - dh; y < H; y += dh) {
      ctx.drawImage(img, 0, y, W, dh);
    }
  }
}

class Game {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title';
    this.buttons = [];
    this.bg = new Background();
    this.reset();
    this.lastT = 0;
    Input.init(canvas);
    window.addEventListener('uikey', e => this.onKey(e.detail));
    window.addEventListener('resize', () => fitCanvas(this));
    fitCanvas(this);
    requestAnimationFrame(t => this.loop(t));
  }

  reset() {
    this.player = new Player();
    this.swords = new EntityList(new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 0, crit: false, pierce: 0, life: 0, color: '', trail: [], hits: [] })));
    this.monsters = new EntityList(new Pool(() => new Monster()));
    this.bullets = new EntityList(new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, r: 6 })));
    this.orbs = new EntityList(new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, val: 0, t: 0, attract: false })));
    this.pickups = new EntityList(new Pool(() => ({ x: 0, y: 0, kind: '', t: 0 })));
    this.spawner = new Spawner(this);
    this.time = 0;
    this.kills = 0;
    this.combo = 0; this.comboT = 0; this.comboPop = 0; this.maxCombo = 0;
    this.xp = 0; this.pendingLv = 0; this.upCount = {}; this.options = [];
    this.lastTier = this.player.tier.name;
    this.reviveUsed = false;
    this.doubled = false;
    this.winTimer = 0;
    this.lastGold = 0;
    this.toastMsg = ''; this.toastT = 0;
    this.moveDelta = { x: 0, y: 0 };
    FX.clear();
    Cam.reset();
  }

  // ---- 流程 ----
  startRun() {
    this.reset();
    this.state = 'play';
    FX.showBanner('第一章 · 青云山', '左右拖动走位 · 飞剑自动出鞘');
  }

  onPlayerDead() {
    this.state = 'over';
    FX.flash(0.4, '#801010');
    Cam.shake(8, 0.4);
    AudioSys.boom();
  }

  // 广告点位①：复活
  revive() {
    const P = this.player;
    this.reviveUsed = true;
    P.hp = Math.round(P.stats.maxHp * 0.6);
    P.invuln = 2.2;
    P.shield = Math.max(P.shield, 1);
    this.clearBullets();
    for (const m of this.monsters.list) {
      if (!m.boss && !m.dead && dist2(m.x, m.y, P.x, P.y) < 170 * 170) m.die(this);
    }
    FX.showBanner('仙人指路', '剑心不灭，再战！');
    FX.flash(0.3, '#7dd8ff');
    AudioSys.tierUp();
    this.state = 'play';
  }

  onBossDead(m) {
    this.winTimer = 1.4;
    this.spawnOrbs(m.x, m.y, 60);
    this.spawnPickup(m.x, m.y - 40);
    this.clearBullets();
    FX.flash(0.6);
    Cam.shake(12, 0.8);
    Cam.hitStop(0.12);
    AudioSys.boom();
  }

  // 结算入库：灵石 = 斩妖×2 + 存活秒
  bank(doubled) {
    const gold = Math.round((this.kills * 2 + this.time) * (doubled ? 2 : 1));
    Meta.data.gold += gold;
    Meta.data.bestKills = Math.max(Meta.data.bestKills, this.kills);
    Meta.data.bestCombo = Math.max(Meta.data.bestCombo, this.maxCombo);
    Meta.data.runs++;
    Meta.save();
    this.lastGold = gold;
  }

  // ---- 生成 ----
  spawnSword(x, y, a) {
    this.swords.spawn(s => spawnSwordInit(s, x, y, a, this));
  }
  spawnBullet(x, y, a, spd, dmg) {
    this.bullets.spawn(b => {
      b.x = x; b.y = y;
      b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
      b.life = CFG.bullets.life; b.dmg = dmg; b.r = CFG.bullets.radius;
    });
  }
  spawnMonster(type, opts) {
    const x = opts && opts.x !== undefined ? opts.x : rand(40, CFG.view.w - 40);
    return this.monsters.spawn(m => m.init(type, x, opts || {}));
  }
  spawnOrbs(x, y, val) {
    while (val > 0) {
      const v = Math.min(val, randi(1, 3));
      val -= v;
      this.orbs.spawn(o => {
        o.x = x + rand(-12, 12); o.y = y + rand(-12, 12);
        const a = rand(0, TAU), s = rand(40, 160);
        o.vx = Math.cos(a) * s; o.vy = Math.sin(a) * s;
        o.val = v; o.t = 0; o.attract = false;
      });
    }
  }
  spawnPickup(x, y) {
    this.pickups.spawn(p => {
      p.x = clamp(x, 40, CFG.view.w - 40);
      p.y = clamp(y, 80, CFG.view.h - 80);
      p.kind = choice(CFG.pickups.list);
      p.t = 0;
    });
  }

  nearestMonster(x, y) {
    let best = null, bd = Infinity;
    for (const m of this.monsters.list) {
      if (m.dead) continue;
      const d = dist2(x, y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // ---- 成长 ----
  addKill(m) {
    this.kills++;
    this.combo++;
    this.comboT = CFG.combo.window;
    this.comboPop = 0.15;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
  }

  gainXp(v) {
    this.xp += v;
    let need = CFG.xp.base + this.player.level * CFG.xp.perLv;
    while (this.xp >= need) {
      this.xp -= need;
      this.player.level++;
      this.pendingLv++;
      AudioSys.levelup();
      // 剑品晋升演出
      const t = this.player.tier;
      if (t.name !== this.lastTier) {
        this.lastTier = t.name;
        FX.showBanner('剑品晋升 · ' + t.name, '剑气精进，锋芒更盛');
        FX.flash(0.28, t.color);
        Cam.shake(4, 0.3);
        AudioSys.tierUp();
      }
      need = CFG.xp.base + this.player.level * CFG.xp.perLv;
    }
    if (this.pendingLv > 0) {
      if (this.state !== 'levelup') this.state = 'levelup';
      this.genOptions();
    }
  }

  genOptions() {
    const avail = CFG.upgrades.filter(u => !u.max || (this.upCount[u.id] || 0) < u.max);
    const pool = avail.slice();
    const opts = [];
    while (opts.length < 3 && pool.length) {
      let tw = 0;
      for (const u of pool) tw += u.weight;
      let r = Math.random() * tw, idx = 0;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].weight;
        if (r <= 0) { idx = i; break; }
      }
      opts.push(pool.splice(idx, 1)[0]);
    }
    this.options = opts;
  }

  chooseUpgrade(i) {
    const u = this.options[i];
    if (!u || this.state !== 'levelup') return;
    u.apply(this.player.stats, this.player);
    this.upCount[u.id] = (this.upCount[u.id] || 0) + 1;
    AudioSys.pickup();
    FX.text(this.player.x, this.player.y - 46, u.name + '！', '#ffe9b8', 20);
    this.pendingLv--;
    if (this.pendingLv > 0) this.genOptions();
    else {
      this.state = 'play';
      this.player.invuln = Math.max(this.player.invuln, 0.6); // 选择后短暂无敌，避免读屏时被围殴
    }
  }

  // ---- 拾取道具 ----
  applyPickup(kind) {
    const P = this.player;
    const st = PK_STYLE[kind];
    FX.text(P.x, P.y - 44, st.label, st.color, 20);
    switch (kind) {
      case 'sword2': P.buffs.sword2 = CFG.pickups.dur.sword2; break;
      case 'rage': P.buffs.rage = CFG.pickups.dur.rage; break;
      case 'shield': P.shield = Math.min(2, P.shield + 1); break;
      case 'nova': this.nova(); break;
      case 'vacuum':
        for (const o of this.orbs.list) o.attract = true;
        break;
    }
    Cam.shake(4);
    AudioSys.pickup();
  }

  // 万剑归宗：全屏剑雨清场
  nova() {
    FX.flash(0.45);
    Cam.shake(10, 0.4);
    Cam.hitStop(0.08);
    AudioSys.boom();
    const n = 26;
    for (let i = 0; i < n; i++) {
      this.spawnSword(this.player.x, this.player.y, (i / n) * TAU);
    }
    for (const m of this.monsters.list) {
      if (!m.dead) m.hit(60, false, this);
    }
    this.clearBullets();
  }

  clearBullets() {
    for (const b of this.bullets.list) b.dead = true;
  }

  // ---- 广告点位占位：接微信激励视频时，把 adStub 换成 wx.createRewardedVideoAdapter ----
  adStub(name, cb) {
    this.toast(`【广告位】${name} · 原型直接发放`);
    cb();
  }
  toast(msg) { this.toastMsg = msg; this.toastT = 2.4; }

  // ---- 主循环 ----
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    const dt = Math.min(0.033, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    // 顿帧：冻结世界若干毫秒，但持续渲染（命中定格感）
    let gdt = dt;
    if (Cam.hitStopT > 0) {
      Cam.hitStopT -= dt;
      gdt = 0;
    }
    Cam.update(dt);
    this.update(gdt);
    FX.updateUI(dt);
    this.draw();
  }

  update(dt) {
    // 输入始终消费：暂停期间积压的拖动不清账
    const delta = Input.consumeDelta();
    const taps = Input.takeTaps();
    for (const tp of taps) {
      for (const b of this.buttons) {
        if (tp.x >= b.x && tp.x <= b.x + b.w && tp.y >= b.y && tp.y <= b.y + b.h) {
          AudioSys.click();
          b.cb();
          return;
        }
      }
    }
    if (this.toastT > 0) this.toastT -= dt;
    if (this.comboPop > 0) this.comboPop -= dt;

    if (this.state === 'play') {
      this.time += dt;
      this.moveDelta = delta;
      this.spawner.update(dt);
      this.player.update(dt, this);
      // 飞剑
      for (const s of this.swords.list) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 9) s.trail.shift();
        s.life -= dt;
        if (s.life <= 0 || s.x < -60 || s.x > CFG.view.w + 60 || s.y < -80 || s.y > CFG.view.h + 60) s.dead = true;
      }
      for (const m of this.monsters.list) m.update(dt, this);
      // 敌弹
      for (const b of this.bullets.list) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0 || b.x < -40 || b.x > CFG.view.w + 40 || b.y < -40 || b.y > CFG.view.h + 40) b.dead = true;
      }
      // 灵气吸附与拾取
      const mag = this.player.stats.magnetRadius, mag2 = mag * mag;
      for (const o of this.orbs.list) {
        o.t += dt;
        const d2 = dist2(o.x, o.y, this.player.x, this.player.y);
        if (o.attract || d2 < mag2 || this.orbs.list.length > 60) { // 超量灵气强制回收
          o.attract = true;
          const d = Math.sqrt(d2) || 1;
          o.vx += ((this.player.x - o.x) / d) * 1500 * dt;
          o.vy += ((this.player.y - o.y) / d) * 1500 * dt;
          const sp = Math.hypot(o.vx, o.vy);
          if (sp > 760) { o.vx *= 760 / sp; o.vy *= 760 / sp; }
        } else {
          o.vx *= (1 - 2.5 * dt);
          o.vy = Math.min(o.vy + 60 * dt, 80); // 玩家在固定航道，灵气缓慢下坠便于拾取
        }
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (d2 < 24 * 24) {
          o.dead = true;
          this.gainXp(o.val);
          AudioSys.pickup();
        }
      }
      // 道具下落与拾取（下落速度足够抵达玩家航道）
      for (const p of this.pickups.list) {
        p.t += dt;
        p.y += 90 * dt;
        if (p.t > CFG.pickups.life) p.dead = true;
        else if (hitCircle(p.x, p.y, 24, this.player.x, this.player.y, this.player.r)) {
          p.dead = true;
          this.applyPickup(p.kind);
        }
      }
      this.collide();
      // 连击窗口
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }
      this.bg.update(dt);
      this.swords.sweep(); this.monsters.sweep(); this.bullets.sweep();
      this.orbs.sweep(); this.pickups.sweep();
    } else {
      this.bg.update(dt);
    }
    // Boss 死亡 → 胜利演出缓冲（升级面板冻结世界时也要走到胜利，避免被灵气升级卡住）
    if ((this.state === 'play' || this.state === 'levelup') && this.winTimer > 0) {
      this.winTimer -= dt;
      if (this.winTimer <= 0) {
        this.state = 'win';
        this.bank(false);
      }
    }
    FX.update(this.state === 'play' ? dt : Math.min(dt, 0.033));
  }

  collide() {
    const P = this.player;
    // 飞剑 × 妖兽（带贯穿）
    for (const s of this.swords.list) {
      if (s.dead) continue;
      for (const m of this.monsters.list) {
        if (m.dead || s.hits.includes(m.id)) continue;
        if (hitCircle(s.x, s.y, 10, m.x, m.y, m.r)) {
          m.hit(s.dmg, s.crit, this, s.x, s.y);
          if (s.pierce > 0) {
            s.pierce--;
            s.hits.push(m.id);
          } else {
            s.dead = true;
            break;
          }
        }
      }
    }
    // 妖兽 × 玩家（接触伤害）
    if (P.invuln <= 0) {
      for (const m of this.monsters.list) {
        if (!m.dead && hitCircle(m.x, m.y, m.r * 0.85, P.x, P.y, P.r)) {
          P.hurt(m.dmg, this);
          break;
        }
      }
    }
    // 敌弹 × 玩家
    if (P.invuln <= 0) {
      for (const b of this.bullets.list) {
        if (!b.dead && hitCircle(b.x, b.y, b.r, P.x, P.y, P.r)) {
          b.dead = true;
          P.hurt(b.dmg, this);
          if (P.invuln > 0) break;
        }
      }
    }
  }

  draw() {
    const ctx = this.ctx, W = CFG.view.w, H = CFG.view.h;
    this.buttons.length = 0;
    this.bg.draw(ctx);
    ctx.save();
    ctx.translate(Cam.ox, Cam.oy); // 震屏只作用于世界层
    // 道具 → 灵气 → 妖兽 → 敌弹 → 玩家 → 飞剑 → 粒子
    for (const p of this.pickups.list) drawPickup(ctx, p);
    for (const o of this.orbs.list) {
      if (drawSprite(ctx, 'orb_spirit', o.x, o.y, { size: 16 })) continue;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(glowSprite('#54e8c0'), o.x - 8, o.y - 8, 16, 16);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#bfffe8';
      ctx.beginPath(); ctx.arc(o.x, o.y, 2.8, 0, TAU); ctx.fill();
    }
    for (const m of this.monsters.list) m.draw(ctx, this);
    for (const b of this.bullets.list) {
      if (drawSprite(ctx, 'bullet_enemy', b.x, b.y, { size: 22 })) continue;
      ctx.drawImage(glowSprite('#ff6a4a'), b.x - 9, b.y - 9, 18, 18);
      ctx.fillStyle = '#ffd0b0';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill();
    }
    if (this.state !== 'over' || this.player.hp > 0) this.player.draw(ctx);
    for (const s of this.swords.list) drawSword(ctx, s);
    FX.draw(ctx);
    ctx.restore();
    Screens.drawUI(this);
    FX.drawScreenFx(ctx, W, H, this.state);
  }

  onKey(k) {
    if (this.state === 'title' && (k === 'Enter' || k === ' ')) this.startRun();
    else if (this.state === 'levelup' && ['1', '2', '3'].includes(k)) {
      const i = +k - 1;
      if (this.options[i]) this.chooseUpgrade(i);
    }
    else if (this.state === 'over' && (k === 'Enter' || k === ' ')) {
      this.bank(false);
      this.startRun();
    }
    else if (this.state === 'win' && (k === 'Enter' || k === ' ')) this.startRun();
  }
}

window.addEventListener('load', () => {
  Assets.preload(); // 拉取 assets/ 下的 AI 贴图（缺失自动回退程序化造型）
  const g = new Game(document.getElementById('cv'));
  window.game = g; // 调试钩子：控制台可用 game.gainXp(500) / game.spawner.time = 139 等
});
