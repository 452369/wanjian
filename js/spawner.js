'use strict';
// ===== 出怪导演：视野外环形刷怪 + 难度爬坡 + 精英/Boss 时间轴 =====
class Spawner {
  constructor(game) {
    this.g = game;
    this.time = 0;
    this.cd = 0.6;
    this.eliteIdx = 0;
    this.bossSpawned = false;
    this.done = false;
  }

  rampIdx() { return Math.floor(this.time / CFG.spawn.rampEvery); }
  hpMul() { return Math.pow(CFG.spawn.hpRamp, this.rampIdx()); }
  spdMul() { return 1 + CFG.spawn.spdRamp * this.rampIdx(); }

  update(dt) {
    if (this.done) return; // Boss 登场后停止常规刷怪，专心对决
    this.time += dt;
    const S = CFG.spawn;

    // 定点精英
    while (this.eliteIdx < S.elites.length && this.time >= S.elites[this.eliteIdx]) {
      this.eliteIdx++;
      this.g.spawnMonster('elite', { hpMul: this.hpMul(), spdMul: this.spdMul() });
      FX.showBanner('妖将现世', '斩之必有所获');
      AudioSys.boom();
    }

    // 章节 Boss
    if (!this.bossSpawned && this.time >= S.bossAt) {
      this.bossSpawned = true;
      this.done = true;
      this.g.spawnMonster('boss', { hpMul: 1 });
      FX.showBanner('黑山老妖', '章节之主降临');
      Cam.shake(8, 0.6);
      AudioSys.boom();
      return;
    }

    // 常规环形刷怪
    const idx = this.rampIdx();
    this.cd -= dt;
    if (this.cd <= 0 && this.g.monsters.list.length < S.maxAlive) {
      this.cd = Math.max(S.minGap, S.baseGap * Math.pow(S.gapShrink, idx)) * rand(0.7, 1.3);
      const pool = ['wolf'];
      if (this.time > 25) pool.push('bat');
      if (this.time > 60) pool.push('bat', 'ghost');
      if (this.time > 100) pool.push('ghost');
      this.g.spawnMonster(choice(pool), { hpMul: this.hpMul(), spdMul: this.spdMul() });
    }
  }
}
