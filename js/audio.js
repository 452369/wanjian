'use strict';
// ===== 纯 WebAudio 合成音效：零素材依赖 =====
// 浏览器自动播放策略：首次用户手势后才 init/resume
const AudioSys = {
  ctx: null, out: null, muted: false, _t: {},

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.6;
      const comp = this.ctx.createDynamicsCompressor(); // 压缩器：满屏音效叠加不爆音
      comp.threshold.value = -18; comp.ratio.value = 6;
      this.out.connect(comp); comp.connect(this.ctx.destination);
    } catch (e) { /* 无音频环境静默降级 */ }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggle() { this.muted = !this.muted; if (this.out) this.out.gain.value = this.muted ? 0 : 0.6; return this.muted; },

  throttle(name, ms) {
    const now = performance.now();
    if (this._t[name] && now - this._t[name] < ms) return true;
    this._t[name] = now;
    return false;
  },

  // 基础音：{type, f0, f1, dur, vol, delay}
  tone(o) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay || 0);
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    g.gain.setValueAtTime(o.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    osc.connect(g); g.connect(this.out);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
  },

  // 噪声：{dur, vol, f0, f1, q, delay}
  noise(o) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay || 0);
    const len = Math.ceil(this.ctx.sampleRate * o.dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(o.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t0);
  },

  // ---- 游戏音效 ----
  shoot() { // 齐射：金属.ping + 噪声扫频双层，随机音高防重复疲劳
    if (this.throttle('shoot', 90)) return;
    const dt = rand(0.94, 1.07);
    this.noise({ dur: 0.09, vol: 0.06, f0: 2600 * dt, f1: 900, q: 2 });
    this.tone({ type: 'triangle', f0: 1900 * dt, f1: 700, dur: 0.07, vol: 0.035 });
  },
  // 连击越高命中音调越高（核心爽感机关）
  hit(combo) { // 命中：打击点 + 低频肉感 + 噪声脆响，连击升调
    if (this.throttle('hit', 30)) return;
    const p = 1 + Math.min(combo || 0, 24) * 0.045;
    this.tone({ type: 'square', f0: 520 * p, f1: 260 * p, dur: 0.06, vol: 0.07 });
    this.tone({ type: 'sine', f0: 95 * p, f1: 55, dur: 0.09, vol: 0.16 }); // 低频肉感
    this.noise({ dur: 0.04, vol: 0.1, f0: 3200 * p, f1: 1400, q: 1.5 });
  },
  kill() { this.tone({ type: 'triangle', f0: 700, f1: 140, dur: 0.16, vol: 0.12 }); this.noise({ dur: 0.1, vol: 0.06, f0: 900, f1: 300 }); },
  crit() { if (this.throttle('crit', 60)) return; this.tone({ type: 'sawtooth', f0: 900, f1: 180, dur: 0.14, vol: 0.1 }); },
  hurt() { this.tone({ type: 'sawtooth', f0: 160, f1: 70, dur: 0.25, vol: 0.22 }); this.noise({ dur: 0.15, vol: 0.12, f0: 500, f1: 120 }); },
  eshoot() { if (this.throttle('eshoot', 120)) return; this.tone({ type: 'sawtooth', f0: 320, f1: 180, dur: 0.1, vol: 0.05 }); },
  levelup() { // 五音琶音 + 高八度回应
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.13, vol: 0.11, delay: i * 0.06 }));
    this.tone({ type: 'sine', f0: 2093, dur: 0.3, vol: 0.05, delay: 0.32 });
  },
  // 剑吟长音：剑品晋升
  tierUp() {
    this.tone({ type: 'sine', f0: 300, f1: 900, dur: 0.5, vol: 0.14 });
    this.tone({ type: 'sine', f0: 450, f1: 1350, dur: 0.5, vol: 0.08, delay: 0.05 });
    this.noise({ dur: 0.4, vol: 0.05, f0: 2000, f1: 5000 });
  },
  boom() { // 大爆炸：低频下潜 + 长噪声衰减 + 延迟余 rumble
    this.noise({ dur: 0.7, vol: 0.3, f0: 700, f1: 60, q: 0.7 });
    this.tone({ type: 'sine', f0: 120, f1: 30, dur: 0.7, vol: 0.3 });
    this.tone({ type: 'sine', f0: 48, f1: 26, dur: 0.9, vol: 0.22, delay: 0.05 });
    this.noise({ dur: 1.1, vol: 0.1, f0: 160, f1: 40, q: 0.6, delay: 0.08 });
  },
  pickup() { if (this.throttle('pickup', 60)) return; this.tone({ type: 'square', f0: 880, dur: 0.07, vol: 0.08 }); this.tone({ type: 'square', f0: 1320, dur: 0.1, vol: 0.08, delay: 0.06 }); },
  click() { this.tone({ type: 'triangle', f0: 660, f1: 880, dur: 0.06, vol: 0.08 }); },
};
