'use strict';
// ===== Core constants =====
const TILE = 16, WW = 3300, WH = 240;
// The world used to be 2200 tiles wide. Map positions below are written for that size and
// stretched with MX(): the starting village stays put, the castle at the far end keeps its
// exact layout (it just moves east), and every area in between gets ~1.6x wider.
const OLD_WW = 2200, MX_VILLAGE = 130, MX_CASTLE = 1994;
function MX(x) {
  if (x <= MX_VILLAGE) return x;
  if (x >= MX_CASTLE) return x + (WW - OLD_WW);
  return Math.round(MX_VILLAGE + (x - MX_VILLAGE) * (WW - OLD_WW + MX_CASTLE - MX_VILLAGE) / (MX_CASTLE - MX_VILLAGE));
}

// ===== Tiles =====
const T = {AIR:0,DIRT:1,GRASS:2,STONE:3,MUD:4,SWAMPGRASS:5,DARKGRASS:6,SNOW:7,ASH:8,OBSIDIAN:9,BRICK:10,CASTLE:11,
  WOOD:12,LOG:13,LEAVES:14,DARKLEAVES:15,COAL:16,IRON:17,GOLD:18,MYTHRIL:19,TORCH:20,WORKBENCH:21,FURNACE:22,ANVIL:23,
  ALCHEMY:24,CHEST:25,WATER:26,LAVA:27,HERB_RED:28,HERB_BLUE:29,HERB_SWAMP:30,HERB_FROST:31,HERB_GRAVE:32,HERB_FIRE:33,
  ALTAR:34,WAYSTONE:35,BEDROCK:36,BARS:37,HOARD:38,DEADGRASS:39,CHEST_OPEN:40,LADDER:41};
const TP = [];
function tp(id, o) { TP[id] = Object.assign({solid:false, hard:1, c:'#000', c2:'#000', drop:null, light:0, name:''}, o); }
tp(T.AIR, {hard:0});
tp(T.DIRT, {solid:true, c:'#7a4e2d', c2:'#61391f', drop:'dirt'});
tp(T.GRASS, {solid:true, c:'#7a4e2d', c2:'#61391f', top:'#55a23c', top2:'#3f8a2e', drop:'dirt'});
tp(T.STONE, {solid:true, hard:2, c:'#6d6f78', c2:'#585a63', drop:'stone'});
tp(T.MUD, {solid:true, c:'#4a3b2c', c2:'#3a2d21', drop:'mud'});
tp(T.SWAMPGRASS, {solid:true, c:'#4a3b2c', c2:'#3a2d21', top:'#6b8a2e', top2:'#55702a', drop:'mud'});
tp(T.DARKGRASS, {solid:true, c:'#5a3d2a', c2:'#442d1d', top:'#2f6a44', top2:'#24553a', drop:'dirt'});
tp(T.DEADGRASS, {solid:true, c:'#5c4d3e', c2:'#46392d', top:'#7d7452', top2:'#665e42', drop:'dirt'});
tp(T.SNOW, {solid:true, c:'#e8eef5', c2:'#cdd8e4', drop:'snow'});
tp(T.ASH, {solid:true, c:'#3d3436', c2:'#2c2526', drop:'ash'});
tp(T.OBSIDIAN, {solid:true, hard:5, c:'#2a1f3d', c2:'#4b3870', drop:'obsidian'});
tp(T.BRICK, {solid:true, hard:3, c:'#7b7469', c2:'#5f594f', drop:'brick', brick:true});
tp(T.CASTLE, {solid:true, hard:99, c:'#4e4a5a', c2:'#3b3846', brick:true});
tp(T.WOOD, {solid:true, c:'#a8743f', c2:'#8a5c2e', drop:'wood', plank:true});
tp(T.LOG, {hard:1, c:'#6b4423', c2:'#53341a', drop:'wood', log:true});
tp(T.LEAVES, {hard:0.2, c:'#3f8a3a', c2:'#2f6e2c', leaves:true});
tp(T.DARKLEAVES, {hard:0.2, c:'#2b5a42', c2:'#1f4532', leaves:true});
tp(T.COAL, {solid:true, hard:2, c:'#6d6f78', c2:'#585a63', ore:'#1b1b20', drop:'coal'});
tp(T.IRON, {solid:true, hard:2, c:'#6d6f78', c2:'#585a63', ore:'#d2a57e', drop:'iron_ore'});
tp(T.GOLD, {solid:true, hard:3, c:'#6d6f78', c2:'#585a63', ore:'#f5cc45', drop:'gold_ore'});
tp(T.MYTHRIL, {solid:true, hard:4, c:'#4f5560', c2:'#3e434d', ore:'#5ee8cf', drop:'mythril_ore'});
tp(T.TORCH, {hard:0, drop:'torch', light:10, deco:true});
tp(T.WORKBENCH, {hard:0.5, drop:'workbench', station:'workbench', deco:true});
tp(T.FURNACE, {hard:1, drop:'furnace', station:'furnace', light:4, deco:true});
tp(T.ANVIL, {hard:1, drop:'anvil', station:'anvil', deco:true});
tp(T.ALCHEMY, {hard:0.5, drop:'alchemy', station:'alchemy', light:2, deco:true});
tp(T.CHEST, {hard:99, chest:true, deco:true});        // can't be broken; open it with left click, right click or F
tp(T.CHEST_OPEN, {hard:99, deco:true, name:'Empty chest'}); // stays in the world after you loot it
tp(T.LADDER, {hard:99, deco:true, ladder:true});              // climb with jump / up and down keys
tp(T.WATER, {hard:99, liquid:'water', c:'#2f6fb8'});
tp(T.LAVA, {hard:99, liquid:'lava', light:5, c:'#ff6a1a'});
tp(T.HERB_RED, {hard:0, plant:'#d8333a', drop:'herb_red', deco:true});
tp(T.HERB_BLUE, {hard:0, plant:'#3a7be0', drop:'herb_blue', deco:true});
tp(T.HERB_SWAMP, {hard:0, plant:'#d97ad1', drop:'herb_swamp', deco:true});
tp(T.HERB_FROST, {hard:0, plant:'#bfeaff', drop:'herb_frost', deco:true, light:2});
tp(T.HERB_GRAVE, {hard:0, plant:'#9be36b', drop:'herb_grave', deco:true, light:2});
tp(T.HERB_FIRE, {hard:0, plant:'#ff8a1f', drop:'herb_fire', deco:true, light:3});
tp(T.ALTAR, {hard:99, light:5, deco:true});
tp(T.WAYSTONE, {hard:99, light:5, deco:true});
tp(T.BEDROCK, {solid:true, hard:99, c:'#1e1c22', c2:'#2a272f'});
tp(T.BARS, {solid:true, hard:99, deco:true});
tp(T.HOARD, {solid:true, hard:99, light:3, c:'#e8b730', c2:'#c48f1c'});

