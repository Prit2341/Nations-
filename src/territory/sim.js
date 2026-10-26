// Territory simulation in the style of openfront.io: nations spawn as small
// dots on the map and grow tile by tile, first into unclaimed land, then into
// each other. Plain data only, apart from the per-nation border sets.

import { random } from "../game/rng.js";
import { WATER, WILD, forNeighbors, buildNav } from "./grid.js";
import { nationName } from "./names.js";
import { LANES } from "./lanes.js";

export const RULES = {
  ticksPerSecond: 10,
  bots: 50,
  spawnRadius: 4,
  minSpawnGap: 28, // tiles between spawn points
  maxSpawnLatitude: 62,
  // Population cap: the same for every nation whatever its size, raised only
  // by upgrades (cities). Each city multiplies the cap, by a little less each
  // time: the k-th city gives x(1 + cityBonus * cityFalloff^(k-1)), while its
  // price also multiplies (cityCostGrowth). Population regrows toward the cap
  // and never exceeds it.
  baseTroops: 3000,
  // A nation squeezed below this many tiles can only hold a share of its cap
  // (cap x tiles / fullCapTiles): people can't outlive their land.
  fullCapTiles: 25,
  maxPopulation: 100_000_000, // hard ceiling on any nation's cap, for now
  // Thin populations over big land would be free pickings, so every tile
  // holds at least this much defence per tile (local militia).
  // Gold per second = goldBase + goldPerSqrtTile * sqrt(tiles) * worker share
  // + goldPerWorker * workers: land only pays with people to work it.
  goldBase: 3,
  goldPerSqrtTile: 0.6,
  cityCost: 1500,
  cityCostGrowth: 2.2, // each further city costs this much more
  cityBonus: 2, // the first city multiplies the cap by 1 + this (x3)
  cityFalloff: 0.88, // each further city's bonus is this much of the last
  minCityGap: 8, // tiles between cities
  // A nation may have 1 city, plus 1 per tilesPerCity tiles, up to maxCityCount.
  tilesPerCity: 500,
  maxCityCount: 20, // twenty upgrades take the cap to the 100M ceiling
  // Population vs army: a nation's people (n.troops) split into soldiers
  // (armyShare) and workers. Only soldiers can be sent to attack; both
  // defend, workers weakly; everyone can go settle empty land. Workers are
  // the economy: growth, gold and food all come from them, so an all-army
  // nation stops growing, earns next to nothing and goes hungry.
  defaultArmyShare: 0.3,
  minArmyShare: 0.1,
  // Growth: share of the gap to the cap recovered per second, per unit of
  // worker share (half workers -> 0.06 / s).
  troopRegenRate: 0.12,
  goldPerWorker: 0.0012, // gold per second per worker
  // Food: everyone eats foodPerPerson a second; workers grow foodPerWorker.
  // Break-even near a third of the people under arms. Stores hold up to
  // foodStoreSeconds of eating; food beyond that is sold to the global market.
  // Run short and food is bought from the market (queue, at the market price);
  // if the market is empty or the gold is gone the nation starves: people die
  // (starveRate of the unfed a second), soldiers fight at starvingStrength,
  // and growth stops.
  foodPerPerson: 0.001,
  foodPerWorker: 0.0015,
  foodStoreSeconds: 180,
  startFoodSeconds: 60,
  // Global food market: one stock everyone sells into and buys from, first
  // come first served. Price = base x (target / stock)^1.5 (and up with the
  // queue), kept between min and max, easing toward that goal.
  marketBasePrice: 3, // gold per food when stock sits at its target
  marketMinPrice: 1,
  marketMaxPrice: 30,
  marketTargetSeconds: 4, // target stock: this many seconds of everyone's eating (60 pinned the price at its maximum)
  // Taxes on food trading (taken out of the economy), so a seller that profits
  // from a crisis cannot snowball: the sell tax rises with how much of the
  // nation's income food sales have become.
  marketSellTaxBase: 0.1,
  marketSellTaxProgressive: 0.5, // added in full when food sales equal normal income
  marketSellTaxMax: 0.6,
  marketBuyTax: 0.05, // on top of the price a buyer pays
  // Loans: any nation with spare gold may lend to one in food trouble, at an
  // interest rate the lender sets (some lend free). The BORROWER decides when
  // and how much to repay (bots by temperament, the player by hand); whatever
  // is still owed when the loan falls due is a default.
  loanDueSeconds: 600, // a loan falls due this long after it is made
  loanMaxDebtSeconds: 600, // most debt a nation may carry: this many seconds of its income
  loanDefaultGrudge: 1.3, // a lender's attack appetite against a defaulter
  loanBanSeconds: 600, // a defaulter can not borrow for this long
  loanDefaultSurcharge: 0.1, // lenders add this much interest per past default...
  loanRefuseDefaults: 3, // ...and refuse a nation with this many defaults
  // Unrest: people without food grow restless (faster the more of them are
  // unfed). The government pays gold to hold it down (halving the rise); when
  // unrest fills, a connected region breaks away as a new rebel nation.
  unrestRise: 0.006, // a second, while starving at all
  unrestRiseUnfed: 0.02, // more, in full when everyone is unfed
  unrestFall: 0.01, // a second, once fed again
  unrestHoldGold: 1, // gold a second per unit of unrest, in units of the nation's income
  revoltShare: 0.15, // share of the land that breaks away
  revoltMinTiles: 30, // smaller nations do not split
  revoltDesert: 0.2, // share of soldiers and gold the rebels take
  // Factories make steel. Steel is needed for population upgrades (from the
  // third one on), for army upgrades, and is traded on its own global market.
  factoryCost: 2500, // gold; each further factory costs more
  factoryCostGrowth: 1.7,
  tilesPerFactory: 60, // land limits factories: one per this many tiles
  maxFactories: 12,
  steelPerFactory: 0.15, // steel a second
  // Running costs: the army and the economy burn steel every second. Out of
  // steel (and unable to buy it), soldiers fight and workers earn at steelShortFactor.
  steelPerSoldier: 0.00001, // a second, more with army upgrades
  steelPerWorker: 0.000005, // a second
  steelShortFactor: 0.7,
  startSteel: 100,
  steelFromLevel: 2, // population upgrades from this level on need steel
  citySteel: 10, // steel for the first upgrade that needs it; grows by citySteelGrowth
  citySteelGrowth: 1.5,
  armyUpgradeGold: 1500, // gold for army level 1; grows by armyUpgradeGrowth
  armyUpgradeGrowth: 1.8,
  armyUpgradeSteel: 15, // steel for army level 1; grows by 1.6 a level
  maxArmyLevel: 10,
  armyLevelBonus: 0.2, // each army level: soldiers defend and attack this much better
  steelBasePrice: 40, // gold per steel when stock sits at its target
  steelMinPrice: 10,
  steelMaxPrice: 250,
  steelTarget: 2000, // target stock, plus five minutes of world production
  steelFee: 0.1, // market fee on every steel trade
  // Trade routes: fixed lanes (see lanes.js). Two nations whose coasts touch the
  // same lane may open a route: both earn gold, they can trade food and steel
  // at market price without tax, and a holder of a chokepoint on the lane takes
  // a toll. War between the two closes the route; a chokepoint holder at war
  // with either blockades it.
  laneReach: 16, // tiles: coast within this of a lane counts as touching it
  laneMinTiles: 3, // coast tiles needed to use a lane
  chokeReach: 8, // tiles: coast within this of a chokepoint holds it
  routeIncome: 0.8, // gold a second at lane value 1, for nations of 100 tiles (grows with the square root of size)
  routeToll: 0.1, // of each side's income, per chokepoint holder
  maxRoutes: 3,
  botRouteChance: 0.03, // per think, for a bot that trades
  protectSeconds: 5, // a tile just taken by an attack is not handed back as a sliver for this long
  // Opportunism: bots see openings and press them (multipliers on how weak a
  // neighbour looks): one already fighting someone else, a remnant, one that
  // cannot rearm or run short of steel or near revolt.
  oppBusy: 1.3,
  oppTiny: 1.6, // under 30 tiles
  oppWeak: 1.25,
  oppBig: 2.2, // an advantage this big overrides caution about being over the cap
  // Alliances: allies do not attack each other, help each other against a
  // neighbour's attack and trade food directly, outside the market and its tax,
  // at a discount the seller sets (some give it free).
  maxAllies: 3,
  allyFoodResale: 0.1, // share of food received from allies that may be resold to the market
  allyAfterSeconds: 120, // bots start seeking allies after this long
  botProposeChance: 0.02, // per think, of a bot open to alliances
  proposalSeconds: 120, // a proposal to the player lapses after this long
  allyFoodReserve: 60, // seconds of eating an ally keeps before selling spare food
  marketPriceEase: 0.5, // share of the gap to the goal price closed per second
  starveRate: 0.05,
  starvingStrength: 0.6,
  // The army is its own pool (n.soldiers); armyShare is the target share. Soldiers
  // are drafted from workers (or sent back to work) at most draftRate of the
  // population a second, and each recruit costs draftCost gold.
  draftRate: 0.004,
  trainSeconds: 15, // recruits are raw (not soldiers, not workers) this long
  draftCost: 0.3,
  // Gold a second per soldier out fighting (and per soldier at home while the
  // nation is under attack).
  warUpkeep: 0.002,
  // People above the cap (taken with conquered land) don't work, don't grow,
  // and eat extra: each counts as 1 + overcapEat * (1 + extra / cap) mouths.
  overcapEat: 1,
  // Size factor on growth and gold, against the average living nation, so
  // small nations can catch up and big ones don't snowball: at or below
  // half the average size x smallBonus, average x1, from bigSize times the
  // average x bigPenalty (linear in between).
  smallBonus: 1.2,
  bigSize: 4,
  bigPenalty: 0.7,
  startTroopFraction: 0.6,
  // Cost in troops to take one tile: wilderness is cheap; a nation's tile
  // costs more the more troops it has per tile.
  // War between nations is decided by whole-army strength (soldiers x upgrades x penalties):
  // each tick both sides lose battleRate of the weaker side's strength a second, and the
  // attacker's front moves advanceShare x (1 - 1/ratio) of its length when the ratio is above 1.
  battleRate: 0.08,
  advanceShare: 0.04,
  minStrength: 20, // a nation with no soldiers still holds a militia
  landingMin: 10, // soldiers a boat needs to take a nation's coast
  minAttackTroops: 30,
  frontShare: 0.3, // most of an attack's front tiles taken per tick
  boatSpeed: 2.5, // tiles per tick
  boatLoss: 0.1,
  // Bots leave the player alone for this long after spawning.
  playerGraceSeconds: 30,
  winShare: 0.4, // of all land
};

export function createGame(grid, seed = Date.now()) {
  const owner = new Int16Array(grid.size).fill(WATER);
  for (const t of grid.landTiles) owner[t] = WILD;
  return {
    seed: seed | 0,
    tick: 0,
    startTick: 0,
    phase: "picking", // -> "playing" -> "won" | "lost"
    // Tiles with a city; a city belongs to whoever owns its tile.
    cities: [],
    player: null,
    winner: null,
    owner,
    nations: [],
    attacks: [],
    boats: [],
    nextId: 1,
    // Global food market (see updateMarket); stock starts at its target.
    alliances: [], // { a, b, since }
    proposals: [], // alliance proposals to the player: { id, from, tick }
    loans: [], // { id, lender, borrower, principal, owed, rate, tick, defaulted }
    lanes: null, // built from lanes.js on the first tick
    routes: [], // { id, a, b, lane, since }
    steel: { stock: null, target: 0, price: RULES.steelBasePrice, history: [] },
    market: { stock: null, target: 0, price: RULES.marketBasePrice, need: 0, queue: [], fees: 0, history: [], trades: [] },
    events: [],
    // Tiles whose owner changed since the renderer last looked.
    dirty: [],
    // Scratch marks for finding attack candidates without duplicates.
    mark: new Uint32Array(grid.size),
    stamp: 0,
    // Tiles just captured by a front -> tick until which the sliver rule leaves them alone.
    protect: new Map(),
  };
}

// Only upgrades the nation bought count; captured cities don't, and land limits how many.
export const capWithCities = (count) => {
  let cap = RULES.baseTroops;
  for (let k = 0; k < count; k++) cap *= 1 + RULES.cityBonus * RULES.cityFalloff ** k;
  return Math.min(Math.round(cap), RULES.maxPopulation);
};
export const maxTroops = (n) => Math.max(1, Math.round(capWithCities(Math.min(n.level, maxCities(n))) * Math.min(1, n.tiles / RULES.fullCapTiles)));
// Defence per tile: people spread over the land, never below the militia floor.
export const army = (n) => n.soldiers;
export const workers = (n) => Math.max(0, n.troops - n.soldiers - n.inTraining);
// People above the cap are idle mouths until it is raised or they are gone.
export const extraPeople = (n) => Math.max(0, n.troops - maxTroops(n));
// Workers who actually work, and their share of everyone.
const producers = (n) => Math.max(0, workers(n) - extraPeople(n));
const workShare = (n) => (n.troops > 0 ? producers(n) / n.troops : 0);
// Who holds a tile: soldiers, plus workers at a fraction; hungry ones less.
// How well a nation's soldiers fight: upgrades help, hunger and missing steel hurt.
export const fightMultiplier = (n) => (n.starving ? RULES.starvingStrength : 1) * (n.steelShort ? RULES.steelShortFactor : 1) * (1 + RULES.armyLevelBonus * n.armyLevel);
// Fighting strength of the soldiers at home (what bots weigh up); a war also counts the soldiers out fighting.
export const strength = (n) => army(n) * fightMultiplier(n);
export const goldIncome = (n) =>
  (RULES.goldBase + RULES.goldPerSqrtTile * Math.sqrt(n.tiles) * workShare(n) + RULES.goldPerWorker * producers(n)) * n.sizeFactor * (n.steelShort ? RULES.steelShortFactor : 1);
