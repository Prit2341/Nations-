# Knowledge base: decisions and why

Newest last. One entry per decision: date, what, why. Mirror each entry into ChromaDB with
`python scripts/kb.py add "<title>" "<what and why>"` (see CLAUDE.md). Search with
`python scripts/kb.py search "<question>"`.

## 2026-10-22

### Bots may go to 100% army, with consequences
- **What:** removed the 30% bot army cap. Growth, most gold and all food come from workers.
- **Why:** user wanted bots free to choose, but a big army must cost something: growth stops, gold drops, food runs short.

### Food economy
- **What:** workers grow food (0.0015), everyone eats (0.001). Shortfall drains the stock, then is bought at 3 gold each; no gold left means bankrupt and starving (people die, growth stops, soldiers at 60%).
- **Why:** user asked for bankruptcy as the long-run price of staying all-army. Price was 1 at first; nobody went bankrupt, so raised to 3.
- **Not built:** buying food from other nations (user: "don't start now").

### Conquest takes food
- **What:** each captured tile moves the loser's food share (food / tiles) to the attacker.
- **Why:** user asked that conquering seizes part of the loser's food.

### Bot adaptation
- **What:** bots mobilise when attacked, send soldiers home when food is low, unless stubborn (warlords more often). Starving neighbours look 1.5x weaker and get extra attack chance.
- **Why:** user: some go all-in, most adapt, stubborn ones go bankrupt, and bankrupt nations get attacked "sooner or later, not always".

### Fixed population cap, raised only by upgrades
- **What:** every nation's cap is 3,000 regardless of land. Cities are the upgrades.
- **Why:** user: land-based caps let big nations snowball. Measured: top-5 land share fell from about 45-65% to about 19% at minute 6-10.

### Compounding city upgrades
- **What:** each city multiplies the cap by 1 + 0.5 x 0.85^(k-1); price multiplies by 1.6. Max 8 cities (about 24K).
- **Why:** user asked that every upgrade multiplies population and cost, with smaller gains each time. Read "0.7, 0.8" loosely as diminishing; confirm if they meant otherwise.

### Garrison floor of 0.2 defence per tile
- **What:** attack cost and bot targeting use max(defenders / tiles, 0.2).
- **Why:** with fixed caps, a big thin nation would be free land for a big army (user flagged this). 0.6 froze the map (nobody could out-match anyone), 0.2 keeps land moving 5-8% a minute.

### Upgrade ladder to 100M, level = purchased
- **What:** 20 levels (first x3, bonus x0.88 each time) reach the 100M ceiling; price x2.2 per level; one level per 500 tiles of land. The cap uses n.level (upgrades bought), not cities owned.
- **Why:** user asked for upgrades up to 100M for player and bots. First try counted owned cities, so one bot captured cities, got free levels and hit 100M by minute 4 and won. Price x1.6 was also too cheap.

### Gradual bot drafting
- **What:** bot army share moves at most 0.03 per decision toward its target.
- **Why:** user saw a defender jump from 600 to 1.2K army the moment it was attacked: bots switched army share instantly.

### 100M population ceiling
- **What:** hard ceiling on any cap, for now. Not reachable with today's ladder.
- **Why:** user: "max population cap is 100M for now". Gold and food already scale with population.

### HUD shows plain numbers
- **What:** compact numbers (1.8K), no derived rows (caps, growth %, size factor). Gold and food show stock plus change per second.
- **Why:** user: do not show calculations; numbers get big.

### Deferred by user
- Ports, trade ships, strait tolls and strait-keeper bots ("wait for trades now").
- Map visual design (user will make designs).

### Working agreement
- **What:** DESIGN.md (rules and backlog), TASKS.md (current work), KNOWLEDGE.md plus ChromaDB (decisions) must be kept current. Enforced in CLAUDE.md.
- **Why:** user has many ideas and fears losing track between sessions.

### Army pool, slow drafting, war upkeep, conquest moves people
- **What:** n.soldiers is its own pool; deaths cut army and population; drafting 1%/s at 0.3 gold; war upkeep 0.002 gold/s per soldier at the front; captured land moves the loser's workers to the winner; over the cap is allowed but extra people are idle and eat extra; bots over the cap upgrade at once and cautious ones stop attacking.
- **Why:** user saw a defender's army jump from 600 to 1.2K when attacked (instant share change) and said losses must hit soldiers only. Food-based war upkeep was dropped by the user in favour of gold. User rejected losing people at the cap: winners keep them but pay with bankruptcy risk.
- **Result (sim, 12 min):** land moves 5-9% a minute, top bot 5-6%, top five 18-24%, 5-13 bots over cap at a time, no invalid states.

### Over-cap people become useful after an upgrade; later ideas parked
- **What:** an upgrade raises the cap, so extra people count as workers again (producing gold and food). Parked in DESIGN.md backlog: unpaid soldiers starve and rebel; allies lend gold and soldiers; allied blockades of trade.
- **Why:** user asked and said these are "much later", after trade exists.

### Expansion control idea (not built)
- **What:** user wants to stop their nation's expansion in the first phase and choose how much enemy territory to attack. Parked in the backlog pending clarification.
- **Why:** user idea; the current Attack size slider only controls troops sent, not land taken.

### Front controls, campaigns, bot counter-attack
- **What:** Stop per front, land limit per attack, pause-expansion toggle; attacks on nations re-send soldiers until done (campaign); attacked bots hit back at the aggressor.
- **Why:** user wanted to stop expansion and choose how much land to take, and saw attacks stopping after a small area (soldiers ran out and the front just closed) and enemies not pushing back (bots only mobilised, never counter-attacked).
- **Result (sim):** limit of 20 stopped at 20 tiles; unlimited campaign took 2,283 tiles from a 6.6K-tile nation, then the foe counter-attacked and regained about 1,200 tiles once the army was drained. A campaign is costly: it keeps draining the army and gold.

### Land to take is percentages only
- **What:** the Land to take dropdown offers only 10/25/50/75% of the rival's land (plus no limit); tile counts removed.
- **Why:** user: do not add tiles, just percentages.

