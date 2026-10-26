// Nations, territory mode: nations spawn as dots on a plain world map and grow
// tile by tile. The SVG draws the land; a canvas on top draws territory,
// nation names and boats, all under one zoom.

import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { pointer, select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import { merge, mesh } from "topojson-client";
import topology from "world-atlas/countries-50m.json";
import { buildWorld, landGeometries } from "./game/world.js";
import { random } from "./game/rng.js";
import { startLoop } from "./game/loop.js";
import { WATER, WILD, buildGrid } from "./territory/grid.js";
import { CANALS, STRAITS } from "./territory/lanes.js";
import riverData from "./data/rivers.json";
import { createTerritoryGL } from "./territory/gl.js";
import {
  RULES,
  buildCity,
  cityCost,
  createGame,
  maxCities,
  army,
  foodEaten,
  foodMade,
  foodStore,
  goldIncome,
  landShare,
  logEvent,
  capWithCities,
  maxTroops,
  sendTroops,
  sellTaxRate,
  buyFood,
  sellShare,
  listOffers,
  takeLoan,
  lendTo,
  repayLoan,
  setOffer,
  openRoute,
  closeRoute,
  routeTrade,
  routeState,
  routesOf,
  hasAccess,
  routeIncomeOf,
  buildFactory,
  upgradeArmy,
  citySteel,
  armyUpgradeCost,
  maxFactories,
  factoryCost,
  steelRate,
  steelUse,
  buySteel,
  sellSteel,
  proposeAlliance,
  answerProposal,
  breakAlliance,
  askAlly,
  giveFood,
  giveGold,
  fightMultiplier,
  allyDeal,
  alliesOf,
  isAllied,
  setAllyOffer,
  setHoldExpansion,
  stopFront,
  startGame,
  tick,
  workers,
} from "./territory/sim.js";

// Only the player is blue; bots get other hues.
const PLAYER_COLOR = "#1f5fd6";
// Territory fill opacity.
const FILL_OPACITY = 0.7;
// Unowned tiles next to a nation carry its color (the rim). Toward open land
// it's faint: the filter's edge threshold sits halfway between rim and full
// alpha, so the smoothed edge lies right on the tiles, where the border
// lines end. Toward the sea it's full, so the territory reaches past the
// coarse tiles and the land clip trims it to the real coastline.
const RIM_ALPHA = 0x33;
const RIM_DEPTH = 2; // tiles
const EDGE_ALPHA = (1 + RIM_ALPHA / 255) / 2;

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
}
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

// Bot colors: golden-angle hues, skipping blues, at alternating lightness.
const BOT_COLORS = [];
for (let i = 0; BOT_COLORS.length < 64; i++) {
  const hue = (i * 137.508) % 360;
  if (hue > 180 && hue < 255) continue;
  const [l, s] = [[0.58, 0.55], [0.5, 0.5], [0.66, 0.55]][i % 3];
  BOT_COLORS.push(toHex(hslToRgb(hue, s, l)));
}

const world = buildWorld(topology);
const grid = buildGrid(world);
const game = createGame(grid);

const svg = select("#map");
const hud = select("#hud");
const bar = select("#bar");
const marketEl = select("#market");
const overlay = select("#overlay");

const projection = geoMercator();
const path = geoPath(projection);

const layer = svg.append("g");
const graticule = layer.append("path").attr("class", "graticule").datum(geoGraticule10());
// All land as one shape, without the old country borders inside it: drawn
// country by country, the seams leave hairline gaps that show as specks.
const landShape = merge(topology, landGeometries(topology));
const land = layer.append("path").attr("class", "land").datum(landShape);
// The coastline sits above the territory, so coasts stay crisp.
const fx = select("#fx");
const fxLayer = fx.append("g");
const coastline = fxLayer
  .append("path")
  .attr("class", "coastline")
  .datum(mesh(topology, topology.objects.countries, (a, b) => a === b && a.properties.name !== "Antarctica"));

