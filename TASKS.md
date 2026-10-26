# Tasks

Update at the end of every piece of work: move items between sections, add the date and the files touched.

## Current
- (none in progress)

## Waiting on the user
- Try the river barriers in play: do fronts stop at big rivers and does the ferry feel right (4 s, right-click/click across)? Bots do not ferry on purpose yet.
- Try alliances in play (Market panel, Allies tab). Tell me if bots ally too much or too little: about 23 alliances among 35 nations by minute 8 in the lab.
- Unrest is gold-only (no soldiers tied up) and rebels have no special war with the parent: say if you want either.
- Try the Market panel in play (click the price item in the bar): sell/buy, borrow, lend, repay. Tell me what feels wrong.
- Market tuning to check by playing: price sits near 9-22 in normal play; pinned at 30 during mass starvation.
- Bot aggression is tuned from simulation only: in my test an idle player was eaten by minute 4. Tell me if bots are now too hard or still too passive.
- "Countries versus ..." message was cut off: ask what was meant (wars, alliances, rivalries?).
- How big should a late-game nation be, and how many upgrades to get there (ladder toward 100M)?
- Want more conquest? The map is very even (top bot about 5% of land at minute 8).

- Check factories in play: costs (factory 2.5K gold x1.7 each, 1 per 60 tiles, 0.04 steel/s), steel price, army upgrade strength (+20% a level). Factories are not placed on the map (my choice): say if you want them placed like cities.
- Rebellions outpace conquest (38 in 25 min): user chose to leave it until more features are added (2026-10-23).
- Check the lanes in play (v69: curves in the sea; say if a specific real route is missing or misplaced) and route income (about 4 gold/s average per route in the lab).
- Check pace in play: bots are much more aggressive now; a 40 min lab run still had no winner (leader 28.5% and rising). Mutual fronts across narrow contacts can still stall (13 of 29 fronts looked stuck).

## Backlog
See DESIGN.md.

