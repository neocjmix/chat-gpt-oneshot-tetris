/* Pure game rules: no DOM, timers, storage, or network. */
(function (root) {
  'use strict';
  const WIDTH = 10, HEIGHT = 22, HIDDEN = 2, LOCK_DELAY = 500, MAX_RESETS = 15;
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  const COLORS = { I:'#62dbef', O:'#f5cd69', T:'#bd94fb', S:'#79dbb0', Z:'#fa8497', J:'#7f9dff', L:'#f8ac72' };
  // SRS offsets use positive-up Y. Convert to the board's positive-down Y below.
  const KICKS = {
    '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  };
  const I_KICKS = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  };
  const emptyRow = () => Array(WIDTH).fill(null);
  const cloneMatrix = matrix => matrix.map(row => row.slice());
  function rotateMatrix(matrix, direction = 1) {
    const n = matrix.length;
    return Array.from({length:n}, (_, y) => Array.from({length:n}, (_, x) =>
      direction > 0 ? matrix[n - 1 - x][y] : matrix[x][n - 1 - y]));
  }
  class Game {
    constructor({ random = Math.random } = {}) {
      if (typeof random !== 'function') throw new TypeError('random must be a function');
      this.random = random;
      this.reset();
    }
    reset() {
      this.board = Array.from({length:HEIGHT}, emptyRow);
      this.bag = [];
      this.next = [];
      this.active = null;
      this.holdType = null;
      this.holdUsed = false;
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.combo = -1;
      this.state = 'ready';
      this.fallTime = 0;
      this.lockTime = 0;
      this.lockResets = 0;
      this.events = [];
      this.fillQueue();
    }
    fillQueue() {
      while (this.next.length < 5) {
        if (!this.bag.length) {
          this.bag = Object.keys(SHAPES);
          for (let i = this.bag.length - 1; i > 0; i--) {
            const r = Math.max(0, Math.min(0.999999999, Number(this.random()) || 0));
            const j = Math.floor(r * (i + 1));
            [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
          }
        }
        this.next.push(this.bag.pop());
      }
    }
    start() {
      this.reset();
      this.state = 'running';
      this.spawn();
      this.events.push({type:'start'});
    }
    spawn(type = this.next.shift()) {
      this.fillQueue();
      const matrix = cloneMatrix(SHAPES[type]);
      this.active = { type, matrix, rotation:0, x:Math.floor((WIDTH - matrix.length) / 2), y:HIDDEN - 1 };
      this.fallTime = 0;
      this.lockTime = 0;
      this.lockResets = 0;
      if (this.collides(this.active)) this.finish();
    }
    cells(piece = this.active) {
      if (!piece) return [];
      const cells = [];
      piece.matrix.forEach((row, y) => row.forEach((filled, x) => {
        if (filled) cells.push({x:piece.x + x, y:piece.y + y, type:piece.type});
      }));
      return cells;
    }
    collides(piece) {
      return this.cells(piece).some(({x, y}) =>
        x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || Boolean(this.board[y][x]));
    }
    grounded() {
      return Boolean(this.active && this.collides({...this.active, y:this.active.y + 1}));
    }
    afterManipulation(wasGrounded) {
      if (wasGrounded && this.lockResets < MAX_RESETS) {
        this.lockTime = 0;
        this.lockResets++;
      }
      if (!this.grounded()) this.lockTime = 0;
    }
    move(direction) {
      if (this.state !== 'running' || ![-1, 1].includes(direction)) return false;
      const candidate = {...this.active, x:this.active.x + direction};
      if (this.collides(candidate)) return false;
      const wasGrounded = this.grounded();
      this.active = candidate;
      this.afterManipulation(wasGrounded);
      return true;
    }
    rotate(direction = 1) {
      if (this.state !== 'running' || this.active.type === 'O') return false;
      const from = this.active.rotation;
      const to = (from + (direction > 0 ? 1 : 3)) % 4;
      const matrix = rotateMatrix(this.active.matrix, direction);
      const offsets = (this.active.type === 'I' ? I_KICKS : KICKS)[`${from}>${to}`];
      const wasGrounded = this.grounded();
      for (const [dx, dy] of offsets) {
        const candidate = {...this.active, matrix, rotation:to, x:this.active.x + dx, y:this.active.y - dy};
        if (!this.collides(candidate)) {
          this.active = candidate;
          this.afterManipulation(wasGrounded);
          return true;
        }
      }
      return false;
    }
    softDrop() {
      if (this.state !== 'running') return false;
      const candidate = {...this.active, y:this.active.y + 1};
      if (this.collides(candidate)) return false;
      this.active = candidate;
      this.score++;
      this.fallTime = 0;
      this.lockTime = 0;
      return true;
    }
    ghost() {
      if (!this.active || this.collides(this.active)) return null;
      const result = {...this.active};
      while (!this.collides({...result, y:result.y + 1})) result.y++;
      return result;
    }
    hardDrop() {
      if (this.state !== 'running') return false;
      const target = this.ghost();
      if (!target) { this.finish(); return false; }
      const distance = target.y - this.active.y;
      this.active = target;
      this.score += distance * 2;
      this.events.push({type:'drop', distance});
      this.lock();
      return distance;
    }
    hold() {
      if (this.state !== 'running' || this.holdUsed) return false;
      const previous = this.holdType;
      this.holdType = this.active.type;
      if (previous) this.spawn(previous); else this.spawn();
      this.holdUsed = true;
      this.events.push({type:'hold'});
      return true;
    }
    lock() {
      if (this.state !== 'running') return;
      if (this.collides(this.active)) { this.finish(); return; }
      this.cells().forEach(({x, y, type}) => { this.board[y][x] = type; });
      this.events.push({type:'lock'});
      const cleared = [];
      this.board.forEach((row, y) => { if (row.every(Boolean)) cleared.push(y); });
      if (cleared.length) {
        this.board = this.board.filter(row => !row.every(Boolean));
        while (this.board.length < HEIGHT) this.board.unshift(emptyRow());
        this.combo++;
        const points = ([0,100,300,500,800][cleared.length] + 50 * this.combo) * this.level;
        this.score += points;
        this.lines += cleared.length;
        this.level = 1 + Math.floor(this.lines / 10);
        this.events.push({type:'clear', rows:cleared, count:cleared.length, points, combo:this.combo});
      } else this.combo = -1;
      this.holdUsed = false;
      if (this.board.slice(0, HIDDEN).some(row => row.some(Boolean))) this.finish();
      else this.spawn();
    }
    get gravity() { return Math.max(55, 800 * Math.pow(0.82, this.level - 1)); }
    tick(milliseconds) {
      if (this.state !== 'running') return;
      const dt = Math.max(0, Math.min(100, Number(milliseconds) || 0));
      this.fallTime += dt;
      while (this.fallTime >= this.gravity) {
        this.fallTime -= this.gravity;
        const candidate = {...this.active, y:this.active.y + 1};
        if (this.collides(candidate)) { this.fallTime = 0; break; }
        this.active = candidate;
      }
      if (this.grounded()) {
        this.lockTime += dt;
        if (this.lockTime >= LOCK_DELAY) this.lock();
      } else this.lockTime = 0;
    }
    pause() {
      if (this.state !== 'running') return false;
      this.state = 'paused';
      return true;
    }
    resume() {
      if (this.state !== 'paused') return false;
      this.state = 'running';
      return true;
    }
    finish() {
      if (this.state === 'over') return;
      this.state = 'over';
      this.events.push({type:'over', score:this.score});
    }
    drainEvents() {
      const result = this.events;
      this.events = [];
      return result;
    }
  }
  const api = {Game, SHAPES, COLORS, WIDTH, HEIGHT, HIDDEN, LOCK_DELAY, MAX_RESETS, rotateMatrix};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PocketTetris = api;
})(typeof globalThis === 'object' ? globalThis : this);
