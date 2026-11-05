'use strict';
// ===== Inventory model =====
const HOTBAR_SIZE = 10;
let hotbar = new Array(HOTBAR_SIZE).fill(null), inv = new Array(30).fill(null), sel = 0, held = null;
const $ = id => document.getElementById(id);
// Older saves had a 7-slot hotbar: pad them out to the current size.
function fitHotbar(h) { const out = (h || []).slice(0, HOTBAR_SIZE); while (out.length < HOTBAR_SIZE) out.push(null); return out; }

function addItem(id, n = 1, rare = false, silent = false) {
  if (id === 'coins') { player.coins += n; return true; }
  const def = ITEMS[id]; if (!def) return false;
  const max = def.stack; let left = n;
  if (max > 1) for (const arr of [hotbar, inv]) for (const s of arr) {
    if (left <= 0) break;
    if (s && s.id === id && !!s.rare === !!rare && s.n < max) { const k = Math.min(left, max - s.n); s.n += k; left -= k; }
  }
  for (const arr of [hotbar, inv]) for (let i = 0; i < arr.length && left > 0; i++) {
    if (!arr[i]) { const k = Math.min(left, max); arr[i] = {id, n:k}; if (rare) arr[i].rare = true; left -= k; }
  }
  if (left > 0) toast('Inventory full! Some items were lost.', 'red');
  const got = n - left;
  if (got > 0 && !silent) questEvent('collect', id, got);
  refreshSlots();
  return got > 0;
}
function countItem(id) {
  let c = 0;
  for (const arr of [hotbar, inv]) for (const s of arr) if (s && s.id === id) c += s.n;
  if (held && held.id === id) c += held.n;
  return c;
}
function removeItems(id, n) {
  for (const arr of [inv, hotbar]) for (let i = 0; i < arr.length && n > 0; i++) {
    const s = arr[i];
    if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) arr[i] = null; }
  }
  refreshSlots();
}
function consumeSlot(slot, n) {
  slot.n -= n;
  if (slot.n <= 0) {
    for (const arr of [hotbar, inv]) { const i = arr.indexOf(slot); if (i >= 0) arr[i] = null; }
  }
  refreshSlots();
}
function hasEver(id) { return countItem(id) > 0 || player.armorId === id; }

// ===== Potions =====
function drinkPotion(slot) {
  const p = player, it = ITEMS[slot.id];
  if (p.potionCd > 0) return;
  if (it.heal && p.hp >= p.maxHp) { toast('Your health is already full.'); return; }
  if (it.mana && !it.heal && p.mana >= p.maxMana) { toast('Your mana is already full.'); return; }
  if (it.heal) healPlayer(p.maxHp * it.heal, true);
  if (it.mana) { p.mana = Math.min(p.maxMana, p.mana + p.maxMana * it.mana); addFloater(ecx(p), p.y - 10, '+mana', '#7fb0ff'); }
  p.potionCd = 1;
  addParticles(ecx(p), ecy(p), it.col, 14, 70, 0.6, -40);
  consumeSlot(slot, 1);
}
function quickPotion(kind) {
  const order = kind === 'h' ? ['pot_h4', 'pot_h3', 'pot_h2', 'pot_h1'] : ['pot_m4', 'pot_m3', 'pot_m2', 'pot_m1'];
  const p = player;
  const missing = kind === 'h' ? p.maxHp - p.hp : p.maxMana - p.mana;
  const cap = kind === 'h' ? p.maxHp : p.maxMana;
  // pick the smallest potion that covers what is missing, otherwise the biggest
  let pick = null;
  for (const id of order.slice().reverse()) {
    const s = findSlot(id); if (!s) continue;
    const amt = (ITEMS[id].heal || ITEMS[id].mana) * cap;
    if (amt >= missing) { pick = s; break; }
  }
  if (!pick) for (const id of order) { const s = findSlot(id); if (s) { pick = s; break; } }
  if (!pick) { toast(kind === 'h' ? 'No health potions.' : 'No mana potions.'); return; }
  drinkPotion(pick);
}
function findSlot(id) {
  for (const arr of [hotbar, inv]) for (const s of arr) if (s && s.id === id) return s;
  return null;
}

// ===== Crafting =====
function nearStation(st) {
  if (!st) return true;
  const p = player, cx = Math.floor(ecx(p) / TILE), cy = Math.floor(ecy(p) / TILE);
  for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 6; x <= cx + 6; x++) if (TP[getT(x, y)].station === st) return true;
  return false;
}
function canCraft(r) { return nearStation(r.st) && r.in.every(([id, n]) => countItem(id) >= n); }
function craft(r) {
  if (!canCraft(r)) return;
  for (const [id, n] of r.in) removeItems(id, n);
  addItem(r.out, r.n, false, true);
  questEvent('craft', r.out, r.n);
  toast(`Crafted ${r.n > 1 ? r.n + ' ' : ''}${ITEMS[r.out].name}.`, 'loot');
  renderCrafting();
}