### Workers do not defend
- **What:** workerDefense set from 0.25 to 0. Defense per tile is soldiers only (starving ones at 60%), with the 0.2 per tile militia floor.
- **Why:** user saw a bot with 200-300 soldiers hold off 600 attackers; workers' 25% defense hid its real strength. User: "no workers defend".
- **Result (sim, 12 min):** land moves 4-13% a minute, top bot 9%, top five 28%, no broken values.

### Stats in a bottom bar with icons
- **What:** the stat rows (population, army, workers, gold, food, land, rivals) moved from the side panel to a bottom bar, shown as icons with numbers; names only on hover. Controls stay in the side panel.
- **Why:** user asked to put the stats in a bottom bar and replace the names with icons (2026-10-23). Read "this" as the stats; the sliders and buttons need room, so they stayed.

### Recruit training time and slower drafting
- **What:** draftRate 1% -> 0.4% of population per second; new recruits spend 15 s in training (not soldiers, not workers, still eating) before joining the army.
- **Why:** user attacked a bot with 200 soldiers using 500 and still could not push, because the bot's army kept growing. Cause: drafting speed scales with whole population, so a 23K-person nation drafted about 90-300 soldiers a second, more than the attacker's force.
- **Result (sim):** a 200-soldier defender stays at about 90-200 for 15 s while the attacker takes 190-780 tiles, then the recruits arrive. Land still moves 6-15% a minute over 10 minutes, no invalid values. Tunable via trainSeconds and draftRate.

### Controls in the bottom bar, upgrade hover tip
- **What:** Army share slider, Attack size slider and the Upgrade (city) button moved into the bottom bar as icons. Hovering any shows a tip; the upgrade tip gives the next population cap and the gold needed.
- **Why:** user asked (2026-10-23) to put these in the bottom bar and see the cap and gold cost on hover.

### Land to take and Pause expansion in the bar
- **What:** both moved from the side panel into the bottom bar (dropdown and a pause button that lights up when on, with hover tips).
- **Why:** user asked (2026-10-23) to add them to the bottom bar too. Side panel now only has name, fronts/Stop, events, help.

### More aggressive bots
- **What:** bots compare neighbors by total soldiers (power) as well as defence per tile; advantage = max(density ratio, 0.9 x power), x1.5 if starving, x1.15 if no front there yet. Attack when advantage > 1.9 - aggression, or by chance (aggression x 0.1, +0.15 if starving). Revenge on an attacker (50-90% per decision) unless it is more than 2.5x their strength; revenge no longer ends the decision, so they can also hit another neighbor.
- **Why:** user (2026-10-23) attacked Ulundra with a smaller force; Ulundra had a bigger army but did not attack. Cause: the old rule compared army per tile, so a large nation with many tiles looked weak. User also wanted bots at war to exploit other borders.
- **Tuning:** first try (needed 1.7, chance 0.2) wiped out 19 of 50 bots in 12 min; moderated to 1.9 / 0.1. In an idle-player test the player was eaten by minute 4. Not tuned against a real player yet.

### Cap shrinks when land is almost gone
- **What:** effective cap = upgrade cap x min(1, tiles / 25). Anyone above it is over the cap (idle, extra mouths).
- **Why:** user was beaten down to 1-3 tiles but still showed 8.2K / 9K population. Cause: the cap is fixed by upgrades, not land, so population regrew to the full cap whatever the land. Captured land already moved workers to the winner, but regrowth refilled them.
- **Result (sim):** player pop 1,976 at 4.4K tiles, 339 at 53 tiles, 0 when wiped out.

### Trade design: global food market, starvation unrest, ally food (agreed, not built)
- **What:** see DESIGN.md "Agreed design". Global food market with exponential price by stock, buy queue, 5% fee; no selling limit, starvation is the penalty; unrest builds while unfed, the government spends soldiers and gold to hold it, and when it fills a region revolts into a new rebel nation; allies trade food directly, by request, at a seller-set discount or free.
- **Why:** user's idea (2026-10-23): central market with queue so demand spikes raise prices; no reserve rule, "heavily penalise starvation" instead; rebellions become new nations; allies stockpile or sell at their own price.
- **Status:** waiting for the user's go to build market + unrest/rebels first, alliances after.

### Dev lab for finding loopholes
- **What:** src/lab.js (dev only): set/give/cut/kill/attack/run/snapshot/restore/track/probe plus a backtick panel. Bots can be frozen or have their army share pinned (nation.frozen, nation.manualShare in sim.js).
- **Why:** user (2026-10-23) asked for a layer to manipulate the game, to see consequences and find loopholes bots could exploit before the market and rebellion go in.
- **First finding:** flipping army share 10%/90% every 5 s ended with far less (312 soldiers, 1.6K gold) than steady 30% (6.9K soldiers, 4.2K gold): toggling does not pay. A 100%-army pin on a bot did not bankrupt it within 5 minutes because drafting is slow (about 0.4% of population a second) and its soldiers die in wars: the all-army penalty bites slowly. Probe pitfalls found: pinning the share is needed or the bot AI overwrites it; the lab also refuses to run before the game starts.

### Lab has no UI on the page
- **What:** removed the backtick panel and its CSS; the lab is console-only (window.lab) and dev-only.
- **Why:** user (2026-10-23): the lab is for Claude, not shown on the website; they give scenarios through Claude to see different outcomes.

