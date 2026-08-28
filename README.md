# 万剑归宗 · V0.1 原型

剑仙题材纵版射击（雷霆战机手感 × 幸存者like局内成长）。纯 Canvas + 原生 JS，零素材、零依赖、零构建：
所有画面用 Canvas 程序化绘制，所有音效用 WebAudio 实时合成。

## 运行

- 双击 `index.html` 即可在浏览器游玩（无需服务器）；
- 或带本地服务：`node serve.js` 后访问 http://localhost:8642 （手机局域网内也可试）。

**操作**：手指/鼠标拖动控制剑仙（增量位移，手指不挡角色）；飞剑自动射向最近的敌人。
桌面调试：方向键/WASD 移动，回车开始/确认，1/2/3 选升级卡，右上角"音"字按钮静音。

## 已实现（V0.1 范围）

- 御剑剑仙 + 自动飞剑（剑数/攻速/伤害/剑速/暴击/贯穿局内成长，三选一升级）
- 剑品晋升特效线：凡剑→灵剑→法剑→宝剑→仙剑→剑意，按等级触发晋升演出，飞剑颜色与命中特效随之变化
- 打击感三件套：hit-stop 顿帧（暴击/精英/Boss）、三档震屏、连击音调递增 + 伤害数字 + 灵魂粒子
- 三种妖兽（狼妖/蝠妖/符鬼）+ 精英妖将 + 双阶段 Boss 黑山老妖（径向弹幕/螺旋弹/蓄力冲撞）
- 雷霆战机式随机掉落：剑阵加身/狂剑诀/护体罡气/万剑归宗(清屏)/万灵来朝(吸灵气)
- 出怪导演表（时间轴驱动，见 `CFG.spawn`）、章节制（第一章 青云山 ~140s + Boss）
- 失败复活 / 胜利结算双广告点位（原型内为占位，直接发放奖励）、灵石与最佳记录本地存档

## 调参指南（只改 `js/config.js`）

| 想调什么 | 改哪里 |
|---|---|
| 手感开关（震屏/顿帧/伤害数字） | `CFG.feel` |
| 玩家/飞剑基础数值 | `CFG.player` / `CFG.sword` |
| 剑品晋升等级与配色 | `CFG.swordTiers` |
| 升级速度曲线 | `CFG.xp`（需求 = base + level × perLv） |
| 三选一卡池（权重/上限） | `CFG.upgrades` |
| 怪物数值 | `CFG.monsters` |
| 出怪节奏/精英时点/Boss时点 | `CFG.spawn` |
| 掉落道具种类与时长 | `CFG.pickups` |

## 代码结构

```
index.html        入口（script 按依赖顺序加载）
serve.js          本地静态服务器（可选）
js/config.js      全部数值配置表
js/utils.js       工具 + 光晕贴图缓存 + 本地存档 Meta
js/pool.js        对象池 / EntityList（高频对象零 GC 压力）
js/audio.js       WebAudio 合成音效（连击音调递增在这里）
js/input.js       拖动增量输入 + 键盘调试 + UI 点击
js/camera.js      震屏 + hit-stop 顿帧
js/fx.js          粒子/伤害数字/飘字/全屏闪光/晋升横幅
js/entities.js    玩家/飞剑/三种妖兽/精英/Boss/掉落道具
js/spawner.js     出怪导演（时间轴）
js/screens.js     标题/HUD/三选一/失败/胜利 全部界面
js/game.js        主循环/状态机/碰撞/掉落/经济结算
```

## 广告点位（接微信激励视频时）

所有点位已收敛到 `game.js` 的 `adStub(name, cb)` 一个函数：
接广告时把 `adStub` 改为拉起 `wx.createRewardedVideoAd`，`onClose(res.isEnded)` 后执行 `cb()` 即可，UI 一行不用改。

| 点位 | 位置 | 频控 |
|---|---|---|
| 复活 | 失败结算 | 每局 1 次 |
| 结算翻倍 | 胜利结算 | 每局 1 次 |
| （规划中）体力恢复 / 免费抽剑 / 开局增益 / 三选一刷新 | 主城 / 局内 | 见设计文档 |

节奏红线：每局自然广告 1~3 次，日均主动观看 2~5 次，再多必伤留存。

## 微信小游戏移植清单

1. 新建微信小游戏项目，把 `js/` 拷入，入口 `game.js` 改为 `main.js`（微信入口约定）；
2. `wx.createCanvas()` 替代 `<canvas>`，DOM 事件换 `wx.onTouchStart/Move/End`（`input.js` 已按此拆分）；
3. `localStorage` 换 `wx.setStorageSync`（`utils.js` 的 `Meta` 一处）；
4. `audio.js` 的 WebAudio 在微信端用 `wx.createWebAudioContext()`，接口基本同源；
5. 排行榜/云存档接微信云开发；分享卡片用 `wx.shareAppMessage`（战报图：击杀数+连击+境界）；
6. 首包 ≤4MB：本项目零素材，天然达标；引擎无需引入。

## 美术资产管线

1. 按 `docs/美术提示词.md` 生成图片（角色/道具用纯洋红底 #FF00FF，光效用纯黑底）；
2. 洋红底一键抠透明：`node tools/png_key.js 输入.png assets/名字.png key`；
3. 擦水印/杂物：`node tools/clear_rect.js 文件.png x y 宽 高`；
4. 文件按 `js/assets.js` 里的清单命名放入 `assets/`，刷新游戏自动生效；缺哪张就用哪张的程序化默认造型。
5. 注意：预览图里的"棋盘格透明底"可能是画上去的假透明（可用 `node tools/png_key.js 图.png 任意输出.png copy` 查看真实透明像素占比），假透明需重新导出真 alpha 的 PNG。

## 下一步（V0.2 规划）

- 局外养成：铸剑炉（灵石强化四维）+ 仙剑图鉴抽卡
- 更多章节与妖兽、无尽剑塔模式（好友排行榜）
- 分享战报卡片 + 订阅消息（体力回满提醒）
- 真机性能调优（同屏 300+ 对象稳 60 帧：已用对象池 + 缓存光晕贴图打底）
