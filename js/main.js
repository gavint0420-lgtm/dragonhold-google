'use strict';
// ===== Canvas, camera, input =====
let canvas, ctx, Z = 2, VW = 0, VH = 0, DPR = 1, ZS = 2;
let glowSources = [];
const cam = {x:0, y:0};
let shakeAmt = 0;
let mode = 'title'; // title | play
let lastTs = 0, autosaveT = 60, placeCd = 0, toastCd = 0;
const input = {left:false, right:false, jump:false, jumpPressed:false, mouseL:false, mouseLPressed:false};
const mouse = {sx:0, sy:0, wx:0, wy:0};
const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d');
let lightBuf = null, lightImg = null;

function shake(n) { shakeAmt = Math.max(shakeAmt, n); }
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
  // whole device pixels per world pixel keeps tiles crisp; vector sprites draw at full resolution
  // zoomed out: about 30 blocks tall on screen (was 20). Steps of 1/4 keep tiles a whole number of pixels.
  ZS = clamp(Math.round(VH * DPR / 480 * 4) / 4, 1.5, 8);
  Z = ZS / DPR;
  ctx.imageSmoothingEnabled = false;
}

// ===== Key bindings (change them in Esc > Keybindings) =====
// Each action has up to two keys. Esc and the hotbar number keys always work.
const KEY_ACTIONS = [
  ['left', 'Move left', ['KeyA', 'ArrowLeft']],
  ['right', 'Move right', ['KeyD', 'ArrowRight']],
  ['jump', 'Jump / swim up / climb up', ['KeyW', 'Space']],
  ['down', 'Climb down a ladder', ['KeyS', 'ArrowDown']],
  ['inventory', 'Inventory and crafting', ['KeyE', 'KeyI']],
  ['interact', 'Talk, open, use', ['KeyF', null]],
  ['healPot', 'Drink health potion', ['KeyQ', null]],
  ['manaPot', 'Drink mana potion', ['KeyR', null]],
  ['burst', 'Arcane Burst (wands)', ['KeyX', null]],
  ['map', 'World map', ['KeyM', null]],
  ['bossLog', 'Boss log', ['KeyJ', null]],
  ['setHome', 'Set spawn point here', ['KeyB', null]],
  ['home', 'Return home', ['KeyH', null]],
  ['aim', 'Switch aim mode', ['KeyC', null]],
];
const KEYS_SAVE = 'dragonhold_keys';
let keyBinds = {};
function defaultBinds() { const b = {}; for (const [id, , keys] of KEY_ACTIONS) b[id] = keys.slice(); return b; }
function loadBinds() {
  keyBinds = defaultBinds();
  try { const s = JSON.parse(localStorage.getItem(KEYS_SAVE) || 'null'); if (s) for (const id in keyBinds) if (Array.isArray(s[id])) keyBinds[id] = [s[id][0] || null, s[id][1] || null]; } catch (e) {}
}
function saveBinds() { try { localStorage.setItem(KEYS_SAVE, JSON.stringify(keyBinds)); } catch (e) {} }
function actionFor(code) { for (const id in keyBinds) if (keyBinds[id].includes(code)) return id; return null; }
function keyLabel(code) {
  if (!code) return '—';
  const names = {Space:'Space', ArrowLeft:'←', ArrowRight:'→', ArrowUp:'↑', ArrowDown:'↓', ShiftLeft:'Left Shift', ShiftRight:'Right Shift', ControlLeft:'Left Ctrl', ControlRight:'Right Ctrl', AltLeft:'Left Alt', AltRight:'Right Alt', Tab:'Tab', Enter:'Enter', Backquote:'`', Minus:'-', Equal:'=', BracketLeft:'[', BracketRight:']', Semicolon:';', Quote:"'", Comma:',', Period:'.', Slash:'/', Backslash:'\\', CapsLock:'Caps Lock'};
  if (names[code]) return names[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
loadBinds();
let rebinding = null; // {id, slot} while waiting for a key press in the Keybindings menu
function keyDown(e) {
  if (rebinding) { e.preventDefault(); finishRebind(e.code); return; }
  if (mode !== 'play') return;
  const k = e.code;
  if (openPanel && openPanel !== 'invPanel') {
    if (k === 'Escape' || (actionFor(k) === 'map' && openPanel === 'mapPanel')) closePanels();
    return;
  }
  if (k === 'Escape') { if (openPanel) closePanels(); else openPause(); return; }
  const act = actionFor(k);
  if (act) e.preventDefault();
  switch (act) {
    case 'left': input.left = true; break;
    case 'right': input.right = true; break;
    case 'jump': if (!input.jump) input.jumpPressed = true; input.jump = true; break;
    case 'down': input.down = true; break;
    case 'inventory': openInventory(); break;
    case 'interact': if (!openPanel) interactNear(); break;
    case 'healPot': quickPotion('h'); break;
    case 'manaPot': quickPotion('m'); break;
    case 'map': openMap(); break;
    case 'bossLog': if (!openPanel) showQuestLog(); break;
    case 'home': if (!openPanel) returnHome(); break;
    case 'burst': if (!openPanel) { const s = hotbar[sel], it = s ? ITEMS[s.id] : null; if (it && it.wt === 'wand' && !player.dead) castBurst(it, !!s.rare); } break;
    case 'setHome': if (!openPanel) setHome(); break;
    case 'aim': if (!openPanel) { setAimMode(aimMode === 'smart' ? 'cursor' : 'smart'); toast(aimMode === 'smart' ? 'Smart aim: attacks lock onto the nearest enemy, the pickaxe digs toward your cursor.' : 'Cursor aim: attacks go exactly where you point.', 'blue'); } break;
    default:
      // number keys pick a hotbar slot: 1-9, and 0 for slot 10
      if (k.startsWith('Digit')) { const n = +k.slice(5), i = n === 0 ? 9 : n - 1; if (i < HOTBAR_SIZE) { sel = i; refreshSlots(); } }
  }
}
function keyUp(e) {
  switch (actionFor(e.code)) {
    case 'left': input.left = false; break;
    case 'right': input.right = false; break;
    case 'jump': input.jump = false; break;
    case 'down': input.down = false; break;
  }
}
// --- Keybindings menu ---
function openKeybinds() {
  const list = $('keysList'); list.innerHTML = '';
  for (const [id, label] of KEY_ACTIONS) {
    const row = document.createElement('div'); row.className = 'key-row';
    row.innerHTML = `<span class="key-name">${label}</span>`;
    for (const slot of [0, 1]) {
      const b = document.createElement('button'); b.className = 'btn key-btn'; b.id = `bind_${id}_${slot}`;
      b.textContent = keyLabel(keyBinds[id][slot]);
      b.onclick = () => startRebind(id, slot, b);
      row.appendChild(b);
    }
    list.appendChild(row);
  }
  $('keysMsg').textContent = 'Click a key to change it, then press the new key. Esc cancels, Backspace clears.';
  setPanel('keysPanel');
}
function startRebind(id, slot, btn) {
  if (rebinding) rebinding.btn.classList.remove('listening');
  rebinding = {id, slot, btn};
  btn.classList.add('listening'); btn.textContent = 'Press a key…';
  $('keysMsg').textContent = `Press a new key for "${KEY_ACTIONS.find(a => a[0] === id)[1]}".`;
}
function finishRebind(code) {
  const {id, slot, btn} = rebinding; rebinding = null; btn.classList.remove('listening');
  if (code === 'Escape') { $('keysMsg').textContent = 'Cancelled.'; openKeybinds(); return; }
  if (code === 'Backspace' || code === 'Delete') {
    if (slot === 0 && !keyBinds[id][1]) { $('keysMsg').textContent = 'Every action needs at least one key.'; openKeybinds(); return; }
    keyBinds[id][slot] = null;
    if (slot === 0) { keyBinds[id][0] = keyBinds[id][1]; keyBinds[id][1] = null; }
  } else {
    // a key can only do one thing: take it away from any other action
    let moved = '';
    for (const [other, label] of KEY_ACTIONS) for (const s of [0, 1]) if (keyBinds[other][s] === code && !(other === id && s === slot)) {
      keyBinds[other][s] = null; if (s === 0) { keyBinds[other][0] = keyBinds[other][1]; keyBinds[other][1] = null; }
      moved = label;
    }
    keyBinds[id][slot] = code;
    saveBinds(); openKeybinds();
    $('keysMsg').textContent = `${keyLabel(code)} now does "${KEY_ACTIONS.find(a => a[0] === id)[1]}".` + (moved ? ` It was taken from "${moved}"${keyBinds[KEY_ACTIONS.find(a => a[1] === moved)[0]][0] ? '' : ', which now has no key. Give it one'}.` : '');
    return;
  }
  saveBinds(); openKeybinds();
}
function bindInput() {
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => { input.left = input.right = input.jump = input.mouseL = false; });
  canvas.addEventListener('mousemove', e => { mouse.sx = e.clientX; mouse.sy = e.clientY; });
  canvas.addEventListener('mousedown', e => {
    if (mode !== 'play') return;
    mouse.sx = e.clientX; mouse.sy = e.clientY; updateMouseWorld();
    if (openPanel === 'invPanel') { if (held && e.button === 0) { addItem(held.id, held.n, held.rare, true); held = null; updateHeld(); } closePanels(); return; }
    if (openPanel) return;
    if (e.button === 0) { input.mouseL = true; input.mouseLPressed = true; }
    if (e.button === 2) {
      if (interactMouse()) return;
      // holding a wand: right click casts its heavy spell (Arcane Burst)
      const s = hotbar[sel], it = s ? ITEMS[s.id] : null;
      if (it && it.wt === 'wand' && !player.dead) castBurst(it, !!s.rare); else interactNear();
    }
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) input.mouseL = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    if (mode !== 'play' || openPanel) return;
    sel = (sel + (e.deltaY > 0 ? 1 : HOTBAR_SIZE - 1)) % HOTBAR_SIZE; refreshSlots(); e.preventDefault();
  }, {passive:false});
  window.addEventListener('mousemove', e => { const h = $('heldItem'); if (!h.hidden) { h.style.left = e.clientX + 6 + 'px'; h.style.top = e.clientY + 6 + 'px'; } });
  window.addEventListener('resize', () => { resize(); if (openPanel === 'mapPanel') drawBigMap(); });
}
function updateMouseWorld() { mouse.wx = cam.x + mouse.sx / Z; mouse.wy = cam.y + mouse.sy / Z; }

