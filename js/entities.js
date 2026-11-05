'use strict';
// ===== Shared game state =====
const GRAV = 1150;
let player = null;
let enemies = [], projectiles = [], particles = [], floaters = [], effects = [], lures = [];
let G = null; // persistent progress (see newGameState)

function newGameState() {
  return {time:0, play:0, dayT:0.08, bossesDone:{}, kills:{}, pity:{}, ways:[60], lastWay:60,
    mainQ:0, mainProg:0, side:{greta:{i:0, active:false, prog:0}, fennick:{i:0, active:false, prog:0}},
    won:false, deaths:0, spawnT:3, introSeen:false, herbT:10, minis:{}, minisFirst:{}, miniT:1, difficulty:'normal'};
}
function diff() { return DIFFICULTIES[G && G.difficulty] || DIFFICULTIES.normal; }
function newPlayer() {
  return {x:0, y:0, w:12, h:28, vx:0, vy:0, facing:1, onGround:false, anim:0,
    level:1, xp:0, hp:100, maxHp:100, mana:50, maxMana:50, def:0, coins:0,
    iframes:0, attackCd:0, swingT:0, swingDur:0.3, dashT:0, potionCd:0, lastHurt:-99, lastCast:-99, lavaT:0,
    quakeCount:0, dead:false, deathT:0, armorId:null, heldItem:null, aimLocal:0, mining:false, mineX:-1, mineY:-1, mineP:0,
    heroClass: typeof startWeapon !== 'undefined' ? startWeapon : 'sword'};
}

// ===== Helpers =====
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const ecx = e => e.x + e.w / 2, ecy = e => e.y + e.h / 2;
function isNight() { return daylight() < 0.5; }
function daylight() {
  const t = G.dayT;
  if (t < 0.05) return lerp(0.4, 1, t / 0.05);
  if (t < 0.6) return 1;
  if (t < 0.68) return lerp(1, 0.4, (t - 0.6) / 0.08);
  return 0.4;
}
function addFloater(x, y, txt, col, big) { floaters.push({x, y, txt: String(txt), col, life:0.9, max:0.9, big:!!big, vy:-38}); }
function addParticles(x, y, col, n, spd = 90, life = 0.5, grav = 300) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random() * 0.7);
    particles.push({x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s - spd * 0.3, life:life * (0.5 + Math.random() * 0.5), max:life, col, size:1 + Math.random() * 1.5, grav});
  }
}
function barrierLimit() {
  if (!BARRIERS_ON) return Infinity;
  for (const b of BARRIERS) if (!G.bossesDone[b.boss]) return b.x * TILE;
  return Infinity;
}
function liquidAt(px, py) {
  const t = getT(Math.floor(px / TILE), Math.floor(py / TILE));
  return TP[t].liquid || null;
}

// ===== Physics =====
function rectSolid(x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tx, ty)) return true;
  return false;
}
// True when nothing solid lies on the straight line between two points (sampled every 6px).
function clearPath(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 6));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (isSolid(Math.floor((x0 + (x1 - x0) * t) / TILE), Math.floor((y0 + (y1 - y0) * t) / TILE))) return false;
  }
  return true;
}
// Can attacker a reach target b without a wall in between? Checks a few lines (upper/middle body to
// head/middle/feet) so uneven ground and steps don't block a real hit, but a wall does.
function canReach(a, b) {
  const ax = ecx(a), bx = ecx(b);
  const ays = [a.y + a.h * 0.5, a.y + a.h * 0.25], bys = [b.y + b.h * 0.5, b.y + 4, b.y + b.h - 4];
  for (const ay of ays) for (const by of bys) if (clearPath(ax, ay, bx, by)) return true;
  return false;
}
function moveEntity(e, dt, stepUp) {
  const wasGround = e.onGround, startRight = e.x + e.w;
  e.hitWall = false; e.onGround = false;
  const dx = e.vx * dt, dy = e.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
  const sx = dx / steps, sy = dy / steps;
  let bx = false, by = false;
  for (let i = 0; i < steps; i++) {
    if (!bx && sx !== 0) {
      e.x += sx;
      if (rectSolid(e.x, e.y, e.w, e.h)) {
        if (stepUp && (wasGround || e.onGround) && !rectSolid(e.x, e.y - TILE, e.w, e.h)) {
          e.y -= TILE; e.visOff = (e.visOff || 0) + TILE;
        } else {
          if (sx > 0) e.x = Math.floor((e.x + e.w) / TILE) * TILE - e.w - 0.01;
          else e.x = (Math.floor(e.x / TILE) + 1) * TILE + 0.01;
          e.vx = 0; e.hitWall = true; bx = true;
        }
      }
    }
    if (!by && sy !== 0) {
      e.y += sy;
      if (rectSolid(e.x, e.y, e.w, e.h)) {
        if (sy > 0) { e.y = Math.floor((e.y + e.h) / TILE) * TILE - e.h - 0.01; e.onGround = true; }
        else e.y = (Math.floor(e.y / TILE) + 1) * TILE + 0.01;
        e.vy = 0; by = true;
      }
    }
  }
  if (!e.onGround && e.vy >= 0 && rectSolid(e.x, e.y + 1, e.w, e.h)) e.onGround = true;
  e.x = clamp(e.x, 0, WW * TILE - e.w);
  const lim = barrierLimit();
  // the boss barrier is a wall from the west side only; never pull something back through it
  if (e.x + e.w > lim && startRight <= lim + 1) { e.x = lim - e.w - 0.01; if (e.vx > 0) e.vx = 0; e.hitWall = true; }
  if (e.y > WH * TILE) e.y = 0;
}

// ===== Player =====
function recalcStats() {
  const p = player, arm = p.armorId ? ITEMS[p.armorId] : null;
  p.maxHp = playerMaxHp(p.level) + (arm ? arm.hp : 0);
  p.maxMana = playerMaxMana(p.level);
  p.def = arm ? arm.def : 0;
  p.hp = Math.min(p.hp, p.maxHp); p.mana = Math.min(p.mana, p.maxMana);
}
function gainXp(n) {
  const p = player;
  if (p.level >= 60) return;
  p.xp += n;
  while (p.level < 60 && p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level); p.level++;
    recalcStats(); p.hp = p.maxHp; p.mana = p.maxMana;
    addFloater(ecx(p), p.y - 10, 'LEVEL UP!', '#ffd45a', true);
    addParticles(ecx(p), ecy(p), '#ffd45a', 30, 140, 0.9, 100);
    toast(`Level ${p.level}! Health, damage and mana increased.`, 'gold');
  }
  if (p.level >= 60) p.xp = 0;
}
function hurtPlayer(amt, srcX, opt = {}) {
  const p = player;
  if (p.dead || p.iframes > 0 || p.dashT > 0) return;
  const red = p.def / (p.def + 50);
  let d = amt * (1 - red);
  if (opt.fire && p.armorId === 'armor_dragon') d *= 0.6;
  d = Math.max(1, Math.round(d));
  p.hp -= d; p.iframes = 0.65; p.lastHurt = G.time;
  if (!opt.noKb) { p.vx = Math.sign(ecx(p) - srcX || 1) * 230; p.vy = -190; }
  addFloater(ecx(p), p.y, d, '#ff5a5a');
  shake(3);
  if (p.hp <= 0) playerDie();
}
function healPlayer(n, show) {
  const p = player; if (p.dead) return;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  if (show && p.hp - before >= 1) addFloater(ecx(p), p.y - 4, '+' + Math.round(p.hp - before), '#6dff8a');
}
function playerDie() {
  const p = player;
  p.dead = true; p.hp = 0; p.deathT = 1.5; G.deaths++;
  const lost = Math.floor(p.coins * diff().coinLoss); p.coins -= lost;
  addParticles(ecx(p), ecy(p), '#c03030', 40, 160, 1);
  showDeath(lost);
  if (G.boss && allTargets().length === 0) { despawnBoss(false); }
}
// where: 'home' (your spawn point), 'way' (last waystone) or 'village'
function respawnPlayer(where) {
  const p = player;
  if (!p.dead || p.deathT > 0) return;
  p.dead = false; p.hp = p.maxHp; p.mana = p.maxMana; p.iframes = 2; p.vx = p.vy = 0;
  if (where === 'home' && G.home) placeAt(G.home.x, G.home.y);
  else placeAtWaystone(where === 'village' ? 60 : G.lastWay);
  if (!NET.on) { enemies = enemies.filter(e => e.ally); projectiles = projectiles.filter(pr => pr.owner === 'p'); }
  hideDeath();
}
function placeAt(x, y) {
  const p = player;
  p.x = x; p.y = y; p.vx = p.vy = 0;
  for (let k = 0; k < 40 && rectSolid(p.x, p.y, p.w, p.h); k++) p.y -= TILE; // if something was built there since
}
// ===== Spawn point and returning home =====
const RECALL_COOLDOWN = 20; // seconds between trips home
function setHome() {
  const p = player;
  if (p.dead) return;
  if (!p.onGround) { toast('Stand on solid ground to set your spawn point.'); return; }
  G.home = {x:Math.round(p.x), y:Math.round(p.y)};
  addParticles(ecx(p), p.y + p.h, '#ffd45a', 24, 120, 0.7);
  toast('Spawn point set. You will respawn here, and H brings you back.', 'gold');
  saveGame(true);
}
function returnHome() {
  const p = player;
  if (p.dead) return;
  if (G.boss && Math.hypot(ecx(G.boss) - ecx(p), ecy(G.boss) - ecy(p)) < 1200) { toast("You can't go home in the middle of a boss fight!", 'red'); return; }
  const last = G.recallAt, wait = last == null || last > G.time ? 0 : RECALL_COOLDOWN - (G.time - last);
  if (wait > 0) { toast(`You can go home again in ${Math.ceil(wait)}s.`); return; }
  G.recallAt = G.time;
  addParticles(ecx(p), ecy(p), '#8fd0ff', 30, 160, 0.7);
  if (G.home) placeAt(G.home.x, G.home.y); else placeAtWaystone(60);
  p.iframes = Math.max(p.iframes, 1);
  addParticles(ecx(p), ecy(p), '#8fd0ff', 30, 160, 0.7);
  toast(G.home ? 'You return home.' : 'You return to the village. Set a spawn point to make your own home.', 'blue');
}
function placeAtWaystone(wx) {
  const p = player;
  p.x = wx * TILE + TILE / 2 - p.w / 2 + 20;
  p.y = (tops[wx] - 2) * TILE - p.h;
  for (let k = 0; k < 40 && rectSolid(p.x, p.y, p.w, p.h); k++) p.y -= TILE;
}

function onLadder(e) {
  const tx = Math.floor(ecx(e) / TILE);
  for (let y = Math.floor((e.y + 4) / TILE); y <= Math.floor((e.y + e.h - 1) / TILE); y++) if (getT(tx, y) === T.LADDER) return true;
  return false;
}
function ladderBelow(e) { return getT(Math.floor(ecx(e) / TILE), Math.floor((e.y + e.h + 2) / TILE)) === T.LADDER; }
function updatePlayer(dt) {
  const p = player;
  if (p.dead) {
    p.deathT -= dt; updateDeathTimer(p.deathT);
    return;
  }
  p.anim += dt;
  p.visOff = (p.visOff || 0) * Math.exp(-dt * 16);
  p.landT = Math.max(0, (p.landT || 0) - dt);
  p.walkPhase = (p.walkPhase || 0) + (p.onGround ? Math.abs(p.vx) * dt * 0.085 : 0);
  p.iframes = Math.max(0, p.iframes - dt);
  p.attackCd -= dt; p.swingT = Math.max(0, p.swingT - dt); p.potionCd -= dt;
  const water = liquidAt(ecx(p), ecy(p)) === 'water';
  const lava = liquidAt(ecx(p), p.y + p.h - 2) === 'lava' || liquidAt(ecx(p), ecy(p)) === 'lava';
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (p.dashT > 0) {
    p.dashT -= dt;
    for (const e of enemies) if (!e.dead && !e.ally && !p.dashHit.has(e) && overlap(p, e)) {
      p.dashHit.add(e); meleeHit(e, p.dashItem.item, p.dashItem.rare, 0.6);
    }
    if (p.dashT <= 0) p.vx *= 0.3;
  } else {
    const maxSp = water ? 95 : 155, acc = p.onGround ? 1500 : 950;
    if (move) { p.vx = approach(p.vx, move * maxSp, acc * dt); if (!input.mouseL) p.facing = move; }
    else p.vx = approach(p.vx, 0, (p.onGround ? 1700 : 450) * dt);
    if (Math.abs(p.vx) > maxSp) p.vx = approach(p.vx, Math.sign(p.vx) * maxSp, 1200 * dt);
  }
  // the top rung of a ladder works like a floor (walk right over a mine shaft) unless you press down
  {
    const ftx = Math.floor(ecx(p) / TILE), fty = Math.floor((p.y + p.h + 1) / TILE);
    if (!input.down && p.vy >= 0 && p.dashT <= 0 && getT(ftx, fty) === T.LADDER && getT(ftx, fty - 1) !== T.LADDER && p.y + p.h <= fty * TILE + 5) {
      p.y = fty * TILE - p.h; p.vy = 0; p.onGround = true;
    }
  }
  // ladders: hold on, jump/up climbs, down climbs down, no falling while on one
  const ladder = onLadder(p) || (input.down && ladderBelow(p));
  if (ladder && p.dashT <= 0) {
    p.vy = input.jump ? -150 : input.down ? 170 : 0;
    p.vx *= 0.85;
    input.jumpPressed = false;
  } else {
    if (input.jumpPressed && (p.onGround || water)) { p.vy = water ? -230 : -385; }
    input.jumpPressed = false;
    if (!input.jump && p.vy < -120 && !water) p.vy += GRAV * 1.2 * dt;
    if (p.dashT <= 0) p.vy += GRAV * (water ? 0.35 : 1) * dt;
    p.vy = Math.min(p.vy, water ? 130 : 720);
  }
  const wasGround = p.onGround, fallV = p.vy;
  moveEntity(p, dt, true);
  if (!wasGround && p.onGround && fallV > 260) { p.landT = 0.12; if (fallV > 500) addParticles(ecx(p), p.y + p.h, '#c8b8a0', 6, 50, 0.35, 200); }
  if (lava) {
    p.lavaT -= dt;
    if (p.lavaT <= 0) {
      p.lavaT = 0.5;
      const pct = p.armorId === 'armor_dragon' ? 0.03 : 0.14;
      const wasI = p.iframes; p.iframes = 0;
      hurtPlayer(p.maxHp * pct / (1 - p.def / (p.def + 50)), ecx(p), {noKb:true, fire:true});
      if (!p.dead) p.iframes = wasI;
      if (!p.dead) p.vy = Math.min(p.vy, -160);
    }
  }
  // regeneration
  if (G.time - p.lastHurt > 5) healPlayer(p.maxHp * 0.012 * dt);
  const mrate = G.time - p.lastCast > 1 ? 0.11 : 0.045; // mana refills faster, even while casting
  p.mana = Math.min(p.maxMana, p.mana + p.maxMana * mrate * dt);
  // waystone discovery
  const ptx = Math.floor(ecx(p) / TILE);
  for (const w of WAYSTONES) if (Math.abs(ptx - w) <= 2 && Math.abs(ecy(p) / TILE - tops[w]) < 6) {
    if (!G.ways.includes(w)) { G.ways.push(w); toast('Waystone activated! Right-click a waystone to fast travel.', 'blue'); saveGame(true); }
    G.lastWay = w;
  }
}