### Global food market built; target stock 4 seconds of eating
- **What:** market stock/price/queue/5% fee as agreed; overflow beyond a nation's store sells automatically; bots sell above a personal price threshold (3-9) keeping 10-120 s of food. Target stock = 4 s of world eating.
- **Why:** user asked (2026-10-23) to surge the market, starve everyone and make them fight, and watch prices and sellers. First try used 60 s of world eating as the target: the price was pinned at the 30 maximum for the whole run because the world never supplies that much surplus. 4 s gives a 4.5-22 gold range in normal play.
- **Scenario results (lab, one seed):** normal play 9-22 gold, 11 sellers. Surge (stock x20): price fell to the 1 minimum and all bot selling stopped; stock then drained about 500 a second. Starve everyone and fight: price pinned at 30 for about 270 s, 3-8 nations queued and starving (broke ones can not buy even when stock exists), two bots sold about 4,800 and 3,800 food for about 123K and 109K gold (average sale price 28, nine times the base): they profit from the shortage. 28 of 50 nations were gone after 5 minutes of this. Alliances do not exist yet, so no ally trades were possible.
- **Watch:** big food sellers can turn windfall gold into upgrades and snowball; price pinned at 30 for minutes means the supply side is thin in a crisis.

### Food trade taxes and loans
- **What:** sell tax 10% + up to 50% progressive by food-sales income share (cap 60%), buy tax 5%; loans from any nation to broke ones, lender-set interest (some free), 25% of income repays, default after 600 s gives the lender a 1.3x grudge.
- **Why:** user (2026-10-23): food sellers who profit from a crisis must become powerful but not superpowers, so tax them; broke nations may borrow from any nation, and lenders choose their own interest (even 0).
- **Results (lab):** in one starve-and-fight run the top seller (Wynonia) sold 9,372 food and kept about 90K gold, its tax rate at the 60% cap. A same-state A/B with the tax switched off, on and stronger was too chaotic to compare earnings (different bots won different wars); per unit sold the seller kept about 30 gold without tax vs about 10 with it. 125 loans in 5 minutes, 60% free, average rate 9%, typical size about 200-300 gold; the default path works when forced (a 700-second-old unpaid loan flipped to defaulted). No natural defaults yet in 5 minutes.
- **Open:** whether the tax is strong enough must be judged in play; player loan buttons not built.

### Player in the market loops, borrower-chosen repayment (built v50)
- **What (2026-10-23):** user confirmed the reading (borrower chooses when and how much to repay, e.g. 25% first, or all at once) and the 10-minute due date; also accepted that defaults are visible to other lenders. Built a Market panel (Market/Loans/Allies) opened from the bar price item; allies tab greyed until alliances exist.
- **Rules:** loan due 10 min after it is made; default = still owed then. Effects: lender grudge x1.3, 10-minute borrowing ban, +10 points interest per default for every lender, refusal at 3 defaults. Bots repay by style: prompt 40% of income/s, gradual 10%, late (last 90 s), cheat never (10% of bots). The player may post a standing offer (rate, share of gold per loan) that bots in trouble take, and may lend to a chosen bot (it accepts if in food trouble, not banned, rate at most 60%).
- **Why:** user wants the borrower to decide, so repayment must not be forced; the default cost has to be real or cheating is free.
- **Results (lab):** forced default flips the loan, bans the borrower, cuts offers to zero for them; 15 simulated minutes of mass starvation: 118 loans, 9 defaults, all by cheat-style bots; prompt, gradual and late bots all paid. Panel buttons (borrow, pay, sell, buy) checked in the browser.
- **Open:** whether 10 minutes and the ban length feel right; the player can default on purpose (cost: ban and bot grudge).

### Starvation unrest and rebel nations (built v51)
- **What (2026-10-23):** user said go on step 2. Unrest meter per nation; at 100% a region revolts into a new nation (design agreed earlier). Government holds unrest by paying gold only.
- **Why gold-only:** soldiers are already tied to borders and defence; tying them up needs more rules. Parked.
- **Results (lab):** with the market empty and bots' gold zeroed, unrest reached 0.6 at about 2 minutes of starvation and one nation split at about 2.5 minutes (a 822-tile rebel nation with 3.7K people, 363 soldiers); the map and names render it. Only 6 of 51 nations starved in that test, so how often rebellions happen in a real game is untested.
- **Open:** rebel nation's relation with the parent (my suggestion, unconfirmed: at war a few minutes, then neutral).

### Alliances and ally food (built v52)
- **What (2026-10-23):** user said go on step 3. Built per the agreed design (see DESIGN.md).
- **Choices I made without asking:** bots propose only to similar-strength neighbours (first version let them ally with anyone worldwide: 29 alliances in 60 s, far too dense); max 3 allies; bots never betray; instant answer to proposals; war help is a fixed 25% of army.
- **Results (lab):** 0 attacks between allies in 8 minutes; about 23 alliances among 35 nations by minute 8; ally food ask (free gift and 80% off cases) and refusal verified; player proposal, allied-attack refusal and panel render verified in the browser.
- **Open:** whether bots should betray or break alliances; whether alliances make the world too peaceful.

### Lab scenarios after v52 (2026-10-23, findings only, nothing changed)
- **20 min baseline, idle player:** top nation only 10% of land at minute 20 (win needs 40%); alive stays near 40 because 19 rebellions replace the dead (11 of 19 rebel nations died quickly); 164 loans, 5 defaults; ~21 of 41 nations allied. Big nations (e.g. 255K people, 18K tiles) sit starving with 0 gold and keep splitting.
- **Global crop failure at minute 6:** price pinned at 30 for about 3 minutes, back to 16 by 5 minutes; starving never above 4 at once; allied nations starved about as often as lone ones (70% vs 75%) because allies are short too.
- **Loophole (confirmed):** a free-food ally lets a nation ask up to its store, resell to the market and repeat: 2.2M gold in 10 cycles for a 174K-people nation (price held fixed). Bots do not do this; the player could. Candidate fix: cap an ally ask at the buyer's real need (about 60 s of eating) or make ally-bought food unsellable. Not built: waiting for the user.

### Two food pools and the farming fix (built v53)
- **What (2026-10-23):** user asked for own food (sell all) vs ally food (only about 10% resellable), shown on hover, and asked how to stop bots asking allies for cheap food and selling their own for profit.
- **My answer, built:** (1) ally food is eaten first, so it replaces eating rather than adding stock; (2) only 10% of what was received can be resold; (3) an ask is capped at real need (a minute of eating minus food held), so nobody can ask repeatedly up to storage. Bots only ask when in food trouble.
- **Result (lab):** the 10-cycle farming test that earned 2.2M gold now earns about 3.5K for a 38K-people nation (ally food 100% off, price fixed 10).
- **Remaining legitimate gain:** a nation fed free by an ally keeps and sells its own production: that is the intended ally benefit. Open: whether to cap how often one ally may be asked.