// Territory is drawn on #spread with sharp tiles. A filter rounds off each
// territory's outer shape, fills it with each nation's color (the border
// lines and color strips drawn on top hide the tile steps), then gives a
// translucent fill and a crisp darker outline. Names and boats go on their own canvas above,
// so they stay sharp.
const canvas = document.querySelector("#spread");
const tcanvas = canvas.getContext("2d");
const names = document.createElement("canvas");
names.id = "names";
document.body.insertBefore(names, document.querySelector("#hud"));
const ctx = names.getContext("2d");
document.body.insertAdjacentHTML(
  "beforeend",
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <filter id="smooth-territory" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
      <feComponentTransfer in="blur" result="mask"><feFuncA type="linear" slope="30" intercept="${-30 * EDGE_ALPHA}" /></feComponentTransfer>
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="color" />
      <feComposite in="color" in2="mask" operator="in" result="solid" />
      <feMorphology in="mask" operator="erode" radius="1" result="inner" />
      <feComposite in="solid" in2="inner" operator="out" result="ring" />
      <feColorMatrix in="ring" type="matrix" values="0.72 0 0 0 0  0 0.72 0 0 0  0 0 0.72 0 0  0 0 0 1 0" result="outline" />
      <feComponentTransfer in="solid" result="fill"><feFuncA type="linear" slope="${FILL_OPACITY}" /></feComponentTransfer>
      <feMerge><feMergeNode in="fill" /><feMergeNode in="outline" /></feMerge>
    </filter>
    <clipPath id="land-clip" clipPathUnits="userSpaceOnUse"><path id="land-clip-path" /></clipPath>
  </svg>`
);
// The GPU draws the territory when WebGL2 is there (add #old to the address for the canvas
// renderer below, which is also the fallback). Same stacking slot as #spread.
const glCanvas = document.createElement("canvas");
glCanvas.id = "gl";
canvas.before(glCanvas);
const gpu = location.hash === "#old" ? null : createTerritoryGL(grid, glCanvas);
if (gpu) {
  canvas.style.display = "none";
  // Land as a mask, at 3x the grid, so the coast is trimmed to the real shore.
  const LAND_SCALE = 3;
  const landCanvas = document.createElement("canvas");
  landCanvas.width = grid.width * LAND_SCALE;
  landCanvas.height = grid.height * LAND_SCALE;
  const lctx = landCanvas.getContext("2d");
  lctx.fillStyle = "#000";
  lctx.fillRect(0, 0, landCanvas.width, landCanvas.height);
  lctx.scale(LAND_SCALE, LAND_SCALE);
  lctx.beginPath();
  geoPath(grid.projection, lctx)(landShape);
  lctx.fillStyle = "#fff";
  lctx.fill();
  gpu.setLand(landCanvas);
  gpu.uploadOwner(game.owner);
} else glCanvas.remove();
const blurs = document.querySelectorAll("#smooth-territory feGaussianBlur");
const landClip = select("#land-clip-path").datum(landShape);
canvas.style.filter = "url(#smooth-territory)";
// Territory runs on into the sea (the rim), then is clipped to the real
// coastline, so coasts are filled exactly to the shore.
canvas.style.clipPath = "url(#land-clip)";
// The territory canvas overhangs the screen by PAD on every side, so the
// smoothing never sees its edge (which would draw an outline along it).
const PAD = 64;
Object.assign(canvas.style, { left: `${-PAD}px`, top: `${-PAD}px`, width: `calc(100% + ${2 * PAD}px)`, height: `calc(100% + ${2 * PAD}px)` });
landClip.attr("transform", `translate(${PAD},${PAD})`);

// Blur by about one tile on screen, so edges round off at every zoom.
function updateSmoothing() {
  const tilePx = viewTransform.k * ratio;
  // Alpha only, about a tile, to round off shapes. Colors aren't blurred:
  // that would mix neighbors; the color strips cover the tile steps instead.
  for (const blur of blurs) blur.setAttribute("stdDeviation", Math.max(0.7, tilePx * 0.75).toFixed(2));
}
let dpr = 1;
let viewTransform = { k: 1, x: 0, y: 0 };
// While the view moves, the territory canvas (blur filter, coastline clip) is not redrawn: its
// last picture is scaled and moved with a CSS transform, and redrawn sharp once the view settles.
const ZOOM_SETTLE_MS = 150;
let zoomingUntil = 0;
let drawnView = { k: 1, x: 0, y: 0 }; // the view the territory canvas was last drawn for
// Grid -> screen (at zoom 1): screen = offset + grid * ratio.
let ratio = 1;
let offset = [0, 0];

const zoomBehavior = zoom()
  .scaleExtent([1, 40])
  .on("zoom", (event) => {
    layer.attr("transform", event.transform);
    fxLayer.attr("transform", event.transform);
    viewTransform = event.transform;
    zoomingUntil = performance.now() + ZOOM_SETTLE_MS;
  });
svg.call(zoomBehavior);

function fit() {
  const { width, height } = svg.node().getBoundingClientRect();
  if (width === 0 || height === 0) return;
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  fx.attr("viewBox", `0 0 ${width} ${height}`);
  projection.fitSize([width, height], world.collection);
  for (const p of [graticule, land, coastline, landClip]) p.attr("d", path);
  dpr = window.devicePixelRatio || 1;
  gpu?.resize(width, height, dpr);
  names.width = Math.round(width * dpr);
  names.height = Math.round(height * dpr);
  canvas.width = Math.round((width + 2 * PAD) * dpr);
  canvas.height = Math.round((height + 2 * PAD) * dpr);
  ratio = projection.scale() / grid.projection.scale();
  const [sx, sy] = projection.translate();
  const [gx, gy] = grid.projection.translate();
  offset = [sx - gx * ratio, sy - gy * ratio];
  updateSmoothing();
  const [[x0, y0], [x1, y1]] = path.bounds(world.collection);
  zoomBehavior.translateExtent([
    [Math.min(0, x0), Math.min(0, y0)],
    [Math.max(width, x1), Math.max(height, y1)],
  ]);
}
fit();
new ResizeObserver(fit).observe(svg.node());

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

let attackRatio = 0.3;
let landGoal = "any"; // how much of a rival's land one attack may take

const toScreen = (gx, gy) => [
  viewTransform.k * (offset[0] + gx * ratio) + viewTransform.x,
  viewTransform.k * (offset[1] + gy * ratio) + viewTransform.y,
];

function tileAt(event) {
  const [px, py] = pointer(event, svg.node());
  const gx = Math.floor(((px - viewTransform.x) / viewTransform.k - offset[0]) / ratio);
  const gy = Math.floor(((py - viewTransform.y) / viewTransform.k - offset[1]) / ratio);
  if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return -1;
  return gy * grid.width + gx;
}

function spawnAt(tile) {
  if (startGame(grid, game, tile, BOT_COLORS, PLAYER_COLOR)) paintAll();
}

svg.on("click", (event) => {
  closeNation();
  const tile = tileAt(event);
  if (tile < 0) return;
  if (game.phase === "picking") {
    if (game.owner[tile] === WILD) spawnAt(tile);
    return;
  }
  if (game.phase !== "playing") return;
  if (placingCity) {
    const why = buildCity(grid, game, game.player, tile);
    if (why) logEvent(game, why);
    setPlacingCity(false);
    return;
  }
  const me = game.nations[game.player];
  const pool = army(me); // soldiers to attack with (settling empty land sends nobody and is free)
  const target = game.owner[tile];
  const rival = target >= 0 ? game.nations[target] : null;
  const goal = landGoal === "any" || !rival ? Infinity : Math.ceil((rival.tiles * +landGoal.slice(1)) / 100);
  const why = sendTroops(grid, game, game.player, tile, pool * attackRatio, { limit: goal, ratio: attackRatio, campaign: true });
  if (why && game.owner[tile] !== game.player) logEvent(game, why);
});

// City placement: the Build city button arms it; the next click on your land builds.
let placingCity = false;
function setPlacingCity(on) {
  placingCity = on;
  svg.style("cursor", on ? "crosshair" : null);
}
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setPlacingCity(false);
});

// --- Territory image: one pixel per tile, smoothed when drawn ---------------

const territory = document.createElement("canvas");
territory.width = grid.width;
territory.height = grid.height;
const tctx = territory.getContext("2d");
const image = tctx.createImageData(grid.width, grid.height);
const pixels = new Uint32Array(image.data.buffer);
// Per nation: fill color as a little-endian RGBA word.
let paints = [];

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return ((alpha << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
}

// Newly taken tiles fade in; through the smoothing filter this makes a
// nation's edge glide outward instead of jumping each tick.
const FADE_MS = 120; // about one tick, so the fill keeps pace with the border lines
const fading = new Map(); // tile -> when it started fading in
let seenOwner = null;

// Pixels changed since the last upload, by 64x64 chunk: only those chunks go to the canvas
// (one bounding box would span the world as soon as two fronts were far apart).
const CHUNK = 6;
const chunksAcross = (grid.width >> CHUNK) + 1;
const chunkDirty = new Uint8Array(chunksAcross * ((grid.height >> CHUNK) + 1));
let dirtyChunks = [];
function touch(t) {
  const x = t % grid.width;
  const c = (((t / grid.width) | 0) >> CHUNK) * chunksAcross + (x >> CHUNK);
  if (chunkDirty[c]) return;
  chunkDirty[c] = 1;
  dirtyChunks.push(c);
}
function upload(full) {
  if (full) tctx.putImageData(image, 0, 0);
  else {
    const size = 1 << CHUNK;
    for (const c of dirtyChunks) {
      const x = (c % chunksAcross) << CHUNK;
      const y = ((c / chunksAcross) | 0) << CHUNK;
      tctx.putImageData(image, 0, 0, x, y, Math.min(size, grid.width - x), Math.min(size, grid.height - y));
    }
  }
  for (const c of dirtyChunks) chunkDirty[c] = 0;
  dirtyChunks = [];
}

function paintTile(t, now) {
  touch(t);
  const o = game.owner[t];
  if (o < 0) {
    pixels[t] = 0;
    fading.delete(t);
    return;
  }
  if (seenOwner[t] !== o) {
    seenOwner[t] = o;
    fading.set(t, now);
  }
  const color = paints[o];
  const start = fading.get(t);
  if (start === undefined) {
    pixels[t] = color;
    return;
  }
  const f = Math.min((now - start) / FADE_MS, 1);
  if (f >= 1) fading.delete(t);
  pixels[t] = ((Math.round(RIM_ALPHA + ((color >>> 24) - RIM_ALPHA) * f) << 24) | (color & 0xffffff)) >>> 0;
}

// Rebuilds the rim: unowned tiles within RIM_DEPTH of a nation, in the
// nearest nation's color; at RIM_ALPHA on land, solid at sea (sea reached
// straight from the nation's coast, not across unclaimed land).
const rimOwner = new Int16Array(grid.size).fill(-1);
let rimTiles = [];
let rimStale = false; // territory changed since the rim was last rebuilt
let rimAt = 0;
const RIM_MS = 200; // the rim is rebuilt at most this often: it is a soft glow, not worth a rebuild every tick
function paintRim() {
  const { owner } = game;
  const W = grid.width;
  for (const t of rimTiles) {
    rimOwner[t] = -1;
    if (owner[t] < 0) pixels[t] = 0;
    touch(t);
  }
  rimTiles = [];
  let next = [];
  // Claims an unowned neighbour for the rim of owner o.
  const visit = (n, o, fromCoast) => {
    if (owner[n] >= 0 || rimOwner[n] >= 0) return;
    rimOwner[n] = o;
    rimTiles.push(n);
    next.push(n);
    touch(n);
    const alpha = owner[n] === WATER && fromCoast ? 0xff : RIM_ALPHA;
    pixels[n] = ((alpha << 24) | (paints[o] & 0xffffff)) >>> 0;
  };
  let frontier = [];
  for (const n of game.nations) for (const t of n.border) frontier.push(t);
  for (let step = 0; step < RIM_DEPTH; step++) {
    next = [];
    for (const f of frontier) {
      const o = owner[f] >= 0 ? owner[f] : rimOwner[f];
      const fromCoast = owner[f] >= 0 || pixels[f] >>> 24 === 0xff;
      const x = f % W;
      if (x > 0) visit(f - 1, o, fromCoast);
      if (x < W - 1) visit(f + 1, o, fromCoast);
      if (f >= W) visit(f - W, o, fromCoast);
      if (f < grid.size - W) visit(f + W, o, fromCoast);
    }
    frontier = next;
  }
  rimStale = false;
  rimAt = performance.now();
}

// GPU path: the owner texture is uploaded when territory changed, the palette when nations were added.
let gpuPalette = 0;
let gpuUploads = 0;
let gpuKey = "";
function syncGPU(full) {
  if (gpuPalette !== game.nations.length) {
    gpu.setPalette(game.nations.map((n) => n.color));
    gpuPalette = game.nations.length;
  }
  if (full || game.dirty.length) {
    gpu.uploadOwner(game.owner);
    game.dirty.length = 0;
    gpuUploads++;
  }
}
// While the view moves the coast comes from the coarse land mask; once it holds still, the land
// is drawn once for exactly this view (vector coast, pixel for pixel) and the fill is trimmed to that.
let screenMaskView = "";
let screenMask = null;
function drawGPU() {
  const { k, x, y } = viewTransform;
  const still = performance.now() >= zoomingUntil + 150; // held still for 0.3 s: worth a 30-50 ms mask
  const view = `${k}|${x}|${y}|${names.width}|${names.height}`;
  if (still && screenMaskView !== view) {
    screenMask ??= document.createElement("canvas");
    screenMask.width = names.width;
    screenMask.height = names.height;
    const m = screenMask.getContext("2d");
    m.fillStyle = "#000";
    m.fillRect(0, 0, screenMask.width, screenMask.height);
    m.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
    m.beginPath();
    geoPath(projection, m)(landShape);
    m.fillStyle = "#fff";
    m.fill();
    gpu.setScreenLand(screenMask);
    screenMaskView = view;
  }
  const exact = still && screenMaskView === view;
  const key = `${view}|${gpuUploads}|${gpuPalette}|${exact}`;
  if (key === gpuKey) return;
  gpuKey = key;
  gpu.draw(viewTransform, { ratio, offset }, FILL_OPACITY, exact);
}

let gpuOn = !!gpu;
function paintAll() {
  if (gpuOn) {
    gpuPalette = -1;
    syncGPU(true);
    return;
  }
  paintAllCanvas();
}
// Dev: flip between the two renderers on the same game (to compare them).
function toggleGL() {
  if (!gpu) return false;
  gpuOn = !gpuOn;
  canvas.style.display = gpuOn ? "none" : "";
  glCanvas.style.display = gpuOn ? "" : "none";
  gpuKey = "";
  drawnKey = "";
  if (gpuOn) paintAll();
  else paintAllCanvas();
  return gpuOn;
}
function paintAllCanvas() {
  paints = game.nations.map((n) => rgba(n.color, 0xff));
  seenOwner = Int16Array.from(game.owner); // spawn dots appear at once
  for (let t = 0; t < grid.size; t++) paintTile(t, 0);
  game.dirty.length = 0;
  paintRim();
  upload(true);
  paintCount++;
}

function paintDirty() {
  while (paints.length < game.nations.length) paints.push(rgba(game.nations[paints.length].color, 0xff)); // rebel nations
  if (game.dirty.length === 0 && fading.size === 0 && !rimStale) return;
  const now = performance.now();
  paintCount++;
  if (game.dirty.length) rimStale = true;
  for (const t of game.dirty) paintTile(t, now);
  game.dirty.length = 0;
  for (const t of [...fading.keys()]) paintTile(t, now);
  if (rimStale && now - rimAt >= RIM_MS) paintRim();
  upload(false);
}

// --- Canvas drawing: territory, names, boats ---------------------------------

// The territory canvas sits under a blur filter and the panels' backdrop blur, so every redraw
// makes the browser redo both: redraw only when the picture can have changed (about 10 times
// a second with the game running, not every frame).
let clipSet = false; // the coastline clip matches the drawn view
let paintCount = 0; // bumped whenever the territory image changed
let drawnKey = "";
function drawTerritory() {
  const { k, x, y } = viewTransform;
  if (performance.now() < zoomingUntil) {
    // Show the last picture moved to where the view is now (canvas origin is at -PAD).
    const r = k / drawnView.k;
    canvas.style.transformOrigin = "0 0";
    canvas.style.transform = `translate(${PAD - r * (PAD + drawnView.x) + x}px, ${PAD - r * (PAD + drawnView.y) + y}px) scale(${r})`;
    return;
  }
  canvas.style.transform = "";
  const key = `${k}|${x}|${y}|${canvas.width}|${canvas.height}|${dpr}|${game.tick}|${paintCount}`;
  if (key === drawnKey) return;
  drawnKey = key;
  if (drawnView.k !== k || drawnView.x !== x || drawnView.y !== y || !clipSet) {
    landClip.attr("transform", `translate(${PAD},${PAD}) translate(${x},${y}) scale(${k})`);
    updateSmoothing();
    clipSet = true;
  }
  drawnView = { k, x, y };
  tcanvas.setTransform(1, 0, 0, 1, 0, 0);
  tcanvas.clearRect(0, 0, canvas.width, canvas.height);
  tcanvas.setTransform(dpr * k * ratio, 0, 0, dpr * k * ratio, dpr * (k * offset[0] + x + PAD), dpr * (k * offset[1] + y + PAD));
  tcanvas.imageSmoothingEnabled = false; // sharp borders between nations
  tcanvas.drawImage(territory, 0, 0);
  paintBorders(k);
}

// Where each nation's name goes: the deepest point (farthest from its edge)
// of its largest connected piece of land, and how deep that is in tiles.
// Recomputed every 1.5 seconds; it's a few passes over the grid.
const depth = new Int32Array(grid.size);
const piece = new Int32Array(grid.size);
const queue = new Int32Array(grid.size);
let labelSpots = [];
let labelsAt = 0;

function computeLabelSpots() {
  const { owner, nations } = game;
  const W = grid.width;
  const each = (t, fn) => {
    const x = t % W;
    if (x > 0) fn(t - 1);
    if (x < W - 1) fn(t + 1);
    if (t >= W) fn(t - W);
    if (t < grid.size - W) fn(t + W);
  };
  // Distance from the edge of each nation's land, by breadth-first search.
  depth.fill(0);
  let head = 0;
  let tail = 0;
  for (const n of nations) {
    for (const t of n.border) {
      depth[t] = 1;
      queue[tail++] = t;
    }
  }
  while (head < tail) {
    const t = queue[head++];
    each(t, (n) => {
      if (depth[n] === 0 && owner[n] === owner[t]) {
        depth[n] = depth[t] + 1;
        queue[tail++] = n;
      }
    });
  }
  // Connected pieces: keep each nation's largest, and its deepest tile.
  piece.fill(0);
  const best = new Map();
  let id = 0;
  for (let start = 0; start < grid.size; start++) {
    const o = owner[start];
    if (o < 0 || piece[start]) continue;
    piece[start] = ++id;
    let top = 0;
    queue[top++] = start;
    let count = 0;
    let deepest = start;
    while (top > 0) {
      const t = queue[--top];
      count++;
      if (depth[t] > depth[deepest]) deepest = t;
      each(t, (n) => {
        if (!piece[n] && owner[n] === o) {
          piece[n] = id;
          queue[top++] = n;
        }
      });
    }
    if (!best.has(o) || count > best.get(o).count) best.set(o, { nation: nations[o], count, tile: deepest, depth: depth[deepest] });
  }
  labelSpots = [...best.values()];
}

// --- Borders between nations: smooth vector lines ----------------------------
// The tile edges where two nations meet are chained into lines, smoothed into
// curves, and stroked thin on top of the territory.

let borderPath = new Path2D();
// Nation index -> Path2D of the strip along its side of each shared border.
let bandPaths = new Map();
let bordersTick = -1;
// Strip width in tiles: covers the stepped seam between the raster fills.
const BAND = 1.4;
// How far (tiles) a border line runs on past a tile corner at its open ends.
const END_REACH = 1;

// Turns a staircase of tile edges into a smooth curve: cut across each step
// (edge midpoints), then average neighbors a few times. Line ends at
// junctions stay put so lines still meet there; free ends (where the line
// runs out at unowned land or sea) drop the tile corner and smooth like the
// rest, so the line doesn't hook along the last tile edge.
function smoothLine(points, closed, freeStart = false, freeEnd = false) {
  const n = points.length;
  let pts = [];
  if (!closed && !freeStart) pts.push(points[0]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    pts.push([(ax + bx) / 2, (ay + by) / 2]);
  }
  if (!closed && !freeEnd) pts.push(points[n - 1]);
  for (let pass = 0; pass < 4; pass++) {
    const m = pts.length;
    if (m < 3) break;
    pts = pts.map((p, i) => {
      if (!closed && ((i === 0 && !freeStart) || (i === m - 1 && !freeEnd))) return p;
      const a = closed ? pts[(i - 1 + m) % m] : pts[Math.max(i - 1, 0)];
      const c = closed ? pts[(i + 1) % m] : pts[Math.min(i + 1, m - 1)];
      return [(a[0] + p[0] * 2 + c[0]) / 4, (a[1] + p[1] * 2 + c[1]) / 4];
    });
  }
  return pts;
}

function buildBorders() {
  const { owner } = game;
  const W = grid.width;
  const VW = W + 1;
  // Tile-corner graph of edges between two different nations.
  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  };
  // Both tiles of a pair owned by different nations are border tiles, so the border sets are enough.
  for (const n of game.nations) {
    for (const t of n.border) {
      const o = owner[t];
      if (o < 0) continue;
      const x = t % W;
      const y = (t - x) / W;
      if (x < W - 1) {
        const r = owner[t + 1];
        if (r >= 0 && r !== o) link(y * VW + x + 1, (y + 1) * VW + x + 1);
      }
      if (t + W < grid.size) {
        const b = owner[t + W];
        if (b >= 0 && b !== o) link((y + 1) * VW + x, (y + 1) * VW + x + 1);
      }
    }
  }
  // Chain edges into lines, breaking at junctions.
  const used = new Set();
  const key = (a, b) => (a < b ? a * 4e6 + b : b * 4e6 + a);
  const point = (v) => [v % VW, Math.floor(v / VW)];
  const path = new Path2D();
  const trace = (start, next) => {
    const verts = [start];
    let prev = start;
    let cur = next;
    used.add(key(start, next));
    for (;;) {
      verts.push(cur);
      const around = adj.get(cur);
      if (cur === start || around.length !== 2) break;
      const nxt = around[0] === prev ? around[1] : around[0];
      if (used.has(key(cur, nxt))) break;
      used.add(key(cur, nxt));
      prev = cur;
      cur = nxt;
    }
    const closed = verts.length > 2 && verts[0] === verts.at(-1);
    const raw = verts.map(point);
    if (closed) raw.pop();
    // Ends where the line runs out at unowned land or sea.
    const isOpen = (v) => {
      const x = v % VW;
      const y = Math.floor(v / VW);
      return [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]].some(([tx, ty]) => tx < 0 || ty < 0 || tx >= W || owner[ty * W + tx] < 0);
    };
    const openStart = !closed && isOpen(verts[0]);
    const openEnd = !closed && isOpen(verts.at(-1));
    const pts = raw.length > 2 ? smoothLine(raw, closed, openStart, openEnd) : raw.slice();
    // There the territory's smoothed edge lies a little beyond the tiles:
    // run the line (and the color strips) to the last tile corner, then on
    // past that edge in the direction of the last few tile edges, so each
    // nation's strip stays on its own side of the tiles. The territory
    // filter cuts it to shape.
    const extend = (ends, rawEnds) => {
      const [vx, vy] = rawEnds[0];
      const [bx, by] = rawEnds[Math.min(3, rawEnds.length - 1)];
      const len = Math.hypot(vx - bx, vy - by) || 1;
      ends.unshift([vx, vy]);
      ends.unshift([vx + ((vx - bx) / len) * END_REACH, vy + ((vy - by) / len) * END_REACH]);
    };
    if (openStart) extend(pts, raw);
    if (openEnd) {
      pts.reverse();
      extend(pts, raw.slice().reverse());
      pts.reverse();
    }
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
    if (closed) path.closePath();

    // Which nation is on each side: look half a tile either side of the
    // first edge, along its normal (-dy, dx).
    const [ax, ay] = raw[0];
    const [bx, by] = raw[1];
    const [nx, ny] = [-(by - ay), bx - ax];
    const ownerAt = (px, py) => owner[Math.floor(py) * W + Math.floor(px)];
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const sides = [
      [ownerAt(mx + nx * 0.5, my + ny * 0.5), 1],
      [ownerAt(mx - nx * 0.5, my - ny * 0.5), -1],
    ];
    // Each nation's strip: the line offset half a strip toward its side.
    const m = pts.length;
    const normals = pts.map((p, i) => {
      const a = pts[closed ? (i - 1 + m) % m : Math.max(i - 1, 0)];
      const c = pts[closed ? (i + 1) % m : Math.min(i + 1, m - 1)];
      const tx = c[0] - a[0];
      const ty = c[1] - a[1];
      const len = Math.hypot(tx, ty) || 1;
      return [-ty / len, tx / len];
    });
    for (const [o, sign] of sides) {
      if (o === undefined || o < 0) continue;
      if (!bands.has(o)) bands.set(o, new Path2D());
      const band = bands.get(o);
      const d = (sign * BAND) / 2;
      pts.forEach(([px, py], i) => {
        const [qx, qy] = [px + normals[i][0] * d, py + normals[i][1] * d];
        if (i === 0) band.moveTo(qx, qy);
        else band.lineTo(qx, qy);
      });
      if (closed) band.closePath();
    }
  };
  const bands = new Map();
  // Open lines start at junctions and ends; whatever is left is a loop.
  for (const pass of [true, false]) {
    for (const [v, around] of adj) {
      if (pass && around.length === 2) continue;
      for (const u of around) if (!used.has(key(v, u))) trace(v, u);
    }
  }
  borderPath = path;
  bandPaths = bands;
}

// Border lines and color strips are painted into the territory image itself,
// only over pixels that already have territory or rim ("source-atop" keeps
// their alpha). The territory filter then shapes, fills and clips them in the
// same pass as the fill, so they end exactly where the color ends.
function paintBorders(k) {
  if (game.tick !== bordersTick) {
    buildBorders();
    bordersTick = game.tick;
  }
  tcanvas.save();
  tcanvas.globalCompositeOperation = "source-atop";
  // Strips of each nation's color on its side, so colors change exactly on the line.
  tcanvas.lineWidth = BAND;
  tcanvas.lineJoin = "round";
  tcanvas.lineCap = "butt";
  for (const [o, band] of bandPaths) {
    tcanvas.strokeStyle = game.nations[o].color;
    tcanvas.stroke(band);
  }
  // Shown at the fill's opacity over the land, like the fill.
  tcanvas.lineWidth = Math.max(1.3, Math.min(k * ratio * 0.45, 2.4)) / (k * ratio);
  tcanvas.strokeStyle = "rgb(15, 15, 25)";
  tcanvas.stroke(borderPath);
  tcanvas.restore();
}

// Each nation's name sits on its land, growing with it; troops underneath.
// Bigger names win where two would overlap.
function drawNames() {
  if (performance.now() - labelsAt > 1500) {
    computeLabelSpots();
    labelsAt = performance.now();
  }
  const tilePx = viewTransform.k * ratio;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const boxes = [];
  const spots = labelSpots
    .filter((s) => s.nation.alive && game.owner[s.tile] === s.nation.index)
    .map((s) => {
      const reach = s.depth * tilePx; // half-width of open land around the spot
      return { ...s, size: Math.min((reach * 2.1) / (0.6 * s.nation.name.length), reach * 0.95, 34) };
    })
    .filter((s) => s.size >= 11)
    .sort((a, b) => b.size - a.size);
  for (const { nation: n, tile, size } of spots) {
    const [sx, sy] = toScreen((tile % grid.width) + 0.5, Math.floor(tile / grid.width) + 0.5);
    const half = (0.6 * size * n.name.length) / 2;
    const box = [sx - half, sy - size * 0.6, sx + half, sy + size * 1.3];
    if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    boxes.push(box);
    const mine = n.index === game.player;
    ctx.font = `700 ${size}px Georgia, "Times New Roman", serif`;
    ctx.lineWidth = Math.max(2, size * 0.2);
    ctx.strokeStyle = mine ? "rgba(12, 35, 90, 0.85)" : "rgba(255, 255, 255, 0.75)";
    ctx.fillStyle = mine ? "#fff" : "rgba(28, 32, 40, 0.9)";
    ctx.strokeText(n.name, sx, sy);
    ctx.fillText(n.name, sx, sy);
    const small = size * 0.62;
    if (small >= 7) {
      ctx.font = `600 ${small}px system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, small * 0.25);
      // The army: what a rival would have to fight through.
      ctx.strokeText(compact.format(army(n)), sx, sy + size * 0.85);
      ctx.fillText(compact.format(army(n)), sx, sy + size * 0.85);
    }
  }
}