// ===== Using items =====
function weaponDamage(item, rare) { return item.dmg * (rare ? 1.25 : 1) * playerDmgMult(player.level); }
// ===== Class-locked weapons =====
function myClass() { return classOf((player && player.heroClass) || (typeof startWeapon !== 'undefined' ? startWeapon : 'sword')) || 'sword'; }
function canUseWeapon(item) { const c = weaponClass(item); return !c || c === myClass(); }
// says why you can't use another class's weapon (at most once a second)
function classLockMsg(item) {
  const p = player;
  if (G.time - (p.lockMsgT || -9) < 1) return;
  p.lockMsgT = G.time;
  toast(`Only a ${CLASS_LABEL[weaponClass(item)]} can use the ${item.name}.`);
}
// ===== Aiming: 'cursor' aims exactly where the mouse is; 'smart' locks onto the best enemy =====
let aimMode = 'cursor';
try { if (localStorage.getItem('dragonhold_aim') === 'smart') aimMode = 'smart'; } catch (e) {}
function setAimMode(m) {
  aimMode = m === 'smart' ? 'smart' : 'cursor';
  try { localStorage.setItem('dragonhold_aim', aimMode); } catch (e) {}
}
// Smart target: the enemy closest to your cursor (within 220px of it), otherwise the one closest
// to you. Only enemies within 480px that you have a clear line to.
function smartTarget() {
  const p = player, px = ecx(p), py = p.y + 10;
  let best = null, bs = Infinity;
  for (const e of enemies) {
    if (e.dead || e.ally) continue;
    const dp = Math.hypot(ecx(e) - px, ecy(e) - py);
    if (dp > 480 || !clearPath(px, py, ecx(e), ecy(e))) continue;
    const dc = Math.hypot(ecx(e) - mouse.wx, ecy(e) - mouse.wy);
    const score = dc < 220 ? dc : 1000 + dp;
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}
function aimPoint() {
  if (aimMode === 'smart') { const e = smartTarget(); if (e) return {x:ecx(e), y:ecy(e), target:e}; }
  return {x:mouse.wx, y:mouse.wy, target:null};
}
// Smart mining: the first breakable tile on the line from you toward the cursor, within reach.
function mineTile() {
  const cx = Math.floor(mouse.wx / TILE), cy = Math.floor(mouse.wy / TILE);
  if (aimMode !== 'smart') return [cx, cy];
  const p = player, px = ecx(p), py = ecy(p), d = Math.hypot(mouse.wx - px, mouse.wy - py) || 1;
  const reach = Math.min(d, 6.5 * TILE);
  for (let s = 6; s <= reach; s += 4) {
    const tx = Math.floor((px + (mouse.wx - px) / d * s) / TILE), ty = Math.floor((py + (mouse.wy - py) / d * s) / TILE);
    const t = getT(tx, ty), pr = TP[t];
    if (t !== T.AIR && !pr.liquid && pr.hard < 99) return [tx, ty];
  }
  return [cx, cy];
}
function aimAngle() {
  const p = player, ap = aimPoint();
  return Math.atan2(ap.y - (p.y + 10), ap.x - ecx(p));
}
function attack(item, slot) {
  const p = player, wt = WTYPE[item.wt];
  if (!canUseWeapon(item)) { classLockMsg(item); return; }
  let cd = item.cd || wt.cd;
  if (item.fx === 'lunar' && isNight()) cd *= 0.65;
  if (item.fx === 'bloodmoon') cd *= isNight() ? 0.6 : 0.75;
  p.attackCd = cd;
  p.facing = aimPoint().x >= ecx(p) ? 1 : -1;
  const rare = !!slot.rare;
  if (item.wt === 'wand') { castSpell(item, rare); return; }
  if (item.wt === 'bow') { shootBow(item, rare); return; }
  p.swingDur = Math.min(cd * 0.9, 0.28); p.swingT = p.swingDur;
  const cleave = item.fx === 'cleave';
  const baseRange = item.range || wt.range;
  const range = baseRange * (rare ? 1.1 : 1) * (cleave ? 1.8 : 1);
  // Cleave sweeps all the way around you; broadsword swings hit with extra height and forward reach
  const hb = cleave ? {x: ecx(p) - range, y: p.y - 28, w: range * 2, h: p.h + 44}
    : {x: p.facing > 0 ? ecx(p) - 6 : ecx(p) - range + 6, y: p.y - 18, w: range, h: p.h + 30};
  if (cleave) { effects.push({type:'ring', x:ecx(p), y:ecy(p), r:range, life:0.22, max:0.22, col:'#e0603a'}); }
  if (item.fx === 'dash') { p.dashT = 0.16; p.vx = p.facing * 640; p.vy = Math.min(p.vy, 0); p.dashHit = new Set(); p.dashItem = {item, rare}; }
  let hit = 0;
  for (const e of enemies) if (!e.dead && !e.ally && overlap(hb, e)) { meleeHit(e, item, rare, 1); hit++; if (p.dashHit) p.dashHit.add(e); }
  const dmg = weaponDamage(item, rare);
  if (item.fx === 'dragonfire') addProj({x:ecx(p), y:p.y + 12, vx:p.facing * 330, vy:0, type:'flamewave', dmg:dmg * 0.5, owner:'p', life:0.9, r:8, pierce:true, fx:'burn', ghost:true});
  if (item.fx === 'shockwave') addProj({x:ecx(p) + p.facing * 14, y:p.y + p.h - 6, vx:p.facing * 300, vy:0, type:'shock', dmg:dmg * 0.6, owner:'p', life:0.8, r:7, pierce:true, fx:'stun'});
  if (item.fx === 'warcry') {
    for (const s of [-1, 1]) addProj({x:ecx(p) + s * 14, y:p.y + p.h - 6, vx:s * 340, vy:0, type:'shock', dmg:dmg * 0.75, owner:'p', life:1, r:8, pierce:true, fx:'stun'});
    effects.push({type:'ring', x:ecx(p), y:p.y + p.h, r:46, life:0.3, max:0.3, col:'#d8b878'}); shake(3);
  }
  if (item.fx === 'midas') {
    for (let i = 0; i < (rare ? 5 : 3); i++) {
      const a = -0.5 - i * 0.22 + (Math.random() - 0.5) * 0.2;
      addProj({x:ecx(p) + p.facing * 10, y:p.y + 10, vx:p.facing * Math.cos(a) * 380, vy:Math.sin(a) * 380, type:'coin', dmg:dmg * 0.3, owner:'p', life:2, r:3, grav:650, bounces:2, fx:'coin', rare});
    }
  }
  if (item.fx === 'quake' && hit) {
    p.quakeCount++;
    if (p.quakeCount % 3 === 0) {
      const qx = ecx(p) + p.facing * 24, qy = p.y + p.h, R = rare ? 125 : 95;
      effects.push({type:'ring', x:qx, y:qy, r:R, life:0.35, max:0.35, col:'#d8b878'});
      shake(5);
      for (const e of enemies) if (!e.dead && !e.ally && Math.hypot(ecx(e) - qx, ecy(e) - qy) < R) {
        enemyFx(e, 'stun', false, 1.2); damageEnemy(e, dmg * 0.5, {kb:0});
      }
    }
  }
}
function meleeHit(e, item, rare, mult) {
  const p = player;
  let dmg = weaponDamage(item, rare) * mult;
  if (item.fx === 'steady' && p.hp >= p.maxHp - 0.5) dmg *= rare ? 1.25 : 1.15;
  if (item.fx === 'bloodrage') dmg *= 1 + (1 - p.hp / p.maxHp) * (rare ? 1.4 : 1);
  const crit = Math.random() < (item.fx === 'reap' ? 0.25 : item.fx === 'lifesteal' ? 0.2 : WTYPE[item.wt].crit || 0.05);
  if (crit) dmg *= 2;
  const baseKb = item.kb || WTYPE[item.wt].kb;
  const kb = baseKb * (item.fx === 'knock' ? (rare ? 2.8 : 2.2) : 1);
  damageEnemy(e, dmg, {kb: p.facing * kb, crit});
  // a hit spark in the weapon's color (bigger on a critical hit)
  effects.push({type:'impact', x:ecx(e) - p.facing * e.w * 0.2, y:ecy(e), r:crit ? 22 : 14, life:crit ? 0.22 : 0.15, max:crit ? 0.22 : 0.15, col:item.col || '#ffffff'});
  addParticles(ecx(e), ecy(e), item.col || '#fff', crit ? 10 : 5, 110, 0.3);
  switch (item.fx) {
    // ---- boss weapon powers ----
    case 'cleave': enemyFx(e, 'poison', rare, weaponDamage(item, rare) * 0.6); break; // bleed
    case 'bloodmoon': healPlayer(dmg * (isNight() ? 0.12 : 0.06), true); enemyFx(e, 'poison', rare, weaponDamage(item, rare) * 0.5); break;
    case 'reap': healPlayer(dmg * (rare ? 0.13 : 0.1), true); if (!e.proxy && e.hp <= 0) { healPlayer(p.maxHp * 0.06, true); addParticles(ecx(e), ecy(e), '#6effc2', 18, 120, 0.6, -80); } break;
    case 'midas': e.coinMark = G.time; break;
    case 'eruption': {
      enemyFx(e, 'burnm', rare, weaponDamage(item, rare));
      p.eruptCount = (p.eruptCount || 0) + 1;
      if (p.eruptCount % 3 === 0) {
        const ex = ecx(e), ey = e.y + e.h, R = rare ? 95 : 75;
        effects.push({type:'ring', x:ex, y:ey, r:R, life:0.4, max:0.4, col:'#ff7a1a'});
        effects.push({type:'ring', x:ex, y:ey, r:R * 0.5, life:0.3, max:0.3, col:'#ffd060'});
        addParticles(ex, ey - 6, '#ff7a1a', 30, 220, 0.7, 300); addParticles(ex, ey - 6, '#ffd060', 14, 160, 0.5, 300);
        shake(5);
        for (const o of enemies) if (!o.dead && !o.ally && Math.hypot(ecx(o) - ex, ecy(o) - ey) < R) damageEnemy(o, dmg * 1.2, {kb:Math.sign(ecx(o) - ex || 1) * 200, fx:'burn'});
      }
      break;
    }
    case 'slow': if (Math.random() < (rare ? 0.5 : 0.3)) enemyFx(e, 'slow', rare, 0); break;
    case 'shards':
      for (let i = 0; i < (rare ? 5 : 3); i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a) * 260, vy:Math.sin(a) * 260, type:'shard', dmg:dmg * 0.3, owner:'p', life:0.6, r:2, grav:500, ignore:e});
      }
      break;
    case 'poison': enemyFx(e, 'poison', rare, weaponDamage(item, rare)); break;
    case 'lunar': if (isNight()) healPlayer(dmg * (rare ? 0.15 : 0.1), true); break;
    case 'regen': healPlayer(p.maxHp * (rare ? 0.045 : 0.03), true); break;
    case 'dragonfire': enemyFx(e, 'burnm', rare, weaponDamage(item, rare)); break;
    case 'lifesteal': healPlayer(dmg * (rare ? 0.12 : 0.08), true); break;
  }
}
// Status effects on an enemy; a co-op guest asks the host to apply them.
function enemyFx(e, fx, rare, base) {
  if (e.dead || e.ally) return;
  if (e.proxy) { netSend('host', {k:'fx', id:e.id, fx, rare:!!rare, base}); return; }
  switch (fx) {
    case 'slow': e.slowT = 2; break;
    case 'poison': e.poisonStacks = Math.min(5, (e.poisonStacks || 0) + 1); e.poisonT = 4; e.poisonDps = base * (rare ? 0.22 : 0.15); break;
    case 'burnm': e.burnT = 3; e.burnDps = base * (rare ? 0.35 : 0.25); break;
    case 'stun': if (!e.boss || base < 1) e.stunT = Math.max(e.stunT || 0, base); break;
  }
}
// ===== Arcane Burst: every wand's heavy spell (right click or X) =====
// A big slow orb that explodes on whatever it hits: 3x the wand's damage to every enemy
// in the blast, plus the wand's own effect. Short cooldown, costs a bit more mana.
const BURST_COOLDOWN = 4, BURST_DAMAGE = 3, BURST_RADIUS = 64;
function burstWait() { const p = player, last = p.burstAt; return last == null || last > G.time ? 0 : Math.max(0, BURST_COOLDOWN - (G.time - last)); }
function castBurst(item, rare) {
  if (!canUseWeapon(item)) { classLockMsg(item); return; }
  const p = player, cost = Math.max(4, (item.mana || 2) * 2);
  const wait = burstWait();
  if (wait > 0) { if (G.time - (p.burstMsgT || -9) > 0.8) { toast(`Arcane Burst is recharging (${wait.toFixed(1)}s).`); p.burstMsgT = G.time; } return; }
  if (p.mana < cost) { if (G.time - (p.noManaT || 0) > 1.5) { toast('Not enough mana for Arcane Burst. Press R to drink a mana potion.'); p.noManaT = G.time; } return; }
  p.mana -= cost; p.lastCast = G.time; p.burstAt = G.time;
  const sx = ecx(p), sy = p.y + 10, a = aimAngle();
  p.facing = Math.cos(a) >= 0 ? 1 : -1;
  p.aimLocal = p.facing > 0 ? a : Math.PI - a;
  const col = item.col || '#c08cff';
  addParticles(sx + Math.cos(a) * 12, sy + Math.sin(a) * 12, col, 18, 160, 0.45, 0);
  effects.push({type:'ring', x:sx + Math.cos(a) * 12, y:sy + Math.sin(a) * 12, r:22, life:0.25, max:0.25, col});
  addProj({x:sx, y:sy, vx:Math.cos(a) * 360, vy:Math.sin(a) * 360, type:'burst', dmg:weaponDamage(item, rare) * BURST_DAMAGE, owner:'p', life:1.6, r:6,
    fx:['curse', 'root', 'slow', 'raise', 'coin', 'burn', 'stun'].includes(item.fx) ? item.fx : null, rare, col, burst:true});
}
function explodeBurst(pr) {
  if (pr.exploded) return;
  pr.exploded = true; pr.dead = true;
  const R = BURST_RADIUS * (pr.rare ? 1.2 : 1);
  effects.push({type:'ring', x:pr.x, y:pr.y, r:R, life:0.35, max:0.35, col:pr.col});
  effects.push({type:'ring', x:pr.x, y:pr.y, r:R * 0.55, life:0.25, max:0.25, col:'#ffffff'});
  addParticles(pr.x, pr.y, pr.col, 34, 220, 0.6, 0);
  addParticles(pr.x, pr.y, '#ffffff', 12, 140, 0.35, 0);
  shake(4);
  for (const e of enemies) {
    if (e.dead || e.ally) continue;
    const ex = Math.max(e.x, Math.min(pr.x, e.x + e.w)), ey = Math.max(e.y, Math.min(pr.y, e.y + e.h)); // nearest point of the enemy
    if (Math.hypot(ex - pr.x, ey - pr.y) <= R) damageEnemy(e, pr.dmg, {kb:Math.sign(ecx(e) - pr.x || 1) * 160, fx:pr.fx, rare:pr.rare});
  }
}
function castSpell(item, rare) {
  const p = player;
  if (p.mana < item.mana) { if (G.time - (p.noManaT || 0) > 1.5) { toast('Not enough mana. Press R to drink a mana potion.'); p.noManaT = G.time; } return; }
  p.mana -= item.mana; p.lastCast = G.time;
  const sx = ecx(p), sy = p.y + 10, a = aimAngle(), dmg = weaponDamage(item, rare);
  // a bright burst at the wand tip
  addParticles(sx + Math.cos(a) * 10, sy + Math.sin(a) * 10, item.col || '#c08cff', 9, 110, 0.35, 0);
  effects.push({type:'ring', x:sx + Math.cos(a) * 10, y:sy + Math.sin(a) * 10, r:12, life:0.18, max:0.18, col:item.col || '#c08cff'});
  p.aimLocal = p.facing > 0 ? a : Math.PI - a;
  switch (item.proj) {
    case 'hex': addProj({x:sx, y:sy, vx:Math.cos(a) * 440, vy:Math.sin(a) * 440, type:'hex', dmg, owner:'p', life:1.4, r:4, fx:'curse', rare}); break;
    case 'spark': addProj({x:sx, y:sy, vx:Math.cos(a) * 460, vy:Math.sin(a) * 460, type:'hex', dmg, owner:'p', life:1.2, r:3.5, fx:item.sparkFx || 'slow', rare}); break;
    case 'thorn': addProj({x:sx, y:sy, vx:Math.cos(a) * 430, vy:Math.sin(a) * 430, type:'thorn', dmg, owner:'p', life:1.3, r:4, fx:'root', rare, pierce:true}); break;
    case 'skull': addProj({x:sx, y:sy, vx:Math.cos(a) * 340, vy:Math.sin(a) * 340, type:'skull', dmg, owner:'p', life:2, r:4, fx:'raise', homing:true, rare}); break;
    case 'coin': addProj({x:sx, y:sy, vx:Math.cos(a) * 400, vy:Math.sin(a) * 400 - 60, type:'coin', dmg, owner:'p', life:2.2, r:3, grav:650, bounces:3, fx:'coin', rare}); break;
    case 'beam': {
      const R = rare ? 330 : 270; let ex = sx, ey = sy, target = null;
      for (let d = 0; d < R; d += 6) {
        ex = sx + Math.cos(a) * d; ey = sy + Math.sin(a) * d;
        if (isSolid(Math.floor(ex / TILE), Math.floor(ey / TILE))) break;
        target = enemies.find(e => !e.dead && !e.ally && ex > e.x - 3 && ex < e.x + e.w + 3 && ey > e.y - 3 && ey < e.y + e.h + 3);
        if (target) break;
      }
      effects.push({type:'beam', x1:sx, y1:sy, x2:ex, y2:ey, life:0.1, max:0.1, col:'#8ff0ff'});
      if (target) { damageEnemy(target, dmg, {kb:0}); healPlayer(dmg * (rare ? 0.4 : 0.3)); }
      break;
    }
    case 'chain': {
      let tgt = null, best = 170;
      const ap = aimPoint();
      if (ap.target) tgt = ap.target;
      else for (const e of enemies) {
        if (e.dead || e.ally) continue;
        const d = Math.hypot(ecx(e) - mouse.wx, ecy(e) - mouse.wy);
        if (d < best && Math.hypot(ecx(e) - sx, ecy(e) - sy) < 460) { best = d; tgt = e; }
      }
      if (!tgt) { effects.push({type:'arc', pts:[[sx, sy], [ap.x, ap.y]], life:0.15, max:0.15}); break; }
      const hitSet = new Set(); let from = [sx, sy], cur = tgt, n = rare ? 7 : 5, k = 0;
      const pts = [from];
      while (cur && k < n) {
        hitSet.add(cur); pts.push([ecx(cur), ecy(cur)]);
        damageEnemy(cur, dmg * Math.pow(0.85, k), {kb:0});
        if (Math.random() < 0.2) enemyFx(cur, 'stun', false, 0.5);
        k++;
        let nxt = null, nb = 180;
        for (const e of enemies) {
          if (e.dead || e.ally || hitSet.has(e)) continue;
          const d = Math.hypot(ecx(e) - ecx(cur), ecy(e) - ecy(cur));
          if (d < nb) { nb = d; nxt = e; }
        }
        cur = nxt;
      }
      effects.push({type:'arc', pts, life:0.2, max:0.2});
      break;
    }
  }
}
// ===== Rogue's Bow & Shooting Mechanism =====
const POWER_SHOT_COOLDOWN = 3.2;
function powerShotWait() {
  const p = player, last = p.powerShotAt;
  return last == null || last > G.time ? 0 : Math.max(0, POWER_SHOT_COOLDOWN - (G.time - last));
}