export const growthRate = (n) => (n.starving || n.troops >= maxTroops(n) ? 0 : RULES.troopRegenRate * workShare(n) * n.sizeFactor);
export const foodMade = (n) => RULES.foodPerWorker * producers(n);
export const foodEaten = (n) => {
  const extra = extraPeople(n);
  const cap = Math.max(maxTroops(n), 1);
  return RULES.foodPerPerson * (n.troops + RULES.overcapEat * extra * (1 + extra / cap));
};
export const foodStore = (n) => foodEaten(n) * RULES.foodStoreSeconds;

// The size factor for a nation `ratio` times the average nation's size.
function sizeFactor(ratio) {
  if (ratio <= 0.5) return RULES.smallBonus;
  if (ratio <= 1) return RULES.smallBonus + (1 - RULES.smallBonus) * ((ratio - 0.5) / 0.5);
  if (ratio >= RULES.bigSize) return RULES.bigPenalty;
  return 1 + (RULES.bigPenalty - 1) * ((ratio - 1) / (RULES.bigSize - 1));
}
export const cityCost = (n) => Math.round(RULES.cityCost * RULES.cityCostGrowth ** n.level);
export const maxFactories = (n) => Math.min(RULES.maxFactories, Math.floor(n.tiles / RULES.tilesPerFactory));
export const factoryCost = (n) => Math.round(RULES.factoryCost * RULES.factoryCostGrowth ** n.factories);
export const steelRate = (n) => RULES.steelPerFactory * Math.min(n.factories, maxFactories(n));
// Steel the army and the economy burn each second.
export const steelUse = (n) => army(n) * RULES.steelPerSoldier * (1 + 0.1 * n.armyLevel) + producers(n) * RULES.steelPerWorker;
export const citySteel = (n) => (n.level < RULES.steelFromLevel ? 0 : Math.round(RULES.citySteel * RULES.citySteelGrowth ** (n.level - RULES.steelFromLevel)));
export const armyUpgradeCost = (n) => ({
  gold: Math.round(RULES.armyUpgradeGold * RULES.armyUpgradeGrowth ** n.armyLevel),
  steel: Math.round(RULES.armyUpgradeSteel * 1.6 ** n.armyLevel),
});
export const maxCities = (n) => Math.min(RULES.maxCityCount, 1 + Math.floor(n.tiles / RULES.tilesPerCity));
export const landShare = (grid, n) => n.tiles / grid.landCount;
const secondsPlayed = (game) => (game.tick - game.startTick) / RULES.ticksPerSecond;

export function logEvent(game, text) {
  game.events.push({ tick: game.tick, text });
  if (game.events.length > 20) game.events.shift();
}

function isBorder(grid, game, tile) {
  const own = game.owner[tile];
  let border = false;
  forNeighbors(grid, tile, (n) => {
    if (game.owner[n] !== own) border = true;
  });
  return border;
}

export function setOwner(grid, game, tile, nationIndex) {
  const from = game.owner[tile];
  if (from === nationIndex) return;
  const x = tile % grid.width;
  const y = Math.floor(tile / grid.width);
  if (from >= 0) {
    const old = game.nations[from];
    // Land taken comes with its share of the loser's stores.
    if (nationIndex >= 0) {
      const seized = old.food / Math.max(old.tiles, 1);
      old.food -= seized;
      game.nations[nationIndex].food += seized;
      // ...and its workers (soldiers stay and keep fighting).
      const moved = workers(old) / Math.max(old.tiles, 1);
      old.troops -= moved;
      game.nations[nationIndex].troops += moved;
    }
    old.tiles--;
    old.sumX -= x;
    old.sumY -= y;
    old.border.delete(tile);
  }
  game.owner[tile] = nationIndex;
  if (from >= 0 && nationIndex >= 0 && game.cities.includes(tile)) {
    if (nationIndex === game.player) logEvent(game, `You captured a city from ${game.nations[from].name}.`);
    else if (from === game.player) logEvent(game, `${game.nations[nationIndex].name} captured one of your cities!`);
  }
  if (nationIndex >= 0) {
    const n = game.nations[nationIndex];
    n.tiles++;
    n.sumX += x;
    n.sumY += y;
  }
  // The tile and its neighbors may have gained or lost border status.
  const refresh = (t) => {
    const o = game.owner[t];
    if (o < 0) return;
    if (isBorder(grid, game, t)) game.nations[o].border.add(t);
    else game.nations[o].border.delete(t);
  };
  refresh(tile);
  forNeighbors(grid, tile, refresh);
  game.dirty.push(tile);

  if (from >= 0 && game.nations[from].tiles === 0) {
    const fallen = game.nations[from];
    fallen.alive = false;
    fallen.troops = 0;
    fallen.soldiers = 0;
    fallen.training = [];
    fallen.inTraining = 0;
    if (from === game.player) logEvent(game, "Your nation has fallen.");
    else if (nationIndex === game.player) logEvent(game, `You wiped out ${fallen.name}.`);
  }
}

function addNation(grid, game, name, color, center) {
  const nation = {
    index: game.nations.length,
    name,
    color,
    alive: true,
    troops: 0, // population: soldiers and workers
    soldiers: 0, // the army, part of the population
    training: [], // recruits in training: { tick, count }
    inTraining: 0,
    holdExpansion: false, // player option: no settling of empty land
    armyShare: RULES.defaultArmyShare,
    sizeFactor: 1, // growth and gold, by size against the average (see RULES)
    food: 0,
    foodBought: 0, // food bought from the market, per second (recent)
    foodSpend: 0, // gold a second spent on food (recent)
    foodEarn: 0, // gold a second earned selling food (recent)
    steel: RULES.startSteel,
    steelShort: false, // out of steel: army and economy run at a penalty
    factories: 0,
    armyLevel: 0, // army upgrades bought
    allyFood: 0, // food received from allies: eaten before the nation's own
    allySellable: 0, // the part of it that may be resold
    allyOffer: { on: false, discount: 0.8 }, // the player's standing food deal for allies
    unrest: 0, // 0 to 1; at 1 a region revolts
    unfedShare: 0, // share of people unfed this second
    unrestWarned: false,
    defaults: 0, // loans it has defaulted on
    creditBanUntil: 0, // tick until which it can not borrow
    offer: { on: false, rate: 0.1, max: 0.25 }, // the player's standing loan offer (rate, share of gold per loan)
    foodEarnLong: 0, // the same over about a minute: what the sell tax looks at
    foodSoldTotal: 0,
    foodBoughtTotal: 0,
    foodEarnedTotal: 0,
    foodSpentTotal: 0,
    _bought: 0, // this tick's trades, folded into the averages above
    _spent: 0,
    _earned: 0,
    starving: false,
    tiles: 0,
    sumX: 0,
    sumY: 0,
    gold: 0,
    cities: 0, // cities on its land (captured ones included)
    level: 0, // upgrades bought: only these raise the population cap
    border: new Set(),
    nextThinkTick: 0,
  };
  game.nations.push(nation);
  const cx = center % grid.width;
  const cy = Math.floor(center / grid.width);
  const r = RULES.spawnRadius;
  // The starting land: everything within the radius that is joined to the centre without crossing a river
  // (a river tile is taken but not spread from, like any front).
  const reached = [center];
  const seen = new Set(reached);
  for (let i = 0; i < reached.length; i++) {
    const t = reached[i];
    if (game.owner[t] === WILD && !grid.river[t]) setOwner(grid, game, t, nation.index);
    if (grid.river[t] && t !== center) continue;
    forNeighbors(grid, t, (n) => {
      const nx = n % grid.width;
      const ny = Math.floor(n / grid.width);
      if (seen.has(n) || game.owner[n] !== WILD || (nx - cx) ** 2 + (ny - cy) ** 2 > r * r) return;
      seen.add(n);
      reached.push(n);
    });
  }
  nation.troops = Math.round(maxTroops(nation) * RULES.startTroopFraction);
  nation.soldiers = Math.round(nation.troops * nation.armyShare);
  nation.food = foodEaten(nation) * RULES.startFoodSeconds;
  return nation;
}

const distance = (grid, a, b) => Math.hypot((a % grid.width) - (b % grid.width), Math.floor(a / grid.width) - Math.floor(b / grid.width));

function farFromOthers(grid, game, tile) {
  return game.nations.every((n) => distance(grid, tile, Math.round(n.sumY / n.tiles) * grid.width + Math.round(n.sumX / n.tiles)) >= RULES.minSpawnGap);
}

// The player's nation, at a land tile they picked; bots then spawn around the world.
export function startGame(grid, game, tile, colors, playerColor) {
  if (game.phase !== "picking" || game.owner[tile] !== WILD) return false;
  const used = new Set();
  const rand = () => random(game);
  const playerName = nationName(grid.lonLatAt(tile), used, rand);
  used.add(playerName);
  game.player = addNation(grid, game, playerName, playerColor, tile).index;

  // Bots at random land spots spread across the map, each with a dynasty name.
  for (let attempt = 0; attempt < RULES.bots * 40 && game.nations.length <= RULES.bots; attempt++) {
    const spot = grid.landTiles[Math.floor(random(game) * grid.landTiles.length)];
    if (game.owner[spot] !== WILD || !farFromOthers(grid, game, spot)) continue;
    const lonLat = grid.lonLatAt(spot);
    if (Math.abs(lonLat[1]) > RULES.maxSpawnLatitude) continue; // not in the empty far north
    const name = nationName(lonLat, used, rand);
    used.add(name);
    const nation = addNation(grid, game, name, colors[(game.nations.length - 1) % colors.length], spot);
    nation.nextThinkTick = Math.round(random(game) * 3 * RULES.ticksPerSecond);
  }
  game.phase = "playing";
  game.startTick = game.tick;
  return true;
}

// Whether the nation's land touches the target (a nation index or WILD).
function borders(grid, game, nationIndex, target) {
  for (const t of game.nations[nationIndex].border) {
    if (grid.river[t]) continue; // a river tile is not a place to advance from
    let hit = false;
    forNeighbors(grid, t, (n) => {
      if (game.owner[n] === target) hit = true;
    });
    if (hit) return true;
  }
  return false;
}

// Coastal tile of `owner` nearest the clicked tile, searching outward.
function nearestCoast(grid, game, tile, owner, radius = 40) {
  const cx = tile % grid.width;
  const cy = Math.floor(tile / grid.width);
  let best = -1;
  let bestD = Infinity;
  for (let y = Math.max(0, cy - radius); y <= Math.min(grid.height - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(grid.width - 1, cx + radius); x++) {
      const t = y * grid.width + x;
      if (!grid.coastal[t] || game.owner[t] !== owner) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) [best, bestD] = [t, d];
    }
  }
  return best;
}

// People leave for a front, a boat or to settle: soldiers when attacking,
// workers only when settling empty land (settling never needs or uses the army).
function deploy(nation, amount, settling) {
  nation.troops -= amount;
  if (!settling) nation.soldiers -= amount;
}

// Whether the empty land at `tile` joins the nation's own through empty land, so settlers can
// walk there; if not (an island, a pocket cut off by sea), they have to go by boat.
function settleable(grid, game, nationIndex, tile) {
  const { owner } = game;
  const stamp = ++game.stamp;
  const queue = [tile];
  game.mark[tile] = stamp;
  for (let i = 0; i < queue.length && i < 400000; i++) {
    let found = false;
    forNeighbors(grid, queue[i], (n) => {
      if (owner[n] === nationIndex) {
        if (!grid.river[n]) found = true;
      } else if (owner[n] === WILD && !grid.river[n] && game.mark[n] !== stamp) {
        game.mark[n] = stamp;
        queue.push(n);
      }
    });
    if (found) return true;
  }
  return false;
}
// Survivors come home as soldiers (settlers, as workers).
function recall(nation, amount, settlers = false) {
  nation.troops += amount;
  if (!settlers) nation.soldiers += amount;
}