// ===== Items =====
const ITEMS = {};
function it(id, o) { ITEMS[id] = Object.assign({id, name:id, kind:'mat', stack:99, desc:'', col:'#aaa'}, o); }
// blocks
it('dirt', {name:'Dirt', kind:'block', tile:T.DIRT, col:'#7a4e2d'});
it('stone', {name:'Stone', kind:'block', tile:T.STONE, col:'#6d6f78'});
it('mud', {name:'Mud', kind:'block', tile:T.MUD, col:'#4a3b2c'});
it('snow', {name:'Snow', kind:'block', tile:T.SNOW, col:'#e8eef5'});
it('ash', {name:'Ash', kind:'block', tile:T.ASH, col:'#3d3436'});
it('obsidian', {name:'Obsidian', kind:'block', tile:T.OBSIDIAN, col:'#4b3870', desc:'Volcanic glass. Used for dragonscale armor.'});
it('brick', {name:'Stone Brick', kind:'block', tile:T.BRICK, col:'#7b7469'});
it('wood', {name:'Wood', kind:'block', tile:T.WOOD, col:'#a8743f', desc:'Place as planks, or use for crafting.'});
it('torch', {name:'Torch', kind:'block', tile:T.TORCH, col:'#ffb347', desc:'Lights up dark caves.'});
it('workbench', {name:'Workbench', kind:'block', tile:T.WORKBENCH, col:'#a8743f', desc:'Crafting station. Stand near it to craft.'});
it('furnace', {name:'Furnace', kind:'block', tile:T.FURNACE, col:'#777', desc:'Smelts ore into bars.'});
it('anvil', {name:'Anvil', kind:'block', tile:T.ANVIL, col:'#555b66', desc:'Forge armor, pickaxes and lures.'});
it('alchemy', {name:'Alchemy Table', kind:'block', tile:T.ALCHEMY, col:'#7a5bb0', desc:'Brew health and mana potions.'});
// materials
it('coal', {name:'Coal', col:'#26262b', shape:'ore'});
it('iron_ore', {name:'Iron Ore', col:'#d2a57e', shape:'ore'});
it('gold_ore', {name:'Gold Ore', col:'#f5cc45', shape:'ore'});
it('mythril_ore', {name:'Mythril Ore', col:'#5ee8cf', shape:'ore'});
it('iron_bar', {name:'Iron Bar', col:'#b9b9c4', shape:'bar'});
it('gold_bar', {name:'Gold Bar', col:'#f5cc45', shape:'bar'});
it('steel_bar', {name:'Steel Bar', col:'#8fa6c2', shape:'bar'});
it('mythril_bar', {name:'Mythril Bar', col:'#5ee8cf', shape:'bar'});
it('dragonscale', {name:'Dragonscale', col:'#d8452b', shape:'scale', desc:'Dropped by Fire Drakes.'});
it('herb_red', {name:'Redcap', col:'#d8333a', shape:'herb', desc:'Forest herb for healing potions.'});
it('herb_blue', {name:'Bluebell', col:'#3a7be0', shape:'herb', desc:'Forest herb for mana potions.'});
it('herb_swamp', {name:'Bog Bloom', col:'#d97ad1', shape:'herb', desc:'Grows in the swamp and Duskwood.'});
it('herb_frost', {name:'Frost Lily', col:'#bfeaff', shape:'herb', desc:'Grows on Frostfang Peaks.'});
it('herb_grave', {name:'Grave Moss', col:'#9be36b', shape:'herb', desc:'Grows in the Ashen Ruins.'});
it('herb_fire', {name:'Fire Blossom', col:'#ff8a1f', shape:'herb', desc:'Grows on the volcano.'});
// tools
it('pick_old', {name:'Old Pickaxe', kind:'tool', stack:1, power:3, speed:1, col:'#8a8f99', desc:'Mines dirt, stone, coal, iron and gold.'});
it('pick_iron', {name:'Iron Pickaxe', kind:'tool', stack:1, power:4, speed:1.5, col:'#d2d2dc', desc:'Also mines mythril. Faster.'});
it('pick_mythril', {name:'Mythril Pickaxe', kind:'tool', stack:1, power:5, speed:2.2, col:'#5ee8cf', desc:'Also mines obsidian. Very fast.'});
// armor
it('armor_iron', {name:'Iron Armor', kind:'armor', stack:1, def:10, hp:20, col:'#a9acb5', desc:'Defense 10, +20 max health.'});
it('armor_steel', {name:'Steel Armor', kind:'armor', stack:1, def:20, hp:60, col:'#8fa6c2', desc:'Defense 20, +60 max health.'});
it('armor_mythril', {name:'Mythril Armor', kind:'armor', stack:1, def:32, hp:140, col:'#4fd6bd', desc:'Defense 32, +140 max health.'});
it('armor_dragon', {name:'Dragonscale Armor', kind:'armor', stack:1, def:45, hp:280, fireRes:true, col:'#c9382a', desc:'Defense 45, +280 max health. Resists fire and lava.'});
// potions
it('pot_h1', {name:'Minor Healing Potion', kind:'potion', heal:0.25, col:'#e04848', desc:'Restores 25% health.'});
it('pot_h2', {name:'Healing Potion', kind:'potion', heal:0.4, col:'#e02a5a', desc:'Restores 40% health.'});
it('pot_h3', {name:'Greater Healing Potion', kind:'potion', heal:0.6, col:'#ff3d7a', desc:'Restores 60% health.'});
it('pot_h4', {name:"Dragon's Blood", kind:'potion', heal:1, col:'#b3001b', desc:'Restores all health.'});
it('pot_m1', {name:'Minor Mana Potion', kind:'potion', mana:0.25, col:'#4a7ef0', desc:'Restores 25% mana.'});
it('pot_m2', {name:'Mana Potion', kind:'potion', mana:0.4, col:'#2f5be8', desc:'Restores 40% mana.'});
it('pot_m3', {name:'Greater Mana Potion', kind:'potion', mana:0.6, col:'#6a4bff', desc:'Restores 60% mana.'});
it('pot_m4', {name:'Arcane Elixir', kind:'potion', mana:1, col:'#b04bff', desc:'Restores all mana.'});
it('gold_lure', {name:'Gold Lure', kind:'lure', stack:10, col:'#f5cc45', desc:'Throw it. The Gilded Wyrm cannot resist gold: it stops to admire it and takes 50% more damage.'});