function shootBow(item, rare) {
  const p = player;
  p.lastCast = G.time;
  const sx = ecx(p) + p.facing * 8, sy = p.y + 11;
  const a = aimAngle();
  p.facing = Math.cos(a) >= 0 ? 1 : -1;
  p.aimLocal = p.facing > 0 ? a : Math.PI - a;
  const crit = Math.random() < (item.crit || WTYPE.bow.crit || 0.15);
  let dmg = weaponDamage(item, rare);
  if (item.fx === 'steady' && p.hp >= p.maxHp - 0.5) dmg *= rare ? 1.25 : 1.15;
  if (crit) dmg *= 2;
  const speed = 600;
  // Volley bows fire three arrows in a spread
  const spread = item.fx === 'volley' ? [-0.12, 0, 0.12] : [0];
  for (const da of spread) addProj({
    x: sx, y: sy,
    vx: Math.cos(a + da) * speed,
    vy: Math.sin(a + da) * speed,
    type: 'arrow',
    dmg,
    owner: 'p',
    life: 2.2,
    r: 3.5,
    grav: 110,
    crit,
    fx: item.fx || null,
    rare,
    col: item.col || '#8b5a2b'
  });
  // Bowstring pluck particles and ring pulse
  addParticles(sx, sy, '#d4c4a8', 5, 80, 0.22, 0);
  effects.push({type:'ring', x:sx, y:sy, r:11, life:0.12, max:0.12, col:item.col || '#8b5a2b'});
}

function shootPowerArrow(item, rare) {
  if (!canUseWeapon(item)) { classLockMsg(item); return; }
  const p = player;
  const wait = powerShotWait();
  if (wait > 0) {
    if (G.time - (p.powerMsgT || -9) > 0.8) {
      toast(`Power Shot is recharging (${wait.toFixed(1)}s).`);
      p.powerMsgT = G.time;
    }
    return;
  }
  p.powerShotAt = G.time;
  const sx = ecx(p) + p.facing * 10, sy = p.y + 11;
  const a = aimAngle();
  p.facing = Math.cos(a) >= 0 ? 1 : -1;
  p.aimLocal = p.facing > 0 ? a : Math.PI - a;
  const dmg = weaponDamage(item, rare) * 2.6;
  const speed = 760;
  addProj({
    x: sx, y: sy,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    type: 'power_arrow',
    dmg,
    owner: 'p',
    life: 2.0,
    r: 5,
    grav: 45,
    pierce: true,
    crit: true,
    fx: item.fx || null,
    rare,
    col: '#ffd45a'
  });
  shake(3);
  addParticles(sx, sy, '#ffd45a', 14, 150, 0.38, 0);
  effects.push({type:'ring', x:sx, y:sy, r:18, life:0.24, max:0.24, col:'#ffd45a'});
}
function addProj(o) {
  projectiles.push(Object.assign({life:1, r:3, grav:0, bounces:0, pierce:false, hit:null}, o));
}
function throwLure(slot) {
  const p = player, a = aimAngle();
  addProj({x:ecx(p), y:p.y + 8, vx:Math.cos(a) * 320, vy:Math.sin(a) * 320 - 80, type:'lure', dmg:0, owner:'n', life:4, r:4, grav:700});
  consumeSlot(slot, 1);
  toast('You toss the Gold Lure. Shiny!', 'gold');
}

