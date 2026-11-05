'use strict';
// ===== Developer options (owner only) =====
// Unlocks only when the game is opened at localhost on the computer that has server/dev.key.
// Friends playing through the internet link, or from a downloaded copy, never get it.
// Open with F2, or Esc > Developer options.
const DEV = {allowed:false, god:false, mana:false, oneHit:false, fly:false, flySpeed:520, noAggro:false, showInfo:false};

(function () {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!local) return;
  fetch('dev-allowed', {cache:'no-store'}).then(r => r.ok ? r.text() : 'no').then(t => {
    if (t.trim() !== 'yes') return;
    DEV.allowed = true;
    try { Object.assign(DEV, JSON.parse(localStorage.getItem('dragonhold_dev') || '{}'), {allowed:true}); } catch (e) {}
    installDevHooks();
    buildDevPanel();
  }).catch(() => {});
})();

function saveDev() { try { const {allowed, ...rest} = DEV; localStorage.setItem('dragonhold_dev', JSON.stringify(rest)); } catch (e) {} }

// ---- game hooks (wrap existing functions; only installed for the owner) ----
function installDevHooks() {
  const origHurt = hurtPlayer;
  hurtPlayer = function (amt, srcX, opt) { if (DEV.god) return; return origHurt(amt, srcX, opt); };
  const origWD = weaponDamage;
  weaponDamage = function (item, rare) { return origWD(item, rare) * (DEV.oneHit ? 1000 : 1); };
  const origUP = updatePlayer;
  updatePlayer = function (dt) {
    const p = player;
    if (DEV.mana && p) p.mana = p.maxMana;
    if (DEV.god && p && !p.dead) { p.hp = p.maxHp; p.lavaT = 0; }
    if (DEV.fly && p && !p.dead) {
      // fly through anything: WASD / your movement keys move you freely, no gravity, no walls
      const sp = DEV.flySpeed * (input.jump ? 1 : 1);
      const up = input.jump || !!devKeys.KeyW || !!devKeys.ArrowUp, down = !!devKeys.KeyS || !!devKeys.ArrowDown;
      p.vx = (input.right ? 1 : 0) - (input.left ? 1 : 0); p.vy = (down ? 1 : 0) - (up ? 1 : 0);
      p.x = clamp(p.x + p.vx * sp * dt, 0, WW * TILE - p.w); p.y = clamp(p.y + p.vy * sp * dt, 0, (WH - 4) * TILE);
      if (p.vx) p.facing = Math.sign(p.vx);
      p.vx *= sp; p.vy *= sp; p.onGround = false; p.iframes = Math.max(p.iframes, 0.1);
      p.attackCd -= dt; p.potionCd -= dt; p.swingT = Math.max(0, p.swingT - dt);
      return;
    }
    origUP(dt);
  };
  // enemies ignore you when "Enemies ignore me" is on
  const origNT = nearestTarget;
  const nobody = {x:-1e7, y:-1e7, w:1, h:1, dead:true}; // a far-away, "dead" stand-in so enemies stay calm
  nearestTarget = function (x, y) { if (DEV.noAggro && !NET.on) return nobody; return origNT(x, y); };
  // info overlay
  setInterval(() => {
    const el = document.getElementById('devInfo'); if (!el) return;
    el.hidden = !DEV.showInfo || mode !== 'play' || !player;
    if (el.hidden) return;
    const tx = Math.floor(ecx(player) / TILE), ty = Math.floor(ecy(player) / TILE);
    el.textContent = `x ${tx}  y ${ty}  · ${biomeAt(clamp(tx, 0, WW - 1)).name} · enemies ${enemies.length} · fps ${devFps}`;
  }, 250);
  let frames = 0, last = performance.now();
  (function tick() { frames++; const now = performance.now(); if (now - last >= 1000) { devFps = frames; frames = 0; last = now; } requestAnimationFrame(tick); })();
  // map click teleport
  document.getElementById('bigMap').addEventListener('click', ev => {
    if (!DEV.allowed || mode !== 'play') return;
    const c = ev.currentTarget, r = c.getBoundingClientRect();
    const tx = clamp(Math.floor((ev.clientX - r.left) / r.width * WW), 1, WW - 2);
    const ty = clamp(Math.floor((ev.clientY - r.top) / r.height * WH), 1, WH - 5);
    devTeleport(tx, ty); closePanels();
  });
  // F2 opens the panel; track S/Down for flying down
  window.addEventListener('keydown', e => {
    devKeys[e.code] = true;
    if (e.code === 'F2' && mode === 'play') { e.preventDefault(); toggleDevPanel(); }
  });
  window.addEventListener('keyup', e => { devKeys[e.code] = false; });
}
let devFps = 0;
const devKeys = {};

