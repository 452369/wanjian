'use strict';
// ===== 出怪导演：按 CFG.spawn 时间表推进章节节奏 =====
class Spawner {
  constructor(game) {
    this.g = game;
    this.time = 0;
    this.cds = {};
    this.eliteIdx = 0;
    this.bossSpawned = false;
    this.done = false;
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    const S = CFG.spawn;

    // 定点精英
    while (this.eliteIdx < S.elites.length && this.time >= S.elites[this.eliteIdx].at) {
      this.g.spawnMonster('elite');
      this.eliteIdx++;
      FX.showBanner('妖将现世', '斩之必有所获');
      AudioSys.boom();
    }

    // 章节Boss：登场后停止刷小怪，专心对决
    if (!this.bossSpawned && this.time >= S.bossAt) {
      this.bossSpawned = true;
      this.done = true;
      this.g.spawnMonster('boss', { x: CFG.view.w / 2, y: -90 });
      FX.showBanner('黑山老妖', '章节之主降临');
      Cam.shake(8, 0.6);
      AudioSys.boom();
      return;
    }

    // 常规刷怪
    const phase = S.phases.find(p => this.time < p.until) || S.phases[S.phases.length - 1];
    for (const e of phase.entries) {
      this.cds[e.type] = (this.cds[e.type] !== undefined ? this.cds[e.type] : 0) - dt;
      if (this.cds[e.type] <= 0 && this.g.monsters.list.length < S.maxAlive) {
        this.cds[e.type] = e.gap * rand(0.7, 1.3);
        this.g.spawnMonster(e.type, { hpMul: e.hpMul });
      }
    }
  }
}