// ===== Using the selected item =====
function handleUse(dt) {
  const p = player;
  placeCd -= dt; toastCd -= dt;
  const slot = hotbar[sel], item = slot ? ITEMS[slot.id] : null;
  p.heldItem = item; if (item) item.rareFlag = !!(slot && slot.rare);
  p.mining = false;
  const pressed = input.mouseLPressed; input.mouseLPressed = false;
  // left-clicking a chest opens it, whatever you're holding
  if (pressed && !openPanel && !p.dead) {
    const cx = Math.floor(mouse.wx / TILE), cy = Math.floor(mouse.wy / TILE);
    if (getT(cx, cy) === T.CHEST && Math.hypot(cx * TILE + 8 - ecx(p), cy * TILE + 8 - ecy(p)) <= 7 * TILE) { openChest(cx, cy); return; }
  }
  if (!input.mouseL || openPanel || p.dead || !item) { p.mineP = 0; return; }
  const [tx, ty] = item.kind === 'tool' ? mineTile() : [Math.floor(mouse.wx / TILE), Math.floor(mouse.wy / TILE)];
  const reach = Math.hypot(tx * TILE + 8 - ecx(p), ty * TILE + 8 - ecy(p)) <= 6.5 * TILE;
  switch (item.kind) {
    case 'weapon': if (p.attackCd <= 0) attack(item, slot); break;
    case 'tool': {
      if (!reach) { p.mineP = 0; return; }
      const t = getT(tx, ty), pr = TP[t];
      if (t === T.AIR || pr.hard >= 99 || pr.liquid) { p.mineP = 0; return; }
      if (pr.hard > item.power) { if (toastCd <= 0) { toast('This needs a stronger pickaxe.'); toastCd = 2; } return; }
      p.mining = true; p.facing = mouse.wx >= ecx(p) ? 1 : -1;
      if (tx !== p.mineX || ty !== p.mineY) { p.mineX = tx; p.mineY = ty; p.mineP = 0; }
      const need = Math.max(0.06, pr.hard * 0.3 / item.speed);
      p.mineP += dt;
      if (Math.random() < dt * 12) addParticles(tx * TILE + 8, ty * TILE + 8, pr.top || pr.c || '#aaa', 1, 60, 0.3);
      if (p.mineP >= need) { breakTile(tx, ty); p.mineP = 0; }
      p.mineNeed = need;
      break;
    }
    case 'block': if (placeCd <= 0 && reach) placeBlock(tx, ty, item, slot); break;
    case 'potion': if (pressed) drinkPotion(slot); break;
    case 'lure': if (pressed) throwLure(slot); break;
  }
}
// Holding a wand: the wand always points at your cursor (or your smart-aim target),
// and when you're standing still you turn to face it.
function trackWandAim() {
  const p = player, it = p.heldItem;
  if (!it || it.wt !== 'wand' || p.dead || openPanel) return;
  const ap = aimPoint();
  if (Math.abs(p.vx) < 20 && p.dashT <= 0) p.facing = ap.x >= ecx(p) ? 1 : -1;
  const a = Math.atan2(ap.y - (p.y + 10), ap.x - ecx(p));
  p.aimLocal = p.facing > 0 ? a : Math.PI - a;
}
function breakTile(tx, ty) {
  const t = getT(tx, ty), pr = TP[t];
  if (pr.chest) { openChest(tx, ty); return; }
  if (pr.log) { fellTree(tx, ty); return; }
  setT(tx, ty, T.AIR);
  if (pr.drop) addItem(pr.drop, 1);
  addParticles(tx * TILE + 8, ty * TILE + 8, pr.top || pr.c || '#aaa', 6, 80, 0.4);
  const above = getT(tx, ty - 1);
  if (TP[above].deco && TP[above].hard < 99 && !TP[above].chest) breakTile(tx, ty - 1);
}
function fellTree(tx, ty) {
  let y = ty, wood = 0, topY = ty;
  while (getT(tx, y) === T.LOG) { setT(tx, y, T.AIR); wood++; topY = y; y--; }
  for (let dy = -5; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) {
    const t = getT(tx + dx, topY + dy);
    if (TP[t].leaves) setT(tx + dx, topY + dy, T.AIR);
  }
  addItem('wood', wood * 2);
  addParticles(tx * TILE + 8, topY * TILE, '#3f8a3a', 20, 100, 0.7);
  addFloater(tx * TILE + 8, topY * TILE, '+' + wood * 2 + ' Wood', '#d8b070');
}
function placeBlock(tx, ty, item, slot) {
  if (tx < 0 || tx >= WW || ty < 0 || ty >= WH) return;
  const cur = getT(tx, ty);
  if (cur !== T.AIR && !TP[cur].liquid && !TP[cur].leaves) return;
  if ((tx + 1) * TILE > barrierLimit()) return;
  const tid = item.tile, tpp = TP[tid];
  const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const n = getT(tx + a, ty + b); return n !== T.AIR && !TP[n].liquid; }) || ty > surf[tx];
  if (!adj) return;
  if (tpp.station && !isSolid(tx, ty + 1)) { if (toastCd <= 0) { toast('Place stations on solid ground.'); toastCd = 1.5; } return; }
  if (tpp.solid) {
    const r = {x:tx * TILE, y:ty * TILE, w:TILE, h:TILE};
    if (overlap(r, player)) return;
    for (const e of enemies) if (overlap(r, e)) return;
  }
  setT(tx, ty, tid);
  consumeSlot(slot, 1);
  placeCd = 0.12;
}

// ===== World ambient updates =====
function regrowHerbs(dt) {
  G.herbT -= dt;
  if (G.herbT > 0) return;
  G.herbT = 6;
  for (let a = 0; a < 6; a++) {
    const x = clamp(Math.floor(ecx(player) / TILE) + Math.floor((Math.random() - 0.5) * 200), 2, WW - 3);
    const b = biomeAt(x);
    if (!b.herbs.length) continue;
    const y = tops[x] - 1;
    if (y < 1 || y >= WH) continue;
    const ground = getT(x, y + 1);
    if (getT(x, y) !== T.AIR || TP[ground].brick || TP[ground].plank || ground === T.HOARD || ground === T.OBSIDIAN) continue;
    if (Math.abs(x * TILE - ecx(player)) < VW / Z / 2 + 40) continue;
    setT(x, y, b.herbs[Math.floor(Math.random() * b.herbs.length)]);
  }
}

// ===== Main update =====
function update(dt) {
  G.time += dt; G.play += dt;
  const guest = NET.on && !NET.host; // a co-op guest gets the world from the host
  if (!guest) G.dayT = (G.dayT + dt / 720) % 1;
  handleUse(dt);
  updatePlayer(dt);
  trackWandAim();
  if (!guest) updateEnemies(dt);
  updateProjectiles(dt);
  updateFx(dt);
  if (!guest) { spawnTick(dt); miniBossTick(dt); regrowHerbs(dt); }
  updateNPCs();
  netTick(dt);
  autosaveT -= dt;
  if (autosaveT <= 0) { autosaveT = 60; saveGame(true); }
}

