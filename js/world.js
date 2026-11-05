'use strict';
// ===== World state =====
let world = null;          // Uint8Array tiles
let surf = null;           // generated surface height per column
let tops = null;           // current topmost solid tile per column
let worldSeed = 0;
let mods = new Map();      // tile index -> tile id (player changes, for saving)
let mapCanvas = null, mapCtx = null;

// ===== Random & noise =====
function rngMaker(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, y, s, oct) {
  let t = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { t += noise2(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2; }
  return t / n;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// ===== Tile access =====
function biomeIndexAt(tx) {
  for (let i = 0; i < BIOMES.length; i++) if (tx < BIOMES[i].x1) return i;
  return BIOMES.length - 1;
}
function biomeAt(tx) { return BIOMES[biomeIndexAt(tx)]; }
function getT(x, y) {
  if (x < 0 || x >= WW || y >= WH) return T.BEDROCK;
  if (y < 0) return T.AIR;
  return world[y * WW + x];
}
function isSolid(x, y) {
  if (x < 0 || x >= WW || y >= WH) return true;
  if (y < 0) return false;
  return TP[world[y * WW + x]].solid;
}
function updateTop(x) {
  for (let y = 0; y < WH; y++) if (TP[world[y * WW + x]].solid) { tops[x] = y; return; }
  tops[x] = WH;
}
function setT(x, y, t, record = true) {
  if (x < 0 || x >= WW || y < 0 || y >= WH) return;
  const i = y * WW + x;
  world[i] = t;
  if (record) { mods.set(i, t); if (typeof netTile === 'function') netTile(x, y, t); }
  updateTop(x);
  mapPixel(x, y);
}
function inCastle(x, y) { return x > CASTLE.x0 && x < CASTLE.x1 && y > CASTLE.top && y < CASTLE.floor; }

// ===== Generation =====
function paramsAt(x) {
  const bw = 26;
  for (let i = 0; i < BIOMES.length - 1; i++) {
    const bx = BIOMES[i].x1;
    if (Math.abs(x - bx) < bw) {
      const t = (x - bx + bw) / (2 * bw), s = t * t * (3 - 2 * t);
      return {base: lerp(BIOMES[i].base, BIOMES[i + 1].base, s), amp: lerp(BIOMES[i].amp, BIOMES[i + 1].amp, s)};
    }
  }
  const b = biomeAt(x);
  return {base: b.base, amp: b.amp};
}
function flatten(h, x0, x1, level, edge = 8) {
  for (let x = x0 - edge; x <= x1 + edge; x++) {
    if (x < 0 || x >= WW) continue;
    let t = 1;
    if (x < x0) t = 1 - (x0 - x) / edge;
    else if (x > x1) t = 1 - (x - x1) / edge;
    h[x] = Math.round(lerp(h[x], level, t));
  }
}
// Where each mine shaft goes: the open spot nearest the middle of its biome, well away from
// villages, boss arenas, mini-boss spots, waystones and the rune-seal corridors.
let MINE_SITES = [];
function pickMineSites() {
  MINE_SITES = [];
  for (const m of MINES) {
    const b = BIOMES.find(bb => bb.id === m.biome); if (!b) continue;
    const mid = Math.round((b.x0 + b.x1) / 2);
    const clear = x => x > b.x0 + 15 && x < b.x1 - 15
      && !TOWNS.some(t => Math.abs(t.x - x) < TOWN_HALF + 16)
      && !Object.values(BOSSES).some(bs => Math.abs(bs.x - x) < 40)
      && !MINIBOSSES.some(mb => Math.abs(mb.x - x) < 18)
      && !WAYSTONES.some(w => Math.abs(w - x) < 12)
      && !BARRIERS.some(br => Math.abs(br.x - x) < 10);
    for (let d = 0; d < (b.x1 - b.x0) / 2; d++) {
      const x = clear(mid + d) ? mid + d : clear(mid - d) ? mid - d : null;
      if (x != null) { MINE_SITES.push({x, mine:m}); break; }
    }
  }
}
function mineAt(tx, ty) {
  for (const s of MINE_SITES) if (Math.abs(tx - s.x) <= 7 && ty > surf[s.x] - 12 && ty < surf[s.x] + MINE_DEPTH + 4) return s;
  return null;
}
function reservedForStructure(x) {
  if (x >= 15 && x <= 125) return true;
  for (const s of MINE_SITES) if (Math.abs(x - s.x) <= 8) return true;
  for (const t of TOWNS) if (Math.abs(x - t.x) <= TOWN_HALF + 2) return true;
  for (const w of WAYSTONES) if (Math.abs(x - w) <= 4) return true;
  for (const k in BOSSES) if (Math.abs(x - BOSSES[k].x) <= 24) return true;
  for (const b of BARRIERS) if (Math.abs(x - b.x) <= 3) return true;
  if (x >= MX(1995)) return true;
  return false;
}

function generateWorld(seed) {
  worldSeed = seed;
  const rnd = rngMaker(seed);
  world = new Uint8Array(WW * WH);
  surf = new Int16Array(WW);
  tops = new Int16Array(WW);
  const h = new Float32Array(WW);

  // heights
  for (let x = 0; x < WW; x++) {
    const p = paramsAt(x);
    const n1 = fbm2(x * 0.018, 0.5, seed + 3, 4) - 0.5;
    const n2 = noise2(x * 0.09, 7.3, seed + 5) - 0.5;
    h[x] = p.base + n1 * 2 * p.amp + n2 * (p.amp * 0.25 + 1);
  }
  flatten(h, 20, 120, Math.round(h[70]));
  for (const k in BOSSES) {
    const b = BOSSES[k];
    if (k === 'gold_dragon') continue;
    flatten(h, b.x - 22, b.x + 22, Math.round(h[b.x]));
  }
  for (const t of TOWNS) flatten(h, t.x - TOWN_HALF, t.x + TOWN_HALF, Math.round(h[t.x]), 12);
  pickMineSites();
  for (const s of MINE_SITES) flatten(h, s.x - 6, s.x + 6, Math.round(h[s.x]), 8);
  flatten(h, MX(1996), WW - 1, CASTLE.floor, 10);
  for (let x = 0; x < WW; x++) surf[x] = clamp(Math.round(h[x]), 12, 110);

  // base terrain
  for (let x = 0; x < WW; x++) {
    const bi = biomeIndexAt(x), b = BIOMES[bi];
    const hs = surf[x];
    const dirtDepth = 4 + Math.floor(noise2(x * 0.1, 3, seed + 9) * 7);
    for (let y = hs; y < WH; y++) {
      let t;
      if (y >= WH - 3 - Math.floor(hash2(x, y, seed) * 2)) t = T.BEDROCK;
      else if (y === hs) {
        if (b.id === 'mountains') t = hs < 46 ? T.SNOW : T.STONE;
        else t = b.surf;
      } else if (y < hs + dirtDepth) {
        if (b.id === 'mountains') t = (hs < 46 && y < hs + 2) ? T.SNOW : T.STONE;
        else t = b.sub;
      } else t = T.STONE;
      world[y * WW + x] = t;
    }
  }

  // caves
  for (let x = 0; x < WW; x++) {
    const hs = surf[x];
    const safe = 20; // caves stay well below the surface, so none break through as holes
    for (let y = hs + safe; y < WH - 4; y++) {
      const n = fbm2(x * 0.042, y * 0.068, seed + 11, 3);
      const thr = 0.635 - Math.min(0.07, (y - hs) * 0.0006);
      if (n > thr) world[y * WW + x] = T.AIR;
    }
  }
  // tunnels from the surface
  for (let i = 0; i < 0; i++) { // no random surface tunnels any more: the mine shafts are the way down
    let x = 140 + rnd() * (WW - 360), y = surf[Math.floor(x)];
    if (reservedForStructure(Math.floor(x))) continue;
    let dir = rnd() < 0.5 ? -1 : 1, ang = Math.PI / 2 - dir * (0.5 + rnd() * 0.4);
    const len = 50 + rnd() * 90;
    for (let s = 0; s < len; s++) {
      ang += (rnd() - 0.5) * 0.35;
      ang = clamp(ang, 0.25, Math.PI - 0.25);
      x += Math.cos(ang); y += Math.sin(ang) * 0.9;
      const r = 1.6 + rnd() * 0.8;
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        if (dx * dx + dy * dy > r * r) continue;
        const tx = Math.floor(x + dx), ty = Math.floor(y + dy);
        if (tx > 0 && tx < WW - 1 && ty > 2 && ty < WH - 5) world[ty * WW + tx] = T.AIR;
      }
    }
  }

  // ore veins
  const veins = Math.floor(WW * WH / 85);
  for (let i = 0; i < veins; i++) {
    let x = Math.floor(rnd() * WW), y = Math.floor(rnd() * WH);
    if (world[y * WW + x] !== T.STONE) continue;
    const depth = y - surf[x], bi = biomeIndexAt(x), r = rnd();
    let ore;
    if (r < 0.38) ore = T.COAL;
    else if (r < 0.68) ore = depth > 6 ? T.IRON : T.COAL;
    else if (r < 0.82) ore = depth > 22 ? T.GOLD : T.IRON;
    else if (r < 0.93) ore = (bi >= 4 && depth > 28) ? T.MYTHRIL : T.IRON;
    else ore = bi >= 6 ? T.OBSIDIAN : T.COAL;
    if (bi >= 6 && rnd() < 0.3) ore = T.OBSIDIAN;
    const size = 3 + Math.floor(rnd() * 7);
    for (let s = 0; s < size; s++) {
      if (x > 0 && x < WW - 1 && y > 0 && y < WH - 4 && world[y * WW + x] === T.STONE) world[y * WW + x] = ore;
      x += Math.floor(rnd() * 3) - 1; y += Math.floor(rnd() * 3) - 1;
    }
  }

  // swamp water and volcano lava pools on the surface
  for (let x = 0; x < WW; x++) {
    const b = biomeAt(x);
    if (reservedForStructure(x)) continue;
    if ((b.id === 'swamp' && x % 41 === 7) || (b.id === 'volcano' && x % 53 === 11)) {
      const w = 5 + Math.floor(rnd() * 5), d = 2 + Math.floor(rnd() * 2);
      const liquid = b.id === 'swamp' ? T.WATER : T.LAVA;
      const base = surf[x];
      for (let px = x; px < Math.min(WW - 1, x + w); px++) {
        if (reservedForStructure(px)) break;
        for (let y = Math.min(surf[px], base); y < base; y++) world[y * WW + px] = T.AIR;
        for (let y = base; y < base + d; y++) world[y * WW + px] = liquid;
        world[(base + d) * WW + px] = b.id === 'swamp' ? T.MUD : T.OBSIDIAN;
        // where the ground was lower than the pool, fill under it so there's no air gap
        for (let y = base + d + 1; y <= surf[px] + 1 && y < WH - 4; y++) if (!TP[world[y * WW + px]].solid) world[y * WW + px] = b.id === 'swamp' ? T.MUD : T.ASH;
        surf[px] = base;
      }
      // raise any lower ground right beside the pool to its rim, so no pit opens up next to it
      const soil = b.id === 'swamp' ? T.SWAMPGRASS : T.ASH;
      for (const qx of [x - 2, x - 1, x + w, x + w + 1, x + w + 2]) {
        if (qx <= 0 || qx >= WW - 1 || reservedForStructure(qx) || surf[qx] <= base) continue;
        for (let y = base; y < surf[qx]; y++) world[y * WW + qx] = y === base ? soil : (b.id === 'swamp' ? T.MUD : T.ASH);
        surf[qx] = base;
      }
    }
  }
  // underground lava in the volcano
  for (let x = MX(1750); x < WW; x++) {
    for (let y = WH - 6; y > surf[x] + 40; y--) {
      const i = y * WW + x;
      if (world[i] === T.AIR && TP[world[i + WW]].solid && noise2(x * 0.15, y * 0.15, seed + 21) > 0.45) world[i] = T.LAVA;
    }
  }

  // trees
  let lastTree = -10;
  for (let x = 2; x < WW - 2; x++) {
    const b = biomeAt(x);
    if (b.tree <= 0 || reservedForStructure(x) || x - lastTree < 4 || rnd() > b.tree) continue;
    const hs = surf[x], st = world[hs * WW + x];
    if (!(st === T.GRASS || st === T.DARKGRASS || st === T.SWAMPGRASS)) continue;
    if (world[(hs - 1) * WW + x] !== T.AIR) continue;
    const th = 5 + Math.floor(rnd() * 5) + (b.id === 'darkforest' ? 2 : 0);
    for (let k = 1; k <= th; k++) world[(hs - k) * WW + x] = T.LOG;
    const cy = hs - th, rad = b.id === 'darkforest' ? 3 : 2;
    for (let dy = -rad - 1; dy <= rad; dy++) for (let dx = -rad - 1; dx <= rad + 1; dx++) {
      if ((dx * dx) / ((rad + 1.2) * (rad + 1.2)) + (dy * dy) / ((rad + 0.6) * (rad + 0.6)) > 1) continue;
      const tx = x + dx, ty = cy + dy;
      if (ty > 0 && world[ty * WW + tx] === T.AIR) world[ty * WW + tx] = b.leaves;
    }
    lastTree = x;
  }

  // ruins: broken walls
  for (let x = MX(1505); x < MX(1745); x += 9 + Math.floor(rnd() * 12)) {
    if (reservedForStructure(x)) continue;
    const hs = surf[x], hgt = 3 + Math.floor(rnd() * 7), wide = rnd() < 0.5 ? 2 : 1;
    for (let k = 1; k <= hgt; k++) for (let w = 0; w < wide; w++) if (rnd() > 0.12) world[(hs - k) * WW + x + w] = T.BRICK;
    if (rnd() < 0.4) {
      const span = 4 + Math.floor(rnd() * 3);
      for (let w = 0; w <= span; w++) { world[(hs - hgt) * WW + x + w] = T.BRICK; }
      for (let k = 1; k <= hgt; k++) world[(hs - k) * WW + x + span] = T.BRICK;
    }
  }
  // crypt under the ruins: a stairway down and a long corridor
  const cryptY = 126;
  for (let x = MX(1520); x < MX(1745); x++) {
    for (let y = cryptY - 4; y <= cryptY + 2; y++) {
      const edge = (y === cryptY - 4 || y === cryptY + 2);
      world[y * WW + x] = edge ? T.BRICK : T.AIR;
    }
  }
  // (no stairway from the surface any more: the crypt is reached through The Forgotten Well mine shaft)
  for (let x = MX(1520) + 10; x < MX(1745); x += 14) world[(cryptY - 3) * WW + x] = T.TORCH;

  // herbs
  for (let x = 2; x < WW - 2; x++) {
    const b = biomeAt(x);
    if (!b.herbs.length || reservedForStructure(x) || rnd() > 0.07) continue;
    const hs = surf[x];
    if (world[(hs - 1) * WW + x] !== T.AIR || !TP[world[hs * WW + x]].solid) continue;
    world[(hs - 1) * WW + x] = b.herbs[Math.floor(rnd() * b.herbs.length)];
  }

  // chests in caves
  let placed = 0;
  for (let a = 0; a < 30000 && placed < Math.round(170 * WW / OLD_WW); a++) {
    const x = 140 + Math.floor(rnd() * (WW - 150)), y = Math.floor(rnd() * WH);
    if (y < surf[x] + 10 || y > WH - 6) continue;
    if (world[y * WW + x] === T.AIR && world[(y - 1) * WW + x] === T.AIR && TP[world[(y + 1) * WW + x]].solid) {
      world[y * WW + x] = T.CHEST; placed++;
    }
  }
  for (let x = MX(1520) + 20; x < MX(1745) - 5; x += 33) world[(cryptY + 1) * WW + x] = T.CHEST;

  // village: open-front stalls
  const vh = surf[70];
  for (let x = 15; x <= 125; x++) {
    for (let y = 0; y < vh; y++) if (world[y * WW + x] !== T.AIR) world[y * WW + x] = T.AIR;
    world[vh * WW + x] = T.GRASS;
  }
  // (no buildings at the start: the villagers stand in the open meadow)
  // trader villages: cleared ground and a market stall per trader
  for (const t of TOWNS) {
    const th = surf[t.x], top = BIOMES[biomeIndexAt(t.x)].surf;
    for (let x = t.x - TOWN_HALF; x <= t.x + TOWN_HALF; x++) {
      for (let y = Math.max(0, th - 14); y < th; y++) world[y * WW + x] = T.AIR;
      world[th * WW + x] = TP[top] && TP[top].solid ? top : T.GRASS;
      for (let y = th + 1; y <= th + 3; y++) if (!TP[world[y * WW + x]].solid || TP[world[y * WW + x]].liquid) world[y * WW + x] = T.DIRT;
    }
    t.traders.forEach((tr, i) => {
      const cx = t.x + (i === 0 ? -11 : 11);
      for (let x = cx - 4; x <= cx + 4; x++) world[(th - 6) * WW + x] = T.WOOD;
      for (let y = th - 5; y <= th - 1; y++) { world[y * WW + cx - 4] = T.WOOD; world[y * WW + cx + 4] = T.WOOD; }
      for (let y = th - 3; y <= th - 1; y++) { world[y * WW + cx - 4] = T.AIR; world[y * WW + cx + 4] = T.AIR; } // open sides you can walk through
      world[(th - 5) * WW + cx] = T.TORCH;
    });
    stairEdges(t.x, TOWN_HALF, th);
  }
  // waystones
  for (const wx of WAYSTONES) {
    const hs = surf[wx];
    for (let y = hs - 8; y < hs; y++) for (let x = wx - 2; x <= wx + 2; x++) if (y >= 0) world[y * WW + x] = T.AIR;
    for (let x = wx - 2; x <= wx + 2; x++) if (!TP[world[hs * WW + x]].solid) world[hs * WW + x] = T.STONE;
    world[(hs - 1) * WW + wx] = T.WAYSTONE;
  }
  // boss altars
  for (const k in BOSSES) {
    if (k === 'gold_dragon') continue;
    const b = BOSSES[k], hs = surf[b.x];
    for (let x = b.x - 24; x <= b.x + 24; x++) for (let y = hs - 20; y < hs; y++) world[y * WW + x] = T.AIR;
    for (let x = b.x - 2; x <= b.x + 2; x++) world[hs * WW + x] = T.BRICK;
    world[(hs - 1) * WW + b.x] = T.ALTAR;
    buildArena(k, b.x, hs);
    stairEdges(b.x, 22, hs);
  }
  // barriers: clear a corridor so the wall is visible
  if (BARRIERS_ON) for (const b of BARRIERS) {
    const hs = surf[b.x];
    for (let x = b.x - 3; x <= b.x + 3; x++) for (let y = hs - 12; y < hs; y++) if (y >= 0 && world[y * WW + x] !== T.WAYSTONE) world[y * WW + x] = T.AIR;
  }

  buildCastle();
  for (const s of MINE_SITES) buildMineShaft(s.x, s.mine, rnd);

  // finalize
  for (let x = 0; x < WW; x++) updateTop(x);
}

// ===== Boss arenas: each boss gets its own themed lair around its altar =====
// Everything tall is either non-solid (log posts, leaves, torches) or hangs above head height
// (platforms you can jump onto to dodge), so you can always walk in from both sides.
function buildArena(k, cx, hs) {
  const put = (x, y, t) => { if (x > 0 && x < WW - 1 && y > 0 && y < WH - 3) world[y * WW + x] = t; };
  const floor = (t, half = 22) => { for (let x = cx - half; x <= cx + half; x++) if (Math.abs(x - cx) > 2) put(x, hs, t); };
  const post = (x, h, top) => { for (let y = hs - h; y < hs; y++) put(x, y, T.LOG); if (top) put(x, hs - h - 1, top); };
  const plat = (x0, x1, y, t) => { for (let x = x0; x <= x1; x++) put(x, y, t); };
  const canopy = (x, y, r, t) => { for (let dy = -r; dy <= 0; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) if (dx * dx / ((r + 1.2) ** 2) + dy * dy / ((r + 0.5) ** 2) <= 1) put(x + dx, y + dy, t); };
  const rim = (t) => { put(cx - 21, hs - 1, t); put(cx + 21, hs - 1, t); }; // knee-high edge you step over
  switch (k) {
    case 'goblin_king': // Grukk's War Camp: plank floor, crude huts on poles, lookout platforms
      floor(T.WOOD); rim(T.WOOD);
      for (const s of [-1, 1]) {
        for (const off of [12, 19]) { post(cx + s * off, 7, T.TORCH); canopy(cx + s * off, hs - 8, 1, T.LEAVES); }
        plat(cx + s * 7 - 2, cx + s * 7 + 2, hs - 5, T.WOOD);
      }
      break;
    case 'orc_warchief': // Ironjaw's Warcamp: stone yard ringed by a spiked log palisade
      floor(T.STONE); rim(T.BRICK);
      for (const s of [-1, 1]) {
        for (let o = 17; o <= 24; o += 2) post(cx + s * o, 4 + (o % 4 === 1 ? 1 : 0));
        post(cx + s * 10, 6, T.TORCH);
        plat(cx + s * 8 - 2, cx + s * 8 + 2, hs - 5, T.WOOD);
      }
      break;
    case 'witch_queen': // Morwenna's Hex Grove: muddy clearing, dead trees, a ring of candle-torches
      floor(T.MUD); rim(T.SWAMPGRASS);
      for (const s of [-1, 1]) {
        for (const off of [11, 20]) { post(cx + s * off, 8); canopy(cx + s * off, hs - 9, 2, T.DARKLEAVES); }
        for (let o = 4; o <= 18; o += 4) put(cx + s * o, hs - 1, T.TORCH);
        plat(cx + s * 15 - 1, cx + s * 15 + 1, hs - 5, T.MUD);
      }
      break;
    case 'bloodmoon_alpha': // Fenris's Moon Circle: a ring of standing stones with lintels on top
      floor(T.DARKGRASS); rim(T.STONE);
      for (const s of [-1, 1]) for (const off of [8, 15]) {
        post(cx + s * off - 1, 6); post(cx + s * off + 1, 6);
        plat(cx + s * off - 2, cx + s * off + 2, hs - 7, T.STONE);
        put(cx + s * off, hs - 8, T.TORCH);
      }
      break;
    case 'ogre_warlord': // Brogg's Crater: cracked stone bowl with boulder ledges
      floor(T.STONE); rim(T.STONE);
      for (const s of [-1, 1]) {
        put(cx + s * 17, hs - 1, T.STONE); put(cx + s * 18, hs - 1, T.STONE);
        plat(cx + s * 9 - 2, cx + s * 9 + 2, hs - 5, T.STONE); plat(cx + s * 16 - 1, cx + s * 16 + 1, hs - 9, T.STONE);
        post(cx + s * 20, 7, T.TORCH);
      }
      break;
    case 'archlich': // Vaelith's Sanctum: a brick temple with open doorways and a broken roof
      floor(T.BRICK); rim(T.BRICK);
      for (const s of [-1, 1]) {
        for (let y = hs - 12; y <= hs - 5; y++) put(cx + s * 18, y, T.BRICK); // walls stop above the doorway
        put(cx + s * 10, hs - 7, T.TORCH);
        plat(cx + s * 8 - 2, cx + s * 8 + 2, hs - 6, T.BRICK);
      }
      for (let x = cx - 18; x <= cx + 18; x++) if (x % 3 !== 0) put(x, hs - 13, T.BRICK);
      break;
    case 'magma_wyrm': // Pyraxis's Caldera: obsidian floor, burning braziers, black spires
      floor(T.OBSIDIAN); rim(T.OBSIDIAN);
      for (const s of [-1, 1]) {
        for (const o of [12, 20]) put(cx + s * o, hs - 1, T.TORCH);
        plat(cx + s * 9 - 2, cx + s * 9 + 2, hs - 6, T.OBSIDIAN);
        for (let y = hs - 12; y <= hs - 7; y++) put(cx + s * 16, y, T.OBSIDIAN);
        put(cx + s * 16, hs - 13, T.TORCH); put(cx + s * 5, hs - 1, T.TORCH);
      }
      break;
  }
}
// ===== Mine shaft =====
// A 3-wide ladder shaft lined with planks, side galleries with torches every so often, and an
// ore-rich chamber with a treasure chest at the bottom. On top: a timber headframe in the biome's style.
function buildMineShaft(x, m, rnd) {
  const put = (px, py, t) => { if (px > 0 && px < WW - 1 && py > 0 && py < WH - 3) world[py * WW + px] = t; };
  const hs = surf[x], bottom = Math.min(WH - 12, hs + MINE_DEPTH);
  // entrance yard
  for (let px = x - 6; px <= x + 6; px++) { for (let py = hs - 14; py < hs; py++) put(px, py, T.AIR); put(px, hs, m.beam); put(px, hs + 1, T.STONE); }
  // the shaft itself
  for (let py = hs; py <= bottom; py++) {
    for (let px = x - 1; px <= x + 1; px++) put(px, py, T.LADDER);
    // plank lining, but left open wherever the shaft passes through a cave or the crypt, so they connect
    for (const s of [-1, 1]) if (py <= hs + 2 || TP[world[py * WW + x + s * 2]].solid) put(x + s * 2, py, T.WOOD);
  }
  // side galleries: short tunnels off the shaft, alternating sides, with a torch at the end
  for (let gy = hs + 26; gy < bottom - 6; gy += 22) {
    const s = ((gy - hs) / 22) % 2 ? 1 : -1, len = 9 + Math.floor(rnd() * 8);
    for (let k = 2; k <= len; k++) { for (let py = gy - 3; py <= gy; py++) put(x + s * k, py, T.AIR); put(x + s * k, gy + 1, T.WOOD); }
    put(x + s * len, gy - 2, T.TORCH);
    if (rnd() < 0.5) put(x + s * (len - 1), gy, T.CHEST);
  }
  for (let py = hs + 12; py < bottom - 4; py += 12) put(x + (py % 24 ? 3 : -3), py, T.TORCH);
  // the chamber at the bottom
  for (let px = x - 11; px <= x + 11; px++) {
    for (let py = bottom - 6; py <= bottom; py++) if (Math.abs(px - x) > 1) put(px, py, T.AIR);
    put(px, bottom + 1, T.WOOD);
  }
  for (let px = x - 13; px <= x + 13; px++) for (let py = bottom - 9; py <= bottom + 3; py++) {
    const edge = Math.abs(px - x) >= 12 || py <= bottom - 7 || py >= bottom + 2;
    if (edge && world[py * WW + px] === T.STONE && rnd() < 0.55) put(px, py, m.ore);
  }
  put(x + 8, bottom, T.CHEST); put(x - 8, bottom, T.CHEST);
  put(x - 5, bottom - 4, T.TORCH); put(x + 5, bottom - 4, T.TORCH);
  // headframe: log legs, a beam and a roof over the shaft, lanterns either side
  for (const s of [-1, 1]) { for (let py = hs - 7; py < hs; py++) put(x + s * 4, py, T.LOG); put(x + s * 5, hs - 1, T.TORCH); }
  for (let px = x - 5; px <= x + 5; px++) put(px, hs - 8, m.beam);
  for (let px = x - 4; px <= x + 4; px++) put(px, hs - 9, m.roof);
  for (let px = x - 2; px <= x + 2; px++) put(px, hs - 10, m.roof);
  put(x, hs - 11, m.roof);
  put(x, hs - 7, T.TORCH); // a lantern hanging over the ladder
  stairEdges(x, 6, hs);
}

// Make the ground just outside a flat area (arena, village) climbable: no step bigger than one block,
// by filling in drops with dirt and cutting down walls, working outward from the edge.
function stairEdges(cx, half, level) {
  const firstSolid = x => { for (let y = Math.max(1, level - 30); y < WH - 4; y++) if (TP[world[y * WW + x]].solid) return y; return WH - 4; };
  for (const s of [-1, 1]) {
    let lvl = level;
    for (let o = half + 1; o <= half + 18; o++) {
      const x = cx + s * o;
      if (x <= 1 || x >= WW - 2) break;
      const g = firstSolid(x);
      if (Math.abs(g - lvl) <= 1) { lvl = g; continue; }
      if (g > lvl + 1) { for (let y = lvl + 1; y < g; y++) world[y * WW + x] = T.DIRT; lvl = lvl + 1; } // drop: build a step down
      else { for (let y = g; y < lvl - 1; y++) world[y * WW + x] = T.AIR; lvl = lvl - 1; }              // wall: cut a step up
    }
  }
}
function buildCastle() {
  const C = CASTLE, fl = C.floor, top = C.top;
  for (let x = MX(1996); x < WW; x++) {
    for (let y = 0; y < fl; y++) world[y * WW + x] = T.AIR;
    if (!TP[world[fl * WW + x]].solid) world[fl * WW + x] = T.ASH;
  }
  for (let x = C.x0; x <= C.x1; x++) {
    for (let y = top; y < fl; y++) {
      const wall = x <= C.x0 + 1 || x >= C.x1 - 1 || y <= top + 1;
      world[y * WW + x] = wall ? T.CASTLE : T.AIR;
    }
    for (let y = fl; y <= fl + 2; y++) world[y * WW + x] = T.CASTLE;
    if (x % 2 === 0) world[(top - 1) * WW + x] = T.CASTLE;
  }
  // gate
  for (let y = fl - 7; y < fl; y++) for (let x = C.x0; x <= C.x0 + 1; x++) world[y * WW + x] = T.AIR;
  // towers
  const tower = (x0, x1) => {
    for (let x = x0; x <= x1; x++) {
      for (let y = top - 12; y < top; y++) world[y * WW + x] = T.CASTLE;
      if (x % 2 === 1) world[(top - 13) * WW + x] = T.CASTLE;
    }
  };
  tower(C.x0 - 3, C.x0 + 5);
  tower(C.x1 - 5, C.x1 + 3 < WW ? C.x1 + 3 : WW - 1);
  // inner ledges so the player can climb
  for (let i = 0; i < 6; i++) {
    const lx = C.x0 + 14 + i * 26, ly = fl - 9 - (i % 2) * 7;
    for (let x = lx; x < lx + 8; x++) world[ly * WW + x] = T.CASTLE;
  }
  // gold hoard mound with the altar on top
  for (let x = MX(2092); x <= MX(2148); x++) {
    const d = Math.abs(x - MX(2120)), hh = d < 8 ? 3 : d < 18 ? 2 : 1;
    for (let k = 1; k <= hh; k++) world[(fl - k) * WW + x] = T.HOARD;
  }
  world[(fl - 4) * WW + MX(2120)] = T.ALTAR;
  // princess cage
  for (let y = fl - 7; y < fl; y++) world[y * WW + MX(2180)] = T.BARS;
  for (let x = MX(2180); x < C.x1 - 1; x++) world[(fl - 8) * WW + x] = T.BARS;
  // torches
  for (let x = C.x0 + 6; x < C.x1 - 3; x += 12) world[(fl - 12) * WW + x] = T.TORCH;
  for (let x = C.x0 + 6; x < C.x1 - 3; x += 18) world[(top + 4) * WW + x] = T.TORCH;
}

function openPrincessCage() {
  const fl = CASTLE.floor;
  for (let y = fl - 7; y < fl; y++) if (getT(MX(2180), y) === T.BARS) setT(MX(2180), y, T.AIR);
}

function applyMods(list) {
  for (const [i, t] of list) { world[i] = t; mods.set(i, t); }
  for (let x = 0; x < WW; x++) updateTop(x);
}

// ===== Minimap =====
function tileMapColor(t, x, y) {
  if (t === T.AIR) {
    if (inCastle(x, y)) return [40, 36, 48];
    return y < surf[x] ? [156, 203, 232] : [38, 29, 24];
  }
  const p = TP[t];
  let c = p.top || p.c;
  if (p.plant) c = p.plant;
  else if (p.leaves) c = p.c;
  else if (t === T.TORCH) c = '#ffb347';
  else if (t === T.WAYSTONE) c = '#5fd0ff';
  else if (t === T.ALTAR) c = '#c04bff';
  else if (t === T.CHEST) c = '#d0a040';
  else if (t === T.CHEST_OPEN) c = '#7a5a30';
  else if (t === T.LADDER) c = '#c08850';
  else if (t === T.BARS) c = '#888';
  else if (p.station) c = '#b98a4a';
  else if (p.ore) c = p.ore;
  return hexRgb(c);
}
const _hexCache = {};
function hexRgb(h) {
  if (_hexCache[h]) return _hexCache[h];
  const n = parseInt(h.slice(1), 16);
  return (_hexCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
function buildMap() {
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = WW; mapCanvas.height = WH;
  mapCtx = mapCanvas.getContext('2d');
  const img = mapCtx.createImageData(WW, WH), d = img.data;
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const c = tileMapColor(world[y * WW + x], x, y), o = (y * WW + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  mapCtx.putImageData(img, 0, 0);
}
function mapPixel(x, y) {
  if (!mapCtx) return;
  const c = tileMapColor(world[y * WW + x], x, y);
  mapCtx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  mapCtx.fillRect(x, y, 1, 1);
}

// ===== Chest loot =====
// Every chest has gold, potions and crafting bars for its area, plus at least one prize:
// a weapon from that area (often rare), and sometimes armor, a boss weapon or a Gold Lure.
// Chests deeper underground pay out more.
function chestLoot(tx, ty) {
  const bi = biomeIndexAt(tx), b = BIOMES[bi], R = Math.random;
  const deep = ty != null && surf[tx] != null ? Math.min(1, Math.max(0, (ty - surf[tx]) / 80)) : 0;
  const rich = 1 + deep; // up to 2x for deep chests
  const loot = [];
  const roll = (a, b2) => a + Math.floor(R() * (b2 - a + 1));
  loot.push(['coins', Math.round((60 + bi * 140) * (1 + R()) * rich)]);
  const tier = Math.min(4, 1 + Math.floor(bi / 2));
  loot.push(['pot_h' + tier, roll(2, 4)]);
  loot.push(['pot_m' + tier, roll(1, 3)]);
  loot.push(['torch', roll(8, 16)]);
  const bar = bi < 2 ? 'iron_bar' : bi < 4 ? 'steel_bar' : 'mythril_bar';
  loot.push([bar, Math.round(roll(4, 8) * rich)]);
  loot.push(['gold_bar', roll(1, 3)]);
  if (bi >= 5) loot.push(['obsidian', roll(3, 6)]);
  if (bi >= 6) loot.push(['dragonscale', roll(2, 4)]);
  // the area's herbs
  if (b.herbs && b.herbs.length) { const h = TP[b.herbs[Math.floor(R() * b.herbs.length)]].drop; if (h && ITEMS[h]) loot.push([h, roll(2, 5)]); }
  // the prize: always a weapon from this area's enemies, 35% rare (50% when deep)
  // (always the version for the opener's class: Knight, Rogue or Wizard)
  const cls = typeof myClass === 'function' ? myClass() : 'sword';
  const pool = b.under.concat(b.day).filter(k => EN[k] && classDrop(k, cls));
  if (pool.length) loot.push([classDrop(pool[Math.floor(R() * pool.length)], cls), 1, R() < 0.35 + deep * 0.15]);
  // bonus prizes
  const armor = bi < 2 ? 'armor_iron' : bi < 4 ? 'armor_steel' : bi < 6 ? 'armor_mythril' : 'armor_dragon';
  if (ITEMS[armor] && R() < 0.15 + deep * 0.1) loot.push([armor, 1]);
  const bossWeapons = Object.keys(BOSSES).map(k => classDrop(k, cls)).filter(Boolean);
  if (R() < 0.06 + deep * 0.06) loot.push([bossWeapons[Math.min(bossWeapons.length - 1, Math.floor(R() * Math.min(bossWeapons.length, 2 + bi)))], 1]);
  if (bi >= 5 && R() < 0.2) loot.push(['gold_lure', 1]);
  return loot.filter(([id]) => id === 'coins' || ITEMS[id]);
}
