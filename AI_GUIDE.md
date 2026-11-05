# Dragonhold: guide for AI coding agents

Dragonhold is a 2D side-view sandbox action game (mining, building, crafting, boss fights) that runs in the browser, with optional online co-op for up to 3 players. Plain JavaScript and HTML canvas: no build step, no frameworks, no npm packages.

The owner is a young player who asks for features in short messages. Keep explanations simple, test everything you change, and don't break existing saves.

Two AI agents work on this project through its GitHub repository. Follow `AGENTS.md`: pull before you change anything, make one tested change, then commit and push it right away. On the owner's computer the project lives in `C:\Users\gavin\Dragonhold`.

## Run it

- **Solo, no server:** open `index.html` in Chrome or Edge. Saving uses `localStorage`. Co-op is disabled from `file://`.
- **With the server (co-op, downloads, dev options):** `node server/server.js` from this folder. Port 8080 by default; set `PORT` to change it, for example `PORT=8095` for a test copy. Then open `http://localhost:8080`.
- **Owner's launcher:** `Start Co-op.bat` runs `server/start-coop.ps1`. It replaces any old server, starts the server and a Cloudflare quick tunnel (`cloudflared`), prints the friend link, rebuilds `download/Dragonhold.zip`, and stops everything when its window closes (Windows Job Object).
- **Requirements:** Node.js (any recent LTS) and, for internet play, `cloudflared` on PATH.

## Files

| File | Lines | What's in it |
|---|---|---|
| `index.html` | ~385 | All CSS, HUD and panel markup, and the script tags (order matters, see below) |
| `js/data.js` | ~450 | Content and constants: tiles (`T`, `TP`), items (`ITEMS`), weapons, enemies (`EN`), bosses (`BOSSES`), barriers, biomes, waystones, recipes, shop, quests (switched off), mini-bosses, difficulties, villages (`TOWNS`), mines (`MINES`), arena names, world remapping (`MX`) |
| `js/world.js` | ~630 | World arrays and tile access (`getT`, `isSolid`, `setT`), seeded noise, `generateWorld(seed)`, arenas, mine shafts, castle, stair smoothing, map pixels, chest loot |
| `js/render.js` | ~730 | Tile textures, deco tiles, the knight rig, NPCs, enemy sprites (`SPRITES`), enemy attack poses, projectiles and spell drawing |
| `js/entities.js` | ~1320 | Game state (`G`, `player`, `enemies`, `projectiles`, `effects`, `particles`), physics, player update, ladders, aiming, combat, spells, enemy AI, mini-bosses, bosses, spawning |
| `js/ui.js` | ~750 | Inventory model, potions, quests (off) and the boss hunt, NPC dialogs and traders, shops, waystones, panels, HUD, map, saving |
| `js/net.js` | ~415 | Online co-op client: rooms, host/guest messages, snapshots, version check |
| `js/title.js` | ~450 | The animated title-screen painting (knight versus gold dragon) |
| `js/main.js` | ~1010 | Canvas, camera, input and keybindings, item use, mining and placing, the main loop (`update`, `render`), lighting, effects, new/continue game, menus |
| `js/dev.js` | ~200 | Developer options panel (owner only, see below) |
| `server/server.js` | ~200 | Zero-dependency Node HTTP + WebSocket relay; also `/version` and `/dev-allowed` |
| `server/start-coop.ps1` | ~130 | Windows launcher described above |

## Architecture you must know

