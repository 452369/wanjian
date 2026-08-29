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
  'fx_slash', 'fx_nova', 'fx_tornado', 'fx_tierup', 'fx_splat', // 技能特效
  'fx_slash_sheet', 'fx_nova_sheet', 'fx_tornado_sheet', 'fx_tierup_sheet', // 特效动画雪碧图（可选）
  'tile_ch1',                                       // 俯视无缝地砖（Survivor 化用）
  'deco_lantern', 'deco_incense', 'deco_bamboo',    // 地图装饰件（待撒点渲染）
  'deco_stele', 'deco_jar',
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
  if (o.sx !== undefined || o.sy !== undefined) ctx.scale(o.sx || 1, o.sy || 1); // 挤压拉伸（动画用）
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.additive) ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
  ctx.restore();
  return true;
}

// 特效雪碧图帧播放：存在 基名_sheet.png（横排正方形单帧）→ 按帧播放；否则回退静态 基名.png
// o: {size, angle, additive, alpha, t(剪辑时间), fps, loop}
function drawFx(ctx, base, x, y, o = {}) {
  const size = o.size || 40;
  ctx.save();
  ctx.translate(x, y);
  if (o.angle) ctx.rotate(o.angle);
  if (o.additive) ctx.globalCompositeOperation = 'lighter';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const sheet = Assets.img(base + '_sheet');
  if (sheet) {
    const N = Math.max(1, Math.round(sheet.width / sheet.height));
    const fw = sheet.width / N;
    const fps = o.fps || 10;
    const f = o.loop ? Math.floor((o.t || 0) * fps) % N
                     : Math.min(N - 1, Math.floor((o.t || 0) * fps));
    ctx.drawImage(sheet, f * fw, 0, fw, sheet.height, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  const st = Assets.img(base);
  if (!st) { ctx.restore(); return false; }
  ctx.drawImage(st, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}