// Sends `troops` toward the clicked tile: overland if the nation borders its
// owner, otherwise by boat from the nearest coast. Settling empty land draws
// on the whole population; attacking a nation, only on its soldiers.
// Returns a reason on failure.
// options: limit   most tiles this front may take before it stops
//          ratio   share of the army to send again when a campaign runs dry
//          campaign  keep the front going (re-sending soldiers) until the
//                    limit is reached, the front closes or the army is gone
export function sendTroops(grid, game, nationIndex, tile, troops, options = {}) {
  const nation = game.nations[nationIndex];
  if (!(tile >= 0 && tile < grid.size)) return "Nothing there.";
  const target = game.owner[tile];
  const settling = target === WILD;
  troops = settling ? 0 : Math.min(Math.floor(troops), Math.floor(army(nation))); // settling sends nobody
  if (target === WATER) return "That's the sea.";
  if (grid.river[tile]) return "That's a river.";
  if (target >= 0 && isAllied(game, nationIndex, target)) return `${game.nations[target].name} is your ally.`;
  if (target === nationIndex) return "That's your land.";
  if (settling && nation.holdExpansion) return "Expansion is paused.";
  if (!settling && troops < RULES.minAttackTroops) return "Not enough soldiers.";

  if (settling ? settleable(grid, game, nationIndex, tile) : borders(grid, game, nationIndex, target)) {
    deploy(nation, troops, settling);
    const existing = game.attacks.find((a) => a.attacker === nationIndex && a.target === target);
    const front = { limit: options.limit ?? Infinity, ratio: options.ratio ?? 0, campaign: !!options.campaign && target !== WILD };
    if (existing) Object.assign(existing, front, { troops: existing.troops + troops });
    else game.attacks.push({ id: game.nextId++, attacker: nationIndex, target, troops, focus: tile, ...front });
    return null;
  }

  // Across a river from our land: a ferry carries the force to the far bank, where it fights on.
  const bank = riverCrossing(grid, game, nationIndex, tile, target);
  if (bank) {
    deploy(nation, troops, settling);
    game.boats.push({
      id: game.nextId++,
      attacker: nationIndex,
      troops: troops * (1 - RULES.boatLoss),
      settling,
      from: bank.from,
      to: bank.to,
      route: [bank.fromXY, bank.toXY],
      departTick: game.tick,
      arriveTick: game.tick + Math.max(1, Math.ceil(4 * RULES.ticksPerSecond)),
    });
    return null;
  }

  const landing = grid.coastal[tile] ? tile : nearestCoast(grid, game, tile, target);
  if (landing < 0) return "Can't reach there: no coast nearby.";
  const nav = navOf(grid);
  const k = nav.scale;
  const W = grid.width;
  const xy = (t) => [((t % W) + 0.5) * k, (Math.floor(t / W) + 0.5) * k];
  // Departure coasts nearest first; a boat sails only through sea tiles, so take the first one whose sea reaches the landing.
  const ports = [];
  for (const t of nation.border) if (grid.coastal[t]) ports.push([distance(grid, t, landing), t]);
  if (!ports.length) return "You have no coast to sail from.";
  ports.sort((a, b) => a[0] - b[0]);
  let from = -1;
  let fine = null;
  const tried = [];
  for (const [, t] of ports) {
    if (tried.some((u) => Math.abs((u % W) - (t % W)) + Math.abs(Math.floor(u / W) - Math.floor(t / W)) < 12)) continue;
    if (!sameSea(nav, xy(t), xy(landing))) continue;
    if (tried.push(t) > 4) break;
    fine = corridorPath(grid, nav, t, landing);
    if (fine) {
      from = t;
      break;
    }
  }
  if (!fine && tried.length) {
    // The coarse sea map can't see narrow seas (Red Sea, Gulf, Black Sea): search the fine tiles openly, once.
    from = tried[0];
    fine = waterPath(nav, xy(from), xy(landing), 0.3, 2.5, null, 1500000);
  }
  if (!fine) return "No sea route there.";
  const points = [xy(from), ...straighten(nav, fine), xy(landing)].map(([x, y]) => [x / k, y / k]);
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  deploy(nation, troops, settling);
  game.boats.push({
    id: game.nextId++,
    attacker: nationIndex,
    troops: troops * (1 - RULES.boatLoss),
    settling,
    from,
    to: landing,
    route: points,
    departTick: game.tick,
    arriveTick: game.tick + Math.max(1, Math.ceil(length / RULES.boatSpeed)),
  });
  return null;
}

// The nearest spot to `tile` that a ferry could reach across a river: one of the nation's own tiles
// with a river tile and then land of `target` right beyond it in a straight line. Null if there is none.
function riverCrossing(grid, game, nationIndex, tile, target) {
  const { width: W, size, river } = grid;
  const tx = tile % W;
  const ty = Math.floor(tile / W);
  let best = null;
  let bestD = Infinity;
  for (const a of game.nations[nationIndex].border) {
    if (river[a]) continue;
    const ax = a % W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ax + dx < 0 || ax + dx >= W) continue;
      const first = a + dx + dy * W;
      if (first < 0 || first >= size || !river[first]) continue;
      for (let k = 2; k <= 3; k++) {
        const bx = ax + dx * k;
        const by = Math.floor(a / W) + dy * k;
        if (bx < 0 || bx >= W || by < 0 || by >= grid.height) break;
        const b = by * W + bx;
        if (river[b]) continue;
        if (game.owner[b] === target) {
          const d = (bx - tx) ** 2 + (by - ty) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { from: a, to: b, fromXY: [ax + 0.5, Math.floor(a / W) + 0.5], toXY: [bx + 0.5, by + 0.5] };
          }
        }
        break;
      }
    }
  }
  return bestD < 60 * 60 ? best : null;
}

// An empty land tile two or three tiles beyond a river from one of the nation's border tiles, or -1.
function wildAcrossRiver(grid, game, nation) {
  const { width: W, size, river } = grid;
  const border = [...nation.border];
  for (let tries = 0; tries < 60 && border.length; tries++) {
    const a = border[Math.floor(random(game) * border.length)];
    if (river[a]) continue;
    const ax = a % W;
    const ay = Math.floor(a / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const first = a + dx + dy * W;
      if (ax + dx < 0 || ax + dx >= W || first < 0 || first >= size || !river[first]) continue;
      for (let k = 2; k <= 3; k++) {
        const bx = ax + dx * k;
        const by = ay + dy * k;
        if (bx < 0 || bx >= W || by < 0 || by >= grid.height) break;
        const b = by * W + bx;
        if (river[b]) continue;
        if (game.owner[b] === WILD) return b;
        break;
      }
    }
  }
  return -1;
}

// Calls a front's soldiers home and closes it.
export function stopFront(game, attackId) {
  const attack = game.attacks.find((a) => a.id === attackId);
  if (!attack) return;
  const attacker = game.nations[attack.attacker];
  if (attacker.alive) recall(attacker, attack.troops, attack.target === WILD);
  game.attacks = game.attacks.filter((a) => a.id !== attackId);
}

// Pausing expansion also calls back any settlers still out.
export function setHoldExpansion(game, nationIndex, on) {
  game.nations[nationIndex].holdExpansion = on;
  if (!on) return;
  for (const a of game.attacks.slice()) if (a.attacker === nationIndex && a.target === WILD) stopFront(game, a.id);
}

function updateAttacks(grid, game) {
  const finished = new Set();
  // A war is decided by the whole armies: soldiers at home plus those out fighting, each
  // side's strength split over its fronts (the defender's over the fronts against it).
  const deployed = new Map();
  const fronts = new Map();
  const against = new Map();
  for (const a of game.attacks) {
    if (a.target < 0) continue;
    deployed.set(a.attacker, (deployed.get(a.attacker) ?? 0) + a.troops);
    fronts.set(a.attacker, (fronts.get(a.attacker) ?? 0) + 1);
    against.set(a.target, (against.get(a.target) ?? 0) + 1);
  }
  const wholeStrength = (n) => (army(n) + (deployed.get(n.index) ?? 0)) * fightMultiplier(n);
  const dt = 1 / RULES.ticksPerSecond;
  for (const attack of game.attacks) {
    const attacker = game.nations[attack.attacker];
    const defender = attack.target >= 0 ? game.nations[attack.target] : null;
    if (!attacker.alive || (defender && !defender.alive)) {
      if (attacker.alive) recall(attacker, attack.troops, attack.target === WILD);
      finished.add(attack.id);
      continue;
    }

    if (attack.limit <= 0) {
      recall(attacker, attack.troops, attack.target === WILD);
      if (attack.attacker === game.player && defender) logEvent(game, `Took the land you aimed for from ${defender.name}.`);
      finished.add(attack.id);
      continue;
    }

    // Target tiles touching the attacker's land.
    const stamp = ++game.stamp;
    const candidates = [];
    const { owner, mark } = game;
    const { width: W, size, river } = grid;
    const target = attack.target;
    // The four neighbours of each border tile (left, right, up, down), without a closure per tile.
    for (const t of attacker.border) {
      if (grid.river[t]) continue; // fronts never go on from a river tile
      const x = t % W;
      let n;
      if (x > 0 && owner[(n = t - 1)] === target && !river[n] && mark[n] !== stamp) (mark[n] = stamp), candidates.push(n);
      if (x < W - 1 && owner[(n = t + 1)] === target && !river[n] && mark[n] !== stamp) (mark[n] = stamp), candidates.push(n);
      if (t >= W && owner[(n = t - W)] === target && !river[n] && mark[n] !== stamp) (mark[n] = stamp), candidates.push(n);
      if (t < size - W && owner[(n = t + W)] === target && !river[n] && mark[n] !== stamp) (mark[n] = stamp), candidates.push(n);
    }
    if (candidates.length === 0) {
      recall(attacker, attack.troops, attack.target === WILD);
      if (attack.attacker === game.player && defender) logEvent(game, `Front with ${defender.name} closed.`);
      finished.add(attack.id);
      continue;
    }
    if (defender && attack.troops < RULES.minAttackTroops) {
      // A campaign sends fresh soldiers while there is anything left to take.
      const more = Math.floor(Math.min(attacker.soldiers, army(attacker) * (attack.ratio || 0.3)));
      if (attack.campaign && more >= RULES.minAttackTroops) {
        deploy(attacker, more, false);
        attack.troops += more;
      } else if (attack.troops < 1) {
        recall(attacker, attack.troops, false);
        finished.add(attack.id);
        continue;
      }
    }

    // Who gets ahead: the ratio of the two whole armies. Both sides lose the same amount of
    // fighting strength each tick (the better upgraded side loses fewer actual soldiers);
    // ground changes hands only when the attacker is stronger, faster the bigger its edge.
    let share = RULES.frontShare; // empty land: settling
    if (defender) {
      const attackStrength = wholeStrength(attacker) / (fronts.get(attacker.index) || 1);
      const defendStrength = Math.max(wholeStrength(defender) / (against.get(defender.index) || 1), RULES.minStrength);
      const lost = RULES.battleRate * Math.min(attackStrength, defendStrength) * dt;
      const attackerLoss = Math.min(attack.troops, lost / fightMultiplier(attacker));
      const defenderLoss = Math.min(defender.soldiers, lost / fightMultiplier(defender));
      attack.troops -= attackerLoss;
      defender.soldiers -= defenderLoss;
      defender.troops -= defenderLoss;
      const ratio = attackStrength / defendStrength;
      share = ratio > 1 ? RULES.advanceShare * (1 - 1 / ratio) : 0;
      // Tiles are earned fractionally, so a small edge moves the front slowly and a tie not at all.
      attack.carry = (attack.carry ?? 0) + candidates.length * share;
      if (attack.carry < 1) continue;
    }

    // Grow round blobs: prefer tiles the attacker already wraps around and
    // tiles near its middle, with the map's noise field adding irregular
    // lobes and a little randomness keeping the edge alive.
    const fx = attack.focus % W;
    const fy = Math.floor(attack.focus / W);
    const cx = attacker.sumX / attacker.tiles;
    const cy = attacker.sumY / attacker.tiles;
    const radius = Math.sqrt(attacker.tiles / Math.PI) + 1; // of a disc that size
    const scored = candidates.map((t) => {
      const x = t % W;
      const y = Math.floor(t / W);
      let mine = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const n = t + dy * W + dx;
          if ((dx || dy) && n >= 0 && n < grid.size && game.owner[n] === attack.attacker) mine++;
        }
      }
      const round = Math.hypot(x - cx, y - cy) / radius;
      const focus = Math.hypot(x - fx, y - fy) * 0.003;
      return [t, mine * 0.35 + grid.noise[t] * 1.6 + random(game) * 0.35 - round * 5 - focus];
    });
    scored.sort((a, b) => b[1] - a[1]);
    // At most part of the front moves per tick, so the best-placed tiles
    // (roundest) go first and the edge advances evenly, not a grid ring at a time.
    let count;
    if (defender) {
      count = Math.min(Math.floor(attack.carry), attack.limit);
      attack.carry -= count;
    } else count = Math.max(1, Math.min(Math.ceil(scored.length * share), attack.limit));
    for (let i = 0; i < count; i++) {
      attack.limit--;
      setOwner(grid, game, scored[i][0], attack.attacker);
      game.protect.set(scored[i][0], game.tick + RULES.protectSeconds * RULES.ticksPerSecond);
    }
  }
  if (finished.size) game.attacks = game.attacks.filter((a) => !finished.has(a.id));
}