// ===== Weapons =====
const WTYPE = {
  dagger:{cd:0.22, range:35, kb:110, label:'Dagger · 15% critical hits', crit:0.15},
  sword:{cd:0.38, range:54, kb:280, label:'Broadsword · Heavy sweep & knockback'},
  mace:{cd:0.66, range:42, kb:320, label:'Mace'},
  wand:{cd:0.45, range:0, kb:60, label:'Wand'},
  bow:{cd:0.40, range:0, kb:90, label:'Bow · Long-range aimed arrows', crit:0.15},
};
function wpn(id, name, wt, dmg, o) {
  it(id, Object.assign({name, kind:'weapon', stack:1, wt, dmg}, o));
}
wpn('squire_blade', "Knight's Broadsword", 'sword', 16, {fx:'steady', range:58, kb:300, col:'#c8ccd6', fxName:'Steady', fxDesc:'+15% damage while at full health.'});
// starting weapons (pick one when you begin a new adventure)
wpn('squire_dirk', "Squire's Dirk", 'dagger', 6, {fx:'steady', col:'#d8dce4', fxName:'Steady', fxDesc:'+15% damage while at full health.'});
wpn('rogue_bow', "Rogue's Bow", 'bow', 12, {fx:'steady', col:'#8b5a2b', fxName:'Steady', fxDesc:'+15% damage while at full health.'});
wpn('apprentice_wand', 'Apprentice Wand', 'wand', 10, {fx:'slow', mana:2, cd:0.4, proj:'spark', col:'#c08cff', fxName:'Arcane Chill', fxDesc:'Sparks slow enemies by 40% for 2s.'});
const STARTER_WEAPONS = {sword:'squire_blade', dagger:'squire_dirk', wand:'apprentice_wand', bow:'rogue_bow'};
wpn('rusty_dagger', 'Rusty Dagger', 'dagger', 6, {fx:'slow', col:'#a8683a', fxName:'Tetanus', fxDesc:'30% chance to slow enemies by 40% for 2s.'});
wpn('wooden_club', 'Wooden Club', 'mace', 15, {fx:'knock', col:'#8a5c2e', fxName:'Bonk', fxDesc:'Knocks enemies far back.'});
wpn('bone_sword', 'Bone Sword', 'sword', 13, {fx:'shards', col:'#ece5cf', fxName:'Bone Shards', fxDesc:'Hits spray bone shards that hurt nearby enemies.'});
wpn('orc_cleaver', 'Orcish Cleaver', 'sword', 19, {fx:'bloodrage', col:'#7c8a5a', fxName:'Bloodrage', fxDesc:'Up to +100% damage the lower your health is.'});
wpn('hex_wand', 'Hex Wand', 'wand', 22, {fx:'curse', mana:3, cd:0.45, proj:'hex', col:'#b05be0', fxName:'Curse Bolt', fxDesc:'Cursed enemies take 25% more damage from everything for 5s.'});
wpn('venom_dagger', 'Venom Dagger', 'dagger', 14, {fx:'poison', col:'#7bd34a', fxName:'Poison', fxDesc:'Stacking poison (up to 5) deals damage over time.'});
wpn('moonfang', 'Moonfang Dagger', 'dagger', 20, {fx:'lunar', col:'#cfd8ff', fxName:'Lunar Frenzy', fxDesc:'At night: attacks 35% faster and heal 10% of damage dealt.'});
wpn('bonecrusher', 'Troll Bonecrusher', 'mace', 45, {fx:'regen', col:'#9aa58a', fxName:'Regenerate', fxDesc:'Each hit heals 3% of your max health.'});
wpn('spectral_wand', 'Spectral Wand', 'wand', 12, {fx:'drain', mana:1, cd:0.12, proj:'beam', col:'#8ff0ff', fxName:'Soul Drain', fxDesc:'Hold to fire a beam that heals you for 30% of damage dealt.'});
wpn('ogre_maul', 'Ogre Maul', 'mace', 65, {fx:'quake', col:'#7a6a55', fxName:'Earthquake', fxDesc:'Every 3rd hit slams the ground and stuns enemies around you.'});
wpn('shadow_blade', 'Shadow Blade', 'sword', 45, {fx:'dash', col:'#5a3a8a', fxName:'Shadow Step', fxDesc:'Attacks dash you through enemies. You cannot be hurt mid-dash.'});
wpn('storm_wand', 'Storm Wand', 'wand', 66, {fx:'chain', mana:8, cd:0.55, proj:'chain', col:'#7fc4ff', fxName:'Chain Lightning', fxDesc:'Lightning jumps between up to 5 enemies.'});
wpn('necro_staff', 'Necro Staff', 'wand', 66, {fx:'raise', mana:7, cd:0.45, proj:'skull', col:'#9be36b', fxName:'Raise Dead', fxDesc:'Enemies killed by its skulls rise and fight for you for 10s.'});
wpn('dragonfang', 'Dragonfang Sword', 'sword', 60, {fx:'dragonfire', col:'#ff5a2a', fxName:'Dragonfire', fxDesc:'Sets enemies on fire. Swings send out a wave of flame.'});
// craftable weapons: one of each type (sword, dagger, mace, wand) at each metal tier, made at the Anvil
wpn('iron_sword', 'Iron Sword', 'sword', 15, {fx:'steady', col:'#b9b9c4', fxName:'Steady', fxDesc:'+15% damage while at full health.', crafted:true});
wpn('iron_dagger', 'Iron Dagger', 'dagger', 10, {fx:'slow', col:'#c8c8d2', fxName:'Hamstring', fxDesc:'30% chance to slow enemies by 40% for 2s.', crafted:true});
wpn('iron_mace', 'Iron Mace', 'mace', 26, {fx:'knock', col:'#9a9aa6', fxName:'Bonk', fxDesc:'Knocks enemies far back.', crafted:true});
wpn('gold_wand', 'Gilded Wand', 'wand', 18, {fx:'slow', mana:2, cd:0.38, proj:'spark', col:'#f5cc45', fxName:'Arcane Chill', fxDesc:'Sparks slow enemies by 40% for 2s.', crafted:true});
wpn('iron_bow', 'Iron Recurve', 'bow', 18, {fx:'steady', col:'#b9b9c4', fxName:'Steady', fxDesc:'+15% damage while at full health.', crafted:true});
wpn('steel_sword', 'Steel Longsword', 'sword', 30, {fx:'steady', col:'#8fa6c2', fxName:'Steady', fxDesc:'+15% damage while at full health.', crafted:true});
wpn('steel_dagger', 'Steel Stiletto', 'dagger', 22, {fx:'poison', col:'#a6bcd8', fxName:'Poison', fxDesc:'Stacking poison (up to 5) deals damage over time.', crafted:true});
wpn('steel_mace', 'Steel Warhammer', 'mace', 50, {fx:'quake', col:'#7d92ad', fxName:'Earthquake', fxDesc:'Every 3rd hit slams the ground and stuns enemies around you.', crafted:true});
wpn('steel_wand', 'Frostbite Staff', 'wand', 34, {fx:'root', mana:3, cd:0.42, proj:'spark', sparkFx:'root', col:'#9fdcff', fxName:'Frostbite', fxDesc:'Frozen sparks hold enemies in place for 2s.', crafted:true});
wpn('steel_bow', 'Steel Longbow', 'bow', 34, {fx:'steady', col:'#8fa6c2', fxName:'Steady', fxDesc:'+15% damage while at full health.', crafted:true});
wpn('mythril_sword', 'Mythril Blade', 'sword', 52, {fx:'lifesteal', col:'#5ee8cf', fxName:'Soul Harvest', fxDesc:'Heal 8% of damage dealt. 20% crit chance.', crafted:true});
wpn('mythril_dagger', 'Mythril Kris', 'dagger', 40, {fx:'lunar', col:'#7ff2dc', fxName:'Lunar Frenzy', fxDesc:'At night: attacks 35% faster and heal 10% of damage dealt.', crafted:true});
wpn('mythril_mace', 'Mythril Maul', 'mace', 78, {fx:'shockwave', col:'#4fd2bb', fxName:'Shockwave', fxDesc:'Every hit sends a shockwave along the ground.', crafted:true});
wpn('mythril_wand', 'Mythril Staff', 'wand', 56, {fx:'curse', mana:4, cd:0.4, proj:'hex', col:'#5ee8cf', fxName:'Curse Bolt', fxDesc:'Cursed enemies take 25% more damage from everything for 5s.', crafted:true});
wpn('mythril_bow', 'Mythril Windrunner', 'bow', 56, {fx:'lifesteal', col:'#5ee8cf', fxName:'Soul Harvest', fxDesc:'Heal 8% of damage dealt. 20% crit chance.', crafted:true});
wpn('wyrm_sword', 'Wyrmfire Blade', 'sword', 82, {fx:'dragonfire', col:'#ff6a2a', fxName:'Dragonfire', fxDesc:'Sets enemies on fire. Swings send out a wave of flame.', crafted:true});
wpn('wyrm_dagger', 'Wyrmtooth Dagger', 'dagger', 60, {fx:'bloodrage', col:'#ff8a4a', fxName:'Bloodrage', fxDesc:'Up to +100% damage the lower your health is.', crafted:true});
wpn('wyrm_mace', 'Wyrmbone Hammer', 'mace', 112, {fx:'shockwave', col:'#e0c8a0', fxName:'Shockwave', fxDesc:'Every hit sends a shockwave along the ground.', crafted:true});
wpn('wyrm_wand', 'Wyrmfire Staff', 'wand', 84, {fx:'burn', mana:5, cd:0.4, proj:'spark', sparkFx:'burn', col:'#ff7a2a', fxName:'Dragonfire', fxDesc:'Fiery sparks set enemies ablaze.', crafted:true});
wpn('wyrm_bow', 'Dragonbreath Bow', 'bow', 88, {fx:'dragonfire', col:'#ff6a2a', fxName:'Dragonfire', fxDesc:'Sets enemies on fire. Flaming arrows leave a fiery scorch.', crafted:true});
// boss weapons
wpn('coin_scepter', "Goblin King's Scepter", 'wand', 13, {fx:'coin', mana:2, cd:0.32, proj:'coin', col:'#f5cc45', fxName:'Greed', fxDesc:'Fires bouncing coins. Enemies it kills drop double coins.', boss:true});
wpn('thornroot', 'Thornroot Wand', 'wand', 34, {fx:'root', mana:5, cd:0.5, proj:'thorn', col:'#5fbf4a', fxName:'Bramble Lash', fxDesc:'Thorns pierce through every enemy in a line and root each one for 2s.', boss:true});
wpn('warlord_hammer', "Warlord's Hammer", 'mace', 78, {fx:'warcry', col:'#b08a4a', fxName:'Warcry', fxDesc:'Every swing sends stunning shockwaves both ways along the ground.', boss:true});
wpn('soulreaver', 'Soulreaver', 'sword', 58, {fx:'reap', col:'#6effc2', fxName:'Reap', fxDesc:'Heal 10% of damage dealt, 25% crit chance, and every kill restores 6% of your health.', boss:true});
wpn('warchief_axe', "Warchief's Greataxe", 'sword', 30, {fx:'cleave', col:'#b8452a', fxName:'Cleave', fxDesc:'A huge sweeping arc that hits everything around you and makes them bleed.', boss:true});
wpn('bloodmoon_claw', 'Bloodmoon Claw', 'dagger', 35, {fx:'bloodmoon', col:'#e0404a', fxName:'Blood Moon', fxDesc:'Always 25% faster (40% at night). Hits bleed and heal you 6% of damage (12% at night).', boss:true});
wpn('magma_fang', 'Magma Fang', 'sword', 72, {fx:'eruption', col:'#ff7a1a', fxName:'Eruption', fxDesc:'Sets enemies on fire, and every 3rd hit erupts in a blast of magma around them.', boss:true});
wpn('hoardbreaker', "Aurex's Hoardbreaker", 'sword', 120, {fx:'midas', col:'#f5cc45', fxName:'Midas Touch', fxDesc:'Every swing flings bouncing gold coins, and enemies you slay drop double gold.', boss:true});

