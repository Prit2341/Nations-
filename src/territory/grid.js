// The playing field: the world's land rasterized into a grid of small tiles,
// in a fixed Mercator projection independent of the screen. Nations own
// tiles, not countries.

import { geoMercator, geoPath } from "d3-geo";
import riverData from "../data/rivers.json";

export const WATER = -2;
export const WILD = -1;
const SEA_CELL = 4; // tiles per side of a boat-routing cell

// Smooth value noise in [0, 1] per tile, two octaves. Fronts follow it, so
// territory grows in irregular lobes instead of straight lines.
function valueNoise(width, height) {
  const hash = (x, y, s) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const octave = (x, y, cell, s) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smooth(gx - x0);
    const fy = smooth(gy - y0);
    const top = hash(x0, y0, s) + (hash(x0 + 1, y0, s) - hash(x0, y0, s)) * fx;
    const bottom = hash(x0, y0 + 1, s) + (hash(x0 + 1, y0 + 1, s) - hash(x0, y0 + 1, s)) * fx;
    return top + (bottom - top) * fy;
  };
  const noise = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) noise[y * width + x] = 0.65 * octave(x, y, 14, 1) + 0.35 * octave(x, y, 5, 2);
  }
  return noise;
}

export function buildGrid(world, width = 1200) {
  const projection = geoMercator();
  projection.fitWidth(width, world.collection);
  const [[, y0], [, y1]] = geoPath(projection).bounds(world.collection);
  const height = Math.ceil(y1 - Math.min(0, y0));

  // Draw the land in black and read back which tiles are mostly covered.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.beginPath();
  geoPath(projection, ctx)(world.collection);
  ctx.fill();
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const size = width * height;
  const land = new Uint8Array(size);
  let landCount = 0;
  for (let i = 0; i < size; i++) {
    if (pixels[i * 4 + 3] > 127) {
      land[i] = 1;
      landCount++;
    }
  }

  // Every river as a line of land tiles (8-connected, so no one can step through it): land fronts
  // can take a river tile but can't go on from it, so a river holds a front back until it ends.
  const river = new Uint8Array(size);
  for (const line of riverData) {
    let prev = null;
    for (let i = 1; i < line.length; i += 2) {
      const [px, py] = projection([line[i], line[i + 1]]);
      const cur = [Math.round(px - 0.5), Math.round(py - 0.5)];
      if (prev) {
        const steps = Math.max(Math.abs(cur[0] - prev[0]), Math.abs(cur[1] - prev[1]), 1);
        for (let k = 0; k <= steps; k++) {
          const x = Math.round(prev[0] + ((cur[0] - prev[0]) * k) / steps);
          const y = Math.round(prev[1] + ((cur[1] - prev[1]) * k) / steps);
          if (x >= 0 && y >= 0 && x < width && y < height && land[y * width + x]) river[y * width + x] = 1;
        }
      }
      prev = cur;
    }
  }

  // River tiles are water pixels: nobody owns them, so they are not land to win.
  for (let i = 0; i < size; i++) if (river[i]) landCount--;

  // Land tiles next to water: where boats can land and depart.
  const coastal = new Uint8Array(size);
  const coastTiles = [];
  for (let i = 0; i < size; i++) {
    if (!land[i]) continue;
    const x = i % width;
    if ((x > 0 && !land[i - 1]) || (x < width - 1 && !land[i + 1]) || (i >= width && !land[i - width]) || (i < size - width && !land[i + width])) {
      coastal[i] = 1;
      coastTiles.push(i);
    }
  }

  const landTiles = [];
  for (let i = 0; i < size; i++) if (land[i]) landTiles.push(i);

  // Coarse sea grid for routing boats: a cell is sea if it's mostly water
  // and connected to the open ocean (so lakes don't count).
  const seaWidth = Math.ceil(width / SEA_CELL);
  const seaHeight = Math.ceil(height / SEA_CELL);
  const water = new Uint16Array(seaWidth * seaHeight);
  for (let i = 0; i < size; i++) {
    if (!land[i]) water[Math.floor(Math.floor(i / width) / SEA_CELL) * seaWidth + Math.floor((i % width) / SEA_CELL)]++;
  }
  const sea = new Uint8Array(seaWidth * seaHeight);
  const open = [];
  for (let c = 0; c < water.length; c++) {
    const x = c % seaWidth;
    const y = Math.floor(c / seaWidth);
    const edge = x === 0 || y === 0 || x === seaWidth - 1 || y === seaHeight - 1;
    if (edge && water[c] * 2 >= SEA_CELL * SEA_CELL) {
      sea[c] = 1;
      open.push(c);
    }
  }
  while (open.length) {
    const c = open.pop();
    const x = c % seaWidth;
    for (const n of [x > 0 ? c - 1 : -1, x < seaWidth - 1 ? c + 1 : -1, c - seaWidth, c + seaWidth]) {
      if (n < 0 || n >= sea.length || sea[n] || water[n] * 2 < SEA_CELL * SEA_CELL) continue;
      sea[n] = 1;
      open.push(n);
    }
  }

  return {
    width,
    height,
    size,
    land,
    river,
    landCount,
    landTiles,
    coastal,
    coastTiles,
    projection,
    collection: world.collection,
    noise: valueNoise(width, height),
    // A boat route through the sea between two coastal tiles: a list of
    // [x, y] tile points and its length in tiles, or null if none exists.
    seaRoute(from, to) {
      const cell = (t) => Math.floor(Math.floor(t / width) / SEA_CELL) * seaWidth + Math.floor((t % width) / SEA_CELL);
      const start = cell(from);
      const goal = cell(to);
      // Boats may also cross the land-heavy cells right at either shore.
      const nearShore = (n, c) => Math.abs((n % seaWidth) - (c % seaWidth)) <= 1 && Math.abs(Math.floor(n / seaWidth) - Math.floor(c / seaWidth)) <= 1;
      const prev = new Int32Array(sea.length).fill(-1);
      const queue = new Int32Array(sea.length);
      let head = 0;
      let tail = 0;
      prev[start] = start;
      queue[tail++] = start;
      while (head < tail && prev[goal] < 0) {
        const c = queue[head++];
        const cx = c % seaWidth;
        const cy = Math.floor(c / seaWidth);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= seaWidth || ny >= seaHeight) continue;
            const n = ny * seaWidth + nx;
            if (prev[n] >= 0 || (!sea[n] && !nearShore(n, goal) && !nearShore(n, start))) continue;
            prev[n] = c;
            queue[tail++] = n;
          }
        }
      }
      if (prev[goal] < 0) return null;
      const cells = [];
      for (let c = goal; c !== start; c = prev[c]) cells.push(c);
      cells.reverse();
      const points = [[(from % width) + 0.5, Math.floor(from / width) + 0.5]];
      for (let i = 1; i < cells.length - 1; i++) {
        points.push([(cells[i] % seaWidth) * SEA_CELL + SEA_CELL / 2, Math.floor(cells[i] / seaWidth) * SEA_CELL + SEA_CELL / 2]);
      }
      points.push([(to % width) + 0.5, Math.floor(to / width) + 0.5]);
      let length = 0;
      for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      return { points, length };
    },
    // The [longitude, latitude] at a tile's center.
    lonLatAt(tile) {
      return projection.invert([(tile % width) + 0.5, Math.floor(tile / width) + 0.5]);
    },
  };
}

// The up-to-4 orthogonal neighbors of a tile.
export function forNeighbors(grid, tile, fn) {
  const x = tile % grid.width;
  if (x > 0) fn(tile - 1);
  if (x < grid.width - 1) fn(tile + 1);
  if (tile >= grid.width) fn(tile - grid.width);
  if (tile < grid.size - grid.width) fn(tile + grid.width);
}

// A finer land/sea picture for routing ships and lanes: the same projection drawn at `scale` times the
// tile resolution, so a path can hug a coast far more closely than the game tiles allow.
export function buildNav(grid, scale = 2) {
  const width = grid.width * scale;
  const height = grid.height * scale;
  const size = width * height;
  if (typeof document === "undefined") return { scale: 1, width: grid.width, height: grid.height, size: grid.size, land: grid.land };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.scale(scale, scale);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  geoPath(grid.projection, ctx)(grid.collection);
  ctx.fill();
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const land = new Uint8Array(size);
  for (let i = 0; i < size; i++) if (pixels[i * 4 + 3] > 127) land[i] = 1;
  return { scale, width, height, size, land };
}
