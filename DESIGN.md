# Nations: design notes

Living list. Add ideas to **Backlog** as they come; nothing there is built until moved up.
Live build: https://claude.ai/artifact/B3aRq2aovW9HPQJ43V1zWA (currently v75)

## Built (current rules, all in `src/territory/sim.js` RULES)

**Population**
- Cap is the same for every nation whatever its size: 3,000 to start. Only upgrades (cities) raise it.
- Each upgrade (a city built) multiplies the cap, by a little less each time.
- 20 upgrade levels reach the 100M ceiling: first x3, then ever smaller gains; price x2.2 per level. Level = upgrades bought, so captured cities give nothing.
- Land limits levels: 1 plus 1 per 500 tiles, max 20. In sims the best bot reaches about level 6 by minute 15.
- A nation squeezed below 25 tiles can only hold cap x tiles / 25, so people can't outlive their land and a nation reduced to a few tiles shrinks to almost nobody.
- Growth: closes the gap to the cap, only from workers. 100% army means zero growth.
- Small nations grow and earn faster, big ones slower (size factor).

**Army and workers**
- The army is its own pool (n.soldiers). The slider is the target share. Drafting moves workers to soldiers (or back) at 0.4% of the population a second, 0.3 gold per recruit; bankrupt nations can't draft. Recruits train for 15 s first: not soldiers, not workers, but they eat. Demobilising is instant-free of training.
- Deaths: only soldiers die, in the army and the population alike, so the share really drops. Settlers come from workers first.
- Soldiers out fighting (and home soldiers of a nation under attack) cost 0.002 gold a second each.
- Captured land moves the loser's workers (not soldiers) to the winner, with no loss. The winner may go over its cap: extra people don't work or grow and count as extra mouths (more the further over). Fix: buy an upgrade, or starve.
- Cautious bots stop attacking when too far over their cap; reckless ones push on. Over the cap, bots upgrade at once.
- People split into army (slider) and workers. Only soldiers attack and defend; workers do not defend (plus a 0.2-per-tile militia floor).
- No army cap for bots. Costs of a big army: no growth, little gold, less food.

**Player controls (HUD)**
- Stats live in a bottom bar as icons with numbers (population, army, workers, gold, food, land, rivals; hover for the name). The bar also holds the Army share slider, the Attack size slider and the Upgrade button (hover: new population cap and gold needed). The bar also holds Land to take (percent dropdown) and the Pause expansion button (lit when on). The side panel keeps only the nation name, fronts with Stop buttons, events and the help text.
- Stop button on every front calls its soldiers home. Land to take: stop an attack after 10/25/50/75% of their land (percentages only, no tile counts). Pause expansion: no new settling of empty land. Settling empty land is FREE (v64): no soldiers, no workers, no per-tile cost, for player and bots; only attacking a nation costs soldiers. Empty land not joined to your own by empty land (island, cut-off pocket) is reached by boat, not an overland front.
- Nation panel (v64): right-click another nation: alliance (propose / end / answer their proposal), send food (arrives as ally food, a tenth resellable) or gold, ask for food (allies only), borrow (if they offer) / lend, trade route (open, buy food or steel, close). Left click or Escape closes it.
- Attacks on a nation are campaigns: when the sent soldiers run out the front re-sends the Attack-size share of the army, until the limit, the front closing, or no soldiers left.
- Bots under attack counter-attack the aggressor (more if aggressive).

**Gold and food**
- Gold comes mostly from workers. Food: workers grow it, everyone eats it. Break-even at about a third of people in the army.
- Food: stores hold 180 s of eating; the overflow is sold into the global market. A shortfall joins the market buy queue and is bought at the market price. No stock or no gold: starving (people die, growth stops, soldiers fight at 60%).
- Conquering a tile takes a share of the loser's food.