// ===== Enemies =====
const EN = {
  goblin:{name:'Goblin', hp:25, dmg:8, xpm:1, ai:'walker', w:12, h:20, spd:70, drop:'rusty_dagger', coins:2},
  rat:{name:'Giant Rat', hp:18, dmg:6, xpm:0.8, ai:'walker', w:20, h:11, spd:95, drop:'wooden_club', coins:1},
  skeleton:{name:'Skeleton', hp:35, dmg:10, xpm:1.1, ai:'walker', w:12, h:27, spd:60, drop:'bone_sword', coins:3},
  orc:{name:'Orc', hp:50, dmg:14, xpm:1.3, ai:'walker', w:15, h:29, spd:66, drop:'orc_cleaver', coins:4},
  witch:{name:'Witch', hp:40, dmg:12, xpm:1.4, ai:'caster', w:12, h:28, spd:50, proj:'hexbolt', shootCd:2.2, drop:'hex_wand', coins:5},
  spider:{name:'Giant Spider', hp:45, dmg:12, xpm:1.3, ai:'walker', w:24, h:13, spd:105, drop:'venom_dagger', coins:4},
  werewolf:{name:'Werewolf', hp:70, dmg:18, xpm:1.6, ai:'walker', w:16, h:29, spd:120, leap:true, drop:'moonfang', coins:6},
  troll:{name:'Troll', hp:110, dmg:22, xpm:1.8, ai:'walker', w:20, h:36, spd:55, drop:'bonecrusher', coins:8},
  wraith:{name:'Wraith', hp:60, dmg:16, xpm:1.7, ai:'flyer', w:16, h:26, spd:75, drop:'spectral_wand', coins:7},
  ogre:{name:'Ogre', hp:160, dmg:30, xpm:2.2, ai:'walker', w:26, h:42, spd:50, drop:'ogre_maul', coins:10},
  dark_knight:{name:'Dark Knight', hp:140, dmg:28, xpm:2.2, ai:'walker', w:14, h:31, spd:80, charge:true, drop:'shadow_blade', coins:12},
  wyvern:{name:'Wyvern', hp:120, dmg:26, xpm:2.2, ai:'flyer', w:32, h:18, spd:115, swoop:true, drop:'storm_wand', coins:12},
  lich:{name:'Lich', hp:130, dmg:24, xpm:2.6, ai:'caster', w:14, h:31, spd:45, proj:'skullbolt', shootCd:2.4, summon:'skeleton', drop:'necro_staff', coins:15},
  drake:{name:'Fire Drake', hp:220, dmg:34, xpm:3, ai:'flyer', w:38, h:22, spd:95, proj:'fireball', shootCd:2.6, drop:'dragonfang', coins:18, scale:true},
};