- **No modules.** Every `js/*.js` is a classic `<script>`, and they all share the global scope. Top-level `function`, `const` and `let` names are visible across files. Load order in `index.html` is: data → world → render → entities → ui → net → title → main → dev. A file may *call* functions from later files at runtime, but must not use them at load time.
- **Wrapping functions.** `dev.js` reassigns global functions (for example `hurtPlayer = function (...) {...}`) to add cheats. That works because callers look up the global name at call time. Keep that in mind if you rename functions.
- **Units.** `TILE = 16` px. World size `WW = 3300` × `WH = 240` tiles. `world` is a `Uint8Array` of tile ids (index `y * WW + x`). `surf[x]` is the generated surface row, and `tops[x]` is the current top solid row. Entities use pixel coordinates (`x`, `y` = top-left; `w`, `h`), with helpers `ecx(e)` and `ecy(e)` for the center.
- **`MX(x)`.** The world used to be 2200 wide. Positions in `data.js` and `world.js` are written in old coordinates and passed through `MX()`. The village (x ≤ 130) stays put, the castle (x ≥ 1994) shifts east, and everything between stretches about 1.59×. The remapping loop at the bottom of `data.js` converts `BIOMES`, `WAYSTONES`, `BOSSES`, `BARRIERS`, `MINIBOSSES`, `CASTLE` and `TOWNS`. **Any new hard-coded map position must go through `MX()`.**
- **Deterministic worlds.** `generateWorld(seed)` uses `rngMaker(seed)` plus hash noise. Saves store only the seed and the tile changes (`mods`). Changing generation code (or the order of `rnd()` calls) changes every world. That's allowed, but player edits stay at the same coordinates.
- **Main loop.** `frame()` → `update(dt)` (skipped while a panel is open in solo; co-op keeps running) → `render(dt)`. `update` order: `handleUse`, `updatePlayer`, `trackWandAim`, then (host or solo only) `updateEnemies`, then `updateProjectiles`, `updateFx`, then (host only) `spawnTick`, `miniBossTick`, `regrowHerbs`, then `updateNPCs`, `netTick`, and autosave every 60 s.
- **Panels.** `setPanel(id)` in `ui.js` shows one modal panel and hides the rest. Its id list must include every panel (`dialog`, `invPanel`, `shopPanel`, `mapPanel`, `pausePanel`, `wayPanel`, `keysPanel`). `openPanel` holds the current one. `openDialog({speaker, title, text, buttons})` is the generic dialog.

## Core systems

- **Physics:** `moveEntity(e, dt, stepUp)` does sub-stepped tile collision, steps up 1 block, and blocks movement at the rune-seal barrier (now off). `rectSolid` tests a rectangle. `clearPath` and `canReach(a, b)` provide line of sight, so enemies can't hit through walls.
- **Ladders** (`T.LADDER`): `onLadder` and `ladderBelow` are used in `updatePlayer`. The top rung acts as floor unless the down key is held.
- **Trees** (`world.js`):
  - Shapes: `growTree` (oak, tall, willow), `growPine` and `growDeadTree`. `addHighlandTrees` adds pines, dead trees and burnt trees on the mountains, ruins and volcano.
  - Random numbers: tree shapes use their own `rngMaker`/`hash2`, never the world's `rnd()`, so the rest of the world (and old saves) stays the same. Keep it that way.
  - Tiles: logs (`T.LOG`, `T.DEADLOG`, `pr.log`) and leaves (`T.LEAVES`, `T.DARKLEAVES`, `T.PINELEAVES`) aren't solid. `fellTree` removes everything connected above the chopped log.
- **Drawing the land** (`main.js` `drawTiles`):
  - Order: leaves are queued in `leafList` and drawn last as 24px `leafTex` clumps, lit by position.
  - Trunks: `drawLogTile` adds root flares and draws branch logs as limbs.
  - Ground: darkens with depth below `surf`. Grass hangs over edges, and wildflowers come from the `FLOWERS` list.
  - Background: `drawNearTreeline` is the closer layer of woods behind the play area.
  - Color mixing: `mixHex` takes hex only. Wrap a mixed color in `rgbToHex()` before mixing it again, or it turns black.
- **Player combat** (`entities.js`):
  - `attack(item, slot)` → `meleeHit(e, item, rare, mult)` → `damageEnemy(e, amt, {kb, crit, fx, rare})`.
  - Weapon effects are an `fx` string on the item: steady, slow, knock, shards, bloodrage, curse, poison, lunar, regen, drain, quake, dash, chain, raise, dragonfire, coin, root, shockwave, lifesteal. The boss-only ones are cleave, warcry, reap, bloodmoon, eruption and midas.
  - Projectile effects go through `applyProjFx`, and status effects through `enemyFx`.
- **Wands:** `castSpell(item, rare)` switches on `item.proj` (spark, hex, thorn, skull, coin, beam, chain). Arcane Burst is `castBurst` (right click or X): it deals `BURST_DAMAGE` (3)× damage in an area, with a 4 s cooldown.
- **Aiming:** `aimMode` is 'cursor' or 'smart'. Use `aimPoint()`, `smartTarget()` and `mineTile()`.
- **Enemies:**
  - `makeEnemy(type, x, y, lvl, {elite})` uses `EN[type]`. Health, damage and XP are scaled by level and by `diff()` (Easy/Normal/Hard).
  - AI lives in `updateEnemies`. Walkers, casters and flyers are set by `EN.ai`.
  - The melee timeline is `atkT` (`ATK_TIME`, `ATK_STRIKE`). `enemySlashFx` uses `ATTACK_STYLE` and `HEAVY`.
