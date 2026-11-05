'use strict';
// ===== Online co-op (up to 3 players) =====
// The host's browser runs the world: enemies, bosses, enemy projectiles, day and night.
// Every player moves their own knight and sends its state ~15 times a second.
// Guests send their hits to the host; the host sends enemy snapshots ~12 times a second.
const NET = {ws:null, on:false, host:false, id:0, hostId:0, room:'', name:'Knight', peers:new Map(),
  posT:0, snapT:0, applying:false, waitingWorld:false, bossId:0, eproj:[], lastSnap:0};
const COOP_CHAR_KEY = 'dragonhold_coop_char_v1';

function netAvailable() {
  return location.protocol === 'http:' || location.protocol === 'https:';
}
function netLikelyNoServer() {
  return location.protocol === 'file:' || /claude\.ai$|claudeusercontent|anthropic/.test(location.hostname);
}
function netSend(to, d) {
  if (!NET.ws || NET.ws.readyState !== 1) return;
  NET.ws.send(JSON.stringify({t:'relay', to, d}));
}
function netConnect(onOpen, onFail) {
  let ws;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
  catch (e) { onFail('Online play needs the Dragonhold server.'); return; }
  let opened = false;
  ws.onopen = () => { opened = true; NET.ws = ws; onOpen(ws); };
  ws.onerror = () => { if (!opened) onFail('Could not reach the Dragonhold server. Online play only works when the game is opened from the server (run "node server/server.js" in the dragonhold folder).'); };
  ws.onclose = () => { if (opened) netClosed(); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } netHandle(m); };
}
function netClosed() {
  const was = NET.on;
  NET.ws = null; NET.on = false; NET.peers.clear();
  updateRoomTag();
  if (was && mode === 'play') {
    toast('Disconnected from the co-op game.', 'red');
    if (!NET.host) { saveCoopChar(true); quitToTitle(); }
  }
  NET.host = false;
}
function netLeave() {
  if (NET.ws) { const ws = NET.ws; NET.on = false; NET.ws = null; try { ws.close(); } catch (e) {} }
  NET.peers.clear(); NET.on = false; NET.host = false; NET.bossId = 0; NET.eproj = [];
  updateRoomTag();
}

// ----- Title screen actions -----
function randomRoomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function coopStatus(msg, bad) { const el = $('coopStatus'); el.textContent = msg; el.classList.toggle('bad', !!bad); }
function coopName() {
  const n = ($('coopName').value || '').trim().slice(0, 16) || 'Knight';
  try { localStorage.setItem('dragonhold_name', n); } catch (e) {}
  return n;
}
function hostCoop() {
  NET.name = coopName();
  const code = randomRoomCode();
  coopStatus('Connecting...');
  netConnect(ws => ws.send(JSON.stringify({t:'join', room:code, name:NET.name, create:true})), r => coopStatus(r, true));
  NET.pending = 'host';
}
function joinCoop() {
  NET.name = coopName();
  const code = ($('coopCode').value || '').trim().toUpperCase();
  if (!code) { coopStatus('Type the room code your host sees.', true); return; }
  coopStatus('Connecting...');
  netConnect(ws => ws.send(JSON.stringify({t:'join', room:code, name:NET.name, create:false})), r => coopStatus(r, true));
  NET.pending = 'join';
}