function devTeleport(tx, ty) {
  const p = player;
  if (ty == null) ty = tops[tx] - 2;
  p.x = tx * TILE; p.y = ty * TILE - p.h; p.vx = p.vy = 0;
  if (!DEV.fly) for (let k = 0; k < 80 && rectSolid(p.x, p.y, p.w, p.h); k++) p.y -= TILE;
  addParticles(ecx(p), ecy(p), '#8fd0ff', 24, 150, 0.6);
  toast(`Teleported to ${biomeAt(tx).name}.`, 'blue');
}

// ---- the panel ----
function buildDevPanel() {
  const css = document.createElement('style');
  css.textContent = `
  #devPanel { position: fixed; top: calc(70px + env(safe-area-inset-top, 0px)); right: max(12px, env(safe-area-inset-right, 0px)); z-index: 70; width: 330px; max-width: calc(100vw - 24px);
    max-height: calc(100vh - 100px); overflow-y: auto; background: rgba(14,12,20,0.96); border: 1px solid #6cf0b0; border-radius: 6px; padding: 10px 12px; font-size: 13px; box-sizing: border-box; }
  #devPanel h3 { margin: 0 0 6px; font-family: var(--display); color: #6cf0b0; font-size: 20px; display: flex; justify-content: space-between; align-items: center; }
  #devPanel .dsec { margin-top: 10px; display: grid; gap: 5px; }
  #devPanel .dsec > b { color: var(--muted); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
  #devPanel label.tog { display: flex; gap: 8px; align-items: center; cursor: pointer; }
  #devPanel .row { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
  #devPanel .btn { padding: 4px 8px; font-size: 12px; }
  #devPanel select, #devPanel input[type=number] { background: var(--ink); color: var(--text); border: 1px solid var(--edge); border-radius: 4px; padding: 4px 6px; font: 12px var(--body); min-width: 0; }
  #devPanel select { flex: 1 1 140px; }
  #devInfo { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(96px + env(safe-area-inset-bottom, 0px)); z-index: 60; font: 12px ui-monospace, monospace; color: #6cf0b0; background: rgba(0,0,0,0.6); padding: 3px 8px; border-radius: 4px; pointer-events: none; }`;
  document.head.appendChild(css);
  const info = document.createElement('div'); info.id = 'devInfo'; info.hidden = true; document.body.appendChild(info);

  const el = document.createElement('div'); el.id = 'devPanel'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Developer options');
  const itemOpts = Object.values(ITEMS).sort((a, b) => a.name.localeCompare(b.name)).map(it => `<option value="${it.id}">${it.name}</option>`).join('');
  const enemyOpts = Object.keys(EN).map(k => `<option value="${k}">${EN[k].name}</option>`).join('');
  const bossOpts = BOSS_ORDER.map(k => `<option value="${k}">${BOSSES[k].name.split(',')[0]}</option>`).join('');
  const placeOpts = [['village', 'Greenhollow (start)'], ...TOWNS.map(t => ['town:' + t.x, t.name]), ...BOSS_ORDER.map(k => ['boss:' + k, ARENA_NAMES[k]])]
    .map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
  el.innerHTML = `
    <h3>Developer <button class="btn" id="devClose">Close (F2)</button></h3>
    <div class="dsec"><b>Cheats</b>
      <label class="tog"><input type="checkbox" id="dvGod"> God mode (no damage, full health)</label>
      <label class="tog"><input type="checkbox" id="dvMana"> Infinite mana</label>
      <label class="tog"><input type="checkbox" id="dvOneHit"> One-hit kills</label>
      <label class="tog"><input type="checkbox" id="dvFly"> Fly through walls (move keys, S to go down)</label>
      <label class="tog"><input type="checkbox" id="dvNoAggro"> Enemies ignore me (solo only)</label>
      <label class="tog"><input type="checkbox" id="dvInfo"> Show position and FPS</label>
    </div>
    <div class="dsec"><b>Character</b>
      <div class="row">Level <input type="number" id="dvLevel" min="1" max="60" value="1" style="width:60px"> <button class="btn" id="dvSetLevel">Set</button> <button class="btn" id="dvMaxLevel">Max (60)</button></div>
      <div class="row"><button class="btn" id="dvGold">+10,000 gold</button> <button class="btn" id="dvHeal">Full heal</button> <button class="btn" id="dvClearInv">Empty bag</button></div>
    </div>
    <div class="dsec"><b>Give item</b>
      <div class="row"><select id="dvItem">${itemOpts}</select><input type="number" id="dvItemN" min="1" max="999" value="1" style="width:56px"><label class="tog"><input type="checkbox" id="dvRare"> Rare</label><button class="btn" id="dvGive">Give</button></div>
    </div>
    <div class="dsec"><b>Travel</b>
      <div class="row"><select id="dvPlace">${placeOpts}</select><button class="btn" id="dvGo">Go</button></div>
      <div class="row" style="color:var(--muted)">Or open the map (M) and click anywhere to teleport there.</div>
    </div>
    <div class="dsec"><b>Bosses and enemies</b>
      <div class="row"><select id="dvBoss">${bossOpts}</select><button class="btn" id="dvSummon">Go and summon</button></div>
      <div class="row"><button class="btn" id="dvBossesAll">Mark all beaten</button> <button class="btn" id="dvBossesReset">Reset all bosses</button></div>
      <div class="row"><select id="dvEnemy">${enemyOpts}</select>Lv <input type="number" id="dvEnemyLv" min="1" max="60" value="10" style="width:50px"><label class="tog"><input type="checkbox" id="dvElite"> Champion</label><button class="btn" id="dvSpawn">Spawn at cursor</button></div>
      <div class="row"><button class="btn" id="dvKillAll">Kill all enemies</button> <button class="btn" id="dvMinisReset">Bring back mini-bosses</button></div>
    </div>
    <div class="dsec"><b>World</b>
      <div class="row"><button class="btn" id="dvDay">Make it day</button> <button class="btn" id="dvNight">Make it night</button> <button class="btn" id="dvSave">Save now</button></div>
    </div>`;
  document.body.appendChild(el);
  const $d = id => document.getElementById(id);
  const host = () => !(NET.on && !NET.host); // things that change the world need the host (or solo)
  const tog = (id, key) => { const c = $d(id); c.checked = !!DEV[key]; c.onchange = () => { DEV[key] = c.checked; saveDev(); toast(`${c.parentElement.textContent.trim()}: ${c.checked ? 'on' : 'off'}`, 'blue'); }; };
  tog('dvGod', 'god'); tog('dvMana', 'mana'); tog('dvOneHit', 'oneHit'); tog('dvFly', 'fly'); tog('dvNoAggro', 'noAggro'); tog('dvInfo', 'showInfo');
  $d('devClose').onclick = toggleDevPanel;
  $d('dvSetLevel').onclick = () => devSetLevel(+$d('dvLevel').value);
  $d('dvMaxLevel').onclick = () => devSetLevel(60);
  $d('dvGold').onclick = () => { player.coins += 10000; updateHUD(true); toast('+10,000 gold', 'gold'); };
  $d('dvHeal').onclick = () => { player.hp = player.maxHp; player.mana = player.maxMana; updateHUD(true); };
  $d('dvClearInv').onclick = () => { inv = new Array(inv.length).fill(null); refreshSlots(); toast('Bag emptied (hotbar kept).'); };
  $d('dvGive').onclick = () => {
    const id = $d('dvItem').value, n = clamp(+$d('dvItemN').value || 1, 1, 999), rare = $d('dvRare').checked;
    if (ITEMS[id].stack === 1) { for (let i = 0; i < n; i++) addItem(id, 1, rare, true); } else addItem(id, n, rare, true);
    toast(`Gave ${n} ${ITEMS[id].name}${rare ? ' (rare)' : ''}.`, 'gold');
  };
  $d('dvGo').onclick = () => {
    const v = $d('dvPlace').value;
    if (v === 'village') devTeleport(70);
    else if (v.startsWith('town:')) devTeleport(+v.slice(5));
    else { const k = v.slice(5); if (k === 'gold_dragon') devTeleport(CASTLE.x0 + 8, CASTLE.floor - 2); else devTeleport(BOSSES[k].x - 12); }
  };
  $d('dvSummon').onclick = () => {
    if (!host()) { toast('Only the host can summon bosses.'); return; }
    const k = $d('dvBoss').value;
    if (G.boss) despawnBoss(false);
    G.bossesDone[k] = false;
    if (k === 'gold_dragon') devTeleport(CASTLE.x0 + 30, CASTLE.floor - 2); else devTeleport(BOSSES[k].x - 12);
    summonBoss(k);
  };
  $d('dvBossesAll').onclick = () => { if (!host()) return toast('Only the host can change bosses.'); for (const k in BOSSES) G.bossesDone[k] = true; updateQuestHUD(); toast('All bosses marked beaten.'); };
  $d('dvBossesReset').onclick = () => { if (!host()) return toast('Only the host can change bosses.'); G.bossesDone = {}; G.won = false; updateQuestHUD(); toast('All bosses are back.'); };
  $d('dvSpawn').onclick = () => {
    if (!host()) { toast('Only the host can spawn enemies.'); return; }
    const type = $d('dvEnemy').value, lv = clamp(+$d('dvEnemyLv').value || 1, 1, 60);
    const e = makeEnemy(type, 0, 0, lv, {elite:$d('dvElite').checked});
    const mx = (mouse.wx && mouse.wx > 0) ? mouse.wx : ecx(player) + player.facing * 80;
    e.x = mx - e.w / 2; e.y = (mouse.wy || player.y) - e.h; e.aggro = true;
    for (let k = 0; k < 40 && rectSolid(e.x, e.y, e.w, e.h); k++) e.y -= TILE;
    enemies.push(e); addParticles(ecx(e), ecy(e), '#ff4a4a', 16, 120, 0.5);
  };
  $d('dvKillAll').onclick = () => { if (!host()) return toast('Only the host can do that.'); let n = 0; for (const e of enemies) if (!e.dead && !e.ally && !e.boss) { damageEnemy(e, 1e12, {}); n++; } toast(`Defeated ${n} enemies.`); };
  $d('dvMinisReset').onclick = () => { G.minis = {}; G.miniT = 0; toast('Mini-bosses will come back when you get near them.'); };
  $d('dvDay').onclick = () => { if (!host()) return toast('Only the host can change the time.'); G.dayT = 0.25; };
  $d('dvNight').onclick = () => { if (!host()) return toast('Only the host can change the time.'); G.dayT = 0.8; };
  $d('dvSave').onclick = () => saveGame(false);
  // pause-menu entry
  const pb = document.querySelector('#pausePanel .pause-btns');
  if (pb) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'btnDev'; b.textContent = 'Developer options (F2)'; b.onclick = () => { closePanels(); toggleDevPanel(); }; pb.appendChild(b); }
}
function toggleDevPanel() {
  const el = document.getElementById('devPanel'); if (!el) return;
  el.hidden = !el.hidden;
  if (!el.hidden && player) document.getElementById('dvLevel').value = player.level;
}
function devSetLevel(n) {
  const p = player; n = clamp(Math.round(n) || 1, 1, 60);
  p.level = n; p.xp = 0; recalcStats(); p.hp = p.maxHp; p.mana = p.maxMana; updateHUD(true);
  toast(`You are now level ${n}.`, 'gold');
}
