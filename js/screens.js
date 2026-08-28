'use strict';
// ===== 界面与 HUD：标题 / 战斗HUD(计时/等级/金币/技能栏/摇杆) / 技能三选一 / 失败 / 胜利 =====
const Fonts = {
  title: '"KaiTi","STKaiti","Noto Serif SC","SimSun",serif',
  ui: '"Microsoft YaHei","PingFang SC",sans-serif',
};

const Screens = {
  btn(g, x, y, w, h, label, cb, opts = {}) {
    const ctx = g.ctx;
    rr(ctx, x, y, w, h, 12);
    ctx.fillStyle = opts.fill || 'rgba(28,36,66,0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = opts.stroke || '#c9a45a';
    ctx.stroke();
    ctx.fillStyle = opts.color || '#ffe9b8';
    ctx.font = `bold ${opts.size || 22}px ${Fonts.ui}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    g.buttons.push({ x, y, w, h, cb });
  },

  drawUI(g) {
    const ctx = g.ctx, W = CFG.view.w, H = CFG.view.h;
    ctx.textBaseline = 'alphabetic';
    switch (g.state) {
      case 'title': this.title(g); break;
      case 'play': this.hud(g); break;
      case 'levelup': this.hud(g); this.levelup(g); break;
      case 'over': this.over(g); break;
      case 'win': this.win(g); break;
    }
    this.toast(g);
    // 静音按钮（常驻右上）
    const mx = W - 26, my = 24;
    ctx.beginPath(); ctx.arc(mx, my, 15, 0, TAU);
    ctx.fillStyle = 'rgba(10,14,30,0.7)'; ctx.fill();
    ctx.strokeStyle = '#5a6a9a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = AudioSys.muted ? '#5a6a9a' : '#cfe8ff';
    ctx.font = `13px ${Fonts.ui}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('音', mx, my + 1);
    if (AudioSys.muted) {
      ctx.strokeStyle = '#ff6a6a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx - 9, my - 9); ctx.lineTo(mx + 9, my + 9); ctx.stroke();
    }
    ctx.textBaseline = 'alphabetic';
    g.buttons.push({ x: mx - 16, y: my - 16, w: 32, h: 32, cb: () => { AudioSys.init(); AudioSys.toggle(); } });
  },

  // ---- 标题 ----
  title(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.textAlign = 'center';
    const grad = ctx.createLinearGradient(0, 300, 0, 380);
    grad.addColorStop(0, '#ffe9b8'); grad.addColorStop(1, '#c9a45a');
    ctx.fillStyle = grad;
    ctx.font = `bold 84px ${Fonts.title}`;
    ctx.shadowColor = 'rgba(201,164,90,0.6)'; ctx.shadowBlur = 24;
    ctx.fillText('万剑归宗', W / 2, 366);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `19px ${Fonts.ui}`;
    ctx.fillText('万妖围城 · 剑气自动 · 走位生存', W / 2, 412);
    ctx.fillStyle = '#5a6a9a';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText(`灵石 ${Meta.data.gold} · 最佳斩妖 ${Meta.data.bestKills} · 最高连斩 ${Meta.data.bestCombo}`, W / 2, 446);
    this.btn(g, W / 2 - 130, 600, 260, 66, '开 始 斩 妖', () => g.startRun(), { size: 26 });
    ctx.fillStyle = '#5a6a9a';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText('按住任意位置拖动 = 摇杆走位', W / 2, 756);
    ctx.fillText('桌面调试：WASD 移动 · 回车开始 · 123 选技能', W / 2, 780);
  },

  // ---- 战斗 HUD ----
  hud(g) {
    const ctx = g.ctx, W = CFG.view.w, H = CFG.view.h, P = g.player;
    // 升级进度条（击杀直接涨级）
    const need = CFG.levelup.base + (P.level - 1) * CFG.levelup.per;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 8);
    ctx.fillStyle = P.tier.color;
    ctx.fillRect(0, 0, W * clamp(g.killsProg / need, 0, 1), 8);
    // 等级与剑品
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfe8ff';
    ctx.font = `bold 16px ${Fonts.ui}`;
    ctx.fillText(`Lv.${P.level} ${P.tier.name}`, 12, 24);
    // 血条
    rr(ctx, 12, 34, 150, 12, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    if (P.hp > 0) {
      rr(ctx, 13, 35, 148 * clamp(P.hp / P.stats.maxHp, 0, 1), 10, 5);
      ctx.fillStyle = P.hp / P.stats.maxHp > 0.3 ? '#e85a6b' : '#ff2222'; ctx.fill();
    }
    ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 1;
    rr(ctx, 12, 34, 150, 12, 6); ctx.stroke();
    // buff 图标
    let bx = 16;
    const icons = [];
    if (P.buffs.sword2) icons.push({ ch: '剑', c: '#ffd75a', t: P.buffs.sword2 });
    if (P.buffs.rage) icons.push({ ch: '狂', c: '#ff7a4a', t: P.buffs.rage });
    if (P.shield > 0) icons.push({ ch: '盾', c: '#6fd8ff', t: null });
    for (const ic of icons) {
      ctx.beginPath(); ctx.arc(bx + 11, 62, 11, 0, TAU);
      ctx.fillStyle = 'rgba(8,12,28,0.8)'; ctx.fill();
      ctx.strokeStyle = ic.c; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = ic.c;
      ctx.font = `bold 11px ${Fonts.ui}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ic.ch, bx + 11, 63);
      ctx.textBaseline = 'alphabetic';
      if (ic.t !== null) {
        ctx.fillStyle = '#8fa3d8';
        ctx.font = `10px ${Fonts.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(ic.t) + 's', bx + 11, 84);
      }
      bx += ic.t !== null ? 30 : 26;
    }
    // 正计时（顶部中央）
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold 22px ${Fonts.ui}`;
    ctx.fillText(fmtTime(g.time), W / 2, 28);
    // 金币 / 斩妖（右上，给静音钮让位）
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd75a';
    ctx.font = `bold 16px ${Fonts.ui}`;
    ctx.fillText(`金 ${g.gold}`, W - 48, 24);
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText(`斩妖 ${g.kills}`, W - 48, 46);
    // Boss 血条
    const boss = g.monsters.list.find(m => m.boss && !m.dead);
    if (boss) {
      const bw = 380, bxx = (W - bw) / 2, byy = 78;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bxx, byy, bw, 12);
      ctx.fillStyle = boss.phase === 2 ? '#ff3030' : '#c03050';
      ctx.fillRect(bxx + 1, byy + 1, (bw - 2) * clamp(boss.hp / boss.maxHp, 0, 1), 10);
      ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 1;
      ctx.strokeRect(bxx, byy, bw, 12);
      ctx.fillStyle = '#ffe9b8';
      ctx.font = `12px ${Fonts.ui}`;
      ctx.textAlign = 'center';
      ctx.fillText(boss.name + (boss.phase === 2 ? ' · 狂暴' : ''), W / 2, byy - 4);
    }
    // 连击
    if (g.combo >= 3) {
      const pop = g.comboPop > 0 ? 1 + g.comboPop * 1.6 : 1;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#ffd75a';
      ctx.font = `bold ${Math.round((24 + Math.min(g.combo, 30) * 0.5) * pop)}px ${Fonts.ui}`;
      ctx.fillText(`${g.combo} 连斩`, W / 2, 148);
      ctx.globalAlpha = 1;
    }
    this.skillBar(g);
    this.joystick(g);
  },

  // 底部技能栏：主动 6 格 + 被动 7 格
  skillBar(g) {
    const ctx = g.ctx, W = CFG.view.w, H = CFG.view.h, P = g.player;
    const actives = CFG.skills.actives.filter(d => P.skills[d.id]);
    const passives = CFG.skills.passives.filter(d => P.skills[d.id]);
    // 主动格
    const aw = 54, gap = 8;
    const totalW = actives.length * aw + (actives.length - 1) * gap;
    let x = (W - totalW) / 2;
    for (const d of actives) {
      rr(ctx, x, H - 96, aw, aw, 10);
      ctx.fillStyle = 'rgba(10,14,30,0.8)'; ctx.fill();
      ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe9b8';
      ctx.font = `bold 24px ${Fonts.title}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, x + aw / 2, H - 96 + aw / 2 + 1);
      // 等级角标
      ctx.fillStyle = '#0a0e1e';
      ctx.fillRect(x + aw - 20, H - 96 + aw - 16, 20, 16);
      ctx.fillStyle = '#54e8c0';
      ctx.font = `bold 11px ${Fonts.ui}`;
      ctx.fillText('Lv' + P.skills[d.id], x + aw - 10, H - 96 + aw - 8);
      ctx.textBaseline = 'alphabetic';
      x += aw + gap;
    }
    // 被动格（小）
    const pw = 36, pgap = 6;
    const ptw = passives.length * pw + (passives.length - 1) * pgap;
    let px = (W - ptw) / 2;
    for (const d of passives) {
      rr(ctx, px, H - 148, pw, pw, 8);
      ctx.fillStyle = 'rgba(10,14,30,0.7)'; ctx.fill();
      ctx.strokeStyle = 'rgba(201,164,90,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#b8c4e8';
      ctx.font = `bold 16px ${Fonts.title}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, px + pw / 2, H - 148 + pw / 2 + 1);
      ctx.fillStyle = '#54e8c0';
      ctx.font = `bold 10px ${Fonts.ui}`;
      ctx.fillText(P.skills[d.id], px + pw - 8, H - 148 + pw - 8);
      ctx.textBaseline = 'alphabetic';
      px += pw + pgap;
    }
  },

  // 虚拟摇杆：固定在屏幕下方
  joystick(g) {
    const ctx = g.ctx;
    const JX = 110, JY = CFG.view.h - 150;
    const act = Input.joyActive;
    ctx.globalAlpha = act ? 0.4 : 0.15;
    ctx.beginPath(); ctx.arc(JX, JY, 52, 0, TAU);
    ctx.strokeStyle = '#cfe8ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(120,160,220,0.12)'; ctx.fill();
    let dx = 0, dy = 0;
    if (act) {
      dx = Input.curX - Input.jx0; dy = Input.curY - Input.jy0;
      const d = Math.hypot(dx, dy);
      if (d > 52) { dx *= 52 / d; dy *= 52 / d; }
      ctx.globalAlpha = 0.6;
    } else ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath(); ctx.arc(JX + dx, JY + dy, 22, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  },

  // ---- 技能三选一 ----
  levelup(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.fillStyle = 'rgba(4,6,16,0.72)';
    ctx.fillRect(0, 0, W, CFG.view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold 30px ${Fonts.title}`;
    ctx.fillText('技 能 选 择', W / 2, 150);
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `15px ${Fonts.ui}`;
    ctx.fillText(`择一道法 · Lv.${g.player.level}${g.pendingLv > 1 ? `（还有 ${g.pendingLv - 1} 次）` : ''}`, W / 2, 184);
    g.options.forEach((o, i) => {
      const d = o.def;
      const x = 46, y = 226 + i * 132, w = W - 92, h = 114;
      rr(ctx, x, y, w, h, 14);
      ctx.fillStyle = 'rgba(24,32,60,0.95)'; ctx.fill();
      ctx.strokeStyle = o.isNew ? '#54e8c0' : '#c9a45a';
      ctx.lineWidth = o.isNew ? 2.5 : 2; ctx.stroke();
      // 图标圆
      ctx.beginPath(); ctx.arc(x + 56, y + h / 2, 30, 0, TAU);
      ctx.fillStyle = 'rgba(201,164,90,0.15)'; ctx.fill();
      ctx.strokeStyle = '#c9a45a'; ctx.stroke();
      ctx.fillStyle = '#ffd75a';
      ctx.font = `bold 30px ${Fonts.title}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, x + 56, y + h / 2 + 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = o.isNew ? '#54e8c0' : '#ffe9b8';
      ctx.font = `bold 21px ${Fonts.ui}`;
      ctx.fillText(o.isNew ? '新技能 · ' + d.name : `${d.name} Lv.${o.next}`, x + 104, y + 42);
      ctx.fillStyle = '#b8c4e8';
      ctx.font = `15px ${Fonts.ui}`;
      ctx.fillText(d.desc(o.next - 1), x + 104, y + 76);
      ctx.fillStyle = 'rgba(143,163,216,0.5)';
      ctx.fillText(`[${i + 1}]`, x + w - 44, y + 30);
      ctx.textAlign = 'center';
      g.buttons.push({ x, y, w, h, cb: () => g.chooseUpgrade(i) });
    });
  },

  stats(g, y0) {
    const ctx = g.ctx;
    const lines = [
      `存活 ${fmtTime(g.time)}`,
      `斩妖 ${g.kills} · 金币 ${g.gold}`,
      `最高连斩 ${g.maxCombo}`,
      `境界 Lv.${g.player.level} · ${g.player.tier.name}`,
    ];
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b8c4e8';
    ctx.font = `17px ${Fonts.ui}`;
    lines.forEach((s, i) => ctx.fillText(s, CFG.view.w / 2, y0 + i * 32));
  },

  over(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.fillStyle = 'rgba(10,4,8,0.72)';
    ctx.fillRect(0, 0, W, CFG.view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = `bold 64px ${Fonts.title}`;
    ctx.fillText('剑 陨', W / 2, 290);
    this.stats(g, 350);
    if (!g.reviveUsed) {
      this.btn(g, W / 2 - 140, 556, 280, 64, '◈ 仙人指路 · 复活', () => g.adStub('复活（每局 1 次）', () => g.revive()), { fill: 'rgba(90,50,20,0.92)', size: 22 });
      this.btn(g, W / 2 - 110, 642, 220, 54, '重新入世', () => { g.bank(false); g.startRun(); });
    } else {
      this.btn(g, W / 2 - 110, 576, 220, 54, '重新入世', () => { g.bank(false); g.startRun(); });
    }
  },

  win(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.fillStyle = 'rgba(6,8,20,0.75)';
    ctx.fillRect(0, 0, W, CFG.view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd75a';
    ctx.font = `bold 58px ${Fonts.title}`;
    ctx.fillText('妖王已诛', W / 2, 272);
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `16px ${Fonts.ui}`;
    ctx.fillText('第一章 · 青云山 通关', W / 2, 308);
    this.stats(g, 350);
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold 18px ${Fonts.ui}`;
    ctx.fillText(`灵石 +${g.lastGold}${g.doubled ? '（已翻倍）' : ''}`, W / 2, 510);
    if (!g.doubled) {
      this.btn(g, W / 2 - 140, 540, 280, 62, '◈ 灵石翻倍', () => g.adStub('结算翻倍', () => {
        g.doubled = true;
        Meta.data.gold += g.lastGold;
        Meta.save();
        g.toast(`灵石 +${g.lastGold}，已翻倍！`);
      }), { fill: 'rgba(90,50,20,0.92)', size: 22 });
      this.btn(g, W / 2 - 110, 624, 220, 54, '再战一局', () => g.startRun());
    } else {
      this.btn(g, W / 2 - 110, 570, 220, 54, '再战一局', () => g.startRun());
    }
    ctx.fillStyle = '#3d4a75';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText('第二章 · 敬请期待', W / 2, 720);
  },

  toast(g) {
    if (g.toastT <= 0 || !g.toastMsg) return;
    const ctx = g.ctx, W = CFG.view.w;
    const a = clamp(g.toastT / 0.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `15px ${Fonts.ui}`;
    const w = ctx.measureText(g.toastMsg).width + 36;
    rr(ctx, (W - w) / 2, CFG.view.h - 210, w, 38, 19);
    ctx.fillStyle = 'rgba(10,14,30,0.9)'; ctx.fill();
    ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffe9b8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.toastMsg, W / 2, CFG.view.h - 190);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  },
};