// ===== Quests =====
function currentMain() { return MAIN_QUESTS[G.mainQ] || null; }
function questPrereq(q) {
  if (!q) return 0;
  if (q.type === 'craft') return hasEver(q.target) ? q.n : 0;
  if (q.type === 'collect') return Math.min(q.n, countItem(q.target));
  if (q.type === 'boss') return G.bossesDone[q.target] ? 1 : 0;
  return 0;
}
function startMainQuest() {
  if (!QUESTS_ON) { updateQuestHUD(); return; }
  const q = currentMain();
  G.mainProg = questPrereq(q);
  if (q) setTimeout(checkQuests, 50);
  updateQuestHUD();
}
function questEvent(type, target, n) {
  if (!G) return;
  if (!QUESTS_ON) { updateQuestHUD(); return; }
  const q = currentMain();
  if (q && q.type === type && q.target === target) G.mainProg += n;
  for (const k of ['greta', 'fennick']) {
    const s = G.side[k]; if (!s.active) continue;
    const sq = SIDE_QUESTS[k][s.i];
    if (sq && sq.type === type && sq.target === target) s.prog += n;
  }
  checkQuests();
}
function grantReward(q) {
  const xp = Math.round(xpNeed(player.level) * (q.xpf || 0.5));
  gainXp(xp);
  if (q.coins) player.coins += q.coins;
  for (const [id, n] of (q.items || [])) addItem(id, n, false, true);
  return xp;
}
function checkQuests() {
  if (!QUESTS_ON) { updateQuestHUD(); return; }
  const q = currentMain();
  if (q && G.mainProg >= q.n) {
    const xp = grantReward(q);
    toast(`Quest complete: ${q.title} (+${xp} XP)`, 'gold');
    G.mainQ++;
    const nq = currentMain();
    if (nq) {
      startMainQuest();
      openDialog({speaker:'Sir Aldric', title:nq.title, text:nq.text, buttons:[{label:'On my way', fn:closeDialog}]});
    }
  }
  for (const k of ['greta', 'fennick']) {
    const s = G.side[k]; if (!s.active) continue;
    const sq = SIDE_QUESTS[k][s.i];
    if (sq && s.prog >= sq.n) {
      const xp = grantReward(sq);
      toast(`Side quest complete: ${sq.title} (+${xp} XP, +${sq.coins}g)`, 'gold');
      s.active = false; s.i++; s.prog = 0;
    }
  }
  updateQuestHUD();
}
function questLine(q, prog) {
  if (!q) return '';
  if (q.type === 'boss') return `Defeat ${BOSSES[q.target].name}`;
  const what = q.type === 'kill' ? EN[q.target].name + 's' : ITEMS[q.target].name;
  const verb = q.type === 'kill' ? 'Defeat' : q.type === 'craft' ? 'Craft' : 'Collect';
  return `${verb} ${q.n > 1 ? q.n + ' ' : ''}${what} (${Math.min(prog, q.n)}/${q.n})`;
}
// ===== Boss hunt (replaces quests) =====
// The next boss to hunt: the lowest-level one you haven't beaten.
function nextBoss() { return BOSS_ORDER.find(k => !G.bossesDone[k]) || null; }
function bossWhere(k) { return k === 'gold_dragon' ? 'Dragonhold Castle, far east' : biomeAt(BOSSES[k].x).name; }
function bossCount() { return BOSS_ORDER.filter(k => G.bossesDone[k]).length; }
function updateQuestHUD() {
  const el = $('questTrack'); if (!el || !G) return;
  if (!QUESTS_ON) {
    const k = nextBoss(), done = bossCount(), all = BOSS_ORDER.length;
    if (G.won || !k) el.innerHTML = `<div class="qt-title">All bosses defeated</div><div class="qt-line">${G.won ? 'Princess Elowen is safe. Explore freely!' : 'Free Princess Elowen in Dragonhold Castle.'}</div>`;
    else el.innerHTML = `<div class="qt-title">Boss hunt · ${done}/${all}</div><div class="qt-line">Next: ${BOSSES[k].name.split(',')[0]} (level ${BOSSES[k].lvl})</div><div class="qt-side">${bossWhere(k)} · J for all bosses</div>`;
    return;
  }
  const q = currentMain();
  let html = '';
  if (q) html += `<div class="qt-title">${q.title}</div><div class="qt-line">${questLine(q, G.mainProg)}</div>`;
  else if (G.won) html += `<div class="qt-title">Victory</div><div class="qt-line">Princess Elowen is safe. Explore freely!</div>`;
  for (const k of ['greta', 'fennick']) {
    const s = G.side[k]; if (!s.active) continue;
    const sq = SIDE_QUESTS[k][s.i];
    html += `<div class="qt-side">${sq.title}: ${questLine(sq, s.prog)}</div>`;
  }
  el.innerHTML = html;
}