## Done
| Date | Task | Files | Published |
|---|---|---|---|
| 2026-10-22 | Food economy, worker-only growth, no bot army cap, bankruptcy/starvation, bot adaptation | src/territory/sim.js, src/main.js | v32 |
| 2026-10-22 | HUD: plain compact numbers, fewer rows | src/main.js | v33 |
| 2026-10-22 | Fixed 3K population cap, city upgrades, garrison floor | src/territory/sim.js, src/main.js | v34 |
| 2026-10-22 | Compounding diminishing upgrades, cost x1.6 | src/territory/sim.js, src/main.js | v35 |
| 2026-10-22 | 100M population ceiling | src/territory/sim.js | v36 |
| 2026-10-22 | Upgrade ladder to 100M (20 levels, level = purchased, not captured cities); gradual bot drafting | src/territory/sim.js, src/main.js | v37 |
| 2026-10-22 | Army as its own pool, slow gold-cost drafting, war upkeep, population moves with land, over-cap penalty, cautious bots | src/territory/sim.js | v38 |
| 2026-10-22 | Player front controls (Stop, Land to take, Pause expansion), campaigns keep attacking, bots counter-attack | src/territory/sim.js, src/main.js, src/style.css | v39 |
| 2026-10-22 | Land goal in percent only (v40); workers no longer defend (v41) | src/main.js, src/territory/sim.js | v41 |
| 2026-10-23 | Stats moved to a bottom bar with icons instead of names | index.html, src/main.js, src/style.css | v42 |
| 2026-10-23 | Slower drafting (0.4%/s) and 15 s recruit training so weak defenders can't re-arm instantly; bottom bar hidden in picking phase | src/territory/sim.js, src/style.css | v43 |
| 2026-10-23 | Army share, Attack size and Upgrade moved to the bottom bar; upgrade hover tip shows new cap and gold cost | src/main.js, src/style.css | v44 |
| 2026-10-23 | Land to take and Pause expansion moved to the bottom bar | src/main.js, src/style.css | v45 |
| 2026-10-23 | More aggressive bots: total-strength comparison, revenge unless hopeless, multi-front opportunism | src/territory/sim.js | v46 |
| 2026-10-23 | Population cap shrinks for nations with under 25 tiles | src/territory/sim.js | v47 |
| 2026-10-23 | Dev lab: console API, backtick panel, loophole probes; bot freeze and pinned share | src/lab.js, src/main.js, src/territory/sim.js, src/style.css | dev only (not published) |
| 2026-10-23 | Global food market (price by stock, queue, 5% fee, bots sell by temperament, bar price item); lab market tools; lab has no on-page panel | src/territory/sim.js, src/main.js, src/lab.js | v48 |
| 2026-10-23 | Progressive food sell tax and buy tax; loans between nations with lender-set interest, repayment from income, default grudge | src/territory/sim.js, src/main.js, src/lab.js | v49 |
| 2026-10-23 | Market panel (Market/Loans/Allies tabs, Allies greyed); loans repaid by the borrower's choice, due in 10 min, defaults (credit ban, lender grudge, higher rates, refusal at 3); bot repayment styles; player standing loan offer | src/territory/sim.js, src/main.js, src/style.css, index.html | v50 |
| 2026-10-23 | Starvation unrest and rebel nations (unrest meter, government pays gold, a region breaks away as a new nation) | src/territory/sim.js, src/main.js | v51 |
| 2026-10-23 | Alliances: propose/accept, no attacking allies, allies help against attackers, ally food trade by request at the seller's discount, Allies tab | src/territory/sim.js, src/main.js | v52 |
| 2026-10-23 | Two food pools (own and ally food), ally food eaten first and only 10% resellable, asks capped at need; closes the ally-food farming loophole; food hover tip | src/territory/sim.js, src/main.js | v53 |
| 2026-10-23 | Factories and steel: factories (gold, land-limited) make steel; steel needed for population upgrades from the 3rd, army upgrade levels, and a global steel market; bots build factories, upgrade armies, trade steel; bar steel/factory/army buttons | src/territory/sim.js, src/main.js | v54 |
| 2026-10-23 | Steel running costs: army and economy burn steel each second, out of steel = 30% weaker, auto-buy from the steel market, factories 0.15 steel/s | src/territory/sim.js, src/main.js | v55 |
| 2026-10-23 | Fixed trade routes: 11 fixed lanes with chokepoints, routes between nations on a lane (gold, tax-free food/steel trade, tolls, war closes, blockades), Routes tab, lanes drawn on the map, bots open routes | src/territory/lanes.js (new), src/territory/sim.js, src/main.js | v56 |
| 2026-10-23 | Bots press openings harder (weak/busy/remnant neighbours, lower threshold, campaigns); fixed fronts stalling on one-tile contacts (sliver rule handed captured tiles back) | src/territory/sim.js | v57 |
| 2026-10-23 | Cleanup and efficiency: removed the old country-mode files and unused data (about 2,300 lines), pruned dead CSS (1003 to 616 lines), faster attack scan, rim and canvas updates only when territory changes (render about 4x cheaper), artifact page now built from index.html (it was missing the bottom bar and market panel) | src/main.js, src/territory/sim.js, src/style.css, src/game/world.js, src/game/rng.js, index.html, scripts/build-artifact.mjs, package.json (deleted: src/main-countries.js, src/game/{ai,attacks,buildings,diplomacy,personalities,state}.js, src/data/*, scripts/simulate.mjs, scripts/build-sea-links.mjs) | v58 |
| 2026-10-25 | Spawn disc no longer crosses rivers (flood from centre, river tiles taken but not spread from) | src/territory/sim.js | v75 |
| 2026-10-25 | Every river and lake line is a barrier (11,950 tiles, ocean untouched), one drawing style; bots ferry settlers across rivers | src/territory/grid.js, src/territory/sim.js, src/main.js | v74 |
| 2026-10-25 | Big rivers block land fronts (148 rivers as barrier tiles; front can take but not advance from a river tile; ferry across, 4 s); big rivers drawn darker | src/territory/grid.js, src/territory/sim.js, src/main.js, src/data/rivers.json | v73 |
| 2026-10-25 | Rivers (Natural Earth 50m), canals and straits drawn on the map, names on zoom (decoration only) | src/main.js, src/territory/lanes.js, src/data/rivers.json (new) | v72 |
| 2026-10-25 | Lanes and boats routed on a 2x finer land/sea raster (grid.nav), canals/straits up to 3 tiles bridged | src/territory/grid.js, src/territory/sim.js | v71 |
| 2026-10-25 | Boats follow the sea only: fine water-tile A* along the coarse route, same-sea port check, strait bridging, several ports tried (user: boat line went over land) | src/territory/sim.js | v70 |
| 2026-10-25 | Trade lanes follow the sea: A* over water tiles of the fine grid between waypoints, smoothed and drawn as curves (checked: 0-6 land samples of 117-798 per lane, only at canals/straits) | src/territory/sim.js, src/main.js | v69 |
| 2026-10-25 | Coast slivers fixed for real (v67 was not enough): exact screen-space land mask drawn once the view has held still 0.3 s (vector coast, pixel for pixel); the coarse 3x grid mask is used only while zooming or panning | src/territory/gl.js, src/main.js | v68 |
| 2026-10-25 | Fix pale halo between territory fill and coastline (GPU land mask edge was a soft 4-10 px ramp at zoom; now a crisp 1 px edge via the mask's derivative, pushed out 0.7 px under the coast stroke) | src/territory/gl.js | v67 |
| 2026-10-25 | Rival hover readout: hover another nation to see both sides' soldiers, upgrade/hunger/steel modifiers, strength ratio and who would win (You win at 1.15x or more, They win at 1/1.15 or less, else stalls; allies do not fight; notes when the rival is split over several fronts) | src/main.js, src/style.css | v66 |
| 2026-10-24 | Combat rewritten to whole-army strength (user: no tile part, higher numbers and upgrades win; same army with higher upgrades wins): no attack cost per tile, no garrison floor; both sides lose strength each tick, ground moves with the strength ratio; bots use the same ratio; boats need 10 soldiers | src/territory/sim.js | v65 |
| 2026-10-24 | Right-click a nation: panel to propose/end alliance, send or ask food, send gold, borrow/lend, open/close trade route (gifts giveFood/giveGold new in sim). Settling empty land is free (no soldiers, no workers, no per-tile cost), for player and bots. Empty land that is not joined to yours by land (islands, cut-off pockets) now goes by boat instead of a useless overland front | src/territory/sim.js, src/main.js, src/style.css, index.html | v64 |
| 2026-10-24 | User could not find the Market: added a labelled Market button to the bottom bar (the small price number still opens it too) | src/main.js | v63 |
| 2026-10-24 | WebGL territory layer (user asked for GPU rendering, keep the look): owner texture + one shader (smooth edge, colours, lines between nations, outline, land mask); canvas renderer kept as fallback / #old | src/territory/gl.js (new), src/main.js, src/style.css | v62 |
| 2026-10-24 | Lag fix 3 (user: laggy when zooming and while playing): during zoom/pan the territory canvas is moved with a CSS transform instead of redrawn through the blur filter and coastline clip; redrawn sharp 150 ms after the view settles | src/main.js | v61 |
| 2026-10-24 | Lag fix 2 (user: still very laggy): territory canvas redrawn only when the picture changed (was every frame, re-running the SVG blur filter ~60x/s), removed the three backdrop-filter blurs on panels (96% opaque, blur invisible) | src/main.js, src/style.css | v60 |
| 2026-10-24 | Lag fix: border lines built from border sets (was a full-grid scan every tick), map upload in 64x64 chunks (was one bounding box, 25-80 ms spikes), name spots every 1.5 s | src/main.js | v59 |
| 2026-10-22 | DESIGN.md, TASKS.md, KNOWLEDGE.md, CLAUDE.md, scripts/kb.py (ChromaDB) | those files | n/a |

## How to resume
1. Read CLAUDE.md, TASKS.md, DESIGN.md.
2. `python scripts/kb.py search "<topic>"` before changing a rule.
3. Dev server: preview_start name "nations-dev" (port 5173). Build: `npm run build:artifact`. Publish dist/nations-artifact.html to https://claude.ai/artifact/B3aRq2aovW9HPQJ43V1zWA (same URL, no new artifacts).

## Waiting on the user (added 2026-10-23)
- World stalls near 10% top land by minute 20; huge nations starve at 0 gold and keep splitting: want conquest stronger or the big-nation gold problem looked at?
