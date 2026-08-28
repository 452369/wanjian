'use strict';
// ===== 对象池：飞剑/子弹/粒子/飘字等高频对象复用，避免 GC 抖动 =====
class Pool {
  constructor(factory) { this.factory = factory; this.store = []; }
  get() { return this.store.pop() || this.factory(); }
  put(o) { this.store.push(o); }
}

// 带存活标记的实体数组：update 里标 dead，sweep 统一回收
class EntityList {
  constructor(pool) { this.list = []; this.pool = pool; }
  spawn(init) {
    const e = this.pool.get();
    init(e);
    e.dead = false;
    this.list.push(e);
    return e;
  }
  sweep(onFree) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      if (l[i].dead) {
        const e = l.splice(i, 1)[0];
        if (onFree) onFree(e);
        this.pool.put(e);
      }
    }
  }
  clear(onFree) {
    for (const e of this.list) { if (onFree) onFree(e); this.pool.put(e); }
    this.list.length = 0;
  }
}
