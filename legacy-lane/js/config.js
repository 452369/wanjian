'use strict';
// ===== 数值配置表：调手感/难度只改这里，不动代码 =====
const CFG = {
  view: { w: 540, h: 960 }, // 竖屏逻辑分辨率

  // 打击感三件套开关
  feel: { shake: true, hitStop: true, dmgNum: true },

  player: {
    hp: 100, radius: 20,
    laneY: 768,       // 纵向航道：剑仙锁定在这一行，只左右移动（参考弹壳式原地输出）
    touchSens: 1.6,   // 拖动灵敏度（只作用于横向）
    keySpeed: 460,    // 键盘调试移动速度 px/s
    invulnTime: 0.8,  // 受击无敌帧
    magnetRadius: 110, // 灵气吸取半径（角色不能上下移动，稍大一点保证能吃到）
  },

  sword: {
    damage: 12, speed: 640, volleysPerSec: 2.2,
    life: 1.5, radius: 10,
    pierce: 0, critRate: 0.05, critMult: 1.8,
  },

  // 剑品特效档位：达到等级触发"剑品晋升"演出，飞剑外观与命中特效随之升级
  swordTiers: [
    { lv: 1,  name: '凡剑', color: '#cfe8ff' },
    { lv: 5,  name: '灵剑', color: '#54e8c0' },
    { lv: 10, name: '法剑', color: '#5aa0ff' },
    { lv: 15, name: '宝剑', color: '#c07aff' },
    { lv: 20, name: '仙剑', color: '#ffd75a' },
    { lv: 26, name: '剑意', color: '#ff5a8a' },
  ],

  xp: { base: 4, perLv: 3 }, // 升级所需灵气 = base + level * perLv

  monsters: {
    // 前期平衡：剑伤害12 → 狼妖28血 = 三剑必杀（36伤害）；蝠妖16 = 两剑；符鬼36 = 三剑
    wolf:  { name: '狼妖', hp: 28, speed: 140, radius: 17, dmg: 12, xp: 2 },
    bat:   { name: '蝠妖', hp: 16, speed: 90,  radius: 14, dmg: 8,  xp: 2, sineAmp: 70, sineFreq: 3.2 },
    ghost: { name: '符鬼', hp: 36, speed: 75,  radius: 16, dmg: 8,  xp: 4,
             shootGap: 2.3, bulletSpeed: 230, bulletDmg: 10 },
    elite: { name: '妖将', hp: 400, speed: 80, radius: 30, dmg: 22, xp: 0, orbBurst: 16 },
    boss:  { name: '黑山老妖', hp: 4200, speed: 62, radius: 46, dmg: 30,
             radialCount: 12, radialGap: 3.2, bulletSpeed: 205,
             dashGap: 4.5, dashSpeed: 540, phase2At: 0.5, xp: 0 },
  },

  bullets: { radius: 7, life: 6 },

  // 出怪导演表：按时间推进的章节节奏
  spawn: {
    maxAlive: 38,
    phases: [
      { until: 20,   entries: [{ type: 'wolf',  gap: 1.25, hpMul: 1 }] },
      { until: 45,   entries: [{ type: 'wolf',  gap: 1.7,  hpMul: 1.15 }, { type: 'bat', gap: 0.9, hpMul: 1 }] },
      { until: 80,   entries: [{ type: 'bat',   gap: 0.8,  hpMul: 1.3 }, { type: 'ghost', gap: 3.4, hpMul: 1 }, { type: 'wolf', gap: 2.2, hpMul: 1.35 }] },
      { until: 115,  entries: [{ type: 'bat',   gap: 0.55, hpMul: 1.6 }, { type: 'ghost', gap: 2.6, hpMul: 1.3 }, { type: 'wolf', gap: 1.4, hpMul: 1.6 }] },
      { until: 9999, entries: [{ type: 'bat',   gap: 0.5,  hpMul: 1.8 }, { type: 'wolf', gap: 1.1, hpMul: 1.8 }, { type: 'ghost', gap: 2.4, hpMul: 1.6 }] },
    ],
    elites: [{ at: 55 }, { at: 105 }],
    bossAt: 140,
  },

  // 三选一升级池（icon 用单字，水墨风；max 为可选次数上限）
  upgrades: [
    { id: 'sword',  icon: '剑', name: '剑影分身',   desc: n => `飞剑 +1 把（当前 ${n + 1} 把）`, apply: st => st.swordCount++, max: 6, weight: 10 },
    { id: 'rate',   icon: '迅', name: '御剑迅捷',   desc: () => '攻速 +20%', apply: st => st.volleysPerSec *= 1.2, weight: 10 },
    { id: 'dmg',    icon: '锋', name: '剑气淬炼',   desc: () => '伤害 +25%', apply: st => st.damage *= 1.25, weight: 10 },
    { id: 'speed',  icon: '疾', name: '剑速如虹',   desc: () => '飞剑速度 +20%', apply: st => st.speed *= 1.2, weight: 6 },
    { id: 'crit',   icon: '明', name: '剑心通明',   desc: () => '暴击率 +8%', apply: st => st.critRate += 0.08, weight: 6 },
    { id: 'critd',  icon: '破', name: '一剑破万法', desc: () => '暴击伤害 +50%', apply: st => st.critMult += 0.5, weight: 5 },
    { id: 'magnet', icon: '灵', name: '吸灵大法',   desc: () => '灵气吸取范围 +40%', apply: st => st.magnetRadius *= 1.4, weight: 6 },
    { id: 'hp',     icon: '春', name: '回春诀',     desc: () => '生命上限 +10，并恢复 40 点',
      apply: (st, p) => { st.maxHp += 10; p.hp = Math.min(st.maxHp, p.hp + CFG.hpUpgradeHeal); }, weight: 6 },
    { id: 'pierce', icon: '穿', name: '贯穿剑意',   desc: () => '飞剑可贯穿 +1 个敌人', apply: st => st.pierce++, max: 3, weight: 5 },
  ],
  hpUpgradeHeal: 40,

  // 雷霆战机式拾取道具（精英/妖将掉落，落地 8 秒消失）
  pickups: {
    list: ['sword2', 'rage', 'shield', 'nova', 'vacuum'],
    dur: { sword2: 10, rage: 8 },
    life: 9,
  },

  combo: { window: 2.5 }, // 连击保持窗口（秒）
};