// Cities: a small marker in the owner's color, ringed white.
function drawCities() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = Math.min(3 + viewTransform.k * 0.4, 7);
  for (const t of game.cities) {
    const o = game.owner[t];
    if (o < 0) continue;
    const [x, y] = toScreen((t % grid.width) + 0.5, Math.floor(t / grid.width) + 0.5);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(20, 25, 35, 0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(x - r, y - r, r * 2, r * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = game.nations[o].color;
    ctx.fillRect(x - r * 0.55, y - r * 0.55, r * 1.1, r * 1.1);
  }
}

// Boats sail their sea route; the rest of the route trails ahead as a dashed line.
let riverPath = null;
// Rivers, canals and straits: fixed map features drawn under the lanes.
function drawFeatures() {
  if (!grid) return;
  const k = viewTransform.k * ratio;
  const ox = viewTransform.k * offset[0] + viewTransform.x;
  const oy = viewTransform.k * offset[1] + viewTransform.y;
  if (!riverPath) {
    riverPath = [new Path2D(), new Path2D()]; // small rivers, big rivers (the ones that block land fronts)
    for (const line of riverData) {
      const path = riverPath[line[0]];
      for (let i = 1; i < line.length; i += 2) {
        const [gx, gy] = grid.projection([line[i], line[i + 1]]);
        if (i > 1) path.lineTo(gx, gy);
        else path.moveTo(gx, gy);
      }
    }
  }
  ctx.save();
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(40, 105, 175, 0.85)";
  ctx.lineWidth = Math.min(1.5 / k, 0.9);
  ctx.stroke(riverPath[0]);
  ctx.stroke(riverPath[1]);
  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "italic 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const c of CANALS) {
    const [ax, ay] = toScreen(...grid.projection(c.a));
    const [bx, by] = toScreen(...grid.projection(c.b));
    ctx.strokeStyle = "#1f6fb5";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.fillStyle = "rgba(20, 60, 110, 0.85)";
    if (viewTransform.k >= 2) ctx.fillText(c.name, (ax + bx) / 2, Math.min(ay, by) - 6);
  }
  for (const st of STRAITS) {
    const [x, y] = toScreen(...grid.projection(st.at));
    ctx.strokeStyle = "rgba(20, 60, 110, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(20, 60, 110, 0.8)";
    if (viewTransform.k >= 2.5) ctx.fillText(st.name, x, y - 7);
  }
}

