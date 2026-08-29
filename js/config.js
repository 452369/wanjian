'use strict';
// ===== 数值配置表：V0.2 Survivor 化（俯视平面割草）=====
// 调难度/手感只改这里，不动逻辑代码
const CFG = {
  view: { w: 540, h: 960 }, // 竖屏逻辑分辨率

  // 打击感三件套开关
  feel: { shake: true, hitStop: true, dmgNum: true },

  player: {
    hp: 100, radius: 16,
    speed: 300,        // 基础移速：节奏放缓后靠走位周旋（比怪快一大截）
    invulnTime: 0.7,   // 受击无敌帧
  },

  // 御剑术（初始主动）基础参数：伤害削弱——怪不再被秒，靠持续输出磨
  sword: { damage: 9, cooldown: 0.5, speed: 640, life: 1.5, radius: 10 },
  crit: { rate: 0.05, mult: 1.8 },

  // 升级（击杀直接涨级）刻意放缓：升到下一级所需击杀数 = base + (level-1) * per
  levelup: { base: 12, per: 3 },

  // 剑品特效档位：随角色等级晋升（升级已放缓，档位相应下移）
  swordTiers: [
    { lv: 1,  name: '凡剑', color: '#cfe8ff' },
    { lv: 4,  name: '灵剑', color: '#54e8c0' },
    { lv: 7,  name: '法剑', color: '#5aa0ff' },
    { lv: 10, name: '宝剑', color: '#c07aff' },
    { lv: 14, name: '仙剑', color: '#ffd75a' },
    { lv: 18, name: '剑意', color: '#ff5a8a' },
  ],

  // ===== 技能池 =====
  skills: {
    actives: [
      { id: 'yujian',  icon: '剑', name: '御剑术',   max: 5, desc: n => `飞剑自动索敌，${Math.min(10, n + 2)} 把齐射` },
      { id: 'jianqi',  icon: '斩', name: '剑气斩',   max: 5, desc: n => `扇形剑气波 ×${1 + Math.floor(n / 2)}，穿透一切` },
      { id: 'tianlei', icon: '雷', name: '天雷诀',   max: 5, desc: n => `紫雷 ${n + 2} 道随机轰击` },
      { id: 'huanrao', icon: '环', name: '环绕飞剑', max: 5, desc: n => `${n + 3} 把飞剑绕体护主` },
      { id: 'jianyu',  icon: '域', name: '剑域罡气', max: 5, desc: n => `周身剑气领域持续灼烧` },
      { id: 'wanjian', icon: '灭', name: '万剑归宗', max: 5, desc: n => `周期剑雨轰炸四周` },
    ],
    passives: [
      { id: 'jianxin',    icon: '锋', name: '剑心',   max: 5, desc: () => '伤害 +15%' },
      { id: 'xunjie',     icon: '疾', name: '迅捷',   max: 5, desc: () => '冷却 -6%，移速 +8%' },
      { id: 'jianying',   icon: '影', name: '剑影',   max: 5, desc: () => '投射物数量 +1' },
      { id: 'zongheng',   icon: '围', name: '纵横',   max: 5, desc: () => '技能范围 +12%' },
      { id: 'changsheng', icon: '春', name: '长生诀', max: 5, desc: () => '每秒回复 0.4% 生命' },
      { id: 'tiebi',      icon: '壁', name: '铁壁',   max: 5, desc: () => '受到伤害 -8%' },
      { id: 'huixin',     icon: '明', name: '会心',   max: 5, desc: () => '暴击率 +5%，暴伤 +15%' },
    ],
  },

  monsters: {
    // 慢速大群：模型加大、移速/攻速/伤害全面下调，数量与血量上调——围而不攻，靠走位周旋
    wolf:  { name: '狼妖', hp: 40, speed: 95,  radius: 26, dmg: 6,  xp: 3 },
    bat:   { name: '蝠妖', hp: 28, speed: 85,  radius: 20, dmg: 5,  xp: 3, sineAmp: 60, sineFreq: 3 },
    ghost: { name: '符鬼', hp: 60, speed: 65,  radius: 22, dmg: 6,  xp: 5,
             keepDist: 320, shootGap: 3.2, bulletSpeed: 200, bulletDmg: 6 },
    elite: { name: '妖将', hp: 600, speed: 70, radius: 42, dmg: 14, xp: 0, gold: 15 },
    boss:  { name: '黑山老妖', hp: 6500, speed: 55, radius: 64, dmg: 20,
             radialCount: 14, radialGap: 4.0, bulletSpeed: 180,
             dashGap: 5.5, dashSpeed: 420, phase2At: 0.5, xp: 0, gold: 60 },
  },

  bullets: { radius: 7, life: 6 },

  // ===== Survivor 刷怪导演：连续加速爬坡（无波次跳变，随时间平滑变多变硬）=====
  spawn: {
    baseGap: 0.9,     // 初始刷怪间隔（秒）：慢热开局
    minGap: 0.18,     // 间隔下限
    gapPerSec: 0.97,  // 每秒间隔 ×0.97（连续加速，30秒≈×0.4）
    hpPerSec: 1.0066, // 每秒血量 ×1.0066（1分钟≈×1.48，持续变硬）
    maxAlive: 140,    // 同屏上限：围城感
    packAfter: 50,    // 50 秒后开始成群（每 50 秒 +1 只/组，上限 4）
    elites: [70, 120], // 精英出现时点（节奏放缓后移）
    bossAt: 180,      // Boss 登场（3:00），斩杀即胜利
    ringPad: 60,      // 刷怪环贴近视野边缘
  },

  // 灵气结界：有限竞技场，边界用发光特效线封闭
  arena: { w: 1600, h: 2400, margin: 26 },

  // 雷霆式拾取道具（精英掉落）
  pickups: {
    list: ['sword2', 'rage', 'shield', 'nova'],
    dur: { sword2: 10, rage: 8 },
    life: 12,
  },

  combo: { window: 2.5 },

  // 地面：程序化石板地砖尺寸 / 装饰件撒点密度（tile_ch1/deco_* 贴图存在则优先用）
  ground: { tile: 128, decoCell: 340 },
};