// Slivers: a nation's tile almost surrounded by one other nation (at most 2
// of its 8 neighbors its own, at least 5 the other's) goes to that nation.
// This clears 1-tile strips, diagonal chains and stray tiles left by fronts.
function absorbSlivers(grid, game, from) {
  const W = grid.width;
  const { owner } = game;
  const queue = game.dirty.slice(from);
  const counts = new Map();
  const check = (t) => {
    const o = owner[t];
    if (o < 0) return;
    const until = game.protect.get(t);
    if (until !== undefined) {
      if (until > game.tick) return;
      game.protect.delete(t);
    }
    const x = t % W;
    let own = 0;
    counts.clear();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= W) continue;
        const n = t + dy * W + dx;
        if (n < 0 || n >= grid.size) continue;
        const p = owner[n];
        if (p === o) own++;
        else if (p >= 0) counts.set(p, (counts.get(p) ?? 0) + 1);
      }
    }
    if (own > 2) return;
    for (const [p, c] of counts) {
      if (c < 5) continue;
      setOwner(grid, game, t, p);
      queue.push(t);
      return;
    }
  };
  for (let i = 0; i < queue.length && i < 50000; i++) {
    const t = queue[i];
    const x = t % W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = t + dy * W + dx;
        if (x + dx >= 0 && x + dx < W && n >= 0 && n < grid.size) check(n);
      }
    }
  }
}

function updateBoats(grid, game) {
  const landed = [];
  for (const boat of game.boats) {
    if (game.tick < boat.arriveTick) continue;
    landed.push(boat.id);
    const attacker = game.nations[boat.attacker];
    if (!attacker.alive) continue;
    const target = game.owner[boat.to];
    if (grid.river[boat.to] || target === boat.attacker || (target >= 0 && isAllied(game, boat.attacker, target))) {
      recall(attacker, boat.troops, boat.settling);
      continue;
    }
    // Landing on a nation's coast needs a real force (a settler boat whose land was taken meanwhile is thrown back).
    if (target >= 0 && boat.troops < RULES.landingMin) {
      if (boat.attacker === game.player) logEvent(game, "Your landing was thrown back.");
      continue;
    }
    setOwner(grid, game, boat.to, boat.attacker);
    game.attacks.push({ id: game.nextId++, attacker: boat.attacker, target, troops: boat.troops, focus: boat.to });
    if (boat.attacker === game.player) logEvent(game, "Your boats landed.");
    else if (target === game.player) logEvent(game, `${attacker.name} landed on your coast!`);
  }
  if (landed.length) game.boats = game.boats.filter((b) => !landed.includes(b.id));
}

// What touches the nation's land: owner -> number of border contacts
// (WILD included), and one tile of each owner to aim at.
function neighborsOf(grid, game, nation) {
  const counts = new Map();
  const aim = new Map();
  for (const t of nation.border) {
    if (grid.river[t]) continue;
    forNeighbors(grid, t, (n) => {
      const o = game.owner[n];
      if (o === nation.index || o === WATER || grid.river[n]) return;
      counts.set(o, (counts.get(o) ?? 0) + 1);
      if (!aim.has(o)) aim.set(o, n);
    });
  }
  return { counts, aim };
}

// Each bot has its own temperament, so they don't all play alike:
// aggression  how readily it attacks neighbors, and with how much
// armyShare   share of its people under arms in peace: warlike bots keep
//             more, peaceful ones keep workers (more gold, food, growth);
//             a few warlords live near all-army
// stubborn    won't send soldiers home when food and gold run low, and may
//             go bankrupt for it
// expand   share of spare people sent to settle empty land each time;
//          peaceful bots lean on it more
// reserve  share of a full army it keeps home
// pace     seconds between decisions
function temperament(game) {
  const r = () => random(game);
  const aggression = 0.15 + r() * 0.75;
  const warlord = aggression > 0.75 && r() < 0.5;
  return {
    aggression,
    armyShare: warlord ? 0.6 + r() * 0.4 : Math.max(RULES.minArmyShare, 0.12 + aggression * 0.3 + (r() - 0.5) * 0.08),
    stubborn: r() < (warlord ? 0.6 : 0.15),
    expand: 0.5 + (1 - aggression) * 0.3 + r() * 0.2,
    reserve: 0.15 + r() * 0.25,
    pace: 0.8 + r() * 1.6,
    // Food trading: seconds of eating kept in stock, and the price above which
    // it sells the rest. Greedy bots keep little and sell early, and may starve.
    foodReserve: 10 + r() * 110,
    sellAbove: 3 + r() * 6,
    // Lending: whether it lends at all, and its interest rate (some lend free).
    trader: r() < 0.7, // opens trade routes
    industry: r() < 0.7, // builds factories
    smith: r() < 0.6, // upgrades its army
    ally: r() < 0.6, // open to alliances
    allyFood: { on: r() < 0.7, discount: ((x) => (x < 0.3 ? 0 : x < 0.6 ? 0.3 : x < 0.9 ? 0.8 : 1))(r()) }, // sells food to allies at this much off the market price
    payer: ((x) => (x < 0.3 ? "prompt" : x < 0.65 ? "gradual" : x < 0.9 ? "late" : "cheat"))(r()), // how it repays: promptly, slowly, at the last moment, never
    lends: r() < 0.6,
    lendRate: r() < 0.15 ? 0 : r() < 0.2 ? 0.5 : 0.05 + r() * 0.3,
  };
}

function botBuild(grid, game, bot) {
  const mind = bot.mind;
  const city = cityCost(bot);
  // Industry: factories when rich, army upgrades when steel allows, spare steel sold.
  if (bot.factories < maxFactories(bot) && bot.gold > factoryCost(bot) * 1.3 && (mind.industry || steelUse(bot) > steelRate(bot) * 0.8)) buildFactory(game, bot.index);
  if (mind.smith && bot.armyLevel < 6) {
    const c = armyUpgradeCost(bot);
    if (bot.gold > c.gold * 1.3 && bot.steel >= c.steel) upgradeArmy(game, bot.index);
  }
  const keepSteel = (citySteel(bot) + armyUpgradeCost(bot).steel) * 1.5 + steelUse(bot) * 300;
  if (bot.steel > keepSteel && game.steel.price >= RULES.steelBasePrice) sellSteel(game, bot.index, (bot.steel - keepSteel) * 0.5);
  const need = citySteel(bot);
  if (bot.gold >= city && bot.steel < need) buySteel(game, bot.index, need - bot.steel);
  if (bot.gold < cityCost(bot) || (extraPeople(bot) === 0 && random(game) >= 0.5)) return; // over the cap: upgrade at once
  const reach = Math.sqrt(bot.tiles) * 0.4;
  const cx = bot.sumX / bot.tiles;
  const cy = bot.sumY / bot.tiles;
  for (let i = 0; i < 12; i++) {
    const x = Math.round(cx + (random(game) * 2 - 1) * reach);
    const y = Math.round(cy + (random(game) * 2 - 1) * reach);
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
    if (buildCity(grid, game, bot.index, y * grid.width + x) === null) break;
  }
}

// Bots decide on their own, each at its own pace: grow into empty land next
// to them as fast as their army allows, attack neighbors they outmatch
// (more readily the more aggressive they are), and sail elsewhere when boxed in.
function updateBots(grid, game) {
  const graceOver = secondsPlayed(game) > RULES.playerGraceSeconds;
  for (const bot of game.nations) {
    if (!bot.alive || bot.index === game.player || bot.frozen || game.tick < bot.nextThinkTick) continue;
    bot.mind ??= temperament(game);
    const mind = bot.mind;
    bot.nextThinkTick = game.tick + Math.round(mind.pace * (0.7 + random(game) * 0.6) * RULES.ticksPerSecond);
    botBuild(grid, game, bot);
    askAllies(game, bot);
    if (mind.trader && random(game) < RULES.botRouteChance) botOpensRoute(game, bot);
    seekLoan(game, bot);
    if (game.market.price >= mind.sellAbove && !bot.starving) {
      const keepFood = foodEaten(bot) * mind.foodReserve;
      if (bot.food > keepFood) sellFood(game, bot, (bot.food - keepFood) * 0.5, true);
    }

    // Under attack, call workers to arms; once safe, go back to its way. When
    // food runs short, send soldiers home to farm (less so if gold can still
    // buy food); stubborn bots don't, and may go broke.
    const underAttack = game.attacks.some((a) => a.target === bot.index);
    let share = underAttack ? Math.max(mind.armyShare, 0.5 + 0.4 * mind.aggression) : mind.armyShare;
    // Hungry: stores low and this share would eat more than it grows.
    const breakEven = 1 - RULES.foodPerPerson / RULES.foodPerWorker;
    const hungry = share > breakEven && bot.food < foodEaten(bot) * 30;
    if (hungry && !mind.stubborn) {
      const broke = bot.gold < foodEaten(bot) * game.market.price * 60;
      share = Math.min(share, broke ? 0.2 : underAttack ? 0.45 : 0.3);
    }
    // The target share; drafting itself is slow and costs gold (see draft).
    if (!bot.manualShare) bot.armyShare = Math.min(1, Math.max(RULES.minArmyShare, share)); // the dev lab can pin it
    const max = maxTroops(bot) * bot.armyShare; // a full army
    const keep = max * (mind.reserve + (underAttack ? 0.2 : 0));
    const { counts, aim } = neighborsOf(grid, game, bot);
    if (mind.ally && secondsPlayed(game) > RULES.allyAfterSeconds && random(game) < RULES.botProposeChance) botProposes(game, bot, counts);

    // Strength against a neighbor: how well its soldiers fight, upgrades and shortages included.
    const power = (n) => strength(bot) / Math.max(strength(n), RULES.minStrength);
    const grudge = (n) => (game.loans.some((l) => l.lender === bot.index && l.borrower === n.index && l.defaulted) ? RULES.loanDefaultGrudge : 1);
    // How much of an opening the neighbour offers beyond raw strength.
    const opening = (n) => {
      let f = 1;
      if (game.attacks.some((a) => a.target === n.index && a.attacker !== bot.index)) f *= RULES.oppBusy;
      if (n.tiles < 30) f *= RULES.oppTiny;
      if (n.steelShort || n.unrest > 0.5 || (n.gold < 50 && army(n) < army(bot) * 0.3)) f *= RULES.oppWeak;
      return f;
    };
    const advantage = (n) => power(n) * grudge(n) * opening(n);

    // Attacked by a neighbor: hit back at it unless the fight is hopeless;
    // harder the more aggressive. This doesn't stop it also striking elsewhere.
    if (underAttack && random(game) < 0.5 + 0.4 * mind.aggression) {
      const foe = game.attacks
        .filter((a) => a.target === bot.index && counts.has(a.attacker) && power(game.nations[a.attacker]) > 0.4)
        .sort((a, b) => b.troops - a.troops)[0];
      const sent = army(bot) * (0.2 + 0.4 * mind.aggression);
      if (foe && sent >= RULES.minAttackTroops) sendTroops(grid, game, bot.index, aim.get(foe.attacker), sent);
    }

    // An ally is under attack by a neighbor of ours: help it.
    for (const a of game.attacks) {
      if (a.attacker === bot.index || !counts.has(a.attacker) || !isAllied(game, bot.index, a.target) || isAllied(game, bot.index, a.attacker)) continue;
      const sent = army(bot) * 0.25;
      if (random(game) < 0.3 + 0.4 * mind.aggression && sent >= RULES.minAttackTroops) sendTroops(grid, game, bot.index, aim.get(a.attacker), sent);
      break;
    }

    // Empty land next door: keep settling it.
    if (counts.has(WILD)) {
      sendTroops(grid, game, bot.index, aim.get(WILD), 0); // settling is free: no soldiers, no workers
      continue;
    }

    // Empty land just across a river: ferry settlers over.
    if (random(game) < 0.4) {
      const across = wildAcrossRiver(grid, game, bot);
      if (across >= 0 && !sendTroops(grid, game, bot.index, across, 0)) continue;
    }

    const free = army(bot) - keep; // what is left after any counter-attack
    if (free < RULES.minAttackTroops) continue;
    // Over the cap it can't feed everyone: cautious bots stop attacking (the
    // headroom they accept grows with aggression), reckless ones push on, and
    // any bot pushes on when the opening is big.
    const overCap = extraPeople(bot) / maxTroops(bot) > 0.1 + mind.aggression * 0.9;
    // Opportunism: any neighbor it outmatches is a target, even while it
    // fights someone else; a neighbor it isn't yet attacking looks better.
    let best = null;
    for (const o of counts.keys()) {
      if (o < 0 || (o === game.player && !graceOver) || isAllied(game, bot.index, o)) continue;
      const n = game.nations[o];
      const fresh = game.attacks.some((a) => a.attacker === bot.index && a.target === o) ? 1 : 1.15;
      const score = advantage(n) * fresh;
      if (!best || score > best.score) best = { o, score, starving: n.starving };
    }
    const needed = Math.max(0.75, 1.55 - 0.8 * mind.aggression); // outmatch needed to attack
    const chance = mind.aggression * 0.15 + (best?.starving ? 0.15 : 0);
    if (best && (!overCap || best.score > RULES.oppBig) && (best.score > needed || random(game) < chance)) {
      // A clear opening is pressed as a campaign: fresh soldiers keep going until the front closes.
      const campaign = best.score > needed * 1.3;
      sendTroops(grid, game, bot.index, aim.get(best.o), free * (0.35 + 0.45 * mind.aggression + (campaign ? 0.15 : 0)), campaign ? { campaign: true, ratio: 0.3 } : {});
      continue;
    }
    if (overCap) continue;

    // Boxed in, or restless: sail to empty coast if any, else a weak rival's.
    if (counts.size === 0 || random(game) < 0.04 + mind.aggression * 0.06) {
      let best = -1;
      for (let i = 0; i < 40; i++) {
        const t = grid.coastTiles[Math.floor(random(game) * grid.coastTiles.length)];
        const o = game.owner[t];
        if (o === bot.index || (o === game.player && !graceOver) || (o >= 0 && isAllied(game, bot.index, o))) continue;
        if (o === WILD) {
          best = t;
          break;
        }
        if (best < 0) best = t;
      }
      if (best >= 0) sendTroops(grid, game, bot.index, best, free * 0.4);
    }
  }
}