### More lab runs after v53 (2026-10-23, findings only, nothing changed)
- **User decision (2026-10-23):** leave ally food as built (no extra cap on how often an ally can be asked, it would spoil the fun); watch how bots use it. Rejected: extra ask limits for now.
- **15 min bot-only run:** no NaN or negative values anywhere; only 5 of ~51 nations ever received ally food (max 1.7K), so bots rarely use it; one run had Mughal reach 20% land (an earlier run topped at 10%): snowballs vary by run; 15 rebellions, tiny 1-2 tile remnant nations stay alive.
- **Probes:** `toggle` says LOOPHOLE (flipping army share beat steady: 3985 vs 1763 soldiers, more land) but on a 177K-people giant in a chaotic game, so treat as unconfirmed; `hoard`: a 537K-gold nation barely uses it (gold falls slowly, cap and land limit upgrades), money has no sink beyond upgrades/drafting; `squeeze`: giant Mughal sits at gold 0 with 1-4% soldiers yet loses land only slowly.

### Factories and steel (built v54)
- **What (2026-10-23):** user: nations can build factories (higher gold) that produce steel; steel for upgrading cities, as a trade good, and for upgrading the army. Placement and steel scope were asked, the user did not answer those, only added the three uses.
- **My choices:** factories are bought with a bar button, not placed on the map; land limits them (one per 60 tiles); first two population upgrades stay steel-free so the early game is unchanged; army level +20% per level; steel market flat 10% fee with its own scarcity price.
- **Tuning:** first run with factory cost 4,000 and bot threshold 2x: no bot ever built one (bots rarely hold more than a few thousand gold); lowered to 2,500 and 1.3x: about 50 factories among 45 nations by minute 8. Army upgrades needed the threshold lowered too: first bot army upgrades at minute 9 (8 nations by minute 9).
- **Results (lab, 12-15 min):** no NaN; steel price stayed 41-56; steel stock stayed near 2,000 (little steel traded); average population level 2.3-2.6 (steel gating did not stall upgrades).
- **Open:** whether army levels make wars too lopsided later; steel market barely used by bots.

### Steel running costs (built v55)
- **What (2026-10-23):** user: steel for army upgrades (already), more steel so there is enough, army upkeep needs food + steel, and the economy needs steel too.
- **My choices:** per-second burn (0.00001 per soldier, 0.000005 per working person), shortage penalty 30% on army strength and gold, auto-buy from the steel market, factory output 0.04 to 0.15, start steel 100. Rates picked so a 20K-people nation burns about one factory's output.
- **Results (lab, 15 min):** world made 9 steel/s and burned 6-8; stock rose from 2,000 to 4,600, price stayed 39-46; only 1 nation short at minute 15; a 188K-people giant burns 0.73/s against 0.45 made and buys the rest. 25 bots had upgraded armies by minute 2.5 (start steel 100 pays the first level): maybe too early.
- **Open:** army upgrade timing; whether the 30% shortage is harsh enough now that nations auto-buy.

### 25 min play-through after v55 (2026-10-23, findings only, nothing changed)
- No NaN. Top nation plateaus at 11-13% land (win needs 40%); fronts 19 to 46 at once; steel price 38-43 with stock 5.7K (oversupplied); army levels spread 0-4 and the largest nation (Goryeo, 12-13%) had no army upgrades, so army tech is not decisive; 3 loan defaults, 119 loans, 31 alliances.
- **Notable:** 38 rebellions in 25 minutes against few conquests: alive nations rose from 41 at minute 10 to 53 at minute 25. The world fragments faster than anyone conquers. 4 to 9 nations starve at any time and keep generating unrest. Candidate fixes (not built): rarer or smaller rebel nations, rebels merging back, or fewer chronic starvers.
- **User decision (2026-10-23):** do not fix rebellion/stalemate or make the game able to end yet: more features are still to be added first. Rejected for now: rarer rebellions, merging rebels, forcing an end.

### Fixed trade routes (built v56)
- **What (2026-10-23):** user: "add the proper fixed trade routes". Asked three questions, user chose the recommended: fixed sea lanes between ports, gold income plus food/steel carried, war closes routes and chokepoint holders take a toll.
- **My choices:** hand-made lane waypoints (11 lanes, 13 chokepoints); access by coast tiles near a lane instead of building ports; income 0.8 x lane value x sqrt(size)/10; toll 10% per chokepoint holder; max 3 routes per nation; routes to the player open without asking (no downside, closable); route food/steel at market price no tax (no profit loop: buying untaxed at the market price and selling taxed loses money).
- **Results (lab, 10 min):** 15-18 routes at a time among bots; open 9-15, blockaded up to 5, cut up to 7 (coast lost in wars); tolls on up to 11 routes; average route income about 4 gold/s; no NaN. Player flow checked in the browser: Routes tab lists options, a non-trading bot declines, a trading bot opens, route trade works, gold net includes route income.
- **Open:** lane shapes were not checked against every coast; no ships drawn; routes make no difference to food shortage yet beyond partners.

### 40 min run after v56 (2026-10-23, findings only, nothing changed)
- No NaN or negative values. Alive nations: 45 at minute 5, 39 at 10, 54 at 25, 84 at 35, **99 at 40** (166 ever existed); 115 rebellions; 33 nations under 30 tiles. Top nation stays 11-14% land (top three 32%), so nobody comes near 40%.
- Loans 682 with 40 defaults (22 by minute 35); fronts rose to 80 at once; alliances 44; routes 47 (27 open); steel price flat 38-43, 0-1 nations short of steel; average upgrade level falls to 1.2 because new rebel nations start at level 0.
- Reading: the rebel spiral (starving nations split, the pieces starve and split again) grows with time. Per the user (2026-10-23) this stays unfixed until more features are in.