// ----- Incoming messages -----
function netHandle(m) {
  switch (m.t) {
    case 'joined':
      NET.on = true; NET.id = m.id; NET.host = m.host; NET.hostId = m.hostId; NET.room = m.room;
      for (const pl of m.players) if (pl.id !== NET.id) ensurePeer(pl.id, pl.name);
      if (NET.host) {
        const d = loadSaveRaw();
        if (d && hostChoice.world === 'continue') continueGame(d, hostChoice.diff);
        else newGame(hostChoice.diff);
        setTimeout(() => toast(`Co-op room ${NET.room} is open. Friends join with this code.`, 'gold'), 600);
      } else {
        NET.waitingWorld = true;
        coopStatus('Joined! Loading the host\'s world...');
        netSend('host', {k:'hello', name:NET.name, ver:BOOT_VERSION});
      }
      updateRoomTag();
      break;
    case 'error':
      coopStatus(m.reason, true);
      if (NET.ws) { try { NET.ws.close(); } catch (e) {} }
      NET.ws = null; NET.on = false;
      break;
    case 'peer':
      ensurePeer(m.id, m.name);
      if (mode === 'play') toast(`${m.name} joined the game.`, 'blue');
      updateRoomTag();
      break;
    case 'left': {
      const pr = NET.peers.get(m.id);
      if (pr) toast(`${pr.name} left the game.`);
      NET.peers.delete(m.id);
      updateRoomTag();
      break;
    }
    case 'hostleft':
      toast('The host closed the game.', 'red');
      saveCoopChar(true);
      netLeave(); quitToTitle();
      break;
    case 'msg':
      // developer gifts are only accepted when the SERVER marked the sender as the game's owner (m.own);
      // a 'devgift' without that mark is ignored (onPeerMsg has no case for it)
      if (m.own && m.d && m.d.k === 'devgift') { if (typeof applyDevGift === 'function') applyDevGift(m.d); break; }
      onPeerMsg(m.from, m.d);
      break;
  }
}
function ensurePeer(id, name) {
  let pr = NET.peers.get(id);
  if (!pr) {
    pr = {id, name:name || 'Knight', x:0, y:0, w:12, h:28, vx:0, vy:0, tx:0, ty:0, facing:1, onGround:true, walkPhase:0,
      armorId:null, heldItem:null, swingT:0, swingDur:0.3, aimLocal:0, mining:false, hp:100, maxHp:100, dead:true, level:1,
      iframes:0, visOff:0, landT:0, remote:true, seen:false};
    NET.peers.set(id, pr);
  } else if (name) pr.name = name;
  return pr;
}
function onPeerMsg(from, d) {
  if (!d || !d.k) return;
  switch (d.k) {
    // --- everyone ---
    case 'pos': {
      const pr = ensurePeer(from);
      pr.tx = d.x; pr.ty = d.y; if (!pr.seen) { pr.x = d.x; pr.y = d.y; pr.seen = true; }
      pr.vx = d.vx; pr.vy = d.vy; pr.facing = d.f; pr.onGround = d.g; pr.walkPhase = d.wp; pr.armorId = d.a;
      pr.heldItem = d.h ? Object.assign({}, ITEMS[d.h], {rareFlag:!!d.r}) : null;
      if (d.sw > pr.swingT) { pr.swingT = d.sw; pr.swingDur = d.sd; }
      pr.aimLocal = d.al; pr.mining = d.m; pr.hp = d.hp; pr.maxHp = d.mhp; pr.dead = d.dead; pr.level = d.lv;
      if (d.n) pr.name = d.n;
      if (d.c && CLASS_LOOK[d.c]) pr.heroClass = d.c; // each friend keeps their own Knight / Rogue / Wizard look
      break;
    }
    case 'tile':
      if (!world) break;
      NET.applying = true; setT(d.x, d.y, d.t); NET.applying = false;
      break;
    // --- host receives ---
    case 'hello':
      if (!NET.host || !world) break;
      ensurePeer(from, d.name);
      if (d.ver && BOOT_VERSION && Number(d.ver) < Number(BOOT_VERSION)) toast(`${d.name || 'Your friend'} is running an older version. They should save and refresh.`, 'red');
      else if (d.ver && BOOT_VERSION && Number(d.ver) > Number(BOOT_VERSION)) showUpdateNotice('Your friend has a newer version. Update so you both have the same settings.');
      netSend(from, {k:'world', seed:worldSeed, mods:[...mods], done:G.bossesDone, dayT:G.dayT, df:G.difficulty, ver:BOOT_VERSION, hx:player.x, hy:player.y});
      break;
    case 'hit': {
      if (!NET.host) break;
      const e = enemies.find(x => x.id === d.id);
      if (e && !e.dead) { e.lastBy = from; damageEnemy(e, d.amt, {kb:d.kb, crit:d.crit, fx:d.fx, rare:d.rare, dot:d.dot}); }
      break;
    }
    case 'fx': {
      if (!NET.host) break;
      const e = enemies.find(x => x.id === d.id);
      if (e && !e.dead) enemyFx(e, d.fx, d.rare, d.base);
      break;
    }
    case 'setdiff': {
      // any player may change the shared difficulty; the host applies it for everyone
      if (!NET.host || !DIFFICULTIES[d.d]) break;
      G.difficulty = d.d;
      const who = NET.peers.get(from);
      updateDiffButton();
      toast(`${who ? who.name : 'A friend'} set the difficulty to ${diff().name}.`, 'blue');
      break;
    }
    case 'summon':
      // arena bosses can only be fought once; item-summoned ones (like the Necromancer) appear where the item was used
      if (NET.host && BOSSES[d.bid] && (BOSSES[d.bid].repeatable || !G.bossesDone[d.bid]) && !G.boss) summonBoss(d.bid, d.x, d.y);
      break;
    case 'lure':
      if (NET.host) lures.push({x:d.x, y:d.y, t:5});
      break;
    // --- guest receives ---
    case 'world':
      if (NET.host) break;
      startGuestWorld(d);
      break;
    case 'snap': if (!NET.host) applySnapshot(d); break;
    case 'hurt': if (mode === 'play' && player && !player.dead) hurtPlayer(d.dmg, d.sx, {fire:d.fire}); break;
    case 'kill': if (mode === 'play') rewardKill(d.info); break;
    case 'boss':
      if (mode !== 'play') break;
      G.bossesDone[d.bid] = true; NET.bossId = 0; hideBossBar();
      bossReward(d.bid);
      break;
  }
}