// ===== Bosses =====
const BOSSES = {
  goblin_king:{name:'Grukk, the Goblin King', lvl:12, hp:600, dmg:16, w:30, h:44, x:368, drop:'coin_scepter', coins:300, quest:'goblin_king'},
  witch_queen:{name:'Morwenna, the Witch Queen', lvl:25, hp:900, dmg:22, w:18, h:36, x:968, drop:'thornroot', coins:900, quest:'witch_queen'},
  ogre_warlord:{name:'Brogg, the Ogre Warlord', lvl:40, hp:1400, dmg:28, w:40, h:60, x:1468, drop:'warlord_hammer', coins:2500, quest:'ogre_warlord'},
  archlich:{name:'Vaelith, the Archlich', lvl:52, hp:1500, dmg:30, w:22, h:40, x:1720, drop:'soulreaver', coins:5000, quest:'archlich'},
  gold_dragon:{name:'Aurex, the Gilded Wyrm', lvl:60, hp:2200, dmg:36, w:120, h:60, x:2120, drop:'hoardbreaker', coins:20000, quest:'gold_dragon'},
  // biome bosses that don't hold a rune-seal (optional, one per biome that had none)
  // pattern = which boss fight style it uses; minion/proj/ringProj tune that style
  orc_warchief:{name:'Ironjaw, the Orc Warchief', lvl:18, hp:750, dmg:18, w:24, h:46, x:560, drop:'warchief_axe', coins:500,
    pattern:'goblin_king', minion:'orc', minionLvl:15, throwProj:'bone'},
  bloodmoon_alpha:{name:'Fenris, the Bloodmoon Alpha', lvl:31, hp:1100, dmg:24, w:26, h:46, x:1130, drop:'bloodmoon_claw', coins:1500,
    pattern:'ogre_warlord', minion:'werewolf', minionLvl:28, fast:true},
  magma_wyrm:{name:'Pyraxis, the Magma Wyrm', lvl:57, hp:1800, dmg:32, w:76, h:44, x:1880, drop:'magma_fang', coins:9000,
    pattern:'archlich', minion:'drake', minionLvl:54, minionMax:2, proj:'fireball', ringProj:'fireball'},
};

// ===== Difficulty =====
// hp/dmg: enemy and boss health and damage. reward: XP and gold from kills and bosses.
// coinLoss: share of your gold lost when you fall. elite: how often Champion enemies show up.
const DIFFICULTIES = {
  easy:   {name:'Easy',   hp:0.7, dmg:0.6, reward:1,    coinLoss:0,    elite:0.5, desc:'Weaker enemies. You keep all your gold when you fall.'},
  normal: {name:'Normal', hp:1,   dmg:1,   reward:1,    coinLoss:0.1,  elite:1,   desc:'The intended adventure. Falling costs 10% of your gold.'},
  hard:   {name:'Hard',   hp:1.5, dmg:1.5, reward:1.3,  coinLoss:0.25, elite:2,   desc:'Tougher enemies, twice the Champions, +30% XP and gold. Falling costs 25% of your gold.'},
};

// ===== Mini-bosses: 2 per area. They appear when you get close and come back 10 minutes after being beaten. =====
// skill: summon (calls minions), enrage (faster and stronger under half health), volley (3-shot spread),
//        shockwave (ground slam), regen (heals over time)
const MINIBOSS_RESPAWN = 600; // seconds
const MINIBOSSES = [
  {id:'snag',       name:'Snag the Goblin Shaman',   type:'goblin',      x:190,  lvl:7,  skill:'summon', minion:'goblin'},
  {id:'gnawtooth',  name:'Old Gnawtooth',            type:'rat',         x:300,  lvl:9,  skill:'enrage'},
  {id:'borka',      name:'Borka the Raider',         type:'orc',         x:470,  lvl:15, skill:'enrage'},
  {id:'bonecaller', name:'Grimsby the Bonecaller',   type:'skeleton',    x:650,  lvl:17, skill:'summon', minion:'skeleton'},
  {id:'silkweaver', name:'Mother Silkweaver',        type:'spider',      x:780,  lvl:21, skill:'summon', minion:'spider'},
  {id:'grizelda',   name:'Hag Grizelda',             type:'witch',       x:900,  lvl:24, skill:'volley', proj:'hexbolt'},
  {id:'bloodfang',  name:'Bloodfang',                type:'werewolf',    x:1060, lvl:28, skill:'enrage'},
  {id:'mossjaw',    name:'Mossjaw the Bridge Troll', type:'troll',       x:1200, lvl:31, skill:'regen'},
  {id:'grimtusk',   name:'Grimtusk the Mountain',    type:'ogre',        x:1310, lvl:36, skill:'shockwave'},
  {id:'skyrend',    name:'Skyrend',                  type:'wyvern',      x:1420, lvl:38, skill:'volley', proj:'hexbolt'},
  {id:'mordred',    name:'Sir Mordred the Fallen',   type:'dark_knight', x:1560, lvl:44, skill:'enrage'},
  {id:'weeper',     name:'The Weeping Wraith',       type:'wraith',      x:1660, lvl:46, skill:'volley', proj:'skullbolt'},
  {id:'cindermaw',  name:'Cindermaw',                type:'drake',       x:1810, lvl:55, skill:'volley', proj:'fireball'},
  {id:'ashguard',   name:'The Ashen Champion',       type:'dark_knight', x:1950, lvl:57, skill:'shockwave'},
  {id:'valcor',     name:'Gate Warden Valcor',       type:'dark_knight', x:2035, lvl:59, skill:'shockwave', castle:true},
  {id:'scorchwing', name:'Scorchwing',               type:'drake',       x:2180, lvl:60, skill:'volley', proj:'fireball', castle:true},
];
// The magic walls at the end of each area are turned off: you can travel anywhere from the start.
// The seal bosses are still there to fight. Set to true to bring the walls back.
const BARRIERS_ON = false;
const BARRIERS = [
  {x:400, boss:'goblin_king'},
  {x:1000, boss:'witch_queen'},
  {x:1500, boss:'ogre_warlord'},
  {x:1750, boss:'archlich'},
];

// ===== Biomes =====
const BIOMES = [
  {id:'forest', name:'Greenhollow Forest', x0:0, x1:400, lv:[1,9], ug:[3,11], base:70, amp:6, surf:T.GRASS, sub:T.DIRT, tree:0.14, leaves:T.LEAVES,
    herbs:[T.HERB_RED,T.HERB_BLUE], day:['goblin'], night:['goblin','skeleton'], under:['rat','skeleton','rat'], sky:['#78b4e8','#d4ecf7'], hill:'#5d8f5a'},
  {id:'plains', name:'Amber Plains', x0:400, x1:700, lv:[12,17], ug:[13,19], base:72, amp:3, surf:T.GRASS, sub:T.DIRT, tree:0.025, leaves:T.LEAVES,
    herbs:[T.HERB_RED,T.HERB_BLUE], day:['orc','orc','goblin'], night:['orc','skeleton'], under:['rat','skeleton','spider'], sky:['#86b8e0','#f3e3b4'], hill:'#a9934f'},
  {id:'swamp', name:'Mirefen Swamp', x0:700, x1:1000, lv:[18,24], ug:[19,25], base:78, amp:2, surf:T.SWAMPGRASS, sub:T.MUD, tree:0.05, leaves:T.DARKLEAVES,
    herbs:[T.HERB_SWAMP], day:['witch','spider'], night:['witch','spider','spider'], under:['spider','spider','skeleton'], sky:['#6d8a7a','#b9c8a8'], hill:'#4b5e3e'},
  {id:'darkforest', name:'Duskwood', x0:1000, x1:1250, lv:[25,31], ug:[27,33], base:68, amp:8, surf:T.DARKGRASS, sub:T.DIRT, tree:0.17, leaves:T.DARKLEAVES,
    herbs:[T.HERB_SWAMP], day:['spider','witch','werewolf'], night:['werewolf','werewolf','spider'], under:['spider','troll'], sky:['#4e5f7a','#8f9db0'], hill:'#2a3f35'},
  {id:'mountains', name:'Frostfang Peaks', x0:1250, x1:1500, lv:[32,38], ug:[34,40], base:44, amp:26, surf:T.STONE, sub:T.STONE, tree:0.0, leaves:T.LEAVES,
    herbs:[T.HERB_FROST], day:['troll'], night:['troll','werewolf'], under:['ogre','troll','ogre'], sky:['#9cc3e8','#eef6fb'], hill:'#8a95a8'},
  {id:'ruins', name:'Ashen Ruins', x0:1500, x1:1750, lv:[40,46], ug:[44,52], base:70, amp:5, surf:T.DEADGRASS, sub:T.DIRT, tree:0.0, leaves:T.DARKLEAVES,
    herbs:[T.HERB_GRAVE], day:['skeleton','wraith'], night:['wraith','wraith','skeleton'], under:['wraith','skeleton','lich','skeleton'], sky:['#6a6470','#b8a99a'], hill:'#4d4650'},
  {id:'volcano', name:'Cinderdeep Volcano', x0:1750, x1:2000, lv:[52,57], ug:[54,58], base:62, amp:14, surf:T.ASH, sub:T.ASH, tree:0.0, leaves:T.LEAVES,
    herbs:[T.HERB_FIRE], day:['wyvern','dark_knight','drake'], night:['wyvern','dark_knight','drake'], under:['drake','dark_knight'], sky:['#5a2f2a','#c4683a'], hill:'#3a2222'},
  {id:'castle', name:'Dragonhold Castle', x0:2000, x1:2200, lv:[57,60], ug:[58,60], base:66, amp:0, surf:T.ASH, sub:T.ASH, tree:0.0, leaves:T.LEAVES,
    herbs:[], day:['dark_knight','drake'], night:['dark_knight','drake'], under:['dark_knight','drake'], sky:['#3a2430','#a0503a'], hill:'#2a1a22'},
];
const WAYSTONES = [60, 412, 712, 1012, 1262, 1512, 1762, 1992];
const CASTLE = {x0:2012, x1:2194, floor:66, top:26};

