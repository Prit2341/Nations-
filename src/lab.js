// Dev-only "lab": poke the running game to see what happens, so rule changes
// can be checked for loopholes the bots (or the player) could exploit.
// Loaded only in dev (see the end of main.js); stripped from production builds.
//
// For Claude's use through the browser console (no UI on the page): lab.help() lists everything.
import { WATER, WILD } from "./territory/grid.js";
import {
  RULES,
  army,
  extraPeople,
  foodEaten,
  foodMade,
  goldIncome,
  maxTroops,
  sendTroops,
  makeLoan,
  sellTaxRate,
  setOwner,
  tick,
  workers,
} from "./territory/sim.js";

export function installLab({ game, grid, paintAll }) {
  const W = grid.width;
  const D4 = [1, -1, W, -W];
  const snaps = new Map();
  const lab = { speed: 1 };

  // ---- finding nations -------------------------------------------------
  const living = () => game.nations.filter((n) => n.alive);
  lab.who = (q) => {
    if (q && typeof q === "object") return q;
    const all = living();
    if (q === "me") return game.nations[game.player];
    if (q === "top") return [...all].sort((a, b) => b.tiles - a.tiles)[0];
    if (q === "weakest") return [...all].sort((a, b) => a.tiles - b.tiles)[0];
    if (q === "bot") return all.find((n) => n.index !== game.player);
    if (typeof q === "number") return game.nations[q];
    return all.find((n) => n.name.toLowerCase().includes(String(q).toLowerCase()));
  };
  const need = (q) => {
    const n = lab.who(q);
    if (!n) throw new Error(`No such nation: ${q}`);
    return n;
  };
  lab.neighbors = (q) => {
    const n = need(q);
    const found = new Set();
    for (const t of n.border) for (const d of D4) {
      const o = game.owner[t + d];
      if (o >= 0 && o !== n.index) found.add(o);
    }
    return [...found].map((i) => game.nations[i]);
  };

  // ---- changing things -------------------------------------------------
  // lab.set("me", { gold: 1e5, food: 0, soldiers: 5000, share: 1, level: 3, pop: 9000 })
  lab.set = (q, v) => {
    const n = need(q);
    if (v.gold !== undefined) n.gold = v.gold;
    if (v.food !== undefined) n.food = v.food;
    if (v.pop !== undefined) n.troops = v.pop;
    if (v.soldiers !== undefined) n.soldiers = Math.min(v.soldiers, n.troops = Math.max(n.troops, v.soldiers));
    if (v.share !== undefined) {
      n.armyShare = v.share;
      n.manualShare = true; // the bot AI leaves a pinned share alone
    }
    if (v.frozen !== undefined) n.frozen = v.frozen; // true: the bot AI stops deciding
    if (v.level !== undefined) n.level = v.level;
    if (v.starving !== undefined) n.starving = v.starving;
    return lab.stats(n);
  };
  lab.give = (q, v) => {
    const n = need(q);
    if (v.gold) n.gold += v.gold;
    if (v.food) n.food += v.food;
    if (v.soldiers) {
      n.troops += v.soldiers;
      n.soldiers += v.soldiers;
    }
    if (v.pop) n.troops += v.pop;
    if (v.level) n.level += v.level;
    return lab.stats(n);
  };
  // Takes `fraction` of a nation's land (a connected chunk) and makes it empty.
  lab.cut = (q, fraction = 0.5) => {
    const n = need(q);
    const want = Math.floor(n.tiles * fraction);
    const start = [...n.border][Math.floor(Math.random() * n.border.size)];
    const seen = new Set([start]);
    const queue = [start];
    let taken = 0;
    while (queue.length && taken < want) {
      const t = queue.shift();
      if (game.owner[t] !== n.index) continue;
      setOwner(grid, game, t, WILD);
      taken++;
      for (const d of D4) if (!seen.has(t + d) && game.owner[t + d] === n.index) {
        seen.add(t + d);
        queue.push(t + d);
      }
    }
    return { taken, left: n.tiles };
  };
  lab.kill = (q) => {
    const n = need(q);
    for (const t of grid.landTiles) if (game.owner[t] === n.index) setOwner(grid, game, t, WILD);
    n.alive = false;
    return `${n.name} removed`;
  };
  // a attacks b with everything (or opts.troops), as a campaign.
  lab.attack = (a, b, opts = {}) => {
    const x = need(a);
    const y = need(b);
    let tile = -1;
    for (const t of x.border) {
      for (const d of D4) if (game.owner[t + d] === y.index) tile = t + d;
      if (tile >= 0) break;
    }
    if (tile < 0) return `${x.name} does not border ${y.name}`;
    if (opts.force) lab.give(x, { soldiers: opts.force });
    return sendTroops(grid, game, x.index, tile, opts.troops ?? army(x), { campaign: true, ratio: 0.3, ...opts }) ?? "attack launched";
  };

  // ---- time ------------------------------------------------------------
  // Fast-forwards. The player's death or a win doesn't stop the run.
  lab.run = (seconds) => {
    if (game.player === null) return "Start the game first (place your nation).";
    for (let i = 0; i < seconds * RULES.ticksPerSecond; i++) {
      tick(grid, game);
      if (game.phase !== "playing") game.phase = "playing";
    }
    return lab.report();
  };
  lab.snapshot = (name = "a") => {
    snaps.set(name, structuredClone(game));
    return `saved ${name}`;
  };
  lab.restore = (name = "a") => {
    const s = snaps.get(name);
    if (!s) return `no snapshot ${name}`;
    Object.assign(game, structuredClone(s));
    paintAll();
    return `restored ${name}`;
  };

  // ---- looking ---------------------------------------------------------
  lab.stats = (q) => {
    const n = need(q);
    return {
      name: n.name,
      alive: n.alive,
      tiles: n.tiles,
      pop: Math.round(n.troops),
      cap: maxTroops(n),
      extra: Math.round(extraPeople(n)),
      soldiers: Math.round(army(n)),
      training: Math.round(n.inTraining),
      workers: Math.round(workers(n)),
      share: +n.armyShare.toFixed(2),
      frozen: !!n.frozen,
      gold: Math.round(n.gold),
      goldPerSec: +goldIncome(n).toFixed(1),
      food: Math.round(n.food),
      foodNet: +(foodMade(n) - foodEaten(n)).toFixed(2),
      bought: +n.foodBought.toFixed(2),
      starving: n.starving,
      level: n.level,
    };
  };
  lab.report = () => {
    const bots = living().filter((n) => n.index !== game.player);
    const land = grid.landTiles.length;
    const byTiles = [...bots].sort((a, b) => b.tiles - a.tiles);
    const top = byTiles[0];
    return {
      minutes: +((game.tick - game.startTick) / RULES.ticksPerSecond / 60).toFixed(1),
      aliveBots: bots.length,
      playerAlive: game.nations[game.player]?.alive,
      topShare: top && +(top.tiles / land).toFixed(3),
      top5Share: +(byTiles.slice(0, 5).reduce((s, n) => s + n.tiles, 0) / land).toFixed(2),
      starving: bots.filter((n) => n.starving).length,
      overCap: bots.filter((n) => extraPeople(n) > 0).length,
      avgShare: +(bots.reduce((s, n) => s + n.soldiers / Math.max(n.troops, 1), 0) / Math.max(bots.length, 1)).toFixed(2),
      fronts: game.attacks.filter((a) => a.target >= 0).length,
    };
  };
  // Runs `seconds`, sampling the given nations every `every` seconds.
  lab.track = (qs, seconds = 120, every = 10) => {
    const list = [].concat(qs).map(need);
    const rows = [];
    for (let t = every; t <= seconds; t += every) {
      lab.run(every);
      for (const n of list) rows.push({ t, ...lab.stats(n) });
    }
    return rows;
  };

  // ---- food market ---------------------------------------------------------
  lab.market = () => {
    const m = game.market;
    return {
      price: +m.price.toFixed(2),
      stock: Math.round(m.stock ?? 0),
      target: Math.round(m.target),
      queue: m.queue.length,
      foodShort: Math.round(m.need),
      feesTaken: Math.round(m.fees),
      starving: living().filter((n) => n.starving).length,
    };
  };
  // Lender gives borrower a loan at the given interest rate (0 = free).
  lab.lend = (lender, borrower, amount, rate = 0.1) => {
    const l = makeLoan(game, need(lender), need(borrower), amount, rate);
    return l ? "loan made" : "lender has no gold";
  };
  lab.loans = () =>
    game.loans.map((l) => ({
      lender: game.nations[l.lender].name,
      borrower: game.nations[l.borrower].name,
      principal: l.principal,
      owed: Math.round(l.owed),
      ratePct: Math.round(l.rate * 100),
      minutesAgo: +((game.tick - l.tick) / RULES.ticksPerSecond / 60).toFixed(1),
      defaulted: l.defaulted,
    }));
  const loanSummary = () => {
    const st = game.loanStats ?? { made: 0, principal: 0, free: 0, rateSum: 0, defaulted: 0 };
    return {
      made: st.made,
      goldLent: st.principal,
      avgRatePct: st.made ? Math.round((st.rateSum / st.made) * 100) : null,
      freeLoans: st.free,
      defaulted: st.defaulted,
      activeNow: game.loans.length,
      stillOwed: Math.round(game.loans.reduce((x, l) => x + l.owed, 0)),
    };
  };
  lab.taxRate = (q) => +sellTaxRate(need(q)).toFixed(3);
  lab.surge = (units) => {
    game.market.stock = (game.market.stock ?? game.market.target) + units; // negative drains it
    return lab.market();
  };
  // Every nation loses its food (and optionally its gold).
  lab.starveAll = ({ gold } = {}) => {
    for (const n of living()) {
      n.food = 0;
      if (gold !== undefined) n.gold = gold;
    }
    return lab.market();
  };
  // Every bot that borders someone attacks that neighbor.
  lab.fightAll = (force = 2000) => {
    let started = 0;
    for (const n of living()) {
      if (n.index === game.player) continue;
      const foe = lab.neighbors(n).find((o) => o.index !== game.player);
      if (foe && typeof lab.attack(n, foe, { force }) !== "string") started++;
      else if (foe) started++;
    }
    return `${started} attacks launched`;
  };
  // Runs while sampling the market; returns the price path, who sold, who starved.
  lab.watchMarket = (seconds = 300, every = 15) => {
    const before = new Map(living().map((n) => [n.index, { sold: n.foodSoldTotal, earned: n.foodEarnedTotal, spent: n.foodSpentTotal }]));
    game.market.trades.length = 0;
    const rows = [];
    for (let t = every; t <= seconds; t += every) {
      lab.run(every);
      const m = lab.market();
      rows.push({
        t,
        price: m.price,
        stock: m.stock,
        queue: m.queue,
        foodShort: m.foodShort,
        starving: m.starving,
        sellingNow: living().filter((n) => n.foodEarn > 0.05).length,
      });
    }
    const sellers = living()
      .map((n) => ({ name: n.name, sold: Math.round(n.foodSoldTotal - (before.get(n.index)?.sold ?? 0)), earned: Math.round(n.foodEarnedTotal - (before.get(n.index)?.earned ?? 0)), starving: n.starving, share: +n.armyShare.toFixed(2) }))
      .filter((x) => x.sold > 0)
      .sort((a, b) => b.earned - a.earned);
    const trades = game.market.trades;
    return {
      rows,
      topSellers: sellers.slice(0, 8),
      sellerCount: sellers.length,
      deliberateSales: trades.length,
      avgSalePrice: trades.length ? +(trades.reduce((s, x) => s + x.price * x.amount, 0) / trades.reduce((s, x) => s + x.amount, 0)).toFixed(2) : null,
      peakPrice: Math.max(...rows.map((r) => r.price)),
      lowPrice: Math.min(...rows.map((r) => r.price)),
      feesTaken: Math.round(game.market.fees),
      loans: loanSummary(),
      alliances: "none: alliances are not built yet",
    };
  };

  // ---- canned probes: each runs, reports, then restores the game ---------
  // They look for loopholes: does a trick beat playing straight?
  const probes = {
    // A nation going 100% army: should end up broke and starving.
    "all-army": (q = "top") => {
      lab.set(q, { share: 1 });
      return lab.track(q, 300, 30);
    },
    // Flip army share back and forth every 5 s vs. steady 30%: toggling must not pay.
    toggle: (q = "top") => {
      const n = need(q);
      lab.snapshot("_p");
      const straight = (() => {
        lab.set(n, { share: 0.3 });
        lab.run(300);
        return lab.stats(n);
      })();
      lab.restore("_p");
      const m = need(q);
      for (let t = 0; t < 300; t += 5) {
        lab.set(m, { share: (t / 5) % 2 ? 0.1 : 0.9 }); // pinned, so the bot AI keeps its hands off
        lab.run(5);
      }
      const flipping = lab.stats(m);
      return { straight, flipping, verdict: flipping.soldiers + flipping.gold / 10 > (straight.soldiers + straight.gold / 10) * 1.2 ? "LOOPHOLE: toggling pays" : "ok" };
    },
    // A million gold: can money alone snowball into land?
    hoard: (q = "bot") => {
      lab.give(q, { gold: 1e6 });
      return lab.track(q, 300, 60);
    },
    // No food, no gold: how fast does it fall apart?
    squeeze: (q = "top") => {
      lab.set(q, { food: 0, gold: 0 });
      return lab.track(q, 180, 20);
    },
    // A bot hit with a huge army while at war elsewhere: does it hold?
    "two-front": (q = "top") => {
      const n = need(q);
      const [a, b] = lab.neighbors(n);
      if (!b) return "needs a bot with two neighbors";
      lab.attack(a, n, { force: 20000 });
      lab.attack(b, n, { force: 20000 });
      return lab.track(n, 120, 20);
    },
  };
  lab.probe = (name, ...args) => {
    const fn = probes[name];
    if (!fn) return `probes: ${Object.keys(probes).join(", ")}`;
    lab.snapshot("_probe");
    try {
      return fn(...args);
    } finally {
      lab.restore("_probe");
    }
  };
  lab.help = () =>
    [
      "lab.who(q) / lab.stats(q)         q = name part, index, 'me', 'top', 'weakest', 'bot'",
      "lab.set(q, {gold,food,pop,soldiers,share(pinned),frozen,level,starving})   lab.give(q, {gold,food,soldiers,pop,level})",
      "lab.cut(q, 0.5)  take land away    lab.kill(q)    lab.neighbors(q)",
      "lab.attack(a, b, {troops, force, limit})   a attacks b (force = free soldiers first)",
      "lab.run(seconds)   lab.report()   lab.track(qs, seconds, every)",
      "lab.snapshot(name) / lab.restore(name)    lab.speed = 5  (game speed)",
      "lab.lend(lender, borrower, amount, rate)  lab.loans()  lab.taxRate(q)",
      "lab.market()  lab.surge(units)  lab.starveAll({gold})  lab.fightAll(force)  lab.watchMarket(seconds, every)",
      `lab.probe(name): ${Object.keys(probes).join(", ")}`,
    ].join("\n");

  window.lab = lab;
  return lab;
}
