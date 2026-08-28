'use strict';
// ===== 数值配置表：V0.2 Survivor 化（俯视平面割草）=====
// 调难度/手感只改这里，不动逻辑代码
const CFG = {
  view: { w: 540, h: 960 }, // 竖屏逻辑分辨率

  // 打击感三件套开关
  feel: { shake: true, hitStop: true, dmgNum: true },

  player: {
    hp: 100, radius: 16,
    speed: 220,        // 基础移速 px/s（360° 走位）
    magnetRadius: 200, // 灵气拾取半径（磁力外还有缓速回流，保证升级节奏）
    invulnTime: 0.7,   // 受击无敌帧
  },

  // 御剑术（初始主动）基础参数
  sword: { damage: 12, cooldown: 0.5, speed: 640, life: 1.5, radius: 10 },
  crit: { rate: 0.05, mult: 1.8 },

  // 升级所需灵气 = base + level * perLv
  xp: { base: 4, perLv: 3 },

  // 剑品特效档位：随角色等级晋升（飞剑贴图/颜色随之切换）
  swordTiers: [
    { lv: 1,  name: '凡剑', color: '#cfe8ff' },
    { lv: 5,  name: '灵剑', color: '#54e8c0' },
    { lv: 10, name: '法剑', color: '#5aa0ff' },
    { lv: 15, name: '宝剑', color: '#c07aff' },
    { lv: 20, name: '仙剑', color: '#ffd75a' },
    { lv: 26, name: '剑意', color: '#ff5a8a' },
  ],

  // ===== 技能池 =====
  skills: {
    actives: [
      { id: 'yujian',  icon: '剑', name: '御剑术',   max: 5, desc: n => `飞剑自动索敌，${Math.min(8, n + 1)} 把齐射` },
      { id: 'jianqi',  icon: '斩', name: '剑气斩',   max: 5, desc: n => `扇形剑气波 ×${1 + Math.floor(n / 2)}，穿透一切` },
      { id: 'tianlei', icon: '雷', name: '天雷诀',   max: 5, desc: n => `紫雷 ${n + 1} 道随机轰击` },
      { id: 'huanrao', icon: '环', name: '环绕飞剑', max: 5, desc: n => `${n + 2} 把飞剑绕体旋转` },
      { id: 'jianyu',  icon: '域', name: '剑域罡气', max: 5, desc: n => `周身剑气领域持续灼烧` },
      { id: 'wanjian', icon: '灭', name: '万剑归宗', max: 5, desc: n => `周期剑雨轰炸四周` },
    ],
    passives: [
      { id: 'jianxin',    icon: '锋', name: '剑心',   max: 5, desc: () => '伤害 +15%' },
      { id: 'xunjie',     icon: '疾', name: '迅捷',   max: 5, desc: () => '冷却 -6%，移速 +8%' },
      { id: 'jianying',   icon: '影', name: '剑影',   max: 5, desc: () => '投射物数量 +1' },
      { id: 'zongheng',   icon: '围', name: '纵横',   max: 5, desc: () => '技能范围 +12%' },
      { id: 'changsheng', icon: '春', name: '长生诀', max: 5, desc: () => '每秒回复 0.4% 生命' },
      { id: 'xiling',     icon: '灵', name: '吸灵',   max: 5, desc: () => '拾取范围 +25%' },
      { id: 'huixin',     icon: '明', name: '会心',   max: 5, desc: () => '暴击率 +5%，暴伤 +15%' },
    ],
  },

  monsters: {
    // 前期手感约定：剑伤12 → 狼妖24血 = 两剑死，三剑必杀有富余
    wolf:  { name: '狼妖', hp: 24, speed: 135, radius: 16, dmg: 12, xp: 3 },
    bat:   { name: '蝠妖', hp: 16, speed: 105, radius: 13, dmg: 8,  xp: 3, sineAmp: 60, sineFreq: 3 },
    ghost: { name: '符鬼', hp: 36, speed: 82,  radius: 15, dmg: 8,  xp: 5,
             keepDist: 300, shootGap: 2.4, bulletSpeed: 220, bulletDmg: 10 },
    elite: { name: '妖将', hp: 380, speed: 88, radius: 28, dmg: 22, xp: 0, orbBurst: 16, gold: 15 },
    boss:  { name: '黑山老妖', hp: 5200, speed: 72, radius: 44, dmg: 30,
             radialCount: 14, radialGap: 3.0, bulletSpeed: 200,
             dashGap: 4.5, dashSpeed: 500, phase2At: 0.5, xp: 60, gold: 60 },
  },

  bullets: { radius: 7, life: 6 },

  // ===== Survivor 刷怪导演 =====
  spawn: {
    baseGap: 1.0,     // 初始刷怪间隔（秒）
    minGap: 0.22,     // 间隔下限
    rampEvery: 30,    // 每 30 秒一档难度
    hpRamp: 1.25,     // 每档怪物血量 ×1.25
    spdRamp: 0.04,    // 每档怪物速度 +4%
    gapShrink: 0.9,   // 每档刷怪间隔 ×0.9
    maxAlive: 60,     // 同屏上限（性能红线）
    elites: [45, 90, 135], // 精英出现时点
    bossAt: 150,      // Boss 登场（2:30），斩杀即胜利
    ringPad: 130,     // 刷怪环在视野外多少像素
  },

  // 雷霆式拾取道具（精英掉落）
  pickups: {
    list: ['sword2', 'rage', 'shield', 'nova', 'vacuum'],
    dur: { sword2: 10, rage: 8 },
    life: 12,
  },

  combo: { window: 2.5 },

  // 地面：程序化石板地砖尺寸 / 装饰件撒点密度（tile_ch1/deco_* 贴图存在则优先用）
  ground: { tile: 128, decoCell: 340 },
};