function checkEnd(grid, game) {
  const player = game.nations[game.player];
  if (player.alive && landShare(grid, player) >= RULES.winShare) {
    game.phase = "won";
    game.winner = player.index;
    return;
  }
  const rival = game.nations.find((n) => n.alive && landShare(grid, n) >= RULES.winShare);
  if (rival) {
    game.phase = "lost";
    game.winner = rival.index;
  } else if (!player.alive) {
    game.phase = "lost";
  }
}

// Builds a city on one of the nation's tiles. Returns a reason on failure.
export function buildCity(grid, game, nationIndex, tile) {
  const nation = game.nations[nationIndex];
  if (game.owner[tile] !== nationIndex) return "Build cities on your own land.";
  if (nation.level >= maxCities(nation)) return "You need more land for another city.";
  if (game.cities.some((c) => distance(grid, c, tile) < RULES.minCityGap)) return "Too close to another city.";
  const cost = cityCost(nation);
  if (nation.gold < cost) return `A city costs ${cost} gold.`;
  const steel = citySteel(nation);
  if (nation.steel < steel) return `This upgrade needs ${steel} steel.`;
  nation.gold -= cost;
  nation.steel -= steel;
  game.cities.push(tile);
  nation.level++;
  countCities(game);
  return null;
}

// Factories and army upgrades (no placement: they count toward the nation, limited by land).
export function buildFactory(game, nationIndex) {
  const n = game.nations[nationIndex];
  if (n.factories >= maxFactories(n)) return `You need more land: one factory per ${RULES.tilesPerFactory} tiles.`;
  const cost = factoryCost(n);
  if (n.gold < cost) return `A factory costs ${cost} gold.`;
  n.gold -= cost;
  n.factories++;
  if (nationIndex === game.player) logEvent(game, `You built a factory (${n.factories}).`);
  return null;
}

export function upgradeArmy(game, nationIndex) {
  const n = game.nations[nationIndex];
  if (n.armyLevel >= RULES.maxArmyLevel) return "Your army is fully upgraded.";
  const c = armyUpgradeCost(n);
  if (n.gold < c.gold) return `This army upgrade costs ${c.gold} gold.`;
  if (n.steel < c.steel) return `This army upgrade needs ${c.steel} steel.`;
  n.gold -= c.gold;
  n.steel -= c.steel;
  n.armyLevel++;
  if (nationIndex === game.player) logEvent(game, `Your army is now level ${n.armyLevel}.`);
  return null;
}

// ---- steel market: one global stock, price by scarcity, flat fee -------------
function updateSteelMarket(game, dt) {
  const m = game.steel;
  let output = 0;
  for (const n of game.nations) if (n.alive) output += steelRate(n);
  m.target = RULES.steelTarget + output * 300;
  m.stock ??= m.target;
  const goal = RULES.steelBasePrice * (m.target / (m.stock + 1));
  m.price += (clamp(goal, RULES.steelMinPrice, RULES.steelMaxPrice) - m.price) * Math.min(1, RULES.marketPriceEase * dt);
}

export function buySteel(game, nationIndex, amount, quiet = false) {
  const n = game.nations[nationIndex];
  const m = game.steel;
  const unit = m.price * (1 + RULES.steelFee);
  const buy = Math.min(amount, m.stock ?? 0, n.gold / unit);
  if (!(buy >= 0.5)) return 0;
  m.stock -= buy;
  n.steel += buy;
  n.gold -= buy * unit;
  if (nationIndex === game.player && !quiet) logEvent(game, `You bought ${Math.round(buy)} steel for ${Math.round(buy * unit)} gold.`);
  return buy;
}

export function sellSteel(game, nationIndex, amount) {
  const n = game.nations[nationIndex];
  const m = game.steel;
  const sold = Math.min(amount, n.steel);
  if (!(sold >= 0.5)) return 0;
  n.steel -= sold;
  m.stock = (m.stock ?? 0) + sold;
  n.gold += sold * m.price * (1 - RULES.steelFee);
  if (nationIndex === game.player) logEvent(game, `You sold ${Math.round(sold)} steel for ${Math.round(sold * m.price * (1 - RULES.steelFee))} gold.`);
  return sold;
}

// Moves the army toward its target share, slowly, paying gold per recruit.
function draft(game, n, dt) {
  while (n.training.length && n.training[0].tick <= game.tick) {
    const done = n.training.shift();
    n.soldiers += done.count;
    n.inTraining -= done.count;
  }
  const target = n.armyShare * n.troops;
  const step = RULES.draftRate * n.troops * dt;
  const have = n.soldiers + n.inTraining;
  if (have < target) {
    const afford = RULES.draftCost > 0 ? n.gold / RULES.draftCost : Infinity;
    const recruits = Math.min(target - have, step, workers(n), afford);
    if (recruits <= 0) return;
    n.inTraining += recruits;
    n.gold -= recruits * RULES.draftCost;
    const tick = game.tick + Math.round(RULES.trainSeconds * RULES.ticksPerSecond);
    const last = n.training.at(-1);
    if (last && last.tick === tick) last.count += recruits;
    else n.training.push({ tick, count: recruits });
  } else if (n.soldiers > target) {
    n.soldiers -= Math.min(n.soldiers - target, step);
  }
}

// Soldiers out fighting cost gold, and so do the home soldiers of a nation under attack.
function payUpkeep(game, dt) {
  const soldiers = new Map();
  for (const a of game.attacks) {
    if (a.target === WILD) continue;
    soldiers.set(a.attacker, (soldiers.get(a.attacker) ?? 0) + a.troops);
    if (!soldiers.has(`home${a.target}`)) soldiers.set(`home${a.target}`, game.nations[a.target].soldiers);
  }
  for (const [key, count] of soldiers) {
    const n = game.nations[typeof key === "string" ? Number(key.slice(4)) : key];
    n.gold = Math.max(0, n.gold - RULES.warUpkeep * count * dt);
  }
}

// ---- global food market -------------------------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Sets the price from the stock and the queue; keeps a short history.
function updateMarket(game, dt) {
  const m = game.market;
  let eating = 0;
  for (const n of game.nations) if (n.alive) eating += foodEaten(n);
  m.target = Math.max(100, eating * RULES.marketTargetSeconds);
  m.stock ??= m.target;
  m.need = 0;
  for (const i of m.queue) m.need += Math.max(0, -game.nations[i].food);
  const goal = RULES.marketBasePrice * (m.target / (m.stock + 1)) ** 1.5 * (1 + (2 * m.need) / m.target);
  m.price += (clamp(goal, RULES.marketMinPrice, RULES.marketMaxPrice) - m.price) * Math.min(1, RULES.marketPriceEase * dt);
  if (game.tick % (5 * RULES.ticksPerSecond) === 0) {
    m.history.push({ t: Math.round(secondsPlayed(game)), price: +m.price.toFixed(2), stock: Math.round(m.stock), queue: m.queue.length, need: Math.round(m.need) });
    if (m.history.length > 720) m.history.shift();
  }
}

// Share of a sale that goes to tax: more the more of the nation's income
// food sales already are.
export function sellTaxRate(n) {
  const share = n.foodEarnLong / (goldIncome(n) + 1);
  return Math.min(RULES.marketSellTaxMax, RULES.marketSellTaxBase + RULES.marketSellTaxProgressive * Math.min(1, share));
}

// A nation sells food into the market at the current price, minus the tax.
// `note` marks a deliberate sale (worth logging); overflow sales are routine.
function sellFood(game, n, amount, note = false) {
  const m = game.market;
  amount = Math.min(amount, n.food);
  if (!(amount > 0)) return 0;
  const gross = amount * m.price;
  const fee = gross * sellTaxRate(n);
  n.food -= amount;
  m.stock = (m.stock ?? 0) + amount;
  n.gold += gross - fee;
  m.fees += fee;
  n._earned += gross - fee;
  n.foodSoldTotal += amount;
  n.foodEarnedTotal += gross - fee;
  if (note) {
    m.trades.push({ t: Math.round(secondsPlayed(game)), nation: n.name, amount: Math.round(amount), price: +m.price.toFixed(2) });
    if (m.trades.length > 300) m.trades.shift();
  }
  return amount;
}

// Buyers are served in the order they ran short, from whatever stock there is.
function settleMarket(game) {
  const m = game.market;
  for (const i of m.queue) {
    const n = game.nations[i];
    if (!n.alive || n.food >= 0) continue;
    const unit = m.price * (1 + RULES.marketBuyTax);
    const buy = Math.min(-n.food, m.stock, n.gold / unit);
    if (!(buy > 0)) continue;
    const cost = buy * unit;
    m.stock -= buy;
    m.fees += buy * m.price * RULES.marketBuyTax;
    n.food += buy;
    n.gold -= cost;
    n._bought += buy;
    n._spent += cost;
    n.foodBoughtTotal += buy;
    n.foodSpentTotal += cost;
  }
  m.queue = m.queue.filter((i) => game.nations[i].alive && game.nations[i].food < 0);
}

// Food for a second's slice: grow, eat, store; what doesn't fit the store is
// sold; a shortfall joins the market queue.
function feed(game, n, dt) {
  const k = Math.min(1, dt / 5);
  n.foodBought += (n._bought / dt - n.foodBought) * k;
  n.foodSpend += (n._spent / dt - n.foodSpend) * k;
  n.foodEarn += (n._earned / dt - n.foodEarn) * k;
  n.foodEarnLong += (n._earned / dt - n.foodEarnLong) * Math.min(1, dt / 60);
  n._bought = n._spent = n._earned = 0;
  // Ally food is eaten first; the nation's own stock only covers what is left.
  const eat = foodEaten(n) * dt;
  const fromAllies = Math.min(n.allyFood, eat);
  n.allyFood -= fromAllies;
  n.allySellable = Math.min(n.allySellable, n.allyFood);
  n.food += foodMade(n) * dt - (eat - fromAllies);
  const store = foodStore(n);
  if (n.food > store) sellFood(game, n, n.food - store);
  if (n.food < 0 && !game.market.queue.includes(n.index)) game.market.queue.push(n.index);
}

// ---- loans -------------------------------------------------------------------
const debtOf = (game, n) => game.loans.reduce((sum, l) => (l.borrower === n.index ? sum + l.owed : sum), 0);
const isBanned = (game, n) => game.tick < n.creditBanUntil;

// Loans on offer to `borrower` (for at most `want` gold), cheapest first: bots
// that lend (at their rate plus a surcharge for past defaults) and the
// player's standing offer.
export function listOffers(game, borrower, want = Infinity) {
  const out = [];
  if (!borrower?.alive || isBanned(game, borrower) || borrower.defaults >= RULES.loanRefuseDefaults) return out;
  for (const l of game.nations) {
    if (!l.alive || l.index === borrower.index) continue;
    if (game.loans.some((x) => x.lender === l.index && x.borrower === borrower.index)) continue;
    let rate;
    let cap;
    if (l.index === game.player) {
      if (!l.offer.on) continue;
      rate = l.offer.rate;
      cap = l.offer.max * l.gold;
    } else {
      if (!l.mind?.lends) continue;
      rate = Math.min(1, l.mind.lendRate + RULES.loanDefaultSurcharge * borrower.defaults);
      cap = (l.gold - (2000 + foodEaten(l) * 60 * game.market.price)) * 0.3;
    }
    const amount = Math.min(want, cap);
    if (amount < 200) continue;
    out.push({ lender: l.index, name: l.name, rate, amount: Math.floor(amount) });
  }
  return out.sort((a, b) => a.rate - b.rate || b.amount - a.amount);
}

