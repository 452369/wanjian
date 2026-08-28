# AGENTS.md — 《万剑归宗》开发流程与项目解读（AI 协作必读）

> 本文件供 AI 助手/新成员快速接手。人向说明见 `README.md`，美术生产见 `docs/美术提示词.md`。
> 最后更新：2026-08-29（V0.2 Survivor 化已完成并通过全流程验收，待真机打磨）

---

## 1. 项目一句话

《万剑归宗》——国风修仙题材微信小游戏。
- **V0.1（当前代码）**：竖屏航道射击（雷霆战机式左右走位 + 幸存者式三选一升级），已提交 `main` 分支并打 `v0.1` 标签。
- **V0.2（已定案，待实施）**：玩法切换为**俯视平面 Survivor 割草**（土豆兄弟/诛天剑侠式），**竖屏不变**（已拍板，不做横屏）。方案全文见第 8 节。

## 2. 硬性约束（改代码前必看）

- 竖屏 9:16，逻辑分辨率 540×960，单手虚拟摇杆（V0.2 起）；
- **零构建零依赖**：纯 Canvas 2D + 原生 JS，`index.html` 按依赖顺序 `<script>` 加载（故意不用 ES 模块，为微信端 CommonJS 留路）；
- 微信首包 ≤4MB：`assets/` 目前是 1254px 高清原图（约 10MB+），**打包前必须统一缩图**（目标：角色 256px、地砖 512px、特效 512px）；
- 性能红线：微信中端机同屏 60fps，高频对象（飞剑/子弹/粒子/飘字/灵气）必须走对象池；
- 打击感三开关集中在 `CFG.feel`（shake/hitStop/dmgNum），调手感先看这里。

## 3. 运行与调试

```bash
cd wanjiang
node serve.js        # http://localhost:8642 （支持 Range，视频 seek 可用）
# 或直接双击 index.html（无需服务器）
node --check js/*.js # 每次改动的最低验证
```

**浏览器调试钩子**（控制台）：
- `window.game` 全局游戏实例；
- `game.gainXp(500)` 直升多级 / `game.player.level = 20` 换剑品；
- `game.spawner.time = 139` 快进到 Boss；
- `Input.keys['ArrowLeft'] = true` 模拟按键；
- **页签被遮挡时 rAF 会被节流**（表现为画面冻结）——自动化测试用 `for (let i = 0; i < N; i++) game.update(1/60); game.draw();` 手动泵帧，不依赖真实帧率。

## 4. 目录结构

```
index.html          入口，script 按依赖顺序加载
serve.js            本地静态服务器（支持 Range）
AGENTS.md           本文件（AI 解读）
README.md           人向说明（运行/调参/移植清单）
docs/美术提示词.md   全部美术资产的生图提示词（中英双语）
js/config.js        ★ 全部数值配置表（调难度/手感只改这里）
js/utils.js         工具 + 光晕贴图缓存 + 本地存档 Meta
js/pool.js          对象池 / EntityList
js/assets.js        AI 贴图加载器（ASSET_LIST 命名清单）+ drawSprite 通用绘制
js/audio.js         WebAudio 合成音效（连击音调递增在此）
js/input.js         拖动/键盘输入 + UI 点击 taps
js/camera.js        震屏 + hit-stop 顿帧
js/fx.js            粒子/伤害数字/飘字/闪光/晋升横幅
js/entities.js      玩家/飞剑/狼妖/蝠妖/符鬼/妖将/Boss/拾取道具
js/spawner.js       出怪导演（时间轴驱动）
js/screens.js       标题/HUD/三选一/失败/胜利 全部界面
js/game.js          主循环/状态机/碰撞/掉落/经济/广告点位(adStub)
tools/png_key.js    PNG 抠洋红底工具（key=抠图 / copy=查透明率）
tools/clear_rect.js 擦除贴图局部（如 AI 水印）
tools/cut_swords.js 六剑合一图切割（分段/裁边/PCA校直/亮度键控）
assets/             生成的贴图（放对名字即自动生效）
assets/src/         用户原图备份（未抠底）
legacy-lane/        （V0.2 开工时创建）竖版玩法代码备份
```

## 5. 架构速读

