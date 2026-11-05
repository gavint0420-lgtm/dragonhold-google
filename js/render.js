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
  g.fillStyle = col; rrect(g, -w / 2, -0.6, w, len + 0.6, w / 2); g.fill(); g.stroke();
  if (endCol) { g.fillStyle = endCol; rrect(g, -w / 2 - 0.2, len - endLen, w + 1.5, endLen + 0.4, 1.1); g.fill(); g.stroke(); }
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
  // cape flows behind, further when running or falling
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
  }
  // far limbs
  if (!o.dress) limb(g, -0.8, hipY, -legA, 10.6, 3.7, shade(o.legs, 0.72), shade(o.boots, 0.75), 3.2);
  limb(g, -1.8, -19.6 + bob, (o.air ? -0.5 : -Math.sin(ph) * 0.5 * mv) + 0.15, 8, 3, shade(o.body, 0.7), shade(o.glove || '#f0c8a0', 0.8), 2.2);
  // skirt or near leg
  if (o.dress) {
    const sg = g.createLinearGradient(0, -14 + bob, 0, 0);
    sg.addColorStop(0, shade(o.body, 1.1)); sg.addColorStop(1, shade(o.body, 0.78));
    g.fillStyle = sg; g.beginPath(); g.moveTo(-4.5, -13 + bob); g.lineTo(4.5, -13 + bob);
    g.quadraticCurveTo(6.8, -5, 7 + Math.sin(time * 2) * 0.4, 0); g.lineTo(-7, 0); g.quadraticCurveTo(-6.8, -5, -4.5, -13 + bob);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = o.trim; g.fillRect(-6.8, -1.6, 13.6, 1.3);
  } else limb(g, 1.2, hipY, legA, 10.6, 3.7, o.legs, o.boots, 3.2);
  // torso
  const tg = g.createLinearGradient(0, -23 + bob, 0, -10 + bob);
  tg.addColorStop(0, shade(o.body, 1.22)); tg.addColorStop(1, shade(o.body, 0.86));
  g.fillStyle = tg; rrect(g, -5, -22.8 + bob, 10, 12.8, 3.2); g.fill(); g.stroke();
  g.fillStyle = o.trim; rrect(g, -5, -12.6 + bob, 10, 2.1, 1); g.fill();
  if (o.helm) { g.fillStyle = shade(o.trim, 1.05); g.beginPath(); g.arc(0.6, -17.8 + bob, 1.6, 0, Math.PI * 2); g.fill(); }
  else { g.fillStyle = shade(o.body, 0.75); g.fillRect(-0.4, -22 + bob, 0.9, 9); }
  // head
  const hx = 0.6, hy = -27 + bob;
  if (o.helm) {
    const hg = g.createRadialGradient(hx - 1.5, hy - 2, 0.5, hx, hy, 5.2);
    hg.addColorStop(0, shade(o.helm, 1.45)); hg.addColorStop(1, shade(o.helm, 0.82));
    g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 4.7, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#16121c'; rrect(g, hx + 0.2, hy - 0.6, 4.4, 1.5, 0.7); g.fill();
    g.fillStyle = shade(o.helm, 0.7); g.fillRect(hx - 0.3, hy - 4.6, 0.9, 9.2);
    if (o.plume) {
      g.fillStyle = o.trim; g.beginPath(); g.moveTo(hx - 1, hy - 4.3);
      g.quadraticCurveTo(hx - 3, hy - 9.5, hx - 8 - Math.sin(time * 5) * 0.8, hy - 6.5);
      g.quadraticCurveTo(hx - 4, hy - 6, hx + 1, hy - 4); g.fill(); g.stroke();
    } else { g.fillStyle = o.cape || o.trim; g.beginPath(); g.ellipse(hx - 0.3, hy - 5, 1.2, 1.8, -0.3, 0, Math.PI * 2); g.fill(); }
  } else if (o.hood) {
    // Assassin hood & cowl
    const hg = g.createRadialGradient(hx - 1, hy - 2, 0.5, hx, hy, 5.2);
    hg.addColorStop(0, shade(o.hoodCol || '#2a2233', 1.3));
    hg.addColorStop(1, shade(o.hoodCol || '#2a2233', 0.8));
    g.fillStyle = hg;
    g.beginPath(); g.arc(hx, hy, 4.8, 0, Math.PI * 2); g.fill(); g.stroke();
    // trailing cowl at the back
    g.beginPath(); g.moveTo(hx, hy - 4.6);
    g.quadraticCurveTo(hx - 4, hy - 8, hx - 8 - Math.sin(time * 5) * 0.7, hy - 5);
    g.quadraticCurveTo(hx - 4, hy - 2, hx - 2, hy + 2);
    g.closePath(); g.fill(); g.stroke();
    // shadow recess inside hood
    g.fillStyle = '#0f0c14';
    g.beginPath(); g.arc(hx + 1.2, hy - 0.2, 3.2, 0, Math.PI * 2); g.fill();
    // assassin mask covering mouth & nose
    if (o.mask) {
      g.fillStyle = o.maskCol || '#241a2c';
      rrect(g, hx - 0.2, hy - 0.2, 4.4, 3.8, 0.8); g.fill(); g.stroke();
    }
    // focused glowing assassin eye
    g.fillStyle = o.eyeCol || '#ffb347';
    g.beginPath(); g.arc(hx + 2.3, hy - 1.0, 0.9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(hx + 2.5, hy - 1.2, 0.35, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = o.skin || '#f0c8a0'; g.beginPath(); g.arc(hx, hy, 4.3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = o.hair;
    g.beginPath(); g.arc(hx - 0.4, hy - 0.8, 4.4, Math.PI * 0.92, Math.PI * 2.08); g.lineTo(hx + 1.5, hy - 2); g.lineTo(hx - 3.5, hy + 0.5); g.closePath(); g.fill();
    if (o.long) { rrect(g, hx - 5, hy - 1.5, 3, 9, 1.4); g.fill(); }
    g.fillStyle = '#1e1a22'; g.beginPath(); g.arc(hx + 2.3, hy - 0.2, 0.65, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(220,120,110,0.5)'; g.beginPath(); g.arc(hx + 2.2, hy + 1.6, 0.8, 0, Math.PI * 2); g.fill();
    if (o.beard) { g.fillStyle = o.beard; g.beginPath(); g.moveTo(hx - 1.5, hy + 1.2); g.quadraticCurveTo(hx + 2, hy + 7, hx + 4.2, hy + 1.4); g.closePath(); g.fill(); }
  }
  if (o.hat) {
    g.fillStyle = o.hat; g.beginPath(); g.ellipse(hx, hy - 3, 7, 1.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(hx - 4, hy - 3.5); g.quadraticCurveTo(hx - 1, hy - 9, hx - 4 + Math.sin(time * 1.5), hy - 13); g.quadraticCurveTo(hx + 1, hy - 8, hx + 4, hy - 3.5); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#f5cc45'; g.beginPath(); g.arc(hx - 0.5, hy - 7, 0.9, 0, Math.PI * 2); g.fill();
    if (o.arcaneEye) {
      g.fillStyle = o.arcaneEye;
      g.beginPath(); g.arc(hx + 2.3, hy - 0.3, 1.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(hx + 2.6, hy - 0.5, 0.4, 0, Math.PI * 2); g.fill();
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
    rr(g, -3 + mv * 0.5, -7, 2.5, 7, '#3a2a1a'); rr(g, 0.5 - mv * 0.5, -7, 2.5, 7, '#3a2a1a');
    rr(g, -4, -13, 8, 7, '#7a5a3a'); rr(g, -4, -9, 8, 1, '#4a3a2a');
    rr(g, -4, -20, 9, 7, '#6f9a3c'); tri(g, -4, -18, -9, -21, -4, -15, '#6f9a3c'); tri(g, 4, -18, 8, -21, 4, -15, '#6f9a3c');
    rr(g, 1, -18, 2, 2, '#ff3a3a'); rr(g, 1, -15, 3, 1, '#2a2a1a');
    rr(g, 4, -12, 1.5, 5, '#a8683a');
  },
  rat(g, t, mv) {
    g.strokeStyle = '#d08a8a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8, -4); g.quadraticCurveTo(-14, -8 + Math.sin(t * 6) * 2, -16, -2); g.stroke();
    g.fillStyle = '#7d6b5d'; g.beginPath(); g.ellipse(-1, -5, 9, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(7, -5, 4, 3.2, 0.2, 0, Math.PI * 2); g.fill();
    circ(g, 6, -9, 2, '#a08a7a'); rr(g, 8, -6, 1.5, 1.5, '#ff3a3a'); rr(g, 10.5, -5, 1.5, 1.2, '#d08a8a');
    rr(g, -5 + mv, -1, 2, 1.5, '#5d4b3d'); rr(g, 3 - mv, -1, 2, 1.5, '#5d4b3d');
  },
  skeleton(g, t, mv, e) {
    const c = e && e.ally ? '#c8f0b0' : '#e6e0cf';
    rr(g, -3 + mv * 0.5, -10, 2, 10, c); rr(g, 1 - mv * 0.5, -10, 2, 10, c);
    rr(g, -1, -19, 2, 9, c); for (let i = 0; i < 3; i++) rr(g, -4, -18 + i * 2.5, 8, 1.2, c);
    rr(g, -4, -27, 8, 7, c); rr(g, -2.5, -25, 2, 2, '#1a1a1a'); rr(g, 1, -25, 2, 2, e && e.ally ? '#7bd34a' : '#1a1a1a'); rr(g, -2, -21.5, 4, 1, '#1a1a1a');
    rr(g, 4, -18, 1.5, 8, c); rr(g, 4.5, -24, 1.5, 7, '#cfc6ad');
  },
  orc(g, t, mv) {
    humanoidBase(g, mv, '#4f7a3a', '#6b4a2a', '#3a2a1a', 29);
    rr(g, -5, -22, 10, 2, '#8a8f99');
    rr(g, -5, -29, 10, 8, '#4f7a3a'); rr(g, 1, -27, 2, 1.5, '#ff3a3a'); rr(g, 2, -23, 1.2, 2.5, '#f0ead6'); rr(g, -1.5, -23, 1.2, 2.5, '#f0ead6');
    rr(g, 5, -20, 2, 10, '#5a3f26'); rr(g, 5, -24, 5, 5, '#8a8f99');
  },
  witch(g, t, mv, e) {
    const robe = e && e.queen ? '#3a1f5a' : '#5b3e7a';
    g.fillStyle = robe; g.beginPath(); g.moveTo(-4, -20); g.lineTo(4, -20); g.lineTo(7, 0); g.lineTo(-7, 0); g.closePath(); g.fill();
    rr(g, -3.5, -27, 7, 7, '#8fbf6a'); rr(g, 1, -25, 1.5, 1.5, '#ffeb3b'); rr(g, 3, -23, 2, 2, '#8fbf6a');
    rr(g, -4, -27, 2, 7, '#2a2a2a');
    tri(g, -7, -27, 7, -27, -2, -40, '#1f1a26'); rr(g, -7, -28, 14, 1.5, '#1f1a26');
    if (e && e.queen) { rr(g, -4, -31, 8, 2, '#f5cc45'); rr(g, -3, -33, 1.5, 2, '#f5cc45'); rr(g, 1, -33, 1.5, 2, '#f5cc45'); }
    rr(g, 6, -26, 1.5, 26, '#4a3020'); g.globalAlpha = 0.6 + Math.sin(t * 5) * 0.3; circ(g, 6.7, -27, 2.5, '#b05be0'); g.globalAlpha = 1;
  },
  spider(g, t) {
    g.strokeStyle = '#2a1f2f'; g.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) {
      const ph = Math.sin(t * 14 + i) * 2;
      g.beginPath(); g.moveTo(0, -7); g.lineTo(-5 - i * 2.5, -11 + ph); g.lineTo(-7 - i * 2.5, 0); g.stroke();
      g.beginPath(); g.moveTo(0, -7); g.lineTo(5 + i * 2.5, -11 - ph); g.lineTo(7 + i * 2.5, 0); g.stroke();
    }
    g.fillStyle = '#3a2a45'; g.beginPath(); g.ellipse(-4, -7, 7, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(5, -6, 4, 3.5, 0, 0, Math.PI * 2); g.fill();
    rr(g, -6, -9, 4, 1, '#c04040');
    rr(g, 6, -8, 1.5, 1.5, '#ff3a3a'); rr(g, 8, -7, 1.5, 1.5, '#ff3a3a');
  },
  werewolf(g, t, mv) {
    rr(g, -4 + mv * 0.6, -11, 3.5, 11, '#5a4a3e'); rr(g, 0.5 - mv * 0.6, -11, 3.5, 11, '#5a4a3e');
    rr(g, -6, -23, 12, 13, '#6e5c4e'); rr(g, -3, -21, 6, 8, '#8f7d6e');
    rr(g, -4, -30, 9, 8, '#6e5c4e'); rr(g, 4, -27, 5, 4, '#6e5c4e'); rr(g, 8, -27, 1.5, 1.5, '#1a1a1a');
    tri(g, -4, -30, -2, -35, 0, -30, '#5a4a3e'); tri(g, 1, -30, 3, -35, 5, -30, '#5a4a3e');
    rr(g, 2, -28, 1.5, 1.5, '#ffd700'); rr(g, 5, -23.5, 3, 1, '#f0ead6');
    rr(g, 5, -20, 3, 9, '#6e5c4e'); rr(g, 7, -12, 2, 2, '#f0ead6');
  },
  troll(g, t, mv) {
    rr(g, -6 + mv * 0.5, -13, 5, 13, '#5e7366'); rr(g, 1 - mv * 0.5, -13, 5, 13, '#5e7366');
    rr(g, -7, -15, 14, 4, '#6b4a2a');
    rr(g, -8, -30, 16, 16, '#6f8a78'); rr(g, -5, -36, 10, 7, '#6f8a78');
    rr(g, 3, -34, 2, 2, '#ffeb3b'); rr(g, 4, -32, 4, 3, '#5e7366'); rr(g, 1, -30, 4, 1, '#2a2a2a');
    rr(g, 7, -28, 4, 18, '#6f8a78'); rr(g, -11, -28, 4, 16, '#5e7366');
  },
  wraith(g, t) {
    const bob = Math.sin(t * 3) * 2;
    g.globalAlpha *= 0.85;
    g.fillStyle = '#28324a'; g.beginPath(); g.moveTo(-7, -24 + bob); g.lineTo(7, -24 + bob);
    g.lineTo(6, -6 + bob); g.lineTo(2, -2 + Math.sin(t * 6) * 2); g.lineTo(-2, -5 + bob); g.lineTo(-6, 0 + Math.sin(t * 5) * 2); g.closePath(); g.fill();
    circ(g, 0, -24 + bob, 6, '#1e2638');
    rr(g, -2, -25 + bob, 2, 2, '#8ff0ff'); rr(g, 2, -25 + bob, 2, 2, '#8ff0ff');
    g.globalAlpha = 1;
  },
  ogre(g, t, mv, e) {
    rr(g, -9 + mv * 0.5, -14, 7, 14, '#8a6e52'); rr(g, 2 - mv * 0.5, -14, 7, 14, '#8a6e52');
    rr(g, -10, -16, 20, 4, '#5a3f26');
    g.fillStyle = '#c9a27e'; g.beginPath(); g.ellipse(0, -26, 12, 12, 0, 0, Math.PI * 2); g.fill();
    rr(g, -5, -42, 10, 9, '#c9a27e'); rr(g, 2, -39, 2, 2, '#2a2a2a'); rr(g, 0, -35, 5, 1.5, '#6a4a3a'); rr(g, 1, -36, 1, 2, '#f0ead6');
    if (e && e.warlord) { rr(g, -6, -44, 12, 4, '#6f7380'); tri(g, -6, -44, -10, -50, -4, -44, '#e8e0d0'); tri(g, 6, -44, 10, -50, 4, -44, '#e8e0d0'); }
    rr(g, 10, -32, 5, 16, '#c9a27e');
    rr(g, 11, -44, 3, 28, '#6b4423'); rr(g, 9, -50, 7, 9, '#5a3f26');
  },
  dark_knight(g, t, mv) {
    humanoidBase(g, mv, '#222', '#1f1d26', '#16151b', 31);
    rr(g, -5, -24, 10, 2, '#3a3646');
    rr(g, -4.5, -31, 9, 8, '#2a2833'); rr(g, 0, -28, 4.5, 1.5, '#ff2a2a');
    rr(g, -2, -35, 3, 5, '#a01818');
    rr(g, 5, -32, 2, 22, '#5a3a8a'); rr(g, 3, -12, 6, 2, '#3a3646');
  },
  wyvern(g, t) {
    const fl = Math.sin(t * 10) * 7;
    tri(g, -4, -10, 6, -10, -2, -22 - fl, '#2f7a6a'); tri(g, -4, -10, 6, -10, -8, -18 - fl * 0.6, '#3f9a85');
    g.fillStyle = '#3a8a76'; g.beginPath(); g.ellipse(0, -9, 10, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a8a76'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-9, -9); g.quadraticCurveTo(-16, -6, -18, -11 + Math.sin(t * 5) * 2); g.stroke();
    rr(g, 8, -13, 7, 5, '#3a8a76'); rr(g, 13, -12, 3, 2, '#2f7a6a'); rr(g, 11, -12, 1.5, 1.5, '#ffeb3b');
    tri(g, 9, -13, 8, -17, 11, -13, '#e0d8c0');
  },
  lich(g, t, mv, e) {
    g.fillStyle = '#2a2236'; g.beginPath(); g.moveTo(-5, -22); g.lineTo(5, -22); g.lineTo(8, 0); g.lineTo(-8, 0); g.closePath(); g.fill();
    rr(g, -5, -16, 10, 1.5, '#9be36b');
    rr(g, -3.5, -29, 7, 7, '#d8d2c0'); rr(g, -2, -27, 2, 2, '#9be36b'); rr(g, 1.5, -27, 2, 2, '#9be36b');
    rr(g, -4, -31, 8, 2, '#c9a440'); rr(g, -3.5, -33, 1.5, 2, '#c9a440'); rr(g, 2, -33, 1.5, 2, '#c9a440');
    if (e && e.arch) { g.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1; circ(g, 0, -18, 16, '#9be36b'); g.globalAlpha = 1; }
    rr(g, 7, -30, 1.5, 30, '#3a3020'); circ(g, 7.7, -31, 2.5, '#9be36b');
  },
  drake(g, t, mv, e) {
    const gold = e && e.goldDragon, magma = e && e.magma;
    const body = gold ? '#e0a82a' : magma ? '#3a2422' : '#b8322a', belly = gold ? '#ffe08a' : magma ? '#ff8a1f' : '#e8a050',
      wing = gold ? '#c48a1c' : magma ? '#5a1e14' : '#8a2018', dark = gold ? '#8a5a10' : magma ? '#ff5a14' : '#5a1410';
    const fl = Math.sin(t * (gold ? 5 : 8)) * 8;
    tri(g, -6, -12, 8, -12, -2, -30 - fl, wing); tri(g, -6, -12, 8, -12, -14, -24 - fl * 0.6, shade(wing, 1.15));
    g.strokeStyle = body; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -10); g.quadraticCurveTo(-20, -4, -24, -12 + Math.sin(t * 4) * 3); g.stroke();
    tri(g, -24, -12, -28, -15, -25, -8, dark);
    g.fillStyle = body; g.beginPath(); g.ellipse(0, -10, 13, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = belly; g.beginPath(); g.ellipse(1, -7, 10, 3, 0, 0, Math.PI * 2); g.fill();
    rr(g, 10, -18, 4, 8, body);
    rr(g, 12, -21, 9, 6, body); rr(g, 19, -19, 4, 3, body); rr(g, 16, -20, 1.5, 1.5, '#ffeb3b');
    tri(g, 13, -21, 12, -26, 16, -21, dark); tri(g, 16, -21, 16, -25, 18, -21, dark);
    rr(g, -6 + mv, -5, 3, 5, dark); rr(g, 5 - mv, -5, 3, 5, dark);
    if (e && e.breathing) { g.globalAlpha = 0.7; circ(g, 24, -17, 3, '#ffcc4a'); g.globalAlpha = 1; }
  },
};
SPRITES.goblin_king = function (g, t, mv) {
  g.fillStyle = '#7a1f2a'; g.beginPath(); g.moveTo(-4, -13); g.lineTo(-9, 0); g.lineTo(-2, -2); g.closePath(); g.fill();
  SPRITES.goblin(g, t, mv);
  rr(g, -4, -23, 9, 3, '#f5cc45'); rr(g, -4, -25, 2, 2, '#f5cc45'); rr(g, -0.5, -26, 2, 3, '#f5cc45'); rr(g, 3, -25, 2, 2, '#f5cc45'); rr(g, 0, -24, 1, 1, '#d8333a');
};
SPRITES.witch_queen = (g, t, mv, e) => SPRITES.witch(g, t, mv, {queen:true});
SPRITES.ogre_warlord = (g, t, mv, e) => SPRITES.ogre(g, t, mv, {warlord:true});
SPRITES.archlich = (g, t, mv, e) => SPRITES.lich(g, t, mv, {arch:true});
SPRITES.gold_dragon = (g, t, mv, e) => SPRITES.drake(g, t, mv, {goldDragon:true, breathing:e && e.breathing});
SPRITES.orc_warchief = function (g, t, mv) {
  // red war-cape, then the orc, then a horned iron helm and a skull pauldron
  g.fillStyle = '#8a1f1f'; g.beginPath(); g.moveTo(-5, -22); g.lineTo(-10, 0); g.lineTo(-1, -3); g.closePath(); g.fill();
  SPRITES.orc(g, t, mv);
  rr(g, -6, -31, 12, 4, '#5d616b'); rr(g, -6, -27.5, 12, 1, '#3a3d44');
  tri(g, -6, -30, -11, -37, -4, -31, '#e8e0d0'); tri(g, 6, -30, 11, -37, 4, -31, '#e8e0d0');
  rr(g, -7, -22, 4, 3, '#e6e0cf'); rr(g, -6, -21, 1, 1, '#1a1a1a');
};
SPRITES.bloodmoon_alpha = function (g, t, mv) {
  // a blood-red moon halo behind the werewolf, and glowing red eyes
  g.globalAlpha = 0.22 + Math.sin(t * 2) * 0.06; circ(g, -2, -28, 11, '#ff2a3a'); g.globalAlpha = 1;
  SPRITES.werewolf(g, t, mv);
  g.globalAlpha = 0.35; rr(g, -6, -23, 12, 13, '#3a0a10'); g.globalAlpha = 1;
  rr(g, 2, -28, 2, 1.8, '#ff2a3a'); rr(g, -3, -21, 1, 6, '#c8c0b0'); rr(g, -1, -21, 1, 5, '#c8c0b0');
};
SPRITES.magma_wyrm = function (g, t, mv, e) {
  SPRITES.drake(g, t, mv, {magma:true, breathing:e && e.breathing});
  // glowing cracks
  g.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
  rr(g, -6, -12, 4, 1, '#ffb030'); rr(g, 2, -14, 5, 1, '#ffb030'); rr(g, -2, -9, 3, 1, '#ffd060');
  g.globalAlpha = 1;
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