// ===== Recipes =====
const RECIPES = [
  {out:'workbench', n:1, st:null, in:[['wood',10]]},
  {out:'torch', n:3, st:null, in:[['wood',1],['coal',1]]},
  {out:'furnace', n:1, st:'workbench', in:[['stone',20],['wood',4],['torch',1]]},
  {out:'alchemy', n:1, st:'workbench', in:[['wood',8],['stone',5],['herb_red',2]]},
  {out:'anvil', n:1, st:'workbench', in:[['iron_bar',6]]},
  {out:'brick', n:4, st:'furnace', in:[['stone',4]]},
  {out:'iron_bar', n:1, st:'furnace', in:[['iron_ore',2]]},
  {out:'gold_bar', n:1, st:'furnace', in:[['gold_ore',2]]},
  {out:'steel_bar', n:1, st:'furnace', in:[['iron_bar',1],['coal',2]]},
  {out:'mythril_bar', n:1, st:'furnace', in:[['mythril_ore',3]]},
  {out:'pick_iron', n:1, st:'anvil', in:[['iron_bar',8],['wood',4]]},
  {out:'pick_mythril', n:1, st:'anvil', in:[['mythril_bar',10],['steel_bar',4]]},
  {out:'armor_iron', n:1, st:'anvil', in:[['iron_bar',14]]},
  {out:'armor_steel', n:1, st:'anvil', in:[['steel_bar',18]]},
  {out:'armor_mythril', n:1, st:'anvil', in:[['mythril_bar',18],['gold_bar',4]]},
  {out:'armor_dragon', n:1, st:'anvil', in:[['dragonscale',12],['obsidian',15],['mythril_bar',8]]},
  {out:'gold_lure', n:1, st:'anvil', in:[['gold_bar',5]]},
  // weapons
  {out:'iron_sword', n:1, st:'anvil', in:[['iron_bar',8],['wood',3]]},
  {out:'iron_dagger', n:1, st:'anvil', in:[['iron_bar',5],['wood',1]]},
  {out:'iron_mace', n:1, st:'anvil', in:[['iron_bar',10],['wood',4]]},
  {out:'gold_wand', n:1, st:'anvil', in:[['gold_bar',5],['wood',4]]},
  {out:'iron_bow', n:1, st:'anvil', in:[['iron_bar',7],['wood',5]]},
  {out:'steel_sword', n:1, st:'anvil', in:[['steel_bar',10],['iron_sword',1]]},
  {out:'steel_dagger', n:1, st:'anvil', in:[['steel_bar',7],['iron_dagger',1]]},
  {out:'steel_mace', n:1, st:'anvil', in:[['steel_bar',12],['iron_mace',1]]},
  {out:'steel_wand', n:1, st:'anvil', in:[['steel_bar',6],['gold_bar',4],['gold_wand',1]]},
  {out:'steel_bow', n:1, st:'anvil', in:[['steel_bar',9],['iron_bow',1]]},
  {out:'mythril_sword', n:1, st:'anvil', in:[['mythril_bar',12],['steel_sword',1]]},
  {out:'mythril_dagger', n:1, st:'anvil', in:[['mythril_bar',8],['steel_dagger',1]]},
  {out:'mythril_mace', n:1, st:'anvil', in:[['mythril_bar',14],['steel_mace',1]]},
  {out:'mythril_wand', n:1, st:'anvil', in:[['mythril_bar',8],['gold_bar',4],['steel_wand',1]]},
  {out:'mythril_bow', n:1, st:'anvil', in:[['mythril_bar',10],['steel_bow',1]]},
  {out:'wyrm_sword', n:1, st:'anvil', in:[['dragonscale',8],['obsidian',10],['mythril_sword',1]]},
  {out:'wyrm_dagger', n:1, st:'anvil', in:[['dragonscale',6],['obsidian',6],['mythril_dagger',1]]},
  {out:'wyrm_mace', n:1, st:'anvil', in:[['dragonscale',10],['obsidian',14],['mythril_mace',1]]},
  {out:'wyrm_wand', n:1, st:'anvil', in:[['dragonscale',8],['obsidian',8],['mythril_wand',1]]},
  {out:'wyrm_bow', n:1, st:'anvil', in:[['dragonscale',8],['obsidian',8],['mythril_bow',1]]},
  {out:'pot_h1', n:1, st:'alchemy', in:[['herb_red',2]]},
  {out:'pot_m1', n:1, st:'alchemy', in:[['herb_blue',2]]},
  {out:'pot_h2', n:1, st:'alchemy', in:[['herb_swamp',1],['herb_red',1]]},
  {out:'pot_m2', n:1, st:'alchemy', in:[['herb_swamp',1],['herb_blue',1]]},
  {out:'pot_h3', n:1, st:'alchemy', in:[['herb_frost',1],['herb_swamp',1]]},
  {out:'pot_m3', n:1, st:'alchemy', in:[['herb_grave',1],['herb_swamp',1]]},
  {out:'pot_h4', n:1, st:'alchemy', in:[['herb_fire',2],['dragonscale',1]]},
  {out:'pot_m4', n:1, st:'alchemy', in:[['herb_fire',2],['herb_grave',1]]},
];
const STATION_NAMES = {workbench:'Workbench', furnace:'Furnace', anvil:'Anvil', alchemy:'Alchemy Table'};