// ===== Rendering =====
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
function skyColors(tx) {
  const i = biomeIndexAt(tx), b = BIOMES[i];
  let top = b.sky[0], bot = b.sky[1], hill = b.hill;
  const nx = BIOMES[i + 1], bw = 40;
  if (nx && b.x1 - tx < bw) { const t = 1 - (b.x1 - tx) / bw; return {top:mixHex(top, nx.sky[0], t * 0.5), bot:mixHex(bot, nx.sky[1], t * 0.5), hill:mixHex(hill, nx.hill, t * 0.5)}; }
  const pv = BIOMES[i - 1];
  if (pv && tx - b.x0 < bw) { const t = 1 - (tx - b.x0) / bw; return {top:mixHex(top, pv.sky[0], t * 0.5), bot:mixHex(bot, pv.sky[1], t * 0.5), hill:mixHex(hill, pv.hill, t * 0.5)}; }
  return {top, bot, hill};
}
function drawSky() {
  const tx = clamp(Math.floor((cam.x + VW / Z / 2) / TILE), 0, WW - 1);
  const s = skyColors(tx), dl = daylight(), nightK = 1 - (dl - 0.4) / 0.6;
  const top = mixHex(rgbToHex(s.top), '#070b1e', nightK * 0.92), bot = mixHex(rgbToHex(s.bot), '#1a1f3a', nightK * 0.85);
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, top); gr.addColorStop(1, bot);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  if (nightK > 0.3) {
    const tw = performance.now() / 1000;
    for (let i = 0; i < 140; i++) {
      const x = (hash2(i, 1, 5) * VW * 1.5 - cam.x * 0.02) % VW, y = hash2(i, 2, 5) * VH * 0.6;
      const twinkle = 0.55 + 0.45 * Math.sin(tw * (1.5 + hash2(i, 3, 5) * 3) + i), big = hash2(i, 4, 5) > 0.9;
      ctx.fillStyle = `rgba(255,${big ? 240 : 255},${big ? 210 : 255},${(nightK - 0.3) * 0.9 * twinkle})`;
      ctx.fillRect((x + VW) % VW, y, big ? 2.2 : 1.4, big ? 2.2 : 1.4);
    }
  }
  const now = performance.now() / 1000, biome = BIOMES[biomeIndexAt(tx)].id;
  // sun / moon position along its arc
  const dayArc = G.dayT < 0.64 ? G.dayT / 0.64 : (G.dayT - 0.64) / 0.36;
  const sx = VW * (0.1 + dayArc * 0.8), sy = VH * 0.42 - Math.sin(dayArc * Math.PI) * VH * 0.32;
  // dawn and dusk: an orange band along the horizon
  const dusk = G.dayT < 0.08 ? 1 - G.dayT / 0.08 : G.dayT > 0.54 && G.dayT < 0.7 ? 1 - Math.abs(G.dayT - 0.62) / 0.08 : 0;
  if (dusk > 0) {
    const hg = ctx.createLinearGradient(0, VH * 0.25, 0, VH * 0.75);
    hg.addColorStop(0, 'rgba(255,140,60,0)'); hg.addColorStop(1, `rgba(255,120,50,${0.45 * clamp(dusk, 0, 1)})`);
    ctx.fillStyle = hg; ctx.fillRect(0, 0, VW, VH);
  }
  if (G.dayT < 0.64) drawCoolSun(sx, sy, now, clamp(dusk, 0, 1));
  else drawMoon(sx, sy, now, top);
  // a shooting star now and then at night
  if (nightK > 0.6) {
    const cyc = 9, k = (now % cyc) / 1.1, n = Math.floor(now / cyc);
    if (k < 1) {
      const x0 = hash2(n, 7, 3) * VW * 0.7 + VW * 0.15, y0 = hash2(n, 8, 3) * VH * 0.25 + 20, dx = 160 * k, dy = 60 * k;
      const sg = ctx.createLinearGradient(x0 + dx - 60, y0 + dy - 22, x0 + dx, y0 + dy);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, `rgba(255,255,255,${0.9 * (1 - k)})`);
      ctx.strokeStyle = sg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + dx - 60, y0 + dy - 22); ctx.lineTo(x0 + dx, y0 + dy); ctx.stroke();
    }
  }
  const hillBase = (66 * TILE - cam.y) * Z;
  // far snowy mountains, hazy blue, barely moving
  {
    const par = 0.05, base = hillBase * 0.25 + VH * 0.33;
    const mcol = mixHex(mixHex(rgbToHex(s.hill), '#8a9ab8', 0.55), '#05070f', Math.min(0.85, nightK * 0.8));
    const ridge = x => { const wx = (cam.x * Z * par + x) / 520; const r = 1 - Math.abs(fbm2(wx, 31, 91, 4) * 2 - 1); return base - r * 150; };
    const mg = ctx.createLinearGradient(0, base - 150, 0, base + 40);
    mg.addColorStop(0, mixHex(rgbToHex(mcol), '#ffffff', 0.25 * (1 - nightK))); mg.addColorStop(1, mcol);
    ctx.fillStyle = mg; ctx.beginPath(); ctx.moveTo(0, VH);
    for (let x = 0; x <= VW + 8; x += 8) ctx.lineTo(x, ridge(x));
    ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
    // snow on the highest peaks
    ctx.fillStyle = `rgba(245,248,255,${0.75 - nightK * 0.45})`;
    for (let x = 0; x <= VW + 8; x += 8) { const y = ridge(x); if (y < base - 112) { const y2 = ridge(x + 8); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y2); ctx.lineTo(x + 8, Math.max(y2, base - 104)); ctx.lineTo(x, Math.max(y, base - 104)); ctx.closePath(); ctx.fill(); } }
  }
  // drifting clouds: puffy, with a lit top and a shaded belly
  const cloudA = 0.6 * (1 - nightK * 0.7);
  for (let i = 0; i < 9; i++) {
    const w = 90 + hash2(i, 3, 11) * 140, span = VW + w * 2;
    const cx = (((hash2(i, 1, 11) * span + G.time * (5 + i) - cam.x * Z * 0.06) % span) + span) % span - w;
    const cy = 40 + hash2(i, 2, 11) * VH * 0.28 - cam.y * Z * 0.02;
    const lit = nightK > 0.5 ? [160, 170, 200] : dusk > 0.3 ? [255, 214, 190] : [255, 255, 255];
    const shade = nightK > 0.5 ? [110, 118, 150] : [205, 214, 232];
    const puffs = [[-0.42, 0, 0.2], [-0.2, -0.1, 0.26], [0.05, -0.16, 0.3], [0.3, -0.07, 0.24], [0.48, 0.02, 0.17]];
    ctx.fillStyle = `rgba(${shade[0]},${shade[1]},${shade[2]},${cloudA})`;
    for (const [ox, oy, r] of puffs) { ctx.beginPath(); ctx.ellipse(cx + ox * w, cy + oy * w + w * 0.05, r * w, r * w * 0.62, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = `rgba(${lit[0]},${lit[1]},${lit[2]},${cloudA})`;
    for (const [ox, oy, r] of puffs) { ctx.beginPath(); ctx.ellipse(cx + ox * w, cy + oy * w - w * 0.02, r * w * 0.92, r * w * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // birds in V shapes by day, bats at night in the spooky places
  drawFlyers(now, nightK, biome);
  // parallax hills, with trees, ruins, towers or smoke along their ridges depending on the biome
  for (let layer = 0; layer < 2; layer++) {
    const par = layer === 0 ? 0.15 : 0.35, amp = layer === 0 ? 90 : 60, div = layer === 0 ? 260 : 160;
    const col = mixHex(rgbToHex(s.hill), '#05070f', Math.min(0.85, nightK * 0.8 + (layer === 0 ? 0.25 : 0)));
    const base = hillBase * (0.4 + layer * 0.3) + VH * (0.35 - layer * 0.05);
    const ridge = x => base - fbm2((cam.x * Z * par + x) / div, layer * 10, 77, 3) * amp * 2;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, VH);
    for (let x = 0; x <= VW + 8; x += 8) ctx.lineTo(x, ridge(x));
    ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
    // a soft lighter rim along the top of the far hills
    if (layer === 0) { ctx.strokeStyle = `rgba(255,255,255,${0.08 * (1 - nightK)})`; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= VW + 8; x += 8) x ? ctx.lineTo(x, ridge(x) + 1) : ctx.moveTo(x, ridge(x) + 1); ctx.stroke(); }
    drawRidgeDetails(layer, par, ridge, col, biome, now);
  }
  // low mist over the swamp and Duskwood
  if (biome === 'swamp' || biome === 'darkforest') {
    const my = hillBase * 0.7 + VH * 0.3;
    for (let i = 0; i < 4; i++) {
      const off = ((now * (6 + i * 3) + i * 300) % (VW + 400)) - 200;
      const mg = ctx.createRadialGradient(off, my, 0, off, my, 260);
      mg.addColorStop(0, `rgba(200,215,205,${0.12 * (1 - nightK * 0.5)})`); mg.addColorStop(1, 'rgba(200,215,205,0)');
      ctx.fillStyle = mg; ctx.fillRect(off - 260, my - 120, 520, 240);
    }
  }
  // the volcano's red glow on the horizon
  if (biome === 'volcano' || biome === 'castle') {
    const vg = ctx.createLinearGradient(0, VH * 0.45, 0, VH);
    vg.addColorStop(0, 'rgba(255,80,20,0)'); vg.addColorStop(1, `rgba(255,80,20,${0.18 + 0.06 * Math.sin(now * 1.3)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }
}
// ===== The sun: big, glowing, spinning rays, wearing sunglasses and a confident grin =====
function drawCoolSun(sx, sy, t, dusk) {
  const r = 26, bob = Math.sin(t * 1.4) * 2.5;
  const body = dusk > 0 ? mixHex('#ffd23f', '#ff7a2a', dusk * 0.8) : '#ffd23f';
  ctx.save(); ctx.translate(sx, sy + bob);
  // glow
  const gl = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 3.2);
  gl.addColorStop(0, 'rgba(255,230,140,0.55)'); gl.addColorStop(0.4, 'rgba(255,210,90,0.18)'); gl.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2); ctx.fill();
  // rays, slowly turning, long and short ones taking turns
  ctx.save(); ctx.rotate(t * 0.25);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, long = i % 2 === 0, L = r * (long ? 1.75 : 1.45) + Math.sin(t * 3 + i) * 2;
    ctx.fillStyle = long ? body : mixHex(body, '#fff2a0', 0.4);
    ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.11) * r * 1.08, Math.sin(a - 0.11) * r * 1.08); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a + 0.11) * r * 1.08, Math.sin(a + 0.11) * r * 1.08); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // face tilts a little, like it's nodding to music
  ctx.rotate(Math.sin(t * 0.8) * 0.07);
  const fg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  fg.addColorStop(0, '#fff8c8'); fg.addColorStop(0.55, body); fg.addColorStop(1, mixHex(body, '#e07a10', 0.5));
  ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,110,10,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  // rosy cheeks
  ctx.fillStyle = 'rgba(255,120,80,0.35)';
  ctx.beginPath(); ctx.ellipse(-r * 0.58, r * 0.2, r * 0.17, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.58, r * 0.2, r * 0.17, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  // sunglasses: two dark lenses, a bridge, arms back to the edge, and a shine
  const lens = (cx) => {
    ctx.beginPath(); ctx.moveTo(cx - r * 0.34, -r * 0.3); ctx.lineTo(cx + r * 0.34, -r * 0.3);
    ctx.quadraticCurveTo(cx + r * 0.36, r * 0.06, cx + r * 0.06, r * 0.08); ctx.quadraticCurveTo(cx - r * 0.3, r * 0.08, cx - r * 0.34, -r * 0.3); ctx.closePath();
  };
  ctx.strokeStyle = '#141420'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.86, -r * 0.34); ctx.lineTo(-r * 0.7, -r * 0.27); ctx.moveTo(r * 0.86, -r * 0.34); ctx.lineTo(r * 0.7, -r * 0.27); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.06, -r * 0.24); ctx.quadraticCurveTo(0, -r * 0.32, r * 0.06, -r * 0.24); ctx.stroke();
  for (const cx of [-r * 0.4, r * 0.4]) {
    const lg = ctx.createLinearGradient(cx, -r * 0.3, cx, r * 0.08);
    lg.addColorStop(0, '#2c2c44'); lg.addColorStop(1, '#05050a');
    lens(cx); ctx.fillStyle = lg; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.save(); lens(cx); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(cx - r * 0.22, -r * 0.28); ctx.lineTo(cx - r * 0.12, -r * 0.28); ctx.lineTo(cx - r * 0.26, r * 0.04); ctx.lineTo(cx - r * 0.34, r * 0.04); ctx.closePath(); ctx.fill();
    // a glint sweeps across the lenses every few seconds
    const gk = (t % 5) / 0.6;
    if (gk < 1) { const gx = cx - r * 0.45 + gk * r * 0.9; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(gx, -r * 0.35, r * 0.07, r * 0.5); }
    ctx.restore();
  }
  // the grin: a lopsided, confident smile with teeth
  ctx.beginPath(); ctx.moveTo(-r * 0.42, r * 0.3); ctx.quadraticCurveTo(0, r * 0.4, r * 0.46, r * 0.2);
  ctx.quadraticCurveTo(r * 0.12, r * 0.74, -r * 0.42, r * 0.3); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#7a3a06'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(122,58,6,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 0.36, r * 0.33); ctx.quadraticCurveTo(r * 0.02, r * 0.47, r * 0.4, r * 0.26); ctx.stroke();
  ctx.strokeStyle = '#7a3a06'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(r * 0.46, r * 0.2); ctx.quadraticCurveTo(r * 0.56, r * 0.12, r * 0.55, r * 0.04); ctx.stroke(); // dimple
  ctx.restore();
}
// The moon: soft glow, craters and a crescent shadow
function drawMoon(sx, sy, t, skyTop) {
  const r = 17;
  const gl = ctx.createRadialGradient(sx, sy, r * 0.8, sx, sy, r * 3.5);
  gl.addColorStop(0, 'rgba(220,230,255,0.25)'); gl.addColorStop(1, 'rgba(220,230,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, r * 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#e8ecf8'; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(150,160,190,0.45)';
  for (const [ox, oy, cr] of [[-0.35, -0.2, 0.22], [0.15, 0.3, 0.16], [-0.1, 0.45, 0.1], [0.3, -0.35, 0.12]]) { ctx.beginPath(); ctx.arc(sx + ox * r, sy + oy * r, cr * r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = skyTop; ctx.beginPath(); ctx.arc(sx + r * 0.75, sy - r * 0.3, r * 0.95, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// Birds by day (flapping V flocks), bats at night over Duskwood, the ruins and the castle
function drawFlyers(t, nightK, biome) {
  const bats = nightK > 0.5 && (biome === 'darkforest' || biome === 'ruins' || biome === 'castle');
  if (nightK > 0.5 && !bats) return;
  const a = bats ? 0.85 : 0.75 * (1 - nightK);
  ctx.strokeStyle = bats ? `rgba(20,14,24,${a})` : `rgba(40,40,55,${a})`; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let f = 0; f < 2; f++) {
    const span = VW + 300, speed = bats ? 34 : 22 + f * 8;
    const fx = ((t * speed + f * 520 - cam.x * Z * 0.03) % span + span) % span - 150;
    const fy = VH * (0.16 + f * 0.1) + Math.sin(t * 0.6 + f) * 12;
    for (let b = 0; b < 5; b++) {
      const side = b % 2 ? 1 : -1, row = Math.ceil(b / 2);
      const x = fx - row * 14, y = fy + side * row * 9 + Math.sin(t * 2 + b) * 2;
      const flap = Math.sin(t * (bats ? 14 : 8) + b * 1.3) * 3.5, s = bats ? 4 : 5;
      ctx.beginPath();
      if (bats) { ctx.moveTo(x - s * 1.6, y - flap * 0.5); ctx.lineTo(x - s * 0.8, y + 1); ctx.lineTo(x, y - 1); ctx.lineTo(x + s * 0.8, y + 1); ctx.lineTo(x + s * 1.6, y - flap * 0.5); }
      else { ctx.moveTo(x - s, y - flap); ctx.quadraticCurveTo(x - s * 0.4, y - flap * 0.2, x, y + 1); ctx.quadraticCurveTo(x + s * 0.4, y - flap * 0.2, x + s, y - flap); }
      ctx.stroke();
    }
  }
}
// Little silhouettes standing on the hill ridges, so each biome's skyline looks different
function drawRidgeDetails(layer, par, ridge, col, biome, t) {
  const spacing = layer === 0 ? 46 : 34, shift = cam.x * Z * par;
  const dark = mixHex(rgbToHex(col), '#000000', 0.18);
  ctx.fillStyle = dark; ctx.strokeStyle = dark;
  const k0 = Math.floor((shift - 40) / spacing), k1 = Math.ceil((shift + VW + 40) / spacing);
  for (let k = k0; k <= k1; k++) {
    const h = hash2(k, layer, 47); if (h < 0.35) continue; // leave gaps
    const x = k * spacing - shift + (hash2(k, layer, 48) - 0.5) * spacing * 0.6, y = ridge(x) + 2;
    const sz = (layer === 0 ? 0.7 : 1) * (0.7 + hash2(k, layer, 49) * 0.6);
    switch (biome) {
      case 'forest': case 'plains': // round leafy trees (sparser on the plains)
        if (biome === 'plains' && h < 0.7) break;
        ctx.fillRect(x - 1.5 * sz, y - 12 * sz, 3 * sz, 12 * sz);
        ctx.beginPath(); ctx.arc(x, y - 16 * sz, 8 * sz, 0, Math.PI * 2); ctx.arc(x - 6 * sz, y - 11 * sz, 6 * sz, 0, Math.PI * 2); ctx.arc(x + 6 * sz, y - 11 * sz, 6 * sz, 0, Math.PI * 2); ctx.fill();
        break;
      case 'darkforest': case 'mountains': // tall pines
        for (let i = 0; i < 3; i++) { const w = (9 - i * 2.4) * sz, yy = y - i * 8 * sz; ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x, yy - 14 * sz); ctx.lineTo(x + w, yy); ctx.closePath(); ctx.fill(); }
        break;
      case 'swamp': // dead, twisted trees and reeds
        ctx.lineWidth = 2 * sz; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 * sz, y - 20 * sz); ctx.lineTo(x - 5 * sz, y - 28 * sz); ctx.moveTo(x + 1 * sz, y - 13 * sz); ctx.lineTo(x + 9 * sz, y - 21 * sz); ctx.stroke();
        ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + 12 * sz + i * 2, y); ctx.lineTo(x + 12 * sz + i * 2.6, y - (6 + Math.abs(i) * 2) * sz); ctx.stroke(); }
        break;
      case 'ruins': // broken towers and pillars
        if (h > 0.75) { ctx.fillRect(x - 5 * sz, y - 26 * sz, 10 * sz, 26 * sz); for (let i = 0; i < 3; i++) ctx.fillRect(x - 5 * sz + i * 4 * sz, y - 30 * sz, 2.5 * sz, 4 * sz); }
        else { ctx.fillRect(x - 2.5 * sz, y - (10 + h * 12) * sz, 5 * sz, (10 + h * 12) * sz); }
        break;
      case 'volcano': // jagged rocks, with smoke rising from some of them
        ctx.beginPath(); ctx.moveTo(x - 8 * sz, y); ctx.lineTo(x - 2 * sz, y - 16 * sz); ctx.lineTo(x + 3 * sz, y - 8 * sz); ctx.lineTo(x + 8 * sz, y); ctx.closePath(); ctx.fill();
        if (h > 0.85) for (let i = 0; i < 4; i++) { const p = ((t * 0.25 + i * 0.25) % 1); ctx.fillStyle = `rgba(80,70,70,${0.35 * (1 - p)})`; ctx.beginPath(); ctx.arc(x - 2 * sz + p * 14, y - 16 * sz - p * 46, (4 + p * 10) * sz, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dark; }
        break;
      case 'castle': // towers with little flags
        if (h > 0.7) { ctx.fillRect(x - 4 * sz, y - 24 * sz, 8 * sz, 24 * sz); ctx.beginPath(); ctx.moveTo(x - 5 * sz, y - 24 * sz); ctx.lineTo(x, y - 32 * sz); ctx.lineTo(x + 5 * sz, y - 24 * sz); ctx.fill(); ctx.fillRect(x - 0.5, y - 40 * sz, 1, 8 * sz); ctx.beginPath(); ctx.moveTo(x, y - 40 * sz); ctx.lineTo(x + 7 * sz, y - 38 * sz + Math.sin(t * 4 + k) * 1.5); ctx.lineTo(x, y - 36 * sz); ctx.fill(); }
        break;
    }
  }
}
function rgbToHex(c) {
  if (c[0] === '#') return c;
  const m = c.match(/\d+/g).map(Number);
  return '#' + m.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
}
function drawTiles(tx0, ty0, tx1, ty1, time) {
  for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= WH) continue;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || tx >= WW) continue;
      const t = world[ty * WW + tx], pr = TP[t], x = tx * TILE, y = ty * TILE;
      if (!pr.solid) {
        let bg = null;
        if (inCastle(tx, ty)) bg = bgTex.castle;
        else if (ty > surf[tx] + 1) bg = ty > surf[tx] + 10 ? bgTex.stone : (biomeIndexAt(tx) >= 6 ? bgTex.ash : bgTex.dirt);
        if (bg) {
          ctx.drawImage(bg, x, y);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          if (isSolid(tx, ty - 1)) ctx.fillRect(x, y, 16, 4);
          if (isSolid(tx - 1, ty)) ctx.fillRect(x, y, 3, 16);
          if (isSolid(tx + 1, ty)) ctx.fillRect(x + 13, y, 3, 16);
        }
        if (t === T.AIR) continue;
      }
      if (pr.liquid) {
        if (pr.liquid === 'water') {
          ctx.fillStyle = 'rgba(47,111,184,0.62)'; ctx.fillRect(x, y, TILE, TILE);
          if (world[(ty - 1) * WW + tx] === T.AIR) { ctx.fillStyle = 'rgba(160,210,255,0.7)'; ctx.fillRect(x, y + Math.sin(time * 2 + tx) * 0.6, TILE, 2); }
        } else {
          const f = 0.5 + 0.5 * Math.sin(time * 2 + tx * 0.7 + ty);
          ctx.fillStyle = `rgb(${230 + f * 25},${80 + f * 50},20)`; ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(255,220,90,0.6)'; ctx.fillRect(x + ((tx * 5 + Math.floor(time * 3)) % 12), y + 4 + (tx % 3) * 3, 3, 2);
        }
        continue;
      }
      if (pr.deco) { drawDeco(ctx, t, x, y, time); continue; }
      const tex = tileTex[t];
      if (tex && tex.length) ctx.drawImage(tex[(tx * 7 + ty * 13) & 3], x, y);
      if (!pr.solid) continue;
      // soft edges where the block meets open space
      const up = isSolid(tx, ty - 1), dn = isSolid(tx, ty + 1), lf = isSolid(tx - 1, ty), rt = isSolid(tx + 1, ty);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      if (!dn) ctx.fillRect(x, y + 14, 16, 2);
      if (!lf) ctx.fillRect(x, y, 1.5, 16);
      if (!rt) ctx.fillRect(x + 14.5, y, 1.5, 16);
      if (!up) {
        if (pr.top) {
          ctx.fillStyle = pr.top;
          for (let k = 0; k < 4; k++) {
            const hh = 1.5 + ((tx * 31 + k * 17) % 3), bx = x + 1.5 + k * 4 + ((tx + k) % 2);
            const sw = Math.sin(time * 2 + tx * 0.7 + k) * 0.7;
            ctx.beginPath(); ctx.moveTo(bx - 0.8, y + 0.5); ctx.lineTo(bx + sw, y - hh); ctx.lineTo(bx + 0.8, y + 0.5); ctx.fill();
          }
        } else { ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(x, y, 16, 1.5); }
        if (!lf) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y, 3, 3); }
        if (!rt) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 13, y, 3, 3); }
      }
    }
  }
}
function computeLight(tx0, ty0, nx, ny) {
  if (lightCanvas.width !== nx || lightCanvas.height !== ny) {
    lightCanvas.width = nx; lightCanvas.height = ny;
    lightImg = lightCtx.createImageData(nx, ny); lightBuf = new Float32Array(nx * ny);
  }
  const L = lightBuf, dl = daylight();
  for (let i = 0; i < nx; i++) {
    const x = tx0 + i, top = x >= 0 && x < WW ? tops[x] : 0;
    for (let j = 0; j < ny; j++) {
      const y = ty0 + j;
      let l;
      if (y < top) l = dl;
      else l = dl * Math.max(0, 1 - (y - top) / 7);
      if (inCastle(x, y)) l = Math.max(l, 0.42);
      L[j * nx + i] = Math.max(l, 0.04);
    }
  }
  const add = (cx, cy, r, inten) => {
    const ir = Math.ceil(r);
    for (let dy = -ir; dy <= ir; dy++) {
      const j = cy + dy - ty0; if (j < 0 || j >= ny) continue;
      for (let dx = -ir; dx <= ir; dx++) {
        const i = cx + dx - tx0; if (i < 0 || i >= nx) continue;
        const d = Math.sqrt(dx * dx + dy * dy); if (d >= r) continue;
        const v = (1 - d / r) * inten, k = j * nx + i;
        if (v > L[k]) L[k] = v;
      }
    }
  };
  const R = 10;
  let count = 0;
  glowSources = [];
  for (let y = ty0 - R; y < ty0 + ny + R; y++) {
    if (y < 0 || y >= WH) continue;
    for (let x = tx0 - R; x < tx0 + nx + R; x++) {
      if (x < 0 || x >= WW) continue;
      const t = world[y * WW + x], lr = TP[t].light;
      if (lr && count < 400) {
        add(x, y, lr, lr >= 9 ? 1 : 0.85); count++;
        if (glowSources.length < 60) {
          if (t === T.TORCH || t === T.FURNACE) glowSources.push({x, y, r:5.5, col:'rgba(255,150,60,0.22)'});
          else if (t === T.LAVA && (x + y) % 3 === 0) glowSources.push({x, y, r:3.5, col:'rgba(255,90,30,0.16)'});
          else if (t === T.ALTAR) glowSources.push({x, y, r:5, col:'rgba(190,80,255,0.25)'});
          else if (t === T.WAYSTONE) glowSources.push({x, y, r:4.5, col:'rgba(90,200,255,0.22)'});
          else if (t === T.HOARD && (x % 4 === 0)) glowSources.push({x, y, r:3, col:'rgba(255,200,80,0.12)'});
        }
      }
    }
  }
  // let light spill sideways and down a little, so overhangs and cave mouths fade softly
  const dec = 0.13;
  for (let j = 0; j < ny; j++) {
    for (let i = 1; i < nx; i++) { const k = j * nx + i; if (L[k - 1] - dec > L[k]) L[k] = L[k - 1] - dec; }
    for (let i = nx - 2; i >= 0; i--) { const k = j * nx + i; if (L[k + 1] - dec > L[k]) L[k] = L[k + 1] - dec; }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 1; j < ny; j++) { const k = j * nx + i; if (L[k - nx] - dec > L[k]) L[k] = L[k - nx] - dec; }
  }
  const p = player;
  add(Math.floor(ecx(p) / TILE), Math.floor(ecy(p) / TILE), 9, 0.85);
  for (const pr of projectiles) if (pr.owner === 'p' || pr.fire) add(Math.floor(pr.x / TILE), Math.floor(pr.y / TILE), pr.owner === 'p' ? 6 : 3, pr.owner === 'p' ? 0.95 : 0.7);
  // spell beams and lightning light up the area they pass through
  for (const f of effects) if (f.type === 'beam' || f.type === 'arc') {
    const pts = f.type === 'beam' ? [[f.x1, f.y1], [f.x2, f.y2]] : f.pts;
    for (const [x, y] of pts) add(Math.floor(x / TILE), Math.floor(y / TILE), 6, 0.9);
  }
  for (const e of enemies) if (e.bid === 'gold_dragon' || e.type === 'drake' || e.type === 'wraith') add(Math.floor(ecx(e) / TILE), Math.floor(ecy(e) / TILE), e.boss ? 8 : 3, 0.6);
  const d = lightImg.data;
  for (let k = 0; k < nx * ny; k++) {
    const l = Math.min(1, L[k]);
    d[k * 4] = 4; d[k * 4 + 1] = 3; d[k * 4 + 2] = 10;
    d[k * 4 + 3] = Math.round((1 - l) * 250);
  }
  lightCtx.putImageData(lightImg, 0, 0);
}
function drawBarriers(time) {
  if (!BARRIERS_ON) return;
  for (const b of BARRIERS) {
    if (G.bossesDone[b.boss]) continue;
    const x = b.x * TILE;
    if (x < cam.x - 40 || x > cam.x + VW / Z + 40) continue;
    const top = cam.y - 10, h = VH / Z + 20;
    const gr = ctx.createLinearGradient(x - 14, 0, x + 6, 0);
    gr.addColorStop(0, 'rgba(192,75,255,0)'); gr.addColorStop(0.7, 'rgba(192,75,255,0.45)'); gr.addColorStop(1, 'rgba(232,160,255,0.85)');
    ctx.fillStyle = gr; ctx.fillRect(x - 14, top, 20, h);
    ctx.fillStyle = 'rgba(255,220,255,0.9)';
    for (let i = 0; i < 14; i++) {
      const yy = top + ((i * 53 + time * 30) % h);
      ctx.fillRect(x - 3 + Math.sin(time * 3 + i) * 2, yy, 2, 4);
    }
  }
}
function drawEffects(time) {
  for (const f of effects) {
    const a = f.life / f.max;
    if (f.type === 'beam') {
      // a thick glowing beam: wide soft glow, bright body, white-hot core, and a flare where it lands
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2);
      ctx.strokeStyle = `rgba(80,220,255,${0.25 * a})`; ctx.lineWidth = 14; ctx.stroke();
      ctx.strokeStyle = `rgba(143,240,255,${0.8 * a})`; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2.5; ctx.stroke();
      const fg = ctx.createRadialGradient(f.x2, f.y2, 0, f.x2, f.y2, 14);
      fg.addColorStop(0, `rgba(255,255,255,${a})`); fg.addColorStop(0.4, `rgba(143,240,255,${0.7 * a})`); fg.addColorStop(1, 'rgba(143,240,255,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(f.x2, f.y2, 14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (f.type === 'arc') {
      // jagged lightning, drawn three times: wide glow, blue bolt, white core
      const path = [];
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [x1, y1] = f.pts[i], [x2, y2] = f.pts[i + 1];
        const seg = [[x1, y1]];
        for (let s = 1; s <= 7; s++) { const t = s / 7; seg.push([lerp(x1, x2, t) + (s < 7 ? (Math.random() - 0.5) * 16 : 0), lerp(y1, y2, t) + (s < 7 ? (Math.random() - 0.5) * 16 : 0)]); }
        path.push(seg);
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, col] of [[12, `rgba(90,160,255,${0.3 * a})`], [5, `rgba(150,210,255,${0.9 * a})`], [2, `rgba(255,255,255,${a})`]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (const seg of path) { ctx.moveTo(seg[0][0], seg[0][1]); for (let k = 1; k < seg.length; k++) ctx.lineTo(seg[k][0], seg[k][1]); }
        ctx.stroke();
      }
      for (const [x, y] of f.pts) { const fg = ctx.createRadialGradient(x, y, 0, x, y, 12); fg.addColorStop(0, `rgba(255,255,255,${a})`); fg.addColorStop(1, 'rgba(150,210,255,0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    } else if (f.type === 'slash') {
      const k = 1 - a, r = f.r;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1);
      ctx.globalCompositeOperation = 'lighter';
      if (f.claw) {
        // three tapered claw rakes with a soft glow behind them
        ctx.lineCap = 'round';
        for (const [w, al] of [[5, 0.25], [2.2, 0.9]]) {
          ctx.strokeStyle = f.col; ctx.globalAlpha = a * al; ctx.lineWidth = w;
          for (let i = -1; i <= 1; i++) {
            const sw = k * 6;
            ctx.beginPath(); ctx.moveTo(-r * 0.35 + i * 3.5, -r * 0.7 + i * 2 + sw); ctx.quadraticCurveTo(r * 0.55, i * 3 + sw * 0.5, r * 0.05 + i * 3.5, r * 0.65 + i * 2 + sw); ctx.stroke();
          }
        }
        ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.2 + i * 3.5, -r * 0.45 + i * 2); ctx.quadraticCurveTo(r * 0.45, i * 3, r * 0.08 + i * 3.5, r * 0.4 + i * 2); ctx.stroke(); }
      } else {
        // a crescent sweep: wide faint smear, bright body, white-hot leading edge
        const a0 = -1.35 + k * 0.5, a1 = 1.15;
        const layers = [[1.15, 0.7, 0.18], [1, 0.8, 0.75], [0.97, 0.9, 1]];
        layers.forEach(([ro, ri, al], li) => {
          ctx.globalAlpha = a * al; ctx.fillStyle = li === 2 ? '#ffffff' : f.col;
          ctx.beginPath(); ctx.arc(0, 0, r * ro, a0, a1); ctx.arc(r * 0.16, 0, r * ri, a1, a0, true); ctx.closePath(); ctx.fill();
        });
        // a glint at the tip of the swing
        const tx = Math.cos(a1) * r, ty = Math.sin(a1) * r;
        ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(tx - 4, ty); ctx.lineTo(tx, ty - 1); ctx.lineTo(tx + 4, ty); ctx.lineTo(tx, ty + 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx, ty - 4); ctx.lineTo(tx + 1, ty); ctx.lineTo(tx, ty + 4); ctx.lineTo(tx - 1, ty); ctx.closePath(); ctx.fill();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (f.type === 'bite') {
      // jaws snapping shut: two rows of teeth closing on the spot, then a crunch star
      const k = 1 - a, open = Math.max(0, 1 - k * 2.2) * f.r * 0.7;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1); ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.fillStyle = '#fffaf0';
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const tx = -f.r * 0.5 + i * f.r * 0.33, ty = s * (open + 1);
        ctx.beginPath(); ctx.moveTo(tx - 2, ty); ctx.lineTo(tx + 2, ty); ctx.lineTo(tx, ty - s * 5); ctx.closePath(); ctx.fill();
      }
      if (k > 0.4) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = f.col; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 3, Math.sin(an) * 3); ctx.lineTo(Math.cos(an) * f.r * 0.6 * k, Math.sin(an) * f.r * 0.6 * k); ctx.stroke(); } }
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (f.type === 'impact') {
      // star burst where a heavy blow lands
      const k = 1 - a;
      ctx.save(); ctx.translate(f.x, f.y); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 + 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * f.r * 0.3 * k, Math.sin(an) * f.r * 0.3 * k); ctx.lineTo(Math.cos(an) * f.r * (0.4 + k * 0.6), Math.sin(an) * f.r * (0.4 + k * 0.6)); ctx.stroke(); }
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r * 0.5); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, f.r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (f.type === 'ring') {
      ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (1 - a * 0.6), f.r * 0.35 * (1 - a * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
function render(dt) {
  const time = performance.now() / 1000;
  if (mode !== 'play') { drawTitleBackdrop(time); return; }
  const p = player;
  // camera
  const tx = ecx(p) + p.vx * 0.12 - VW / Z / 2, ty = ecy(p) + (p.visOff || 0) - VH / Z / 2;
  cam.x = lerp(cam.x, tx, Math.min(1, dt * 7));
  cam.y = lerp(cam.y, ty, Math.min(1, dt * 7));
  cam.x = clamp(cam.x, 0, WW * TILE - VW / Z);
  cam.y = clamp(cam.y, -60, WH * TILE - VH / Z);
  let sx = 0, sy = 0;
  if (shakeAmt > 0) { sx = (Math.random() - 0.5) * shakeAmt; sy = (Math.random() - 0.5) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt * 25); }
  const camX = Math.round((cam.x + sx) * ZS) / ZS, camY = Math.round((cam.y + sy) * ZS) / ZS;
  updateMouseWorld();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawSky();
  ctx.setTransform(ZS, 0, 0, ZS, -camX * ZS, -camY * ZS);
  const tx0 = Math.floor(camX / TILE) - 1, ty0 = Math.floor(camY / TILE) - 1;
  const tx1 = Math.ceil((camX + VW / Z) / TILE) + 1, ty1 = Math.ceil((camY + VH / Z) / TILE) + 1;
  drawTiles(tx0, ty0, tx1, ty1, time);
  // mining crack
  if (p.mining && p.mineNeed) {
    const k = Math.min(1, p.mineP / p.mineNeed);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
    const mx = p.mineX * TILE, my = p.mineY * TILE;
    ctx.beginPath();
    ctx.moveTo(mx + 8, my + 8); ctx.lineTo(mx + 8 - 7 * k, my + 3); ctx.moveTo(mx + 8, my + 8); ctx.lineTo(mx + 14 * k, my + 12 * k);
    ctx.moveTo(mx + 8, my + 8); ctx.lineTo(mx + 4, my + 8 + 7 * k); ctx.moveTo(mx + 8, my + 8); ctx.lineTo(mx + 8 + 6 * k, my + 2);
    ctx.stroke();
  }
  for (const n of npcs) if (Math.abs(n.x - ecx(p)) < VW / Z) drawNPC(ctx, n, time);
  for (const l of lures) { drawProjectile(ctx, {type:'lure', x:l.x, y:l.y}, time); ctx.fillStyle = `rgba(255,220,90,${0.3 + 0.2 * Math.sin(time * 8)})`; ctx.beginPath(); ctx.arc(l.x, l.y, 12, 0, Math.PI * 2); ctx.fill(); }
  for (const e of enemies) if (e.x > camX - 80 && e.x < camX + VW / Z + 80) drawEnemy(ctx, e, time);
  drawRemoteKnights(ctx, time);
  if (!p.dead) drawKnight(ctx, p, time);
  for (const pr of projectiles) drawProjectile(ctx, pr, time);
  if (NET.on && !NET.host) for (const pr of NET.eproj) drawProjectile(ctx, pr, time);
  for (const pt of particles) { ctx.globalAlpha = Math.max(0, pt.life / pt.max); ctx.fillStyle = pt.col; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 0.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  drawEffects(time);
  // lighting
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
  computeLight(tx0, ty0, nx, ny);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, tx0 * TILE, ty0 * TILE, nx * TILE, ny * TILE);
  ctx.imageSmoothingEnabled = false;
  // warm glow from torches, lava and magic
  ctx.globalCompositeOperation = 'lighter';
  for (const s of glowSources) {
    const gx = s.x * TILE + 8, gy = s.y * TILE + 8, r = s.r * TILE;
    const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    gr.addColorStop(0, s.col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  drawBarriers(time);
  // your spawn point: a little gold banner on a pole
  if (G.home) {
    const hx = G.home.x + 6, hy = G.home.y + 28, wave = Math.sin(time * 3) * 1.5;
    ctx.fillStyle = '#5a3f26'; ctx.fillRect(hx - 0.75, hy - 22, 1.5, 22);
    ctx.fillStyle = '#e3b341'; ctx.beginPath(); ctx.moveTo(hx + 0.75, hy - 22); ctx.lineTo(hx + 11, hy - 19 + wave); ctx.lineTo(hx + 0.75, hy - 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2f56b8'; ctx.fillRect(hx + 2.5, hy - 20, 2, 2);
  }
  // cursor highlight
  const it = p.heldItem;
  if (it && (it.kind === 'tool' || it.kind === 'block') && !openPanel) {
    const [mx, my] = it.kind === 'tool' ? mineTile() : [Math.floor(mouse.wx / TILE), Math.floor(mouse.wy / TILE)];
    const reach = Math.hypot(mx * TILE + 8 - ecx(p), my * TILE + 8 - ecy(p)) <= 6.5 * TILE;
    ctx.strokeStyle = reach ? (aimMode === 'smart' && it.kind === 'tool' ? 'rgba(255,212,90,0.9)' : 'rgba(255,255,255,0.7)') : 'rgba(255,80,80,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(mx * TILE + 0.5, my * TILE + 0.5, TILE - 1, TILE - 1);
  }
  // smart aim: show which enemy your weapon will lock onto
  if (it && it.kind === 'weapon' && aimMode === 'smart' && !openPanel && !p.dead) {
    const tg = smartTarget();
    if (tg) {
      const cx = ecx(tg), cy = ecy(tg), r = Math.max(tg.w, tg.h) * 0.5 + 6, spin = time * 2;
      ctx.strokeStyle = 'rgba(255,212,90,0.9)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { const a = spin + i * Math.PI / 2; ctx.beginPath(); ctx.arc(cx, cy, r, a, a + 0.8); ctx.stroke(); }
    }
  }
  // floating text
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
    ctx.font = f.big ? 'bold 10px system-ui, sans-serif' : 'bold 7px system-ui, sans-serif';
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(f.txt, f.x, f.y);
    ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.45, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  updateHUD();
  drawMinimap(dt);
}
function drawTitleBackdrop(time) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (typeof drawTitleScene === 'function') { drawTitleScene(ctx, VW, VH, time); return; }
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, '#120c1e'); gr.addColorStop(0.6, '#3a1e2a'); gr.addColorStop(1, '#6a3020');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 80; i++) ctx.fillRect(hash2(i, 1, 9) * VW, hash2(i, 2, 9) * VH * 0.6, 1.5, 1.5);
  // castle silhouette
  ctx.fillStyle = '#0b0710';
  const bx = VW * 0.5, by = VH * 0.82;
  ctx.fillRect(bx - 240, by - 120, 480, 200);
  for (let i = -240; i < 240; i += 24) ctx.fillRect(bx + i, by - 136, 14, 16);
  ctx.fillRect(bx - 300, by - 210, 90, 290); ctx.fillRect(bx + 210, by - 210, 90, 290);
  for (let i = 0; i < 4; i++) { ctx.fillRect(bx - 300 + i * 24, by - 226, 14, 16); ctx.fillRect(bx + 210 + i * 24, by - 226, 14, 16); }
  ctx.fillStyle = '#ffb347'; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 2);
  ctx.fillRect(bx - 270, by - 160, 10, 16); ctx.fillRect(bx + 250, by - 160, 10, 16); ctx.fillRect(bx - 20, by - 70, 40, 60);
  ctx.globalAlpha = 1;
  // dragon circling
  ctx.save();
  const dx = bx + Math.cos(time * 0.4) * VW * 0.32, dy = VH * 0.3 + Math.sin(time * 0.8) * 40;
  ctx.translate(dx, dy); ctx.scale(-Math.sign(Math.sin(time * 0.4)) * 3 || 3, 3);
  SPRITES.gold_dragon(ctx, time, 0, {});
  ctx.restore();
  ctx.fillStyle = '#0b0710'; ctx.fillRect(0, by + 60, VW, VH);
}

// ===== Game flow =====
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (mode === 'play' && (!openPanel || NET.on)) update(dt); // co-op games keep running behind menus
  render(dt);
  requestAnimationFrame(frame);
}
function resetRuntime() {
  enemies = []; projectiles = []; particles = []; floaters = []; effects = []; lures = [];
  mods = new Map(); hotbar = new Array(HOTBAR_SIZE).fill(null); inv = new Array(30).fill(null); sel = 0; held = null;
}
// The weapon picked on the title screen (remembered on this computer), and the kit a new knight starts with.
let startWeapon = 'sword';
try { const w = localStorage.getItem('dragonhold_start_weapon'); if (STARTER_WEAPONS[w]) startWeapon = w; } catch (e) {}
function setStartWeapon(w) {
  if (!STARTER_WEAPONS[w]) return;
  startWeapon = w;
  try { localStorage.setItem('dragonhold_start_weapon', w); } catch (e) {}
  for (const b of document.querySelectorAll('.wpn-btn')) b.setAttribute('aria-checked', String(b.dataset.wpn === w));
}
function giveStarterKit() {
  addItem(STARTER_WEAPONS[startWeapon] || 'squire_blade', 1, false, true);
  addItem('pick_old', 1, false, true);
  addItem('torch', 15, false, true);
  addItem('pot_h1', 5, false, true);
  addItem('pot_m1', startWeapon === 'wand' ? 6 : 2, false, true); // wand users lean on mana
}
// What the host picked in the Play together menu.
const hostChoice = {world:'continue', diff:'normal'};
function setHostWorld(w) {
  if (w === 'continue' && !loadSaveRaw()) w = 'new';
  hostChoice.world = w;
  for (const b of document.querySelectorAll('[data-world]')) b.setAttribute('aria-checked', String(b.dataset.world === w));
}
function setHostDiff(d) {
  if (!DIFFICULTIES[d]) return;
  hostChoice.diff = d;
  for (const b of document.querySelectorAll('[data-hostdiff]')) b.setAttribute('aria-checked', String(b.dataset.hostdiff === d));
  $('hostDiffDesc').textContent = DIFFICULTIES[d].desc;
}
function refreshHostChoices() {
  const d = loadSaveRaw();
  $('worldContinue').disabled = !d;
  $('worldSaveInfo').textContent = d && d.p ? `Your save, level ${d.p.level}` : 'No saved world yet';
  document.querySelector('[data-world="new"] small').textContent = d ? 'Replaces your saved world' : 'Start a fresh adventure';
  setHostWorld(d ? 'continue' : 'new');
  setHostDiff((d && d.G && d.G.difficulty) || 'normal');
}
function newGame(difficulty) {
  showLoading(true);
  setTimeout(() => {
    resetRuntime();
    G = newGameState();
    if (DIFFICULTIES[difficulty]) G.difficulty = difficulty;
    player = newPlayer();
    generateWorld((Math.random() * 1e9) | 0);
    buildMap(); buildNPCs();
    placeAtWaystone(60);
    giveStarterKit();
    recalcStats(); player.hp = player.maxHp; player.mana = player.maxMana;
    startGame();
    G.mainProg = 0;
    openDialog({speaker:'Sir Aldric', title:'Dragonhold',
      text:`<p>Squire! Thank the stars you're here. Aurex, the Gilded Wyrm, has carried Princess Elowen to Dragonhold Castle at the far eastern end of the land.</p>
        <p>The beast loves gold more than anything, and its champions rule every corner of the land. Hunt them down one by one, grow strong on their treasure, then storm the castle and bring her home.</p>
        <p>${QUESTS_ON ? MAIN_QUESTS[0].text : `Your first foe: <b>${BOSSES[BOSS_ORDER[0]].name}</b> in ${biomeAt(BOSSES[BOSS_ORDER[0]].x).name}. Press J to see every boss.`}</p>`,
      buttons:[{label:'For the princess!', fn:() => { closeDialog(); showControlsOnce(); }}]});
    saveGame(true);
  }, 30);
}
// Move positions saved in the old 2200-wide world onto the new, bigger world.
function remapToBigWorld() {
  const tileX = px => MX(Math.floor(px / TILE));
  G.ways = [...new Set((G.ways || [60]).map(w => WAYSTONES.find(n => Math.abs(n - MX(w)) < 3) || MX(w)))];
  G.lastWay = MX(G.lastWay || 60);
  if (G.home) { const hx = tileX(G.home.x); G.home = {x:hx * TILE, y:(tops[hx] - 2) * TILE - player.h}; }
  const px = Math.min(WW - 3, tileX(player.x));
  player.x = px * TILE; player.y = (tops[px] - 2) * TILE - player.h;
}
function continueGame(data, difficulty) {
  showLoading(true);
  setTimeout(() => {
    try {
      resetRuntime();
      G = Object.assign(newGameState(), data.G);
      if (DIFFICULTIES[difficulty]) G.difficulty = difficulty;
      G.boss = null;
      player = newPlayer();
      generateWorld(data.seed);
      // A save from the smaller world: keep the knight, items, bosses and progress, but the land
      // itself is re-made at the new size (your old digging and building can't line up with it).
      const oldWorld = (data.ww || OLD_WW) !== WW;
      if (!oldWorld) applyMods(data.mods || []);
      buildMap(); buildNPCs();
      Object.assign(player, data.p);
      hotbar = fitHotbar(data.hotbar); inv = data.inv; sel = data.sel || 0;
      if (oldWorld) remapToBigWorld();
      recalcStats();
      player.hp = Math.max(1, Math.min(player.hp, player.maxHp));
      if (rectSolid(player.x, player.y, player.w, player.h)) placeAtWaystone(G.lastWay || 60);
      startGame();
      if (oldWorld) {
        openDialog({speaker:'Sir Aldric', title:'The land has grown',
          text:'<p>The realm is much larger now. Your knight, items, level and defeated bosses are all safe, but the land itself has been re-made, so anything you dug or built is gone and chests are full again.</p>',
          buttons:[{label:'Onward', fn:closeDialog}]});
        saveGame(true);
      } else toast('Welcome back, Sir Knight.', 'blue');
    } catch (err) {
      console.error(err);
      showLoading(false);
      $('titleMsg').textContent = 'That save could not be loaded.';
    }
  }, 30);
}
function startGame() {
  mode = 'play';
  $('title').hidden = true; $('hud').hidden = false;
  showLoading(false);
  cam.x = ecx(player) - VW / Z / 2; cam.y = ecy(player) - VH / Z / 2;
  refreshSlots(); updateQuestHUD(); updateHUD(true); updateRoomTag();
}
function quitToTitle() {
  closePanels(); hideBossBar(); hideDeath();
  mode = 'title'; $('hud').hidden = true; $('title').hidden = false;
  setupTitle();
}
function showLoading(on) { $('loading').hidden = !on; }
function showControlsOnce() {
  if (G.introSeen) return;
  G.introSeen = true;
  showControls();
}
function showControls() {
  openDialog({speaker:'How to play', title:'Controls', text:CONTROLS_HTML, buttons:[{label:'Got it', fn:closeDialog}]});
}
const CONTROLS_HTML = `<div class="controls">
  <div><kbd>A</kbd> <kbd>D</kbd></div><div>Move</div>
  <div><kbd>W</kbd> / <kbd>Space</kbd></div><div>Jump (also swims)</div>
  <div>Left click</div><div>Use the selected item: attack, mine, place a block, drink</div>
  <div>Right click / <kbd>F</kbd></div><div>Talk, open chests, use altars and waystones</div>
  <div><kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> / wheel</div><div>Choose a hotbar slot</div>
  <div><kbd>E</kbd></div><div>Inventory and crafting</div>
  <div><kbd>Q</kbd> / <kbd>R</kbd></div><div>Drink a health / mana potion</div>
  <div><kbd>C</kbd></div><div>Switch between cursor aim and smart cursor</div>
  <div><kbd>B</kbd> / <kbd>H</kbd></div><div>Set your spawn point here / return home</div>
  <div><kbd>M</kbd></div><div>World map</div>
  <div><kbd>J</kbd></div><div>Quest log</div>
  <div><kbd>Esc</kbd></div><div>Menu and saving. Change any key in Esc → Keybindings</div>
</div>
<p class="dlg-obj">Tip: hit trees with your pickaxe to get wood. Your game saves every minute and when you beat a boss.</p>`;
function showQuestLog() {
  if (!QUESTS_ON) {
    // Boss log: every main boss, easiest first, with where to find it and whether it's beaten
    const next = nextBoss();
    let html = `<p class="dlg-small">${bossCount()} of ${BOSS_ORDER.length} bosses defeated. Find each boss's glowing altar and use it to call the boss out. Red dots on the map (M).</p><div class="boss-log">`;
    for (const k of BOSS_ORDER) {
      const b = BOSSES[k], done = !!G.bossesDone[k];
      html += `<div class="boss-row${done ? ' done' : ''}${k === next ? ' next' : ''}"><span class="bl-mark">${done ? '✓' : k === next ? '▶' : '·'}</span><span class="bl-name">${b.name}</span><span class="bl-lvl">Lv ${b.lvl}</span><span class="bl-where">${bossWhere(k)}</span></div>`;
    }
    html += `</div><p class="dlg-small">Mini-bosses (orange diamonds on the map) wander every area too. They come back 10 minutes after you beat them.</p>`;
    openDialog({speaker:'Boss hunt', title:'Bosses of the realm', text:html, buttons:[{label:'Close', fn:closeDialog}]});
    return;
  }
  const q = currentMain();
  let html = q ? `<p><b>${q.title}</b><br>${q.text}</p><p class="dlg-obj">${questLine(q, G.mainProg)}</p>` : '<p>The main story is complete.</p>';
  html += `<p class="dlg-small">Main story: quest ${Math.min(G.mainQ + 1, MAIN_QUESTS.length)} of ${MAIN_QUESTS.length}</p>`;
  for (const k of ['greta', 'fennick']) {
    const s = G.side[k], sq = SIDE_QUESTS[k][s.i];
    const who = k === 'greta' ? 'Greta' : 'Fennick';
    if (s.active) html += `<p><b>${who}: ${sq.title}</b><br>${questLine(sq, s.prog)}</p>`;
    else if (sq) html += `<p class="dlg-small">${who} has a task for you in the village.</p>`;
  }
  openDialog({speaker:'Quest log', text:html, buttons:[{label:'Close', fn:closeDialog}]});
}
function updateDiffButton() { $('btnDiff').textContent = `Difficulty: ${diff().name}`; }
function updateAimButton() {
  const k = id => keyBinds[id][0] ? ` (${keyLabel(keyBinds[id][0])})` : '';
  $('btnAim').textContent = `Aim: ${aimMode === 'smart' ? 'Smart cursor' : 'Cursor'}${k('aim')}`;
  $('btnSetHome').textContent = `Set spawn point here${k('setHome')}`;
  $('btnGoHome').textContent = `Return home${k('home')}`;
  $('btnInvClose').textContent = `Close${k('inventory')}`;
  $('btnMapClose').textContent = `Close${k('map')}`;
}
function openPause() {
  setPanel('pausePanel');
  updateDiffButton(); updateAimButton();
  $('exportBox').hidden = true; $('importBox').hidden = true;
}
function bindMenus() {
  $('btnNew').onclick = () => {
    if (hasSave() && !$('btnNew').dataset.confirm) { $('btnNew').dataset.confirm = '1'; $('btnNew').textContent = 'Overwrite save? Click again'; return; }
    $('coopBox').hidden = true;
    $('diffBox').hidden = false;
    $('btnNew').textContent = 'New game'; delete $('btnNew').dataset.confirm;
    $('diffBox').querySelector('[data-diff="normal"]').focus();
  };
  for (const b of document.querySelectorAll('.wpn-btn')) b.onclick = () => setStartWeapon(b.dataset.wpn);
  setStartWeapon(startWeapon);
  for (const b of document.querySelectorAll('.diff-btn')) {
    b.querySelector('small').textContent = DIFFICULTIES[b.dataset.diff].desc;
    b.onclick = () => { $('diffBox').hidden = true; newGame(b.dataset.diff); };
  }
  $('btnKeys').onclick = openKeybinds;
  $('btnKeysClose').onclick = () => { if (rebinding) { rebinding.btn.classList.remove('listening'); rebinding = null; } updateAimButton(); closePanels(); };
  $('btnKeysReset').onclick = () => { keyBinds = defaultBinds(); saveBinds(); openKeybinds(); $('keysMsg').textContent = 'All keys are back to the defaults.'; };
  updateAimButton();
  $('btnAim').onclick = () => {
    setAimMode(aimMode === 'smart' ? 'cursor' : 'smart');
    updateAimButton();
    toast(aimMode === 'smart' ? 'Smart aim: attacks lock onto the nearest enemy, the pickaxe digs toward your cursor.' : 'Cursor aim: attacks go exactly where you point.', 'blue');
  };
  $('btnDiff').onclick = () => {
    const order = ['easy', 'normal', 'hard'];
    const next = order[(order.indexOf(G.difficulty) + 1) % order.length];
    G.difficulty = next;
    updateDiffButton();
    toast(`Difficulty: ${diff().name}. ${diff().desc}`, 'blue');
    // in co-op the difficulty is shared: a friend's change goes to the host, who applies it for everyone
    if (NET.on && !NET.host) { netSend('host', {k:'setdiff', d:next}); NET.diffHold = performance.now() + 1500; }
  };
  $('btnContinue').onclick = () => { const d = loadSaveRaw(); if (d) continueGame(d); };
  $('btnTitleHelp').onclick = () => { $('titleHelp').hidden = !$('titleHelp').hidden; };
  $('titleHelp').innerHTML = CONTROLS_HTML;
  $('btnResume').onclick = closePanels;
  $('btnSave').onclick = () => { saveGame(false); };
  $('btnControls').onclick = () => { closePanels(); showControls(); };
  $('btnExport').onclick = () => {
    $('exportBox').hidden = false; $('importBox').hidden = true;
    $('exportText').value = JSON.stringify(saveData());
    $('exportText').select();
  };
  $('btnCopy').onclick = () => {
    const t = $('exportText');
    navigator.clipboard.writeText(t.value).then(() => toast('Save copied.'), () => { t.select(); toast('Press Ctrl+C to copy.'); });
  };
  $('btnImport').onclick = () => { $('importBox').hidden = false; $('exportBox').hidden = true; $('importText').value = ''; $('importText').focus(); };
  $('btnDoImport').onclick = () => {
    try {
      const d = JSON.parse($('importText').value);
      if (!d || !d.seed || !d.p) throw new Error('bad');
      closePanels(); continueGame(d);
      setTimeout(() => saveGame(true), 500);
    } catch (e) { toast('That save text is not valid.', 'red'); }
  };
  $('btnQuit').onclick = () => { saveGame(true); if (NET.on || NET.ws) netLeave(); quitToTitle(); };
  $('btnUpdate').onclick = () => { if (mode === 'play') saveGame(true); location.reload(); };
  $('btnRespawn').onclick = () => respawnPlayer(respawnChoice[0]);
  $('btnRespawnVillage').onclick = () => respawnPlayer(respawnChoice[1]);
  $('btnSetHome').onclick = () => { closePanels(); setHome(); };
  $('btnGoHome').onclick = () => { closePanels(); returnHome(); };
  for (const b of document.querySelectorAll('[data-world]')) b.onclick = () => setHostWorld(b.dataset.world);
  for (const b of document.querySelectorAll('[data-hostdiff]')) b.onclick = () => setHostDiff(b.dataset.hostdiff);
  $('btnCoop').onclick = () => { $('diffBox').hidden = true; refreshHostChoices(); $('coopBox').hidden = !$('coopBox').hidden; if (!$('coopBox').hidden) $('coopName').focus(); };
  $('btnHost').onclick = hostCoop;
  $('btnJoin').onclick = joinCoop;
  $('coopCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinCoop(); });
  try { $('coopName').value = localStorage.getItem('dragonhold_name') || ''; } catch (e) {}
  // the download button only makes sense when the game comes from the Dragonhold server
  if (!netLikelyNoServer() && netAvailable()) {
    fetch('download/Dragonhold.zip', {method:'HEAD'}).then(r => { if (r.ok) $('btnDownload').hidden = false; }).catch(() => {});
  }
  if (netLikelyNoServer() || !netAvailable()) {
    $('coopNote').hidden = false;
    $('btnHost').disabled = true; $('btnJoin').disabled = true;
  }
  $('btnShopClose').onclick = closePanels;
  $('btnWayClose').onclick = closePanels;
  $('btnMapClose').onclick = closePanels;
  $('btnInvClose').onclick = closePanels;
}
function setupTitle() {
  const d = loadSaveRaw();
  $('btnContinue').hidden = !d;
  $('btnNew').textContent = 'New game'; delete $('btnNew').dataset.confirm;
  $('diffBox').hidden = true;
  if (d && d.p) $('saveInfo').textContent = `Saved game: level ${d.p.level}, quest ${Math.min((d.G.mainQ || 0) + 1, MAIN_QUESTS.length)} of ${MAIN_QUESTS.length}`;
  else $('saveInfo').textContent = '';
}

window.addEventListener('load', () => {
  canvas = $('game'); ctx = canvas.getContext('2d');
  resize();
  initTextures();
  bindInput(); bindMenus();
  setupTitle();
  requestAnimationFrame(frame);
});