// ===== Damage to enemies =====
function damageEnemy(e, amt, opt = {}) {
  if (e.dead || e.ally) return;
  if (e.proxy) {
    // co-op guest: show the hit now, the host applies it
    amt = Math.max(1, Math.round(amt));
    e.flash = 0.08;
    addFloater(ecx(e) + (Math.random() - 0.5) * 8, e.y, amt, opt.crit ? '#ffd45a' : '#ffffff', opt.crit);
    netSend('host', {k:'hit', id:e.id, amt, kb:opt.kb || 0, crit:!!opt.crit, fx:opt.fx || null, rare:!!opt.rare});
    return;
  }
  if (e.curseT > 0) amt *= e.curseMult || 1.25;
  if (e.vulnerable) amt *= 1.5;
  amt = Math.max(1, Math.round(amt));
  e.hp -= amt; e.flash = 0.08; e.aggro = true;
  addFloater(ecx(e) + (Math.random() - 0.5) * 8, e.y, amt, opt.crit ? '#ffd45a' : opt.dot ? '#b8ff8a' : '#ffffff', opt.crit);
  if (opt.kb && !e.boss) { e.vx += opt.kb * e.kbRes; if (e.ai !== 'flyer') e.vy = Math.min(e.vy, -Math.abs(opt.kb) * 0.35 * e.kbRes); }
  if (opt.fx) applyProjFx(e, opt.fx, opt.rare);
  if (e.hp <= 0) killEnemy(e, opt);
}
function applyProjFx(e, fx, rare) {
  switch (fx) {
    case 'curse': e.curseT = rare ? 7 : 5; e.curseMult = rare ? 1.35 : 1.25; break;
    case 'root': if (!e.boss) e.rootT = rare ? 3 : 2; else e.slowT = 2; break;
    case 'raise': e.raiseMark = G.time; break;
    case 'coin': e.coinMark = G.time; break;
    case 'dragonfire': // flaming arrows (Dragonbreath Bow) burn like fire sparks
    case 'burn': e.burnT = 3; e.burnDps = Math.max(e.burnDps || 0, weaponDamage(ITEMS.dragonfang, rare) * 0.2); break;
    case 'stun': if (!e.boss) e.stunT = Math.max(e.stunT || 0, 0.4); break;
    case 'slow': e.slowT = rare ? 3 : 2; break;
  }
}
function killEnemy(e, opt) {
  e.dead = true;
  addParticles(ecx(e), ecy(e), e.boss ? '#ffd45a' : '#d8d0c0', e.boss ? 60 : 14, e.boss ? 200 : 110, 0.7);
  if (e.ally) return;
  if (e.boss) { onBossDefeated(e); return; }
  if (!e.summoned) markKillZone(ecx(e), ecy(e));
  if (e.mini) { G.minis[e.mini] = G.play; enemies.forEach(m => { if (m.summoner === e) m.dead = true; }); }
  const coinX2 = e.coinMark && G.time - e.coinMark < 0.2;
  const info = {type:e.type, name:e.name, elite:!!e.elite, summoned:!!e.summoned, xp:e.summoned ? Math.round(e.xp * 0.25) : e.xp,
    coins:e.summoned ? 0 : e.coins * (coinX2 ? 2 : 1), x:ecx(e), y:e.y, mini:e.mini || 0};
  // everyone close enough shares the kill
  if (Math.hypot(ecx(player) - info.x, ecy(player) - info.y) < 1100 || !e.lastBy) rewardKill(info);
  if (NET.on) for (const pr of NET.peers.values()) {
    if (pr.seen && Math.hypot(ecx(pr) - info.x, ecy(pr) - info.y) < 1100) netSend(pr.id, {k:'kill', info});
  }
  if (e.raiseMark && G.time - e.raiseMark < 0.2) spawnAlly(e);
}
// Rewards for the local knight: XP, gold, quest credit and this player's own drop rolls.
function rewardKill(info) {
  gainXp(info.xp);
  if (info.summoned) return;
  player.coins += info.coins;
  addFloater(info.x, info.y - 8, '+' + info.coins + 'g', '#f5cc45');
  G.kills[info.type] = (G.kills[info.type] || 0) + 1;
  questEvent('kill', info.type, 1);
  const d = EN[info.type];
  if (!d) return;
  // each player gets the weapon for their own class (Knight, Rogue or Wizard)
  const drop = classDrop(info.type, myClass());
  if (drop) {
    G.pity[info.type] = (G.pity[info.type] || 0) + 1;
    if (info.elite || Math.random() < 0.07 || G.pity[info.type] >= 14) {
      G.pity[info.type] = 0;
      const rare = Math.random() < (info.mini ? 0.5 : info.elite ? 0.3 : 0.04);
      if (addItem(drop, 1, rare)) toast(`${info.name} dropped ${rare ? 'a RARE ' : ''}${ITEMS[drop].name}!`, rare ? 'gold' : 'loot');
    }
  }
  if (info.mini) {
    // first time you beat each mini-boss: a banner and a potion bundle for its area
    const tier = Math.min(4, 1 + Math.floor(biomeIndexAt(Math.floor(info.x / TILE)) / 2));
    if (!G.minisFirst[info.mini]) {
      G.minisFirst[info.mini] = true;
      addItem('pot_h' + tier, 3); addItem('pot_m' + tier, 2);
      showBanner('MINI-BOSS DEFEATED', `${info.name} is down. It will be back in 10 minutes.`);
    } else toast(`${info.name} defeated! It returns in 10 minutes.`, 'gold');
  }
  if (d.scale) { const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (info.elite ? 2 : 0); addItem('dragonscale', n); addFloater(info.x, info.y - 18, '+' + n + ' Dragonscale', '#ff7a5a'); }
  if (Math.random() < 0.05) { const tier = Math.min(4, 1 + Math.floor(biomeIndexAt(Math.floor(info.x / TILE)) / 2)); addItem((Math.random() < 0.5 ? 'pot_h' : 'pot_m') + tier, 1); }
}
function spawnAlly(src) {
  const allies = enemies.filter(e => e.ally && !e.dead);
  if (allies.length >= 4) allies[0].dead = true;
  const lvl = player.level;
  const a = makeEnemy('skeleton', src.x, src.y, lvl);
  a.ally = true; a.life = 10; a.allyDmg = weaponDamage(ITEMS.necro_staff, false) * 0.5; a.name = 'Risen Skeleton';
  a.y = src.y + src.h - a.h;
  enemies.push(a);
  addParticles(ecx(a), ecy(a), '#9be36b', 16, 90, 0.6);
}

// ===== Enemy creation =====
const ENEMY_SPEED = 0.75; // global speed multiplier for regular enemies
const ENEMY_HEALTH = 1.75; // scaled to match knight broadsword & rogue bow power
const ENEMY_DAMAGE_SCALE = 1.20; // scaled enemy damage (+20%) to keep combat challenging
const ATK_TIME = 0.42, ATK_STRIKE = 0.16, CAST_TIME = 0.4; // enemy attack animation timing
const SLASH_COL = {werewolf:'#ff8a8a', spider:'#c8ff9a', rat:'#ffd0b0', skeleton:'#f0ead6', wraith:'#8ff0ff', drake:'#ffb060', wyvern:'#a0fff0', dark_knight:'#d0a0ff',
  goblin:'#d8e0a0', orc:'#ffb080', ogre:'#e8c890', troll:'#b8e0b0', witch:'#d8a0ff', lich:'#b8ff9a'};
// How each enemy's melee looks: a weapon slash, claw rakes, or a bite. Heavy hitters also slam an impact star and dust.
const ATTACK_STYLE = {rat:'bite', spider:'bite', drake:'bite', wyvern:'bite', werewolf:'claw', troll:'claw', wraith:'claw'};
const HEAVY = {ogre:1, troll:1, dark_knight:1, orc:1};
function enemySlashFx(e) {
  const style = ATTACK_STYLE[e.type] || 'slash', col = SLASH_COL[e.type] || '#ffffff';
  const fx = {type:style === 'bite' ? 'bite' : 'slash', x:ecx(e) + e.facing * e.w * (style === 'bite' ? 0.6 : 0.45), y:e.y + e.h * (style === 'bite' ? 0.35 : 0.45), dir:e.facing,
    r:Math.max(10, e.h * 0.6), life:0.26, max:0.26, col, claw:style === 'claw'};
  effects.push(fx);
  // sparks flying off the swing
  addParticles(fx.x + e.facing * fx.r * 0.4, fx.y, col, 6, 120, 0.3, 200);
  if (HEAVY[e.type] || e.mini || e.elite) {
    const ix = ecx(e) + e.facing * (e.w * 0.5 + 10), iy = e.y + e.h * 0.55;
    effects.push({type:'impact', x:ix, y:iy, r:Math.max(16, e.h * 0.6), life:0.22, max:0.22, col});
    addParticles(ecx(e) + e.facing * e.w * 0.4, e.y + e.h, '#b8a890', 8, 70, 0.45, 120); // dust kicked up at the feet
  }
}
let nextEnemyId = 1;
function makeEnemy(type, x, y, lvl, opt = {}) {
  const d = EN[type], elite = !!opt.elite, sc = elite ? 1.3 : 1;
  const e = {id:nextEnemyId++, type, def:d, name:(elite ? 'Champion ' : '') + d.name, x, y, w:d.w * sc, h:d.h * sc, sc, vx:0, vy:0, facing:1, onGround:false,
    lvl, elite, ai:d.ai, spd:d.spd * ENEMY_SPEED, seed:Math.random() * 100, t:0, shootT:1 + Math.random() * 2, summonT:6, atkCd:0, leapCd:1, chargeCd:2, chargeT:0,
    wanderT:0, wanderDir:0, dotTick:0.5, flash:0, slowT:0, rootT:0, stunT:0, curseT:0, poisonT:0, burnT:0, swoopT:3 + Math.random() * 2, swoopActive:0};
  const D = diff();
  e.spd *= D.spd || 1;
  e.maxHp = Math.max(1, Math.round(enemyHp(d.hp, lvl) * ENEMY_HEALTH * (elite ? 3 : 1) * D.hp));
  e.hp = e.maxHp;
  e.dmg = Math.max(1, Math.round(enemyDmg(d.dmg, lvl) * ENEMY_DAMAGE_SCALE * (elite ? 1.4 : 1) * D.dmg));
  e.xp = Math.round(enemyXp(lvl, d.xpm) * (elite ? 4 : 1) * D.reward);
  e.coins = Math.round(d.coins * (1 + lvl * 0.25) * (elite ? 4 : 1) * D.reward);
  e.kbRes = d.hp >= 110 ? 0.45 : 1;
  return e;
}

