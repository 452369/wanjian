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

  // ---- 战斗 HUD（复刻参考视频布局）----
  hud(g) {
    const ctx = g.ctx, W = CFG.view.w, H = CFG.view.h, P = g.player;
    // 左上：暂停圆钮
    ctx.beginPath(); ctx.arc(30, 40, 16, 0, TAU);
    ctx.fillStyle = 'rgba(10,10,10,0.75)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('❚❚', 30, 41);
    ctx.textBaseline = 'alphabetic';
    // 章节小黑条
    rr(ctx, 54, 20, 300, 10, 5);
    ctx.fillStyle = 'rgba(10,10,10,0.75)'; ctx.fill();
    // 绿色长条：击杀进度（升一级所需击杀）+ 计时内嵌
    const need = CFG.levelup.base + (P.level - 1) * CFG.levelup.per;
    rr(ctx, 54, 36, 300, 22, 11);
    ctx.fillStyle = 'rgba(10,10,10,0.75)'; ctx.fill();
    ctx.save();
    rr(ctx, 54, 36, 300, 22, 11); ctx.clip();
    ctx.fillStyle = '#6fbf3f';
    ctx.fillRect(54, 36, 300 * clamp(g.killsProg / need, 0, 1), 22);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtTime(g.time), 68, 47);
    // 等级章
    rr(ctx, 362, 34, 46, 26, 6);
    ctx.fillStyle = 'rgba(20,20,20,0.8)'; ctx.fill();
    ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffe9b8'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Lv' + P.level, 385, 47);
    ctx.textBaseline = 'alphabetic';
    // 血条（绿条下方）
    rr(ctx, 54, 64, 220, 10, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    if (P.hp > 0) {
      rr(ctx, 55, 65, 218 * clamp(P.hp / P.stats.maxHp, 0, 1), 8, 4);
      ctx.fillStyle = P.hp / P.stats.maxHp > 0.3 ? '#e85a6b' : '#ff2222'; ctx.fill();
    }
    // buff 图标
    let bx = 60;
    const icons = [];
    if (P.buffs.sword2) icons.push({ ch: '剑', c: '#ffd75a', t: P.buffs.sword2 });
    if (P.buffs.rage) icons.push({ ch: '狂', c: '#ff7a4a', t: P.buffs.rage });
    if (P.shield > 0) icons.push({ ch: '盾', c: '#6fd8ff', t: null });
    for (const ic of icons) {
      ctx.beginPath(); ctx.arc(bx + 11, 92, 11, 0, TAU);
      ctx.fillStyle = 'rgba(8,12,28,0.8)'; ctx.fill();
      ctx.strokeStyle = ic.c; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = ic.c;
      ctx.font = `bold 11px ${Fonts.ui}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ic.ch, bx + 11, 93);
      if (ic.t !== null) {
        ctx.fillStyle = '#d8e0f0'; ctx.font = '9px sans-serif';
        ctx.fillText(Math.ceil(ic.t) + 's', bx + 11, 110);
      }
      ctx.textBaseline = 'alphabetic';
      bx += ic.t !== null ? 30 : 26;
    }
    // 右上：双资源 + 头像圈
    ctx.beginPath(); ctx.arc(W - 34, 40, 20, 0, TAU);
    ctx.fillStyle = 'rgba(20,20,20,0.8)'; ctx.fill();
    ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#e8ddc0'; ctx.font = `bold 13px ${Fonts.title}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('剑', W - 34, 41);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7ab8e8';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('◆ ' + g.gold, W - 58, 24);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText('☠ ' + g.kills, W - 58, 46);
    // 右侧 X2 加速按钮（装饰）
    rr(ctx, W - 36, 150, 30, 64, 8);
    ctx.fillStyle = 'rgba(10,10,10,0.6)'; ctx.fill();
    ctx.fillStyle = '#ffd75a'; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('X2', W - 21, 178);
    // Boss 血条
    const boss = g.monsters.list.find(m => m.boss && !m.dead);
    if (boss) {
      const bw = 380, bxx = (W - bw) / 2, byy = 120;
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
    // 连击（红色系）
    if (g.combo >= 3) {
      const pop = g.comboPop > 0 ? 1 + g.comboPop * 1.6 : 1;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#ff5a5a';
      ctx.font = `bold ${Math.round((22 + Math.min(g.combo, 30) * 0.5) * pop)}px ${Fonts.ui}`;
      ctx.fillText(`${g.combo} 连斩`, W / 2, 176);
      ctx.globalAlpha = 1;
    }
    this.skillBar(g);
    this.joystick(g);
  },

  // 底部技能栏：圆形主动技能 + 小圆被动（参考视频样式）
  skillBar(g) {
    const ctx = g.ctx, W = CFG.view.w, H = CFG.view.h, P = g.player;
    const actives = CFG.skills.actives.filter(d => P.skills[d.id]);
    const passives = CFG.skills.passives.filter(d => P.skills[d.id]);
    // 主动：圆形
    const R = 26, gap = 14;
    const totalW = actives.length * R * 2 + (actives.length - 1) * gap;
    let x = (W - totalW) / 2 + R;
    for (const d of actives) {
      ctx.beginPath(); ctx.arc(x, H - 92, R, 0, TAU);
      ctx.fillStyle = 'rgba(20,40,70,0.85)'; ctx.fill();
      ctx.strokeStyle = '#5ab8e8'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#cfe8ff';
      ctx.font = `bold 20px ${Fonts.title}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, x, H - 92 + 1);
      // 等级徽章
      ctx.beginPath(); ctx.arc(x + R - 4, H - 92 + R - 4, 9, 0, TAU);
      ctx.fillStyle = '#5ab8e8'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif';
      ctx.fillText(P.skills[d.id], x + R - 4, H - 92 + R - 3);
      ctx.textBaseline = 'alphabetic';
      x += R * 2 + gap;
    }
    // 被动：小圆
    const pr = 17, pgap = 8;
    const ptw = passives.length * pr * 2 + (passives.length - 1) * pgap;
    let px = (W - ptw) / 2 + pr;
    for (const d of passives) {
      ctx.beginPath(); ctx.arc(px, H - 150, pr, 0, TAU);
      ctx.fillStyle = 'rgba(20,40,70,0.7)'; ctx.fill();
      ctx.strokeStyle = 'rgba(90,184,232,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#9fd0f0';
      ctx.font = `bold 13px ${Fonts.title}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, px, H - 150 + 1);
      ctx.fillStyle = '#9fd0f0'; ctx.font = 'bold 9px sans-serif';
      ctx.fillText(P.skills[d.id], px + pr - 5, H - 150 + pr - 5);
      ctx.textBaseline = 'alphabetic';
      px += pr * 2 + pgap;
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

  // 胜利 → 章节结算奖励（复刻参考视频三卡样式）
  win(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.fillStyle = 'rgba(8,6,12,0.88)';
    ctx.fillRect(0, 0, W, CFG.view.h);
    ctx.textAlign = 'center';
    // 装饰横线 + 标题
    ctx.strokeStyle = 'rgba(201,185,138,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 170, 155); ctx.lineTo(W / 2 - 100, 155);
    ctx.moveTo(W / 2 + 100, 155); ctx.lineTo(W / 2 + 170, 155);
    ctx.stroke();
    ctx.fillStyle = '#e8ddc0';
    ctx.font = `bold 36px ${Fonts.title}`;
    ctx.fillText('结 算 奖 励', W / 2, 168);
    ctx.fillStyle = '#b8c4e8';
    ctx.font = `15px ${Fonts.ui}`;
    ctx.fillText(`存活 ${fmtTime(g.time)} · 斩妖 ${g.kills} · 最高连斩 ${g.maxCombo} · Lv.${g.player.level}`, W / 2, 205);
    // 三张奖励卡
    const cards = [
      { ch: '灵', label: '章节奖励', val: g.lastGold },
      { ch: '经', label: '修炼心得', val: g.kills * 3 },
      { ch: '晶', label: '晶石', val: Math.floor(g.kills / 2) },
    ];
    cards.forEach((card, i) => {
      const cx = W / 2 + (i - 1) * 152, cy = 245;
      rr(ctx, cx - 62, cy, 124, 170, 10);
      ctx.fillStyle = 'rgba(24,32,60,0.95)'; ctx.fill();
      ctx.strokeStyle = '#7ab8e8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#e8f0ff';
      ctx.font = `bold 46px ${Fonts.title}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(card.ch, cx, cy + 58);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#b8c4e8';
      ctx.font = `13px ${Fonts.ui}`;
      ctx.fillText(card.label, cx, cy + 104);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(card.val, cx, cy + 136);
    });
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold 18px ${Fonts.ui}`;
    ctx.fillText(`灵石 +${g.lastGold}${g.doubled ? '（已翻倍）' : ''}`, W / 2, 462);
    if (!g.doubled) {
      this.btn(g, W / 2 - 140, 486, 280, 62, '◈ 灵石翻倍', () => g.adStub('结算翻倍', () => {
        g.doubled = true;
        Meta.data.gold += g.lastGold;
        Meta.save();
        g.toast(`灵石 +${g.lastGold}，已翻倍！`);
      }), { fill: 'rgba(90,50,20,0.92)', size: 22 });
      this.btn(g, W / 2 - 110, 570, 220, 54, '再战一局', () => g.startRun());
    } else {
      this.btn(g, W / 2 - 110, 560, 220, 54, '再战一局', () => g.startRun());
    }
    ctx.fillStyle = '#3d4a75';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText('第二章 · 敬请期待', W / 2, 730);
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