### Why the top nation stays at 11-14% (measured 2026-10-23, 25 min run, nothing changed)
- Nations over 5% of the land gained 233K tiles and lost 170K; only about 5K of the losses were revolts (my revolt-loss detection is rough). The rest were taken by neighbours.
- The leader changed 26 times in 25 minutes. Leader was under attack 55% of the time, over its population cap 61%, at about zero gold 41%, starving 10%; its size factor averaged 0.72 (the big-nation penalty, bigPenalty 0.7 at 4x the average size cuts growth and gold by up to 30%); about 1 ally on average.
- Reason in rules: defence per tile = soldiers / tiles, so a big nation is thin everywhere and any neighbour that outmatches it per tile attacks (bots take any neighbour they outmatch, starving ones even more); plus the size penalty, over-cap idle mouths and an empty purse mean it cannot out-recruit the attackers. The result is a rubber band that pulls leaders back.
- Rebellions matter more for nation count (the spiral) than for the leader's size.

### More aggressive bots and the stuck-front bug (built v57)
- **What (2026-10-23):** user: make nations more aggressive when they see an opportunity, because otherwise games become infinite.
- **Measured before:** leaders lost land to neighbours constantly (see the 11-14% note). After the first aggression change a 40 min run consolidated: 21-23 nations alive from minute 15 on, leader 38% at minute 25 then stuck at 33.8%.
- **Bug found while explaining the stall:** a stuck leader with 98K tiles had a front holding 324K troops that took no land. Cause: with a single contact tile, the attack captured it and absorbSlivers (tile with at most 2 own neighbours and 5 enemy neighbours goes back) returned it every tick. Fix: protect captured tiles from the sliver rule for 5 s.
- **Results after both (lab 40 min):** leader 28.5% and rising (12.6% at 5, 18% at 30, 24% at 35), alive nations 29-36, no NaN, no winner yet; rebels 24 (was 115 in the 40 min run before); stuck fronts 13 of 29 still look stalled: mutual fronts (both sides huge troops, a tile flipping back and forth) remain.
- **Open:** mutual stalemate fronts; whether bots are now too aggressive for the player (not tested against a player).