// ===== Enemy AI =====
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    const p = nearestTarget(ecx(e), ecy(e)) || player;
    // adt: attack-timer time. Harder difficulties make enemies attack, shoot and leap more often.
    const adt = dt * (diff().atk || 1);
    e.t += dt; e.flash -= dt; e.atkCd -= adt;
    if (e.visOff) e.visOff *= Math.exp(-dt * 16);
    e.slowT -= dt; e.rootT -= dt; e.stunT -= dt; e.curseT -= dt; e.leapCd -= adt; e.chargeCd -= adt;
    // damage over time
    e.dotTick -= dt;
    if (e.dotTick <= 0) {
      e.dotTick = 0.5;
      let d = 0;
      if (e.poisonT > 0) { e.poisonT -= 0.5; d += e.poisonDps * e.poisonStacks * 0.5; if (e.poisonT <= 0) e.poisonStacks = 0; }
      if (e.burnT > 0) { e.burnT -= 0.5; d += e.burnDps * 0.5; addParticles(ecx(e), e.y + 4, '#ff8a1f', 3, 40, 0.4, -60); }
      if (d > 0) damageEnemy(e, d, {dot:true});
      if (e.dead) continue;
    }
    if (e.ally) { updateAlly(e, dt); continue; }
    if (e.boss) { updateBoss(e, dt); bossContact(e); continue; }
    const tx = ecx(p), ty = ecy(p);
    const dx = tx - ecx(e), dy = ty - ecy(e), dist = Math.hypot(dx, dy);
    if (dist > 1700) { e.dead = true; e.despawn = true; continue; }
    const aggroR = isNight() ? 560 : 460;
    const aggro = !p.dead && (dist < aggroR || e.aggro) && dist < 900;
    const frozen = e.rootT > 0 || e.stunT > 0;
    const sp = e.spd * (e.slowT > 0 ? 0.6 : 1) * (frozen ? 0 : 1);
    const d = e.def;
    if (e.mini && aggro && !frozen) miniSkill(e, dx, dy, dist, dt);
    if (e.ai === 'flyer') {
      let gx, gy;
      if (aggro) {
        gx = tx + (d.proj ? -Math.sign(dx || 1) * 170 : 0);
        gy = ty - (d.proj ? 95 : 6) + Math.sin(e.t * 2) * 18;
        if (d.swoop) {
          e.swoopT -= adt;
          if (e.swoopT <= 0 && e.swoopActive <= 0) { e.swoopActive = 0.9; e.swoopT = 3.5 + Math.random() * 2; e.sdx = dx / (dist || 1); e.sdy = dy / (dist || 1); }
        }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 2; e.hx = ecx(e) + (Math.random() - 0.5) * 200; e.hy = ecy(e) + (Math.random() - 0.5) * 80; }
        gx = e.hx || ecx(e); gy = e.hy || ecy(e);
      }
      if (e.swoopActive > 0) {
        e.swoopActive -= dt;
        e.vx = e.sdx * sp * 2.6; e.vy = e.sdy * sp * 2.6;
      } else {
        const ax = gx - ecx(e), ay = gy - ecy(e), al = Math.hypot(ax, ay) || 1;
        const s = Math.min(sp, al * 3);
        e.vx = approach(e.vx, ax / al * s, 500 * dt); e.vy = approach(e.vy, ay / al * s, 500 * dt);
      }
      if (frozen) { e.vx *= 0.8; e.vy *= 0.8; }
      if (d.phase) { e.x += e.vx * dt; e.y += e.vy * dt; const lim = barrierLimit(); if (e.x + e.w > lim) e.x = lim - e.w - 1; }
      else { moveEntity(e, dt, false); if (e.hitWall) e.vy = -sp; }
      if (Math.abs(e.vx) > 5) e.facing = Math.sign(e.vx);
      if (aggro) e.facing = Math.sign(dx) || e.facing;
    } else {
      let dir = 0;
      if (aggro) {
        if (e.ai === 'caster') { if (dist < 150) dir = -Math.sign(dx); else if (dist > 250) dir = Math.sign(dx); }
        else dir = Math.abs(dx) > 6 ? Math.sign(dx) : 0;
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 3; e.wanderDir = Math.floor(Math.random() * 3) - 1; }
        dir = e.wanderDir;
      }
      let tv = dir * sp * (aggro ? 1 : 0.4);
      if (e.chargeT > 0) { e.chargeT -= dt; tv = e.facing * sp * 3; }
      e.vx = approach(e.vx, tv, 900 * dt);
      if (!frozen && e.onGround) {
        if (e.hitWall && dir) e.vy = -370;
        else if (aggro && dy < -50 && Math.abs(dx) < 120 && Math.random() < dt * 1.5) e.vy = -400;
        if (d.leap && aggro && Math.abs(dx) < 210 && e.leapCd <= 0) { e.vy = -330; e.vx = Math.sign(dx) * 340 * ENEMY_SPEED; e.leapCd = 2.8; }
        if (d.charge && aggro && Math.abs(dx) < 270 && Math.abs(dy) < 50 && e.chargeCd <= 0) { e.chargeT = 0.7; e.chargeCd = 4; e.facing = Math.sign(dx); }
      }
      if (liquidAt(ecx(e), ecy(e)) === 'water') { e.vy = Math.min(e.vy + GRAV * 0.3 * dt, 80); if (dir && Math.random() < dt * 3) e.vy = -160; }
      else e.vy = Math.min(e.vy + GRAV * dt, 720);
      moveEntity(e, dt, true);
      if (e.chargeT <= 0) { if (aggro && Math.abs(dx) > 2) e.facing = Math.sign(dx); else if (Math.abs(e.vx) > 5) e.facing = Math.sign(e.vx); }
      if (e.ai === 'caster' && aggro && !frozen) {
        e.shootT -= adt;
        if (e.shootT <= 0 && dist < 480) {
          e.shootT = d.shootCd * (0.8 + Math.random() * 0.4);
          e.castT = CAST_TIME;
        }
        if (d.summon) {
          e.summonT -= adt;
          if (e.summonT <= 0) {
            e.summonT = 11;
            const mine = enemies.filter(m => m.summoner === e && !m.dead).length;
            if (mine < 2) summonMinion(e, d.summon, e.lvl, e);
          }
        }
      }
    }
    if (d.proj && e.ai === 'flyer' && aggro && !frozen) {
      e.shootT -= adt;
      if (e.shootT <= 0 && dist < 460) { e.shootT = d.shootCd * (0.8 + Math.random() * 0.4); e.castT = CAST_TIME; }
    }
    // casting: glow first, then release the spell at whoever is closest
    if (e.castT > 0) {
      e.castT -= dt;
      if (frozen) e.castT = 0;
      else if (e.castT <= 0) { e.castT = 0; enemyShoot(e, d.proj, Math.atan2(ecy(p) - ecy(e), ecx(p) - ecx(e))); }
    }
    // melee attack: wind up, then strike in front
    const reach = {x:e.x - 8, y:e.y - 4, w:e.w + 16, h:e.h + 8};
    if (!p.dead && e.atkCd <= 0 && e.stunT <= 0 && !(e.atkT > 0) && overlap(reach, p) && canReach(e, p)) {
      e.atkT = ATK_TIME; e.atkCd = 1.15; e.atkHit = false; e.facing = Math.sign(ecx(p) - ecx(e)) || e.facing;
    }
    if (e.atkT > 0) {
      e.atkT -= dt;
      if (e.stunT > 0) e.atkT = 0;
      if (!e.atkHit && e.atkT <= ATK_STRIKE) {
        e.atkHit = true;
        const hw = e.w / 2 + 16, hb = {x:e.facing > 0 ? ecx(e) : ecx(e) - hw, y:e.y - 4, w:hw, h:e.h + 8};
        for (const t of allTargets()) if (overlap(hb, t) && canReach(e, t)) damageTarget(t, e.dmg, ecx(e));
        enemySlashFx(e);
      }
      if (e.atkT < 0) e.atkT = 0;
    }
  }
  enemies = enemies.filter(e => !e.dead);
}
function enemyShoot(e, type, a) {
  const sx = ecx(e), sy = e.y + e.h * 0.35;
  const spd = (type === 'fireball' ? 270 : type === 'skullbolt' ? 200 : 240) * 0.85;
  addProj({x:sx, y:sy, vx:Math.cos(a) * spd, vy:Math.sin(a) * spd, type, dmg:e.dmg, owner:'e', life:3, r:type === 'fireball' ? 4 : 3.5,
    homing:type === 'skullbolt', fire:type === 'fireball', turn:1.6});
}
function summonMinion(src, type, lvl, owner) {
  const m = makeEnemy(type, ecx(src) + (Math.random() - 0.5) * 60, src.y, lvl);
  m.summoned = true; m.summoner = owner; m.aggro = true;
  m.y = src.y + src.h - m.h - 2;
  if (rectSolid(m.x, m.y, m.w, m.h)) { m.x = src.x; m.y = src.y + src.h - m.h - 2; }
  enemies.push(m);
  addParticles(ecx(m), ecy(m), '#9be36b', 12, 80, 0.5);
}
function updateAlly(e, dt) {
  e.life -= dt;
  if (e.life <= 0) { e.dead = true; addParticles(ecx(e), ecy(e), '#9be36b', 10, 60, 0.5); return; }
  let tgt = null, best = 500;
  for (const o of enemies) if (!o.dead && !o.ally) { const d = Math.hypot(ecx(o) - ecx(e), ecy(o) - ecy(e)); if (d < best) { best = d; tgt = o; } }
  let dir = 0;
  if (tgt) dir = Math.sign(ecx(tgt) - ecx(e));
  else { const d = ecx(player) - ecx(e); dir = Math.abs(d) > 40 ? Math.sign(d) : 0; }
  e.vx = approach(e.vx, dir * 110, 900 * dt);
  if (e.hitWall && e.onGround) e.vy = -370;
  e.vy = Math.min(e.vy + GRAV * dt, 720);
  moveEntity(e, dt, true);
  if (dir) e.facing = dir;
  if (tgt && e.atkCd <= 0 && overlap({x:e.x - 6, y:e.y, w:e.w + 12, h:e.h}, tgt)) {
    e.atkCd = 0.5; damageEnemy(tgt, e.allyDmg, {kb:e.facing * 120});
  }
}

// ===== Projectiles =====
function updateProjectiles(dt) {
  const p = player;
  for (const pr of projectiles) {
    pr.life -= dt;
    if (pr.life <= 0) { if (pr.burst) explodeBurst(pr); pr.dead = true; continue; }
    if (pr.homing) {
      let tgt = null, best = 260;
      if (pr.owner === 'p') { for (const e of enemies) if (!e.dead && !e.ally) { const d = Math.hypot(ecx(e) - pr.x, ecy(e) - pr.y); if (d < best) { best = d; tgt = e; } } }
      else tgt = nearestTarget(pr.x, pr.y);
      if (tgt) {
        const sp = Math.hypot(pr.vx, pr.vy), cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(ecy(tgt) - pr.y, ecx(tgt) - pr.x);
        let da = want - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const na = cur + clamp(da, -(pr.turn || 4) * dt, (pr.turn || 4) * dt);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
    }
    pr.vy += pr.grav * dt;
    const ox = pr.x, oy = pr.y;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.type === 'shock') {
      // hug the ground
      const tx = Math.floor(pr.x / TILE);
      let gy = Math.floor(pr.y / TILE);
      if (isSolid(tx, gy)) { if (!isSolid(tx, gy - 1)) pr.y -= TILE; else { pr.dead = true; continue; } }
      else if (!isSolid(tx, gy + 1)) pr.y += TILE * 0.5;
    } else if (!pr.ghost && isSolid(Math.floor(pr.x / TILE), Math.floor(pr.y / TILE))) {
      if (pr.burst) { pr.x = ox; pr.y = oy; explodeBurst(pr); continue; }
      if (pr.type === 'lure') {
        pr.dead = true;
        if (NET.on && !NET.host) netSend('host', {k:'lure', x:ox, y:oy});
        else lures.push({x:ox, y:oy, t:5});
        addParticles(ox, oy, '#f5cc45', 14, 90, 0.6);
        continue;
      }
      if (pr.bounces > 0) {
        pr.bounces--;
        if (isSolid(Math.floor(pr.x / TILE), Math.floor(oy / TILE))) pr.vx = -pr.vx * 0.7; else pr.vy = -pr.vy * 0.6;
        pr.x = ox; pr.y = oy;
      } else {
        pr.dead = true;
        addParticles(ox, oy, pr.owner === 'p' ? '#ddd' : '#c88', 4, 50, 0.3);
        continue;
      }
    }
    if (pr.owner === 'p') {
      for (const e of enemies) {
        if (e.dead || e.ally || e === pr.ignore) continue;
        if (pr.hit && pr.hit.has(e)) continue;
        if (pr.x > e.x - pr.r && pr.x < e.x + e.w + pr.r && pr.y > e.y - pr.r && pr.y < e.y + e.h + pr.r) {
          if (pr.burst) { explodeBurst(pr); break; }
          damageEnemy(e, pr.dmg, {kb:Math.sign(pr.vx) * (pr.type === 'power_arrow' ? 120 : 60), fx:pr.fx, rare:pr.rare, crit:pr.crit});
          if (pr.fx === 'lifesteal') healPlayer(pr.dmg * (pr.rare ? 0.12 : 0.08), true); // Soul Arrows heal you
          if (SPELL_COL[pr.type]) addParticles(pr.x, pr.y, SPELL_COL[pr.type][0], 12, 150, 0.4, 0); // impact burst
          if (pr.type === 'arrow' || pr.type === 'power_arrow') addParticles(pr.x, pr.y, pr.type === 'power_arrow' ? '#ffd45a' : '#ece5cf', 7, 110, 0.28, 60);
          if (pr.pierce) { (pr.hit || (pr.hit = new Set())).add(e); }
          else { pr.dead = true; break; }
        }
      }
    } else if (pr.owner === 'e') {
      for (const t of allTargets()) {
        if (pr.x > t.x - pr.r && pr.x < t.x + t.w + pr.r && pr.y > t.y - pr.r && pr.y < t.y + t.h + pr.r) {
          damageTarget(t, pr.dmg, pr.x, {fire:pr.fire});
          if (!pr.pierce) { pr.dead = true; break; }
        }
      }
    }
  }
  projectiles = projectiles.filter(pr => !pr.dead);
  for (const l of lures) l.t -= dt;
  lures = lures.filter(l => l.t > 0);
}

// How many players are currently in the game/lobby (solo = 1, co-op = host + connected peers)
function lobbyPlayerCount() {
  if (typeof NET !== 'undefined' && NET && NET.on) {
    const peers = NET.peers ? NET.peers.size : 0;
    return Math.max(1, 1 + peers);
  }
  return 1;
}

// Boss scaling:
// - Lessen base health to 0.55x base (down from 0.8x)
// - Keep base damage reduction at 0.7x base (30% less damage)
// - Scales accordingly with player count in lobby:
// Boss health and damage scaling (scaled for challenge and multiplayer lobbies)
function bossScaling() {
  const p = lobbyPlayerCount();
  const hpMult = 0.95 * (1 + (p - 1) * 0.45);
  const dmgMult = 1.15 * (1 + (p - 1) * 0.20);
  return { hp: hpMult, dmg: dmgMult, players: p };
}

function checkBossLobbyScaling(e) {
  if (!e || e.dead || !e.baseHp) return;
  const p = lobbyPlayerCount();
  if (e.lobbyPlayers !== p) {
    const bs = bossScaling();
    const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    e.lobbyPlayers = p;
    e.maxHp = Math.max(50, Math.round(e.baseHp * bs.hp));
    e.hp = Math.max(1, Math.round(e.maxHp * ratio));
    e.dmg = Math.max(1, Math.round(e.baseDmg * bs.dmg));
  }
}

// ===== Bosses =====
const BOSS_BASE = {goblin_king:'goblin', witch_queen:'witch', ogre_warlord:'ogre', archlich:'lich', gold_dragon:'drake',
  orc_warchief:'orc', bloodmoon_alpha:'werewolf', magma_wyrm:'drake'};