// ===== NPCs =====
let npcs = [];
function buildNPCs() {
  const vy = surf[70] * TILE;
  npcs = [
    {id:'aldric', name:'Sir Aldric', x:36 * TILE + 8, y:vy, look:{body:'#a9acb5', trim:'#c9a86a', legs:'#80848e', hair:'#d8d8d8', beard:'#e8e8e8'}},
    {id:'greta', name:'Greta the Merchant', x:84 * TILE + 8, y:vy, look:{dress:true, body:'#4f7a3a', trim:'#e8d8a8', hair:'#8a4a2a', long:true}},
    {id:'fennick', name:'Fennick the Wizard', x:106 * TILE + 8, y:vy, look:{dress:true, body:'#2f4a9a', trim:'#f5cc45', hair:'#e8e8e8', beard:'#e8e8e8', hat:'#2f4a9a', staff:true}},
    {id:'princess', name:'Princess Elowen', x:MX(2187) * TILE, y:CASTLE.floor * TILE, look:{dress:true, body:'#e07ab0', trim:'#f5cc45', hair:'#f2d36b', long:true, crown:true}},
  ];
  // village traders, each standing under their stall
  const LOOKS = {
    goods: [{body:'#7a5a3a', trim:'#e8d8a8', legs:'#5a4532', hair:'#6a3a1a'}, {dress:true, body:'#8a4a5a', trim:'#e8d8a8', hair:'#c88a3a', long:true}],
    smith: [{body:'#4a4a52', trim:'#8a6a3a', legs:'#3a3a40', hair:'#2a2a2a', beard:'#3a2a1a'}, {body:'#5a3a2a', trim:'#a8a8b0', legs:'#3a2a20', hair:'#8a5a2a', beard:'#8a5a2a'}],
    arcane: [{dress:true, body:'#4a2f7a', trim:'#f5cc45', hair:'#d8d8e8', hat:'#4a2f7a', staff:true}, {dress:true, body:'#2f6a7a', trim:'#c8f0ff', hair:'#1a1a2a', long:true, staff:true}],
  };
  TOWNS.forEach((t, ti) => t.traders.forEach((tr, i) => {
    const sx = t.x + (i === 0 ? -11 : 11);
    npcs.push({id:`trader_${ti}_${i}`, name:tr.name, x:sx * TILE + 8, y:surf[t.x] * TILE, look:LOOKS[tr.kind][ti % 2], shop:tr.shop, town:t.name, kind:tr.kind});
  }));
}
function updateNPCs() {
  for (const n of npcs) {
    n.facing = ecx(player) < n.x ? -1 : 1;
    if (!QUESTS_ON && n.id !== 'princess') n.questMark = false;
    else if (n.id === 'greta' || n.id === 'fennick') {
      const s = G.side[n.id];
      n.questMark = !s.active && s.i < SIDE_QUESTS[n.id].length;
    } else if (n.id === 'princess') n.questMark = G.bossesDone.gold_dragon && !G.won;
    else n.questMark = false;
  }
}
// Sir Aldric swaps your starting weapon (Sword / Dagger / Wand) in any game, new or old.
// It replaces the starter you carry in the same slot, so you never end up with extras.
function starterSwapDialog() {
  const starters = Object.values(STARTER_WEAPONS);
  const pick = (kind) => {
    const want = STARTER_WEAPONS[kind];
    let slot = null;
    for (const arr of [hotbar, inv]) for (const s of arr) if (!slot && s && starters.includes(s.id)) slot = s;
    if (slot && slot.id === want) { closeDialog(); toast(`You already carry the ${ITEMS[want].name}.`); return; }
    if (slot) { const old = slot.id; slot.id = want; refreshSlots(); toast(`Sir Aldric takes your ${ITEMS[old].name} and hands you the ${ITEMS[want].name}.`, 'gold'); }
    else { addItem(want, 1, false, true); toast(`Sir Aldric hands you the ${ITEMS[want].name}.`, 'gold'); }
    if (kind === 'wand' && countItem('pot_m1') < 3) addItem('pot_m1', 3, false, true);
    try { setStartWeapon(kind); } catch (e) {}
    if (player) player.heroClass = kind;
    closeDialog();
  };
  openDialog({speaker:'Sir Aldric', title:'Choose your class & weapon',
    text:`<p>Every warrior fights differently. Choose your path:</p>
      <p><b>Knight (Sword):</b> polished armor, balanced reach and damage.<br>
      <b>Rogue Assassin (Dagger):</b> shadow cowl & cloak, fast stabs, 15% critical hits.<br>
      <b>Wizard (Wand):</b> wizard hat & celestial robes, ranged magic that slows, uses mana.</p>`,
    buttons:[{label:'Knight (Sword)', fn:() => pick('sword')}, {label:'Rogue Assassin (Dagger)', fn:() => pick('dagger')}, {label:'Wizard (Wand)', fn:() => pick('wand')}, {label:'Never mind', fn:closeDialog}]});
}
function talkTo(n) {
  if (n.shop) {
    const greet = {goods:`Welcome to ${n.town}! Potions and supplies for the road.`, smith:`Steel for the hunt? Finest forge in ${n.town}.`, arcane:`Ah, a seeker of power. My wands hum with it.`}[n.kind];
    openDialog({speaker:n.name, title:n.town, text:`<p>${greet}</p>`, buttons:[{label:'Browse wares', fn:() => { closeDialog(); openShop(n.shop, `${n.name.split(' ')[0]}'s Wares`); }}, {label:'Goodbye', fn:closeDialog}]});
    return;
  }
  if (n.id === 'aldric') {
    const q = currentMain();
    const swapBtn = {label:'Change my starting weapon', fn:starterSwapDialog};
    if (!QUESTS_ON) {
      // Sir Aldric points you at the next boss to hunt
      const k = nextBoss();
      const text = k
        ? `<p>${bossCount() === 0 ? 'Aurex the Gilded Wyrm holds Princess Elowen in Dragonhold Castle, and its champions rule every corner of the land. Hunt them down, one by one.' : `${bossCount()} of ${BOSS_ORDER.length} bosses have fallen. Well fought.`}</p>
           <p>Your next foe: <b>${BOSSES[k].name}</b> in ${bossWhere(k)}. Find the glowing altar there and call it out. I'd be level ${BOSSES[k].lvl} or stronger.</p>
           <p class="dlg-obj">Press J for the full list of bosses. Bosses show as red dots on the map (M).</p>`
        : '<p>Every boss has fallen, Aurex too. Go to Princess Elowen in Dragonhold Castle!</p>';
      openDialog({speaker:'Sir Aldric', title:k ? 'The Boss Hunt' : 'Victory is near', text, buttons:[{label:'Understood', fn:closeDialog}, swapBtn]});
      return;
    }
    if (q) openDialog({speaker:'Sir Aldric', title:q.title, text:q.text + `<p class="dlg-obj">Objective: ${questLine(q, G.mainProg)}</p>`, buttons:[{label:'Understood', fn:closeDialog}, swapBtn]});
    else openDialog({speaker:'Sir Aldric', text:'You did it, Sir Knight. Songs will be sung of you for a hundred years.', buttons:[{label:'Thank you', fn:closeDialog}, swapBtn]});
  } else if (n.id === 'greta') {
    const s = G.side.greta, sq = SIDE_QUESTS.greta[s.i];
    const btns = [{label:'Browse wares', fn:() => { closeDialog(); openShop(); }}];
    let text = "Welcome, welcome! Potions, torches, supplies. Coin up front, no refunds if a dragon eats you.";
    if (!QUESTS_ON) {} else if (s.active) text += `<p class="dlg-obj">Your task: ${questLine(sq, s.prog)}</p>`;
    else if (sq) { text += `<p><b>${sq.title}.</b> ${sq.text}</p><p class="dlg-obj">Reward: ${sq.coins}g and potions</p>`; btns.unshift({label:'Accept task', fn:() => { acceptSide('greta'); closeDialog(); }}); }
    btns.push({label:'Goodbye', fn:closeDialog});
    openDialog({speaker:'Greta the Merchant', text, buttons:btns});
  } else if (n.id === 'fennick') {
    const s = G.side.fennick, sq = SIDE_QUESTS.fennick[s.i];
    const tips = ['Every weapon carries the soul of the beast that held it. Each enemy type drops its own weapon, and Champions always drop theirs.',
      'Wands drink mana. Press R to drink your best mana potion.', 'Werewolves only hunt in Duskwood after dark, and the Moonfang Dagger is strongest at night.',
      'Waystones let you travel back here in an instant. Right-click one to use it.', 'The Gilded Wyrm cannot resist gold. A Gold Lure thrown at the right moment will leave it open.'];
    let text = `<p>${tips[Math.floor(Math.random() * tips.length)]}</p>`;
    const btns = [];
    if (!QUESTS_ON) {} else if (s.active) text += `<p class="dlg-obj">Your task: ${questLine(sq, s.prog)}</p>`;
    else if (sq) { text += `<p><b>${sq.title}.</b> ${sq.text}</p><p class="dlg-obj">Reward: ${sq.coins}g and potions</p>`; btns.push({label:'Accept task', fn:() => { acceptSide('fennick'); closeDialog(); }}); }
    btns.push({label:'Goodbye', fn:closeDialog});
    openDialog({speaker:'Fennick the Wizard', text, buttons:btns});
  } else if (n.id === 'princess') {
    if (!G.bossesDone.gold_dragon) openDialog({speaker:'Princess Elowen', text:'Sir Knight! Beware, the Wyrm is still here!', buttons:[{label:'Stay back', fn:closeDialog}]});
    else if (!G.won) { G.won = true; saveGame(true); closeDialog(); showVictory(); updateQuestHUD(); }
    else openDialog({speaker:'Princess Elowen', text:'The kingdom is safe because of you. Shall we explore a little longer?', buttons:[{label:'Onward', fn:closeDialog}]});
  }
}
function acceptSide(k) {
  const s = G.side[k], sq = SIDE_QUESTS[k][s.i];
  s.active = true; s.prog = sq.type === 'collect' ? Math.min(sq.n, countItem(sq.target)) : 0;
  toast(`Task accepted: ${sq.title}`, 'blue');
  checkQuests();
}