- **全局单例**（无模块系统）：`CFG / Assets / AudioSys / Input / Cam / FX / Meta` + 类 `Pool / EntityList / Player / Monster / Spawner / Game / Background / Screens`；
- **状态机**：`title → play → levelup(三选一,世界冻结) → play → win/over`；`over` 可看广告复活一次（`adStub` 占位）；
- **主循环**：`loop()` 计算 dt → hit-stop 期间世界 dt=0（渲染不停）→ `update()` 状态分发 → `draw()`（世界层参与震屏平移，UI 层不参与）；
- **贴图管线**：`Assets.preload()` 启动时按 `ASSET_LIST` 拉取 `assets/同名.png`，`drawSprite(ctx, name, x, y, {size, angle, alpha, additive})` 优先画贴图、失败返回 false 由调用方回退程序化造型；
- **三种抠底管线**：洋红底 → `png_key.js key`；黑底光效 → additive 叠加或亮度键控转透明；假透明棋盘格 → 亮度键控（参考 `cut_swords.js`：L<120 透明 / 120-200 渐变 / >200 不透明）；
- **经济**：灵石 = 斩妖×2 + 存活秒（`bank()`），本地存档 key `wjgz_meta`；
- **广告点位**全部收敛在 `game.js` 的 `adStub(name, cb)`，接微信激励视频只改这一个函数。

## 6. Git 工作流

- 远程：`origin = github.com/452369/wanjian.git`；
- `main` = 稳定版本（打标签 v0.1、v0.2…），`dev` = 日常开发分支；
- 提交信息用中文、写清动了哪个系统；美术原图放 `assets/src/`；
- 版本发布：`git switch main && git merge dev && git tag vX.Y && git push --tags`。

## 7. 当前状态

**已完成（V0.1）**：航道走位、自动飞剑（六品剑贴图按等级切换）、三选一升级 9 项、剑品晋升演出、狼/蝠/符鬼/妖将/双阶段 Boss、雷霆式掉落道具 5 种、灵气吸附、结算翻倍+复活广告位、本地存档、合成音效、AI 贴图管线全套工具。

**美术资产现状**：player（洋红底已抠）、4 小怪 + 2 Boss（已抠，原图在 src/）、六剑（亮度键控透明版）、bullet_enemy / orb_spirit（真透明，已接线）、fx_×5（已入库**未接线**）、player_alt.png（假透明，弃用）。所有贴图待缩图（见 2. 性能红线）。

**已知事项**：
- `fx_*` 特效贴图未接入演出（当前特效为程序化粒子）；
- 地图仍是竖版星空山峦（`Background` 类），V0.2 换俯视地砖；
- 页签遮挡自动暂停（rAF 节流），属预期行为。

## 8. V0.2 Survivor 化（已完成 ✅ 2026-08-29）

竖版玩法已备份至 `legacy-lane/`，主代码即 Survivor 玩法。实现与方案一致：
虚拟摇杆 360° 走位、摄像机跟随、无限地砖（tile_ch1 或程序化石板）+ 哈希装饰件、
5 主动（御剑术/剑气斩/天雷诀/环绕飞剑/剑域罡气/万剑归宗）+ 7 被动、
环形刷怪（30s 一档 ×1.25 血量、同屏 60）、精英 45/90/135s、Boss 2:30 生成斩杀即胜、
顶部计时/金币 + 底部技能栏、升级时全场灵气回流、胜利期间经验自动折灵石。

**已知待办**：
- 地图为有限竞技场 `CFG.arena`（1600×2400），边界发光特效线（Ground 末段绘制），玩家/怪物/刷点/摄像机全部夹在结界内；
- `fx_*` 特效贴图仍未接线（当前技能演出为程序化绘制，效果已可用）；
- 贴图打包前统一缩图（首包 4MB 红线）；
- 第二章（tile_ch2 乱葬岗）与无尽模式待做；
- 数值继续按"前期 10 秒内首升、每 10 秒一升、Boss 前达到 10 级"的目标用泵帧校准。

## 9. 改动守则（AI 执行时遵守）

1. 调数值 → 只动 `js/config.js`，并把改动写进提交信息；
2. 新增贴图 → 文件名同步进 `js/assets.js` 的 `ASSET_LIST` + `docs/美术提示词.md` 补提示词；
3. 每次代码改动：`node --check` 全部 js → 浏览器实测（用第 3 节钩子）→ 再提交；
4. 提交在 `dev` 分支，中文提交信息；美术原图备份进 `assets/src/`；
5. 不引入任何 npm 依赖/构建步骤；不把数值写死进逻辑代码；
6. 手感问题先检查 `CFG.feel` 与顿帧/震屏参数，再考虑改逻辑；
7. 用户提供的参考视频/图片先抽帧或读像素分析，再动方案（本项目的美术方向都来自用户参考）。
