'use strict';
// ===== 主循环 / 摄像机 / 无限地图 / 碰撞 / 经济 / 广告点位（Survivor 化）=====

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

// 确定性二维哈希：地图装饰走远再走回来位置不变
function hash2(x, y) {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n >>> 0) / 4294967295;
}

// ===== 无限地面：无缝地砖贴图（或程序化石板）+ 哈希撒点装饰件 =====
class Ground {
  draw(ctx, game) {
    const cam = game.cam, W = CFG.view.w, H = CFG.view.h;
    const T = CFG.ground.tile;
    const left = cam.x - W / 2, top = cam.y - H / 2;
    const gx0 = Math.floor(left / T), gx1 = Math.floor((left + W) / T);
    const gy0 = Math.floor(top / T), gy1 = Math.floor((top + H) / T);
    const tileImg = Assets.img('tile_ch1');
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const sx = gx * T, sy = gy * T;
        if (tileImg) {
          ctx.drawImage(tileImg, sx, sy, T, T);
        } else {
          const hs = hash2(gx, gy);
          ctx.fillStyle = hs > 0.5 ? '#161d33' : '#131929';
          ctx.fillRect(sx, sy, T, T);
          ctx.strokeStyle = 'rgba(255,255,255,0.03)';
          ctx.strokeRect(sx + 0.5, sy + 0.5, T - 1, T - 1);
          if (hs > 0.8) { // 苔藓斑
            ctx.fillStyle = 'rgba(70,120,90,0.25)';
            ctx.beginPath(); ctx.arc(sx + T * (0.2 + hs * 0.5), sy + T * 0.7, 7, 0, TAU); ctx.fill();
          }
        }
      }
    }
    // 装饰件：大格撒点
    const DC = CFG.ground.decoCell;
    const dx0 = Math.floor(left / DC) - 1, dx1 = Math.floor((left + W) / DC) + 1;
    const dy0 = Math.floor(top / DC) - 1, dy1 = Math.floor((top + H) / DC) + 1;
    const names = ['deco_lantern', 'deco_bamboo', 'deco_stele', 'deco_incense', 'deco_jar'];
    for (let cy = dy0; cy <= dy1; cy++) {
      for (let cx = dx0; cx <= dx1; cx++) {
        const hs = hash2(cx * 7 + 3, cy * 13 + 5);
        if (hs > 0.24) continue;
        const wx = cx * DC + hash2(cx + 31, cy + 17) * DC;
        const wy = cy * DC + hash2(cx + 53, cy + 71) * DC;
        const kind = Math.floor(hash2(cx + 91, cy + 37) * 5);
        if (drawSprite(ctx, names[kind], wx, wy, { size: 92 })) continue;
        this.decoProcedural(ctx, kind, wx, wy, hs);
      }
    }
  }

  // 无贴图时的程序化装饰兜底
  decoProcedural(ctx, kind, x, y, hs) {
    switch (kind) {
      case 0: // 石灯笼
        ctx.fillStyle = '#3a4258'; ctx.fillRect(x - 10, y - 16, 20, 26);
        ctx.fillStyle = '#2a3044'; ctx.fillRect(x - 14, y + 8, 28, 6);
        ctx.fillStyle = '#ffd75a'; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(x, y - 4, 4, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 1: // 竹丛
        ctx.strokeStyle = '#3e7a52'; ctx.lineWidth = 3;
        for (const o of [-6, 0, 7]) {
          ctx.beginPath(); ctx.moveTo(x + o, y + 14); ctx.lineTo(x + o * 1.4, y - 18); ctx.stroke();
        }
        ctx.fillStyle = '#4e8a5e';
        ctx.beginPath(); ctx.ellipse(x, y - 20, 12, 5, 0.3, 0, TAU); ctx.fill();
        break;
      case 2: // 石碑
        ctx.fillStyle = '#39415a'; ctx.fillRect(x - 9, y - 22, 18, 34);
        ctx.fillStyle = '#2c3247'; ctx.fillRect(x - 13, y + 10, 26, 6);
        break;
      case 3: // 香炉
        ctx.fillStyle = '#4a4436';
        ctx.beginPath(); ctx.ellipse(x, y, 12, 8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(150,190,200,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x + 5, y - 18, x, y - 30); ctx.stroke();
        break;
      default: // 酒坛
        ctx.fillStyle = '#5a4632';
        ctx.beginPath(); ctx.ellipse(x, y, 10, 13, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a3a3a'; ctx.fillRect(x - 5, y - 17, 10, 6);
        break;
    }
    if (hs < 0.06) { // 碎石
      ctx.fillStyle = 'rgba(120,140,170,0.3)';
      ctx.beginPath(); ctx.ellipse(x + 26, y + 18, 6, 4, hs * 6, 0, TAU); ctx.fill();
    }
  }
}

class Game {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title';
    this.buttons = [];
    this.ground = new Ground();
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
    Skills.recompute(this.player);
    this.swords = new EntityList(new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 0, crit: false, life: 0, color: '', tier: 0, trail: [], hits: [] })));
    this.waves = new EntityList(new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, dir: 0, r: 24, dmg: 0, life: 0, color: '', hits: [] })));
    this.bolts = new EntityList(new Pool(() => ({ x: 0, y: 0, r: 40, w: 12, color: '#c07aff', t: 0, max: 0.28 })));
    this.monsters = new EntityList(new Pool(() => new Monster()));
    this.bullets = new EntityList(new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, r: 6 })));
    this.pickups = new EntityList(new Pool(() => ({ x: 0, y: 0, kind: '', t: 0 })));
    this.spawner = new Spawner(this);
    this.cam = { x: 0, y: 0 };
    this.time = 0;
    this.kills = 0;
    this.gold = 0;
    this.killsProg = 0; // 本级已击杀数（击杀直接涨级）
    this.combo = 0; this.comboT = 0; this.comboPop = 0; this.maxCombo = 0;
    this.pendingLv = 0; this.options = [];
    this.reviveUsed = false;
    this.doubled = false;
    this.winTimer = 0;
    this.lastGold = 0;
    this.toastMsg = ''; this.toastT = 0;
    FX.clear();
    Cam.reset();
  }

  // ---- 流程 ----
  startRun() {
    this.reset();
    this.state = 'play';
    FX.showBanner('第一章 · 青云山', '摇杆走位 · 技能全自动');
  }

  onPlayerDead() {
    this.state = 'over';
    FX.flash(0.4, '#801010');
    Cam.shake(8, 0.4);
    AudioSys.boom();
  }

  revive() {
    const P = this.player;
    this.reviveUsed = true;
    P.hp = Math.round(P.stats.maxHp * 0.6);
    P.invuln = 2.2;
    P.shield = Math.max(P.shield, 1);
    this.clearBullets();
    for (const m of this.monsters.list) {
      if (!m.boss && !m.dead && dist2(m.x, m.y, P.x, P.y) < 200 * 200) m.die(this);
    }
    FX.showBanner('仙人指路', '剑心不灭，再战！');
    FX.flash(0.3, '#7dd8ff');
    AudioSys.tierUp();
    this.state = 'play';
  }

  onBossDead(m) {
    this.winTimer = 1.4;
    this.spawnPickup(m.x, m.y - 40);
    this.clearBullets();
    FX.flash(0.6);
    Cam.shake(12, 0.8);
    Cam.hitStop(0.12);
    AudioSys.boom();
  }

  bank(doubled) {
    const gold = Math.round(this.gold * (doubled ? 2 : 1));
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
  spawnWave(x, y, a, o) {
    this.waves.spawn(w => {
      w.x = x; w.y = y;
      w.vx = Math.cos(a) * o.speed; w.vy = Math.sin(a) * o.speed;
      w.dir = a; w.r = o.r; w.dmg = Math.round(o.dmg);
      w.life = 1.1; w.color = o.color;
      w.hits.length = 0;
    });
  }
  spawnBullet(x, y, a, spd, dmg) {
    this.bullets.spawn(b => {
      b.x = x; b.y = y;
      b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
      b.life = CFG.bullets.life; b.dmg = dmg; b.r = CFG.bullets.radius;
    });
  }
  spawnMonster(type, opts) {
    const p = this.player;
    const o = opts || {};
    const a = o.angle !== undefined ? o.angle : rand(0, TAU);
    const R = Math.max(CFG.view.w, CFG.view.h) / 2 + CFG.spawn.ringPad
            + (o.distJitter !== undefined ? o.distJitter : rand(0, 110));
    const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
    return this.monsters.spawn(m => m.init(type, x, y, o));
  }
  spawnPickup(x, y) {
    this.pickups.spawn(p => {
      p.x = x; p.y = y;
      p.kind = choice(CFG.pickups.list);
      p.t = 0;
    });
  }

  nearestMonster(x, y, maxDist = Infinity) {
    let best = null, bd = maxDist * maxDist;
    for (const m of this.monsters.list) {
      if (m.dead) continue;
      const d = dist2(x, y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // 范围伤害（天雷/剑雨/剑域）
  areaDamage(x, y, r, dmg, opts = {}) {
    for (const m of this.monsters.list) {
      if (m.dead) continue;
      if (hitCircle(x, y, r, m.x, m.y, m.r)) m.hit(dmg, false, this, m.x, m.y, opts.silent);
    }
  }

  // 落雷/剑雨：光柱视觉 + 范围伤害
  strike(x, y, r, dmg, color) {
    this.bolts.spawn(b => {
      b.x = x; b.y = y; b.r = r;
      b.w = rand(10, 14); b.color = color;
      b.t = b.max = 0.28;
    });
    this.areaDamage(x, y, r, dmg);
    Cam.shake(2, 0.12);
  }

  // ---- 成长 ----
  addKill(m) {
    this.kills++;
    this.gold += m.cfg.gold || 1;
    this.combo++;
    this.comboT = CFG.combo.window;
    this.comboPop = 0.15;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.addKillProgress(1);
  }

  // 击杀直接涨级（无经验球）：加击杀进度并尝试突破
  addKillProgress(n) {
    this.killsProg += n;
    let need = CFG.levelup.base + (this.player.level - 1) * CFG.levelup.per;
    while (this.killsProg >= need) {
      this.killsProg -= need;
      if (this.winTimer > 0) { this.gold += 10; continue; } // 胜利演出期间折灵石
      this.player.level++;
      this.pendingLv++;
      AudioSys.levelup();
      FX.ring(this.player.x, this.player.y, this.player.tier.color, 24, 340); // 升级脉冲
      const t = this.player.tier;
      if (t.name !== this.lastTier) {
        this.lastTier = t.name;
        FX.showBanner('剑品晋升 · ' + t.name, '剑气精进，锋芒更盛');
        FX.flash(0.28, t.color);
        Cam.shake(4, 0.3);
        AudioSys.tierUp();
      }
      need = CFG.levelup.base + (this.player.level - 1) * CFG.levelup.per;
    }
    if (this.pendingLv > 0 && this.state === 'play') {
      this.options = Skills.rollOptions(this.player);
      if (!this.options.length) { // 技能全满：转化为灵石
        this.pendingLv = 0;
        this.gold += 15;
        this.toast('技能已全满 · 转化灵石 +15');
      } else {
        this.state = 'levelup';
      }
    }
  }

  chooseUpgrade(i) {
    const opt = this.options[i];
    if (!opt || this.state !== 'levelup') return;
    Skills.apply(this.player, opt.def.id);
    AudioSys.pickup();
    FX.text(this.player.x, this.player.y - 46, opt.def.name + '！', '#ffe9b8', 20);
    this.pendingLv--;
    if (this.pendingLv > 0) {
      this.options = Skills.rollOptions(this.player);
      if (!this.options.length) {
        this.pendingLv = 0;
        this.gold += 15;
        this.toast('技能已全满 · 转化灵石 +15');
        this.state = 'play';
      }
    } else {
      this.state = 'play';
      this.player.invuln = Math.max(this.player.invuln, 0.6);
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
    }
    Cam.shake(4);
    AudioSys.pickup();
  }

  nova() { // 万剑归宗爆发：全屏剑雨
    FX.flash(0.45);
    Cam.shake(10, 0.4);
    Cam.hitStop(0.08);
    AudioSys.boom();
    for (let i = 0; i < 26; i++) {
      this.spawnSword(this.player.x, this.player.y, (i / 26) * TAU);
    }
    this.areaDamage(this.player.x, this.player.y, 9999, 60, { silent: true });
    this.clearBullets();
  }

  clearBullets() { for (const b of this.bullets.list) b.dead = true; }

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
    let gdt = dt;
    if (Cam.hitStopT > 0) { Cam.hitStopT -= dt; gdt = 0; } // 顿帧：世界冻结数帧
    Cam.update(dt);
    this.update(gdt);
    FX.updateUI(dt);
    this.draw();
  }

  update(dt) {
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
      this.cam.x = this.player.x; // 摄像机跟随玩家
      this.cam.y = this.player.y;
      this.spawner.update(dt);
      this.player.update(dt, this);
      // 飞剑
      for (const s of this.swords.list) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 9) s.trail.shift();
        s.life -= dt;
        if (s.life <= 0 || dist2(s.x, s.y, this.player.x, this.player.y) > 1100 * 1100) s.dead = true;
      }
      // 剑气波
      for (const w of this.waves.list) {
        w.x += w.vx * dt; w.y += w.vy * dt;
        w.life -= dt;
        if (w.life <= 0) w.dead = true;
      }
      // 光柱
      for (const b of this.bolts.list) { b.t -= dt; if (b.t <= 0) b.dead = true; }
      // 妖兽
      for (const m of this.monsters.list) m.update(dt, this);
      this.separate();
      // 敌弹
      for (const b of this.bullets.list) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0 || dist2(b.x, b.y, this.player.x, this.player.y) > 950 * 950) b.dead = true;
      }
      // 道具
      for (const p of this.pickups.list) {
        p.t += dt;
        if (p.t > CFG.pickups.life) p.dead = true;
        else if (hitCircle(p.x, p.y, 26, this.player.x, this.player.y, this.player.r)) {
          p.dead = true;
          this.applyPickup(p.kind);
        }
      }
      this.collide();
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }
      this.swords.sweep(); this.waves.sweep(); this.bolts.sweep();
      this.monsters.sweep(); this.bullets.sweep(); this.pickups.sweep();
    }
    // Boss 死亡 → 胜利演出（升级面板冻结世界时也要走到胜利，避免被掉落升级卡住）
    if ((this.state === 'play' || this.state === 'levelup') && this.winTimer > 0) {
      this.winTimer -= dt;
      if (this.winTimer <= 0) { this.state = 'win'; this.bank(false); }
    }
    FX.update(this.state === 'play' ? dt : Math.min(dt, 0.033));
  }

  // 怪物两两分离，避免叠成一团
  separate() {
    const ms = this.monsters.list;
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        const a = ms[i], b = ms[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = (a.r + b.r) * 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < rr * rr) {
          const d = Math.sqrt(d2), push = (rr - d) / d * 0.5;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }
  }

  collide() {
    const P = this.player;
    // 飞剑 × 妖兽
    for (const s of this.swords.list) {
      if (s.dead) continue;
      for (const m of this.monsters.list) {
        if (m.dead || s.hits.includes(m.id)) continue;
        if (hitCircle(s.x, s.y, 12, m.x, m.y, m.r)) {
          m.hit(s.dmg, s.crit, this, s.x, s.y);
          s.dead = true;
          break;
        }
      }
    }
    // 剑气波 × 妖兽（穿透）
    for (const w of this.waves.list) {
      if (w.dead) continue;
      for (const m of this.monsters.list) {
        if (m.dead || w.hits.includes(m.id)) continue;
        if (hitCircle(w.x, w.y, w.r, m.x, m.y, m.r)) {
          m.hit(w.dmg, false, this, w.x, w.y);
          w.hits.push(m.id);
        }
      }
    }
    // 妖兽 × 玩家
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
    ctx.save();
    ctx.translate(W / 2 - this.cam.x + Cam.ox, H / 2 - this.cam.y + Cam.oy); // 摄像机 + 震屏
    this.ground.draw(ctx, this);
    for (const p of this.pickups.list) drawPickup(ctx, p);
    for (const m of this.monsters.list) m.draw(ctx, this);
    for (const b of this.bullets.list) {
      if (drawSprite(ctx, 'bullet_enemy', b.x, b.y, { size: 22 })) continue;
      ctx.drawImage(glowSprite('#ff6a4a'), b.x - 9, b.y - 9, 18, 18);
      ctx.fillStyle = '#ffd0b0';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill();
    }
    if (this.state !== 'over' || this.player.hp > 0) this.player.draw(ctx);
    for (const s of this.swords.list) drawSword(ctx, s);
    Skills.drawWorld(ctx, this);
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
  window.__VER = 'v0.2.2-swarm'; // 调试：核实浏览器加载的是最新代码
  Assets.preload();
  const g = new Game(document.getElementById('cv'));
  window.game = g; // 调试钩子：game.player.level=20 / game.spawner.time = 149 / 泵帧 game.update(1/60)
});
