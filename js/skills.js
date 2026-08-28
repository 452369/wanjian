'use strict';
// ===== 技能系统：被动加成 / 主动技能行为 / 三选一抽卡 =====
// 主动技能由冷却驱动全自动释放；所有范围/数量/伤害受被动加成（player.eff）影响
const Skills = {
  // 重算被动加成
  recompute(p) {
    const s = p.skills;
    p.eff = {
      dmgMul: 1 + 0.15 * (s.jianxin || 0),
      cdMul: Math.max(0.55, 1 - 0.06 * (s.xunjie || 0)),
      speed: CFG.player.speed * (1 + 0.08 * (s.xunjie || 0)),
      projBonus: s.jianying || 0,
      areaMul: 1 + 0.12 * (s.zongheng || 0),
      regen: 0.004 * (s.changsheng || 0), // 每秒回复最大生命百分比
      pickupR: CFG.player.magnetRadius * (1 + 0.25 * (s.xiling || 0)),
      critRate: CFG.crit.rate + 0.05 * (s.huixin || 0),
      critMult: CFG.crit.mult + 0.15 * (s.huixin || 0),
    };
  },

  def(id) {
    return CFG.skills.actives.find(d => d.id === id) || CFG.skills.passives.find(d => d.id === id);
  },

  // 三选一：未满级技能混合池，已持有的更容易再出（引导养成线）
  rollOptions(p) {
    const pool = [];
    for (const d of [...CFG.skills.actives, ...CFG.skills.passives]) {
      const lv = p.skills[d.id] || 0;
      if (lv >= d.max) continue;
      pool.push({ def: d, next: lv + 1, isNew: lv === 0, weight: lv > 0 ? 14 : 10 });
    }
    const opts = [];
    while (opts.length < 3 && pool.length) {
      let tw = 0;
      for (const o of pool) tw += o.weight;
      let r = Math.random() * tw, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break; } }
      opts.push(pool.splice(idx, 1)[0]);
    }
    return opts;
  },

  apply(p, id) {
    p.skills[id] = (p.skills[id] || 0) + 1;
    this.recompute(p);
  },

  // ===== 主动技能驱动（每帧）=====
  update(dt, game) {
    const p = game.player, s = p.skills, e = p.eff;
    const rageCd = p.buffs.rage ? 0.5 : 1;

    // 御剑术：扇形齐射索敌
    p.cdYujian = (p.cdYujian || 0) - dt;
    if ((s.yujian || 0) > 0 && p.cdYujian <= 0) {
      p.cdYujian = CFG.sword.cooldown * e.cdMul * rageCd;
      const count = Math.min(10, s.yujian + e.projBonus + (p.buffs.sword2 ? 2 : 0));
      const m = game.nearestMonster(p.x, p.y, 640);
      const base = m ? Math.atan2(m.y - p.y, m.x - p.x) : Math.atan2(p.face.y, p.face.x);
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * 0.14;
        game.spawnSword(p.x, p.y - 10, a);
      }
      if (count > 2) AudioSys.shoot();
    }

    // 剑气斩：扇形穿透剑气波
    p.cdJianqi = (p.cdJianqi || 0) - dt;
    if ((s.jianqi || 0) > 0 && p.cdJianqi <= 0) {
      const lv = s.jianqi;
      p.cdJianqi = (2.6 - 0.18 * lv) * e.cdMul * rageCd;
      const count = 1 + Math.floor(lv / 2) + Math.min(2, e.projBonus);
      const m = game.nearestMonster(p.x, p.y, 560);
      const base = m ? Math.atan2(m.y - p.y, m.x - p.x) : Math.atan2(p.face.y, p.face.x);
      for (let i = 0; i < count; i++) {
        game.spawnWave(p.x, p.y, base + (i - (count - 1) / 2) * 0.3, {
          speed: 470, dmg: (14 + 8 * lv) * e.dmgMul, r: 26 * e.areaMul, color: p.tier.color,
        });
      }
      AudioSys.shoot();
    }

    // 天雷诀：随机敌人头顶落紫雷
    p.cdTianlei = (p.cdTianlei || 0) - dt;
    if ((s.tianlei || 0) > 0 && p.cdTianlei <= 0) {
      const lv = s.tianlei;
      p.cdTianlei = (3.2 - 0.2 * lv) * e.cdMul;
      let strikes = lv + 1;
      const cand = game.monsters.list.filter(m => !m.dead && dist2(m.x, m.y, p.x, p.y) < 480 * 480 * e.areaMul);
      for (let i = cand.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
      for (let i = 0; i < Math.min(strikes, cand.length); i++) {
        game.strike(cand[i].x, cand[i].y, 62 * e.areaMul, (26 + 14 * lv) * e.dmgMul, '#c07aff');
      }
    }

    // 万剑归宗：周期剑雨轰炸四周
    p.cdWanjian = (p.cdWanjian || 0) - dt;
    if ((s.wanjian || 0) > 0 && p.cdWanjian <= 0) {
      const lv = s.wanjian;
      p.cdWanjian = (11 - 0.9 * lv) * e.cdMul;
      const strikes = 5 + 3 * lv;
      const R = 300 * e.areaMul;
      FX.flash(0.18, p.tier.color);
      for (let i = 0; i < strikes; i++) {
        const a = rand(0, TAU), d = rand(40, R);
        game.strike(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 55 * e.areaMul, (22 + 10 * lv) * e.dmgMul, p.tier.color);
      }
      Cam.shake(6, 0.3);
      AudioSys.boom();
    }

    // 环绕飞剑：绕体旋转，接触伤害（每怪独立冷却）
    if ((s.huanrao || 0) > 0) {
      p.orbitA = (p.orbitA || 0) + dt * 3.2;
      const count = s.huanrao + 1 + Math.floor(e.projBonus / 2);
      const R = (66 + 6 * s.huanrao) * e.areaMul;
      p.orbPos = [];
      for (let i = 0; i < count; i++) {
        const a = p.orbitA + (i / count) * TAU;
        p.orbPos.push({ x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R });
      }
      const dmg = (10 + 6 * s.huanrao) * e.dmgMul;
      for (const m of game.monsters.list) {
        if (m.dead) continue;
        m.orbCd = (m.orbCd || 0) - dt;
        if (m.orbCd > 0) continue;
        for (const o of p.orbPos) {
          if (hitCircle(o.x, o.y, 16, m.x, m.y, m.r)) {
            m.hit(dmg, false, game, o.x, o.y);
            m.orbCd = 0.45;
            break;
          }
        }
      }
    } else p.orbPos = null;

    // 剑域罡气：周身领域周期灼烧
    if ((s.jianyu || 0) > 0) {
      p.auraR = (80 + 14 * s.jianyu) * e.areaMul;
      p.auraTick = (p.auraTick || 0) - dt;
      if (p.auraTick <= 0) {
        p.auraTick = 0.5;
        game.areaDamage(p.x, p.y, p.auraR, (7 + 5 * s.jianyu) * e.dmgMul, { silent: true, color: p.tier.color });
      }
    } else p.auraR = 0;

    // 长生诀：持续回复
    if (e.regen > 0 && p.hp > 0) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * e.regen * dt);
  },

  // 世界层绘制：光环 / 环绕剑 / 剑气波 / 落雷光柱
  drawWorld(ctx, game) {
    const p = game.player;
    if (p.auraR) {
      ctx.globalAlpha = 0.09 + 0.05 * Math.sin(game.time * 5);
      ctx.fillStyle = p.tier.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.auraR, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = p.tier.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.auraR, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.orbPos) {
      for (const o of p.orbPos) {
        const a = Math.atan2(o.y - p.y, o.x - p.x);
        if (drawSprite(ctx, 'sword_tier' + p.tierIndex, o.x, o.y, { size: 44, angle: a + Math.PI / 2 })) continue;
        ctx.save();
        ctx.translate(o.x, o.y); ctx.rotate(a + Math.PI / 2);
        drawBlade(ctx, 0, 0, 30, p.tier.color);
        ctx.restore();
      }
    }
    for (const w of game.waves.list) {
      ctx.save();
      ctx.translate(w.x, w.y); ctx.rotate(w.dir);
      ctx.globalAlpha = clamp(w.life / 0.35, 0, 1) * 0.9;
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.arc(0, 0, w.r, -1.1, 1.1);
      ctx.arc(0, 0, w.r * 0.55, 1.1, -1.1, true);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const b of game.bolts.list) {
      const a = clamp(b.t / b.max, 0, 1);
      ctx.globalAlpha = a * 0.75;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.w / 2, b.y - 560, b.w, 560);
      ctx.globalAlpha = a * 0.35;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.4, 0, TAU); ctx.fill();
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1.5 - 0.5 * a), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};
