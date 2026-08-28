'use strict';
// ===== 界面与 HUD：标题 / 战斗HUD / 升级三选一 / 失败 / 胜利 =====
// 字体：标题用楷体系（水墨味），UI 用黑体系
const Fonts = {
  title: '"KaiTi","STKaiti","Noto Serif SC","SimSun",serif',
  ui: '"Microsoft YaHei","PingFang SC",sans-serif',
};

const Screens = {
  // 画一个按钮并注册点击区（点击回调在下一帧 update 中命中）
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

    // 右上角静音按钮（所有界面常驻）
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
    // 主标题（金墨）
    const grad = ctx.createLinearGradient(0, 300, 0, 380);
    grad.addColorStop(0, '#ffe9b8'); grad.addColorStop(1, '#c9a45a');
    ctx.fillStyle = grad;
    ctx.font = `bold 84px ${Fonts.title}`;
    ctx.shadowColor = 'rgba(201,164,90,0.6)'; ctx.shadowBlur = 24;
    ctx.fillText('万剑归宗', W / 2, 366);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `19px ${Fonts.ui}`;
    ctx.fillText('御剑千军 · 斩妖除魔', W / 2, 412);
    // 存档信息
    ctx.fillStyle = '#5a6a9a';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText(`灵石 ${Meta.data.gold} · 最佳斩妖 ${Meta.data.bestKills} · 最高连斩 ${Meta.data.bestCombo}`, W / 2, 446);
    // 开始按钮
    this.btn(g, W / 2 - 130, 600, 260, 66, '开 始 斩 妖', () => g.startRun(), { size: 26 });
    ctx.fillStyle = '#5a6a9a';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText('左右拖动 · 飞剑自动出鞘', W / 2, 856);
    ctx.fillText('桌面调试：方向键左右 · 回车开始 · 123 选法术', W / 2, 880);
  },

  // ---- 战斗 HUD ----
  hud(g) {
    const ctx = g.ctx, W = CFG.view.w, P = g.player;
    // 经验条（顶部通栏）
    const need = CFG.xp.base + P.level * CFG.xp.perLv;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 8);
    ctx.fillStyle = P.tier.color;
    ctx.fillRect(0, 0, W * clamp(g.xp / need, 0, 1), 8);
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
    // buff 图标（含护盾）
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
    // 时间 / 击杀（右上，给静音钮让位）
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText(fmtTime(g.time), W - 48, 22);
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold 15px ${Fonts.ui}`;
    ctx.fillText(`斩妖 ${g.kills}`, W - 48, 44);
    // Boss 血条
    const boss = g.monsters.list.find(m => m.boss && !m.dead);
    if (boss) {
      const bw = 380, bxx = (W - bw) / 2, byy = 76;
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
      ctx.fillText(`${g.combo} 连斩`, W / 2, 136);
      ctx.globalAlpha = 1;
    }
  },

  // ---- 升级三选一 ----
  levelup(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.fillStyle = 'rgba(4,6,16,0.72)';
    ctx.fillRect(0, 0, W, CFG.view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold 30px ${Fonts.title}`;
    ctx.fillText('境 界 突 破', W / 2, 190);
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `15px ${Fonts.ui}`;
    ctx.fillText(`择一道法 · Lv.${g.player.level}${g.pendingLv > 1 ? `（还有 ${g.pendingLv - 1} 次突破）` : ''}`, W / 2, 224);
    g.options.forEach((u, i) => {
      const x = 46, y = 268 + i * 132, w = W - 92, h = 114;
      rr(ctx, x, y, w, h, 14);
      ctx.fillStyle = 'rgba(24,32,60,0.95)'; ctx.fill();
      ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 2; ctx.stroke();
      // 单字图标
      ctx.beginPath(); ctx.arc(x + 56, y + h / 2, 30, 0, TAU);
      ctx.fillStyle = 'rgba(201,164,90,0.15)'; ctx.fill();
      ctx.strokeStyle = '#c9a45a'; ctx.stroke();
      ctx.fillStyle = '#ffd75a';
      ctx.font = `bold 30px ${Fonts.title}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(u.icon, x + 56, y + h / 2 + 2);
      ctx.textBaseline = 'alphabetic';
      // 文本
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffe9b8';
      ctx.font = `bold 21px ${Fonts.ui}`;
      ctx.fillText(u.name, x + 104, y + 42);
      ctx.fillStyle = '#b8c4e8';
      ctx.font = `15px ${Fonts.ui}`;
      ctx.fillText(u.desc(g.upCount[u.id] || 0), x + 104, y + 76);
      ctx.fillStyle = 'rgba(143,163,216,0.5)';
      ctx.fillText(`[${i + 1}]`, x + w - 44, y + 30);
      ctx.textAlign = 'center';
      g.buttons.push({ x, y, w, h, cb: () => g.chooseUpgrade(i) });
    });
  },

  // ---- 失败 ----
  over(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.fillStyle = 'rgba(10,4,8,0.72)';
    ctx.fillRect(0, 0, W, CFG.view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = `bold 64px ${Fonts.title}`;
    ctx.fillText('剑 陨', W / 2, 300);
    this.stats(g, 360);
    if (!g.reviveUsed) {
      // 广告点位①：复活（转化率最高）
      this.btn(g, W / 2 - 140, 560, 280, 64, '◈ 仙人指路 · 复活', () => g.adStub('复活（每局 1 次）', () => g.revive()), { fill: 'rgba(90,50,20,0.92)', size: 22 });
      this.btn(g, W / 2 - 110, 646, 220, 54, '重新入世', () => { g.bank(false); g.startRun(); });
    } else {
      this.btn(g, W / 2 - 110, 580, 220, 54, '重新入世', () => { g.bank(false); g.startRun(); });
    }
  },

  // ---- 胜利 ----
  win(g) {
    const ctx = g.ctx, W = CFG.view.w;
    ctx.fillStyle = 'rgba(6,8,20,0.75)';
    ctx.fillRect(0, 0, W, CFG.view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd75a';
    ctx.font = `bold 58px ${Fonts.title}`;
    ctx.fillText('妖王已诛', W / 2, 282);
    ctx.fillStyle = '#8fa3d8';
    ctx.font = `16px ${Fonts.ui}`;
    ctx.fillText('第一章 · 青云山 通关', W / 2, 318);
    this.stats(g, 360);
    ctx.fillStyle = '#ffe9b8';
    ctx.font = `bold 18px ${Fonts.ui}`;
    ctx.fillText(`灵石 +${g.lastGold}${g.doubled ? '（已翻倍）' : ''}`, W / 2, 520);
    if (!g.doubled) {
      // 广告点位②：结算翻倍（接受率通常最高）
      this.btn(g, W / 2 - 140, 550, 280, 62, '◈ 灵石翻倍', () => g.adStub('结算翻倍', () => {
        g.doubled = true;
        Meta.data.gold += g.lastGold;
        Meta.save();
        g.toast(`灵石 +${g.lastGold}，已翻倍！`);
      }), { fill: 'rgba(90,50,20,0.92)', size: 22 });
      this.btn(g, W / 2 - 110, 634, 220, 54, '再战一局', () => g.startRun());
    } else {
      this.btn(g, W / 2 - 110, 580, 220, 54, '再战一局', () => g.startRun());
    }
    ctx.fillStyle = '#3d4a75';
    ctx.font = `14px ${Fonts.ui}`;
    ctx.fillText('下一章 · 敬请期待', W / 2, 726);
  },

  stats(g, y0) {
    const ctx = g.ctx;
    const lines = [
      `存活 ${fmtTime(g.time)}`,
      `斩妖 ${g.kills}`,
      `最高连斩 ${g.maxCombo}`,
      `境界 Lv.${g.player.level} · ${g.player.tier.name}`,
    ];
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b8c4e8';
    ctx.font = `17px ${Fonts.ui}`;
    lines.forEach((s, i) => ctx.fillText(s, CFG.view.w / 2, y0 + i * 32));
  },

  // ---- 底部提示条（广告占位说明等）----
  toast(g) {
    if (g.toastT <= 0 || !g.toastMsg) return;
    const ctx = g.ctx, W = CFG.view.w;
    const a = clamp(g.toastT / 0.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `15px ${Fonts.ui}`;
    const w = ctx.measureText(g.toastMsg).width + 36;
    rr(ctx, (W - w) / 2, CFG.view.h - 130, w, 38, 19);
    ctx.fillStyle = 'rgba(10,14,30,0.9)'; ctx.fill();
    ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffe9b8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.toastMsg, W / 2, CFG.view.h - 110);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  },
};