**Defence**
- Coast (v68): the GPU fill is trimmed to the coast by an exact land mask drawn on a 2D canvas for the current view (vector coast, one pass of 30-50 ms) once the view has held still 0.3 s; while zooming or panning the coarse 3x-grid mask is used (a texel is several screen pixels at zoom, which left 1-2 px pale slivers when it was the only mask).
- Rival readout (v66): hovering another nation shows a tooltip with both whole-army strengths (soldiers at home plus out fighting, upgrade, hunger and steel modifiers), the ratio and the verdict (You would win at 1.15x or more, They would win at 1/1.15 or less, otherwise the front would stall). It uses the same strength as the fight, so it says what a fight would do.
- COMBAT (v65, replaces the per-tile cost): a war between nations is decided by whole-army strength = (soldiers at home + soldiers out fighting) x (1 + 0.2 x army level) x 0.6 if starving x 0.7 if short of steel; each side's strength is split over its own fronts (and the defender's over the fronts against it); a nation with no soldiers still holds a militia of 20. Each tick both sides lose battleRate 0.08 a second of the WEAKER side's strength (the better-upgraded side loses fewer actual soldiers). The attacker's front moves advanceShare 0.04 x (1 - 1/ratio) of its length per tick when ratio > 1 (fractional carry, so a tie does not move at all). There is no tile cost, no per-tile defence and no garrison floor any more (reverses the 2026-10-22 garrison floor). Attack size sets what is committed (and spent), not who wins. Boats need 10 soldiers to land on a nation's coast. Settling empty land stays free.

**Bots**
- Each has its own temperament: aggression, army share, expansion, reserve, pace, stubborn.
- Some warlords live near all-army. Most send soldiers home when food is low; stubborn ones don't and may go bankrupt.
- Starving neighbours attract attacks (not always).
- Bots judge a neighbor by the ratio of fighting strength (soldiers x upgrades x penalties), times grudge and opening multipliers. They hit back at an attacker unless the fight is hopeless, and can also strike another neighbor in the same decision, so they fight on several fronts (more often when aggressive).