- **Kills:** `killEnemy` (host side) → `rewardKill(info)` runs on every nearby player (XP, gold, quest credit, weapon drops with a pity counter). It also calls `markKillZone`, which stops spawns within 40×30 tiles for 90 s.
- **Mini-bosses:** `MINIBOSSES` in `data.js` are spawned by `miniBossTick` near their spot and rest 10 minutes after a kill (`G.minis`). Each has a skill (summon, enrage, volley, shockwave or regen) run by `miniSkill`.
- **Bosses:**
  - `BOSSES` has 8 entries. Each has an altar and an arena built by `buildArena(k, x, hs)` (see `ARENA_NAMES`). The dragon's arena is the castle hall.
  - `summonBoss(bid)` and `updateBoss` switch on `bossPattern(bid)`, which is one of goblin_king, witch_queen, ogre_warlord, archlich or gold_dragon. New bosses reuse a pattern through `pattern` plus `minion`, `proj`, `ringProj`, `throwProj` and `fast`.
  - Each boss's weapon is in `BOSSES[k].drop`, and its sprite is `SPRITES[bid]`.
  - **Summoned bosses** (`SUMMON_BOSSES`, in `data.js`):
    - They're called by a crafted item (`kind:'summon'`, whose `summons` field names the boss) wherever the item is used.
    - They're added to `BOSSES` as non-enumerable entries, so all boss code works for them, but loops over `BOSSES` (map, altars, arenas, boss hunt) skip them.
    - Flags: `summoned:true`, `repeatable:true`. `summonBoss(bid, x, y)` sets `BOSSES[bid].x` and `e.groundY` to the spot where the item was used.
    - The first one is `necromancer` (Mortivar, called by the Ominous Totem). His fight is `necromancerAI`: 3 phases, attacks, and undead minions `zombie` / `zombie_brute`.
    - Projectile flags: `harmless` (warning marks), `drain` (heals the boss on hit) and `cloud` (leaves a plague cloud).
    - The Cursed Crown (`summon_crown`) is waiting for the second boss.
- **Progression:**
  - `QUESTS_ON = false`, so the game is a boss hunt. `nextBoss()` and `BOSS_ORDER` drive the HUD tracker, J opens the boss log, and Sir Aldric gives hints.
  - `BARRIERS_ON = false`, so the area walls are off.
  - Winning means killing `gold_dragon` and talking to the princess.
- **World content:**
  - **Villages:** `TOWNS` (6, each with 2 traders and a shop list). They're safe zones with no spawns.
  - **Mine shafts:** `MINES` (6, one per biome after the forest), placed by `pickMineSites` and built by `buildMineShaft`. They're the only ways underground: caves start 20 tiles down, and there are no surface tunnels.
  - **Other features:** chests (`T.CHEST` becomes `T.CHEST_OPEN`, loot from `chestLoot`), waystones (fast travel), and a player spawn point (`G.home`; B sets it, H goes home).
- **Inventory:** `hotbar` (10 slots, `HOTBAR_SIZE`) plus `inv` (30). Slots are `{id, n, rare}`. Use `addItem`, `countItem`, `removeItems` and `fitHotbar` (which pads old 7-slot saves).
- **Crafting:** `RECIPES` entries are `{out, n, st, in:[[id, n]]}` with stations workbench, furnace, anvil and alchemy. Crafted weapons go iron → steel → mythril → wyrm, and each tier uses the previous weapon as an ingredient.
- **Keybindings:** `KEY_ACTIONS` in `main.js`, with up to 2 keys per action, saved in `localStorage['dragonhold_keys']`. Use `actionFor(code)` and `keyLabel(code)`. Esc and the number keys are fixed.
- **Settings:** difficulty (`G.difficulty`, shared in co-op), aim mode (per player), keybindings (per player).

## Co-op (`net.js` + `server/server.js`)

