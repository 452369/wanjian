'use strict';
// ===== 输入：指尖拖动（增量位移，手指不挡角色）+ 键盘方向键（桌面调试）=====
const Input = {
  down: false, dx: 0, dy: 0, _lx: 0, _ly: 0, taps: [], keys: {},

  init(cv) {
    const toLogic = (cx, cy) => {
      const r = cv.getBoundingClientRect();
      return {
        x: (cx - r.left) * (CFG.view.w / r.width),
        y: (cy - r.top) * (CFG.view.h / r.height),
      };
    };
    cv.addEventListener('pointerdown', e => {
      AudioSys.init(); AudioSys.resume();
      const p = toLogic(e.clientX, e.clientY);
      this.down = true; this._lx = p.x; this._ly = p.y;
      this.taps.push(p);
      e.preventDefault();
    });
    // move/up 挂在 window：手指划出画布不丢事件
    window.addEventListener('pointermove', e => {
      if (!this.down) return;
      const p = toLogic(e.clientX, e.clientY);
      this.dx += p.x - this._lx; this.dy += p.y - this._ly;
      this._lx = p.x; this._ly = p.y;
    });
    const up = () => { this.down = false; };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    addEventListener('keydown', e => {
      this.keys[e.key] = true;
      if (e.key === 'Enter' || e.key === ' ') window.dispatchEvent(new CustomEvent('uikey', { detail: e.key }));
      if (['1', '2', '3'].includes(e.key)) window.dispatchEvent(new CustomEvent('uikey', { detail: e.key }));
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.key] = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  },

  consumeDelta() { const d = { x: this.dx, y: this.dy }; this.dx = this.dy = 0; return d; },

  // 键盘虚拟摇杆（对角归一化）
  keyAxis() {
    const k = this.keys; let x = 0, y = 0;
    if (k.ArrowLeft || k.a) x -= 1;
    if (k.ArrowRight || k.d) x += 1;
    if (k.ArrowUp || k.w) y -= 1;
    if (k.ArrowDown || k.s) y += 1;
    if (x && y) { x *= 0.7071; y *= 0.7071; }
    return { x, y };
  },

  takeTaps() { const t = this.taps; this.taps = []; return t; },
};