// ----- Guest: building the host's world -----
function startGuestWorld(d) {
  showLoading(true);
  setTimeout(() => {
    resetRuntime();
    const ch = loadCoopChar();
    G = newGameState();
    if (ch && ch.q) Object.assign(G, ch.q);
    if (ch && (ch.ww || OLD_WW) !== WW) {
      // co-op knight from the smaller world: move its waystones, forget its old home spot
      G.ways = [...new Set((G.ways || [60]).map(w => WAYSTONES.find(n => Math.abs(n - MX(w)) < 3) || MX(w)))];
      G.lastWay = MX(G.lastWay || 60); G.home = null;
    }
    G.bossesDone = Object.assign({}, d.done || {});
    G.dayT = d.dayT || 0.1;
    if (DIFFICULTIES[d.df]) G.difficulty = d.df; // the host's difficulty applies to everyone
    if (d.ver && BOOT_VERSION && d.ver !== BOOT_VERSION) {
      // whoever has the older copy needs to refresh; tell this player, the host is told too
      showUpdateNotice(Number(d.ver) > Number(BOOT_VERSION) ? 'Your game is older than the host\'s. Update to get the same settings and features.' : 'The host is running an older version. Ask them to save and refresh.');
    }
    player = newPlayer();
    generateWorld(d.seed);
    applyMods(d.mods || []);
    buildMap(); buildNPCs();
    if (ch && ch.p) {
      Object.assign(player, ch.p);
      hotbar = fitHotbar(ch.hotbar); inv = ch.inv; sel = ch.sel || 0;
    } else {
      giveStarterKit();
    }
    recalcStats(); player.hp = player.maxHp; player.mana = player.maxMana; player.dead = false;
    player.x = d.hx + 20; player.y = d.hy;
    for (let k = 0; k < 40 && rectSolid(player.x, player.y, player.w, player.h); k++) player.y -= TILE;
    NET.waitingWorld = false;
    startGame();
    if (!ch) startMainQuest();
    toast(`You joined room ${NET.room}. Your character and items are saved on this computer.`, 'blue');
    saveCoopChar(true);
  }, 30);
}
function coopCharData() {
  const p = player;
  return {ww:WW, p:{level:p.level, xp:p.xp, coins:p.coins, armorId:p.armorId, heroClass:p.heroClass || startWeapon}, hotbar, inv, sel,
    q:{mainQ:G.mainQ, mainProg:G.mainProg, side:G.side, kills:G.kills, pity:G.pity, ways:G.ways, lastWay:G.lastWay, play:G.play, deaths:G.deaths, introSeen:true,
      home:G.home || null, minisFirst:G.minisFirst}};
}
function saveCoopChar(silent) {
  try {
    if (held) { addItem(held.id, held.n, held.rare, true); held = null; updateHeld(); }
    localStorage.setItem(COOP_CHAR_KEY, JSON.stringify(coopCharData()));
    if (!silent) toast('Your co-op character is saved.', 'blue');
    return true;
  } catch (e) { if (!silent) toast('This browser blocked saving.', 'red'); return false; }
}
function loadCoopChar() { try { const s = localStorage.getItem(COOP_CHAR_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ----- Host: snapshots -----
const SNAP_KEYS = ['id', 'type', 'look', 'x', 'y', 'vx', 'vy', 'w', 'h', 'sc', 'facing', 'hp', 'maxHp', 'flags', 'name'];
function enemySnap(e) {
  const flags = (e.elite ? 1 : 0) | (e.ally ? 2 : 0) | (e.boss ? 4 : 0) | (e.onGround ? 8 : 0) | (e.breathing ? 16 : 0) |
    (e.poisonT > 0 ? 32 : 0) | (e.burnT > 0 ? 64 : 0) | (e.curseT > 0 ? 128 : 0) | ((e.stunT > 0 || e.rootT > 0) ? 256 : 0) | (e.fly ? 512 : 0) | (e.vulnerable ? 1024 : 0) | (e.mini ? 2048 : 0);
  return [e.id, e.type, e.look || 0, Math.round(e.x * 10) / 10, Math.round(e.y * 10) / 10, Math.round(e.vx), Math.round(e.vy),
    e.w, e.h, e.sc, e.facing, Math.round(e.hp), Math.round(e.maxHp), flags, e.boss || e.elite ? e.name : 0,
    Math.round((e.atkT || 0) * 100), Math.round((e.castT || 0) * 100)];
}
function sendSnapshot() {
  const en = [];
  for (const e of enemies) if (!e.dead) en.push(enemySnap(e));
  const pr = [];
  for (const p of projectiles) if (p.owner === 'e' && pr.length < 60) pr.push([p.type, Math.round(p.x), Math.round(p.y), p.r]);
  // mini-boss rest timers, as seconds left, so everyone's map matches
  const mr = {};
  for (const id in G.minis) { const left = MINIBOSS_RESPAWN - (G.play - G.minis[id]); if (left > 0 && G.play >= G.minis[id]) mr[id] = Math.round(left); }
  netSend('others', {k:'snap', en, pr, dayT:G.dayT, df:G.difficulty, mr, bd:G.bossesDone, boss:G.boss ? G.boss.id : 0, lures:lures.map(l => [Math.round(l.x), Math.round(l.y)])});
}

// ----- Guest: applying snapshots -----
function applySnapshot(d) {
  if (mode !== 'play' || !world) return;
  G.dayT = d.dayT;
  if (d.mr) { G.minis = {}; for (const id in d.mr) G.minis[id] = G.play - (MINIBOSS_RESPAWN - d.mr[id]); }
  if (DIFFICULTIES[d.df] && G.difficulty !== d.df && !(NET.diffHold > performance.now())) {
    const had = G.difficulty; G.difficulty = d.df;
    if (had && typeof updateDiffButton === 'function') { updateDiffButton(); toast(`Difficulty is now ${diff().name}.`, 'blue'); }
  }
  if (d.bd) for (const k in d.bd) G.bossesDone[k] = true;
  const seen = new Set();
  const byId = new Map(enemies.map(e => [e.id, e]));
  for (const s of d.en) {
    const [id, type, look, x, y, vx, vy, w, h, sc, facing, hp, maxHp, flags, name, atk, cast] = s;
    seen.add(id);
    let e = byId.get(id);
    if (!e) {
      e = {id, type, look:look || null, x, y, tx:x, ty:y, vx, vy, w, h, sc, facing, hp, maxHp, seed:Math.random() * 100, flash:0, proxy:true,
        def:EN[type] || {name}, ai:EN[type] ? EN[type].ai : 'boss'};
      e.name = name || (EN[type] ? EN[type].name : type);
      enemies.push(e);
    }
    e.tx = x; e.ty = y; e.vx = vx; e.vy = vy; e.w = w; e.h = h; e.sc = sc; e.facing = facing;
    if (hp < e.hp) e.flash = Math.max(e.flash, 0.06);
    e.hp = hp; e.maxHp = maxHp;
    e.elite = !!(flags & 1); e.ally = !!(flags & 2); e.boss = !!(flags & 4); e.onGround = !!(flags & 8); e.breathing = !!(flags & 16);
    e.poisonT = flags & 32 ? 1 : 0; e.burnT = flags & 64 ? 1 : 0; e.curseT = flags & 128 ? 1 : 0; e.stunT = flags & 256 ? 1 : 0; e.fly = !!(flags & 512); e.mini = flags & 2048 ? 1 : 0;
    if (name) e.name = name;
    if (atk > 0 && !(e.atkT > 0)) { e.atkT = atk / 100; e.atkHit = e.atkT <= ATK_STRIKE; }
    if (cast > 0 && !(e.castT > 0)) e.castT = cast / 100;
  }
  enemies = enemies.filter(e => seen.has(e.id));
  NET.eproj = d.pr.map(([type, x, y, r]) => ({type, x, y, r}));
  lures = (d.lures || []).map(([x, y]) => ({x, y, t:1}));
  // boss bar
  const boss = d.boss ? enemies.find(e => e.id === d.boss) : null;
  if (boss) { if (NET.bossId !== boss.id) showBossBar(boss); NET.bossId = boss.id; updateBossBar(boss); }
  else if (NET.bossId) { NET.bossId = 0; hideBossBar(); }
}
function interpolateProxies(dt) {
  const k = Math.min(1, dt * 14);
  for (const e of enemies) {
    if (!e.proxy) continue;
    // guess ahead between host updates, but never into a wall
    const nx = e.tx + e.vx * dt, ny = e.ty + e.vy * dt;
    if (e.boss || !rectSolid(nx, ny, e.w, e.h)) { e.tx = nx; e.ty = ny; }
    e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
    if (Math.abs(e.tx - e.x) > 200 || Math.abs(e.ty - e.y) > 200) { e.x = e.tx; e.y = e.ty; }
    e.flash -= dt;
    if (e.atkT > 0) { e.atkT -= dt; if (!e.atkHit && e.atkT <= ATK_STRIKE) { e.atkHit = true; enemySlashFx(e); } if (e.atkT < 0) e.atkT = 0; }
    if (e.castT > 0) e.castT = Math.max(0, e.castT - dt);
  }
}

// ----- Every frame -----
function netTick(dt) {
  if (!NET.on || mode !== 'play') return;
  NET.posT -= dt;
  if (NET.posT <= 0) {
    NET.posT = 1 / 15;
    const p = player, s = hotbar[sel];
    netSend('others', {k:'pos', x:Math.round(p.x * 10) / 10, y:Math.round(p.y * 10) / 10, vx:Math.round(p.vx), vy:Math.round(p.vy), f:p.facing, g:p.onGround,
      wp:Math.round((p.walkPhase || 0) * 100) / 100, a:p.armorId, h:s ? s.id : null, r:!!(s && s.rare), sw:p.swingT, sd:p.swingDur, al:p.aimLocal,
      m:p.mining, hp:Math.round(p.hp), mhp:p.maxHp, dead:p.dead, lv:p.level, n:NET.name, c:p.heroClass || startWeapon});
  }
  if (NET.host) {
    NET.snapT -= dt;
    if (NET.snapT <= 0) { NET.snapT = 1 / 12; sendSnapshot(); }
  } else interpolateProxies(dt);
  // smooth remote knights
  const k = Math.min(1, dt * 14);
  for (const pr of NET.peers.values()) {
    if (!pr.seen) continue;
    pr.tx += pr.vx * dt * 0.5; pr.ty += pr.vy * dt * 0.5;
    pr.x += (pr.tx - pr.x) * k; pr.y += (pr.ty - pr.y) * k;
    if (Math.abs(pr.tx - pr.x) > 300 || Math.abs(pr.ty - pr.y) > 300) { pr.x = pr.tx; pr.y = pr.ty; }
    pr.swingT = Math.max(0, pr.swingT - dt);
  }
}

// ----- Targets: every living knight in the game -----
function allTargets() {
  const list = [];
  if (player && !player.dead) list.push(player);
  if (NET.on) for (const pr of NET.peers.values()) if (pr.seen && !pr.dead) list.push(pr);
  return list;
}
function nearestTarget(x, y) {
  let best = null, bd = Infinity;
  for (const t of allTargets()) { const d = Math.hypot(ecx(t) - x, ecy(t) - y); if (d < bd) { bd = d; best = t; } }
  return best;
}
// Damage a knight: the local one directly, a remote one through the relay.
function damageTarget(t, dmg, srcX, opt = {}) {
  if (!t) return;
  if (t === player) { hurtPlayer(dmg, srcX, opt); return; }
  if (t.hitCd && G.time - t.hitCd < 0.6) return;
  t.hitCd = G.time;
  netSend(t.id, {k:'hurt', dmg, sx:srcX, fire:!!opt.fire});
}
// ----- Version check: everyone should run the same, newest copy of the game -----
let BOOT_VERSION = null;
function checkVersion() {
  if (!netAvailable() || netLikelyNoServer()) return;
  fetch('/version', {cache:'no-store'}).then(r => r.ok ? r.text() : null).then(v => {
    if (!v) return;
    if (BOOT_VERSION === null) { BOOT_VERSION = v; return; }
    if (v !== BOOT_VERSION) {
      if (mode !== 'play') { location.reload(); return; } // on the title screen: just load the new version
      showUpdateNotice('A new version of Dragonhold is ready.');
    }
  }).catch(() => {});
}
function showUpdateNotice(text) {
  $('updateText').textContent = text;
  $('updateBar').hidden = false;
}
setTimeout(checkVersion, 500);
setInterval(checkVersion, 30000);
function netTile(x, y, t) {
  if (!NET.on || NET.applying) return;
  netSend('others', {k:'tile', x, y, t});
}
function updateRoomTag() {
  const el = $('roomTag'); if (!el) return;
  if (!NET.on) { el.hidden = true; return; }
  el.hidden = false;
  const names = [NET.name + ' (you)'].concat([...NET.peers.values()].map(p => p.name));
  el.innerHTML = `<b>Room ${NET.room}</b> · ${names.length}/3 · ${names.join(', ')}`;
}
function drawRemoteKnights(g, time) {
  if (!NET.on) return;
  for (const pr of NET.peers.values()) {
    if (!pr.seen || pr.dead) continue;
    drawKnight(g, pr, time);
    const cx = pr.x + pr.w / 2, ty = pr.y - 14;
    g.font = '600 6px system-ui, sans-serif'; g.textAlign = 'center';
    const label = `${pr.name} · Lv ${pr.level}`, w = g.measureText(label).width + 6;
    g.fillStyle = 'rgba(10,8,14,0.6)'; rrect(g, cx - w / 2, ty - 6.5, w, 8.5, 3); g.fill();
    g.fillStyle = '#9fe0ff'; g.fillText(label, cx, ty);
    const hpw = 20, f = Math.max(0, pr.hp / pr.maxHp);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(cx - hpw / 2, ty + 3, hpw, 2);
    g.fillStyle = '#e04848'; g.fillRect(cx - hpw / 2, ty + 3, hpw * f, 2);
  }
}