const bossPattern = bid => BOSSES[bid].pattern || bid;
function summonBoss(bid) {
  if (G.boss) return;
  const b = BOSSES[bid], base = EN[BOSS_BASE[bid]];
  const sc = bid === 'gold_dragon' ? b.w / base.w : b.h / base.h;
  const e = {id:nextEnemyId++, type:bid, look:bid, boss:true, bid, def:{name:b.name}, name:b.name, w:b.w, h:b.h, sc, vx:0, vy:0, facing:-1, onGround:false,
    lvl:b.lvl, t:0, seed:0, flash:0, atkCd:0, kbRes:0, state:'intro', stT:1.5, shootT:2, summonT:8, slowT:0, rootT:0, stunT:0, curseT:0, poisonT:0, burnT:0, dotTick:0.5};
  const bs = bossScaling();
  e.baseHp = enemyHp(b.hp, b.lvl) * diff().hp;
  e.baseDmg = enemyDmg(b.dmg, b.lvl) * diff().dmg;
  e.maxHp = Math.max(50, Math.round(e.baseHp * bs.hp));
  e.hp = e.maxHp;
  e.dmg = Math.max(1, Math.round(e.baseDmg * bs.dmg));
  e.lobbyPlayers = bs.players;
  const ax = b.x * TILE;
  if (bid === 'gold_dragon') { e.x = (CASTLE.x1 - 30) * TILE; e.y = (CASTLE.top + 8) * TILE; }
  else if (bossPattern(bid) === 'witch_queen' || bossPattern(bid) === 'archlich') { e.x = ax + 120; e.y = (surf[b.x] - 8) * TILE; e.fly = true; }
  else { e.x = ax + 13 * TILE; e.y = (surf[b.x] - 1) * TILE - e.h; }
  // never appear inside part of the arena (platforms, walls)
  if (!e.fly) for (let k = 0; k < 20 && rectSolid(e.x, e.y, e.w, e.h); k++) e.y -= TILE / 2;
  e.homeX = ax;
  G.boss = e;
  enemies.push(e);
  addParticles(ecx(e), ecy(e), '#c04bff', 50, 200, 1);
  shake(8);
  toast(`${b.name} has appeared!`, 'red');
  showBossBar(e);
}
function despawnBoss(defeated) {
  const e = G.boss;
  if (!e) return;
  if (!defeated) { e.dead = true; toast(`${e.name} retreats...`); }
  enemies = enemies.filter(m => !(m.summoned && !m.ally));
  G.boss = null;
  hideBossBar();
}
function onBossDefeated(e) {
  G.bossesDone[e.bid] = true;
  despawnBoss(true);
  if (e.bid === 'gold_dragon') openPrincessCage();
  if (NET.on) netSend('others', {k:'boss', bid:e.bid});
  bossReward(e.bid);
}
// Boss rewards for the local knight (each co-op player gets their own).
function bossReward(bid) {
  const b = BOSSES[bid];
  gainXp(Math.round(enemyXp(b.lvl, 30) * diff().reward));
  player.coins += Math.round(b.coins * diff().reward);
  const drop = classDrop(bid, myClass());
  if (drop) { addItem(drop, 1, false); toast(`You got ${ITEMS[drop].name}!`, 'gold'); }
  questEvent('boss', bid, 1);
  shake(10);
  if (bid === 'gold_dragon') showBanner('THE GILDED WYRM IS SLAIN', 'The cage door creaks open. Talk to Princess Elowen.');
  else if (BARRIERS.some(br => br.boss === bid)) showBanner('SEAL BROKEN', BARRIERS_ON ? `${b.name} is defeated. The road east is open.` : `${b.name} is defeated. One of the wyrm's seals is broken.`);
  else showBanner('BOSS DEFEATED', `${b.name} has fallen.`);
  saveGame(true);
}
function bossContact(e) {
  if (e.atkCd > 0 || e.stunT > 0 || e.state === 'admire') return;
  for (const t of allTargets()) if (overlap(e, t)) { damageTarget(t, e.dmg * 0.75, ecx(e)); e.atkCd = 1.1; break; }
}
// Move a flying boss to a random open spot (never inside rock); stays put if none is found.
function teleportClear(e, rx, ry) {
  for (let i = 0; i < 12; i++) {
    const x = rx() - e.w / 2, y = ry() - e.h / 2;
    if (!rectSolid(x, y, e.w, e.h)) { e.x = x; e.y = y; return; }
  }
}
function bossGroundY(e) { return surf[BOSSES[e.bid].x] * TILE; }
function updateBoss(e, dt) {
  const b = BOSSES[e.bid];
  const p = nearestTarget(ecx(e), ecy(e));
  const adt = dt * (diff().atk || 1); // harder difficulties speed up boss attacks
  e.t += dt; e.stT -= adt; e.shootT -= adt; e.summonT -= adt;
  if (!p) { despawnBoss(false); return; }
  const dx = ecx(p) - ecx(e), dy = ecy(p) - ecy(e), dist = Math.hypot(dx, dy);
  if (dist > 1500) { despawnBoss(false); return; }
  checkBossLobbyScaling(e);
  updateBossBar(e);
  const rage = e.hp < e.maxHp * 0.5;
  const frozen = e.stunT > 0;
  if (e.slowT > 0) dt *= 0.75;
  const minionCount = () => enemies.filter(m => m.summoned && !m.dead).length;
  switch (bossPattern(e.bid)) {
    case 'goblin_king': {
      if (e.state === 'intro' && e.stT <= 0) { e.state = 'chase'; e.stT = 3; }
      if (e.state === 'chase') {
        e.vx = approach(e.vx, Math.sign(dx) * (rage ? 130 : 95), 600 * dt);
        if (e.hitWall && e.onGround) e.vy = -420;
        if (e.stT <= 0) {
          const r = Math.random();
          e.state = r < 0.25 ? 'leap' : r < 0.48 ? 'throw' : r < 0.70 ? 'slam' : r < 0.88 ? 'flurry' : 'summon';
          e.stT = e.state === 'slam' ? 1.0 : e.state === 'flurry' ? 1.4 : 1;
          e.did = false;
        }
      } else if (e.state === 'leap') {
        if (!e.did && e.onGround) { e.vy = -540; e.vx = clamp(dx * 1.4, -380, 380); e.did = true; e.air = true; }
        if (e.did && e.onGround && e.air && e.vy >= 0) {
          e.air = false;
          for (const s of [-1, 1]) addProj({x:ecx(e) + s * 20, y:e.y + e.h - 6, vx:s * 280, vy:0, type:'shock', dmg:e.dmg * 0.85, owner:'e', life:1.1, r:7, pierce:true});
          shake(7); e.state = 'chase'; e.stT = rage ? 2 : 2.8;
        }
      } else if (e.state === 'throw') {
        e.vx = approach(e.vx, 0, 800 * dt);
        if (!e.did) {
          e.did = true;
          for (let i = 0; i < (rage ? 6 : 4); i++) {
            const vx = clamp(dx * (0.8 + i * 0.22), -440, 440) / 1.1;
            addProj({x:ecx(e), y:e.y, vx, vy:-380 - i * 28, type:b.throwProj || 'bag', dmg:e.dmg * 0.9, owner:'e', life:3, r:5, grav:700});
          }
        }
        if (e.stT <= 0) { e.state = 'chase'; e.stT = 2.4; }
      } else if (e.state === 'slam') {
        // Earth Tremor: pauses, bounds up slightly, crashes down releasing shockwaves & shards
        e.vx = approach(e.vx, 0, 900 * dt);
        if (!e.did && e.stT < 0.5) {
          e.did = true; shake(8);
          addParticles(ecx(e), e.y + e.h, '#d8b878', 24, 180, 0.7);
          for (const s of [-2, -1, 1, 2]) {
            addProj({x:ecx(e) + s * 16, y:e.y + e.h - 6, vx:s * 190, vy:0, type:'shock', dmg:e.dmg * 0.9, owner:'e', life:1.3, r:8, pierce:true});
          }
          for (let i = 0; i < 6; i++) {
            const a = -Math.PI * 0.15 - (i / 5) * Math.PI * 0.7;
            addProj({x:ecx(e), y:e.y + e.h - 10, vx:Math.cos(a) * 260, vy:Math.sin(a) * 260, type:'shard', dmg:e.dmg * 0.7, owner:'e', life:0.8, r:3, grav:600});
          }
        }
        if (e.stT <= 0) { e.state = 'chase'; e.stT = rage ? 2 : 2.6; }
      } else if (e.state === 'flurry') {
        // Berserker Spin: charges forward with whirling weapon strikes
        if (!e.did) { e.did = true; e.cdir = Math.sign(dx) || 1; }
        e.vx = e.cdir * (rage ? 240 : 190);
        if (Math.random() < dt * 15) {
          effects.push({type:'ring', x:ecx(e), y:ecy(e), r:36, life:0.25, max:0.25, col:'#f5cc45'});
          for (const t of allTargets()) {
            if (overlap(e, t)) damageTarget(t, e.dmg * 0.55 * dt * 10, ecx(e));
          }
        }
        if (e.hitWall || e.stT <= 0) { e.state = 'chase'; e.stT = rage ? 1.8 : 2.5; }
      } else if (e.state === 'summon') {
        if (!e.did) {
          e.did = true;
          const n = minionCount();
          for (let i = 0; i < Math.min(2, (b.minionMax || 4) - n); i++) summonMinion(e, b.minion || 'goblin', b.minionLvl || 10, e);
        }
        if (e.stT <= 0) { e.state = 'chase'; e.stT = 2.8; }
      }
      if (frozen) e.vx = 0;
      e.vy = Math.min(e.vy + GRAV * dt, 800);
      moveEntity(e, dt, true);
      e.facing = Math.sign(dx) || e.facing;
      break;
    }
    case 'witch_queen': {
      const gy = bossGroundY(e);
      if (e.state === 'intro' && e.stT <= 0) { e.state = 'float'; e.stT = 4; }
      if (e.state === 'float') {
        const tx = e.homeX + Math.sin(e.t * 0.6) * 200, ty = gy - 110 + Math.sin(e.t * 1.7) * 25;
        e.vx = approach(e.vx, clamp((tx - ecx(e)) * 2, -150, 150), 400 * dt);
        e.vy = approach(e.vy, clamp((ty - ecy(e)) * 2, -150, 150), 400 * dt);
        if (e.shootT <= 0) {
          e.shootT = rage ? 0.9 : 1.3;
          const a = Math.atan2(dy, dx), n = rage ? 5 : 3;
          for (let i = 0; i < n; i++) addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a + (i - (n - 1) / 2) * 0.22) * 260, vy:Math.sin(a + (i - (n - 1) / 2) * 0.22) * 260, type:'hexbolt', dmg:e.dmg, owner:'e', life:3, r:4});
        }
        if (e.summonT <= 0) {
          e.summonT = 11;
          const n = minionCount();
          for (let i = 0; i < Math.min(2, (b.minionMax || 4) - n); i++) { const m = makeEnemy(b.minion || 'spider', e.homeX + (Math.random() - 0.5) * 300, gy - 40, b.minionLvl || 22); m.summoned = true; m.summoner = e; m.aggro = true; m.y = gy - m.h - 1; enemies.push(m); }
        }
        if (e.stT <= 0) {
          const r = Math.random();
          e.state = r < 0.35 ? 'teleport' : r < 0.68 ? 'spiral' : 'pillars';
          e.stT = e.state === 'teleport' ? 0.6 : e.state === 'spiral' ? 1.4 : 1.5;
          e.did = false; e.subT = 0;
        }
      } else if (e.state === 'teleport') {
        e.vx = e.vy = 0;
        if (e.stT <= 0) {
          addParticles(ecx(e), ecy(e), '#b05be0', 30, 150, 0.6);
          teleportClear(e, () => e.homeX + (Math.random() - 0.5) * 380, () => gy - 100 - Math.random() * 60);
          addParticles(ecx(e), ecy(e), '#b05be0', 30, 150, 0.6);
          e.state = 'float'; e.stT = rage ? 3 : 4.5; e.shootT = 0.4;
        }
      } else if (e.state === 'spiral') {
        // Hex Spiral Nova: hovers and shoots a rotating spiral of hexbolts & thorns
        e.vx *= 0.85; e.vy *= 0.85;
        e.subT = (e.subT || 0) - dt;
        if (e.subT <= 0) {
          e.subT = rage ? 0.12 : 0.16;
          e.angle = (e.angle || 0) + 0.55;
          for (const s of [0, Math.PI]) {
            const a = e.angle + s;
            addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a) * 230, vy:Math.sin(a) * 230, type:'hexbolt', dmg:e.dmg * 0.8, owner:'e', life:2.8, r:4});
            addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a + 0.3) * 200, vy:Math.sin(a + 0.3) * 200, type:'thorn', dmg:e.dmg * 0.7, owner:'e', life:2.5, r:3});
          }
        }
        if (e.stT <= 0) { e.state = 'float'; e.stT = rage ? 2.5 : 3.5; }
      } else if (e.state === 'pillars') {
        // Shadow Geysers: summons 3 cursed thorn eruptions under target positions
        e.vx *= 0.85; e.vy *= 0.85;
        if (!e.did && e.stT < 0.9) {
          e.did = true;
          for (let i = -1; i <= 1; i++) {
            const gx = ecx(p) + i * 70;
            addParticles(gx, gy - 6, '#b05be0', 16, 80, 0.5);
            addProj({x:gx, y:gy - 4, vx:0, vy:-360, type:'hexbolt', dmg:e.dmg * 1.1, owner:'e', life:1.6, r:6});
            addProj({x:gx + (Math.random() - 0.5) * 20, y:gy - 4, vx:(Math.random() - 0.5) * 80, vy:-320, type:'thorn', dmg:e.dmg * 0.8, owner:'e', life:1.8, r:4});
          }
          shake(6);
        }
        if (e.stT <= 0) { e.state = 'float'; e.stT = rage ? 2.5 : 3.8; }
      }
      if (frozen) { e.vx *= 0.5; e.vy *= 0.5; }
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.facing = Math.sign(dx) || e.facing;
      break;
    }
    case 'ogre_warlord': {
      if (e.state === 'intro' && e.stT <= 0) { e.state = 'chase'; e.stT = 2.5; }
      const spd = (rage ? 110 : 85) * (b.fast ? 1.45 : 1);
      // bosses of this style with a pack call it in when badly hurt
      if (b.minion && rage && e.summonT <= 0) {
        e.summonT = 14;
        for (let i = 0; i < Math.min(2, 3 - minionCount()); i++) summonMinion(e, b.minion, b.minionLvl || e.lvl - 3, e);
        toast(`${b.name.split(',')[0]} howls for the pack!`, 'red');
      }
      if (e.state === 'chase') {
        e.vx = approach(e.vx, Math.sign(dx) * spd, 500 * dt);
        if (e.hitWall && e.onGround) e.vy = -450;
        if (e.stT <= 0) {
          const r = Math.random();
          e.state = r < 0.28 ? 'leap' : r < 0.52 ? 'charge' : r < 0.76 ? 'boulder' : 'stomp';
          e.stT = e.state === 'boulder' ? 1.2 : e.state === 'stomp' ? 1.8 : 1.2;
          e.did = false; e.subT = 0; e.stompCount = 0;
        }
      } else if (e.state === 'leap') {
        if (!e.did && e.onGround) { e.vy = -620; e.vx = clamp(dx * 1.3, -390, 390); e.did = true; e.air = true; }
        if (e.did && e.air && e.onGround && e.vy >= 0) {
          e.air = false; shake(9);
          effects.push({type:'ring', x:ecx(e), y:e.y + e.h, r:150, life:0.4, max:0.4, col:'#d8b878'});
          for (const t of allTargets()) if (t.onGround && Math.abs(ecx(t) - ecx(e)) < 150 && Math.abs(ecy(t) - ecy(e)) < 60) damageTarget(t, e.dmg * 1.2, ecx(e));
          for (const s of [-1, 1]) addProj({x:ecx(e) + s * 24, y:e.y + e.h - 6, vx:s * 320, vy:0, type:'shock', dmg:e.dmg * 0.85, owner:'e', life:1.2, r:8, pierce:true});
          e.state = 'chase'; e.stT = rage ? 1.8 : 2.5;
        }
      } else if (e.state === 'charge') {
        if (!e.did) { e.did = true; e.cdir = Math.sign(dx) || 1; e.stT = 1.1; }
        e.vx = e.cdir * spd * 3.4;
        if (e.hitWall || e.stT <= 0) { e.state = 'chase'; e.stT = 2.4; if (e.hitWall) { e.stunT = 0.8; shake(5); } }
      } else if (e.state === 'boulder') {
        // Boulder Hurl: rips a giant boulder from the arena floor and launches it at the target
        e.vx = approach(e.vx, 0, 700 * dt);
        if (!e.did && e.stT < 0.6) {
          e.did = true; shake(6);
          const vx = clamp(dx * 1.2, -380, 380);
          addProj({x:ecx(e), y:e.y - 12, vx, vy:-300, type:'boulder', dmg:e.dmg * 1.3, owner:'e', life:3, r:9, grav:750});
          for (let i = 0; i < 4; i++) {
            addProj({x:ecx(e), y:e.y - 6, vx:vx * 0.7 + (Math.random() - 0.5) * 160, vy:-220 - Math.random() * 100, type:'shard', dmg:e.dmg * 0.6, owner:'e', life:1.2, r:3, grav:650});
          }
        }
        if (e.stT <= 0) { e.state = 'chase'; e.stT = rage ? 1.8 : 2.6; }
      } else if (e.state === 'stomp') {
        // Triple Tremor: stomps the ground 3 times in rapid succession
        e.vx = approach(e.vx, 0, 800 * dt);
        e.subT = (e.subT || 0) - dt;
        if (e.subT <= 0 && e.stompCount < 3) {
          e.subT = 0.35;
          e.stompCount++;
          shake(6 + e.stompCount * 2);
          addParticles(ecx(e), e.y + e.h, '#d8b878', 20, 150, 0.5);
          for (const s of [-1, 1]) {
            addProj({x:ecx(e) + s * 20, y:e.y + e.h - 6, vx:s * (230 + e.stompCount * 45), vy:0, type:'shock', dmg:e.dmg * (0.7 + e.stompCount * 0.15), owner:'e', life:1.2, r:8, pierce:true});
          }
        }
        if (e.stT <= 0) { e.state = 'chase'; e.stT = rage ? 2 : 2.8; }
      }
      if (frozen) e.vx = 0;
      e.vy = Math.min(e.vy + GRAV * dt, 900);
      moveEntity(e, dt, true);
      if (e.state !== 'charge') e.facing = Math.sign(dx) || e.facing; else e.facing = e.cdir;
      break;
    }
    case 'archlich': {
      const gy = bossGroundY(e);
      if (e.state === 'intro' && e.stT <= 0) { e.state = 'float'; e.stT = 5; }
      if (e.state === 'float') {
        const want = 220, tx = ecx(p) - Math.sign(dx || 1) * want, ty = Math.min(gy - 90, ecy(p) - 70) + Math.sin(e.t * 2) * 20;
        e.vx = approach(e.vx, clamp((tx - ecx(e)) * 1.5, -160, 160), 350 * dt);
        e.vy = approach(e.vy, clamp((ty - ecy(e)) * 1.5, -160, 160), 350 * dt);
        if (e.shootT <= 0) {
          e.shootT = rage ? 1.4 : 1.9;
          const pt = b.proj || 'skullbolt';
          for (let i = 0; i < 3; i++) { const a = Math.atan2(dy, dx) + (i - 1) * (pt === 'fireball' ? 0.25 : 0.45); addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a) * 200, vy:Math.sin(a) * 200, type:pt, dmg:e.dmg, owner:'e', life:3.5, r:4, homing:pt === 'skullbolt', fire:pt === 'fireball', turn:1.5}); }
        }
        if (e.summonT <= 0) {
          e.summonT = 11;
          const n = minionCount();
          for (let i = 0; i < Math.min(b.minionMax ? 1 : 3, (b.minionMax || 5) - n); i++) { const m = makeEnemy(b.minion || 'skeleton', e.homeX + (Math.random() - 0.5) * 300, gy - 40, b.minionLvl || 48); m.summoned = true; m.summoner = e; m.aggro = true; m.y = gy - m.h - 1; enemies.push(m); }
        }
        if (e.stT <= 0) {
          const r = Math.random();
          e.state = r < 0.35 ? 'ring' : r < 0.68 ? 'barrage' : 'beam';
          e.stT = e.state === 'ring' ? 0.8 : e.state === 'barrage' ? 1.8 : 1.3;
          e.did = false; e.subT = 0; e.shotCount = 0;
        }
      } else if (e.state === 'ring') {
        e.vx *= 0.9; e.vy *= 0.9;
        if (!e.did && e.stT < 0.4) {
          e.did = true;
          const n = rage ? 16 : 10;
          const rp = b.ringProj || 'bone';
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a) * 210, vy:Math.sin(a) * 210, type:rp, dmg:e.dmg * 0.85, owner:'e', life:2.5, r:4, ghost:true, fire:rp === 'fireball'}); }
        }
        if (e.stT <= 0) {
          if (Math.random() < 0.5) { addParticles(ecx(e), ecy(e), '#9be36b', 30, 150, 0.6); teleportClear(e, () => e.homeX + (Math.random() - 0.5) * 400, () => gy - 120 - Math.random() * 30); addParticles(ecx(e), ecy(e), '#9be36b', 30, 150, 0.6); }
          e.state = 'float'; e.stT = rage ? 3 : 4.5;
        }
      } else if (e.state === 'barrage') {
        // Soul Rain / Magma Cascade: rains skullbolts or fireballs from the sky
        e.vx *= 0.9; e.vy *= 0.9;
        e.subT = (e.subT || 0) - dt;
        if (e.subT <= 0 && (e.shotCount || 0) < (rage ? 8 : 6)) {
          e.subT = 0.2;
          e.shotCount = (e.shotCount || 0) + 1;
          const pt = b.proj || 'skullbolt';
          const dropX = ecx(p) + (Math.random() - 0.5) * 240;
          addParticles(dropX, gy - 240, pt === 'fireball' ? '#ff6a1a' : '#9be36b', 12, 60, 0.4);
          addProj({x:dropX, y:gy - 220, vx:(Math.random() - 0.5) * 80, vy:240, type:pt, dmg:e.dmg * 0.9, owner:'e', life:3, r:5, fire:pt === 'fireball'});
        }
        if (e.stT <= 0) { e.state = 'float'; e.stT = rage ? 2.8 : 4; }
      } else if (e.state === 'beam') {
        // Necrotic Beam Stream: rapid focused burst toward target
        e.vx *= 0.85; e.vy *= 0.85;
        e.subT = (e.subT || 0) - dt;
        if (e.subT <= 0 && (e.shotCount || 0) < 5) {
          e.subT = 0.14;
          e.shotCount = (e.shotCount || 0) + 1;
          const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.12;
          const pt = b.proj || 'skullbolt';
          addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a) * 360, vy:Math.sin(a) * 360, type:pt, dmg:e.dmg * 0.75, owner:'e', life:2.2, r:4, fire:pt === 'fireball'});
        }
        if (e.stT <= 0) { e.state = 'float'; e.stT = rage ? 2.5 : 3.5; }
      }
      if (frozen) { e.vx *= 0.5; e.vy *= 0.5; }
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.facing = Math.sign(dx) || e.facing;
      break;
    }
    case 'gold_dragon': {
      const C = CASTLE, minX = (C.x0 + 3) * TILE, maxX = (C.x1 - 2) * TILE, minY = (C.top + 3) * TILE, floorY = C.floor * TILE;
      e.vulnerable = false; e.breathing = false;
      const lure = lures.find(l => l.x > minX - 40 && l.x < maxX + 40);
      if (lure && e.state !== 'admire' && e.state !== 'intro') { e.state = 'admire'; e.lure = lure; toast('Aurex cannot resist the gold! Strike now!', 'gold'); }
      if (e.state === 'intro' && e.stT <= 0) { e.state = 'hover'; e.stT = 2; }
      const moveTo = (tx, ty, sp) => {
        e.vx = approach(e.vx, clamp((tx - ecx(e)) * 2, -sp, sp), 500 * dt);
        e.vy = approach(e.vy, clamp((ty - ecy(e)) * 2, -sp, sp), 500 * dt);
      };
      if (e.state === 'admire') {
        const l = e.lure;
        moveTo(l.x, l.y - e.h * 0.4, 260);
        e.vulnerable = Math.hypot(l.x - ecx(e), l.y - ecy(e)) < 140;
        e.facing = Math.sign(l.x - ecx(e)) || e.facing;
        if (l.t <= 0 || !lures.includes(l)) { e.state = 'hover'; e.stT = 1.5; }
      } else if (e.state === 'hover') {
        const side = ecx(p) < (minX + maxX) / 2 ? 1 : -1;
        moveTo(ecx(p) + side * 230, ecy(p) - 120, rage ? 250 : 195);
        e.facing = Math.sign(dx) || e.facing;
        if (e.stT <= 0) {
          const r = Math.random();
          e.state = r < 0.22 ? 'breath' : r < 0.42 ? 'dive' : r < 0.62 ? 'rain' : r < 0.82 ? 'sweep' : 'cataclysm';
          e.stT = e.state === 'breath' ? 2.2 : e.state === 'dive' ? 1.5 : e.state === 'rain' ? 2.6 : e.state === 'sweep' ? 1.8 : 2.4;
          e.did = false; e.fireT = 0; e.cataT = 0;
        }
      } else if (e.state === 'breath') {
        e.vx *= 0.92; e.vy *= 0.92; e.breathing = true;
        e.facing = Math.sign(dx) || e.facing;
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = rage ? 0.05 : 0.07;
          const mx = ecx(e) + e.facing * e.w * 0.55, my = e.y + e.h * 0.25;
          const a = Math.atan2(ecy(p) - my, ecx(p) - mx) + (Math.random() - 0.5) * 0.25;
          addProj({x:mx, y:my, vx:Math.cos(a) * 350, vy:Math.sin(a) * 350, type:'breath', dmg:e.dmg * 0.55, owner:'e', life:1.6, r:5, fire:true, ghost:true});
        }
        if (e.stT <= 0) { e.state = 'hover'; e.stT = rage ? 1.4 : 2; }
      } else if (e.state === 'dive') {
        if (!e.did) { e.did = true; e.ddx = Math.sign(dx) || 1; e.vy = 0; }
        moveTo(ecx(e) + e.ddx * 400, ecy(p), rage ? 580 : 500);
        e.vx = e.ddx * (rage ? 580 : 500);
        e.facing = e.ddx;
        if (e.stT <= 0 || ecx(e) < minX + e.w / 2 + 4 || ecx(e) > maxX - e.w / 2 - 4) { e.state = 'hover'; e.stT = 1.6; }
      } else if (e.state === 'rain') {
        moveTo((minX + maxX) / 2, minY + 80, 200);
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = rage ? 0.11 : 0.16;
          addProj({x:ecx(p) + (Math.random() - 0.5) * 360, y:minY + 10, vx:0, vy:130, type:'goldrain', dmg:e.dmg * 0.6, owner:'e', life:3, r:4, grav:400});
        }
        if (e.stT <= 0) { e.state = 'hover'; e.stT = 1.8; }
      } else if (e.state === 'sweep') {
        // Golden Wing Bladewind: sweeps forward and unleashes a wall of flame waves
        if (!e.did) {
          e.did = true;
          e.swDir = Math.sign(dx) || 1;
          shake(8);
          for (let i = -2; i <= 2; i++) {
            const a = (e.swDir > 0 ? 0 : Math.PI) + i * 0.22;
            addProj({x:ecx(e) + e.swDir * 40, y:ecy(e) + i * 14, vx:Math.cos(a) * 340, vy:Math.sin(a) * 340, type:'flamewave', dmg:e.dmg * 0.9, owner:'e', life:1.6, r:7, fire:true, ghost:true});
          }
        }
        moveTo(ecx(p) - (Math.sign(dx) || 1) * 200, ecy(p) - 80, 320);
        if (e.stT <= 0) { e.state = 'hover'; e.stT = rage ? 1.5 : 2.2; }
      } else if (e.state === 'cataclysm') {
        // Dragonfire Cataclysm: positions in upper hall, roars, and detonates a 16-way radial fire burst
        moveTo((minX + maxX) / 2, minY + 100, 260);
        e.cataT = (e.cataT || 0) - dt;
        if (!e.did && e.stT < 1.6) {
          e.did = true;
          shake(10);
          toast('Aurex unleashes a Dragonfire Cataclysm!', 'red');
          const n = rage ? 18 : 14;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            addProj({x:ecx(e), y:ecy(e), vx:Math.cos(a) * 280, vy:Math.sin(a) * 280, type:'breath', dmg:e.dmg * 0.85, owner:'e', life:2.5, r:6, fire:true, ghost:true});
          }
        }
        if (e.stT <= 0) { e.state = 'hover'; e.stT = rage ? 1.6 : 2.5; }
      }
      if (frozen) { e.vx *= 0.5; e.vy *= 0.5; }
      e.x = clamp(e.x + e.vx * dt, minX, maxX - e.w);
      e.y = clamp(e.y + e.vy * dt, minY, floorY - e.h);
      break;
    }
  }
}
function updateBossTriggerCastle() {
  // nothing: the dragon is summoned at its altar like the others
}