// ===== Shop =====
const SHOP = [
  {id:'pot_h1', price:30}, {id:'pot_m1', price:30}, {id:'torch', price:3}, {id:'wood', price:2},
  {id:'pot_h2', price:140, req:'goblin_king'}, {id:'pot_m2', price:140, req:'goblin_king'},
  {id:'pot_h3', price:450, req:'ogre_warlord'}, {id:'pot_m3', price:450, req:'ogre_warlord'},
  {id:'iron_bar', price:60}, {id:'steel_bar', price:180, req:'witch_queen'},
];

// ===== Quests =====
const MAIN_QUESTS = [
  {title:"A Squire's First Steps", type:'kill', target:'goblin', n:5, xpf:0.8, items:[['pot_h1',3]],
    text:"Goblins have been raiding Greenhollow since the dragon came. Show me what you can do, squire: defeat 5 goblins in the forest to the east."},
  {title:'Tools of the Trade', type:'craft', target:'workbench', n:1, xpf:0.5, items:[['torch',15]],
    text:"A knight needs more than a blade. Chop trees for wood with your pickaxe and craft a Workbench (open your inventory with E)."},
  {title:'Into the Deep', type:'collect', target:'iron_ore', n:12, xpf:0.8, items:[['pot_h1',3]],
    text:"Iron lies beneath our feet. Dig down, light your way with torches, and bring up 12 Iron Ore. Mind the rats."},
  {title:'Forge Ahead', type:'craft', target:'armor_iron', n:1, xpf:1, items:[['pot_h1',4]],
    text:"Build a Furnace to smelt your ore into bars, then an Anvil. Forge yourself a suit of Iron Armor."},
  {title:'The Goblin King', type:'boss', target:'goblin_king', n:1, xpf:1.5, items:[['pot_h1',5]],
    text:"Grukk the Goblin King holds the first rune-seal at the eastern edge of the forest. Use the altar there to call him out. Defeat him and the road east will open."},
  {title:'Orc Trouble', type:'kill', target:'orc', n:15, xpf:1, items:[['pot_h2',3]],
    text:"The seal is broken! Beyond lie the Amber Plains, overrun by orc warbands. Thin their ranks: defeat 15 orcs."},
  {title:'Bog Brewing', type:'craft', target:'pot_h2', n:3, xpf:0.8, items:[['pot_m2',3]],
    text:"The Mirefen Swamp is poisonous ground. Gather Bog Blooms and brew 3 Healing Potions at an Alchemy Table."},
  {title:'The Witch Queen', type:'boss', target:'witch_queen', n:1, xpf:1.5, items:[['pot_h2',5]],
    text:"Morwenna the Witch Queen guards the second seal at the far edge of the swamp. Her magic is deadly. Bring potions."},
  {title:'Night Hunt', type:'kill', target:'werewolf', n:10, xpf:1, items:[['pot_h2',4]],
    text:"Duskwood belongs to the werewolves after dark. Hunt 10 of them. Their fangs make fine daggers."},
  {title:'Steel Resolve', type:'craft', target:'armor_steel', n:1, xpf:1, items:[['pot_m2',4]],
    text:"Iron will not hold against what comes next. Smelt Steel from iron and coal and forge Steel Armor."},
  {title:'Mountain Breaker', type:'kill', target:'troll', n:10, xpf:1, items:[['pot_h3',2]],
    text:"Frostfang Peaks are crawling with trolls. Defeat 10 of them and clear the pass."},
  {title:'The Ogre Warlord', type:'boss', target:'ogre_warlord', n:1, xpf:1.5, items:[['pot_h3',4]],
    text:"Brogg the Ogre Warlord guards the third seal at the far side of the peaks. He hits like an avalanche. Keep moving."},
  {title:'Restless Dead', type:'kill', target:'wraith', n:12, xpf:1, items:[['pot_m3',3]],
    text:"The Ashen Ruins were a kingdom once. Now the dead walk there. Put 12 wraiths to rest."},
  {title:'Mythril Might', type:'craft', target:'armor_mythril', n:1, xpf:1, items:[['pot_h3',4]],
    text:"Mythril runs deep under the mountains and ruins. You'll need an Iron Pickaxe to mine it. Forge Mythril Armor."},
  {title:'The Archlich', type:'boss', target:'archlich', n:1, xpf:1.5, items:[['pot_h3',5]],
    text:"Vaelith the Archlich holds the last seal at the eastern end of the ruins. Destroy it and the volcano road opens."},
  {title:'Scales of Fire', type:'collect', target:'dragonscale', n:12, xpf:1, items:[['pot_h3',4]],
    text:"Cinderdeep Volcano is home to Fire Drakes, the Wyrm's lesser kin. Collect 12 Dragonscales from them."},
  {title:'Dragonscale Knight', type:'craft', target:'armor_dragon', n:1, xpf:1, items:[['pot_h4',2]],
    text:"Only dragonscale can turn dragonfire. Mine obsidian with a Mythril Pickaxe and forge Dragonscale Armor."},
  {title:"Fool's Gold", type:'craft', target:'gold_lure', n:1, xpf:0.8, items:[['pot_h4',2]],
    text:"The Wyrm's greed is its weakness. Forge a Gold Lure from gold bars. Throw it during the fight and the beast will stop to stare at it."},
  {title:'The Gilded Wyrm', type:'boss', target:'gold_dragon', n:1, xpf:2, items:[],
    text:"This is it, Sir Knight. Aurex waits in the great hall of Dragonhold Castle with Princess Elowen locked in a cage. Disturb its hoard at the altar, slay it, and bring her home."},
];
const SIDE_QUESTS = {
  greta:[
    {title:'Herb Gathering', type:'collect', target:'herb_red', n:8, xpf:0.6, coins:80, items:[['pot_h1',2]], text:"I'm running low on Redcaps for my potions. Bring me 8 and I'll pay you well."},
    {title:'Bog Blooms', type:'collect', target:'herb_swamp', n:10, xpf:0.6, coins:300, items:[['pot_h2',2]], text:"Bog Blooms from the Mirefen sell for a fortune in the capital. Gather 10 for me."},
    {title:'Frost Lilies', type:'collect', target:'herb_frost', n:8, xpf:0.6, coins:900, items:[['pot_h3',2]], text:"They say Frost Lilies glow on the high peaks. Bring me 8."},
    {title:'Fire Blossoms', type:'collect', target:'herb_fire', n:8, xpf:0.6, coins:2500, items:[['pot_h4',1]], text:"Last one, I promise. Fire Blossoms from the volcano. 8 of them, if you survive."},
  ],
  fennick:[
    {title:'Hex Breaker', type:'kill', target:'witch', n:10, xpf:0.8, coins:200, items:[['pot_m2',3]], text:"Swamp witches have been cursing travelers. Silence 10 of them, would you?"},
    {title:'Webs and Venom', type:'kill', target:'spider', n:15, xpf:0.8, coins:400, items:[['pot_m2',3]], text:"Giant spiders breed in the dark. Clear out 15 before they reach the village."},
    {title:'Lay Them to Rest', type:'kill', target:'skeleton', n:25, xpf:0.8, coins:1200, items:[['pot_m3',3]], text:"Too many restless bones. Defeat 25 skeletons anywhere in the land."},
    {title:'Drake Slayer', type:'kill', target:'drake', n:8, xpf:1, coins:4000, items:[['pot_m4',2]], text:"Prove you're ready for the Wyrm. Slay 8 Fire Drakes."},
  ],
};