// Lends `amount` gold; the borrower will owe amount x (1 + rate) by the due date.
export function makeLoan(game, lender, borrower, amount, rate) {
  amount = Math.min(amount, lender.gold);
  if (!(amount > 0)) return null;
  lender.gold -= amount;
  borrower.gold += amount;
  const loan = {
    id: game.nextId++,
    lender: lender.index,
    borrower: borrower.index,
    principal: Math.round(amount),
    owed: amount * (1 + rate),
    rate,
    tick: game.tick,
    due: game.tick + RULES.loanDueSeconds * RULES.ticksPerSecond,
    defaulted: false,
  };
  game.loans.push(loan);
  const st = (game.loanStats ??= { made: 0, principal: 0, free: 0, rateSum: 0, defaulted: 0 });
  st.made++;
  st.principal += Math.round(amount);
  st.rateSum += rate;
  if (rate === 0) st.free++;
  if (borrower.index === game.player) logEvent(game, `${lender.name} lent you ${Math.round(amount)} gold at ${Math.round(rate * 100)}% interest.`);
  else if (lender.index === game.player) logEvent(game, `You lent ${Math.round(amount)} gold to ${borrower.name} at ${Math.round(rate * 100)}%.`);
  return loan;
}

// The borrower takes up one of the listed offers. Returns a reason on failure.
export function takeLoan(game, borrowerIndex, lenderIndex, amount) {
  const borrower = game.nations[borrowerIndex];
  if (isBanned(game, borrower)) return "You can not borrow right now: you defaulted on a loan.";
  if (debtOf(game, borrower) > RULES.loanMaxDebtSeconds * goldIncome(borrower)) return "You owe too much already.";
  const offer = listOffers(game, borrower).find((o) => o.lender === lenderIndex);
  if (!offer) return "That offer is gone.";
  amount = Math.min(Math.floor(amount), offer.amount);
  if (amount < 100) return "Too small a loan.";
  makeLoan(game, game.nations[lenderIndex], borrower, amount, offer.rate);
  return null;
}

// The player (or a lab call) lends to a nation of its choosing. A bot accepts
// when it is in food trouble, can carry the debt and the rate is not absurd.
export function lendTo(game, lenderIndex, borrowerIndex, amount, rate) {
  const lender = game.nations[lenderIndex];
  const b = game.nations[borrowerIndex];
  if (!b?.alive || b.index === lender.index) return "Pick another nation.";
  if (isBanned(game, b) || b.defaults >= RULES.loanRefuseDefaults) return `${b.name} is not creditworthy.`;
  if (!inFoodTrouble(game, b)) return `${b.name} does not need a loan.`;
  if (rate > 0.6) return `${b.name} refuses that interest.`;
  if (debtOf(game, b) > RULES.loanMaxDebtSeconds * goldIncome(b)) return `${b.name} owes too much already.`;
  if (game.loans.some((x) => x.lender === lender.index && x.borrower === b.index)) return `${b.name} already owes you.`;
  amount = Math.min(Math.floor(amount), Math.floor(lender.gold));
  if (amount < 100) return "Too small a loan.";
  makeLoan(game, lender, b, amount, rate);
  return null;
}

// The borrower pays `amount` gold (as much as it has) toward a loan.
export function repayLoan(game, loanId, amount) {
  const l = game.loans.find((x) => x.id === loanId);
  if (!l) return 0;
  const b = game.nations[l.borrower];
  const pay = Math.min(amount, l.owed, b.gold);
  if (!(pay > 0)) return 0;
  b.gold -= pay;
  l.owed -= pay;
  const lender = game.nations[l.lender];
  if (lender.alive) lender.gold += pay;
  if (l.borrower === game.player) logEvent(game, `You paid ${Math.round(pay)} gold to ${lender.name}${l.owed < 0.5 ? ": the loan is repaid." : "."}`);
  else if (l.lender === game.player) logEvent(game, `${b.name} paid you ${Math.round(pay)} gold${l.owed < 0.5 ? ": the loan is repaid." : "."}`);
  return pay;
}

export function setOffer(game, nationIndex, patch) {
  const n = game.nations[nationIndex];
  n.offer = { ...n.offer, ...patch };
}

const inFoodTrouble = (game, n) => n.starving || game.market.queue.includes(n.index) || n.food + n.allyFood < foodEaten(n) * 15;

// A bot in trouble feeding itself takes the cheapest loan on offer.
function seekLoan(game, n) {
  const deficit = Math.max(0, foodEaten(n) - foodMade(n));
  const want = Math.max(500, deficit * game.market.price * 90);
  if (!inFoodTrouble(game, n) || n.gold > want * 0.5) return;
  if (debtOf(game, n) > RULES.loanMaxDebtSeconds * goldIncome(n)) return;
  const offer = listOffers(game, n, want)[0];
  if (offer) makeLoan(game, game.nations[offer.lender], n, offer.amount, offer.rate);
}

// Bot borrowers pay by temperament: promptly, a little at a time, only at the
// last moment, or never. The player pays by hand (repayLoan).
function botRepays(game, l, b, dt) {
  const style = b.mind?.payer ?? "gradual";
  if (style === "cheat") return;
  let pay = 0;
  if (style === "prompt") pay = goldIncome(b) * 0.4 * dt;
  else if (style === "gradual") pay = goldIncome(b) * 0.1 * dt;
  else if (style === "late" && game.tick >= l.due - 90 * RULES.ticksPerSecond) pay = b.gold; // all it can, once the date is near
  pay = Math.min(pay, l.owed, b.gold);
  if (pay <= 0) return;
  b.gold -= pay;
  l.owed -= pay;
  const lender = game.nations[l.lender];
  if (lender.alive) lender.gold += pay;
}

// Falls due: still owed means default.
function serviceLoans(game, dt) {
  for (const l of game.loans) {
    const b = game.nations[l.borrower];
    if (!b.alive) {
      l.owed = 0; // the debt dies with the borrower
      continue;
    }
    if (b.index !== game.player) botRepays(game, l, b, dt);
    if (!l.defaulted && game.tick >= l.due && l.owed > 0.5) {
      l.defaulted = true;
      b.defaults++;
      b.creditBanUntil = game.tick + RULES.loanBanSeconds * RULES.ticksPerSecond;
      game.loanStats.defaulted++;
      const lender = game.nations[l.lender];
      if (l.lender === game.player) logEvent(game, `${b.name} has defaulted on your loan.`);
      else if (l.borrower === game.player) logEvent(game, `You defaulted on a loan from ${lender.name}: you can not borrow for a while.`);
    }
  }
  game.loans = game.loans.filter((l) => l.owed > 0.5);
}

// ---- trade routes --------------------------------------------------------------
const segDist = (x, y, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
};

// Distance in tiles (capped at 4) from each water tile to the nearest land, 0 on land.
function coastDistance(grid) {
  const { width: W, size, land } = grid;
  const d = new Uint8Array(size).fill(255);
  let queue = [];
  for (let i = 0; i < size; i++) {
    if (land[i]) {
      d[i] = 0;
      queue.push(i);
    }
  }
  for (let step = 1; step <= 4; step++) {
    const next = [];
    for (const t of queue) {
      const x = t % W;
      for (const n of [x > 0 ? t - 1 : -1, x < W - 1 ? t + 1 : -1, t - W, t + W]) {
        if (n < 0 || n >= size || d[n] !== 255) continue;
        d[n] = step;
        next.push(n);
      }
    }
    queue = next;
  }
  return d;
}

// Whether two points on the shore touch the same sea (the Caspian and the lakes are not the ocean).
function sameSea(grid, a, b) {
  const comp = (grid.waterComp ??= waterComponents(grid));
  const i = snapWater(grid, a);
  const j = snapWater(grid, b);
  return i >= 0 && j >= 0 && comp[i] === comp[j];
}

// A boat's water path: the cheap coarse sea route gives the way, and each stretch of it is then
// worked out over the fine water tiles (a straight hop where a stretch can't be, as in a narrow strait).
export function corridorPath(grid, nav, from, landing) {
  const W = grid.width;
  const k = nav.scale;
  const xy = (t) => [((t % W) + 0.5) * k, (Math.floor(t / W) + 0.5) * k];
  const coarse = grid.seaRoute(from, landing);
  if (!coarse) return null;
  const pts = [xy(from)];
  for (let i = 6; i < coarse.points.length - 1; i += 6) pts.push([coarse.points[i][0] * k, coarse.points[i][1] * k]);
  pts.push(xy(landing));
  const line = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = waterPath(nav, pts[i], pts[i + 1], 0.3, 1.3, null, 60000) ?? [pts[i], pts[i + 1]];
    line.push(...(line.length ? seg.slice(1) : seg));
  }
  return line;
}

// Drops the points of a water path that a straight sail over open water makes unnecessary.
function straighten(grid, path) {
  const { width: W, land } = grid;
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let k = 1; k < n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n;
      const y = a[1] + ((b[1] - a[1]) * k) / n;
      if (land[Math.floor(y) * W + Math.floor(x)]) return false;
    }
    return true;
  };
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = Math.min(i + 40, path.length - 1);
    while (j > i + 1 && !clear(path[i], path[j])) j--;
    out.push(path[j]);
    i = j;
  }
  return out;
}

// Labels every water tile with the sea it belongs to (the oceans, the Caspian, lakes ...).
function waterComponents(grid) {
  const { width: W, size, land } = grid;
  const label = new Int32Array(size);
  const stack = new Int32Array(size);
  let next = 0;
  for (let i = 0; i < size; i++) {
    if (land[i] || label[i]) continue;
    label[i] = ++next;
    let top = 0;
    stack[top++] = i;
    while (top) {
      const t = stack[--top];
      const x = t % W;
      for (const n of [x > 0 ? t - 1 : -1, x < W - 1 ? t + 1 : -1, t - W, t + W]) {
        if (n < 0 || n >= size || label[n]) continue;
        if (land[n]) {
          // a strait a few tiles wide (Gibraltar, Bosphorus, Suez ...) still joins the seas on either side
          const d = n - t;
          for (let g = 2; g <= 4; g++) {
            const m = t + d * g;
            if (m < 0 || m >= size || (Math.abs(d) === 1 && Math.floor(m / W) !== Math.floor(t / W))) break;
            if (land[m]) continue;
            if (!label[m]) {
              label[m] = next;
              stack[top++] = m;
            }
            break;
          }
          continue;
        }
        label[n] = next;
        stack[top++] = n;
      }
    }
  }
  return label;
}

// The nearest water tile to a point on the tile grid, or -1.
function snapWater(grid, [px, py]) {
  const { width: W, height: H, land } = grid;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  for (let r = 0; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = x0 + dx;
        const y = y0 + dy;
        if (x >= 0 && y >= 0 && x < W && y < H && !land[y * W + x]) return y * W + x;
      }
    }
  }
  return -1;
}

// A path through open water between two points on the tile grid (A*, keeping off the coast
// where it can): a list of [x, y], or null when the sea does not connect them (a canal or strait
// narrower than a tile).
export function waterPath(grid, a, b, coastPenalty = 0.5, weight = 1.3, allow = null, maxPops = 700000) {
  const { width: W, height: H, size, land } = grid;
  const cd = (grid.coastDist ??= coastDistance(grid));
  const start = snapWater(grid, a);
  const goal = snapWater(grid, b);
  if (start < 0 || goal < 0) return null;
  const comp = (grid.waterComp ??= waterComponents(grid));
  if (comp[start] !== comp[goal]) return null; // different seas: no path exists, so don't search
  const gx = goal % W;
  const gy = Math.floor(goal / W);
  // Search buffers are kept between calls and only the tiles a search touched are reset.
  const buf = (grid.pathBuf ??= { cost: new Float32Array(size).fill(Infinity), prev: new Int32Array(size).fill(-1), touched: [] });
  const { cost, prev, touched } = buf;
  const heap = []; // [f, tile, cost] entries, as a binary min-heap
  const push = (f, t, g) => {
    let i = heap.length;
    heap.push([f, t, g]);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const h = (t) => {
    const dx = Math.abs((t % W) - gx);
    const dy = Math.abs(Math.floor(t / W) - gy);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  cost[start] = 0;
  touched.push(start);
  push(h(start), start, 0);
  let pops = 0;
  while (heap.length && pops++ < maxPops) {
    const [, t, g] = pop();
    if (g > cost[t] + 0.01) continue; // a stale queue entry
    if (t === goal) break;
    const x = t % W;
    const y = Math.floor(t / W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (land[n] || (allow && !allow[n])) continue;
        const step = (dx && dy ? 1.414 : 1) * (1 + (cd[n] < 4 ? (4 - cd[n]) * coastPenalty : 0));
        const c = cost[t] + step;
        if (c < cost[n]) {
          if (cost[n] === Infinity) touched.push(n);
          cost[n] = c;
          prev[n] = t;
          push(c + h(n) * weight, n, c);
        }
      }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!land[(y + dy) * W + x + dx]) continue;
      for (let g = 2; g <= 4; g++) {
        const nx = x + g * dx;
        const ny = y + g * dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
        const n = ny * W + nx;
        if (land[n]) continue;
        if (!(allow && !allow[n])) {
          const c = cost[t] + 2 + g; // a narrow strait
          if (c < cost[n]) {
            if (cost[n] === Infinity) touched.push(n);
            cost[n] = c;
            prev[n] = t;
            push(c + h(n) * weight, n, c);
          }
        }
        break;
      }
    }
  }
  let out = null;
  if (prev[goal] >= 0 || goal === start) {
    out = [];
    for (let t = goal; t !== -1; t = t === start ? -1 : prev[t]) out.push([(t % W) + 0.5, Math.floor(t / W) + 0.5]);
    out.reverse();
  }
  for (const t of touched) {
    cost[t] = Infinity;
    prev[t] = -1;
  }
  touched.length = 0;
  return out;
}