// ===== Particles, floaters, effects =====
function updateFx(dt) {
  for (const p of particles) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  particles = particles.filter(p => p.life > 0);
  if (particles.length > 600) particles.splice(0, particles.length - 600);
  for (const f of floaters) { f.life -= dt; f.y += f.vy * dt; f.vy *= 0.96; }
  floaters = floaters.filter(f => f.life > 0);
  for (const e of effects) e.life -= dt;
  effects = effects.filter(e => e.life > 0);
}

// ===== Spawning =====
// After an enemy dies, no new enemies spawn in that area for 90 seconds.
const KILL_COOLDOWN = 90;            // seconds
const KILL_AREA_W = 40, KILL_AREA_H = 30; // tiles from the kill spot, horizontal / vertical
let killZones = [];
function markKillZone(px, py) {
  killZones.push({tx: Math.floor(px / TILE), ty: Math.floor(py / TILE), t: G.time});
  if (killZones.length > 200) killZones.splice(0, killZones.length - 200);
}
function areaOnCooldown(tx, ty) {
  killZones = killZones.filter(z => { const age = G.time - z.t; return age >= 0 && age < KILL_COOLDOWN; });
  return killZones.some(z => Math.abs(z.tx - tx) <= KILL_AREA_W && Math.abs(z.ty - ty) <= KILL_AREA_H);
}
// ===== Mini-bosses =====
function makeMiniBoss(m) {
  const d = EN[m.type], e = makeEnemy(m.type, 0, 0, m.lvl, {elite:true});
  const sc = 1.6;
  e.sc = sc; e.w = d.w * sc; e.h = d.h * sc;
  e.name = m.name; e.mini = m.id; e.miniDef = m;
  const D = diff(), bs = bossScaling();
  e.maxHp = Math.max(30, Math.round(enemyHp(d.hp, m.lvl) * ENEMY_HEALTH * 11 * D.hp * bs.hp)); e.hp = e.maxHp;
  e.dmg = Math.max(1, Math.round(enemyDmg(d.dmg, m.lvl) * ENEMY_DAMAGE_SCALE * 1.6 * D.dmg * bs.dmg));
  e.xp = Math.round(enemyXp(m.lvl, d.xpm) * 10 * D.reward);
  e.coins = Math.round(d.coins * (1 + m.lvl * 0.25) * 10 * D.reward);
  e.kbRes = 0.25; e.skillT = 4;
  return e;
}
// Host only: bring each mini-boss in when a knight gets near its spot (and it isn't on its 10-minute rest).
function miniBossTick(dt) {
  G.miniT -= dt;
  if (G.miniT > 0) return;
  G.miniT = 1;
  const tl = allTargets();
  if (!tl.length) return;
  const lim = barrierLimit();
  for (const m of MINIBOSSES) {
    if (enemies.some(e => e.mini === m.id && !e.dead)) continue;
    const last = G.minis[m.id];
    if (last != null && G.play >= last && G.play - last < MINIBOSS_RESPAWN) continue;
    if ((m.x + 3) * TILE > lim) continue;
    if (m.castle && G.boss) continue;
    const gy = m.castle ? CASTLE.floor : tops[m.x];
    const px = m.x * TILE + TILE / 2, py = gy * TILE;
    if (!tl.some(t => Math.abs(ecx(t) - px) < 45 * TILE && Math.abs(ecy(t) - py) < 30 * TILE)) continue;
    if (tl.some(t => Math.abs(ecx(t) - px) < 10 * TILE && Math.abs(ecy(t) - py) < 10 * TILE)) continue; // don't pop in on top of someone
    const e = makeMiniBoss(m), flyer = EN[m.type].ai === 'flyer';
    e.x = px - e.w / 2;
    e.y = flyer ? (gy - 6) * TILE : gy * TILE - e.h - 0.5;
    for (let k = 0; k < 12 && rectSolid(e.x, e.y, e.w, e.h); k++) e.y -= TILE;
    if (rectSolid(e.x, e.y, e.w, e.h)) continue;
    e.aggro = true; // it knows you're coming
    enemies.push(e);
    addParticles(ecx(e), ecy(e), '#ff7a3a', 30, 160, 0.8);
    toast(`${m.name} appears!`, 'red');
  }
}
// Each mini-boss has one special trick on top of its normal attacks.
function miniSkill(e, dx, dy, dist, dt) {
  const m = e.miniDef;
  if (!m) return;
  e.skillT -= dt * (diff().atk || 1);
  switch (m.skill) {
    case 'enrage':
      if (!e.enraged && e.hp < e.maxHp * 0.5) {
        e.enraged = true; e.spd *= 1.5; e.dmg *= 1.3;
        addParticles(ecx(e), ecy(e), '#ff3a3a', 30, 160, 0.7);
        toast(`${e.name} is enraged!`, 'red');
      }
      break;
    case 'regen':
      if (e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * dt);
        if (Math.random() < dt * 4) addParticles(ecx(e), e.y + 4, '#7bd34a', 1, 30, 0.5, -40);
      }
      break;
    case 'summon':
      if (e.skillT <= 0) {
        e.skillT = 9;
        const mine = enemies.filter(x => x.summoner === e && !x.dead).length;
        for (let i = 0; i < Math.min(2, 3 - mine); i++) summonMinion(e, m.minion, Math.max(1, m.lvl - 3), e);
      }
      break;
    case 'volley':
      if (e.skillT <= 0 && dist < 460 && clearPath(ecx(e), ecy(e), ecx(e) + dx, ecy(e) + dy)) {
        e.skillT = 3;
        const a = Math.atan2(dy, dx), sy = e.y + e.h * 0.35;
        for (let i = -1; i <= 1; i++) addProj({x:ecx(e), y:sy, vx:Math.cos(a + i * 0.22) * 230, vy:Math.sin(a + i * 0.22) * 230, type:m.proj, dmg:e.dmg * 0.7,
          owner:'e', life:3, r:4, homing:m.proj === 'skullbolt', fire:m.proj === 'fireball', turn:1.4});
      }
      break;
    case 'shockwave':
      if (e.skillT <= 0 && e.onGround && Math.abs(dx) < 320) { e.skillT = 5; e.vy = -430; e.slamAir = true; }
      if (e.slamAir && e.onGround && e.vy >= 0 && e.skillT < 4.7) {
        e.slamAir = false; shake(5);
        effects.push({type:'ring', x:ecx(e), y:e.y + e.h, r:110, life:0.4, max:0.4, col:'#d8b878'});
        for (const s of [-1, 1]) addProj({x:ecx(e) + s * 16, y:e.y + e.h - 6, vx:s * 280, vy:0, type:'shock', dmg:e.dmg * 0.7, owner:'e', life:1.1, r:7, pierce:true});
      }
      break;
  }
}

