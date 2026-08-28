'use strict';
// ===== AI 生成贴图加载器 =====
// 用法：按下方 LIST 的文件名把 AI 生成的 PNG 放进 assets/ 目录，刷新页面自动替换程序化造型；
// 缺失的文件静默回退到代码默认造型，可以一张一张渐进替换。
// 约定：
//   1) 普通角色/怪物贴图用纯洋红背景(#FF00FF)生成，抠图后存 PNG（透明底）；
//   2) 光效类（灵气珠/光弹/剑气）用纯黑背景生成，代码里以 additive(发光叠加) 绘制；
//   3) 怪物贴图统一画成"面朝屏幕下方"（正朝玩家扑来的视角），带方向的怪由代码旋转。
const ASSET_LIST = [
  'player',                                        // 剑仙（御剑，正面/背视均可，默认不旋转）
  'sword_tier0', 'sword_tier1', 'sword_tier2',     // 飞剑五品（剑尖朝上）
  'sword_tier3', 'sword_tier4', 'sword_tier5',
  'bullet_enemy', 'orb_spirit',                    // 敌弹（符咒弹）/ 灵气珠
  'monster_wolf', 'monster_bat', 'monster_ghost',  // 三种小妖
  'monster_elite',                                 // 精英妖将
  'boss_heishan', 'boss_heishan_rage',             // Boss 两形态
  'pickup_sword2', 'pickup_rage', 'pickup_shield', // 掉落道具五枚
  'pickup_nova', 'pickup_vacuum',
  'bg_ch1_sky', 'bg_ch1_far', 'bg_ch1_near',       // 第一章地图三视差层
];

const Assets = {
  cache: {},
  preload() {
    for (const name of ASSET_LIST) {
      const img = new Image();
      img.onload = () => { this.cache[name] = img; };
      img.src = 'assets/' + name + '.png'; // 不存在则 onerror 静默，走代码默认造型
    }
  },
  img(name) { return this.cache[name] || null; },
};

// 通用贴图绘制：以 (x,y) 为中心，size 为显示宽高中较大者；贴图不存在返回 false，由调用方回退
function drawSprite(ctx, name, x, y, o = {}) {
  const img = Assets.img(name);
  if (!img) return false;
  const k = (o.size || 40) / Math.max(img.width, img.height);
  ctx.save();
  ctx.translate(x, y);
  if (o.angle) ctx.rotate(o.angle);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.additive) ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
  ctx.restore();
  return true;
}