// ===== Interaction =====
function nearestNPC(maxD) {
  let best = null, bd = maxD;
  for (const n of npcs) { const d = Math.hypot(n.x - ecx(player), (n.y - 14) - ecy(player)); if (d < bd) { bd = d; best = n; } }
  return best;
}
function interactAt(tx, ty) {
  const t = getT(tx, ty);
  if (t === T.CHEST) { openChest(tx, ty); return true; }
  if (t === T.ALTAR) { altarDialog(tx); return true; }
  if (t === T.WAYSTONE) { if (!G.ways.includes(tx)) G.ways.push(tx); openWaystones(); return true; }
  return false;
}
function interactNear() {
  const n = nearestNPC(56);
  if (n) { talkTo(n); return; }
  const cx = Math.floor(ecx(player) / TILE), cy = Math.floor(ecy(player) / TILE);
  for (let r = 0; r <= 3; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (interactAt(x, y)) return;
}
function interactMouse() {
  for (const n of npcs) if (Math.abs(mouse.wx - n.x) < 10 && mouse.wy > n.y - 32 && mouse.wy < n.y && Math.hypot(n.x - ecx(player), n.y - ecy(player)) < 120) { talkTo(n); return true; }
  const tx = Math.floor(mouse.wx / TILE), ty = Math.floor(mouse.wy / TILE);
  if (Math.hypot(tx * TILE + 8 - ecx(player), ty * TILE + 8 - ecy(player)) > 7 * TILE) return false;
  return interactAt(tx, ty);
}
function openChest(tx, ty) {
  if (getT(tx, ty) !== T.CHEST) return;
  const loot = chestLoot(tx, ty);
  setT(tx, ty, T.CHEST_OPEN); // the chest stays, now open and empty
  const names = [];
  for (const [id, n, rare] of loot) {
    addItem(id, n, !!rare);
    names.push(id === 'coins' ? `${n} gold` : `${n > 1 ? n + ' ' : ''}${rare ? 'RARE ' : ''}${ITEMS[id].name}`);
  }
  addParticles(tx * TILE + 8, ty * TILE + 8, '#f5cc45', 20, 100, 0.8);
  toast('Chest: ' + names.join(', '), 'loot');
}
function altarDialog(tx) {
  let bid = null, bd = 1e9;
  for (const k in BOSSES) { const d = Math.abs(BOSSES[k].x - tx); if (d < bd) { bd = d; bid = k; } }
  const b = BOSSES[bid];
  if (G.bossesDone[bid]) { openDialog({speaker:'Ancient Altar', text:`${b.name} has been defeated. The altar is silent.`, buttons:[{label:'Leave', fn:closeDialog}]}); return; }
  if (G.boss || NET.bossId) { toast('A boss is already here!'); return; }
  const warn = player.level < b.lvl - 2 ? `<p class="dlg-warn">Recommended level ${b.lvl}. You are level ${player.level}.</p>` : `<p class="dlg-obj">Recommended level ${b.lvl}.</p>`;
  const flavor = bid === 'gold_dragon' ? 'A mountain of stolen gold glitters around the altar. Touching it will surely wake its owner.' : 'Dark runes pulse on the altar. Something powerful waits to be called.';
  openDialog({speaker:'Ancient Altar', title:b.name, text:`<p>${flavor}</p>${warn}`, buttons:[
    {label:bid === 'gold_dragon' ? 'Disturb the hoard' : 'Summon', fn:() => { closeDialog(); if (NET.on && !NET.host) netSend('host', {k:'summon', bid}); else summonBoss(bid); }},
    {label:'Not yet', fn:closeDialog}]});
}

// ===== Generic dialog =====
let openPanel = null; // name of open modal panel
function anyPanel() { return !!openPanel; }
function setPanel(name) {
  for (const id of ['dialog', 'invPanel', 'shopPanel', 'mapPanel', 'pausePanel', 'wayPanel', 'keysPanel']) $(id).hidden = id !== name;
  openPanel = name;
  if (name !== 'invPanel' && held) { addItem(held.id, held.n, held.rare, true); held = null; updateHeld(); }
  $('tooltip').hidden = true;
}
function closePanels() { setPanel(null); }
function openDialog({speaker, title, text, buttons}) {
  $('dlgSpeaker').textContent = speaker || '';
  $('dlgTitle').textContent = title || '';
  $('dlgTitle').hidden = !title;
  $('dlgText').innerHTML = text.startsWith('<') ? text : `<p>${text}</p>`;
  const bx = $('dlgButtons'); bx.innerHTML = '';
  (buttons || [{label:'OK', fn:closeDialog}]).forEach((b, i) => {
    const el = document.createElement('button'); el.className = i === 0 ? 'btn primary' : 'btn'; el.textContent = b.label;
    el.onclick = b.fn; bx.appendChild(el);
  });
  setPanel('dialog');
  setTimeout(() => { const f = bx.querySelector('button'); if (f) f.focus(); }, 0);
}
function closeDialog() { if (openPanel === 'dialog') closePanels(); }

// ===== Shop =====
function openShop(stock, title) {
  const list = $('shopList'); list.innerHTML = '';
  $('shopTitle').textContent = title || "Greta's Wares";
  const items = stock ? stock.filter(([id]) => ITEMS[id]).map(([id, price]) => ({id, price})) : SHOP;
  for (const s of items) {
    const it = ITEMS[s.id], locked = s.req && !G.bossesDone[s.req];
    const row = document.createElement('div'); row.className = 'shop-row' + (locked ? ' locked' : '');
    row.innerHTML = `<img src="${iconFor(s.id)}" alt=""><div class="shop-name">${it.name}<small>${locked ? 'Unlocks after ' + BOSSES[s.req].name.split(',')[0] : it.desc}</small></div><div class="shop-price">${s.price}g</div>`;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Buy';
    b.disabled = locked;
    b.onclick = () => {
      if (player.coins < s.price) { toast('Not enough gold.'); return; }
      player.coins -= s.price; addItem(s.id, 1, false, true); toast(`Bought ${it.name}.`); updateHUD(true);
    };
    row.appendChild(b); list.appendChild(row);
  }
  setPanel('shopPanel');
}

// ===== Waystones =====
function openWaystones() {
  const list = $('wayList'); list.innerHTML = '';
  for (const w of WAYSTONES) {
    if (!G.ways.includes(w)) continue;
    const b = document.createElement('button'); b.className = 'btn wide';
    const town = TOWNS.find(t => Math.abs(t.x - w) < 60);
    b.textContent = w === 60 ? 'Greenhollow Village' : town ? `${town.name} (${biomeAt(w).name})` : biomeAt(w).name;
    b.onclick = () => { closePanels(); placeAtWaystone(w); G.lastWay = w; if (!NET.on) enemies = enemies.filter(e => e.ally); toast('You step through the waystone.', 'blue'); };
    list.appendChild(b);
  }
  setPanel('wayPanel');
}

// ===== Icons =====
const iconCache = {};
function iconFor(id) {
  if (iconCache[id]) return iconCache[id];
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const it = ITEMS[id];
  g.translate(16, 16);
  if (it.kind === 'weapon' || it.kind === 'tool') {
    g.translate(-6, 8); g.rotate(Math.PI / 4); drawWeaponShape(g, it, 1.25);
  } else if (it.kind === 'block') {
    const tex = tileTex[it.tile] && tileTex[it.tile][0];
    if (tex) g.drawImage(tex, -10, -10, 20, 20);
    else { g.save(); g.translate(-12, -12); g.scale(1.5, 1.5); drawDeco(g, it.tile, 0, 0, 0); g.restore(); }
  } else if (it.kind === 'potion') {
    rr(g, -6, -4, 12, 12, it.col); rr(g, -4, -2, 3, 6, 'rgba(255,255,255,0.45)'); rr(g, -3, -10, 6, 6, '#cfe8ff'); rr(g, -4, -12, 8, 3, '#7a4e2d');
  } else if (it.kind === 'armor') {
    rr(g, -9, -8, 18, 16, it.col); rr(g, -12, -8, 4, 7, it.col); rr(g, 8, -8, 4, 7, it.col);
    rr(g, -9, -8, 18, 2, shade(it.col, 1.3)); rr(g, -1, -6, 2, 12, shade(it.col, 0.75)); rr(g, -9, 4, 18, 2, shade(it.col, 0.7));
  } else if (it.kind === 'lure') {
    circ(g, -4, 4, 5, '#c49a1c'); circ(g, 4, 4, 5, '#d9ae2a'); circ(g, 0, -2, 6, '#f5cc45'); circ(g, -2, -4, 2, '#fff2a8');
  } else if (it.shape === 'ore') {
    g.fillStyle = '#6d6f78'; g.beginPath(); g.moveTo(-9, 6); g.lineTo(-6, -7); g.lineTo(5, -9); g.lineTo(10, 2); g.lineTo(3, 9); g.closePath(); g.fill();
    rr(g, -4, -3, 4, 4, it.col); rr(g, 2, 1, 3, 3, it.col); rr(g, -1, -6, 3, 2, it.col);
  } else if (it.shape === 'bar') {
    g.fillStyle = shade(it.col, 0.75); g.beginPath(); g.moveTo(-11, 6); g.lineTo(11, 6); g.lineTo(7, -3); g.lineTo(-7, -3); g.closePath(); g.fill();
    rr(g, -7, -3, 14, 3, it.col); rr(g, -5, -3, 6, 1, shade(it.col, 1.4));
  } else if (it.shape === 'herb') {
    rr(g, -1, -2, 2, 12, '#3f7a2e'); rr(g, -7, 2, 6, 3, '#4f9a3a'); rr(g, 1, 0, 6, 3, '#4f9a3a');
    circ(g, 0, -6, 5, it.col); circ(g, 0, -6, 2, '#fff6c8');
  } else if (it.shape === 'scale') {
    g.fillStyle = it.col; g.beginPath(); g.moveTo(0, -10); g.lineTo(9, 0); g.lineTo(0, 10); g.lineTo(-9, 0); g.closePath(); g.fill();
    rr(g, -2, -6, 3, 8, shade(it.col, 1.4));
  } else { rr(g, -8, -8, 16, 16, it.col); }
  return (iconCache[id] = c.toDataURL());
}

// ===== Slots UI =====
function slotHTML(s, extra = '') {
  if (!s) return '';
  const it = ITEMS[s.id];
  return `<img src="${iconFor(s.id)}" alt="${it.name}" draggable="false">${s.n > 1 ? `<span class="cnt">${s.n}</span>` : ''}${extra}`;
}
function refreshSlots() {
  const hb = $('hotbar'); if (!hb) return;
  if (!hb.children.length) {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const d = document.createElement('div'); d.className = 'slot'; d.dataset.arr = 'hotbar'; d.dataset.i = i;
      hb.appendChild(d); bindSlot(d);
    }
    const grid = $('invGrid');
    for (let i = 0; i < 30; i++) {
      const d = document.createElement('div'); d.className = 'slot'; d.dataset.arr = 'inv'; d.dataset.i = i;
      grid.appendChild(d); bindSlot(d);
    }
    bindSlot($('armorSlot'));
  }
  [...hb.children].forEach((d, i) => {
    d.innerHTML = slotHTML(hotbar[i], `<span class="key">${(i + 1) % 10}</span>`);
    d.classList.toggle('sel', i === sel);
    d.classList.toggle('rare', !!(hotbar[i] && hotbar[i].rare));
  });
  [...$('invGrid').children].forEach((d, i) => { d.innerHTML = slotHTML(inv[i]); d.classList.toggle('rare', !!(inv[i] && inv[i].rare)); });
  const a = $('armorSlot');
  a.innerHTML = player && player.armorId ? slotHTML({id:player.armorId, n:1}) : '<span class="ph">Armor</span>';
  const s = hotbar[sel];
  $('heldName').textContent = s ? (s.rare ? '★ ' : '') + ITEMS[s.id].name : '';
  if (openPanel === 'invPanel') renderCrafting();
}
function bindSlot(d) {
  d.addEventListener('mousedown', ev => {
    ev.preventDefault(); ev.stopPropagation();
    if (d.id === 'armorSlot') { armorSlotClick(); return; }
    const arr = d.dataset.arr === 'hotbar' ? hotbar : inv, i = +d.dataset.i;
    if (d.dataset.arr === 'hotbar' && openPanel !== 'invPanel') { sel = i; refreshSlots(); return; }
    if (ev.button === 2) { slotRightClick(arr, i); return; }
    if (ev.shiftKey && arr[i] && !held) {
      const other = arr === hotbar ? inv : hotbar, j = other.indexOf(null);
      if (j >= 0) { other[j] = arr[i]; arr[i] = null; }
      refreshSlots(); return;
    }
    const s = arr[i];
    if (!held) { if (s) { held = s; arr[i] = null; } }
    else if (!s) { arr[i] = held; held = null; }
    else if (s.id === held.id && !!s.rare === !!held.rare && ITEMS[s.id].stack > 1) {
      const k = Math.min(held.n, ITEMS[s.id].stack - s.n); s.n += k; held.n -= k; if (held.n <= 0) held = null;
    } else { arr[i] = held; held = s; }
    refreshSlots(); updateHeld();
  });
  d.addEventListener('contextmenu', ev => ev.preventDefault());
  d.addEventListener('mouseenter', () => showTooltip(d));
  d.addEventListener('mouseleave', () => { $('tooltip').hidden = true; });
}
function slotRightClick(arr, i) {
  const s = arr[i]; if (!s) return;
  const it = ITEMS[s.id];
  if (it.kind === 'armor') { equipArmor(arr, i); }
  else if (it.kind === 'potion') drinkPotion(s);
}
function equipArmor(arr, i) {
  const s = arr[i], prev = player.armorId;
  player.armorId = s.id; arr[i] = prev ? {id:prev, n:1} : null;
  recalcStats(); refreshSlots();
  toast(`Equipped ${ITEMS[s.id].name}.`);
}
function armorSlotClick() {
  if (held && ITEMS[held.id].kind === 'armor') {
    const prev = player.armorId; player.armorId = held.id; held = prev ? {id:prev, n:1} : null;
  } else if (!held && player.armorId) {
    held = {id:player.armorId, n:1}; player.armorId = null;
  }
  recalcStats(); refreshSlots(); updateHeld();
}
function updateHeld() {
  const h = $('heldItem');
  if (held) { h.hidden = false; h.innerHTML = slotHTML(held); }
  else h.hidden = true;
}
function showTooltip(d) {
  let s;
  if (d.id === 'armorSlot') s = player.armorId ? {id:player.armorId, n:1} : null;
  else s = (d.dataset.arr === 'hotbar' ? hotbar : inv)[+d.dataset.i];
  const tt = $('tooltip');
  if (!s) { tt.hidden = true; return; }
  tt.innerHTML = itemInfoHTML(s.id, s.rare);
  tt.hidden = false;
  const r = d.getBoundingClientRect();
  tt.style.left = Math.min(window.innerWidth - 270, r.right + 8) + 'px';
  tt.style.top = Math.max(8, Math.min(window.innerHeight - tt.offsetHeight - 8, r.top)) + 'px';
}
function itemInfoHTML(id, rare) {
  const it = ITEMS[id];
  let h = `<div class="tt-name ${rare ? 'rare' : ''} ${it.boss ? 'boss' : ''}">${rare ? '★ ' : ''}${it.name}</div>`;
  if (it.kind === 'weapon') {
    const dmg = Math.round(weaponDamage(it, rare));
    h += `<div class="tt-sub">${WTYPE[it.wt].label}${rare ? ' · Rare (+25% damage, stronger effect)' : ''}${it.boss ? ' · Boss weapon' : ''}</div>`;
    h += `<div class="tt-stat">${dmg} damage${it.mana ? ` · ${it.mana} mana` : ''} · ${(1 / (it.cd || WTYPE[it.wt].cd)).toFixed(1)} attacks/s</div>`;
    h += `<div class="tt-fx"><b>${it.fxName}:</b> ${it.fxDesc}</div>`;
  } else if (it.kind === 'tool') h += `<div class="tt-sub">Pickaxe · Power ${it.power}</div>`;
  else if (it.kind === 'armor') h += `<div class="tt-sub">Armor · right-click to equip</div>`;
  else if (it.kind === 'potion') h += `<div class="tt-sub">Potion · right-click or select and click to drink</div>`;
  else if (it.kind === 'block') h += `<div class="tt-sub">Block · select it and click to place</div>`;
  if (it.desc) h += `<div class="tt-desc">${it.desc}</div>`;
  return h;
}