function spawnTick(dt) {
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = (3.5 + Math.random() * 3) / (diff().spawn || 1); // harder difficulties spawn enemies more often
  const tl = allTargets();
  if (!tl.length || G.boss) return;
  const p = tl[Math.floor(Math.random() * tl.length)];
  const ptx = Math.floor(ecx(p) / TILE), pty = Math.floor(ecy(p) / TILE);
  const night = isNight();
  const cap = Math.round(((night ? 7 : 5) + (tl.length - 1) * 3) * (diff().spawn || 1));
  const count = enemies.filter(e => !e.ally && !e.boss && !e.summoned).length;
  if (count >= cap) return;
  const underground = pty > surf[clamp(ptx, 0, WW - 1)] + 12;
  if (inCastle(ptx, pty)) return;
  for (let a = 0; a < 14; a++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const tx = ptx + side * (30 + Math.floor(Math.random() * 22));
    if (tx < 2 || tx >= WW - 2) continue;
    if ((tx + 2) * TILE > barrierLimit()) continue;
    if (tx < 130 && !underground) continue;
    if (!underground && TOWNS.some(t => Math.abs(tx - t.x) <= TOWN_HALF + 6)) continue; // villages are safe
    const b = biomeAt(tx);
    let list, range, ty;
    if (!underground) {
      list = night ? b.night : b.day; range = b.lv;
      ty = tops[tx];
      if (ty >= WH - 4 || Math.abs(ty - pty) > 40) continue;
      if (inCastle(tx, ty - 1)) continue;
    } else {
      list = b.under; range = b.ug;
      const start = pty + Math.floor(Math.random() * 24) - 12;
      let found = false;
      for (let k = 0; k < 16; k++) {
        const yy = start + k;
        if (yy >= WH - 3 || yy < 1) break;
        if (!isSolid(tx, yy) && !isSolid(tx, yy - 1) && isSolid(tx, yy + 1)) { ty = yy + 1; found = true; break; }
      }
      if (!found) continue;
    }
    if (!list || !list.length) continue;
    if (areaOnCooldown(tx, ty)) continue;
    const type = list[Math.floor(Math.random() * list.length)];
    const d = EN[type];
    const frac = clamp((tx - b.x0) / (b.x1 - b.x0), 0, 1);
    const lvl = clamp(Math.round(lerp(range[0], range[1], frac) + (Math.random() * 2 - 1)), 1, 60);
    const e = makeEnemy(type, 0, 0, lvl, {elite: Math.random() < 0.045 * diff().elite});
    e.x = tx * TILE + TILE / 2 - e.w / 2;
    e.y = d.ai === 'flyer' ? (ty - 5) * TILE : ty * TILE - e.h - 0.5;
    if (!d.phase && rectSolid(e.x, e.y, e.w, e.h)) continue;
    if (liquidAt(ecx(e), ecy(e)) === 'lava') continue;
    enemies.push(e);
    return;
  }
}
