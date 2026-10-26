// Battle rendering in the style of territory games like openfront.io: the
// attacker's color floods into the target region from the border it attacks
// across, as a ragged front with a dark leading edge. Progress is smoothed
// between game ticks, and when the battle ends the color either settles into
// the region's new fill (captured) or recedes (failed).
//
// Purely visual: the game itself still captures whole regions.

const FRONT_PX = 2.2; // dark leading-edge width on screen
const RAGGED_PX = 7; // how far the front's edge wobbles on screen
const FADE_MS = 450;
const SMOOTHING = 8; // higher follows the real progress more tightly

// Darker shade of a #rrggbb color, for the front line.
function shade(hex, amount = 0.38) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - amount)));
  return `rgb(${c.join(",")})`;
}

// Fixed pseudo-random value in [-1, 1] per point, so the edge wobble is stable.
const wobble = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export function createSpreadLayer(canvas, path) {
  const ctx = canvas.getContext("2d");
  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d");
  let dpr = 1;
  // attack id -> { region, attacker, color, edge, shape, sources, far, shown, target, endedAt }
  const battles = new Map();
  let lastFrame = performance.now();

  function resize(width, height) {
    dpr = window.devicePixelRatio || 1;
    canvas.width = off.width = Math.round(width * dpr);
    canvas.height = off.height = Math.round(height * dpr);
    battles.clear(); // projection changed: shapes and sources are stale
  }

  // How far the front must travel: the region point farthest from every source.
  function reach(feature, sources) {
    let far = 0;
    const outline = new Path2D(path(feature));
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      const ring = polygon[0];
      const step = Math.max(1, Math.floor(ring.length / 300));
      for (let i = 0; i < ring.length; i += step) {
        const p = path.projection()(ring[i]);
        if (!p) continue;
        let near = Infinity;
        for (const s of sources) near = Math.min(near, Math.hypot(p[0] - s[0], p[1] - s[1]));
        far = Math.max(far, near);
      }
    }
    return { shape: outline, far };
  }

  // active: [{ id, region, attacker, feature, sources: [[x, y]...], color, progress }]
  // ownerOf(region) tells whether a finished battle was a capture.
  function draw({ transform, active, ownerOf, reducedMotion }) {
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const follow = reducedMotion ? 1 : 1 - Math.exp(-dt * SMOOTHING);

    const seen = new Set();
    for (const a of active) {
      seen.add(a.id);
      let battle = battles.get(a.id);
      if (!battle) {
        if (!a.sources.length) continue;
        battle = { region: a.region, attacker: a.attacker, sources: a.sources, shown: 0, ...reach(a.feature, a.sources) };
        battles.set(a.id, battle);
      }
      Object.assign(battle, { color: a.color, edge: shade(a.color), target: a.progress });
    }

    for (const [id, battle] of battles) {
      if (!seen.has(id) && battle.endedAt === undefined) {
        battle.endedAt = now;
        battle.target = ownerOf(battle.region) === battle.attacker ? 1 : 0;
      }
      const rate = battle.endedAt === undefined ? follow : 1 - Math.exp(-dt * 12);
      battle.shown += (battle.target - battle.shown) * rate;
      if (battle.endedAt !== undefined && now - battle.endedAt > FADE_MS) battles.delete(id);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = transform.k;
    const front = FRONT_PX / k;
    const ragged = RAGGED_PX / k;

    for (const battle of battles.values()) {
      if (battle.shown <= 0.001) continue;
      // The front starts at the border and ends past the farthest point.
      const radius = battle.shown * (battle.far + ragged + front);

      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, off.width, off.height);
      offCtx.setTransform(dpr * k, 0, 0, dpr * k, dpr * transform.x, dpr * transform.y);
      offCtx.save();
      offCtx.clip(battle.shape);
      // Dark leading edge first, then the attacker's color just behind it.
      for (const [fill, inset] of [[battle.edge, 0], [battle.color, front]]) {
        offCtx.fillStyle = fill;
        offCtx.beginPath();
        battle.sources.forEach(([x, y], i) => {
          const r = radius - ragged * (0.5 + 0.5 * wobble(i)) - inset;
          if (r <= 0) return;
          offCtx.moveTo(x + r, y);
          offCtx.arc(x, y, r, 0, Math.PI * 2);
        });
        offCtx.fill();
      }
      offCtx.restore();

      ctx.globalAlpha = battle.endedAt === undefined ? 0.95 : 0.95 * Math.max(0, 1 - (now - battle.endedAt) / FADE_MS);
      ctx.drawImage(off, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  return { resize, draw };
}