// ===== Inventory panel / crafting =====
function openInventory() {
  if (openPanel === 'invPanel') { closePanels(); return; }
  setPanel('invPanel');
  renderCrafting();
  renderStats();
  refreshSlots();
}
function renderStats() {
  const p = player;
  $('statsBox').innerHTML = `Level <b>${p.level}</b> · Health <b>${Math.round(p.maxHp)}</b> · Mana <b>${p.maxMana}</b> · Defense <b>${p.def}</b> · Damage ×<b>${playerDmgMult(p.level).toFixed(2)}</b>`;
}
function renderCrafting() {
  const box = $('craftList'); if (!box) return;
  box.innerHTML = '';
  const groups = {};
  for (const r of RECIPES) { const k = r.st || 'hand'; (groups[k] = groups[k] || []).push(r); }
  for (const k of ['hand', 'workbench', 'furnace', 'anvil', 'alchemy']) {
    const near = k === 'hand' || nearStation(k);
    const h = document.createElement('div'); h.className = 'craft-head';
    h.innerHTML = k === 'hand' ? 'By hand' : `${STATION_NAMES[k]} <span class="${near ? 'ok' : 'no'}">${near ? 'nearby' : 'not nearby'}</span>`;
    box.appendChild(h);
    for (const r of groups[k] || []) {
      const ok = canCraft(r);
      const row = document.createElement('button'); row.className = 'craft-row' + (ok ? ' ok' : '');
      row.disabled = !ok;
      const ins = r.in.map(([id, n]) => `<span class="${countItem(id) >= n ? 'have' : 'need'}">${n} ${ITEMS[id].name}</span>`).join(', ');
      row.innerHTML = `<img src="${iconFor(r.out)}" alt=""><div><div class="cr-name">${r.n > 1 ? r.n + '× ' : ''}${ITEMS[r.out].name}</div><div class="cr-in">${ins}</div></div>`;
      row.onclick = () => craft(r);
      row.onmouseenter = () => { const tt = $('tooltip'); tt.innerHTML = itemInfoHTML(r.out, false); tt.hidden = false; const b = row.getBoundingClientRect(); tt.style.left = Math.max(8, b.left - 270) + 'px'; tt.style.top = b.top + 'px'; };
      row.onmouseleave = () => { $('tooltip').hidden = true; };
      box.appendChild(row);
    }
  }
}

