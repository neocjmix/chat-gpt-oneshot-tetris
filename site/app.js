/* Browser adapter. All gameplay rules live in engine.js. */
(function () {
  'use strict';
  const {Game, SHAPES, COLORS, WIDTH, HEIGHT, HIDDEN, LOCK_DELAY} = window.PocketTetris;
  const $ = id => document.getElementById(id);
  const game = new Game();
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const stage = $('stage'), shell = $('board-shell'), rail = $('rail');
  const menu = $('menu'), controls = $('controls');
  const buttons = Array.from(controls.querySelectorAll('[data-action]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pressed = new Map();
  const repeat = {left:[160,45], right:[160,45], soft:[100,35]};
  const keyActions = {
    ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
    ArrowDown:'soft', KeyS:'soft', ArrowUp:'cw', KeyW:'cw', KeyX:'cw',
    KeyZ:'ccw', Space:'hard', KeyC:'hold', ShiftLeft:'hold', ShiftRight:'hold'
  };
  const storageKeys = {best:'night-shift.best.v1', sound:'night-shift.sound.v1'};
  function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function write(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) { /* Storage is optional. */ } }
  const savedBest = Number(read(storageKeys.best));
  let best = Number.isSafeInteger(savedBest) && savedBest >= 0 ? savedBest : 0;
  let bestAtStart = best, lastSavedBest = best;
  let muted = read(storageKeys.sound) !== 'on';
  let audio = null, cell = 15, pixelRatio = 1;
  let lastState = '', previewKey = '', pressOrder = 0;
  let flash = null, toastUntil = 0, previousTime = performance.now();
  const number = value => value.toLocaleString('en-US');

  function saveBest() {
    if (best !== lastSavedBest) { write(storageKeys.best, best); lastSavedBest = best; }
  }
  function unlockAudio() {
    if (muted) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!audio && Context) audio = new Context();
      if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    } catch (_) { /* Audio support must never gate a game. */ }
  }
  function tone(frequency, duration = 0.07, delay = 0) {
    if (muted || !audio || audio.state !== 'running') return;
    try {
      const start = audio.currentTime + delay;
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch (_) { /* Some browsers suspend audio during interruptions. */ }
  }
  function syncSound() {
    $('sound-label').textContent = muted ? 'OFF' : 'ON';
    $('sound').setAttribute('aria-pressed', String(!muted));
    $('sound').setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
  }
  $('sound').addEventListener('click', () => {
    muted = !muted;
    write(storageKeys.sound, muted ? 'off' : 'on');
    syncSound();
    unlockAudio();
    tone(523);
  });

  function refreshPressed() {
    buttons.forEach(button => {
      button.classList.toggle('is-held', Array.from(pressed.values()).some(item => item.action === button.dataset.action));
    });
  }
  function clearInput() { pressed.clear(); refreshPressed(); }
  function release(id) { if (pressed.delete(id)) refreshPressed(); }
  function fitNumbers() {
    const landscape = window.matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
    const base = landscape ? 14 : Math.min(22, Math.max(15, window.innerWidth * 0.045));
    ['score', 'best', 'level', 'lines'].forEach(id => {
      const output = $(id);
      const fit = output.clientWidth / Math.max(1, output.textContent.length * 0.64);
      output.style.fontSize = `${Math.max(8, Math.min(base, fit))}px`;
    });
  }
  function setNumber(id, value) {
    if ($(id).textContent !== value) { $(id).textContent = value; return true; }
    return false;
  }
  function openMenu(state) {
    $('restart').hidden = state !== 'paused';
    $('final-stats').hidden = state === 'ready';
    $('final-score').textContent = number(game.score);
    $('help').open = false;
    if (state === 'ready') {
      $('menu-kicker').textContent = 'ONE MORE LINE';
      $('menu-title').innerHTML = '작은 틈에,<br>한 판.';
      $('menu-copy').textContent = '7가지 조각으로 만드는 작은 질서.\n가볍게 시작하고, 한 줄 더.';
      $('play-label').textContent = '시작하기';
    } else if (state === 'paused') {
      $('menu-kicker').textContent = 'TAKE A BREATH';
      $('menu-title').textContent = '잠깐, 숨 고르기.';
      $('menu-copy').textContent = '조각은 그대로 기다리고 있어요.\n준비되면 이어서 플레이하세요.';
      $('play-label').textContent = '계속하기';
    } else {
      $('menu-kicker').textContent = game.score > bestAtStart ? 'NEW PERSONAL BEST' : 'GAME OVER';
      $('menu-title').textContent = '한 줄 더?';
      $('menu-copy').textContent = `${game.lines}줄을 정리했어요.\n다음 한 판은 조금 더 멀리.`;
      $('play-label').textContent = '다시 플레이';
    }
    if (!menu.open) menu.showModal();
    $('play').focus({preventScroll:true});
  }
  function announce(message) { $('announcer').textContent = message; }
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastUntil = performance.now() + 1100;
  }
  function sync() {
    best = Math.max(best, game.score);
    let changed = setNumber('score', number(game.score));
    changed = setNumber('best', number(best)) || changed;
    changed = setNumber('level', String(game.level).padStart(2, '0')) || changed;
    changed = setNumber('lines', number(game.lines)) || changed;
    if (changed) fitNumbers();
    $('level-progress').value = game.lines % 10;
    $('level-progress').setAttribute('aria-valuetext', `다음 레벨까지 ${10 - game.lines % 10}줄`);
    buttons.forEach(button => {
      const disabled = game.state !== 'running' || (button.dataset.action === 'hold' && game.holdUsed);
      if (button.disabled !== disabled) button.disabled = disabled;
    });
    $('hold-card').classList.toggle('is-used', game.holdUsed);
    const key = `${game.holdType}/${game.next.slice(0, 3).join('')}`;
    if (key !== previewKey) { previewKey = key; drawPreviews(); }
    const events = game.drainEvents();
    const hasClear = events.some(event => event.type === 'clear');
    events.forEach(event => {
      if (event.type === 'clear') {
        if (!reducedMotion.matches) flash = {rows:event.rows, until:performance.now() + 200};
        const title = event.count === 4 ? 'FOUR LINES!' : `${event.count} LINE${event.count > 1 ? 'S' : ''}`;
        toast(`${title}\n+${number(event.points)}${event.combo > 0 ? ` · ${event.combo + 1} COMBO` : ''}`);
        announce(`${event.count}줄 삭제, ${event.points}점 획득. 점수 ${game.score}, 레벨 ${game.level}.`);
        [523,659,784,1047].slice(0, event.count + 1).forEach((hz, i) => tone(hz, 0.12, i * 0.055));
      }
      if (event.type === 'lock') { saveBest(); if (!hasClear) tone(140, 0.045); }
      if (event.type === 'hold') tone(350, 0.035);
      if (event.type === 'over') { saveBest(); tone(220, 0.16); tone(147, 0.2, 0.13); }
    });
    if (lastState !== game.state) {
      lastState = game.state;
      if (game.state !== 'running') {
        clearInput();
        saveBest();
        openMenu(game.state);
        if (game.state === 'over') announce(`게임 종료. 점수 ${game.score}, 삭제한 줄 ${game.lines}.`);
        if (game.state === 'paused') announce('일시정지되었습니다.');
      }
    }
  }
  function startOrResume(forceNew = false) {
    clearInput();
    unlockAudio();
    if (!forceNew && game.state === 'paused') game.resume();
    else { bestAtStart = best; game.start(); flash = null; toastUntil = 0; $('toast').classList.remove('visible'); }
    menu.close();
    previousTime = performance.now();
    sync();
    draw(previousTime);
    canvas.focus({preventScroll:true});
    announce('게임을 시작합니다.');
  }
  function pause() {
    clearInput();
    if (game.pause()) { sync(); draw(performance.now()); }
  }
  $('play').addEventListener('click', () => startOrResume());
  $('restart').addEventListener('click', () => startOrResume(true));
  $('pause').addEventListener('click', pause);
  menu.addEventListener('cancel', event => {
    event.preventDefault();
    if (game.state === 'paused') startOrResume();
  });

  function perform(action) {
    if (game.state !== 'running') return;
    switch (action) {
      case 'left': game.move(-1); break;
      case 'right': game.move(1); break;
      case 'soft': game.softDrop(); break;
      case 'cw': game.rotate(1); break;
      case 'ccw': game.rotate(-1); break;
      case 'hard': game.hardDrop(); break;
      case 'hold': game.hold(); break;
      default: return;
    }
    sync();
    draw(performance.now());
  }
  function press(id, action) {
    if (pressed.has(id) || game.state !== 'running') return;
    unlockAudio();
    pressed.set(id, {action, order:++pressOrder, next:performance.now() + (repeat[action]?.[0] ?? Infinity)});
    refreshPressed();
    perform(action);
  }
  buttons.forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' && event.button !== 0) return;
      event.preventDefault();
      if (button.disabled) return;
      try { button.setPointerCapture(event.pointerId); } catch (_) { /* Global release listeners remain active. */ }
      press(`p${event.pointerId}`, button.dataset.action);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      button.addEventListener(type, event => release(`p${event.pointerId}`));
    });
    // Keyboard/assistive-technology clicks have detail=0. Pointer clicks were handled on down.
    button.addEventListener('click', event => {
      if (event.detail === 0 && !button.disabled) { unlockAudio(); perform(button.dataset.action); }
    });
  });
  window.addEventListener('pointerup', event => release(`p${event.pointerId}`));
  window.addEventListener('pointercancel', event => release(`p${event.pointerId}`));
  controls.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (menu.open) {
      if (event.code === 'KeyP' && game.state === 'paused' && !event.repeat) { event.preventDefault(); startOrResume(); }
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) pause();
      return;
    }
    const action = keyActions[event.code];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) press(`k${event.code}`, action);
  });
  window.addEventListener('keyup', event => release(`k${event.code}`));
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { pause(); saveBest(); });
  function advanceRepeats(now) {
    const horizontal = Array.from(pressed.values()).filter(item => item.action === 'left' || item.action === 'right');
    const newest = horizontal.reduce((current, item) => Math.max(current, item.order), -1);
    for (const item of pressed.values()) {
      const timing = repeat[item.action];
      if (!timing) continue;
      if ((item.action === 'left' || item.action === 'right') && item.order !== newest) { item.next = now + timing[1]; continue; }
      let count = 0;
      while (now >= item.next && count < 4 && game.state === 'running') {
        perform(item.action);
        item.next += timing[1];
        count++;
      }
      if (count === 4) item.next = now + timing[1];
    }
  }

  function block(context, x, y, size, color, ghost = false) {
    const gap = Math.max(1, size * 0.045), side = size - gap * 2;
    context.save();
    if (ghost) {
      context.globalAlpha = 0.1;
      context.fillStyle = color;
      context.fillRect(x + gap, y + gap, side, side);
      context.globalAlpha = 0.55;
      context.strokeStyle = color;
      context.lineWidth = Math.max(1, size * 0.055);
      context.strokeRect(x + gap + 0.5, y + gap + 0.5, side - 1, side - 1);
    } else {
      context.fillStyle = color;
      context.fillRect(x + gap, y + gap, side, side);
      context.fillStyle = '#ffffff55';
      context.fillRect(x + gap, y + gap, side, Math.max(1, size * 0.09));
      context.fillStyle = '#00000025';
      context.fillRect(x + gap, y + size - gap - Math.max(1, size * 0.09), side, Math.max(1, size * 0.09));
      context.strokeStyle = '#ffffff22';
      context.lineWidth = 1;
      context.strokeRect(x + gap + size * 0.2, y + gap + size * 0.2, side - size * 0.4, side - size * 0.4);
    }
    context.restore();
  }
  function drawPiece(piece, ghost = false) {
    game.cells(piece).forEach(({x, y, type}) => {
      if (y >= HIDDEN && y < HEIGHT) block(ctx, x * cell, (y - HIDDEN) * cell, cell, COLORS[type], ghost);
    });
  }
  function draw(now) {
    const w = WIDTH * cell, h = (HEIGHT - HIDDEN) * cell;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#080f1b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b8ccec09';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < WIDTH; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, h); }
    for (let y = 1; y < HEIGHT - HIDDEN; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(w, y * cell + 0.5); }
    ctx.stroke();
    game.board.forEach((row, y) => row.forEach((type, x) => {
      if (type && y >= HIDDEN) block(ctx, x * cell, (y - HIDDEN) * cell, cell, COLORS[type]);
    }));
    if (game.active && game.state !== 'over') {
      const ghost = game.ghost();
      if (ghost && ghost.y !== game.active.y) drawPiece(ghost, true);
      drawPiece(game.active);
      if (game.grounded()) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.65 * game.lockTime / LOCK_DELAY})`;
        ctx.lineWidth = 1.5;
        game.cells().forEach(({x, y}) => {
          if (y >= HIDDEN) ctx.strokeRect(x * cell + 1, (y - HIDDEN) * cell + 1, cell - 2, cell - 2);
        });
        ctx.restore();
      }
    }
    if (flash) {
      const remaining = (flash.until - now) / 200;
      if (remaining > 0) {
        ctx.fillStyle = `rgba(235,255,243,${remaining * 0.4})`;
        flash.rows.forEach(y => { if (y >= HIDDEN) ctx.fillRect(0, (y - HIDDEN) * cell, w, cell); });
      } else flash = null;
    }
  }
  function previewContext(element, height) {
    element.width = Math.round(96 * pixelRatio);
    element.height = Math.round(height * pixelRatio);
    const context = element.getContext('2d');
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, 96, height);
    return context;
  }
  function miniPiece(context, type, centerY) {
    const cells = [];
    SHAPES[type].forEach((row, y) => row.forEach((value, x) => { if (value) cells.push([x, y]); }));
    const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const size = 17, width = Math.max(...xs) - minX + 1, height = Math.max(...ys) - minY + 1;
    const ox = (96 - width * size) / 2, oy = centerY - height * size / 2;
    cells.forEach(([x, y]) => block(context, ox + (x - minX) * size, oy + (y - minY) * size, size, COLORS[type]));
  }
  function drawPreviews() {
    const holdContext = previewContext($('hold'), 64);
    if (game.holdType) miniPiece(holdContext, game.holdType, 32);
    else { holdContext.fillStyle = '#52637d'; holdContext.font = '20px sans-serif'; holdContext.textAlign = 'center'; holdContext.fillText('—', 48, 39); }
    const nextContext = previewContext($('next'), 216);
    game.next.slice(0, 3).forEach((type, i) => miniPiece(nextContext, type, 36 + i * 72));
    $('hold').setAttribute('aria-label', game.holdType ? `보관된 조각 ${game.holdType}` : '보관된 조각 없음');
    $('next').setAttribute('aria-label', `다음 조각 ${game.next.slice(0, 3).join(', ')}`);
  }
  function resize() {
    const gap = parseFloat(getComputedStyle(stage).columnGap) || 12;
    const height = Math.max(1, stage.clientHeight - 2);
    const width = Math.max(1, stage.clientWidth - rail.offsetWidth - gap - 2);
    cell = Math.max(1, Math.floor(Math.min(32, width / WIDTH, height / (HEIGHT - HIDDEN))));
    const w = WIDTH * cell, h = (HEIGHT - HIDDEN) * cell;
    shell.style.width = `${w}px`;
    shell.style.height = `${h}px`;
    rail.style.height = `${Math.min(height, 300)}px`;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * pixelRatio);
    canvas.height = Math.round(h * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    draw(performance.now());
    drawPreviews();
    fitNumbers();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  function frame(now) {
    const elapsed = Math.max(0, Math.min(100, now - previousTime));
    previousTime = now;
    if (game.state === 'running') {
      advanceRepeats(now);
      game.tick(elapsed);
      sync();
      draw(now);
    } else if (flash) draw(now);
    if (toastUntil && now >= toastUntil) { $('toast').classList.remove('visible'); toastUntil = 0; }
    requestAnimationFrame(frame);
  }
  ['score', 'best', 'level', 'lines'].forEach(id => $(id).setAttribute('aria-live', 'off'));
  syncSound();
  resize();
  sync();
  requestAnimationFrame(frame);
})();
