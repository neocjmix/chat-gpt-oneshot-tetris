'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {Game, SHAPES, WIDTH, HEIGHT, HIDDEN, MAX_RESETS, rotateMatrix} = require('../site/engine.js');
const empty = () => Array.from({length:HEIGHT}, () => Array(WIDTH).fill(null));
const occupied = game => game.board.flat().filter(Boolean).length;
function fresh() { const game = new Game({random:() => 0.42}); game.start(); return game; }
function prepareClear(game, count) {
  game.board = empty();
  for (let y = HEIGHT - count; y < HEIGHT; y++) { game.board[y].fill('J'); game.board[y][4] = null; }
  game.active = {type:'I', matrix:rotateMatrix(SHAPES.I), rotation:1, x:2, y:HEIGHT - 4};
}

test('exactly seven tetrominoes, each containing four squares', () => {
  assert.deepEqual(Object.keys(SHAPES).sort(), ['I','J','L','O','S','T','Z']);
  for (const matrix of Object.values(SHAPES)) assert.equal(matrix.flat().reduce((a, b) => a + b), 4);
});
test('board dimensions include two independent hidden rows', () => {
  const game = fresh();
  assert.equal(game.board.length, 22);
  assert.equal(HEIGHT - HIDDEN, 20);
  assert.ok(game.board.every(row => row.length === 10));
  game.board[0][0] = 'I';
  assert.equal(game.board[1][0], null);
});
test('each group of seven supplied pieces is a permutation', () => {
  const game = fresh(), types = [];
  for (let i = 0; i < 28; i++) { types.push(game.active.type); game.spawn(); }
  for (let i = 0; i < types.length; i += 7) assert.equal(new Set(types.slice(i, i + 7)).size, 7);
  assert.ok(game.next.length >= 3);
});
test('four rotations restore every matrix', () => {
  for (const type of Object.keys(SHAPES)) {
    const game = fresh(); game.spawn(type); game.active.y = 6;
    const before = JSON.stringify(game.active);
    for (let i = 0; i < 4; i++) game.rotate(1);
    assert.equal(JSON.stringify(game.active), before, type);
  }
});
test('clockwise followed by counterclockwise restores a free piece', () => {
  const game = fresh(); game.spawn('T'); game.active.y = 6;
  const before = JSON.stringify(game.active);
  assert.equal(game.rotate(1), true);
  assert.equal(game.rotate(-1), true);
  assert.equal(JSON.stringify(game.active), before);
});
test('movement stops at both walls without corrupting state', () => {
  const game = fresh(); game.spawn('O');
  for (let i = 0; i < 20; i++) game.move(-1);
  assert.equal(game.active.x, 0);
  assert.equal(game.move(-1), false);
  for (let i = 0; i < 20; i++) game.move(1);
  assert.equal(game.active.x, 8);
  assert.equal(game.move(1), false);
  assert.equal(game.collides(game.active), false);
});
test('T piece kicks away from the left wall', () => {
  const game = fresh(); game.spawn('T'); game.active.y = 6;
  game.rotate(1);
  while (game.move(-1)) { /* Move until blocked. */ }
  assert.equal(game.active.x, -1);
  assert.equal(game.rotate(-1), true);
  assert.equal(game.active.x, 0);
  assert.equal(game.collides(game.active), false);
});
test('I piece uses its two-cell wall kick', () => {
  const game = fresh(); game.spawn('I'); game.active.y = 6;
  game.rotate(1);
  while (game.move(-1)) { /* Move until blocked. */ }
  assert.equal(game.active.x, -2);
  assert.equal(game.rotate(-1), true);
  assert.equal(game.active.x, 0);
});
test('T and I can rotate off the floor with an upward kick', () => {
  for (const type of ['T', 'I']) {
    const game = fresh(); game.spawn(type); game.active.y = HEIGHT - 2;
    assert.equal(game.collides(game.active), false);
    assert.equal(game.rotate(1), true, type);
    assert.ok(game.active.y < HEIGHT - 2);
    assert.equal(game.collides(game.active), false);
  }
});
test('rotation into an enclosing stack is rejected atomically', () => {
  const game = fresh(); game.spawn('T'); game.active.y = 7;
  game.board = Array.from({length:HEIGHT}, () => Array(WIDTH).fill('J'));
  game.cells().forEach(({x, y}) => { game.board[y][x] = null; });
  const before = JSON.stringify(game.active);
  assert.equal(game.rotate(1), false);
  assert.equal(JSON.stringify(game.active), before);
});
test('soft drop advances one row and adds exactly one point', () => {
  const game = fresh(), y = game.active.y;
  assert.equal(game.softDrop(), true);
  assert.equal(game.active.y, y + 1);
  assert.equal(game.score, 1);
});
test('blocked soft drop neither scores nor locks immediately', () => {
  const game = fresh(); game.active = game.ghost();
  assert.equal(game.softDrop(), false);
  assert.equal(game.score, 0);
  assert.equal(occupied(game), 0);
  assert.equal(game.state, 'running');
});
for (const type of Object.keys(SHAPES)) {
  test(`${type}: hard drop matches the ghost, locks four cells and scores distance`, () => {
    const game = fresh(); game.spawn(type);
    const target = game.ghost(), cells = game.cells(target), distance = target.y - game.active.y;
    assert.equal(game.hardDrop(), distance);
    assert.equal(game.score, distance * 2);
    assert.equal(occupied(game), 4);
    cells.forEach(({x, y}) => assert.equal(game.board[y][x], type));
    assert.equal(game.state, 'running');
    assert.equal(game.collides(game.active), false);
  });
}
for (let count = 1; count <= 4; count++) {
  test(`clearing ${count} line(s) compacts the board and awards the right score`, () => {
    const game = fresh(); prepareClear(game, count); game.lock();
    assert.equal(game.lines, count);
    assert.equal(game.score, [0,100,300,500,800][count]);
    assert.equal(occupied(game), 4 - count);
    assert.equal(game.board.length, HEIGHT);
    assert.ok(game.board.every(row => !row.every(Boolean)));
    const event = game.drainEvents().find(item => item.type === 'clear');
    assert.equal(event.count, count);
  });
}
test('line score uses the old level, then ten lines increases speed', () => {
  const game = fresh(); game.lines = 9;
  const speed = game.gravity;
  prepareClear(game, 1); game.lock();
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
  assert.equal(game.score, 100);
  assert.ok(game.gravity < speed);
});
test('combo bonuses apply only to consecutive line-clearing locks', () => {
  const game = fresh();
  prepareClear(game, 1); game.lock();
  prepareClear(game, 1); game.lock();
  assert.equal(game.score, 250);
  assert.equal(game.combo, 1);
  game.board = empty(); game.spawn('O'); game.hardDrop();
  assert.equal(game.combo, -1);
  const previous = game.score;
  prepareClear(game, 1); game.lock();
  assert.equal(game.score - previous, 100);
});
test('hold is limited to once per piece and swapping resets orientation', () => {
  const game = fresh(), first = game.active.type;
  assert.equal(game.hold(), true);
  assert.equal(game.holdType, first);
  assert.equal(game.hold(), false);
  game.hardDrop();
  assert.equal(game.holdUsed, false);
  const current = game.active.type, queue = game.next.slice();
  assert.equal(game.hold(), true);
  assert.equal(game.active.type, first);
  assert.equal(game.holdType, current);
  assert.equal(game.active.rotation, 0);
  assert.deepEqual(game.next, queue);
});
test('gravity advances only when its accumulated interval has elapsed', () => {
  const game = fresh(), y = game.active.y;
  for (let i = 0; i < 7; i++) game.tick(100);
  assert.equal(game.active.y, y);
  game.tick(100);
  assert.equal(game.active.y, y + 1);
});
test('grounded piece remains movable until the 500ms lock delay', () => {
  const game = fresh(); game.spawn('O'); game.active.y = HEIGHT - 2;
  for (let i = 0; i < 4; i++) game.tick(100);
  assert.equal(occupied(game), 0);
  game.tick(100);
  assert.equal(occupied(game), 4);
});
test('grounded movement stops resetting the lock timer after fifteen resets', () => {
  const game = fresh(); game.spawn('O'); game.active.y = HEIGHT - 2;
  for (let i = 0; i < MAX_RESETS; i++) { game.tick(100); assert.equal(game.move(i % 2 ? -1 : 1), true); }
  assert.equal(game.lockResets, MAX_RESETS);
  assert.equal(game.lockTime, 0);
  game.tick(100); game.move(-1);
  assert.equal(game.lockTime, 100);
  for (let i = 0; i < 4; i++) game.tick(100);
  assert.equal(occupied(game), 4);
});
test('a blocked movement does not renew lock delay', () => {
  const game = fresh(); game.spawn('O'); game.active.x = 0; game.active.y = HEIGHT - 2;
  for (let i = 0; i < 4; i++) game.tick(100);
  assert.equal(game.move(-1), false);
  assert.equal(game.lockTime, 400);
  game.tick(100);
  assert.equal(occupied(game), 4);
});
test('pause blocks time, movement, rotation, drops and hold', () => {
  const game = fresh(), before = JSON.stringify(game.active);
  assert.equal(game.pause(), true);
  game.tick(1000);
  assert.equal(game.move(1), false);
  assert.equal(game.rotate(1), false);
  assert.equal(game.softDrop(), false);
  assert.equal(game.hardDrop(), false);
  assert.equal(game.hold(), false);
  assert.equal(JSON.stringify(game.active), before);
  assert.equal(game.score, 0);
  assert.equal(game.resume(), true);
  assert.equal(game.softDrop(), true);
});
test('blocked spawn ends the game and restart clears all round state', () => {
  const game = fresh();
  game.board[1].fill('Z'); game.board[2].fill('Z'); game.spawn('T');
  assert.equal(game.state, 'over');
  assert.ok(game.drainEvents().some(event => event.type === 'over'));
  assert.equal(game.move(1), false);
  game.start();
  assert.equal(game.state, 'running');
  assert.equal(occupied(game), 0);
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.equal(game.holdType, null);
});
test('blocks left in hidden rows after locking trigger top-out', () => {
  const game = fresh(); game.spawn('O'); game.active.y = 0; game.lock();
  assert.equal(game.state, 'over');
});
test('a held piece that cannot spawn also triggers game over', () => {
  const game = fresh(); game.holdType = 'T';
  game.board[1].fill('J'); game.board[2].fill('J'); game.hold();
  assert.equal(game.state, 'over');
});
test('invalid or long time deltas cannot fast-forward a background game', () => {
  const game = fresh(), before = game.active.y;
  game.tick(NaN); game.tick(-100);
  assert.equal(game.fallTime, 0);
  game.tick(60000);
  assert.equal(game.fallTime, 100);
  assert.equal(game.active.y, before);
});
test('event queues are drained rather than replayed', () => {
  const game = fresh();
  assert.equal(game.drainEvents()[0].type, 'start');
  assert.deepEqual(game.drainEvents(), []);
  game.hardDrop();
  assert.deepEqual(game.drainEvents().map(event => event.type), ['drop', 'lock']);
  assert.deepEqual(game.drainEvents(), []);
});
test('5000 deterministic input steps preserve board and collision invariants', () => {
  let seed = 314159;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const game = new Game({random}); game.start();
  const types = new Set([null, ...Object.keys(SHAPES)]);
  for (let i = 0; i < 5000; i++) {
    if (game.state === 'over') game.start();
    switch (Math.floor(random() * 8)) {
      case 0: game.move(-1); break;
      case 1: game.move(1); break;
      case 2: game.rotate(1); break;
      case 3: game.rotate(-1); break;
      case 4: game.softDrop(); break;
      case 5: game.hardDrop(); break;
      case 6: game.hold(); break;
      default: break;
    }
    game.tick(50);
    assert.equal(game.board.length, HEIGHT);
    assert.ok(game.board.every(row => row.length === WIDTH && row.every(value => types.has(value))));
    if (game.state === 'running') assert.equal(game.collides(game.active), false);
    assert.ok(Number.isSafeInteger(game.score) && game.score >= 0);
    game.drainEvents();
  }
});
test('HTML assets exist and all literal browser-adapter IDs are present', () => {
  const site = path.join(__dirname, '..', 'site');
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(site, 'app.js'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)].map(match => match[1]);
  assert.equal(assets.length, 4);
  assets.forEach(asset => assert.ok(fs.existsSync(path.join(site, asset)), asset));
  const ids = new Set([...html.matchAll(/\bid="([^\"]+)"/g)].map(match => match[1]));
  for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(match[1]), `Missing DOM id: ${match[1]}`);
  assert.doesNotMatch(html, /<script[^>]+src="(?:https?:)?\/\//);
});