// ===== HUD =====
let hudT = 0;
let lastArena = null, lastMine = null;
function updateHUD(force) {
  hudT -= 1;
  if (hudT > 0 && !force) return;
  hudT = 6;
  const p = player;
  $('hpFill').style.width = (100 * Math.max(0, p.hp) / p.maxHp) + '%';
  $('hpText').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
  $('mpFill').style.width = (100 * p.mana / p.maxMana) + '%';
  $('mpText').textContent = `${Math.floor(p.mana)} / ${p.maxMana}`;
  const need = xpNeed(p.level);
  $('xpFill').style.width = (p.level >= 60 ? 100 : 100 * p.xp / need) + '%';
  $('lvlText').textContent = p.level >= 60 ? 'Level 60 (max)' : `Level ${p.level} · ${p.xp} / ${need} XP`;
  $('coinText').textContent = p.coins.toLocaleString() + 'g';
  const tx = clamp(Math.floor(ecx(p) / TILE), 0, WW - 1);
  const under = ecy(p) / TILE > surf[tx] + 12;
  const arena = arenaAt(tx, Math.floor(ecy(p) / TILE));
  const mine = arena ? null : mineAt(tx, Math.floor(ecy(p) / TILE));
  $('biomeText').textContent = arena ? ARENA_NAMES[arena] : mine ? mine.mine.name : biomeAt(tx).name + (under ? ' · Underground' : '');
  if ((mine && mine.mine.name) !== lastMine) { if (mine) toast(`${mine.mine.name}. Climb the ladder with jump, and down with ${keyLabel(keyBinds.down[0])}.`, 'blue'); lastMine = mine && mine.mine.name; }
  if (arena !== lastArena) {
    if (arena && !G.bossesDone[arena]) toast(`You enter ${ARENA_NAMES[arena]}. ${BOSSES[arena].name.split(',')[0]} lairs here. Use the altar to call it out.`, 'red');
    lastArena = arena;
  }
  const night = isNight();
  $('timeText').textContent = night ? 'Night' : 'Day';
  // Arcane Burst cooldown, shown while holding a wand
  const s = hotbar[sel], it = s ? ITEMS[s.id] : null, el = $('spellCd');
  if (it && it.wt === 'wand') {
    const w = burstWait();
    el.hidden = false;
    el.textContent = w > 0 ? `Arcane Burst: ${w.toFixed(1)}s` : 'Arcane Burst ready · right click or X';
    el.classList.toggle('ready', w <= 0);
  } else el.hidden = true;
}
function showBossBar(e) { $('bossBar').hidden = false; $('bossName').textContent = e.name; updateBossBar(e); }
function updateBossBar(e) { $('bossFill').style.width = (100 * Math.max(0, e.hp) / e.maxHp) + '%'; }
function hideBossBar() { $('bossBar').hidden = true; }