function drawLanes() {
  if (!game.lanes) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const used = new Set(game.routes.filter((r) => routeState(game, r).state === "open").map((r) => r.lane));
  const mine = new Set(routesOf(game, game.player).map((r) => r.lane));
  for (const lane of game.lanes) {
    const points = lane.pts.map(([gx, gy]) => toScreen(gx, gy));
    ctx.setLineDash(used.has(lane.id) ? [8, 5] : [2, 6]);
    ctx.strokeStyle = mine.has(lane.id) ? "rgba(31, 95, 214, 0.85)" : used.has(lane.id) ? "rgba(150, 90, 20, 0.55)" : "rgba(40, 60, 90, 0.3)";
    ctx.lineWidth = mine.has(lane.id) ? 2 : 1.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const c of lane.chokes) {
      const [x, y] = toScreen(c.pt[0], c.pt[1]);
      ctx.fillStyle = c.holder >= 0 ? game.nations[c.holder].color : "rgba(40, 60, 90, 0.5)";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawBoats(alpha) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const boat of game.boats) {
    const span = Math.max(boat.arriveTick - boat.departTick, 1);
    const t = Math.min((game.tick + alpha - boat.departTick) / span, 1);
    const points = boat.route.map(([gx, gy]) => toScreen(gx, gy));
    const legs = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
    let along = t * legs.reduce((a, b) => a + b, 0);
    let leg = 0;
    while (leg < legs.length - 1 && along > legs[leg]) along -= legs[leg++];
    const f = legs[leg] ? Math.min(along / legs[leg], 1) : 1;
    const [ax, ay] = points[leg];
    const [bx, by] = points[leg + 1] ?? points[leg];
    const [x, y] = [ax + (bx - ax) * f, ay + (by - ay) * f];
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(20, 50, 80, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (const p of points.slice(leg + 1)) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = game.nations[boat.attacker].color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// --- HUD and end screen -------------------------------------------------------

function mount(selection, key, html) {
  if (selection.attr("data-key") === key) return;
  selection.attr("data-key", key).html(html);
}

function fill(selection, fields) {
  selection.selectAll("[data-f]").each(function () {
    const value = fields[this.dataset.f];
    if (value !== undefined && this.textContent !== value) this.textContent = value;
  });
}

// Stat icons for the bottom bar (24px grid, drawn with strokes).
const ICONS = {
  pop: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.9.1 5 2.2 5 5.3"/>',
  army: '<path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z"/><path d="M12 8v8M9 11h6"/>',
  workers: '<path d="M14.5 4.5l5 5-2 2-5-5z"/><path d="M13 8L4.5 16.5a2 2 0 0 0 3 3L16 11"/>',
  gold: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2.1 0 3 5.8 1.5 5.8 4.3 0 1.2-1.2 2.1-3 2.1-1.2 0-2.3-.5-2.9-1.4M12 6.5v1.3M12 16.2v1.3"/>',
  food: '<path d="M12 21V8"/><path d="M12 8c0-2.5 1-4 2-5 1 1 2 2.500 2 5s-1 4-2 5c-1-1-2-2.5-2-5z"/><path d="M12 12c-2.500 0-4-1-5-2 1-1 2.500-2 5-2M12 16.500c-2.500 0-4-1-5-2 1-1 2.500-2 5-2M12 12c2.500 0 4-1 5-2-1-1-2.500-2-5-2M12 16.500c2.500 0 4-1 5-2-1-1-2.500-2-5-2"/>',
  land: '<path d="M3 19l6-10 4 6 2.500-4L21 19z"/><path d="M3 19h18"/>',
  rivals: '<path d="M4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/><path d="M4 20h16"/>',
  market: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
};
const BAR_ITEMS = [
  ["pop", "Population"],
  ["army", "Army"],
  ["workers", "Workers"],
  ["gold", "Gold"],
  ["food", "Food"],
  ["steel", "Steel"],
  ["market", "Food market price"],
  ["land", "Land (to win)"],
  ["rivals", "Rivals left"],
];
ICONS.share = '<path d="M12 4v16M5 7h14"/><path d="M5 7l-2.500 6a3 3 0 0 0 5 0zM19 7l-2.500 6a3 3 0 0 0 5 0z"/>';
ICONS.ratio = '<path d="M5 19L19 5M14 5h5v5"/><path d="M6 14l4 4"/>';
ICONS.goal = '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>';
ICONS.hold = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
ICONS.steel = '<path d="M4 16l3-7h10l3 7z"/><path d="M4 16v3h16v-3"/>';
ICONS.factory = '<path d="M3 20V10l5 3V10l5 3V6h4v14z"/>';
ICONS.armyup = '<path d="M12 3l7 3v5.5c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z"/><path d="M12 15V9M9 12l3-3 3 3"/>';
ICONS.city = '<path d="M12 20V6M6 12l6-6 6 6"/><path d="M5 20h14"/>';
function renderBar() {
  bar.classed("hidden", game.phase === "picking");
  if (game.phase === "picking") return;
  const me = game.nations[game.player];
  const icon = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg>`;
  mount(
    bar,
    "stats",
    `<div class="row">${BAR_ITEMS.map(
      ([id, label]) =>
        id === "market"
          ? `<div class="stat ctl market-open" data-action="market" aria-label="${label}">${icon(id)}<span data-f="market"></span><span class="tip" data-f="marketTip"></span></div>`
          : id === "food" || id === "steel"
            ? `<div class="stat ctl" aria-label="${label}">${icon(id)}<span data-f="${id}"></span><span class="tip" data-f="${id}Tip"></span></div>`
            : `<div class="stat" title="${label}" aria-label="${label}">${icon(id)}<span data-f="${id}"></span></div>`
    ).join("")}</div>
    <div class="row">
      <label class="stat ctl">${icon("share")}<input data-input="share" type="range" min="${RULES.minArmyShare * 100}" max="100" step="5" value="${Math.round(me.armyShare * 100)}" aria-label="Army share" /><span data-f="share"></span><span class="tip" data-f="shareTip"></span></label>
      <label class="stat ctl">${icon("ratio")}<input data-input="ratio" type="range" min="5" max="100" step="5" value="${attackRatio * 100}" aria-label="Attack size" /><span data-f="ratio"></span><span class="tip" data-f="ratioTip"></span></label>
      <label class="stat ctl">${icon("goal")}<select data-input="goal" aria-label="Land to take">${[["any", "No limit"], ["p10", "10% of their land"], ["p25", "25% of their land"], ["p50", "50% of their land"], ["p75", "75% of their land"]]
        .map(([v, label]) => `<option value="${v}"${v === landGoal ? " selected" : ""}>${label}</option>`)
        .join("")}</select><span class="tip" data-f="goalTip"></span></label>
      <div class="stat ctl"><button class="stat pause" data-action="hold" aria-label="Pause expansion">${icon("hold")}</button><span class="tip" data-f="holdTip"></span></div>
      <div class="stat ctl"><button class="stat upgrade" data-action="market" aria-label="Open the market">${icon("market")}<span>Market</span></button><span class="tip">Market: buy and sell food and steel, borrow and lend gold, allies and trade routes.</span></div>
      <div class="stat ctl"><button class="stat upgrade" data-action="factory" aria-label="Build a factory">${icon("factory")}<span data-f="factoryCost"></span></button><span class="tip" data-f="factoryTip"></span></div>
      <div class="stat ctl"><button class="stat upgrade" data-action="armyup" aria-label="Upgrade the army">${icon("armyup")}<span data-f="armyCost"></span></button><span class="tip" data-f="armyTip"></span></div>
      <div class="stat ctl"><button class="stat upgrade" data-action="city" aria-label="Upgrade population cap">${icon("city")}<span data-f="cityCost"></span></button><span class="tip" data-f="cityTip"></span></div>
    </div>`
  );
  bar.select("[data-input=share]").on("input", (event) => (me.armyShare = event.target.value / 100));
  bar.select("[data-input=ratio]").on("input", (event) => (attackRatio = event.target.value / 100));
  bar.select("[data-input=goal]").on("change", (event) => (landGoal = event.target.value));
}
bar.on("click", (event) => {
  if (event.target.closest("[data-action=market]")) {
    marketOpen = !marketOpen;
    renderMarket();
  }
  if (event.target.closest("[data-action=city]")) setPlacingCity(true);
  const act = (reason) => reason && logEvent(game, reason);
  if (event.target.closest("[data-action=factory]")) act(buildFactory(game, game.player));
  if (event.target.closest("[data-action=armyup]")) act(upgradeArmy(game, game.player));
  if (event.target.closest("[data-action=hold]")) {
    const me = game.nations[game.player];
    setHoldExpansion(game, me.index, !me.holdExpansion);
  }
});

// --- Market panel: sell and buy food, borrow and lend gold ----------------------

let marketOpen = false;
let marketTab = "market";
let marketMsg = "";
const dueIn = (loan) => {
  const s = Math.max(0, Math.round((loan.due - game.tick) / RULES.ticksPerSecond));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const marketInput = (name) => +marketEl.select(`[data-input="${name}"]`).property("value") || 0;

function renderMarket() {
  const show = marketOpen && game.phase === "playing";
  marketEl.classed("hidden", !show);
  if (!show) return;
  const me = game.nations[game.player];
  const m = game.market;
  const offers = listOffers(game, me);
  const owe = game.loans.filter((l) => l.borrower === me.index);
  const owedToMe = game.loans.filter((l) => l.lender === me.index);
  const others = game.nations.filter((n) => n.alive && n.index !== me.index);
  const allies = alliesOf(game, me.index);
  const props = game.proposals;
  const strangers = others.filter((n) => !allies.includes(n.index));
  const myRoutes = routesOf(game, me.index);
  const lanesIn = (game.lanes ?? []).filter((l) => hasAccess(l, me.index));
  const routeOptions = lanesIn.flatMap((l) => [...l.access.keys()].filter((o) => o !== me.index && game.nations[o].alive && hasAccess(l, o) && !myRoutes.some((r) => r.a === o || r.b === o)).map((o) => [l.id, o, l.name]));
  routeOptions.sort((a, b) => game.nations[b[1]].tiles - game.nations[a[1]].tiles);
  const key = [marketTab, myRoutes.map((r) => r.id).join(), routeOptions.length, allies.join(), props.map((p) => p.id).join(), strangers.length, offers.map((o) => o.lender).join(), owe.map((l) => l.id).join(), owedToMe.map((l) => l.id).join(), others.length].join("|");
  const tabs = [["market", "Market"], ["loans", "Loans"], ["allies", "Allies"], ["routes", "Routes"]];
  const pays = (l) => `<div class="m-row"><span data-f="l-${l.id}"></span>
      <span class="m-btns"><button data-pay="${l.id}" data-frac="0.25">25%</button><button data-pay="${l.id}" data-frac="0.5">50%</button><button data-pay="${l.id}" data-frac="1">All</button></span>
      <span class="m-btns"><input data-input="pay-${l.id}" type="number" min="0" placeholder="gold" /><button data-pay="${l.id}" data-frac="custom">Pay</button></span></div>`;
  const body =
    marketTab === "market"
      ? `<p data-f="mPrice"></p><p class="muted" data-f="mStock"></p><p class="muted" data-f="mTax"></p>
        <h3>Sell food</h3><p class="muted" data-f="mFood"></p>
        <div class="m-btns"><button data-sell="0.25">25%</button><button data-sell="0.5">50%</button><button data-sell="1">All</button></div>
        <div class="m-btns"><input data-input="sell-amt" type="number" min="0" placeholder="food" /><button data-sell="custom">Sell</button></div>
        <p class="muted" data-f="mSellHint"></p>
        <h3>Buy food</h3>
        <div class="m-btns"><button data-buy="0.25">25%</button><button data-buy="0.5">50%</button><button data-buy="1">Max</button></div>
        <div class="m-btns"><input data-input="buy-amt" type="number" min="0" placeholder="food" /><button data-buy="custom">Buy</button></div>
        <p class="muted" data-f="mBuyHint"></p>
        <h3>Steel</h3><p data-f="mSteel"></p>
        <div class="m-btns"><input data-input="steel-amt" type="number" min="0" placeholder="steel" /><button data-steel="buy">Buy</button><button data-steel="sell">Sell</button></div>`
      : marketTab === "loans"
        ? `<h3>Offers to you</h3>
          ${offers.length ? offers.map((o) => `<div class="m-row"><span>${o.name}: <span data-f="o-${o.lender}"></span></span><button data-borrow="${o.lender}">Borrow</button></div>`).join("") : `<p class="muted" data-f="mNoOffers"></p>`}
          <div class="m-btns"><input data-input="borrow-amt" type="number" min="0" placeholder="gold to borrow" /></div>
          <h3>You owe</h3>
          ${owe.length ? owe.map(pays).join("") : `<p class="muted">Nothing.</p>`}
          <h3>Owed to you</h3>
          ${owedToMe.length ? owedToMe.map((l) => `<div class="m-row"><span data-f="l-${l.id}"></span></div>`).join("") : `<p class="muted">Nothing.</p>`}
          <h3>Lend</h3>
          <div class="m-btns"><select data-input="lend-to">${others.map((n) => `<option value="${n.index}">${n.name}</option>`).join("")}</select></div>
          <div class="m-btns"><input data-input="lend-amt" type="number" min="0" placeholder="gold" /><input data-input="lend-rate" type="number" min="0" max="60" value="10" title="Interest %" /><button data-lend>Lend</button></div>
          <h3>Standing offer</h3>
          <label class="m-check"><input data-input="offer-on" type="checkbox"${me.offer.on ? " checked" : ""} /> Let nations in trouble borrow from me</label>
          <div class="m-btns"><label>Interest % <input data-input="offer-rate" type="number" min="0" max="60" value="${Math.round(me.offer.rate * 100)}" /></label><label>Up to % of my gold <input data-input="offer-max" type="number" min="1" max="100" value="${Math.round(me.offer.max * 100)}" /></label></div>`
        : marketTab === "routes"
          ? `<h3>Your routes</h3>
          ${myRoutes.length ? myRoutes.map((r) => { const o = r.a === me.index ? r.b : r.a; return `<div class="m-row"><span>${game.nations[o].name}: <span data-f="rt-${r.id}"></span></span><span class="m-btns"><button data-rtbuy="${o}" data-good="food">Buy food</button><button data-rtbuy="${o}" data-good="steel">Buy steel</button><button data-rtclose="${r.id}" class="secondary">Close</button></span></div>`; }).join("") : `<p class="muted" data-f="mNoRoutes"></p>`}
          <div class="m-btns"><input data-input="route-amt" type="number" min="0" placeholder="amount to buy" /></div>
          <h3>Open a route</h3>
          ${routeOptions.length ? `<div class="m-btns"><select data-input="route-pick">${routeOptions.slice(0, 40).map(([lane, o, laneName]) => `<option value="${lane}:${o}">${game.nations[o].name} · ${laneName}</option>`).join("")}</select><button data-ropen>Open</button></div>` : `<p class="muted">No other nation shares a lane with your coast.</p>`}
          <p class="muted">Both sides earn gold while the route is open and can buy food and steel from each other at market price, no tax. A nation holding a chokepoint takes ${Math.round(RULES.routeToll * 100)}% of each side's income. War closes a route.</p>`
          : `<h3>Proposals to you</h3>
          ${props.length ? props.map((p) => `<div class="m-row"><span>${game.nations[p.from].name} proposes an alliance</span><span class="m-btns"><button data-answer="${p.id}" data-yes="1">Accept</button><button data-answer="${p.id}">Decline</button></span></div>`).join("") : `<p class="muted">None.</p>`}
          <h3>Your allies</h3>
          ${allies.length ? allies.map((a) => `<div class="m-row"><span>${game.nations[a].name}: <span data-f="al-${a}"></span></span><span class="m-btns"><input data-input="ask-${a}" type="number" min="0" placeholder="food" /><button data-ask="${a}">Ask for food</button><button data-break="${a}" class="secondary">End</button></span></div>`).join("") : `<p class="muted">No allies. Allies do not attack you, help in wars and sell food outside the market.</p>`}
          <h3>Propose an alliance</h3>
          <div class="m-btns"><select data-input="ally-to">${strangers.map((n) => `<option value="${n.index}">${n.name}</option>`).join("")}</select><button data-propose>Propose</button></div>
          <h3>Your food deal for allies</h3>
          <label class="m-check"><input data-input="deal-on" type="checkbox"${me.allyOffer.on ? " checked" : ""} /> Sell spare food to allies who ask</label>
          <div class="m-btns"><label>Discount % off market price (100 = free) <input data-input="deal-discount" type="number" min="0" max="100" value="${Math.round(me.allyOffer.discount * 100)}" /></label></div>`;
  mount(
    marketEl,
    key,
    `<div class="m-head"><div class="m-tabs">${tabs.map(([id, label]) => `<button data-tab="${id}" class="${id === marketTab ? "on" : ""}">${label}</button>`).join("")}</div><button class="close" data-close aria-label="Close">×</button></div>
    ${body}<p class="m-msg" data-f="msg"></p>`
  );
  const past = m.history.at(-2);
  const trend = past ? (m.price > past.price + 0.05 ? " ▲" : m.price < past.price - 0.05 ? " ▼" : "") : "";
  const sellTax = sellTaxRate(me);
  const unit = m.price * (1 + RULES.marketBuyTax);
  const room = Math.max(0, foodStore(me) - me.food);
  const buyMax = Math.max(0, Math.min(m.stock ?? 0, me.gold / unit, room));
  const fields = {
    mPrice: `Price ${m.price.toFixed(2)} gold per food${trend}`,
    mStock: `Stock ${compact.format(m.stock ?? 0)} of ${compact.format(m.target)} · ${m.queue.length} waiting to buy`,
    mTax: `You pay ${Math.round(sellTax * 100)}% tax when selling and ${Math.round(RULES.marketBuyTax * 100)}% when buying`,
    mFood: `You have ${compact.format(me.food)} own food${me.allyFood >= 1 ? ` and ${compact.format(me.allyFood)} from allies (${compact.format(me.allySellable)} sellable)` : ""}, and ${compact.format(me.gold)} gold`,
    mSellHint: `Selling all pays ${compact.format((me.food + me.allySellable) * m.price * (1 - sellTax))} gold after tax`,
    mBuyHint: `You can buy up to ${compact.format(buyMax)} food for ${compact.format(buyMax * unit)} gold`,
    mNoOffers: isBannedNow(me) ? "You can not borrow right now: you defaulted on a loan." : "No nation is offering you a loan right now.",
    mSteel: `Steel ${game.steel.price.toFixed(0)} gold each (${Math.round(RULES.steelFee * 100)}% fee), stock ${compact.format(game.steel.stock ?? 0)}. You have ${compact.format(me.steel)}.`,
    msg: marketMsg,
    mNoRoutes: lanesIn.length ? `You have no routes. Your coast touches ${lanesIn.map((l) => l.name).join(", ")}.` : "Your coast does not touch a trade lane yet.",
    ...Object.fromEntries(myRoutes.map((r) => { const st = routeState(game, r); return [`rt-${r.id}`, `${st.state === "open" ? `open, +${st.income.toFixed(1)} gold/s${st.holders.length ? `, toll to ${st.holders.map((h) => game.nations[h].name).join(" and ")}` : ""}` : st.state === "blockaded" ? "blockaded" : "cut: coast lost"} (${game.lanes.find((l) => l.id === r.lane).name})`]; })),
    ...Object.fromEntries(allies.map((a) => { const d = allyDeal(game, game.nations[a]); return [`al-${a}`, d.on ? `${d.discount >= 1 ? "gives food free" : `sells at ${Math.round(d.discount * 100)}% off`}, ${compact.format(d.spare)} to spare` : "does not sell food"]; })),
    ...Object.fromEntries(offers.map((o) => [`o-${o.lender}`, `up to ${compact.format(o.amount)} gold at ${Math.round(o.rate * 100)}% interest`])),
    ...Object.fromEntries(
      [...owe, ...owedToMe].map((l) => [
        `l-${l.id}`,
        `${game.nations[l.borrower === me.index ? l.lender : l.borrower].name}: ${compact.format(l.owed)} gold ${l.borrower === me.index ? "owed" : "owes you"}, ${l.defaulted ? "overdue" : `due in ${dueIn(l)}`}`,
      ])
    ),
  };
  fill(marketEl, fields);
}
const isBannedNow = (n) => game.tick < n.creditBanUntil;

marketEl.on("click", (event) => {
  const me = game.nations[game.player];
  const m = game.market;
  const hit = (sel) => event.target.closest(sel);
  const say = (text) => {
    marketMsg = text ?? "";
    renderMarket();
  };
  let el;
  if (hit("[data-close]")) {
    marketOpen = false;
    return renderMarket();
  }
  if ((el = hit("[data-tab]"))) {
    marketTab = el.dataset.tab;
    marketMsg = "";
    return renderMarket();
  }
  if ((el = hit("[data-sell]"))) {
    const frac = el.dataset.sell === "custom" ? Math.min(1, marketInput("sell-amt") / Math.max(1, me.food)) : +el.dataset.sell;
    return say(sellShare(game, me.index, frac) >= 1 ? "Sold." : "Nothing to sell.");
  }
  if ((el = hit("[data-buy]"))) {
    const unit = m.price * (1 + RULES.marketBuyTax);
    const max = Math.max(0, Math.min(m.stock ?? 0, me.gold / unit, foodStore(me) - me.food));
    const amount = el.dataset.buy === "custom" ? marketInput("buy-amt") : max * +el.dataset.buy;
    return say(buyFood(game, me.index, amount) >= 1 ? "Bought." : max < 1 ? "The market has no food you can afford or store." : "Too small.");
  }
  if ((el = hit("[data-rtclose]"))) {
    closeRoute(game, +el.dataset.rtclose);
    return say("");
  }
  if ((el = hit("[data-rtbuy]"))) return say(routeTrade(game, me.index, +el.dataset.rtbuy, el.dataset.good, marketInput("route-amt")) ?? "Bought.");
  if (hit("[data-ropen]")) {
    const [lane, o] = marketEl.select("[data-input=route-pick]").property("value").split(":");
    return say(openRoute(game, me.index, +o, lane) ?? "Route opened.");
  }
  if ((el = hit("[data-steel]"))) {
    const amount = marketInput("steel-amt");
    const got = el.dataset.steel === "buy" ? buySteel(game, me.index, amount) : sellSteel(game, me.index, amount);
    return say(got >= 0.5 ? "Done." : "Nothing traded: check the stock, your steel and your gold.");
  }
  if ((el = hit("[data-answer]"))) return say(answerProposal(game, +el.dataset.answer, !!el.dataset.yes) ?? (el.dataset.yes ? "Allied." : "Declined."));
  if ((el = hit("[data-ask]"))) return say(askAlly(game, me.index, +el.dataset.ask, marketInput(`ask-${el.dataset.ask}`)) ?? "Done: the food is yours.");
  if ((el = hit("[data-break]"))) {
    breakAlliance(game, me.index, +el.dataset.break);
    return say("");
  }
  if (hit("[data-propose]")) {
    const to = +marketEl.select("[data-input=ally-to]").property("value");
    return say(proposeAlliance(game, me.index, to) ?? (isAllied(game, me.index, to) ? "Allied." : "Proposal sent."));
  }
  if ((el = hit("[data-borrow]"))) {
    const reason = takeLoan(game, me.index, +el.dataset.borrow, marketInput("borrow-amt") || Infinity);
    return say(reason ?? "Loan taken. You decide when to pay it back; it falls due in 10 minutes.");
  }
  if ((el = hit("[data-pay]"))) {
    const loan = game.loans.find((l) => l.id === +el.dataset.pay);
    if (!loan) return say("");
    const amount = el.dataset.frac === "custom" ? marketInput(`pay-${loan.id}`) : loan.owed * +el.dataset.frac;
    return say(repayLoan(game, loan.id, amount) > 0 ? "Paid." : "You have no gold to pay with.");
  }
  if (hit("[data-lend]")) {
    const reason = lendTo(game, me.index, +marketEl.select("[data-input=lend-to]").property("value"), marketInput("lend-amt"), marketInput("lend-rate") / 100);
    return say(reason ?? "Lent.");
  }
});
marketEl.on("change", (event) => {
  const me = game.nations[game.player];
  const name = event.target.dataset.input;
  if (name === "offer-on") setOffer(game, me.index, { on: event.target.checked });
  if (name === "offer-rate") setOffer(game, me.index, { rate: Math.min(0.6, Math.max(0, +event.target.value / 100)) });
  if (name === "deal-on") setAllyOffer(game, me.index, { on: event.target.checked });
  if (name === "deal-discount") setAllyOffer(game, me.index, { discount: Math.min(1, Math.max(0, +event.target.value / 100)) });
  if (name === "offer-max") setOffer(game, me.index, { max: Math.min(1, Math.max(0.01, +event.target.value / 100)) });
});

// --- Nation panel: right-click a nation to trade, ally or help it ------------------

const nationEl = select("#nation");
let nationShown = -1; // index of the nation the panel is about, or -1
let nationMsg = "";
const nationInput = (name) => +nationEl.select(`[data-input="${name}"]`).property("value") || 0;
const atWarWith = (a, b) => game.attacks.some((x) => (x.attacker === a && x.target === b) || (x.attacker === b && x.target === a));

function openNation(index, x, y) {
  nationShown = index;
  nationMsg = "";
  nationEl.attr("data-key", "");
  renderNation();
  // Next to the click, but clear of the bottom bar and the screen edges.
  const height = nationEl.node().offsetHeight;
  nationEl.style("left", `${Math.max(8, Math.min(x + 12, window.innerWidth - 348))}px`).style("top", `${Math.max(8, Math.min(y - 10, window.innerHeight - height - 100))}px`);
}
function closeNation() {
  nationShown = -1;
  renderNation();
}

function renderNation() {
  const them = game.nations[nationShown];
  const show = nationShown >= 0 && game.phase === "playing" && them?.alive;
  nationEl.classed("hidden", !show);
  if (!show) {
    nationShown = -1;
    return;
  }
  const me = game.nations[game.player];
  const allied = isAllied(game, me.index, them.index);
  const proposal = game.proposals.find((p) => p.from === them.index && p.to === me.index);
  const offer = listOffers(game, me).find((o) => o.lender === them.index);
  const owe = game.loans.filter((l) => l.borrower === me.index && l.lender === them.index);
  const owed = game.loans.filter((l) => l.lender === me.index && l.borrower === them.index);
  const route = routesOf(game, me.index).find((r) => r.a === them.index || r.b === them.index);
  const lanes = (game.lanes ?? []).filter((l) => hasAccess(l, me.index) && hasAccess(l, them.index));
  const key = [them.index, allied, proposal?.id, !!offer, owe.map((l) => l.id).join(), owed.map((l) => l.id).join(), route?.id, lanes.length].join("|");
  mount(
    nationEl,
    key,
    `<div class="m-head"><strong style="color:${them.color}">${them.name}</strong><button class="close" data-close aria-label="Close">×</button></div>
    <p class="muted" data-f="nInfo"></p>
    <h3>Alliance</h3>
    ${proposal ? `<div class="m-btns"><button data-n-answer="${proposal.id}" data-yes="1">Accept their proposal</button><button data-n-answer="${proposal.id}" class="secondary">Decline</button></div>` : allied ? `<div class="m-btns"><button data-n-break class="secondary">End the alliance</button></div>` : `<div class="m-btns"><button data-n-propose>Propose an alliance</button></div>`}
    <h3>Food</h3>
    <p class="muted" data-f="nFood"></p>
    <div class="m-btns"><button data-n-give="food" data-frac="0.1">Send 10%</button><button data-n-give="food" data-frac="0.25">25%</button><button data-n-give="food" data-frac="0.5">50%</button></div>
    <div class="m-btns"><input data-input="n-food" type="number" min="0" placeholder="food" /><button data-n-give="food" data-frac="custom">Send</button><button data-n-ask>Ask for food</button></div>
    <h3>Gold</h3>
    <div class="m-btns"><button data-n-give="gold" data-frac="0.1">Send 10%</button><button data-n-give="gold" data-frac="0.25">25%</button><button data-n-give="gold" data-frac="0.5">50%</button></div>
    <div class="m-btns"><input data-input="n-gold" type="number" min="0" placeholder="gold" /><button data-n-give="gold" data-frac="custom">Send</button></div>
    <h3>Loans</h3>
    ${owe.map((l) => `<div class="m-row"><span data-f="nl-${l.id}"></span><span class="m-btns"><button data-n-pay="${l.id}" data-frac="0.5">Pay 50%</button><button data-n-pay="${l.id}" data-frac="1">Pay all</button></span></div>`).join("")}
    ${owed.map((l) => `<div class="m-row"><span data-f="nl-${l.id}"></span></div>`).join("")}
    ${offer ? `<div class="m-btns"><span data-f="nOffer"></span></div><div class="m-btns"><input data-input="n-borrow" type="number" min="0" placeholder="gold to borrow" /><button data-n-borrow>Borrow</button></div>` : `<p class="muted">${them.name} is not offering you a loan.</p>`}
    <div class="m-btns"><input data-input="n-lend" type="number" min="0" placeholder="gold to lend" /><input data-input="n-rate" type="number" min="0" max="60" value="10" title="Interest %" /><button data-n-lend>Lend</button></div>
    <h3>Trade route</h3>
    ${route ? `<div class="m-row"><span data-f="nRoute"></span><span class="m-btns"><input data-input="n-route-amt" type="number" min="0" placeholder="amount" /><button data-n-rtbuy="food">Buy food</button><button data-n-rtbuy="steel">Buy steel</button><button data-n-rtclose="${route.id}" class="secondary">Close</button></span></div>` : lanes.length ? `<div class="m-btns"><select data-input="n-lane">${lanes.map((l) => `<option value="${l.id}">${l.name}</option>`).join("")}</select><button data-n-ropen>Open a route</button></div>` : `<p class="muted">You and ${them.name} share no trade lane.</p>`}
    <p class="m-msg" data-f="nMsg"></p>`
  );
  const relation = allied ? "Allied" : atWarWith(me.index, them.index) ? "At war" : "No alliance";
  const st = route ? routeState(game, route) : null;
  const fields = {
    nInfo: `${relation} · ${percent.format(landShare(grid, them))} of the land · army ${compact.format(army(them))} · gold ${compact.format(them.gold)} · food ${compact.format(them.food + them.allyFood)}`,
    nFood: `You have ${compact.format(me.food)} own food and ${compact.format(me.gold)} gold. Gifts arrive as ally food (a tenth of it can be resold).`,
    nOffer: offer ? `${them.name} lends up to ${compact.format(offer.amount)} gold at ${Math.round(offer.rate * 100)}% interest` : "",
    nRoute: route ? `${st.state === "open" ? `Route open, +${st.income.toFixed(1)} gold/s` : st.state === "blockaded" ? "Route blockaded" : "Route cut: coast lost"}` : "",
    nMsg: nationMsg,
    ...Object.fromEntries([...owe, ...owed].map((l) => [`nl-${l.id}`, `${compact.format(l.owed)} gold ${l.borrower === me.index ? "owed by you" : "owed to you"}, ${l.defaulted ? "overdue" : `due in ${dueIn(l)}`}`])),
  };
  fill(nationEl, fields);
}

nationEl.on("click", (event) => {
  const me = game.nations[game.player];
  const them = game.nations[nationShown];
  if (!them) return;
  const hit = (sel) => event.target.closest(sel);
  const say = (text) => {
    nationMsg = text ?? "";
    renderNation();
  };
  let el;
  if (hit("[data-close]")) return closeNation();
  if ((el = hit("[data-n-answer]"))) return say(answerProposal(game, +el.dataset.nAnswer, !!el.dataset.yes) ?? (el.dataset.yes ? "Allied." : "Declined."));
  if (hit("[data-n-break]")) {
    breakAlliance(game, me.index, them.index);
    return say("");
  }
  if (hit("[data-n-propose]")) return say(proposeAlliance(game, me.index, them.index) ?? (isAllied(game, me.index, them.index) ? "Allied." : "Proposal sent."));
  if ((el = hit("[data-n-give]"))) {
    const food = el.dataset.nGive === "food";
    const pool = food ? me.food : me.gold;
    const amount = el.dataset.frac === "custom" ? nationInput(food ? "n-food" : "n-gold") : pool * +el.dataset.frac;
    return say((food ? giveFood : giveGold)(game, me.index, them.index, amount) ?? `Sent ${Math.floor(amount)} ${food ? "food" : "gold"}.`);
  }
  if (hit("[data-n-ask]")) {
    if (!isAllied(game, me.index, them.index)) return say(`${them.name} only shares food with allies.`);
    return say(askAlly(game, me.index, them.index, nationInput("n-food") || Infinity) ?? "Done: the food is yours.");
  }
  if (hit("[data-n-borrow]")) return say(takeLoan(game, me.index, them.index, nationInput("n-borrow") || Infinity) ?? "Loan taken. It falls due in 10 minutes.");
  if ((el = hit("[data-n-pay]"))) {
    const loan = game.loans.find((l) => l.id === +el.dataset.nPay);
    if (!loan) return say("");
    return say(repayLoan(game, loan.id, loan.owed * +el.dataset.frac) > 0 ? "Paid." : "You have no gold to pay with.");
  }
  if (hit("[data-n-lend]")) return say(lendTo(game, me.index, them.index, nationInput("n-lend"), nationInput("n-rate") / 100) ?? "Lent.");
  if ((el = hit("[data-n-rtbuy]"))) return say(routeTrade(game, me.index, them.index, el.dataset.nRtbuy, nationInput("n-route-amt")) ?? "Bought.");
  if ((el = hit("[data-n-rtclose]"))) {
    closeRoute(game, +el.dataset.nRtclose);
    return say("");
  }
  if (hit("[data-n-ropen]")) return say(openRoute(game, me.index, them.index, nationEl.select("[data-input=n-lane]").property("value")) ?? "Route opened.");
});

// --- Rival readout: hover a nation to see who would win a fight ---------------------

const rivalEl = document.createElement("div");
rivalEl.id = "rival";
rivalEl.className = "hidden";
document.body.append(rivalEl);

// The whole army (soldiers at home and out fighting) at its fighting strength, and why.
function fightersOf(n) {
  const out = game.attacks.filter((a) => a.attacker === n.index && a.target >= 0).reduce((sum, a) => sum + a.troops, 0);
  const notes = [];
  if (n.armyLevel) notes.push(`upgrades x${(1 + RULES.armyLevelBonus * n.armyLevel).toFixed(1)}`);
  if (n.starving) notes.push(`hungry x${RULES.starvingStrength}`);
  if (n.steelShort) notes.push(`no steel x${RULES.steelShortFactor}`);
  return { soldiers: army(n) + out, strength: (army(n) + out) * fightMultiplier(n), notes };
}

function showRival(event) {
  if (game.phase !== "playing" || nationShown >= 0) return rivalEl.classList.add("hidden");
  const tile = tileAt(event);
  const owner = tile < 0 ? -1 : game.owner[tile];
  if (owner < 0 || owner === game.player) return rivalEl.classList.add("hidden");
  const me = game.nations[game.player];
  const them = game.nations[owner];
  const a = fightersOf(me);
  const b = fightersOf(them);
  const ratio = a.strength / Math.max(b.strength, RULES.minStrength);
  const allied = isAllied(game, me.index, them.index);
  const verdict = allied ? "Allies do not fight" : ratio >= 1.15 ? "You would win" : ratio <= 1 / 1.15 ? "They would win" : "Even: the front would stall";
  const k = (v) => (v < 1000 ? number.format(v) : compact.format(v));
  const side = (who, f) => `${who} ${k(f.soldiers)} soldiers${f.notes.length ? ` (${f.notes.join(", ")})` : ""} = strength ${k(f.strength)}`;
  const lines = [`<strong style="color:${them.color}">${them.name}</strong>`, side("You", a), side("Them", b)];
  const fronts = game.attacks.filter((x) => x.target >= 0 && (x.attacker === them.index || x.target === them.index)).length;
  if (fronts > 1) lines.push(`<span class="muted">${them.name} fights ${fronts} fronts: its strength is split</span>`);
  rivalEl.innerHTML = `${lines.join("<br>")}<div class="verdict ${allied ? "" : ratio >= 1.15 ? "win" : ratio <= 1 / 1.15 ? "lose" : "even"}">${verdict}${allied ? "" : ` · ${ratio.toFixed(2)}x`}</div>`;
  rivalEl.classList.remove("hidden");
  const w = rivalEl.offsetWidth;
  const h = rivalEl.offsetHeight;
  rivalEl.style.left = `${Math.min(event.clientX + 16, window.innerWidth - w - 8)}px`;
  rivalEl.style.top = `${event.clientY + 16 + h > window.innerHeight - 8 ? event.clientY - h - 12 : event.clientY + 16}px`;
}
svg.on("mousemove", showRival);
svg.on("mouseleave", () => rivalEl.classList.add("hidden"));
svg.on("mousedown", () => rivalEl.classList.add("hidden"));

svg.on("contextmenu", (event) => {
  event.preventDefault();
  if (game.phase !== "playing") return;
  const tile = tileAt(event);
  const owner = tile < 0 ? -1 : game.owner[tile];
  if (owner >= 0 && owner !== game.player) openNation(owner, event.clientX, event.clientY);
  else closeNation();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeNation();
});

function renderHud() {
  renderBar();
  if (game.phase === "picking") {
    mount(
      hud,
      "picking",
      `<h2>Place your nation</h2>
      <p class="muted">Click anywhere on land. You start as a small dot and grow outward.
        ${RULES.bots} rival nations spawn around the world.</p>
      <button data-action="random" class="primary">Random spot</button>`
    );
    return;
  }
  const me = game.nations[game.player];
  const attacks = game.attacks.filter((a) => a.attacker === me.index);
  const boats = game.boats.filter((b) => b.attacker === me.index).length;
  const key = ["playing", attacks.map((a) => a.id).join(), boats, game.events.length && game.events.at(-1).tick, placingCity, me.holdExpansion].join("|");
  mount(
    hud,
    key,
    `<h2 style="color:${PLAYER_COLOR}">${me.name}</h2>
    ${attacks.length || boats ? `<h3>Fronts</h3><ul class="battles-list">${attacks
      .map((a) => `<li class="mine"><span>${a.target === WILD ? "Wilderness" : game.nations[a.target].name}</span><span><span data-f="a-${a.id}"></span> <button class="stop" data-stop="${a.id}" title="Call these soldiers home">Stop</button></span></li>`)
      .join("")}${boats ? `<li class="mine"><span>Boats at sea</span><span>${boats}</span></li>` : ""}</ul>` : ""}
    ${placingCity ? `<p class="placing">Click your land to place the upgrade. <kbd>Esc</kbd> cancels.</p>` : ""}
    <ul class="events">${game.events.slice(-3).reverse().map((e) => `<li>${e.text}</li>`).join("")}</ul>
    <p class="muted">Click empty land to expand, a rival to attack, or across the sea to send boats.
      Win by holding ${percent.format(RULES.winShare)} of the world's land.</p>`
  );
  const signed = (v) => `${v >= 0 ? "+" : "−"}${compact.format(Math.abs(v))}`;
  const cost = cityCost(me);
  const market = game.market;
  const past = market.history.at(-2);
  const trend = past ? (market.price > past.price + 0.05 ? "▲" : market.price < past.price - 0.05 ? "▼" : "") : "";
  const queuePos = market.queue.indexOf(me.index);
  const debt = game.loans.reduce((sum, l) => (l.borrower === me.index ? sum + l.owed : sum), 0);
  const atLimit = me.level >= maxCities(me);
  const steelNeed = citySteel(me);
  const army$ = armyUpgradeCost(me);
  const factoryAtMax = me.factories >= maxFactories(me);
  bar.select("[data-action=city]").property("disabled", me.gold < cost || atLimit || me.steel < steelNeed);
  bar.select("[data-action=factory]").property("disabled", factoryAtMax || me.gold < factoryCost(me));
  bar.select("[data-action=armyup]").property("disabled", me.armyLevel >= 10 || me.gold < army$.gold || me.steel < army$.steel);
  const nextCap = capWithCities(me.level + 1);
  bar.select(".pause").classed("on", !!me.holdExpansion);
  const fields = {
    pop: `${compact.format(me.troops)} / ${compact.format(maxTroops(me))}`,
    army: compact.format(army(me)),
    workers: compact.format(workers(me)),
    share: percent.format(me.armyShare),
    gold: `${compact.format(me.gold)} (${signed(goldIncome(me) - me.foodSpend + me.foodEarn + routeIncomeOf(game, me.index))}/s)`,
    steel: `${compact.format(me.steel)} (${steelRate(me) - steelUse(me) >= 0 ? "+" : "−"}${Math.abs(steelRate(me) - steelUse(me)).toFixed(2)}/s)`,
    steelTip: [
      `Steel: ${compact.format(me.steel)}. Factories ${me.factories} of ${maxFactories(me)} allowed by your land, making ${steelRate(me).toFixed(2)} a second. Your army and economy burn ${steelUse(me).toFixed(2)} a second${me.steelShort ? " and you are OUT of steel: everything runs 30% weaker" : ""}.`,
      `Steel is needed for population upgrades from the third on, and for army upgrades. Market price ${game.steel.price.toFixed(0)} gold (click the price item to trade).`,
    ].join("\n"),
    factoryCost: factoryAtMax ? "needs land" : compact.format(factoryCost(me)),
    factoryTip: factoryAtMax ? `Factories: ${me.factories}. One more needs more land (one per 60 tiles).` : `Build a factory (${me.factories} now): ${number.format(factoryCost(me))} gold${me.gold < factoryCost(me) ? ` (you have ${number.format(me.gold)})` : ""}. Each makes 0.15 steel a second.`,
    armyCost: me.armyLevel >= 10 ? "max" : compact.format(army$.gold),
    armyTip: me.armyLevel >= 10 ? "Army fully upgraded." : `Army level ${me.armyLevel} → ${me.armyLevel + 1}: soldiers fight 20% better, attacking and defending.
Cost: ${number.format(army$.gold)} gold and ${army$.steel} steel (you have ${Math.floor(me.steel)}).`,
    foodTip: [
      `Your own food: ${compact.format(me.food)}. You can sell all of it.`,
      `Food from allies: ${compact.format(me.allyFood)}. It is eaten first, and only ${compact.format(me.allySellable)} of it can be sold.`,
    ].join("\n"),
    food: `${compact.format(me.food + me.allyFood)} (${signed(foodMade(me) - foodEaten(me))}/s)${me.unrest > 0.01 ? ` · unrest ${percent.format(me.unrest)}` : ""}`,
    cityCost: atLimit ? "needs land" : compact.format(cost),
    cityTip: atLimit
      ? `Upgrade: more land needed first (one upgrade per ${RULES.tilesPerCity} tiles).`
      : `Upgrade: population cap ${compact.format(maxTroops(me))} → ${compact.format(nextCap)} (+${compact.format(nextCap - maxTroops(me))})
Cost: ${number.format(cost)} gold${me.gold < cost ? ` (you have ${number.format(me.gold)})` : ""}${steelNeed ? `, ${steelNeed} steel${me.steel < steelNeed ? ` (you have ${Math.floor(me.steel)})` : ""}` : ""}
Then click your land to place it.`,
    goalTip: "Land to take: an attack stops once it has taken this share of the rival's land. The Stop buttons in the side panel call soldiers home any time.",
    holdTip: me.holdExpansion ? "Expansion paused: no new settling of empty land. Click to resume." : "Pause expansion: stop settling empty land.",
    shareTip: "Army share: soldiers fight; workers grow people, gold and food.",
    ratioTip: "Attack size: share of your army sent to attack a rival. Settling empty land is free and needs no army.",
    land: `${percent.format(landShare(grid, me))} / ${percent.format(RULES.winShare)}`,
    rivals: String(game.nations.filter((n) => n.alive && n.index !== me.index).length),
    market: `${market.price.toFixed(1)}${trend}`,
    marketTip: [
      `Food market: ${market.price.toFixed(2)} gold per food${trend ? (trend === "▲" ? " (rising)" : " (falling)") : ""}`,
      `Stock ${compact.format(market.stock ?? 0)} of ${compact.format(market.target)} target`,
      `${market.queue.length} nations waiting to buy (${compact.format(market.need)} food short)`,
      queuePos >= 0 ? `You are number ${queuePos + 1} in the queue` : me.foodEarn > 0.05 ? `You are selling about ${compact.format(me.foodEarn / market.price)} food a second` : "You are not trading",
      `Selling is taxed ${Math.round(sellTaxRate(me) * 100)}% for you now (more the more food sales are your income); buying adds ${Math.round(RULES.marketBuyTax * 100)}%.`,
      debt > 0 ? `You owe ${compact.format(debt)} gold in loans.` : "",
    ].join("\n"),
    ratio: percent.format(attackRatio),
    ...Object.fromEntries(attacks.map((a) => [`a-${a.id}`, a.target === WILD ? "settling" : `${compact.format(a.troops)} soldiers`])),
  };
  fill(hud, fields);
  fill(bar, fields);
  renderMarket();
  renderNation();
}

hud.on("click", (event) => {
  const stop = event.target.closest("[data-stop]");
  if (stop) return stopFront(game, +stop.dataset.stop);

  if (event.target.closest("[data-action=city]")) {
    setPlacingCity(true);
    return;
  }
  if (!event.target.closest("[data-action=random]")) return;
  for (let i = 0; i < 200; i++) {
    const t = grid.landTiles[Math.floor(random(game) * grid.landTiles.length)];
    if (game.owner[t] === WILD) return spawnAt(t);
  }
});

function renderOverlay() {
  const ended = game.phase === "won" || game.phase === "lost";
  overlay.classed("hidden", !ended);
  if (!ended) return;
  const me = game.nations[game.player];
  const winner = game.winner === null ? null : game.nations[game.winner];
  const message =
    game.phase === "won"
      ? `${me.name} holds ${percent.format(landShare(grid, me))} of the world's land.`
      : winner
        ? `${winner.name} took ${percent.format(RULES.winShare)} of the world's land first.`
        : `${me.name} has fallen.`;
  mount(
    overlay,
    game.phase,
    `<div class="card">
      <h2>${game.phase === "won" ? "Victory" : "Defeat"}</h2>
      <p>${message}</p>
      <button data-action="restart" class="primary">Play again</button>
    </div>`
  );
}

overlay.on("click", (event) => {
  if (event.target.closest("[data-action=restart]")) window.location.reload();
});

let lastTickAt = performance.now();

function render() {
  if (gpuOn) syncGPU(false);
  else paintDirty();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, names.width, names.height);
  drawFeatures();
  if (game.nations.length) {
    if (gpuOn) drawGPU();
    else drawTerritory();
    drawCities();
    drawLanes();
    drawBoats(Math.min((performance.now() - lastTickAt) / (1000 / RULES.ticksPerSecond), 1));
    drawNames();
  }
  renderHud();
  renderOverlay();
}

startLoop({
  ticksPerSecond: RULES.ticksPerSecond,
  update: () => {
    // The dev lab can run the game faster.
    const steps = import.meta.env.DEV ? Math.max(1, window.lab?.speed ?? 1) : 1;
    for (let i = 0; i < steps; i++) tick(grid, game);
    lastTickAt = performance.now();
  },
  render,
});

// Dev-only handle for inspecting the simulation from the console.
if (import.meta.env.DEV) window.nations = { game, grid, RULES, buildBorders, render, toggleGL,
  // Zoom so grid tile (gx, gy) is at the screen center with k screen pixels per tile.
  focus(gx, gy, tilePx) {
    const k = tilePx / ratio;
    const { width, height } = svg.node().getBoundingClientRect();
    svg.call(zoomBehavior.transform, zoomIdentity.translate(width / 2 - k * (offset[0] + gx * ratio), height / 2 - k * (offset[1] + gy * ratio)).scale(k));
  },
};

// Dev lab: scenario tools for Claude's use from the console (src/lab.js). No UI; not in production builds.
if (import.meta.env.DEV) import("./lab.js").then((m) => m.installLab({ game, grid, paintAll }));
