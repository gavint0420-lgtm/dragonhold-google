'use strict';
// ===== Tile textures =====
const tileTex = [];
const VARIANTS = 4;
function shade(hex, f) {
  const [r, g, b] = hexRgb(hex);
  const k = v => clamp(Math.round(v * f), 0, 255);
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}
function makeTileTex(id, v) {
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const g = c.getContext('2d'), p = TP[id], r = rngMaker(id * 977 + v * 131 + 7);
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (p.brick) {
    px(0, 0, 16, 16, p.c);
    g.fillStyle = p.c2;
    for (let row = 0; row < 4; row++) {
      px(0, row * 4 + 3, 16, 1, p.c2);
      const off = row % 2 ? 4 : 0;
      for (let x = off; x < 16; x += 8) px(x, row * 4, 1, 3, p.c2);
    }
    for (let i = 0; i < 6; i++) px(Math.floor(r() * 15), Math.floor(r() * 15), 1, 1, shade(p.c, 1.15));
  } else if (p.plank) {
    px(0, 0, 16, 16, p.c);
    for (let y = 3; y < 16; y += 4) px(0, y, 16, 1, p.c2);
    for (let row = 0; row < 4; row++) px(row % 2 ? 11 : 4, row * 4, 1, 3, p.c2);
    for (let i = 0; i < 5; i++) px(Math.floor(r() * 16), Math.floor(r() * 16), 2, 1, shade(p.c, 1.1));
  } else if (p.log) {
    px(3, 0, 10, 16, p.c);
    for (let i = 0; i < 6; i++) px(4 + Math.floor(r() * 8), Math.floor(r() * 14), 1, 3, p.c2);
    px(3, 0, 1, 16, p.c2); px(12, 0, 1, 16, shade(p.c, 0.7));
  } else if (p.leaves) {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = r() < 0.5 ? p.c : p.c2;
      g.beginPath(); g.arc(2 + r() * 12, 2 + r() * 12, 2.5 + r() * 2, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 5; i++) px(Math.floor(r() * 15), Math.floor(r() * 15), 1, 1, shade(p.c, 1.3));
  } else if (id === T.HOARD) {
    px(0, 0, 16, 16, p.c2);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = r() < 0.6 ? p.c : '#ffe58a';
      g.beginPath(); g.arc(r() * 16, r() * 16, 2 + r() * 1.5, 0, Math.PI * 2); g.fill();
    }
    if (r() < 0.5) { px(5, 5, 3, 3, '#d8333a'); px(6, 6, 1, 1, '#ff9a9a'); }
  } else if (p.solid) {
    px(0, 0, 16, 16, p.c);
    for (let i = 0; i < 14; i++) px(Math.floor(r() * 15), Math.floor(r() * 15), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2), p.c2);
    for (let i = 0; i < 4; i++) px(Math.floor(r() * 15), Math.floor(r() * 15), 1, 1, shade(p.c, 1.18));
    if (p.ore) {
      for (let i = 0; i < 5; i++) {
        const ox = 1 + Math.floor(r() * 12), oy = 1 + Math.floor(r() * 12), s = 2 + Math.floor(r() * 2);
        px(ox, oy, s, s, p.ore); px(ox, oy, 1, 1, shade(p.ore, 1.35));
      }
    }
    if (id === T.OBSIDIAN) { for (let i = 0; i < 3; i++) px(Math.floor(r() * 12), Math.floor(r() * 12), 4, 1, '#7a5ab8'); }
    if (p.top) {
      px(0, 0, 16, 4, p.top);
      for (let x = 0; x < 16; x++) if (r() < 0.6) px(x, 4, 1, 1 + Math.floor(r() * 2), p.top2);
      for (let x = 0; x < 16; x += 2) if (r() < 0.5) px(x, 0, 1, 1, shade(p.top, 1.2));
    }
  }
  return c;
}
const bgTex = {};
function makeBgTex(name, base, c2, brick) {
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const g = c.getContext('2d'), r = rngMaker(name.length * 99 + 3);
  g.fillStyle = base; g.fillRect(0, 0, 16, 16);
  g.fillStyle = c2;
  if (brick) {
    for (let row = 0; row < 2; row++) { g.fillRect(0, row * 8 + 7, 16, 1); g.fillRect(row % 2 ? 8 : 0, row * 8, 1, 7); }
  } else for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), 2, 2);
  bgTex[name] = c;
}
function initTextures() {
  for (let id = 0; id < TP.length; id++) {
    tileTex[id] = [];
    if (!TP[id] || id === T.AIR || TP[id].deco || TP[id].liquid) continue;
    for (let v = 0; v < VARIANTS; v++) tileTex[id].push(makeTileTex(id, v));
  }
  makeBgTex('dirt', '#3b2618', '#311f13');
  makeBgTex('stone', '#2f3036', '#27282d');
  makeBgTex('castle', '#2b2833', '#221f29', true);
  makeBgTex('ash', '#241d1e', '#1c1617');
}

// ===== Decorative tiles (drawn live, some animated) =====
function drawDeco(g, id, x, y, time) {
  const R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  switch (id) {
    case T.TORCH: {
      R(7, 7, 2, 9, '#6b4423');
      const f = Math.sin(time * 14 + x) * 0.8;
      R(6, 3 + f * 0.3, 4, 5, '#ff8a1f'); R(7, 2 + f * 0.5, 2, 4, '#ffd65a'); R(7.5, 5, 1, 2, '#fff2c0');
      break;
    }
    case T.WORKBENCH:
      R(1, 6, 14, 3, '#a8743f'); R(1, 6, 14, 1, '#c48f55'); R(2, 9, 2, 7, '#7a4e2d'); R(12, 9, 2, 7, '#7a4e2d');
      R(4, 3, 5, 3, '#8a8f99'); R(9, 4, 4, 2, '#6b4423');
      break;
    case T.FURNACE: {
      R(1, 2, 14, 14, '#6d6f78'); R(1, 2, 14, 2, '#8a8c95'); R(4, 7, 8, 7, '#1c1c20');
      const f = Math.sin(time * 9 + x) * 1;
      R(5, 10 + f, 6, 4 - f, '#ff6a1a'); R(6, 11 + f, 4, 3 - f, '#ffcc4a');
      break;
    }
    case T.ANVIL:
      R(2, 6, 12, 3, '#4c525c'); R(0, 6, 4, 2, '#4c525c'); R(5, 9, 6, 3, '#3a3f47'); R(3, 12, 10, 4, '#2f333a'); R(2, 6, 12, 1, '#727a86');
      break;
    case T.ALCHEMY:
      R(1, 8, 14, 3, '#7a5b3a'); R(2, 11, 2, 5, '#5a3f26'); R(12, 11, 2, 5, '#5a3f26');
      R(3, 3, 4, 5, '#8fd0ff'); R(4, 5, 2, 3, '#e04848'); R(9, 2, 4, 6, '#d0f0ff'); R(10, 4, 2, 4, '#4a7ef0');
      break;
    case T.CHEST: {
      R(1, 5, 14, 11, '#8a5a2b'); R(1, 5, 14, 3, '#a8743f'); R(1, 8, 14, 1, '#4a2f16'); R(7, 7, 2, 4, '#f5cc45'); R(1, 5, 1, 11, '#f5cc45'); R(14, 5, 1, 11, '#f5cc45');
      // a soft gold twinkle so unopened chests stand out
      const tw = 0.5 + 0.5 * Math.sin(time * 3 + x);
      g.globalAlpha = 0.6 * tw; R(11, 2, 1, 3, '#fff6c8'); R(10, 3, 3, 1, '#fff6c8'); g.globalAlpha = 1;
      break;
    }
    case T.LADDER:
      // two side rails and three rungs
      R(3, 0, 2, 16, '#7a5230'); R(11, 0, 2, 16, '#7a5230'); R(3, 0, 1, 16, '#9a6e44'); R(11, 0, 1, 16, '#9a6e44');
      R(5, 2, 6, 2, '#a8743f'); R(5, 7, 6, 2, '#a8743f'); R(5, 12, 6, 2, '#a8743f');
      break;
    case T.CHEST_OPEN:
      // lid flipped up, dark empty inside
      R(1, 9, 14, 7, '#8a5a2b'); R(2, 9, 12, 2, '#2a1a0c'); R(1, 9, 1, 7, '#f5cc45'); R(14, 9, 1, 7, '#f5cc45');
      R(1, 2, 14, 4, '#a8743f'); R(1, 2, 14, 1, '#f5cc45'); R(1, 6, 14, 1, '#4a2f16');
      break;
    case T.ALTAR: {
      R(2, 9, 12, 7, '#5a5560'); R(1, 8, 14, 2, '#7a7480'); R(4, 4, 8, 4, '#4a4550');
      const gl = 0.5 + 0.5 * Math.sin(time * 3);
      g.globalAlpha = 0.6 + gl * 0.4; R(6, 1, 4, 4, '#c04bff'); R(7, 0, 2, 6, '#e8a0ff'); g.globalAlpha = 1;
      break;
    }
    case T.WAYSTONE: {
      R(4, 1, 8, 15, '#5d6470'); R(4, 1, 8, 2, '#7c8492'); R(3, 13, 10, 3, '#4b515c');
      const gl = 0.5 + 0.5 * Math.sin(time * 2 + x);
      g.globalAlpha = 0.5 + gl * 0.5; R(7, 4, 2, 7, '#5fd0ff'); R(6, 6, 4, 1, '#5fd0ff'); g.globalAlpha = 1;
      break;
    }
    case T.BARS:
      R(0, 0, 16, 2, '#555a63'); R(0, 14, 16, 2, '#555a63');
      for (let i = 1; i < 16; i += 5) R(i, 0, 2, 16, '#7d838e');
      break;
    default:
      if (TP[id].plant) {
        const col = TP[id].plant, sw = Math.sin(time * 2 + x * 0.3) * 0.7;
        R(7 + sw, 7, 2, 9, '#3f7a2e'); R(4, 10, 3, 2, '#4f9a3a'); R(9, 9, 3, 2, '#4f9a3a');
        R(5 + sw, 3, 6, 5, col); R(7 + sw, 4, 2, 2, '#fff6c8');
      }
  }
}