let toastQ = [];
function toast(msg, kind) {
  const box = $('toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + (kind || '');
  el.textContent = msg; box.appendChild(el);
  while (box.children.length > 5) box.removeChild(box.firstChild);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3800);
}
function showBanner(title, sub) {
  const b = $('banner');
  $('bannerTitle').textContent = title; $('bannerSub').textContent = sub;
  b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(showBanner.t); showBanner.t = setTimeout(() => { b.hidden = true; }, 4500);
}
let respawnChoice = ['way', 'village'];
function showDeath(lost) {
  $('death').hidden = false;
  $('deathSub').textContent = lost > 0 ? `You dropped ${lost} gold.` : '';
  const way = G.lastWay === 60 ? 'Greenhollow Village' : biomeAt(G.lastWay).name;
  // first button: your spawn point if you set one, otherwise the last waystone; second: the other choice
  respawnChoice = G.home ? ['home', 'way'] : ['way', 'village'];
  $('btnRespawn').textContent = G.home ? 'Respawn at your spawn point' : `Respawn at ${way}`;
  $('btnRespawnVillage').textContent = G.home ? `Respawn at ${way}` : 'Respawn in the village';
  $('btnRespawnVillage').hidden = !G.home && G.lastWay === 60;
  $('btnRespawn').disabled = true; $('btnRespawnVillage').disabled = true;
}
function updateDeathTimer(t) {
  const ready = t <= 0;
  if ($('btnRespawn').disabled === ready) { $('btnRespawn').disabled = !ready; $('btnRespawnVillage').disabled = !ready; if (ready) $('btnRespawn').focus(); }
}
function hideDeath() { $('death').hidden = true; }
function showVictory() {
  const mins = Math.floor(G.play / 60), h = Math.floor(mins / 60), m = mins % 60;
  const kills = Object.values(G.kills).reduce((a, b) => a + b, 0);
  openDialog({speaker:'Princess Elowen', title:'Victory!',
    text:`<p>"You came for me. Through goblins and witches and ogres and the dead themselves, you came. Let's go home, Sir Knight."</p>
      <p class="dlg-obj">Time played: ${h}h ${m}m · Enemies defeated: ${kills} · Level ${player.level} · Deaths: ${G.deaths}</p>
      <p>The world stays open. Keep exploring, hunting rare weapons and finishing side tasks.</p>`,
    buttons:[{label:'Keep exploring', fn:closeDialog}]});
  showBanner('PRINCESS RESCUED', 'Dragonhold is free.');
}