// A lane as a smooth line that stays in the sea: the waypoints joined by water paths (a straight
// hop where the sea is too narrow to connect them), rounded off, and thinned to a point every few tiles.
function routeLane(grid, waypoints) {
  const nav = navOf(grid);
  const k = nav.scale;
  const wp = waypoints.map(([x, y]) => [x * k, y * k]);
  let line = [];
  for (let i = 0; i < wp.length - 1; i++) {
    const seg = waterPath(nav, wp[i], wp[i + 1], 1, 1.3, null, 4000000) ?? [wp[i], wp[i + 1]];
    line.push(...(line.length ? seg.slice(1) : seg));
  }
  const W = nav.width;
  for (let pass = 0; pass < 6; pass++) {
    const prev = line;
    line = prev.map((q, i) => {
      if (i === 0 || i === prev.length - 1) return q;
      const s = [(prev[i - 1][0] + 2 * q[0] + prev[i + 1][0]) / 4, (prev[i - 1][1] + 2 * q[1] + prev[i + 1][1]) / 4];
      return nav.land[Math.floor(s[1]) * W + Math.floor(s[0])] ? q : s; // never round a corner onto land
    });
  }
  return line.filter((_, i) => i % (3 * k) === 0 || i === line.length - 1).map(([x, y]) => [x / k, y / k]);
}

// The fine land/sea picture used for routing (built once).
function navOf(grid) {
  return (grid.nav ??= buildNav(grid, 2));
}

// The lanes in tile coordinates, with the coast tiles that touch each lane and each chokepoint.
function buildLanes(grid, game) {
  const lanes = LANES.map((l) => ({
    id: l.id,
    name: l.name,
    value: l.value,
    pts: routeLane(grid, l.points.map((p) => grid.projection(p))),
    chokes: l.chokes.map((c) => ({ name: c.name, pt: grid.projection([c.lon, c.lat]), tiles: [], holder: -1 })),
    near: [],
    access: new Map(),
  }));
  const W = grid.width;
  for (const t of grid.coastTiles) {
    const x = t % W;
    const y = Math.floor(t / W);
    for (const lane of lanes) {
      for (let i = 1; i < lane.pts.length; i++) {
        if (segDist(x, y, lane.pts[i - 1], lane.pts[i]) <= RULES.laneReach) {
          lane.near.push(t);
          break;
        }
      }
      for (const c of lane.chokes) if (Math.hypot(x - c.pt[0], y - c.pt[1]) <= RULES.chokeReach) c.tiles.push(t);
    }
  }
  game.lanes = lanes;
}

// Who touches each lane and who holds each chokepoint (the owner of most of its coast).
function refreshLanes(game) {
  for (const lane of game.lanes) {
    const access = new Map();
    for (const t of lane.near) {
      const o = game.owner[t];
      if (o >= 0) access.set(o, (access.get(o) ?? 0) + 1);
    }
    lane.access = access;
    for (const c of lane.chokes) {
      const counts = new Map();
      let best = -1;
      for (const t of c.tiles) {
        const o = game.owner[t];
        if (o < 0) continue;
        const k = (counts.get(o) ?? 0) + 1;
        counts.set(o, k);
        if (best < 0 || k > counts.get(best)) best = o;
      }
      c.holder = best;
    }
  }
}

export const hasAccess = (lane, n) => (lane.access.get(n) ?? 0) >= RULES.laneMinTiles;
export const routesOf = (game, n) => game.routes.filter((r) => r.a === n || r.b === n);
const routeBetween = (game, a, b) => game.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
const laneOf = (game, id) => game.lanes?.find((l) => l.id === id);

// A route's state: open (pays), blockaded (a chokepoint holder is at war with a side) or cut (a side lost the coast).
export function routeState(game, r) {
  const lane = laneOf(game, r.lane);
  const [A, B] = [game.nations[r.a], game.nations[r.b]];
  if (!lane || !hasAccess(lane, r.a) || !hasAccess(lane, r.b)) return { state: "cut", income: 0, holders: [] };
  const holders = lane.chokes.map((c) => c.holder).filter((h) => h >= 0 && h !== r.a && h !== r.b && game.nations[h].alive);
  const income = RULES.routeIncome * lane.value * (Math.sqrt(Math.min(A.tiles, B.tiles)) / 10);
  if (holders.some((h) => atWar(game, h, r.a) || atWar(game, h, r.b))) return { state: "blockaded", income, holders };
  return { state: "open", income, holders };
}

// Gold a nation now earns from its open routes (net of tolls), and tolls it collects.
export function routeIncomeOf(game, n) {
  let sum = 0;
  for (const r of game.routes) {
    const st = routeState(game, r);
    if (st.state !== "open") continue;
    if (r.a === n || r.b === n) sum += st.income * (1 - RULES.routeToll * st.holders.length);
    sum += st.income * 2 * RULES.routeToll * st.holders.filter((h) => h === n).length;
  }
  return sum;
}

function updateRoutes(game, dt) {
  const keep = [];
  for (const r of game.routes) {
    const [A, B] = [game.nations[r.a], game.nations[r.b]];
    if (!A.alive || !B.alive) continue;
    if (atWar(game, r.a, r.b)) {
      if (r.a === game.player || r.b === game.player) logEvent(game, `War closed your trade route with ${(r.a === game.player ? B : A).name}.`);
      continue;
    }
    keep.push(r);
    const st = routeState(game, r);
    if (st.state !== "open") continue;
    const pay = st.income * (1 - RULES.routeToll * st.holders.length) * dt;
    A.gold += pay;
    B.gold += pay;
    for (const h of st.holders) game.nations[h].gold += st.income * 2 * RULES.routeToll * dt;
  }
  game.routes = keep;
}

// Returns a reason on failure.
export function openRoute(game, a, b, laneId) {
  const lane = laneOf(game, laneId);
  const [A, B] = [game.nations[a], game.nations[b]];
  if (!lane || !B?.alive || a === b) return "Pick a lane and a partner.";
  if (!hasAccess(lane, a) || !hasAccess(lane, b)) return "Both nations need coast on that lane.";
  if (atWar(game, a, b)) return `You are at war with ${B.name}.`;
  if (routeBetween(game, a, b)) return `A route with ${B.name} already exists.`;
  if (routesOf(game, a).length >= RULES.maxRoutes) return `${A.name} already has ${RULES.maxRoutes} routes.`;
  if (routesOf(game, b).length >= RULES.maxRoutes) return `${B.name} has no free route.`;
  if (b !== game.player && !mindOf(game, B).trader) return `${B.name} declines.`;
  game.routes.push({ id: game.nextId++, a, b, lane: laneId, since: game.tick });
  if (a === game.player || b === game.player) logEvent(game, `Trade route opened with ${(a === game.player ? B : A).name} along ${lane.name}.`);
  return null;
}

export function closeRoute(game, id) {
  const r = game.routes.find((x) => x.id === id);
  if (!r) return;
  game.routes = game.routes.filter((x) => x.id !== id);
  if (r.a === game.player || r.b === game.player) logEvent(game, "Trade route closed.");
}

function botOpensRoute(game, bot) {
  if (!game.lanes || routesOf(game, bot.index).length >= RULES.maxRoutes) return;
  const options = [];
  for (const lane of game.lanes) {
    if (!hasAccess(lane, bot.index)) continue;
    for (const o of lane.access.keys()) {
      if (o === bot.index || !game.nations[o].alive || !hasAccess(lane, o) || atWar(game, bot.index, o) || routeBetween(game, bot.index, o) || routesOf(game, o).length >= RULES.maxRoutes) continue;
      options.push([lane.id, o]);
    }
  }
  const pick = options[Math.floor(random(game) * options.length)];
  if (pick) openRoute(game, bot.index, pick[1], pick[0]);
}

// Buy food or steel from a route partner at market price, no tax. Returns a reason on failure.
export function routeTrade(game, buyerIndex, partnerIndex, good, amount) {
  const r = routeBetween(game, buyerIndex, partnerIndex);
  if (!r) return "No route with that nation.";
  if (routeState(game, r).state !== "open") return "The route is closed or blockaded.";
  const [b, p] = [game.nations[buyerIndex], game.nations[partnerIndex]];
  let buy;
  let price;
  if (good === "food") {
    price = game.market.price;
    buy = Math.min(amount, Math.max(0, p.food - foodEaten(p) * RULES.allyFoodReserve), Math.max(0, foodStore(b) - b.food - b.allyFood), b.gold / price);
  } else {
    price = game.steel.price;
    buy = Math.min(amount, Math.max(0, p.steel - steelUse(p) * 300), b.gold / price);
  }
  if (!(buy >= 1)) return `${p.name} has nothing to spare, or you cannot store or pay for it.`;
  const cost = buy * price;
  if (good === "food") {
    p.food -= buy;
    b.food += buy;
  } else {
    p.steel -= buy;
    b.steel += buy;
  }
  b.gold -= cost;
  p.gold += cost;
  if (buyerIndex === game.player) logEvent(game, `Bought ${Math.round(buy)} ${good} from ${p.name} for ${Math.round(cost)} gold.`);
  else if (partnerIndex === game.player) logEvent(game, `You sold ${b.name} ${Math.round(buy)} ${good} for ${Math.round(cost)} gold.`);
  return null;
}

// ---- alliances ---------------------------------------------------------------
export const isAllied = (game, a, b) => game.alliances.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
export const alliesOf = (game, n) => game.alliances.filter((x) => x.a === n || x.b === n).map((x) => (x.a === n ? x.b : x.a));
const atWar = (game, a, b) => game.attacks.some((x) => (x.attacker === a && x.target === b) || (x.attacker === b && x.target === a));
const mindOf = (game, n) => (n.mind ??= temperament(game));

// A bot says yes to a proposal when it is open to alliances, not fighting the
// proposer and has room for another ally.
function botAccepts(game, bot, from) {
  return mindOf(game, bot).ally && !atWar(game, bot.index, from) && alliesOf(game, bot.index).length < RULES.maxAllies && alliesOf(game, from).length < RULES.maxAllies;
}

function formAlliance(game, a, b) {
  game.alliances.push({ a, b, since: game.tick });
  game.proposals = game.proposals.filter((p) => !((p.from === a && p.to === b) || (p.from === b && p.to === a)));
  for (const f of game.attacks.slice()) if ((f.attacker === a && f.target === b) || (f.attacker === b && f.target === a)) stopFront(game, f.id);
  const [A, B] = [game.nations[a], game.nations[b]];
  if (a === game.player || b === game.player) logEvent(game, `You are now allied with ${(a === game.player ? B : A).name}.`);
  else logEvent(game, `${A.name} and ${B.name} formed an alliance.`);
}

// Returns a reason on failure, null when the alliance formed or the proposal was sent.
export function proposeAlliance(game, from, to) {
  const [A, B] = [game.nations[from], game.nations[to]];
  if (!B?.alive || from === to) return "Pick another nation.";
  if (isAllied(game, from, to)) return `You are already allied with ${B.name}.`;
  if (alliesOf(game, from).length >= RULES.maxAllies) return `You can have at most ${RULES.maxAllies} allies.`;
  if (to === game.player) {
    if (!game.proposals.some((p) => p.from === from)) {
      game.proposals.push({ id: game.nextId++, from, to, tick: game.tick });
      logEvent(game, `${A.name} proposes an alliance.`);
    }
    return null;
  }
  if (!botAccepts(game, B, from)) return `${B.name} declines.`;
  formAlliance(game, from, to);
  return null;
}

// The player answers a proposal.
export function answerProposal(game, id, accept) {
  const p = game.proposals.find((x) => x.id === id);
  if (!p) return "That proposal has lapsed.";
  game.proposals = game.proposals.filter((x) => x.id !== id);
  if (!accept) return null;
  if (!game.nations[p.from].alive) return "That nation is gone.";
  if (alliesOf(game, game.player).length >= RULES.maxAllies) return `You can have at most ${RULES.maxAllies} allies.`;
  formAlliance(game, p.from, p.to);
  return null;
}

