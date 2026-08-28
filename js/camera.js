'use strict';
// ===== 打击感核心：震屏 + 顿帧（hit-stop）=====
// 顿帧期间游戏逻辑 dt=0（世界冻结数帧），震屏按真实时间衰减
const Cam = {
  pow: 0, t: 0, dur: 0, hitStopT: 0, ox: 0, oy: 0,

  shake(pow, dur = 0.3) {
    if (!CFG.feel.shake) return;
    if (pow >= this.pow) { this.pow = pow; this.dur = dur; this.t = dur; }
  },
  hitStop(t) { if (CFG.feel.hitStop) this.hitStopT = Math.max(this.hitStopT, t); },

  update(dt) {
    if (this.t > 0) {
      this.t -= dt;
      const k = this.pow * Math.max(0, this.t / this.dur);
      this.ox = rand(-k, k); this.oy = rand(-k, k);
    } else {
      this.ox = this.oy = 0; this.pow = 0;
    }
  },

  reset() { this.pow = this.t = this.hitStopT = 0; this.ox = this.oy = 0; },
};