### Cleanup and efficiency (v58, 2026-10-23)
- **What:** user asked to make the code base efficient and remove what is not needed.
- **Removed (live path never imported them):** the old whole-country game (src/main-countries.js, src/game/{ai,attacks,buildings,diplomacy,personalities,state}.js, scripts/simulate.mjs), region stats and sea links data (src/data/*, scripts/build-sea-links.mjs), the regions part of world.js, two npm scripts, unused CSS (old country panel, meters, chips, flashes, 53 selectors, 2 keyframes), two CSS variables, an unused random helper and a few exports. Backups are in the session scratchpad, outside the project (the project is not a git repo).
- **Found by measuring:** simulation is about 1.2 ms per tick, 70% of it in updateAttacks; the browser render was the real cost (20 to 130 ms on ticks that changed territory) because the rim glow was rebuilt and the whole territory image re-uploaded every tick. Now rim rebuilds at most every 200 ms after a change and only the changed box is uploaded: typical render about 11 ms, spikes about 50-70 ms at rim rebuilds.
- **Proof of no behaviour change:** the sim with the faster attack scan produced identical state (ownership hash, alive count, total gold, fronts) to the old code on the same seed at 2, 4, 6 and 8 minutes, and ran about 6% faster. The render changes are visual timing only (the rim glow lags up to 0.2 s).
- **Bug found and fixed:** the artifact build used its own page template that had no bottom bar and no market panel, so published artifacts v42 to v57 had no bottom bar or Market panel on the page. The template now comes from index.html. Check any earlier feedback with that in mind.

### Lag fix (v59, 2026-10-24)
- **What:** user said the game felt laggy. Measured per stage in the browser (render every 3rd tick, 1200 ticks): the sim was not the cause; drawing was.
- **Causes found:** (1) buildBorders scanned all 951,600 tiles with Maps every tick (territory draw median 11 ms, p95 25 ms); (2) the changed-pixels bounding box spanned the world once fronts were far apart, so putImageData took 25-80 ms; (3) name-spot recompute (full-grid passes) spiked up to 60 ms twice a second.
- **Fixes:** buildBorders walks each nation's border set (both tiles of a differing pair are border tiles; checked: identical edge counts at 4 points in a run); upload per 64x64 dirty chunk (upload max 5 ms, paint max 21 ms, was 92); name spots every 1.5 s instead of 0.5 s.
- **Result:** territory draw median about 3.5-7 ms (was 11), p95 about 6-20 ms (was 25). The hidden browser pane makes timings noisy, so these are rough. Remaining hitch: name spots (up to about 75 ms once per 1.5 s), next thing to make incremental if the lag persists.
- **Mistake noted:** my own fast-forward loop used `while (tick < N)` and hung the tab once the player was eliminated (the tick stops when the phase is not playing). Always time-box lab loops.

### Lag fix 2 (v60, 2026-10-24)
- **What:** user: still very laggy after v59. JS timings were already small, so the cost is in the browser compositor: the #spread canvas has an SVG filter (blur + threshold + colour passes) and three panels had backdrop-filter blur, and the canvas was cleared and redrawn every frame (about 60 times a second) though the game changes about 10 times a second.
- **Fix:** drawTerritory skips when tick, view transform, canvas size and paint count are unchanged; removed backdrop-filter from the card/hud, market and bar (background is 96% opaque, so no visible change).
- **Not measured:** the browser pane stayed hidden so real fps could not be read; verified drawing still correct. If still laggy, next suspects: the SVG filter itself (replace with a cheaper smoothing, or a lower-resolution canvas), and the names canvas redrawing every frame.

### Lag fix 3 (v61, 2026-10-24)
- **What:** user: still laggy when zooming in and out, and while playing. Zoom events used to set the blur radius (up to about 30 px at full zoom), move the world-coastline clip path and redraw the territory canvas through the SVG filter on every frame.
- **Fix:** during a zoom or pan the territory canvas is only moved and scaled with a CSS transform (delta between the drawn view and the current one); the clip path stays at the drawn view, so they move together. 150 ms after the last zoom event the canvas, clip and blur radius are updated and it is redrawn sharp. Names, cities and lanes still redraw each frame (no filter).
- **Checked:** render during zoom about 2 ms per frame; after settling the territory lines up with the coast at zoom 12. Not measured as real fps (hidden pane).
- **Tradeoff:** during a zoom the territory looks slightly soft (a scaled bitmap) and does not update (ticks keep running); it snaps sharp when you stop.
- **If still laggy:** next suspects are the SVG land/graticule layers at high zoom (large paths re-rastered by the browser) and the filter cost at each redraw; replacing the SVG filter with a cheaper smoothing is the bigger change.

### WebGL territory layer (v62, 2026-10-24)
- **What:** user asked to put the map on the GPU and keep the look as close as possible, after still feeling lag in v59-v61 (those cut CPU work but the SVG blur filter, coastline clip and CPU border paths stayed).
- **Design (advisor-reviewed):** new canvas #gl in #spread's slot, WebGL2, preserveDrawingBuffer so screenshots work. Owner texture from game.owner; effective-owner pass for the sea rim; one fragment shader does edge smoothing, colour, line between nations, outline and land mask. Replaced: filter, SVG clip, band and border paths, rim, putImageData upload (all still in the file for the fallback).
- **Look match:** compared GPU and canvas renderers on the same game at zoom 1 and 12 (toggleGL): same shapes, outline and line between nations. Differences: no 120 ms fade-in of captured tiles (edges step once per tick), no faint rim over unowned land (not needed), land mask is 3x grid so the coast is soft at extreme zoom (the SVG coastline stroke on top hides it).
- **Measured:** render() about 7 ms including a forced GPU sync, at zoom 1 to 40, upload plus draw about 7 ms (hidden pane, rough).
- **Remaining lag sources not in this layer:** SVG land and coastline paths (countries-50m) re-rasterised by the browser on zoom; the name-label recompute hitch every 1.5 s. If zoom is still slow, the SVG land is next.
- **Not handled:** WebGL context loss (rare); the fallback renderer is the same code as v61.

### Market button (v63, 2026-10-24)
- **What:** user said they could not see where to buy and sell. The Market panel only opened by clicking the small price number in the stats row, which nobody recognised as a button.
- **Fix:** a labelled "Market" button (chart icon) in the second row of the bottom bar, before the factory button. The price item still opens it as well.

### Nation panel, free settling, islands (v64, 2026-10-24)
- **Nation panel (user: "give me a panel for trades and other things when I right click another nation: alliance, send food, ask food, anything else"):** right-click a nation opens a panel near the click. Reuses the market panel styles and the existing sim calls (proposeAlliance, askAlly, lendTo, takeLoan, openRoute, routeTrade). New in sim: giveFood (arrives in the receiver's ally pool so it can not be resold for profit) and giveGold. Asking for food works with allies only (non-allies answer that they only share with allies). Checked in the browser: gifts move food and gold, non-allies decline alliance, loan and food asks with a reason.
- **Bug (user screenshot: could not claim land inside and next to their territory):** a click on empty land used "do I touch any empty land anywhere" to pick overland settling, so a separate island or cut-off pocket got an overland front that spread over the mainland and never reached it. Fix: overland only when the clicked empty land is joined to your land through empty land (flood fill from the click, stops at the first contact); otherwise a boat. A boat to a bay sliver smaller than a grid tile is still impossible (those tiles are sea in the grid).
- **Rule change (user: "remove army need for expanding wilderness, for player and bot both", then "no cost for expanding"):** settling empty land is free: nobody is sent, no soldiers or workers are used, no per-tile cost (attackCost for empty land is 0). Replaces an interim version the same day that used workers only. Boats to empty land carry nobody and tag settling so a boat landing on already owned land does not turn settlers into soldiers. Bots settle whenever they touch empty land.
- **Effect (sim, idle player):** empty land runs out much faster: 24% of land left at minute 1 and about 6% at minute 2 (before, about 14% at minute 2 and 5% at minute 5). No invalid values in 4 to 8 minute runs, probe all-army fine. Expansion speed is now limited only by how many border tiles a front takes per tick (frontShare), not by people.
- **Open:** land grab is now a 2-minute race, so early placement and the attack phase matter more; revisit if games feel too fast to react to.

### Corner the food market? (2026-10-24, user question, nothing changed)
- **Question:** can the player buy all the market food to create demand, then sell it at the higher price?
- **Rules as built:** buying is instant at the current price plus 5%, no price impact from your own size; the price only eases toward its goal (3 x (target/stock)^1.5, max 30) at 0.5 per second; selling is at the current price minus the sell tax (10% rising to 60%, 12% in the test); you can hold at most 180 s of your own eating (foodStore), so how much you can corner is capped.
- **Test (sim, idle player, 90 s in, 60K gold given):** bought 414 food (the most the store holds) for 2,671 gold; the price barely moved (6.14 to about 5.5-6.0) because bots dump overflow food into the market at about 50 food a second (stock went 675 to 1,144 in 10 s). Selling it back was worth about 2,240, a loss of about 430 gold (5% buy tax + 12% sell tax). Price over 65 s ranged only 5.1 to 6.3, so best buy-low-sell-high was about +4%.
- **Conclusion:** allowed, but it does not pay at today's size. It could pay for a nation whose store is large compared with the market stock (store is 180 s of own eating, stock target is 4 s of everyone's), or when buying cheap before a shortage; also the more it buys the more bots in the queue go short. Not changed; ideas if wanted: price impact per purchase, a purchase cap per minute, or a higher buy tax.

### Why 2x army does not overpower an equal-size nation (2026-10-24, user question, nothing changed)
- **Rules as built:** the attacker pays per captured tile: (2 + 1.4 x defender soldiers-per-tile, floor 0.2) / (1 + 0.2 x attacker army level), taken out of the troops it committed. So the army RATIO does not decide anything: committed troops divided by the cost per tile is how many tiles one wave takes. Defender losses are small (0.8 x its density per tile taken). Only 7% of the committed troops are spent per tick and at most 30% of the front moves per tick. The Attack size slider (default 30%) limits what is committed; campaigns top it up. The defender drafts up to 0.4% of its people a second and bots counter-attack at once.
- **Test (sim, bots of about 9,000 tiles each, ~500 soldiers = 0.05 per tile, below the 0.2 floor):** attacker given 2x soldiers (970 vs 485) and army level 2 vs 0, attack size 100% campaign. First 10 s it took about 450 tiles (5% of the foe), then the foe drafted (200 to 830 soldiers in 30 s), bought an upgrade and hit back: after 60 s attacker +1,025 tiles, foe -218. No collapse of the foe.
- **Takeaways:** with a land-heavy, thin army the cost floor is about 1.6 gold-troops per tile, so 1,000 soldiers is about 600 tiles; taking half of a 9,000-tile nation needs about 7,000 soldiers. Land is paid in troops per tile, not beaten by ratio.
- **Options if wanted (not built):** scale cost by the defender's soldiers against the attacker's (ratio matters), kill more defenders per captured tile, slow defender drafting while attacked, stop counter-attacks during a push, show the player an estimate (tiles per wave, cost per tile) on hover over a rival.

### Combat by strength, not tile cost (v65, 2026-10-24)
- **User:** after the "why can't I overpower an equal-size nation with 2x army" answer: "remove the tiles part because it is very hard and complicates things; higher numbers and higher upgrades get the advantage; if the army is the same but one has higher upgrades it will win." Reverses the 2026-10-22 garrison floor (0.2 per tile) and the per-tile attack cost; big, thinly defended nations now fall faster to a stronger army.
- **Rule:** whole-army strength = (home soldiers + soldiers out fighting) x (1 + 0.2 x level) x starving 0.6 x steel-short 0.7, split over fronts; both sides lose battleRate 0.08/s of the weaker side's strength; the front moves advanceShare 0.04 x (1 - 1/ratio) of its length a tick when the ratio is above 1, with a fractional carry so a tie stands still. Advisor point kept: the fight compares WHOLE armies, not only the committed troops, so the 30% Attack size slider does not make a 2x army lose.
- **Duels (sim, Sibir vs Kazan, ~21-27K tiles, 364 soldiers base, only the pair fighting, slider 30%, 90 s):** equal armies and upgrades: stalls (+176 early, then flat); equal armies, attacker upgrades 2 vs 0: +4,000 tiles; 2x soldiers: +5,500; equal armies but the DEFENDER has upgrades 2: attacker gains 0; 2x soldiers vs defender upgrades 2: +3,200; 2x soldiers with the foe counter-attacking: +2,700.
- **Pace (full sim, 12 min, player given a big army):** land moving 5-13% a minute (advanceShare 0.06 gave 12-20%, 0.025 gave 7%); alive 51 to 24, leader 15%, top five 55% at minute 12; no invalid values. Probe toggle ok; two-front probe needs a bot with two neighbours (not run).
- **Gotcha for lab work:** `window.nations.RULES` is not the same object as the RULES of a console-imported sim module; set rules on the module you call tick from. Pinning bot soldiers needs `manualShare` plus `armyShare` (drafting pulls soldiers back to the share target in seconds).
- **Open:** a hover readout of strength ratio and who wins would make fights readable (not built).

### Rival hover readout (v66, 2026-10-25)
- **What:** user said yes to a hover readout on a rival showing strength ratio and who wins. Tooltip follows the cursor over another nation: both sides' soldiers (home plus out fighting), modifiers (upgrade level, hungry x0.6, no steel x0.7), strength, ratio, verdict. Thresholds 1.15x either way so near ties read "Even: the front would stall". Shows a note when the rival fights several fronts (its strength is split in the fight rule). Hidden over your own land, while the right-click panel is open and while dragging.
- **Why this way:** it reads the same numbers the fight uses (fightMultiplier exported from sim.js), so it can not disagree with the result. Checked in the browser: upgrades x1.4 vs hungry x0.6 gave 3.43x, "You would win".

### Coast halo fix (v67, 2026-10-25)
- **User (two screenshots):** colour not properly filled: a thin pale strip between the blue territory and the coastline, worst at peninsula tips.
- **Cause:** v62 GPU land mask used smoothstep(0.35, 0.65) on a bilinear 3x-grid texture; at zoom a texel is 4 to 10 px, so the fill faded out over several pixels before the coast and the beige land showed through.
- **Fix:** coast edge = where the mask crosses 0.5 with a pixel-wide ramp from its screen derivative, pushed out 0.7 px so the fill reaches the drawn coastline (which covers the overlap). Derivatives computed before the shader's early exit. Checked at zoom 14 on a long coast: crisp, no halo.
- **Not changed:** tiny islets just beyond the 2-tile sea rim stay partly beige (unowned land; the grid cannot claim sub-tile islets, see the v64 note).

### Coast slivers, second fix (v68, 2026-10-25)
- **User:** "it is still there" after v67 (screenshot: thin pale lines along coasts and an island with a green tip).
- **Cause:** the 3x-grid land mask is too coarse at zoom (one texel is 2-3 screen px at zoom 8-14), so its half-contour sits up to about 1.5 px inside the real coast; v67 only made its edge crisp.
- **Fix:** when the view has held still 0.3 s, draw the land for exactly this view on a screen-sized 2D canvas (vector coast), upload it, and trim the fill to it; the coarse mask is only used while moving. Rebuild costs 30-50 ms once per stop (0.3 s wait so pauses between wheel notches do not trigger it). Checked at zoom 9 on a long coast: crisp, no slivers.
- **Not a bug (explained to user):** an island with a green tip and a beige rest is a nation that owns part of the island; the rest is unclaimed land (settling is free, but a click must reach it by land or boat; sub-tile islets are not claimable).
- **Tool quirk:** the browser pane's screenshot can show a stale frame; take a second screenshot.

## 2026-10-25 Trade lanes follow the sea (v69)
- User: lanes looked angular ("too squary"), should follow the real specific shipping routes, and must not cross land; suggested dividing the world into very small pixels with land/sea values and per-nation ids.
- Decision: the per-tile grid already exists (grid.land = land/sea, game.owner = nation id per tile, changes on conquest). Lanes reuse it: each lane's waypoints are joined by A* over water tiles (8-neighbour, penalty near coast), rounded, thinned, drawn as Catmull-Rom curves. Sub-tile straits/canals (Suez, Panama, Bosphorus, Danish) fall back to a straight hop (a few tiles still on land there, by design).
- Rejected: the coarse 4-tile grid.seaRoute (staircase paths). Idle lanes drawn fainter (0.3 alpha).

## 2026-10-25 Boats sail only through sea tiles (v70)
- User (screenshot of a boat line heading over land; then "boat will find path using only the pixels of ocean, not land"): boat routes were the coarse 4-tile staircase and could cut over land and start from enclosed seas.
- Decision: boat route = coarse sea route as a guide, each stretch re-solved by A* over fine water tiles (persistent search buffers), thinned only where a straight sail stays on water; a water-component label (one ocean, Caspian, lakes ...) rejects ports not on the target's sea; one-tile straits (Gibraltar, Bosphorus, Suez) bridged. Several departure ports tried nearest first. Lab check: 27/29 launches routed, 0.26% of samples on land (straits only), max 87 ms.
- Lanes use the same router (waterPath).

## 2026-10-25 Routing on a finer sea picture (v71)
- User (screenshots: lane hugging/cutting a coast corner and an island): "very close, divide it into very very small ones, more pixels than before".
- Decision: lanes and boats route on a separate 2x land/sea raster (2400x1586, grid.nav built by buildNav in grid.js, same projection) instead of the 1200 game tiles; game rules still use the 1200 grid. Lanes keep off the coast (penalty 1), straits up to 3 tiles wide bridged. Check: lanes 0-25 land samples of 200-1330 (Suez canal worst), boats 0.35% on land, 27/32 routed, most launches under 100 ms (worst about 0.8 s).
- Rejected: raising the whole game grid (4x the tiles would cost memory and speed everywhere).

## 2026-10-25 Rivers, canals and straits on the map (v72)
- User (Panama lane crossing the isthmus): show these crossings on the map "even small ones", and rivers inside the land if it has any.
- Decision: rivers from Natural Earth 50m rivers + lake centerlines (887 lines, 323 KB, src/data/rivers.json, rounded to 0.01 deg) drawn as a thin blue Path2D under the lanes (also on the pick screen). Canals (Panama, Suez, Kiel) as solid blue lines; eight straits (Gibraltar, Bosphorus, Dardanelles, Bab-el-Mandeb, Hormuz, Malacca, Danish, Dover) as rings. Names only when zoomed in (canals 2x, straits 2.5x) to avoid clutter. Rivers are decoration only: no gameplay effect.
- Data source downloaded from github.com/nvkelso/natural-earth-vector (public domain).

## 2026-10-25 Idea: rivers stop land expansion (not built)
- User asked whether rivers stop a land grab, so you need a boat to the other bank. Answer: no, rivers are decoration only (v72). Added to the DESIGN.md backlog, waiting for the user to say build it.

## 2026-10-25 Big rivers block land fronts (v73)
- User: a river should stop a land grab, but where the river ends (source/open end) you can walk around; to jump across, use a boat to the far bank.
- Decision: the 148 largest Natural Earth rivers (scalerank <= 4, rivers only, not lakes) are rasterised on the 1200 grid as 8-connected land tiles (grid.river, 6,076 tiles). A river tile can be captured but is never a place to advance from: attack/settle candidate scan, borders(), settleable() flood and neighborsOf() all skip river tiles as sources. So a front halts at a river and flows around its ends.
- Crossing: riverCrossing() finds our tile with a river tile and then target land 2-3 tiles beyond in a straight line, nearest the click (within 60 tiles); sendTroops then launches a 4 s ferry (a boat with a 2-point route, landing code unchanged). Used for the player and for sendTroops callers generally; bots do not seek ferries on purpose (they walk around or use sea boats).
- Test: east bank not claimable overland, ferry landed after 4 s; full game still claims 93% of land by 2 min and 100% by 10 min.
- Rivers drawn: big ones darker/thicker, small ones faint decoration.

## 2026-10-25 Every river is a barrier (v74)
- User: no river should be decorative; every river gets its water pixels (refine the resolution if needed) but oceans must stay oceans.
- Decision: all 887 Natural Earth river and lake-centerline lines (about 11,950 tiles on the 1200 grid) are barrier tiles, drawn on land tiles only so no ocean tile changes (checked: 0 river tiles on sea). One drawing style for all. Kept the 1200 grid: a 1-tile 8-connected line already blocks 4-neighbour movement, so no finer raster needed. Bots now ferry settlers to empty land across a river (wildAcrossRiver, 40% per think when nothing is next door).
- Test: land claimed 90-95% by 2 min, 100% by 10 min in the better runs (one run left 5% of far islands unclaimed, a bot-boat variance seen before rivers, not a river pocket).

## 2026-10-25 Spawn no longer crosses rivers (v75)
- User screenshot: the starting circle straddled a river, so the river did not block the nation. Cause: addNation claimed every tile within spawnRadius, ignoring rivers.
- Fix: the start land is a flood from the centre inside the radius that takes river tiles but does not spread from them (same rule as fronts); applies to the player and bots. Test: 25 starts beside rivers, 0 owned tiles across a river.
- Known small leak: the lone-tile cleanup rule (flip a tile when 5 of 8 neighbours belong to another nation) ignores rivers; not changed.