- **Server protocol:** `{t:'join', room, name, create}` → `{t:'joined', id, host, hostId, room, players}` or `{t:'error'}`. Relay with `{t:'relay', to:'host'|'all'|'others'|id, d}` → `{t:'msg', from, d}`. The server also sends `peer`, `left` and `hostleft`. Max 3 players per room.
- **Host authority:** the host's browser simulates enemies, bosses, enemy projectiles, spawning and day/night. Guests only send requests.
- **Game messages (`d.k`):**
  - Guest → host: `hello` (with version), `hit`, `fx`, `summon`, `lure`, `setdiff`.
  - Host → guest: `world` (seed, mods, bosses, day, difficulty, version), `snap` 12×/s (enemies, enemy projectiles, day, difficulty, mini timers, boss), `kill`, `boss`, `hurt`.
  - Everyone: `pos` 15×/s and `tile`.
- **Guests:** they keep their own character in `localStorage['dragonhold_coop_char_v1']`. A guest's hits on host enemies go through `damageEnemy` on proxy enemies and are forwarded to the host.
- **Version check:** `/version` returns the newest modification time of the game files. Pages compare it every 30 s and show the "Save and update" bar. Joiners compare versions with the host.
- **When you add a feature that changes shared world state,** make sure the host owns it and guests either receive it in `snap` or `world`, or send a request.

## Saving

- **Solo or host:** `localStorage['dragonhold_save_v1']` (`SAVE_KEY` in `ui.js`) holds `{v:1, ww:WW, seed, mods, G, p, hotbar, inv, sel}`. A save with a different `ww` is remapped by `remapToBigWorld()` (main.js): it keeps the character and progress and regenerates the land.
- **Load path:** `continueGame(data, difficulty?)`. New fields on `G` need defaults in `newGameState()`, because loading does `Object.assign(newGameState(), data.G)`.
- **Guest save:** `coopCharData()` / `saveCoopChar()` in `net.js`.

## Developer options (owner only)

`dev.js` unlocks only when the page is opened at `localhost` and `GET /dev-allowed` returns `yes`. The server's `isOwnerRequest(req)` says yes only if all of these hold:
- `server/dev.key` exists.
- The Host header is localhost.
- The connection really comes from this computer (loopback address).
- No Cloudflare or proxy headers are present.

The key file is never served and is left out of the download zip. **Never send the key anywhere or commit it.** The panel has F2 cheats, item giving, teleport (including clicking the map), boss and enemy spawning, and day/night.

**Giving friends items and powers (co-op):**
- **Panel:** its "Friends (co-op)" section sends `{k:'devgift', op, ...}` messages.
- **Server stamp:** the server marks relayed messages from an owner connection with `own:1`. It decides this itself and never trusts the sender.
- **Receiving:** `net.js` passes a devgift to `applyDevGift` only when `own` is set. Anything else is ignored.
- **Ops:** item, gold, level, heal (also revives), power (god, mana, oneHit, fly) and tp (bring to the owner).
- **Powers:** `installPowerHooks()` runs for every player so gifted powers work. Friends' `DEV` flags start off and are never saved. The owner-only tools are in `installDevHooks()`.

## How we test

Changes are tested before they're handed over. The usual routine:

1. Run a separate copy: `PORT=8095 node server/server.js`, so the owner's game on 8080 isn't touched.
2. Open `http://localhost:8095`. In the browser console, call game functions directly, for example:
   - `newGame('normal')`, `generateWorld(123)`, `summonBoss('ogre_warlord')`, `makeEnemy(...)`, `update(1/60)`
   - To simulate input, set `input.right = true` and step `update(1/60)` in a loop. (`requestAnimationFrame` pauses in background tabs, so step manually.)
3. Check that nothing ends up inside walls (`rectSolid`), that arenas, villages and shafts can be walked or climbed both ways, and that the console shows no errors.
4. Run `node --check js/<file>.js` after editing.

## Rules for changes

- **Keep it plain JavaScript in the existing files.** No new frameworks or dependencies.
- **Map positions:** pass them through `MX()`. Keep new structures clear of villages, arenas, mini-boss spots and waystones (see `pickMineSites` for the checks), and smooth their edges with `stairEdges`.
- **Walkability:** tall decoration must be non-solid (`LOG`, leaves, `TORCH`) or above head height.
- **Old saves:** add defaults for new state and pad or remap old data.
- **Co-op:** decide who owns new state (usually the host) and sync it.
- **Original look:** the art and style are original. Keep it that way, and don't copy other games' characters, names or assets.