// ===== Progression formulas =====
function xpNeed(l) { return Math.round(40 * Math.pow(l, 1.7)); }
function playerMaxHp(l) { return Math.round(100 * Math.pow(1.05, l - 1)); }
function playerMaxMana(l) { return Math.round(50 * Math.pow(1.03, l - 1)); }
function playerDmgMult(l) { return 1.4 * Math.pow(1.04, l - 1); }
function enemyHp(base, l) { return base * Math.pow(1.055, l - 1); }
function enemyDmg(base, l) { return base * Math.pow(1.045, l - 1); }
function enemyXp(l, m) { return Math.round(8 * Math.pow(l, 1.3) * m); }

// ===== Villages with traders, one at the entrance of each area =====
// way: the area's waystone (old map coordinate); side: which side of it the village sits.
// Each trader has a shop list: [item, price]. Kinds: goods (potions, supplies), smith (metal,
// armor, weapons), arcane (wands, mana).
const TOWNS = [
  {name:'Amberfield', way:412, side:1, traders:[
    {name:'Hobb the Peddler', kind:'goods', shop:[['pot_h1',30],['pot_m1',30],['pot_h2',120],['pot_m2',120],['torch',3],['wood',2]]},
    {name:'Marta the Smith', kind:'smith', shop:[['iron_bar',50],['steel_bar',160],['pick_iron',800],['armor_iron',900],['iron_sword',700],['iron_dagger',550],['iron_mace',800],['gold_wand',900]]}]},
  {name:'Mirefen Hollow', way:712, side:1, traders:[
    {name:'Old Nell', kind:'goods', shop:[['pot_h2',110],['pot_m2',110],['herb_swamp',30],['torch',3],['wood',2]]},
    {name:'Wisp the Hedge-Mage', kind:'arcane', shop:[['gold_wand',800],['steel_wand',2600],['hex_wand',1800],['pot_m2',100],['pot_m3',400]]}]},
  {name:'Duskwatch', way:1012, side:1, traders:[
    {name:'Corin the Trapper', kind:'goods', shop:[['pot_h2',100],['pot_h3',380],['pot_m3',380],['torch',3]]},
    {name:'Garrick the Smith', kind:'smith', shop:[['steel_bar',150],['gold_bar',140],['armor_steel',3500],['steel_sword',2600],['steel_dagger',2200],['steel_mace',3000]]}]},
  {name:'Frosthold', way:1262, side:1, traders:[
    {name:'Ilse the Furrier', kind:'goods', shop:[['pot_h3',350],['pot_m3',350],['herb_frost',60],['torch',3]]},
    {name:'Durn Ironbeard', kind:'smith', shop:[['mythril_bar',450],['pick_mythril',6000],['armor_mythril',9000],['mythril_sword',8000],['mythril_dagger',7000],['mythril_mace',9000]]}]},
  {name:'Ashgate', way:1512, at:1614, traders:[ // in the open middle of the Ashen Ruins, clear of Brogg's Crater and the crypt
    {name:'Brother Aldous', kind:'goods', shop:[['pot_h3',320],['pot_h4',1200],['torch',3]]},
    {name:'Sable the Seer', kind:'arcane', shop:[['mythril_wand',9000],['spectral_wand',7000],['pot_m3',320],['pot_m4',1200]]}]},
  {name:'Cinderwatch', way:1762, side:1, traders:[
    {name:'Vesna the Quartermaster', kind:'goods', shop:[['pot_h4',1000],['pot_m4',1000],['gold_lure',3000],['torch',3]]},
    {name:'Brand the Forgemaster', kind:'smith', shop:[['dragonscale',400],['obsidian',150],['armor_dragon',30000],['wyrm_sword',25000],['wyrm_dagger',22000],['wyrm_mace',27000],['wyrm_wand',25000]]}]},
];
const TOWN_HALF = 22; // tiles from the village centre to its edge

// ===== Stretch the map to the bigger world (see MX at the top) =====
for (const t of TOWNS) t.x = t.at ? MX(t.at) : MX(t.way) + t.side * 34;
for (const b of BIOMES) { b.x0 = MX(b.x0); b.x1 = b.x1 >= OLD_WW ? WW : MX(b.x1); }
for (let i = 0; i < WAYSTONES.length; i++) WAYSTONES[i] = MX(WAYSTONES[i]);
for (const k in BOSSES) BOSSES[k].x = MX(BOSSES[k].x);
for (const b of BARRIERS) b.x = MX(b.x);
for (const m of MINIBOSSES) m.x = MX(m.x);
CASTLE.x0 = MX(CASTLE.x0); CASTLE.x1 = MX(CASTLE.x1);

// ===== Mine shafts: one in every biome after the first, the only ways down from the surface =====
// beam/roof: the entrance's crossbeam and roof blocks; ore: what lines the chamber at the bottom.
const MINES = [
  {biome:'plains', name:'Old Amber Mine', beam:T.WOOD, roof:T.WOOD, ore:T.IRON},
  {biome:'swamp', name:'Sunken Bog Pit', beam:T.MUD, roof:T.DARKLEAVES, ore:T.GOLD},
  {biome:'darkforest', name:'Shadowroot Delve', beam:T.STONE, roof:T.DARKLEAVES, ore:T.GOLD},
  {biome:'mountains', name:'Frostfang Deepshaft', beam:T.STONE, roof:T.SNOW, ore:T.MYTHRIL},
  {biome:'ruins', name:'The Forgotten Well', beam:T.BRICK, roof:T.BRICK, ore:T.MYTHRIL},
  {biome:'volcano', name:'Cinder Shaft', beam:T.OBSIDIAN, roof:T.ASH, ore:T.OBSIDIAN},
];
const MINE_DEPTH = 95; // how far down the ladder goes

// Each boss's lair (shown when you walk into it)
const ARENA_NAMES = {goblin_king:"Grukk's War Camp", orc_warchief:"Ironjaw's Warcamp", witch_queen:"Morwenna's Hex Grove",
  bloodmoon_alpha:"The Bloodmoon Circle", ogre_warlord:"Brogg's Crater", archlich:"Vaelith's Sanctum", magma_wyrm:"The Caldera of Pyraxis",
  gold_dragon:"The Great Hall of Dragonhold"};
function arenaAt(tx, ty) {
  for (const k in BOSSES) {
    const b = BOSSES[k];
    if (k === 'gold_dragon') { if (tx > CASTLE.x0 && tx < CASTLE.x1 && ty > CASTLE.top && ty <= CASTLE.floor) return k; continue; }
    if (Math.abs(tx - b.x) <= 24 && ty < (surf ? surf[b.x] + 4 : 999) && ty > (surf ? surf[b.x] - 22 : 0)) return k;
  }
  return null;
}

// ===== Quests are turned off: the game is about hunting down the bosses =====
const QUESTS_ON = false;
// The bosses in the order Sir Aldric suggests (by recommended level); Aurex is the final one.
const BOSS_ORDER = Object.keys(BOSSES).sort((a, b) => BOSSES[a].lvl - BOSSES[b].lvl);