**Global food market (built, v48)**
- One stock everyone sells into and buys from. Price = 3 x (target / stock)^1.5 x (1 + 2 x queue shortfall / target), clamped 1-30 gold, easing toward that goal; target stock = 4 seconds of the world's eating (60 s pinned the price at 30 forever). Buyers are served first come, first served; taxes leave the economy (see below).
- Bots sell deliberately when the price is above their threshold (3-9 gold), keeping 10-120 seconds of eating in stock (greedy ones keep little). The player's overflow sells automatically; no manual selling yet.
- Bottom bar shows the price with a rising/falling arrow; hover shows stock, queue, your queue place and your trade.
- Taxes (anti-snowball, v49): selling is taxed 10% plus up to 50% more as food sales approach the nation's normal gold income (cap 60%); buying adds 5%. A profiteering seller keeps at most about 40% of the price.
- Loans (v50): any nation with spare gold may lend (about 60% of bots do) to a nation in food trouble, at an interest rate it sets: 15% of lenders lend free, 20% ask 50%, the rest 5-35%. Borrowers take the cheapest offer and may owe at most 600 s of income. The BORROWER chooses when and how much to repay. Each loan falls due 10 minutes after it is made; what is still owed then is a default: the lender's attack appetite against the defaulter rises 30%, the defaulter cannot borrow for 10 minutes, each default adds 10 points to the interest every lender asks of it, and at 3 defaults lenders refuse it.
- Bot repayment styles (temperament): prompt (40% of income per second), gradual (10%), late (everything it can, in the last 90 s), cheat (never; 10% of bots). Only cheats default in the lab.
- Player Market panel (v50, click the price item in the bar): Market tab (sell/buy food by 25%/50%/all or an amount, taxes shown), Loans tab (borrow from offers, lend to a nation in trouble at your own rate, standing offer bots can take, repay 25%/50%/all/amount, due times), Allies tab (greyed, needs alliances).
- Unrest and rebels (v51): while starving, unrest rises 0.6%/s plus up to 2%/s by the share of unfed people; the government pays gold (unrest x income a second) which halves the rise; fed again it falls 1%/s. At 100% a connected region of 15% of the land (at least 6 tiles; nations under 30 tiles do not split) breaks away as a NEW nation with a new name and colour, taking 20% of soldiers and gold plus the workers and food of that land; the parent's unrest halves. The player sees unrest next to Food in the bar.
- Alliances (v52): up to 3 allies each. A proposal to a bot is answered at once: it accepts if open to alliances (60% of bots), not fighting the proposer and both have room. Bots propose to neighbours of similar strength (army within half to double), after 2 minutes, 2% per think. Proposals to the player lapse after 2 minutes. Allies cannot attack each other (attacks and boats are refused; existing fronts close when the alliance forms). A bot helps an ally under attack by a neighbour of the bot with 25% of its army (chance 30-70% by aggression). Alliances end when either dies or the player ends one; bots never break them.
- Ally food (v52): the buyer asks; the seller's deal decides (bots: 70% sell, discount 0/30/80/100% off the market price; player: standing deal in the Allies tab). Seller keeps a minute of eating; no market tax; a bot short of food asks its allies first.
- Two food pools (v53): own food (sell all) and ally food (received from allies; eaten before own food; only 10% of what was received may be resold to the market). An ask to an ally is capped at real need (a minute of eating minus food held, own and ally), so allies cannot be farmed. Hovering the bar's food item shows both pools.
- Factories and steel (v54, user 2026-10-23: factories cost higher gold and make steel; steel for city upgrades, a trade good, and army upgrades): a factory costs 2,500 gold (x1.7 for each further one), at most one per 60 tiles (max 12), makes 0.04 steel a second, bought with a bar button (no placement). Population upgrades from the third on need steel (10, then x1.5 each). Army levels (max 10) cost 1,500 gold (x1.8) and 15 steel (x1.6); each level makes soldiers 20% better attacking (cheaper tiles) and defending. Steel market: one global stock (target 2,000 + five minutes of world output), price 40 x target/stock (10 to 250), 10% fee, in the Market tab. Bots: 70% build factories when gold passes 1.3x the cost, 60% upgrade armies (to level 6) when gold and steel allow, buy missing steel, sell spare above price 40.
- Steel running costs (v55, user 2026-10-23: maintaining the army needs food + steel, running the economy needs steel): each factory now makes 0.15 steel a second; every second soldiers burn 0.00001 steel each (+10% per army level) and working people 0.000005 each. A nation low on steel (under 10 s of use) buys from the steel market automatically (like food); out of steel it fights and earns at 70% until it has steel again. Everyone starts with 100 steel. Bots also build factories when their steel use passes 80% of their output.
- Trade routes (v56, user 2026-10-23: proper fixed trade routes): 11 fixed lanes in src/territory/lanes.js (Mediterranean/Red Sea, Persian Gulf, Indian Ocean, Malacca, Australasia, North Atlantic, Caribbean, Panama, Around Africa, Black Sea, Baltic), each with chokepoints (Gibraltar, Suez, Bab-el-Mandeb, Hormuz, Palk, Malacca, Lombok, Channel, Florida Strait, Panama, Mozambique Channel, Bosphorus, Danish Straits). A nation touches a lane with 3+ coast tiles within 16 tiles of it. Two nations on the same lane may open a route (max 3 each; bots accept if they trade, 70%; routes to the player open automatically): both earn 0.8 x lane value x sqrt(smaller nation's tiles)/10 gold a second; each chokepoint holder (most coast near it) takes 10% of each side's income; a holder at war with either side blockades it; war between the two closes it; losing the coast cuts it. Partners buy food and steel from each other at market price with no tax (spare only), and bots short of food ask route partners after allies. Lanes and chokepoints are drawn on the map (your lanes brighter, chokepoints as diamonds in the holder's colour); Routes tab in the Market panel.
- Opportunism (v57, user 2026-10-23: nations more aggressive when they see an opportunity, or games never end): a bot rates a neighbour's weakness with multipliers: x1.3 if it is fighting someone else, x1.6 if under 30 tiles, x1.25 if short of steel, near revolt or broke with a small army (plus the existing x1.5 starving and loan grudge). Attack threshold is now 1.55 - 0.8 x aggression (min 0.75), was 1.9 - aggression; chance of attacking at parity is 15% x aggression; a clear opening (1.3x the threshold) is pressed as a campaign (fresh soldiers keep going, 15% more committed); the over-cap caution no longer stops an attack when the advantage passes 2.2.
- Fix (v57): a tile an attack just took is protected from the sliver rule for 5 s. Before, a front across a one-tile contact took the tile and the sliver rule handed it straight back every tick, so it never advanced and its troops piled up (324K troops in one stalled front in a 40 min run).
- Not built yet: soldiers tied up policing unrest; enemies backing rebels; rebels' war with the parent; bots breaking alliances; shared vision.

## Code layout (v58)
- `index.html` holds the page markup; `scripts/build-artifact.mjs` copies it into the single-file artifact, so a new element only needs adding to index.html.
- `src/territory/sim.js` rules and simulation; `lanes.js` trade lanes; `grid.js` map raster; `names.js` nation names. `src/main.js` rendering, HUD, market panel. `src/spread.js` front effects. `src/game/{world,rng,loop}.js` map shapes, seeded random, fixed-step loop. `src/lab.js` dev console lab (dev only). The old country-mode game was deleted (copies kept outside the project in the session scratchpad only).
- Territory on the GPU (v62): src/territory/gl.js. Owner grid is an R16I texture (re-uploaded, 1.9 MB, when tiles changed); pass 1 gives sea tiles within 2 steps of a nation that nation's id (so territory reaches coarse coast tiles); pass 2 weights the owners of the 4x4 tiles around each pixel with a Gaussian of about one tile (min 0.7 px): owned share gives the smooth outer edge and a 1 px darker outline, the two biggest owners give the colour and the dark line between nations (width as before), land mask (landShape rasterised at 3x grid, R8 linear) trims to the real coast. Fill opacity 0.7 as before. No fade-in and no faint land rim any more. The old canvas + SVG filter renderer remains: used when WebGL2 is missing or the address ends in #old; dev: window.nations.toggleGL() flips between them on the same game.
- Lag fix 3 (v61): zoom and pan do not redraw the territory canvas; its last picture is scaled with a CSS transform (the coastline clip stays at the drawn view, so they move together) and it is redrawn sharp 150 ms after the view stops (blur radius and clip transform update only then).
- Lag fix 2 (v60): the territory canvas (under an SVG blur filter) is redrawn only when tick, view or painted pixels changed; panels have no backdrop-filter. Browser-side filter cost is invisible to JS timings.
- Lag fix (v59): border lines are built from the nations' border sets, not a scan of all 951,600 tiles each tick; the territory image uploads only changed 64x64 chunks (one bounding box spanned the world once two fronts were far apart); name spots recompute every 1.5 s.
- Rendering cost (v58): the territory image uploads only the changed box (replaced by chunks in v59), and the rim glow rebuilds at most every 200 ms and only after territory changed. Simulation itself is cheap (about 1.2 ms per tick); updateAttacks is about 70% of that.

## Dev lab (dev server only, not in the published build)
- `src/lab.js`: `window.lab` in the browser console (`lab.help()`), used by Claude on request: the user describes a scenario and Claude sets it up. There is no panel or button on the page. Lets Claude give gold/food/soldiers, pin an army share (the bot AI then leaves it alone) or freeze a bot, cut a nation's land, remove it, make nations attack each other, fast-forward, snapshot/restore, game speed x5/x20.
- Probes (`lab.probe(name)`, each restores the game after): `all-army`, `toggle` (flipping army share must not beat steady), `hoard`, `squeeze`, `two-front`. Use them to hunt loopholes after each rule change.

## Agreed design, not built yet (trade, starvation, allies; user 2026-10-23)
**Global food market** (everyone trades in it; now built, see above)
- One global food stock. Price rises steeply as stock falls (price = base x (target / stock)^1.5, clamped about 1-30 gold), falls as stock grows; a long buy queue also pushes it up; price eases toward its target.
- Nations with surplus sell at the current market price; no cap on how much (no safety reserve): the penalty is starvation. Buyers queue first come, first served; an empty market means waiting on own stores.
- 5% market fee (gold sink). Bar item shows the price with a rising/falling arrow; hover shows stock, queue and own queue position. Starting stock about a minute of world food use. Bots react to the price (high price: more farmers, more selling).

**Starvation, unrest, rebellion**
- No food (market empty and no gold, or stuck in the queue): unrest builds, faster the larger the share of people unfed; large populations empty their stores fast.
- The government must spend soldiers and gold to hold unrest down (while also defending borders), so a starving nation is stretched thin.
- When unrest fills, a connected region (about 10-20% of land) revolts: it becomes a NEW nation of its own (rebels) with deserting soldiers (about 20%). Unrest drops to half. Enemy nations may back the rebels (later).

**Allies and food**
- Allies trade directly, outside the market and its fee; the buyer asks, and the ally sets whether to sell at all (some stockpile and refuse). A selling ally sets its own discount (for example 80% off the market price) or can give food free to strengthen the ally.
- Allies can't attack each other, help each other in war; a short-of-food nation asks allies first, then the market queue. Needs alliances built first.

**Build order:** 1 market, 2 starvation unrest and rebel nations, 3 alliances (propose/accept, no attacking allies, ally food trade, war help). Enemy-backed rebels and loans come after.

## Backlog (not built)
- Out of gold: soldiers go unpaid, starve and rebel (user: much later).
- Allies: a richer ally lends gold or soldiers to a bankrupt one (a loan, soldiers as support); allies can also blockade trade to starve an enemy of its ally (user: much, much later; needs ports and trade first).
- Ships visibly sailing the lanes; ports as buildings; per-lane trade goods.
- Strait and chokepoint tolls (Hormuz, Malacca, Palk) and bots that sit on them.
- Buying food from other nations (today it is an abstract auto-import).
- "Countries versus ..." (message was cut off, ask what was meant): wars, alliances, rivalries?
- Bots that start with different sizes ("start small, expand big as per factors", needs clarifying).
- Map visual design (user is making designs).
- Upgrade ladder reaching toward 100M (needs more levels or a different multiplier).

## Open questions
- What did "countries versus ..." mean?
- How big should a late-game nation be, and how many upgrades to get there?
- The map is very even right now (top bot ~5% of land at minute 8). Want more conquest?

- Lanes (v69): waypoints in lanes.js are routed over water tiles of grid.land (A*), so lanes stay at sea; drawn as smooth curves. Backlog: more real routes (e.g. Cape-Atlantic, Pacific crossings) if the user names them.
- Boats (v70): routed over fine water tiles only (see KNOWLEDGE 2026-10-25); targets on a different sea (Caspian, lakes) report 'No sea route there.'
- Routing raster (v71): lanes/boats use grid.nav at 2x; can go to 3x if still too close. Backlog: occasional 0.8 s hitch on the longest boat launches.
- Map features (v72): rivers, canals, straits are decoration; backlog: rivers as borders/defence bonus, canal control as a chokepoint.
- BUILT v73 (was backlog idea 2026-10-25): rivers block land expansion, so a front stops at a river and troops need a boat to cross to the far bank and continue. Not built; open questions: all 887 river lines or only big ones, and whether bridges/fords exist.
- Rivers (v73): big rivers are barrier tiles for land fronts; ferry crossing 4 s. Backlog: bots ferrying on purpose, bridges/fords, river defence bonus.
- Rivers (v74): ALL river and lake-centerline lines are barriers (supersedes big-rivers-only); bots ferry settlers over rivers. Backlog: bridges/fords, bots ferrying attacks on purpose, river defence bonus.