export function breakAlliance(game, a, b) {
  game.alliances = game.alliances.filter((x) => !((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  if (a === game.player || b === game.player) logEvent(game, `Your alliance with ${game.nations[a === game.player ? b : a].name} is over.`);
  else logEvent(game, `${game.nations[a].name} broke its alliance with ${game.nations[b].name}.`);
}

// Bots look for allies among their neighbours of similar strength.
function botProposes(game, bot, counts) {
  if (alliesOf(game, bot.index).length >= RULES.maxAllies) return;
  const pool = [...counts.keys()]
    .filter((o) => o >= 0)
    .map((o) => game.nations[o])
    .filter((n) => n.alive && !isAllied(game, bot.index, n.index) && !atWar(game, bot.index, n.index) && army(n) > army(bot) * 0.5 && army(n) < army(bot) * 2);
  const pick = pool[Math.floor(random(game) * pool.length)];
  if (pick) proposeAlliance(game, bot.index, pick.index);
}

// What an ally will sell: whether at all, at what discount, and how much it can spare.
export function allyDeal(game, n) {
  const deal = n.index === game.player ? n.allyOffer : mindOf(game, n).allyFood;
  return { on: deal.on, discount: deal.discount, spare: Math.max(0, n.food - foodEaten(n) * RULES.allyFoodReserve) };
}

export function setAllyOffer(game, nationIndex, patch) {
  const n = game.nations[nationIndex];
  n.allyOffer = { ...n.allyOffer, ...patch };
}

// The buyer asks an ally for food; the ally decides by its deal. Outside the market, no tax.
export function askAlly(game, buyerIndex, allyIndex, amount) {
  const buyer = game.nations[buyerIndex];
  const ally = game.nations[allyIndex];
  if (!isAllied(game, buyerIndex, allyIndex)) return `${ally.name} is not your ally.`;
  const deal = allyDeal(game, ally);
  if (!deal.on) return `${ally.name} does not sell food to allies.`;
  const price = game.market.price * (1 - deal.discount);
  // Asks are capped at real need (a minute of eating), so allies can not be farmed for food to resell.
  const need = Math.max(0, foodEaten(buyer) * RULES.allyFoodReserve - buyer.food - buyer.allyFood);
  if (need < 1) return "You have enough food for now: allies only help when you are short.";
  const buy = Math.min(amount, need, deal.spare, Math.max(0, foodStore(buyer) - buyer.food - buyer.allyFood), price > 0 ? buyer.gold / price : Infinity);
  if (!(buy >= 1)) return `${ally.name} has no food to spare, or you cannot store or pay for it.`;
  const cost = buy * price;
  ally.food -= buy;
  buyer.allyFood += buy;
  buyer.allySellable += buy * RULES.allyFoodResale;
  buyer.gold -= cost;
  ally.gold += cost;
  if (buyerIndex === game.player) logEvent(game, `${ally.name} sold you ${Math.round(buy)} food for ${Math.round(cost)} gold${cost < 1 ? " (a gift)" : ""}.`);
  else if (allyIndex === game.player) logEvent(game, `You sold ${buyer.name} ${Math.round(buy)} food for ${Math.round(cost)} gold${cost < 1 ? " (a gift)" : ""}.`);
  return null;
}

// Gifts to any nation. Food arrives in the receiver's ally pool (eaten first, only a tenth
// resellable), so a gift can not be farmed for market profit.
export function giveFood(game, fromIndex, toIndex, amount) {
  const from = game.nations[fromIndex];
  const to = game.nations[toIndex];
  if (!to?.alive || from.index === to.index) return "Pick another nation.";
  const give = Math.min(Math.floor(amount), Math.floor(from.food), Math.floor(Math.max(0, foodStore(to) - to.food - to.allyFood)));
  if (!(give >= 1)) return from.food < 1 ? "You have no food of your own to send." : `${to.name} has no room to store more food.`;
  from.food -= give;
  to.allyFood += give;
  to.allySellable += give * RULES.allyFoodResale;
  if (fromIndex === game.player) logEvent(game, `You sent ${to.name} ${give} food.`);
  else if (toIndex === game.player) logEvent(game, `${from.name} sent you ${give} food.`);
  return null;
}

export function giveGold(game, fromIndex, toIndex, amount) {
  const from = game.nations[fromIndex];
  const to = game.nations[toIndex];
  if (!to?.alive || from.index === to.index) return "Pick another nation.";
  const give = Math.min(Math.floor(amount), Math.floor(from.gold));
  if (!(give >= 1)) return "You have no gold to send.";
  from.gold -= give;
  to.gold += give;
  if (fromIndex === game.player) logEvent(game, `You sent ${to.name} ${give} gold.`);
  else if (toIndex === game.player) logEvent(game, `${from.name} sent you ${give} gold.`);
  return null;
}

// A bot short of food asks its allies before the market and the loan offers.
function askAllies(game, bot) {
  if (!inFoodTrouble(game, bot)) return;
  let need = foodEaten(bot) * RULES.allyFoodReserve - bot.food - bot.allyFood;
  for (const a of alliesOf(game, bot.index)) {
    if (need < 1) break;
    const before = bot.allyFood;
    askAlly(game, bot.index, a, need);
    need -= bot.allyFood - before;
  }
  for (const r of routesOf(game, bot.index)) {
    if (need < 1) break;
    const before = bot.food;
    routeTrade(game, bot.index, r.a === bot.index ? r.b : r.a, "food", need);
    need -= bot.food - before;
  }
}

// ---- manual trading for the player --------------------------------------------
// Instant purchase from the market stock (not the queue), taxed.
export function buyFood(game, nationIndex, amount) {
  const n = game.nations[nationIndex];
  const m = game.market;
  const unit = m.price * (1 + RULES.marketBuyTax);
  const buy = Math.min(amount, m.stock ?? 0, n.gold / unit, Math.max(0, foodStore(n) - n.food - n.allyFood));
  if (!(buy >= 1)) return 0;
  const cost = buy * unit;
  m.stock -= buy;
  m.fees += buy * m.price * RULES.marketBuyTax;
  n.food += buy;
  n.gold -= cost;
  n._bought += buy;
  n._spent += cost;
  n.foodBoughtTotal += buy;
  n.foodSpentTotal += cost;
  if (nationIndex === game.player) logEvent(game, `You bought ${Math.round(buy)} food for ${Math.round(cost)} gold.`);
  return buy;
}

// Sells a share of the nation's food stock into the market.
export function sellShare(game, nationIndex, fraction) {
  const n = game.nations[nationIndex];
  const before = n.gold;
  let sold = sellFood(game, n, n.food * fraction, true);
  // Of the food allies gave, only the sellable part (about 10%) may be resold.
  const part = n.allySellable * fraction;
  if (part >= 1) {
    n.allyFood -= part;
    n.allySellable -= part;
    n.food += part;
    sold += sellFood(game, n, part, true);
  }
  if (sold >= 1 && nationIndex === game.player) logEvent(game, `You sold ${Math.round(sold)} food for ${Math.round(n.gold - before)} gold after tax.`);
  return sold;
}

// Still short after the market: starve.
function starve(game, n, dt) {
  const wasStarving = n.starving;
  n.starving = n.food < -1e-6;
  if (n.starving) {
    const unfed = -n.food / RULES.foodPerPerson / dt; // people without food this slice
    const before = n.troops;
    n.unfedShare = before > 0 ? Math.min(1, unfed / before) : 1;
    n.troops = Math.max(0, n.troops - unfed * RULES.starveRate * dt);
    n.soldiers *= before > 0 ? n.troops / before : 0;
    n.food = 0;
  } else n.unfedShare = 0;
  if (n.starving !== wasStarving) {
    if (n.index === game.player) logEvent(game, n.starving ? "No food and no way to buy it: your people are starving!" : "Your people have food again.");
    else if (n.starving) logEvent(game, `${n.name} is starving.`);
  }
}

const toHex = (h) => {
  const f = (k) => {
    const a = 0.6 * Math.min(0.5, 1 - 0.5);
    const c = 0.5 - a * Math.max(-1, Math.min((k + h / 30) % 12 - 3, 9 - ((k + h / 30) % 12), 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// A connected region of the nation breaks away as a new nation.
function revolt(grid, game, n) {
  const owned = [];
  for (const t of grid.landTiles) if (game.owner[t] === n.index) owned.push(t);
  if (owned.length < RULES.revoltMinTiles) return;
  // The seed: the owned tile farthest from the nation's centre among a sample.
  const cx = n.sumX / n.tiles;
  const cy = n.sumY / n.tiles;
  let seed = owned[0];
  let far = -1;
  for (let i = 0; i < 40; i++) {
    const t = owned[Math.floor(random(game) * owned.length)];
    const d = Math.hypot((t % grid.width) - cx, Math.floor(t / grid.width) - cy);
    if (d > far) [seed, far] = [t, d];
  }
  const want = Math.max(6, Math.floor(owned.length * RULES.revoltShare));
  const region = [seed];
  const seen = new Set(region);
  for (let i = 0; i < region.length && region.length < want; i++) {
    forNeighbors(grid, region[i], (m) => {
      if (region.length < want && game.owner[m] === n.index && !seen.has(m)) {
        seen.add(m);
        region.push(m);
      }
    });
  }
  const used = new Set(game.nations.map((x) => x.name));
  const name = nationName(grid.lonLatAt(seed), used, () => random(game));
  let hue = (game.nations.length * 137.5) % 360;
  if (hue > 190 && hue < 260) hue = (hue + 80) % 360; // blue is the player's
  const rebel = addNation(grid, game, name, toHex(hue), seed);
  for (const t of region) setOwner(grid, game, t, rebel.index);
  const soldiers = n.soldiers * RULES.revoltDesert;
  n.soldiers -= soldiers;
  n.troops -= soldiers;
  rebel.soldiers += soldiers;
  rebel.troops += soldiers;
  const gold = n.gold * RULES.revoltDesert;
  n.gold -= gold;
  rebel.gold += gold;
  rebel.nextThinkTick = game.tick + 5 * RULES.ticksPerSecond;
  n.unrest *= 0.5;
  game.rebellions = (game.rebellions ?? 0) + 1;
  if (n.index === game.player) logEvent(game, `Unrest has split your nation: ${rebel.name} broke away with ${region.length} tiles.`);
  else logEvent(game, `${n.name} has split: ${rebel.name} broke away.`);
}

// Unrest builds while people go unfed; the government pays to hold it down.
function updateUnrest(grid, game, n, dt) {
  if (n.starving) {
    let rise = RULES.unrestRise + RULES.unrestRiseUnfed * n.unfedShare;
    const cost = n.unrest * goldIncome(n) * RULES.unrestHoldGold * dt;
    if (cost > 0 && n.gold >= cost) {
      n.gold -= cost;
      rise *= 0.5;
    }
    n.unrest = Math.min(1, n.unrest + rise * dt);
  } else n.unrest = Math.max(0, n.unrest - RULES.unrestFall * dt);
  if (n.unrest > 0.5 && !n.unrestWarned) {
    n.unrestWarned = true;
    if (n.index === game.player) logEvent(game, "Your starving people are close to revolt.");
  } else if (n.unrest < 0.25) n.unrestWarned = false;
  if (n.unrest >= 1) revolt(grid, game, n);
}

function countCities(game) {
  for (const n of game.nations) n.cities = 0;
  for (const t of game.cities) {
    const o = game.owner[t];
    if (o >= 0) game.nations[o].cities++;
  }
}

export function tick(grid, game) {
  if (game.phase !== "playing") return;
  const dt = 1 / RULES.ticksPerSecond;
  countCities(game); // cities change hands with their tiles
  const living = game.nations.filter((n) => n.alive);
  const average = living.reduce((sum, n) => sum + n.tiles, 0) / Math.max(living.length, 1);
  for (const n of living) n.sizeFactor = sizeFactor(n.tiles / Math.max(average, 1));
  if (!game.lanes) buildLanes(grid, game);
  if (game.tick % 20 === 0) refreshLanes(game);
  updateMarket(game, dt);
  updateSteelMarket(game, dt);
  for (const n of game.nations) {
    if (!n.alive) continue;
    n.steel += steelRate(n) * dt;
    // Burn steel; running low, buy more from the market (like food); out of it, run short.
    const use = steelUse(n);
    if (n.steel < use * 10) buySteel(game, n.index, use * 30, true);
    const burn = use * dt;
    const wasShort = n.steelShort;
    n.steelShort = n.steel < burn;
    n.steel = Math.max(0, n.steel - burn);
    if (n.steelShort !== wasShort && n.index === game.player) logEvent(game, n.steelShort ? "You are out of steel: army and economy run weaker. Build factories or buy steel." : "Steel is flowing again.");
    const max = maxTroops(n);
    if (n.troops < max) n.troops = Math.min(max, n.troops + (max - n.troops) * growthRate(n) * dt);
    n.gold += goldIncome(n) * dt;
    draft(game, n, dt);
    feed(game, n, dt);
  }
  settleMarket(game);
  serviceLoans(game, dt);
  updateRoutes(game, dt);
  game.alliances = game.alliances.filter((x) => game.nations[x.a].alive && game.nations[x.b].alive);
  game.proposals = game.proposals.filter((x) => game.nations[x.from].alive && game.tick - x.tick < RULES.proposalSeconds * RULES.ticksPerSecond);
  for (const n of game.nations) if (n.alive) starve(game, n, dt);
  for (const n of game.nations) if (n.alive) updateUnrest(grid, game, n, dt);
  payUpkeep(game, dt);
  const changedFrom = game.dirty.length;
  updateAttacks(grid, game);
  updateBoats(grid, game);
  absorbSlivers(grid, game, changedFrom);
  if (game.tick % 600 === 0) for (const [t, until] of game.protect) if (until <= game.tick) game.protect.delete(t);
  updateBots(grid, game);
  for (const n of game.nations) n.soldiers = Math.max(0, Math.min(n.soldiers, n.troops));
  game.tick++;
  checkEnd(grid, game);
}