// ===== Primitive helpers for sprites =====
function rr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function circ(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function tri(g, a, b, c2, d, e, f, col) { g.fillStyle = col; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.lineTo(e, f); g.closePath(); g.fill(); }

// Weapon shape drawn pointing up (-y) from the grip at the origin
function drawWeaponShape(g, item, s = 1) {
  if (!item) return;
  const c = item.col;
  g.save(); g.scale(s, s);
  if (item.kind === 'tool') {
    rr(g, -1, -14, 2, 15, '#7a4e2d');
    g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.arc(0, -8, 8, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke();
  } else if (item.wt === 'dagger') {
    rr(g, -1, -2, 2, 4, '#4a2f16'); rr(g, -3, -3, 6, 1.5, '#8a6a3a');
    tri(g, -1.8, -3, 1.8, -3, 0, -13, c); rr(g, -0.3, -12, 0.8, 8, shade(c, 1.3));
  } else if (item.wt === 'sword') {
    rr(g, -1, -1, 2, 5, '#4a2f16'); rr(g, -4, -2.5, 8, 2, '#c9a86a');
    rr(g, -1.6, -18, 3.2, 16, c); tri(g, -1.6, -18, 1.6, -18, 0, -21, c); rr(g, -0.4, -18, 0.8, 15, shade(c, 1.35));
  } else if (item.wt === 'mace') {
    rr(g, -1, -12, 2, 15, '#5a3f26');
    circ(g, 0, -15, 5, c); circ(g, -1.5, -16.5, 1.5, shade(c, 1.3));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; rr(g, Math.cos(a) * 5.5 - 1, -15 + Math.sin(a) * 5.5 - 1, 2, 2, shade(c, 0.7)); }
  } else if (item.wt === 'wand') {
    rr(g, -1, -14, 2, 16, '#5a3f26'); rr(g, -1.5, -14, 3, 2, '#c9a86a');
    g.globalAlpha = 0.45; circ(g, 0, -17, 5, c); g.globalAlpha = 1; circ(g, 0, -17, 3, c); circ(g, -0.8, -17.8, 1, '#fff');
  } else if (item.kind === 'block') {
    const tex = tileTex[item.tile] && tileTex[item.tile][0];
    if (tex) g.drawImage(tex, -4, -10, 8, 8); else { rr(g, -3, -9, 6, 6, item.col); }
  } else if (item.kind === 'potion') {
    rr(g, -3, -9, 6, 7, item.col); rr(g, -1.5, -12, 3, 3, '#cfe8ff'); rr(g, -2, -13, 4, 1, '#7a4e2d');
  } else if (item.kind === 'lure') {
    circ(g, 0, -6, 4, '#f5cc45'); circ(g, -1, -7, 1.5, '#fff2a8');
  }
  g.restore();
}

// ===== Smooth humanoid rig (knight and villagers) =====
const ARMOR_LOOK = {
  none: {body:'#7b5a3a', trim:'#c9a86a', legs:'#5a4532', boots:'#3a2a1e', helm:null, cape:'#a0302e', glove:'#f0c8a0'},
  armor_iron: {body:'#a9acb5', trim:'#6f7380', legs:'#8a8e98', boots:'#5a5e68', helm:'#b4b8c2', cape:'#a0302e', glove:'#8a8e98'},
  armor_steel: {body:'#93abc8', trim:'#e6ecf5', legs:'#7890ae', boots:'#4e5e78', helm:'#a2b8d2', cape:'#2f55b0', glove:'#7890ae'},
  armor_mythril: {body:'#4fd6bd', trim:'#eafff9', legs:'#36a892', boots:'#23705f', helm:'#62e0c8', cape:'#6a34a8', glove:'#36a892'},
  armor_dragon: {body:'#c9382a', trim:'#f5cc45', legs:'#962a1e', boots:'#4a1610', helm:'#d4402f', cape:'#22161a', glove:'#962a1e', plume:true},
};

// Distinct visual styles for classes: Sword (Knight), Dagger (Rogue Assassin), Wand (Wizard)
const CLASS_LOOK = {
  // Knight: polished plate armor, visor helm with plume, steel gauntlets and crimson cape
  sword: {
    none: {body:'#8a94a6', trim:'#d4af37', legs:'#626b7c', boots:'#3e4552', helm:'#a2acbe', plume:true, cape:'#a0302e', glove:'#707a8c'},
    armor_iron: {body:'#a9acb5', trim:'#d4af37', legs:'#8a8e98', boots:'#5a5e68', helm:'#b4b8c2', plume:true, cape:'#a0302e', glove:'#8a8e98'},
    armor_steel: {body:'#93abc8', trim:'#f0d060', legs:'#7890ae', boots:'#4e5e78', helm:'#a2b8d2', plume:true, cape:'#2f55b0', glove:'#7890ae'},
    armor_mythril: {body:'#4fd6bd', trim:'#eafff9', legs:'#36a892', boots:'#23705f', helm:'#62e0c8', plume:true, cape:'#6a34a8', glove:'#36a892'},
    armor_dragon: {body:'#c9382a', trim:'#f5cc45', legs:'#962a1e', boots:'#4a1610', helm:'#d4402f', plume:true, cape:'#22161a', glove:'#962a1e'}
  },
  // Rogue Assassin: sleek shadow leather, dark cowl/hood with glowing glint eyes, face-mask, dark silent boots, shadow cloak
  dagger: {
    none: {body:'#221d2a', trim:'#54384c', legs:'#1a1622', boots:'#110e16', hood:true, hoodCol:'#1d1824', mask:true, maskCol:'#2c2234', eyeCol:'#ffb347', cape:'#16121d', glove:'#141118'},
    armor_iron: {body:'#323440', trim:'#6f7380', legs:'#242630', boots:'#161720', hood:true, hoodCol:'#282a36', mask:true, maskCol:'#3c3f4e', eyeCol:'#ffb347', cape:'#1c1e28', glove:'#2a2c38'},
    armor_steel: {body:'#28364a', trim:'#93abc8', legs:'#1d2838', boots:'#121b26', hood:true, hoodCol:'#202d3e', mask:true, maskCol:'#364862', eyeCol:'#64e0ff', cape:'#151e2c', glove:'#243246'},
    armor_mythril: {body:'#1e4440', trim:'#4fd6bd', legs:'#163430', boots:'#0e2220', hood:true, hoodCol:'#183834', mask:true, maskCol:'#2a5850', eyeCol:'#4fd6bd', cape:'#102624', glove:'#1a3e3a'},
    armor_dragon: {body:'#42191c', trim:'#f5cc45', legs:'#301214', boots:'#200b0c', hood:true, hoodCol:'#381416', mask:true, maskCol:'#5c2226', eyeCol:'#ff4433', cape:'#240a0c', glove:'#321012'}
  },
  // Wizard: arcane celestial robes with gold-runic trim, pointed wizard hat with curled animated tip & gold buckle, mystic cape, glowing arcane eyes & sage beard
  wand: {
    none: {body:'#1e2b58', trim:'#e8b84a', legs:'#162042', boots:'#101730', hat:'#1a254c', dress:true, cape:'#422264', glove:'#d8a83a', beard:'#d4d0c8', arcaneEye:'#64d2ff'},
    armor_iron: {body:'#2d3654', trim:'#e8b84a', legs:'#202840', boots:'#141a2c', hat:'#26304c', dress:true, cape:'#4a3070', glove:'#b4b8c2', beard:'#d4d0c8', arcaneEye:'#8ae0ff'},
    armor_steel: {body:'#243c68', trim:'#f0d060', legs:'#1a2c4e', boots:'#101e38', hat:'#1e345c', dress:true, cape:'#362874', glove:'#a2b8d2', beard:'#e2ded6', arcaneEye:'#a0eaff'},
    armor_mythril: {body:'#1c5454', trim:'#a0fff0', legs:'#143e3e', boots:'#0c2828', hat:'#184848', dress:true, cape:'#6a34a8', glove:'#4fd6bd', beard:'#eafffa', arcaneEye:'#4fd6bd'},
    armor_dragon: {body:'#581a24', trim:'#ffd700', legs:'#3e121a', boots:'#280a10', hat:'#4c141e', dress:true, cape:'#280812', glove:'#f5cc45', beard:'#f5e6d0', arcaneEye:'#ffcc00'}
  }
};
const OUTLINE = 'rgba(22,14,10,0.9)';
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}
function limb(g, x, y, ang, len, w, col, endCol, endLen) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const grad = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, shade(col, 1.18));
  grad.addColorStop(0.65, col);
  grad.addColorStop(1, shade(col, 0.75));
  g.fillStyle = grad; rrect(g, -w / 2, -0.6, w, len + 0.6, w / 2); g.fill(); g.stroke();
  // joint guard plate highlight
  g.fillStyle = shade(col, 1.25);
  rrect(g, -w / 2 + 0.4, len * 0.42, w - 0.8, 2.0, 0.6); g.fill();
  if (endCol) {
    const egrad = g.createLinearGradient(-w / 2 - 0.2, 0, w / 2 + 1.3, 0);
    egrad.addColorStop(0, shade(endCol, 1.22));
    egrad.addColorStop(0.7, endCol);
    egrad.addColorStop(1, shade(endCol, 0.72));
    g.fillStyle = egrad; rrect(g, -w / 2 - 0.2, len - endLen, w + 1.5, endLen + 0.4, 1.1); g.fill(); g.stroke();
    // cuff rim & strap
    g.fillStyle = shade(endCol, 1.35);
    rrect(g, -w / 2 - 0.1, len - endLen - 0.3, w + 1.3, 0.9, 0.4); g.fill();
  }
  g.restore();
}
// Draws a humanoid with its feet at the origin, facing +x. Returns the body bob so held items can follow.
function drawHumanoid(g, o, time) {
  const ph = o.phase || 0, mv = o.moving ? 1 : 0;
  const legA = o.air ? 0.55 : Math.sin(ph) * 0.6 * mv;
  const bob = o.moving ? -Math.abs(Math.cos(ph)) * 1.1 : Math.sin(time * 2.2 + (o.seed || 0)) * 0.35;
  const sq = o.squash || 0;
  g.lineWidth = 0.7; g.strokeStyle = OUTLINE; g.lineJoin = 'round'; g.lineCap = 'round';
  g.save();
  g.scale(1 + sq * 0.14, 1 - sq * 0.14);
  const hipY = -10.6 + bob;
  // cape flows behind, further when running or falling, with realistic fold highlights
  if (o.cape) {
    const flow = Math.min(1, (o.speed || 0) / 150);
    const wave = Math.sin(time * 6 + (o.seed || 0)) * (0.6 + flow);
    const tx = -5.5 - flow * 6 + wave * 0.4, ty = -2.5 - flow * 4 - (o.air ? 5 : 0);
    g.fillStyle = o.cape;
    g.beginPath(); g.moveTo(-3.8, -21.2 + bob);
    g.quadraticCurveTo(-6.5 - flow * 3, -13 + bob + wave, tx, ty + bob);
    g.lineTo(tx + 3.6, ty + 1.2 + bob);
    g.quadraticCurveTo(-1.8, -12 + bob, 1.2, -21.2 + bob);
    g.closePath(); g.fill(); g.stroke();
    // deep crease shadow inside cape fold
    g.strokeStyle = shade(o.cape, 0.65); g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-2.5, -17 + bob); g.quadraticCurveTo(-4.2 - flow * 2, -10 + bob + wave * 0.8, tx + 1.5, ty + 0.5 + bob); g.stroke();
    // highlight along cape crest
    g.strokeStyle = shade(o.cape, 1.25); g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(-3.2, -19 + bob); g.quadraticCurveTo(-5.5 - flow * 2.5, -12 + bob + wave, tx + 0.5, ty - 0.2 + bob); g.stroke();
    g.lineWidth = 0.7; g.strokeStyle = OUTLINE;
  }
  // far shoulder pauldron
  if (o.helm || o.plume || o.hood) {
    g.fillStyle = shade(o.trim || o.body, 0.75);
    rrect(g, -3.8, -22.5 + bob, 4.4, 3.6, 1.3); g.fill(); g.stroke();
  }
  // far limbs
  if (!o.dress) limb(g, -0.8, hipY, -legA, 10.6, 3.7, shade(o.legs, 0.72), shade(o.boots, 0.75), 3.2);
  limb(g, -1.8, -19.6 + bob, (o.air ? -0.5 : -Math.sin(ph) * 0.5 * mv) + 0.15, 8, 3, shade(o.body, 0.7), shade(o.glove || '#f0c8a0', 0.8), 2.2);
  // skirt or near leg
  if (o.dress) {
    const sg = g.createLinearGradient(0, -14 + bob, 0, 0);
    sg.addColorStop(0, shade(o.body, 1.15)); sg.addColorStop(1, shade(o.body, 0.78));
    g.fillStyle = sg; g.beginPath(); g.moveTo(-4.5, -13 + bob); g.lineTo(4.5, -13 + bob);
    g.quadraticCurveTo(6.8, -5, 7 + Math.sin(time * 2) * 0.4, 0); g.lineTo(-7, 0); g.quadraticCurveTo(-6.8, -5, -4.5, -13 + bob);
    g.closePath(); g.fill(); g.stroke();
    // ornate gold embroidery along hem
    g.fillStyle = o.trim; g.fillRect(-6.8, -2.0, 13.6, 1.8);
    for (let rx = -5.5; rx <= 5.5; rx += 2.2) {
      g.fillStyle = shade(o.trim, 1.3); g.fillRect(rx, -3.2, 1.1, 1.1);
    }
  } else {
    limb(g, 1.2, hipY, legA, 10.6, 3.7, o.legs, o.boots, 3.2);
  }
  // torso with realistic breastplate volume and central tapul crease
  const tg = g.createLinearGradient(0, -23 + bob, 0, -10 + bob);
  tg.addColorStop(0, shade(o.body, 1.25)); tg.addColorStop(0.45, shade(o.body, 1.05)); tg.addColorStop(1, shade(o.body, 0.82));
  g.fillStyle = tg; rrect(g, -5, -22.8 + bob, 10, 12.8, 3.2); g.fill(); g.stroke();
  // central breastplate vertical ridge (tapul) & specular highlight
  g.strokeStyle = shade(o.body, 1.35); g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(0.2, -22.2 + bob); g.lineTo(0.2, -13 + bob); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.22)';
  rrect(g, -1.2, -21.5 + bob, 1.0, 7.5, 0.4); g.fill();
  // corner brass/steel rivets
  g.fillStyle = shade(o.trim || '#ffd700', 1.1);
  for (const rx of [-3.6, 3.6]) {
    g.beginPath(); g.arc(rx, -20.5 + bob, 0.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(rx, -15 + bob, 0.6, 0, Math.PI * 2); g.fill();
  }
  // leather waist belt with steel/gold engraved buckle
  g.fillStyle = shade(o.body, 0.65); rrect(g, -5.2, -12.8 + bob, 10.4, 2.5, 0.8); g.fill(); g.stroke();
  g.fillStyle = o.trim || '#ffd700'; rrect(g, -1.4, -13.2 + bob, 2.8, 3.3, 0.6); g.fill(); g.stroke();
  g.fillStyle = '#111'; rrect(g, -0.6, -12.4 + bob, 1.2, 1.7, 0.3); g.fill();
  // near shoulder pauldron (spaulder)
  if (o.helm || o.plume || o.hood) {
    const pg = g.createLinearGradient(-1, -23 + bob, 3, -19 + bob);
    pg.addColorStop(0, shade(o.trim || o.body, 1.3));
    pg.addColorStop(1, shade(o.body, 0.75));
    g.fillStyle = pg; rrect(g, 0.2, -22.8 + bob, 4.6, 3.8, 1.4); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; rrect(g, 0.8, -22.4 + bob, 3.2, 0.8, 0.4); g.fill();
  }
  // head
  const hx = 0.6, hy = -27 + bob;
  if (o.helm) {
    // 3D shaded knight helmet with cheek guard and visor bevel
    const hg = g.createRadialGradient(hx - 1.2, hy - 2, 0.5, hx, hy, 5.4);
    hg.addColorStop(0, shade(o.helm, 1.5)); hg.addColorStop(0.65, o.helm); hg.addColorStop(1, shade(o.helm, 0.72));
    g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 4.8, 0, Math.PI * 2); g.fill(); g.stroke();
    // helmet crown ridge (fluted crest)
    g.strokeStyle = shade(o.helm, 1.4); g.lineWidth = 0.9;
    g.beginPath(); g.arc(hx - 0.2, hy, 4.8, Math.PI * 0.8, Math.PI * 1.4); g.stroke();
    // visor eye slit with metallic highlight bevel & dark interior
    g.fillStyle = '#0a0810'; rrect(g, hx + 0.1, hy - 0.7, 4.6, 1.6, 0.6); g.fill();
    g.fillStyle = shade(o.helm, 1.45); rrect(g, hx + 0.2, hy - 1.2, 4.4, 0.6, 0.3); g.fill();
    // lower visor ventail breathing holes
    g.fillStyle = '#1a1820';
    for (let vx = 0; vx < 3; vx++) {
      g.beginPath(); g.arc(hx + 1.2 + vx * 1.1, hy + 1.8, 0.45, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = shade(o.helm, 0.7); g.fillRect(hx - 0.3, hy - 4.6, 0.9, 9.2);
    // multi-strand flowing horsehair plume
    if (o.plume) {
      g.fillStyle = o.trim;
      for (let layer = 0; layer < 3; layer++) {
        const offY = layer * 1.2, sway = Math.sin(time * 5 + layer * 0.8) * 0.9;
        g.fillStyle = layer === 0 ? shade(o.trim, 1.2) : layer === 1 ? o.trim : shade(o.trim, 0.8);
        g.beginPath(); g.moveTo(hx - 1, hy - 4.4 + offY);
        g.quadraticCurveTo(hx - 3.5, hy - 9.8 + offY, hx - 8.5 - sway, hy - 6.5 + offY);
        g.quadraticCurveTo(hx - 4.5, hy - 5.5 + offY, hx + 0.8, hy - 3.8 + offY);
        g.fill(); g.stroke();
      }
    } else {
      g.fillStyle = o.cape || o.trim; g.beginPath(); g.ellipse(hx - 0.3, hy - 5, 1.2, 1.8, -0.3, 0, Math.PI * 2); g.fill();
    }
  } else if (o.hood) {
    // Assassin cowl & hood with realistic fabric depth
    const hg = g.createRadialGradient(hx - 1, hy - 2, 0.5, hx, hy, 5.4);
    hg.addColorStop(0, shade(o.hoodCol || '#2a2233', 1.35));
    hg.addColorStop(1, shade(o.hoodCol || '#2a2233', 0.75));
    g.fillStyle = hg;
    g.beginPath(); g.arc(hx, hy, 4.9, 0, Math.PI * 2); g.fill(); g.stroke();
    // trailing cowl at the back with cloth creases
    g.beginPath(); g.moveTo(hx, hy - 4.6);
    g.quadraticCurveTo(hx - 4, hy - 8, hx - 8 - Math.sin(time * 5) * 0.7, hy - 5);
    g.quadraticCurveTo(hx - 4, hy - 2, hx - 2, hy + 2);
    g.closePath(); g.fill(); g.stroke();
    // deep shadow recess inside hood
    g.fillStyle = '#08060c';
    g.beginPath(); g.arc(hx + 1.2, hy - 0.2, 3.3, 0, Math.PI * 2); g.fill();
    // assassin mask covering mouth & nose with leather cross-weave
    if (o.mask) {
      g.fillStyle = o.maskCol || '#241a2c';
      rrect(g, hx - 0.2, hy - 0.2, 4.5, 3.8, 0.8); g.fill(); g.stroke();
      g.strokeStyle = shade(o.maskCol || '#241a2c', 1.3); g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(hx, hy + 1.2); g.lineTo(hx + 4, hy + 1.2); g.stroke();
    }
    // focused glowing assassin eye with iris and white specular pupil
    g.fillStyle = o.eyeCol || '#ffb347';
    g.beginPath(); g.arc(hx + 2.3, hy - 1.0, 1.0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(hx + 2.5, hy - 1.2, 0.4, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = o.skin || '#f0c8a0'; g.beginPath(); g.arc(hx, hy, 4.3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = o.hair;
    g.beginPath(); g.arc(hx - 0.4, hy - 0.8, 4.4, Math.PI * 0.92, Math.PI * 2.08); g.lineTo(hx + 1.5, hy - 2); g.lineTo(hx - 3.5, hy + 0.5); g.closePath(); g.fill();
    if (o.long) { rrect(g, hx - 5, hy - 1.5, 3, 9, 1.4); g.fill(); }
    // expressive eye with sclera, pupil, and glint
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(hx + 2.2, hy - 0.3, 1.0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1e1a22'; g.beginPath(); g.arc(hx + 2.4, hy - 0.3, 0.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(hx + 2.5, hy - 0.5, 0.25, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(220,120,110,0.5)'; g.beginPath(); g.arc(hx + 2.2, hy + 1.6, 0.8, 0, Math.PI * 2); g.fill();
    if (o.beard) {
      g.fillStyle = o.beard; g.beginPath(); g.moveTo(hx - 1.5, hy + 1.2); g.quadraticCurveTo(hx + 2, hy + 7.5, hx + 4.3, hy + 1.4); g.closePath(); g.fill();
      // beard hair highlights
      g.strokeStyle = shade(o.beard, 1.25); g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(hx + 0.5, hy + 2); g.lineTo(hx + 1.5, hy + 6.5); g.stroke();
    }
  }
  if (o.hat) {
    // pointed wizard hat with brim curve, embroidered runes, and gold buckle
    g.fillStyle = o.hat; g.beginPath(); g.ellipse(hx, hy - 3, 7.2, 1.8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(hx - 4, hy - 3.5); g.quadraticCurveTo(hx - 1, hy - 9, hx - 4.5 + Math.sin(time * 1.5), hy - 13.5);
    g.quadraticCurveTo(hx + 1, hy - 8, hx + 4, hy - 3.5); g.closePath(); g.fill(); g.stroke();
    // golden hatband buckle
    g.fillStyle = '#f5cc45'; rrect(g, hx - 1.2, hy - 4.6, 2.4, 2.0, 0.5); g.fill(); g.stroke();
    g.fillStyle = '#111'; rrect(g, hx - 0.5, hy - 4.2, 1.0, 1.2, 0.3); g.fill();
    if (o.arcaneEye) {
      g.fillStyle = o.arcaneEye;
      g.beginPath(); g.arc(hx + 2.3, hy - 0.3, 1.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(hx + 2.6, hy - 0.5, 0.45, 0, Math.PI * 2); g.fill();
    }
  }
  if (o.crown) {
    g.fillStyle = '#f5cc45'; g.beginPath(); g.moveTo(hx - 3.6, hy - 3.2); g.lineTo(hx - 3.6, hy - 6.4); g.lineTo(hx - 1.8, hy - 4.6); g.lineTo(hx, hy - 7.2);
    g.lineTo(hx + 1.8, hy - 4.6); g.lineTo(hx + 3.6, hy - 6.4); g.lineTo(hx + 3.6, hy - 3.2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e04878'; g.beginPath(); g.arc(hx, hy - 4.3, 0.7, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  return bob;
}
function groundShadow(g, w) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(0, 0, w, 1.7, 0, 0, Math.PI * 2); g.fill();
}

// ===== Player / knight =====
function drawKnight(g, p, time) {
  let cls = p.heroClass;
  if (!cls) {
    if (p.heldItem && p.heldItem.wt) cls = p.heldItem.wt;
    else if (typeof startWeapon !== 'undefined' && startWeapon) cls = startWeapon;
    else cls = 'sword';
  }
  if (!CLASS_LOOK[cls]) cls = 'sword';
  const tier = p.armorId || 'none';
  const look = (CLASS_LOOK[cls] && CLASS_LOOK[cls][tier]) || ARMOR_LOOK[tier] || ARMOR_LOOK.none;
  const cx = p.x + p.w / 2, by = p.y + p.h + (p.visOff || 0);
  const speed = Math.abs(p.vx);
  g.save(); g.translate(cx, by);
  if (p.onGround) groundShadow(g, 7);
  g.scale(p.facing, 1);
  if (p.iframes > 0 && Math.floor(time * 20) % 2 === 0) g.globalAlpha = 0.45;
  g.rotate(clamp(p.vx * p.facing / 155, -1, 1) * 0.07);
  const o = Object.assign({}, look, {phase:p.walkPhase || 0, moving:p.onGround && speed > 15, air:!p.onGround, speed,
    squash:p.landT > 0 ? p.landT / 0.12 : 0, skin:'#f0c8a0', hair:cls === 'dagger' ? '#201a22' : '#6b4423'});
  const bob = drawHumanoid(g, o, time);
  // near arm and held item
  const item = p.heldItem;
  let ang = -0.28 + Math.sin(time * 2.2) * 0.04, wr = 1.05, trail = 0;
  const melee = item && ((item.kind === 'weapon' && item.wt !== 'wand') || item.kind === 'tool');
  if (p.swingT > 0 && melee) {
    const k = 1 - p.swingT / p.swingDur, e = 1 - Math.pow(1 - k, 2.2);
    ang = lerp(-3.4, -0.55, e); wr = Math.PI; trail = k;
  } else if (item && item.wt === 'wand') {
    ang = (p.aimLocal || 0) - Math.PI / 2; wr = Math.PI;
  } else if (p.mining) {
    const k = (time * 3.2) % 1, e = k < 0.7 ? k / 0.7 : 1 - (k - 0.7) / 0.3;
    ang = lerp(-3.1, -0.7, e); wr = Math.PI;
  } else if (item && (item.kind === 'potion' || item.kind === 'block' || item.kind === 'lure')) { ang = -0.5; wr = Math.PI * 0.55; }
  const sx = 1.6, sy = -19.6 + bob;
  // motion trail for sword swings
  if (trail > 0 && item.kind === 'weapon') {
    const reach = 8 + WTYPE[item.wt].range * 0.5;
    const a1 = lerp(-3.4, -0.55, 1 - Math.pow(1 - Math.max(0, trail - 0.45), 2.2)), a2 = ang;
    g.save(); g.translate(sx, sy);
    const col = item.rareFlag ? '255,212,90' : '255,255,255';
    const grd = g.createRadialGradient(0, 0, reach * 0.3, 0, 0, reach);
    grd.addColorStop(0, `rgba(${col},0)`); grd.addColorStop(1, `rgba(${col},${0.45 * (1 - trail)})`);
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, 0);
    for (let s = 0; s <= 8; s++) { const a = lerp(a1, a2, s / 8); g.lineTo(-Math.sin(a) * reach, Math.cos(a) * reach); }
    g.closePath(); g.fill(); g.restore();
  }
  g.save(); g.translate(sx, sy); g.rotate(ang);
  g.lineWidth = 0.7; g.strokeStyle = OUTLINE;
  g.fillStyle = look.body; rrect(g, -1.6, -0.6, 3.2, 8.4, 1.6); g.fill(); g.stroke();
  g.fillStyle = look.glove; g.beginPath(); g.arc(0, 8, 1.9, 0, Math.PI * 2); g.fill(); g.stroke();
  if (item) { g.translate(0, 8); g.rotate(wr); drawWeaponShape(g, item, 0.95); }
  g.restore();
  g.restore();
}

// ===== Humanoid NPCs =====
function drawNPC(g, n, time) {
  const cx = n.x, by = n.y;
  g.save(); g.translate(cx, by);
  groundShadow(g, 7);
  g.scale(n.facing || 1, 1);
  const L = n.look;
  drawHumanoid(g, Object.assign({glove:'#f0c8a0', boots:'#3a2a1e', legs:L.legs || '#5a4532', skin:'#f0c8a0', seed:cx * 0.01}, L), time);
  if (L.staff) {
    g.lineWidth = 0.7; g.strokeStyle = OUTLINE;
    g.fillStyle = '#6b4423'; rrect(g, 5, -30, 1.6, 30, 0.8); g.fill(); g.stroke();
    g.globalAlpha = 0.35 + 0.15 * Math.sin(time * 3); g.fillStyle = '#7fc4ff'; g.beginPath(); g.arc(5.8, -31, 4.5, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1; g.beginPath(); g.arc(5.8, -31, 2.4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.font = '600 6px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(10,8,14,0.6)'; const w = g.measureText(n.name).width + 6;
  rrect(g, cx - w / 2, by - 47, w, 8.5, 3); g.fill();
  g.fillStyle = n.questMark ? '#ffd45a' : '#fff'; g.fillText(n.name, cx, by - 40.6);
  if (n.questMark) { g.font = 'bold 11px system-ui, sans-serif'; g.fillStyle = '#ffd45a'; g.fillText('!', cx, by - 50 + Math.sin(time * 4) * 1.5); }
}

// ===== Enemy attack animation =====
// Drawn on top of the sprite, in its own (unflipped, unscaled) coordinates: x forward, y up from the feet.
// Wind-up: the weapon rises behind the shoulder and the eyes glow red. Strike: it whips through
// with ghost copies and a bright smear arc. Claw users rake, biters snap their jaws.
const WEAPON_SWING = {
  goblin: {L:10, w:2, col:'#c8c8d2', piv:[2, 0.55]},
  orc: {L:17, w:2.4, col:'#9aa0aa', head:'axe', piv:[3, 0.62]},
  skeleton: {L:15, w:2, col:'#ece6d2', piv:[2, 0.62]},
  dark_knight: {L:22, w:2.6, col:'#b896ff', glow:'#a050ff', piv:[3, 0.64]},
  ogre: {L:27, w:4, col:'#7a5230', head:'club', piv:[6, 0.62]},
  witch: {L:16, w:1.5, col:'#4a3020', head:'orb', orb:'#c070ff', piv:[3, 0.62]},
  lich: {L:17, w:1.5, col:'#3a3020', head:'orb', orb:'#9be36b', piv:[3, 0.62]},
};
const ease3 = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
function drawSwingWeapon(g, px, py, a, ws) {
  g.save(); g.translate(px, py); g.rotate(a);
  const L = ws.L, w = ws.w;
  rr(g, 0, -w / 2, L * 0.32, w, '#5a3f26'); // grip
  if (ws.head === 'axe') {
    rr(g, L * 0.3, -w * 0.4, L * 0.7, w * 0.8, '#6b4a2a');
    g.fillStyle = ws.col; g.beginPath(); g.moveTo(L * 0.72, -1); g.lineTo(L * 0.95, -6); g.quadraticCurveTo(L * 1.08, 0, L * 0.95, 6); g.lineTo(L * 0.72, 1); g.closePath(); g.fill();
    rr(g, L * 0.94, -4, 1, 8, '#ffffff');
  } else if (ws.head === 'club') {
    g.fillStyle = ws.col; g.beginPath(); g.moveTo(L * 0.3, -w * 0.5); g.lineTo(L, -w * 1.2); g.lineTo(L, w * 1.2); g.lineTo(L * 0.3, w * 0.5); g.closePath(); g.fill();
    circ(g, L, 0, w * 1.25, ws.col); circ(g, L - 2, -2, 1.2, '#c8b090'); circ(g, L - 5, 2, 1, '#c8b090');
  } else if (ws.head === 'orb') {
    rr(g, L * 0.3, -w / 2, L * 0.7, w, ws.col);
    g.globalCompositeOperation = 'lighter'; circ(g, L, 0, 4.5, ws.orb); circ(g, L, 0, 2, '#ffffff'); g.globalCompositeOperation = 'source-over';
  } else {
    if (ws.glow) { g.shadowColor = ws.glow; g.shadowBlur = 6; }
    g.fillStyle = ws.col; g.beginPath(); g.moveTo(L * 0.3, -w * 0.6); g.lineTo(L * 0.92, -w * 0.5); g.lineTo(L, 0); g.lineTo(L * 0.92, w * 0.5); g.lineTo(L * 0.3, w * 0.6); g.closePath(); g.fill();
    g.shadowBlur = 0; rr(g, L * 0.32, -0.4, L * 0.6, 0.8, 'rgba(255,255,255,0.85)');
    rr(g, L * 0.28, -w * 1.3, 1.6, w * 2.6, '#d8b060'); // crossguard
  }
  g.restore();
}
function drawAttackPose(g, e) {
  const H = e.h / (e.sc || 1), k = 1 - e.atkT / ATK_TIME, split = 1 - ATK_STRIKE / ATK_TIME;
  const wind = k < split, s = wind ? k / split : (k - split) / (1 - split);
  const col = SLASH_COL[e.type] || '#ffffff';
  // wind-up warning: red glow at the eyes
  if (wind) {
    const hx = H * 0.12, hy = -H * 0.86, R = Math.max(5, H * 0.3);
    const gl = g.createRadialGradient(hx, hy, 0, hx, hy, R);
    gl.addColorStop(0, `rgba(255,70,40,${0.6 * s})`); gl.addColorStop(1, 'rgba(255,70,40,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(hx, hy, R, 0, Math.PI * 2); g.fill();
  }
  const ws = WEAPON_SWING[e.type], style = ATTACK_STYLE[e.type];
  if (ws) {
    const px = ws.piv[0], py = -ws.piv[1] * H, A0 = -2.5, A1 = 1.25;
    const ang = wind ? -0.4 + (A0 + 0.4) * ease3(s) : A0 + (A1 - A0) * ease3(s);
    if (!wind) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 4; i++) { g.globalAlpha = 0.2 * (1 - i / 5); drawSwingWeapon(g, px, py, A0 + (A1 - A0) * ease3(s - i * 0.08), ws); }
      g.globalAlpha = 0.4 * (1 - s * 0.6); g.strokeStyle = col; g.lineWidth = ws.L * 0.3; g.lineCap = 'round';
      g.beginPath(); g.arc(px, py, ws.L * 0.85, Math.max(A0, ang - 1.4), ang); g.stroke();
      g.restore(); g.globalAlpha = 1;
    }
    drawSwingWeapon(g, px, py, ang, ws);
  } else if (style === 'claw') {
    // the arm cocks back, then rakes forward leaving three streaks
    const px = 2, py = -H * 0.62, L = H * 0.45;
    const ang = wind ? -0.3 - 1.9 * ease3(s) : -2.2 + 3.3 * ease3(s);
    g.save(); g.translate(px, py); g.rotate(ang);
    g.strokeStyle = '#3a2a22'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.8, 0); g.stroke();
    for (let i = -1; i <= 1; i++) { g.strokeStyle = '#f4ecd8'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(L * 0.8, i * 1.4); g.quadraticCurveTo(L * 1.05, i * 2.2, L * 1.15, i * 2.8 + 1.5); g.stroke(); }
    g.restore();
    if (!wind) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * (1 - s * 0.5); g.strokeStyle = col; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { g.lineWidth = 1.6; g.beginPath(); g.arc(px, py, L * 1.05 + i * 2.6, Math.max(-2.2, ang - 1.3), ang); g.stroke(); }
      g.restore(); g.globalAlpha = 1;
    }
  } else if (style === 'bite') {
    // the head lunges with jaws gaping during the wind-up
    const hx = H * 0.55 + (wind ? 0 : 4 * Math.sin(s * Math.PI)), hy = -H * 0.6, open = wind ? 0.15 + 0.55 * s : 0.7 * (1 - ease3(s * 1.6));
    const L = Math.max(5, H * 0.45);
    g.save(); g.translate(hx, hy);
    for (const sgn of [-1, 1]) {
      g.save(); g.rotate(sgn * open);
      g.fillStyle = '#2a0e0e'; g.beginPath(); g.moveTo(0, 0); g.lineTo(L, sgn * 1.5); g.lineTo(L, 0); g.closePath(); g.fill();
      g.fillStyle = '#fffaf0'; for (let i = 1; i <= 3; i++) { const tx = L * i / 3.5; g.beginPath(); g.moveTo(tx - 1, 0); g.lineTo(tx + 1, 0); g.lineTo(tx, -sgn * 2.2); g.closePath(); g.fill(); }
      g.restore();
    }
    g.restore();
  }
}

// ===== Enemies =====
function drawEnemy(g, e, time) {
  const cx = e.x + e.w / 2, by = e.y + e.h + (e.visOff || 0);
  g.save(); g.translate(cx, by);
  if (e.ai !== 'flyer' && !e.fly && e.onGround) groundShadow(g, e.w * 0.55);
  g.scale(e.facing, 1);
  if (e.atkT > 0) {
    // wind up (lean back, crouch), then lunge forward
    const k = 1 - e.atkT / ATK_TIME, split = 1 - ATK_STRIKE / ATK_TIME;
    if (k < split) { const w = Math.sin(k / split * Math.PI / 2); g.translate(-2.5 * w, 0); g.rotate(-0.2 * w); g.scale(1 + 0.06 * w, 1 - 0.06 * w); }
    else { const s = Math.sin((k - split) / (1 - split) * Math.PI); g.translate(6 * s, 0); g.rotate(0.26 * s); g.scale(1 - 0.04 * s, 1 + 0.05 * s); }
  }
  if (e.castT > 0) { const k = 1 - e.castT / CAST_TIME; g.translate(0, -1.5 * Math.sin(k * Math.PI)); g.scale(1, 1 + 0.05 * Math.sin(k * Math.PI)); }
  if (e.sc !== 1) g.scale(e.sc, e.sc);
  g.shadowColor = 'rgba(12,8,6,0.85)'; g.shadowBlur = 2.5 * (typeof ZS !== 'undefined' ? ZS / 2 : 1);
  if (e.flash > 0) g.filter = 'brightness(3)';
  const t = time + e.seed, mv = Math.abs(e.vx) > 8 ? Math.sin(t * 12) * 2.5 : 0;
  const ally = e.ally;
  if (ally) g.globalAlpha = 0.85;
  const draw = SPRITES[e.look || e.type];
  if (draw) draw(g, t, mv, e); else rr(g, -6, -12, 12, 12, '#f0f');
  g.filter = 'none'; g.globalAlpha = 1; g.shadowBlur = 0;
  if (e.atkT > 0 && !e.boss) drawAttackPose(g, e);
  g.restore();
  // spell charging glow at the caster's hand, plus a spinning rune circle under the caster's feet
  if (e.castT > 0) {
    const k = 1 - e.castT / CAST_TIME, hx = cx + e.facing * e.w * 0.55, hy = e.y + e.h * 0.3;
    const col = e.type === 'drake' ? '255,140,40' : e.type === 'lich' ? '155,227,107' : '190,100,255';
    if (e.ai !== 'flyer') {
      const R = e.w * 0.9 + 4, fy = e.y + e.h + (e.visOff || 0), spin = time * 3;
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(${col},${0.7 * k})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx, fy, R, R * 0.3, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.ellipse(cx, fy, R * 0.7, R * 0.21, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 6; i++) { const an = spin + i * Math.PI / 3; g.fillStyle = `rgba(${col},${0.9 * k})`; g.fillRect(cx + Math.cos(an) * R * 0.85 - 1, fy + Math.sin(an) * R * 0.25 - 1, 2, 2); }
      g.restore();
    }
    // motes spiralling into the hand
    for (let i = 0; i < 5; i++) { const an = time * 6 + i * 1.26, rr2 = 12 * (1 - k) + 2; g.fillStyle = `rgba(${col},${0.8 * k})`; g.fillRect(hx + Math.cos(an) * rr2 - 0.8, hy + Math.sin(an) * rr2 - 0.8, 1.6, 1.6); }
    const gr = g.createRadialGradient(hx, hy, 0, hx, hy, 4 + 8 * k);
    gr.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); gr.addColorStop(0.4, `rgba(${col},${0.8 * k})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, 4 + 8 * k, 0, Math.PI * 2); g.fill();
  }
  // wind-up warning flash
  if (e.atkT > ATK_STRIKE) {
    const k = 1 - (e.atkT - ATK_STRIKE) / (ATK_TIME - ATK_STRIKE);
    g.globalAlpha = 0.5 * k; g.fillStyle = '#fff'; g.font = 'bold 9px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('!', cx, e.y - 7); g.globalAlpha = 1;
  }
  if (e.elite && !e.boss && !e.mini) {
    g.strokeStyle = 'rgba(255,212,90,0.7)'; g.lineWidth = 1;
    g.strokeRect(e.x - 2, e.y - 2, e.w + 4, e.h + 4);
  }
  // status tints
  if (e.poisonT > 0) circ(g, cx - 5, e.y - 4, 1.5, '#7bd34a');
  if (e.burnT > 0) circ(g, cx, e.y - 4, 1.5, '#ff6a1a');
  if (e.curseT > 0) circ(g, cx + 5, e.y - 4, 1.5, '#b05be0');
  if (e.rootT > 0 || e.stunT > 0) { g.fillStyle = '#ffd45a'; g.font = '7px sans-serif'; g.textAlign = 'center'; g.fillText('✦', cx, e.y - 7); }
  // health bar
  if (e.mini) {
    // mini-boss: name plate and a full-width health bar, always shown
    const bw = Math.max(36, e.w + 10), bx = cx - bw / 2, byy = e.y - 9;
    g.font = 'bold 6px system-ui, sans-serif'; g.textAlign = 'center';
    g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(e.name, cx, byy - 3);
    g.fillStyle = '#ffb35a'; g.fillText(e.name, cx, byy - 3);
    rr(g, bx - 1, byy - 1, bw + 2, 4, 'rgba(0,0,0,0.75)');
    rr(g, bx, byy, bw * Math.max(0, e.hp / e.maxHp), 2, '#ff7a3a');
  } else if (!e.boss && e.hp < e.maxHp) {
    rr(g, e.x - 2, e.y - 4, e.w + 4, 2, 'rgba(0,0,0,0.6)');
    rr(g, e.x - 2, e.y - 4, (e.w + 4) * Math.max(0, e.hp / e.maxHp), 2, ally ? '#7bd34a' : '#e04848');
  }
}
function humanoidBase(g, mv, skin, cloth, legs, h) {
  rr(g, -4 + mv * 0.5, -h * 0.36, 3, h * 0.36, legs); rr(g, 1 - mv * 0.5, -h * 0.36, 3, h * 0.36, legs);
  rr(g, -5, -h * 0.76, 10, h * 0.42, cloth);
}
const SPRITES = {
  goblin(g, t, mv) {
    // hunched goblin legs with clawed feet
    rr(g, -3.5 + mv * 0.5, -8, 2.8, 8, '#2a2016'); rr(g, 0.5 - mv * 0.5, -8, 2.8, 8, '#2a2016');
    rr(g, -2.5 + mv * 0.5, -1.5, 3.2, 1.6, '#4f722a'); rr(g, 1.5 - mv * 0.5, -1.5, 3.2, 1.6, '#4f722a');
    // torso with stitched ragged leather jerkin & rope belt
    rr(g, -4.5, -14, 9, 7.5, '#5e432a');
    g.fillStyle = '#3a2a1a'; rrect(g, -4.8, -10, 9.6, 1.8, 0.6); g.fill();
    g.fillStyle = '#bda050'; circ(g, 0, -9.1, 0.8);
    // cross-stitch laces
    g.strokeStyle = '#281c10'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(-2, -13); g.lineTo(2, -11); g.moveTo(2, -13); g.lineTo(-2, -11); g.stroke();
    // sinewy green goblin head with notched bat-like ears
    rr(g, -4.5, -21.5, 9.5, 7.8, '#5b8532');
    tri(g, -4.5, -19, -10.5, -23, -4.5, -16, '#5b8532');
    tri(g, -4.5, -18.5, -9, -21.5, -4.5, -16.5, '#3e5e22'); // inner ear shadow
    tri(g, 5, -19, 10.5, -23, 5, -16, '#5b8532');
    tri(g, 5, -18.5, 9, -21.5, 5, -16.5, '#3e5e22');
    // wrinkled brow & piercing yellow eyes with slit pupils
    g.fillStyle = '#2d4418'; rr(g, 0, -20.5, 4.2, 0.9);
    g.fillStyle = '#ffd033'; rr(g, 1.2, -19.5, 2.4, 2.0);
    g.fillStyle = '#111'; rr(g, 2.4, -19.2, 0.8, 1.4);
    // bared lower tooth
    g.fillStyle = '#e8dec5'; tri(g, 1.8, -15.5, 2.8, -15.5, 2.3, -17.2);
    // crude iron scimitar with chipped edge and metallic shine
    rr(g, 4.5, -13, 1.8, 6, '#3a2818');
    g.fillStyle = '#8a929e';
    g.beginPath(); g.moveTo(5.5, -13); g.lineTo(9.5, -18); g.lineTo(7.5, -10); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; rr(g, 8.5, -16.5, 0.8, 2.5);
  },
  rat(g, t, mv) {
    // realistic rodent anatomy: arched back, fur texture, whiskers, pink snout & incisors
    g.strokeStyle = '#d48a8a'; g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-8, -4); g.quadraticCurveTo(-14, -8 + Math.sin(t * 7) * 2.5, -17, -2); g.stroke();
    // fur body with back curvature gradient
    const rg = g.createRadialGradient(0, -6, 2, 0, -6, 9);
    rg.addColorStop(0, '#8c7766'); rg.addColorStop(0.7, '#675446'); rg.addColorStop(1, '#47382d');
    g.fillStyle = rg; g.beginPath(); g.ellipse(-1, -5.5, 9.5, 5.5, 0, 0, Math.PI * 2); g.fill();
    // dorsal fur ridge strokes
    g.strokeStyle = '#47382d'; g.lineWidth = 0.7;
    for (let fx = -5; fx <= 3; fx += 2.5) { g.beginPath(); g.moveTo(fx, -11); g.lineTo(fx - 1, -9); g.stroke(); }
    // head & snout
    g.fillStyle = '#786454'; g.beginPath(); g.ellipse(7.2, -5.2, 4.4, 3.4, 0.15, 0, Math.PI * 2); g.fill();
    // pink inner ear
    circ(g, 6, -9.5, 2.3, '#8a7260'); circ(g, 6, -9.5, 1.4, '#d89a9a');
    // glowing ruby eye with glint
    circ(g, 8.2, -6.5, 1.6, '#ff2222'); circ(g, 8.6, -6.8, 0.5, '#ffffff');
    // pink twitching snout and white incisors
    circ(g, 11, -5.0, 1.3, '#d88e8e');
    g.fillStyle = '#fff8e8'; rr(g, 10.2, -3.8, 1.0, 1.6, '#fff8e8');
    // whiskers
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(10.5, -5); g.lineTo(13.5, -6.5); g.moveTo(10.5, -4.5); g.lineTo(13.5, -3.5); g.stroke();
    // paws
    rr(g, -5 + mv, -1.2, 2.4, 1.8, '#d88e8e'); rr(g, 3.5 - mv, -1.2, 2.4, 1.8, '#d88e8e');
  },
  skeleton(g, t, mv, e) {
    const c = e && e.ally ? '#c8f0b0' : '#ece4d4', darkB = e && e.ally ? '#4a723a' : '#221e1a';
    // articulated leg bones with knee joint condyles
    rr(g, -3.5 + mv * 0.5, -10.5, 2.2, 10.5, c); rr(g, 1 - mv * 0.5, -10.5, 2.2, 10.5, c);
    circ(g, -2.4 + mv * 0.5, -5.5, 1.4, c); circ(g, 2.1 - mv * 0.5, -5.5, 1.4, c); // knees
    // pelvis bone
    rrect(g, -4.2, -12, 8.4, 2.2, 0.8); g.fillStyle = c; g.fill();
    // spine vertebrae column & ribcage with dark cavity
    rr(g, -1.2, -20.5, 2.4, 9, c);
    for (let i = 0; i < 4; i++) {
      const rw = 8.5 - i * 0.8, ry = -19.5 + i * 2.2;
      rrect(g, -rw / 2, ry, rw, 1.3, 0.5); g.fillStyle = c; g.fill();
      g.fillStyle = darkB; circ(g, 0, ry + 0.6, 0.8); // spine cord gap
    }
    // sternum plate
    g.fillStyle = c; rr(g, -0.6, -19.5, 1.2, 7.5);
    // anatomical cranium with eye cavities and nasal notch
    rrect(g, -4.6, -28.5, 9.2, 8.2, 2.4); g.fillStyle = c; g.fill();
    // deep eye sockets with inner soul embers
    g.fillStyle = darkB;
    circ(g, -1.8, -25.5, 1.8); circ(g, 1.8, -25.5, 1.8);
    g.fillStyle = e && e.ally ? '#7bd34a' : '#64e0ff'; // glowing soul embers in eyes
    circ(g, -1.6, -25.5, 0.8); circ(g, 2.0, -25.5, 0.8);
    // nasal cavity & teeth rows
    g.fillStyle = darkB; tri(g, 0, -24.2, -0.7, -22.8, 0.7, -22.8);
    for (let tx = -2.2; tx <= 2.2; tx += 1.4) {
      g.fillStyle = c; rr(g, tx, -21.8, 0.9, 1.4, c);
    }
    // arm and weathered ancient iron sword with nicked blade
    rr(g, 4.2, -18, 1.8, 8, c);
    g.fillStyle = '#6a4a2a'; rr(g, 4.6, -20, 1.4, 5); // hilt
    g.fillStyle = '#a8b0bc'; rrect(g, 3.6, -28.5, 2.2, 9, 0.5); g.fill();
    g.fillStyle = '#ffffff'; rr(g, 4.8, -28, 0.6, 7.5); // blade shine
  },
  orc(g, t, mv) {
    // powerful muscular green hide with broad stance
    humanoidBase(g, mv, '#4d7838', '#5e3f22', '#2c1e14', 30);
    // muscular chest contours (pectorals & abs)
    g.fillStyle = '#3e622b';
    rrect(g, -4.5, -21.5, 4.2, 3.2, 0.8); g.fill();
    rrect(g, 0.3, -21.5, 4.2, 3.2, 0.8); g.fill();
    // iron belt & spiked shoulder pauldron
    rr(g, -5.5, -16.5, 11, 2.5, '#787e8a');
    g.fillStyle = '#d0d4dc'; circ(g, 0, -15.2, 1.2);
    // orc head with jutting lower tusks & war paint
    rr(g, -5.5, -30.5, 11, 9, '#4d7838');
    // red tribal war paint across brow
    g.fillStyle = '#b02424'; rr(g, -4.5, -28, 9, 1.6);
    // menacing crimson eyes
    g.fillStyle = '#ff2222'; rr(g, 1.2, -27.5, 2.4, 1.6);
    g.fillStyle = '#111'; rr(g, 2.4, -27.2, 0.8, 1.2);
    // sharp curved ivory tusks with realistic shading
    g.fillStyle = '#f4eedc';
    tri(g, -1.8, -23, -0.6, -23, -1.2, -26.5);
    tri(g, 2.2, -23, 3.4, -23, 2.8, -26.5);
    g.strokeStyle = '#c4b89e'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(-1.2, -23); g.lineTo(-1.2, -26); g.moveTo(2.8, -23); g.lineTo(2.8, -26); g.stroke();
    // heavy double-flanged iron war-axe
    rr(g, 5.5, -21, 2.4, 12, '#4a321e');
    g.fillStyle = '#828a96';
    g.beginPath(); g.moveTo(6.5, -22); g.lineTo(12, -26); g.lineTo(11, -18); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(5.5, -22); g.lineTo(1, -25); g.lineTo(2, -19); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; rr(g, 10.5, -25, 0.8, 6);
  },
  witch(g, t, mv, e) {
    const robe = e && e.queen ? '#351854' : '#4d306b', trim = e && e.queen ? '#ffd700' : '#a050d8';
    // flowing mystical velvet dress with deep shadow folds
    const wg = g.createLinearGradient(0, -22, 0, 0);
    wg.addColorStop(0, shade(robe, 1.25)); wg.addColorStop(1, shade(robe, 0.75));
    g.fillStyle = wg; g.beginPath(); g.moveTo(-4.5, -21); g.lineTo(4.5, -21); g.lineTo(8.5, 0); g.lineTo(-8.5, 0); g.closePath(); g.fill();
    // cloth fold shadows
    g.strokeStyle = shade(robe, 0.6); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-2, -18); g.lineTo(-4, 0); g.moveTo(2, -18); g.lineTo(4, 0); g.stroke();
    // runic embroidered hem
    g.fillStyle = trim; g.fillRect(-8.2, -1.8, 16.4, 1.4);
    // crone face with hooked nose & yellow wicked eye
    rr(g, -3.8, -28.5, 7.6, 7.6, '#7ca856');
    circ(g, 1.8, -26.2, 1.6, '#ffee33'); circ(g, 2.2, -26.2, 0.6, '#111');
    tri(g, 3.8, -25, 6.2, -24, 3.8, -23, '#6e984a'); // hooked nose
    // crooked crone hat with wide brim, velvet band, and gold buckle
    g.fillStyle = '#1c1624'; g.beginPath(); g.ellipse(0, -29, 8.5, 2.2, 0, 0, Math.PI * 2); g.fill();
    tri(g, -7, -29, 7, -29, -2, -43, '#1c1624');
    g.fillStyle = trim; rrect(g, -4, -30.5, 8, 1.6, 0.5); g.fill();
    if (e && e.queen) {
      // Queen's royal jeweled tiara
      g.fillStyle = '#ffd700';
      tri(g, -4, -31, -2, -35, 0, -31); tri(g, 0, -31, 2, -35, 4, -31);
      circ(g, 0, -32, 1.2, '#d82850');
    }
    // twisted elderwood staff topped with levitating amethyst crystal
    rr(g, 6.5, -28, 1.8, 28, '#422814');
    g.save(); g.globalCompositeOperation = 'lighter';
    const pulse = 0.7 + Math.sin(t * 6) * 0.3;
    circ(g, 7.4, -30, 4.5 * pulse, 'rgba(180,90,240,0.4)');
    circ(g, 7.4, -30, 2.6, '#d478ff');
    circ(g, 7.4, -30, 1.2, '#ffffff');
    g.restore();
  },
  spider(g, t) {
    // realistic multi-jointed spider legs with sharp tarsal claws
    g.strokeStyle = '#221628'; g.lineWidth = 1.4; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = Math.sin(t * 14 + i * 0.9) * 2.2;
      // coxa, femur, and tarsal claw bend
      g.beginPath(); g.moveTo(0, -7); g.lineTo(-5 - i * 2.6, -12 + ph); g.lineTo(-8 - i * 2.6, -1); g.lineTo(-10 - i * 2.4, 0); g.stroke();
      g.beginPath(); g.moveTo(0, -7); g.lineTo(5 + i * 2.6, -12 - ph); g.lineTo(8 + i * 2.6, -1); g.lineTo(10 + i * 2.4, 0); g.stroke();
    }
    // bulbous abdomen with venom markings
    const abG = g.createRadialGradient(-4, -7, 1, -4, -7, 7.5);
    abG.addColorStop(0, '#4e335e'); abG.addColorStop(1, '#201428');
    g.fillStyle = abG; g.beginPath(); g.ellipse(-4.2, -7.2, 7.5, 5.5, 0, 0, Math.PI * 2); g.fill();
    // red hourglass warning mark
    g.fillStyle = '#d82222';
    tri(g, -6, -9, -2.5, -9, -4.2, -7.5); tri(g, -6, -6, -2.5, -6, -4.2, -7.5);
    // cephalothorax
    g.fillStyle = '#2f1e38'; g.beginPath(); g.ellipse(5.2, -6.2, 4.6, 3.8, 0, 0, Math.PI * 2); g.fill();
    // cluster of 6 glowing arachnid eyes
    g.fillStyle = '#ff2222';
    for (const [ox, oy] of [[6.5, -8.2], [8.0, -7.5], [6.8, -6.2], [8.2, -5.5]]) {
      circ(g, ox, oy, 0.9); circ(g, ox + 0.2, oy - 0.2, 0.35, '#ffffff');
    }
    // chelicerae with dripping green venom drop
    g.fillStyle = '#180e1c'; tri(g, 8.5, -4.5, 10.5, -3.5, 9, -2);
    circ(g, 9.8, -1.8, 0.9, '#5fe038');
  },
  werewolf(g, t, mv) {
    // powerful lupine anatomy with digitigrade hocks & fur ruff
    rr(g, -4.5 + mv * 0.6, -12, 3.8, 12, '#4d3a2e'); rr(g, 0.5 - mv * 0.6, -12, 3.8, 12, '#4d3a2e');
    // sharp paw claws
    for (const cx of [-4.5 + mv * 0.6, 0.5 - mv * 0.6]) {
      g.fillStyle = '#161210'; rr(g, cx - 1, -1.5, 4.8, 1.6);
    }
    // muscular torso with deep chest and jagged fur silhouette
    rr(g, -6.5, -24, 13, 14, '#5e483a');
    rr(g, -3.5, -22, 7, 9, '#7a6150'); // paler chest fur
    // fur tuft spikes along spine
    g.fillStyle = '#3a2b20';
    tri(g, -6.5, -22, -9.5, -20, -6.5, -17);
    tri(g, -6.5, -17, -9.5, -15, -6.5, -12);
    // wolf head with pointed ears and snarling open muzzle
    rr(g, -4.5, -31.5, 9.5, 8.5, '#5e483a');
    tri(g, -4.5, -31.5, -2.5, -37, 0, -31.5, '#4d3a2e');
    tri(g, 1, -31.5, 3.5, -37, 5.5, -31.5, '#4d3a2e');
    // elongated snarling wolf snout
    g.fillStyle = '#4d3a2e'; rrect(g, 3.5, -28.5, 6.2, 4.5, 1.2); g.fill();
    circ(g, 9.2, -28.0, 1.3, '#161210'); // black nose
    // bared ivory canines & red tongue
    g.fillStyle = '#8a1818'; rr(g, 5, -25.5, 3.5, 1.6);
    g.fillStyle = '#fff8e8';
    tri(g, 5.2, -26.5, 6.4, -26.5, 5.8, -24); // upper fang
    tri(g, 7.0, -24.5, 8.2, -24.5, 7.6, -26.5); // lower fang
    // glowing feral amber eyes with slit pupils
    g.fillStyle = '#ffd022'; circ(g, 2.5, -29.2, 1.6);
    g.fillStyle = '#161210'; rr(g, 2.8, -29.8, 0.6, 1.4);
    // muscular clawed arms
    rr(g, 5.5, -21, 3.4, 10, '#5e483a');
    for (let cl = 0; cl < 3; cl++) {
      g.fillStyle = '#161210'; tri(g, 6.5 + cl * 1.2, -11, 7.5 + cl * 1.2, -11, 7.0 + cl * 1.2, -8.5);
    }
  },
  troll(g, t, mv) {
    // colossal mossy stone-skinned troll with craggy knuckles
    rr(g, -7 + mv * 0.5, -14, 5.5, 14, '#4f6658'); rr(g, 1.5 - mv * 0.5, -14, 5.5, 14, '#4f6658');
    rr(g, -8, -16.5, 16, 4.5, '#563a1e'); // leather loincloth
    // rocky torso with pebble-like armored skin calluses & moss patches
    const tg = g.createLinearGradient(0, -32, 0, -16);
    tg.addColorStop(0, '#668270'); tg.addColorStop(1, '#485e50');
    g.fillStyle = tg; rrect(g, -9, -32, 18, 17, 3.5); g.fill();
    // green moss patches on shoulders
    g.fillStyle = '#78a840';
    circ(g, -6, -30, 2.8); circ(g, 5, -29, 2.4); circ(g, -1, -26, 2.0);
    // craggy troll head with deep brow ridge
    rrect(g, -6, -38.5, 12, 8, 2.5); g.fillStyle = '#668270'; g.fill();
    g.fillStyle = '#ffd833'; circ(g, 3.5, -35.5, 1.8); circ(g, 3.8, -35.5, 0.7, '#111');
    // heavy underbite jaw with blunt tusks
    rrect(g, 3.5, -34, 5.5, 3.8, 1.2); g.fillStyle = '#4f6658'; g.fill();
    g.fillStyle = '#f0ead6'; tri(g, 5, -34, 6.5, -34, 5.8, -37);
    // giant tree-trunk stone club
    rr(g, 8, -30, 4.5, 20, '#668270');
    rr(g, 10, -48, 5, 30, '#563a1e');
    g.fillStyle = '#668270'; rrect(g, 8.5, -53, 8, 10, 2); g.fill();
  },
  wraith(g, t) {
    const bob = Math.sin(t * 3.5) * 2.8;
    g.save();
    g.globalAlpha *= 0.88;
    // billowing ethereal shroud with translucent spectral gradients
    const spG = g.createLinearGradient(0, -28 + bob, 0, 4 + bob);
    spG.addColorStop(0, '#1c2438'); spG.addColorStop(0.5, '#283854'); spG.addColorStop(1, 'rgba(40,60,90,0)');
    g.fillStyle = spG;
    g.beginPath(); g.moveTo(-8, -25 + bob); g.lineTo(8, -25 + bob);
    g.lineTo(7, -6 + bob); g.lineTo(3, 2 + Math.sin(t * 6) * 3); g.lineTo(-2, -4 + bob); g.lineTo(-7, 3 + Math.sin(t * 5) * 3);
    g.closePath(); g.fill();
    // wispy soul tendrils floating below
    g.strokeStyle = 'rgba(100,220,255,0.45)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-3, -2 + bob); g.quadraticCurveTo(-6, 6 + Math.sin(t * 5) * 3, -4, 12); g.stroke();
    g.beginPath(); g.moveTo(2, -2 + bob); g.quadraticCurveTo(5, 6 - Math.sin(t * 5) * 3, 3, 12); g.stroke();
    // shadowed phantom hood
    circ(g, 0, -25 + bob, 6.5, '#121824');
    // piercing blue soul-fire eyes
    g.shadowColor = '#64e0ff'; g.shadowBlur = 6;
    circ(g, -2.2, -25 + bob, 1.8, '#8ff0ff'); circ(g, 2.2, -25 + bob, 1.8, '#8ff0ff');
    circ(g, -2.0, -25 + bob, 0.8, '#ffffff'); circ(g, 2.4, -25 + bob, 0.8, '#ffffff');
    g.shadowBlur = 0;
    g.restore();
  },
  ogre(g, t, mv, e) {
    // colossal frame with skin folds, broad belly, and studded leather
    rr(g, -10 + mv * 0.5, -15, 7.8, 15, '#85664b'); rr(g, 2.5 - mv * 0.5, -15, 7.8, 15, '#85664b');
    // studded loincloth belt
    rr(g, -11, -17.5, 22, 4.5, '#4a321e');
    for (let bx = -9; bx <= 9; bx += 3.5) { g.fillStyle = '#c4c8d0'; circ(g, bx, -15.2, 1.0); }
    // massive rounded torso with belly contour
    const ogG = g.createRadialGradient(0, -27, 2, 0, -27, 14);
    ogG.addColorStop(0, '#d9b48e'); ogG.addColorStop(0.8, '#bf9672'); ogG.addColorStop(1, '#8e6c4e');
    g.fillStyle = ogG; g.beginPath(); g.ellipse(0, -27, 13.5, 13.5, 0, 0, Math.PI * 2); g.fill();
    // ogre head with furrowed brow and tusk
    rrect(g, -6, -44, 11.5, 10, 2.5); g.fillStyle = '#bf9672'; g.fill();
    g.fillStyle = '#222'; circ(g, 3, -40.5, 2.0); circ(g, 3.4, -40.5, 0.7, '#fff');
    // tusk with metal ring piercing
    g.fillStyle = '#f4eedc'; tri(g, 1.5, -37, 3.2, -37, 2.4, -40.5);
    g.fillStyle = '#e8b84a'; circ(g, 2.4, -38.5, 0.9);
    if (e && e.warlord) {
      // Warlord horned battle helm with iron cheek-plates
      g.fillStyle = '#555b68'; rrect(g, -7, -46.5, 13.5, 4.5, 1); g.fill();
      g.fillStyle = '#e6dec8';
      tri(g, -7, -46, -13, -53, -4.5, -46); tri(g, 6.5, -46, 12.5, -53, 4, -46);
    }
    // massive studded iron wrist bracer & giant spiked war club
    rr(g, 11, -33, 5.5, 17, '#bf9672');
    rr(g, 10.5, -26, 6.2, 3.5, '#555b68'); // studded bracer
    rr(g, 12, -47, 3.6, 32, '#5a381e');
    g.fillStyle = '#422814'; rrect(g, 9.5, -54, 9, 12, 2); g.fill();
    // iron club spikes
    g.fillStyle = '#c8d0dc';
    tri(g, 9.5, -52, 6.5, -53, 9.5, -50);
    tri(g, 18.5, -52, 21.5, -53, 18.5, -50);
    tri(g, 14, -54, 14, -57, 16, -54);
  },
  dark_knight(g, t, mv) {
    // imposing gothic blackened full plate with fluted edges
    humanoidBase(g, mv, '#1a1920', '#16141d', '#0e0c12', 32);
    // fluted breastplate with metallic dark violet sheen
    const dg = g.createLinearGradient(0, -25, 0, -12);
    dg.addColorStop(0, '#363244'); dg.addColorStop(0.5, '#221f2b'); dg.addColorStop(1, '#14121a');
    g.fillStyle = dg; rrect(g, -5.5, -25, 11, 13, 2.5); g.fill();
    // demonic rune engraving along breastplate
    g.strokeStyle = '#9040e8'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, -24); g.lineTo(0, -14); g.moveTo(-3, -19); g.lineTo(3, -19); g.stroke();
    // fluted gothic helmet with horizontal glowing crimson visor slit
    rrect(g, -5.2, -33, 10.4, 9, 2); g.fillStyle = '#221f2b'; g.fill();
    // piercing crimson visor slit with demonic glow
    g.fillStyle = '#ff1111'; g.shadowColor = '#ff2222'; g.shadowBlur = 5;
    rrect(g, 0, -29.5, 5.2, 1.8, 0.5); g.fill();
    g.fillStyle = '#ffffff'; rrect(g, 1.8, -29.2, 2.0, 0.8, 0.3); g.fill();
    g.shadowBlur = 0;
    // darksteel greatsword with carved fuller
    rr(g, 6, -34, 2.4, 25, '#4a2874');
    g.fillStyle = '#9050d8'; rr(g, 6.8, -32, 0.8, 18);
  },
  wyvern(g, t) {
    const fl = Math.sin(t * 10) * 7.5;
    // articulated membranous dragon wings with visible finger struts
    g.fillStyle = '#225e52';
    tri(g, -5, -10, 7, -10, -2, -23 - fl);
    tri(g, -5, -10, 7, -10, -9, -19 - fl * 0.6);
    // wing bone strut lines
    g.strokeStyle = '#163d35'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(-2, -23 - fl); g.moveTo(0, -10); g.lineTo(-9, -19 - fl * 0.6); g.stroke();
    // serpentine body with gradient
    const bg = g.createRadialGradient(0, -9, 2, 0, -9, 10);
    bg.addColorStop(0, '#3f9a85'); bg.addColorStop(1, '#205c4e');
    g.fillStyle = bg; g.beginPath(); g.ellipse(0, -9.2, 11, 5, 0, 0, Math.PI * 2); g.fill();
    // whipping tail with venomous barbed stinger
    g.strokeStyle = '#2b7868'; g.lineWidth = 2.8;
    g.beginPath(); g.moveTo(-10, -9); g.quadraticCurveTo(-17, -6, -19, -11 + Math.sin(t * 5) * 2.5); g.stroke();
    tri(g, -19, -11, -23, -15, -20, -7, '#163d35');
    // horned dragon head with predatory slit eye
    rrect(g, 8.5, -14, 7.8, 5.5, 1.5); g.fillStyle = '#2b7868'; g.fill();
    circ(g, 12, -12.5, 1.6, '#ffd700'); circ(g, 12.2, -12.5, 0.6, '#111');
    tri(g, 9.5, -14, 8.5, -18.5, 11.5, -14, '#e4dcce');
  },
  lich(g, t, mv, e) {
    // ceremonial necromancer robes with necrotic soul runes
    const lg = g.createLinearGradient(0, -24, 0, 0);
    lg.addColorStop(0, '#2b2138'); lg.addColorStop(1, '#181222');
    g.fillStyle = lg; g.beginPath(); g.moveTo(-5.5, -23); g.lineTo(5.5, -23); g.lineTo(9, 0); g.lineTo(-9, 0); g.closePath(); g.fill();
    // glowing green runic borders
    g.fillStyle = '#8ce858'; g.fillRect(-6.5, -17, 13, 1.5);
    for (let rx = -5; rx <= 5; rx += 2.5) circ(g, rx, -6, 0.8, '#8ce858');
    // ancient skull with burning green soul fire in eye sockets
    rrect(g, -4.2, -30.5, 8.4, 8.2, 2.2); g.fillStyle = '#ddd5c2'; g.fill();
    // soul fire eyes
    g.fillStyle = '#111'; circ(g, -1.8, -27.5, 1.8); circ(g, 2.0, -27.5, 1.8);
    g.fillStyle = '#8ce858'; g.shadowColor = '#8ce858'; g.shadowBlur = 6;
    circ(g, -1.6, -27.5, 1.0); circ(g, 2.2, -27.5, 1.0);
    g.shadowBlur = 0;
    // filigreed golden circlet / crown
    g.fillStyle = '#d4af37';
    rrect(g, -4.5, -32.5, 9, 2.2, 0.6); g.fill();
    tri(g, -3.5, -32.5, -2, -36, -0.5, -32.5); tri(g, 0.5, -32.5, 2, -36, 3.5, -32.5);
    if (e && e.arch) {
      // Archlich hovering soul aura
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.28 + Math.sin(t * 3) * 0.12; circ(g, 0, -18, 17, '#7bd34a');
      g.restore();
    }
    // gnarled necromancer staff with flaming green skull
    rr(g, 7.5, -32, 1.8, 32, '#382b1c');
    circ(g, 8.4, -33, 3.2, '#7bd34a'); circ(g, 8.4, -33, 1.8, '#ffffff');
  },
  drake(g, t, mv, e) {
    const gold = e && e.goldDragon, magma = e && e.magma;
    const body = gold ? '#e8b832' : magma ? '#382220' : '#c2382c',
      belly = gold ? '#fff0a0' : magma ? '#ff8c24' : '#e89e52',
      wing = gold ? '#d49b20' : magma ? '#5c1e14' : '#96251c',
      dark = gold ? '#9a6c12' : magma ? '#ff5510' : '#681812';
    const fl = Math.sin(t * (gold ? 5 : 8)) * 8.5;
    // membranous wings with articulated finger struts and realistic translucency
    tri(g, -7, -13, 9, -13, -2, -32 - fl, wing);
    tri(g, -7, -13, 9, -13, -15, -25 - fl * 0.6, shade(wing, 1.15));
    g.strokeStyle = dark; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, -13); g.lineTo(-2, -32 - fl); g.moveTo(0, -13); g.lineTo(-15, -25 - fl * 0.6); g.stroke();
    // muscular serpentine neck and tail
    g.strokeStyle = body; g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(-11, -10); g.quadraticCurveTo(-21, -4, -25, -13 + Math.sin(t * 4) * 3); g.stroke();
    tri(g, -25, -13, -29, -16, -26, -9, dark); // tail spade
    // scaled body with segmented ventral scutes (belly plates)
    const dg = g.createRadialGradient(0, -10, 2, 0, -10, 14);
    dg.addColorStop(0, shade(body, 1.25)); dg.addColorStop(1, body);
    g.fillStyle = dg; g.beginPath(); g.ellipse(0, -10.5, 14, 6.8, 0, 0, Math.PI * 2); g.fill();
    // segmented belly plates
    g.fillStyle = belly; g.beginPath(); g.ellipse(1, -7.5, 11, 3.4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = dark; g.lineWidth = 0.6;
    for (let sx = -7; sx <= 9; sx += 3.2) { g.beginPath(); g.moveTo(sx, -9); g.lineTo(sx, -6); g.stroke(); }
    // horned dragon head with scaly snout and predatory eye
    rr(g, 10.5, -19, 4.5, 9, body);
    rrect(g, 12.5, -22.5, 10, 6.8, 1.8); g.fillStyle = body; g.fill();
    circ(g, 17, -21, 1.8, '#ffea22'); circ(g, 17.2, -21, 0.7, '#111');
    // horns with ridge texture
    tri(g, 13.5, -22.5, 12, -28, 16.5, -22.5, dark);
    tri(g, 17, -22.5, 17, -27, 19.5, -22.5, dark);
    // talons
    rr(g, -6 + mv, -5.5, 3.4, 5.5, dark); rr(g, 5.5 - mv, -5.5, 3.4, 5.5, dark);
    if (e && e.breathing) {
      g.save(); g.globalCompositeOperation = 'lighter';
      circ(g, 25, -18, 5, 'rgba(255,180,40,0.6)');
      circ(g, 25, -18, 2.5, '#ffffff');
      g.restore();
    }
    if (gold) {
      // Aurex specular gold scale reflections
      g.fillStyle = 'rgba(255,255,255,0.45)';
      circ(g, 3, -12, 1.4); circ(g, -4, -13, 1.2); circ(g, 16, -21.5, 0.9);
    }
  },
};
SPRITES.goblin_king = function (g, t, mv) {
  g.fillStyle = '#8a1f2a'; g.beginPath(); g.moveTo(-5, -14); g.lineTo(-11, 0); g.lineTo(-2, -2); g.closePath(); g.fill();
  SPRITES.goblin(g, t, mv);
  // filigreed golden crown with ruby gems and royal ermine fur mantle
  rr(g, -4.5, -24.5, 10, 3.5, '#ffd700');
  tri(g, -4.5, -24.5, -3.5, -28.5, -2, -24.5, '#ffd700');
  tri(g, -0.8, -24.5, 0.5, -29.5, 1.8, -24.5, '#ffd700');
  tri(g, 3, -24.5, 4.5, -28.5, 5.5, -24.5, '#ffd700');
  circ(g, 0.5, -24, 1.2, '#d8223a'); // center ruby
};
SPRITES.witch_queen = (g, t, mv, e) => SPRITES.witch(g, t, mv, {queen:true});
SPRITES.ogre_warlord = (g, t, mv, e) => SPRITES.ogre(g, t, mv, {warlord:true});
SPRITES.archlich = (g, t, mv, e) => SPRITES.lich(g, t, mv, {arch:true});
SPRITES.gold_dragon = (g, t, mv, e) => SPRITES.drake(g, t, mv, {goldDragon:true, breathing:e && e.breathing});
SPRITES.orc_warchief = function (g, t, mv) {
  g.fillStyle = '#9c1c1c'; g.beginPath(); g.moveTo(-6, -23); g.lineTo(-12, 0); g.lineTo(-1, -3); g.closePath(); g.fill();
  SPRITES.orc(g, t, mv);
  // heavy horned iron helm with ridge texture and skull pauldron
  rr(g, -6.5, -32.5, 13, 4.5, '#5d616b');
  tri(g, -6.5, -31.5, -12.5, -39, -4.5, -32.5, '#ded6c4');
  tri(g, 6.5, -31.5, 12.5, -39, 4.5, -32.5, '#ded6c4');
  circ(g, -7.5, -22.5, 2.5, '#ded6c4'); circ(g, -7.5, -22.5, 1.0, '#111'); // skull pauldron
};
SPRITES.bloodmoon_alpha = function (g, t, mv) {
  // blood-red moon halo behind the alpha werewolf
  g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.28 + Math.sin(t * 2.5) * 0.08; circ(g, -2, -28, 13, '#ff2233');
  g.restore();
  SPRITES.werewolf(g, t, mv);
  // glowing blood-red predatory eyes and battle scars
  g.fillStyle = '#ff1122'; circ(g, 2.5, -29.2, 1.9); circ(g, 2.8, -29.2, 0.7, '#fff');
  g.strokeStyle = '#c81818'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(4, -28); g.lineTo(7.5, -26); g.stroke();
};
SPRITES.magma_wyrm = function (g, t, mv, e) {
  SPRITES.drake(g, t, mv, {magma:true, breathing:e && e.breathing});
  // incandescent molten lava veins cracking across volcanic obsidian scales
  g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.75 + Math.sin(t * 4.5) * 0.25;
  g.strokeStyle = '#ff9020'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-7, -13); g.lineTo(-3, -11); g.lineTo(3, -13); g.lineTo(8, -10); g.stroke();
  g.strokeStyle = '#ffee60'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(-4, -12); g.lineTo(2, -12.5); g.stroke();
  g.restore();
};

// ===== Projectiles =====
// Your own spells: a glowing trail, a big bright halo, and a larger core.
const SPELL_COL = {hex:['#c87bff', '#f6e0ff'], skull:['#8fef5a', '#efffe0'], coin:['#ffcc33', '#fff7cc'], thorn:['#5fe048', '#eaffd8']};
function drawSpell(g, p, time) {
  const big = p.type === 'burst', S = big ? 1.8 : 1;
  const c = big ? [p.col || '#c08cff', '#ffffff'] : SPELL_COL[p.type], sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 1; i <= 7; i++) { const k = i / 7; g.globalAlpha = 0.4 * (1 - k); circ(g, p.x - ux * i * 4.5 * S, p.y - uy * i * 4.5 * S, 7 * S * (1 - k * 0.6), c[0]); }
  const R = (14 + Math.sin(time * 22 + p.x * 0.1) * 2) * S;
  const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
  gr.addColorStop(0, c[1]); gr.addColorStop(0.3, c[0]); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.95; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.fill();
  // little sparkles spinning around it
  g.globalAlpha = 0.9;
  for (let i = 0; i < (big ? 6 : 3); i++) { const a = time * 9 + i * (big ? 1.05 : 2.1); circ(g, p.x + Math.cos(a) * 7 * S, p.y + Math.sin(a) * 7 * S, 1.1 * S, c[1]); }
  g.restore();
  g.save(); g.translate(p.x, p.y);
  if (big) { circ(g, 0, 0, 7, c[0]); circ(g, 0, 0, 4.5, '#ffffff'); }
  else if (p.type === 'hex') { circ(g, 0, 0, 4.2, c[0]); circ(g, 0, 0, 2.6, '#ffffff'); }
  else if (p.type === 'skull') { g.scale(1.6, 1.6); rr(g, -2.5, -2.5, 5, 4, '#f2eedd'); rr(g, -1.5, -1.5, 1, 1, '#1a1a1a'); rr(g, 0.5, -1.5, 1, 1, '#1a1a1a'); rr(g, -1, 1.5, 2, 1, '#f2eedd'); }
  else if (p.type === 'coin') { circ(g, 0, 0, p.r + 1.5, '#f5cc45'); circ(g, -1, -1, (p.r + 1.5) * 0.45, '#fffbe0'); }
  else if (p.type === 'thorn') { g.rotate(Math.atan2(p.vy, p.vx)); g.scale(1.6, 1.6); rr(g, -5, -1, 10, 2, '#5fbf4a'); tri(g, 5, -2, 5, 2, 8, 0, '#d8ffc8'); }
  g.restore();
}
function drawProjectile(g, p, time) {
  if (p.owner === 'p' && (SPELL_COL[p.type] || p.type === 'burst')) { drawSpell(g, p, time); return; }
  switch (p.type) {
    case 'hex': case 'hexbolt':
      g.globalAlpha = 0.4; circ(g, p.x, p.y, 5, '#b05be0'); g.globalAlpha = 1; circ(g, p.x, p.y, 2.5, '#e8a0ff'); break;
    case 'skull': case 'skullbolt':
      g.globalAlpha = 0.4; circ(g, p.x, p.y, 5, '#9be36b'); g.globalAlpha = 1; rr(g, p.x - 2.5, p.y - 2.5, 5, 4, '#e6e0cf'); rr(g, p.x - 1.5, p.y - 1.5, 1, 1, '#1a1a1a'); rr(g, p.x + 0.5, p.y - 1.5, 1, 1, '#1a1a1a'); break;
    case 'fireball': case 'fire': case 'breath':
      g.globalAlpha = 0.45; circ(g, p.x, p.y, p.r + 3, '#ff6a1a'); g.globalAlpha = 1; circ(g, p.x, p.y, p.r, '#ffcc4a'); break;
    case 'coin': case 'goldrain':
      circ(g, p.x, p.y, p.r, '#f5cc45'); circ(g, p.x - 0.8, p.y - 0.8, p.r * 0.4, '#fff2a8'); break;
    case 'thorn':
      g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx)); rr(g, -5, -1, 10, 2, '#5fbf4a'); tri(g, 5, -2, 5, 2, 8, 0, '#8fe07a'); g.restore(); break;
    case 'shard':
      rr(g, p.x - 1.5, p.y - 1.5, 3, 3, '#ece5cf'); break;
    case 'flamewave':
      g.globalAlpha = 0.6; g.fillStyle = '#ff6a1a';
      g.beginPath(); g.ellipse(p.x, p.y, 6, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffcc4a'; g.beginPath(); g.ellipse(p.x, p.y, 3, 8, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; break;
    case 'shock':
      g.globalAlpha = 0.7; tri(g, p.x - 6, p.y + 6, p.x + 6, p.y + 6, p.x, p.y - 10, '#d8b878'); g.globalAlpha = 1; break;
    case 'bag':
      circ(g, p.x, p.y, 4, '#8a5a2b'); rr(g, p.x - 1, p.y - 6, 2, 2, '#f5cc45'); break;
    case 'lure':
      circ(g, p.x, p.y, 4, '#f5cc45'); circ(g, p.x - 1, p.y - 1, 1.5, '#fff6c8'); break;
    case 'bone':
      g.save(); g.translate(p.x, p.y); g.rotate(time * 10); rr(g, -4, -1, 8, 2, '#e6e0cf'); g.restore(); break;
    default:
      circ(g, p.x, p.y, p.r || 3, '#fff');
  }
}
