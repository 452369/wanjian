'use strict';
// ===== 出怪导演：连续加速爬坡（随时间平滑变多变硬，无波次跳变）=====
class Spawner {
  constructor(game) {
    this.g = game;
    this.time = 0;
    this.cd = 1.2;
    this.eliteIdx = 0;
    this.bossSpawned = false;
    this.done = false;
  }

  hpMul() { return Math.pow(CFG.spawn.hpPerSec, this.time); } // 连续变硬

  update(dt) {
    if (this.done) return; // Boss 登场后停止常规刷怪，专心对决
    this.time += dt;
    const S = CFG.spawn;

    // 定点精英
    while (this.eliteIdx < S.elites.length && this.time >= S.elites[this.eliteIdx]) {
      this.eliteIdx++;
      this.g.spawnMonster('elite', { hpMul: this.hpMul() });
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

    // 常规刷怪：间隔随时间连续收缩（加速度感），50 秒后逐渐成群
    this.cd -= dt;
    if (this.cd <= 0 && this.g.monsters.list.length < S.maxAlive) {
      this.cd = Math.max(S.minGap, S.baseGap * Math.pow(S.gapPerSec, this.time)) * rand(0.75, 1.25);
      const pool = ['wolf'];
      if (this.time > 35) pool.push('bat');
      if (this.time > 70) pool.push('bat', 'ghost');
      if (this.time > 110) pool.push('ghost');
      const type = choice(pool);
      const packN = this.time >= S.packAfter
        ? Math.min(4, 2 + Math.floor((this.time - S.packAfter) / 50))
        : 1;
      const angle = rand(0, TAU); // 一群从同一方向压来
      for (let k = 0; k < packN; k++) {
        this.g.spawnMonster(type, {
          hpMul: this.hpMul(),
          angle: angle + rand(-0.3, 0.3), distJitter: rand(0, 100),
        });
      }
    }
  }
}