// ===== Map =====
function openMap() {
  if (openPanel === 'mapPanel') { closePanels(); return; }
  setPanel('mapPanel');
  drawBigMap();
}
function drawBigMap() {
  const c = $('bigMap'), g = c.getContext('2d');
  const W = Math.min(window.innerWidth - 60, 1400);
  const sc = W / WW;
  c.width = W; c.height = Math.round(WH * sc);
  g.imageSmoothingEnabled = false;
  g.drawImage(mapCanvas, 0, 0, c.width, c.height);
  g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
  for (const b of BIOMES) { g.fillStyle = 'rgba(0,0,0,0.55)'; const x = (b.x0 + b.x1) / 2 * sc; const w = g.measureText(b.name).width + 8; g.fillRect(x - w / 2, 4, w, 16); g.fillStyle = '#fff'; g.fillText(b.name, x, 16); }
  if (BARRIERS_ON) for (const b of BARRIERS) if (!G.bossesDone[b.boss]) { g.fillStyle = 'rgba(192,75,255,0.7)'; g.fillRect(b.x * sc - 1, 0, 3, c.height); }
  for (const k in BOSSES) { const b = BOSSES[k]; const x = b.x * sc, y = (k === 'gold_dragon' ? CASTLE.floor - 4 : surf[b.x] - 1) * sc; g.fillStyle = G.bossesDone[k] ? '#888' : '#ff4a4a'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  // trader villages: little roofs with the village name
  g.font = '10px system-ui, sans-serif';
  for (const t of [{x:70, name:'Greenhollow'}, ...TOWNS]) {
    const x = t.x * sc, y = (tops[t.x] - 3) * sc;
    g.fillStyle = '#f0e0b8'; g.strokeStyle = '#000'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x + 4, y); g.lineTo(x + 4, y + 4); g.lineTo(x - 4, y + 4); g.lineTo(x - 4, y); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeText(t.name, x, y - 8); g.fillStyle = '#f0e0b8'; g.fillText(t.name, x, y - 8);
  }
  // mine shafts: a brown line down from the surface with a little roof
  for (const s of MINE_SITES) {
    const x = s.x * sc, y = (surf[s.x] - 2) * sc;
    g.strokeStyle = '#c08850'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, (surf[s.x] + MINE_DEPTH) * sc); g.stroke();
    g.fillStyle = '#c08850'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x, y - 5); g.lineTo(x + 5, y); g.closePath(); g.fill(); g.stroke();
  }
  // mini-bosses: orange diamond when waiting for you, grey while resting
  for (const m of MINIBOSSES) {
    const last = G.minis[m.id], resting = last != null && G.play >= last && G.play - last < MINIBOSS_RESPAWN;
    const x = m.x * sc, y = ((m.castle ? CASTLE.floor : tops[m.x]) - 2) * sc;
    g.fillStyle = resting ? '#777' : '#ff9a3a'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 4, y); g.lineTo(x, y + 4); g.lineTo(x - 4, y); g.closePath(); g.fill();
  }
  for (const w of WAYSTONES) { g.fillStyle = G.ways.includes(w) ? '#5fd0ff' : '#335'; g.fillRect(w * sc - 3, (tops[w] - 2) * sc - 3, 6, 6); }
  if (G.home) { const hx = (G.home.x + 6) / TILE * sc, hy = (G.home.y + 14) / TILE * sc; g.fillStyle = '#ffd45a'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx - 5, hy); g.lineTo(hx, hy - 6); g.lineTo(hx + 5, hy); g.lineTo(hx + 4, hy); g.lineTo(hx + 4, hy + 5); g.lineTo(hx - 4, hy + 5); g.lineTo(hx - 4, hy); g.closePath(); g.fill(); g.stroke(); }
  const px = ecx(player) / TILE * sc, py = ecy(player) / TILE * sc;
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill(); g.stroke();
}
let miniT = 0;
function drawMinimap(dt) {
  miniT -= dt; if (miniT > 0) return; miniT = 0.2;
  const c = $('minimap'), g = c.getContext('2d');
  const tw = 110, th = 64, s = c.width / tw;
  const px = Math.floor(ecx(player) / TILE), py = Math.floor(ecy(player) / TILE);
  const x0 = clamp(px - tw / 2, 0, WW - tw), y0 = clamp(py - th / 2, 0, WH - th);
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(mapCanvas, x0, y0, tw, th, 0, 0, c.width, c.height);
  for (const e of enemies) { const ex = (ecx(e) / TILE - x0) * s, ey = (ecy(e) / TILE - y0) * s; g.fillStyle = e.ally ? '#7bd34a' : e.boss ? '#ff00ff' : '#ff4a4a'; g.fillRect(ex - 1.5, ey - 1.5, 3, 3); }
  if (NET.on) for (const pr of NET.peers.values()) { if (!pr.seen) continue; g.fillStyle = '#5fd0ff'; g.fillRect((ecx(pr) / TILE - x0) * s - 2, (ecy(pr) / TILE - y0) * s - 2, 4, 4); }
  g.fillStyle = '#fff'; g.fillRect((px - x0) * s - 2, (py - y0) * s - 2, 4, 4);
}

// ===== Saving =====
const SAVE_KEY = 'dragonhold_save_v1';
function saveData() {
  const p = player;
  const g = Object.assign({}, G); delete g.boss;
  return {v:1, ww:WW, seed:worldSeed, mods:[...mods], G:g, p:{x:p.x, y:p.y, level:p.level, xp:p.xp, hp:p.hp, mana:p.mana, coins:p.coins, armorId:p.armorId, heroClass:p.heroClass || startWeapon || 'sword'}, hotbar, inv:inv, sel};
}
function saveGame(silent) {
  if (NET.on && !NET.host) return saveCoopChar(silent);
  try {
    if (held) { addItem(held.id, held.n, held.rare, true); held = null; updateHeld(); }
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData()));
    if (!silent) toast('Game saved.', 'blue');
    return true;
  } catch (err) {
    if (!silent) toast('This browser blocked saving. Use Export save in the menu to keep your progress.', 'red');
    return false;
  }
}
function loadSaveRaw() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function hasSave() { return !!loadSaveRaw(); }
