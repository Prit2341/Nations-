// Territory on the GPU. The owner of every tile lives in a texture; one shader per frame
// rounds off the shapes, colors them, draws the lines between nations and the outline, and
// trims everything to the real coastline. Nothing is rebuilt on the CPU when the view moves.
//
// Pass 1 (only when territory changed): "effective owner" per tile: sea tiles within two
// steps of a nation count as that nation's, so territory reaches the coarse coast tiles and
// the land mask trims it to the real shore.
// Pass 2 (every frame that changed): per screen pixel, the owners of the 4x4 tiles around it
// are weighted with a Gaussian of about one tile. The share of owned weight gives the smooth
// outer edge; the two biggest owners give the color and the line between them.

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const EFF_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp isampler2D;
uniform isampler2D uOwner;
uniform ivec2 uSize;
out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int v = texelFetch(uOwner, c, 0).r;
  if (v < -1) {
    int best = -1;
    int bd = 99;
    for (int dy = -2; dy <= 2; dy++) {
      for (int dx = -2; dx <= 2; dx++) {
        int m = abs(dx) + abs(dy);
        if (m > 2 || m >= bd) continue;
        ivec2 q = c + ivec2(dx, dy);
        if (q.x < 0 || q.y < 0 || q.x >= uSize.x || q.y >= uSize.y) continue;
        int w = texelFetch(uOwner, q, 0).r;
        if (w >= 0) { bd = m; best = w; }
      }
    }
    v = best;
  }
  int e = v + 1;
  o = vec4(float(e & 255), float((e >> 8) & 255), 0.0, 0.0) / 255.0;
}`;

const MAIN_FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uEff;
uniform sampler2D uPalette;
uniform sampler2D uLand;
uniform sampler2D uScreenLand; // exact coast for the current view (pixel for pixel), when still
uniform float uUseScreen;
uniform vec2 uScreenSize;      // its size in device pixels
uniform vec2 uGrid;      // grid size in tiles
uniform vec2 uViewport;  // css pixels
uniform float uDpr;
uniform vec3 uView;      // zoom k, x, y
uniform vec3 uMap;       // ratio, offset x, offset y
uniform float uSigma;    // blur in tiles
uniform float uFill;
uniform float uLineHalf; // half width of the line between nations, in px
out vec4 outColor;

int ownerAt(ivec2 q) {
  if (q.x < 0 || q.y < 0 || q.x >= int(uGrid.x) || q.y >= int(uGrid.y)) return -1;
  vec4 t = texelFetch(uEff, q, 0) * 255.0 + 0.5;
  return int(t.r) + int(t.g) * 256 - 1;
}

void main() {
  vec2 s = vec2(gl_FragCoord.x, uViewport.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 g = ((s - uView.yz) / uView.x - uMap.yz) / uMap.x; // grid units
  ivec2 b = ivec2(floor(g - 0.5));
  float inv = 1.0 / (2.0 * uSigma * uSigma);

  int ids[16];
  float ws[16];
  float tot = 0.0;
  float owned = 0.0;
  for (int iy = 0; iy < 4; iy++) {
    for (int ix = 0; ix < 4; ix++) {
      int k = iy * 4 + ix;
      ivec2 q = b + ivec2(ix - 1, iy - 1);
      vec2 d = vec2(q) + 0.5 - g;
      float w = exp(-dot(d, d) * inv);
      ids[k] = ownerAt(q);
      ws[k] = w;
      tot += w;
      if (ids[k] >= 0) owned += w;
    }
  }
  float T = owned / tot;

  int b1 = -1;
  float c1 = 0.0;
  float c2 = 0.0;
  for (int i = 0; i < 16; i++) {
    int id = ids[i];
    if (id < 0) continue;
    bool seen = false;
    for (int j = 0; j < i; j++) if (ids[j] == id) seen = true;
    if (seen) continue;
    float c = 0.0;
    for (int j = 0; j < 16; j++) if (ids[j] == id) c += ws[j];
    c /= tot;
    if (c > c1) { c2 = c1; b1 = id; c1 = c; }
    else if (c > c2) { c2 = c; }
  }

  // Distances to the outer edge and to the line between the two biggest owners, in px.
  float gT = max(length(vec2(dFdx(T), dFdy(T))), 1e-4);
  float dEdge = (T - 0.5) / gT;
  float dd = c1 - c2;
  float gD = max(length(vec2(dFdx(dd), dFdy(dd))), 1e-4);
  float dLine = dd / gD;

  // The coast: where the (bilinear) land mask crosses one half, with a pixel-wide soft edge at any zoom,
  // and pushed out by 0.7 px so the fill always reaches the drawn coastline (which covers the overlap).
  float lm = uUseScreen > 0.5
    ? texture(uScreenLand, vec2(gl_FragCoord.x, uViewport.y * uDpr - gl_FragCoord.y) / uScreenSize).r
    : texture(uLand, g / uGrid).r;
  float lw = max(length(vec2(dFdx(lm), dFdy(lm))), 1e-4);

  if (b1 < 0) { outColor = vec4(0.0); return; }

  vec3 base = texelFetch(uPalette, ivec2(b1, 0), 0).rgb;
  float line = (1.0 - smoothstep(uLineHalf - 0.5, uLineHalf + 0.5, dLine)) * smoothstep(0.08, 0.2, c2);
  vec3 col = mix(base, vec3(15.0, 15.0, 25.0) / 255.0, line);

  float land = clamp((lm - 0.5) / lw + 0.5 + 0.7, 0.0, 1.0);
  float edgeA = clamp(dEdge + 0.5, 0.0, 1.0);
  float ring = edgeA * (1.0 - smoothstep(0.7, 1.7, dEdge)) * land;
  float fillA = edgeA * land * uFill;
  vec3 dark = base * 0.72;
  vec3 rgb = dark * ring + col * fillA * (1.0 - ring);
  float a = ring + fillA * (1.0 - ring);
  outColor = vec4(rgb, a);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function program(gl, frag) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(prog, 0, "p");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(prog, i);
    uniforms[name] = gl.getUniformLocation(prog, name);
  }
  return { prog, u: uniforms };
}

const PALETTE_SIZE = 1024; // nations (rebels add more during a game)

// Returns null when WebGL2 is not available.
export function createTerritoryGL(grid, canvas) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  try {
    const eff = program(gl, EFF_FRAG);
    const main = program(gl, MAIN_FRAG);
    const { width: W, height: H } = grid;

    const quad = gl.createVertexArray();
    gl.bindVertexArray(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const texture = (unit, internal, w, h, format, type, data, filter) => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const ownerTex = texture(0, gl.R16I, W, H, gl.RED_INTEGER, gl.SHORT, null, gl.NEAREST);
    const effTex = texture(1, gl.RGBA8, W, H, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.NEAREST);
    const paletteTex = texture(2, gl.RGBA8, PALETTE_SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.NEAREST);
    const landTex = texture(3, gl.R8, 1, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]), gl.LINEAR);
    const screenLandTex = texture(4, gl.R8, 1, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]), gl.LINEAR);
    let screenSize = [1, 1];
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, effTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("framebuffer incomplete");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);

    let cssW = 1;
    let cssH = 1;
    let dpr = 1;

    return {
      resize(w, h, ratio) {
        cssW = w;
        cssH = h;
        dpr = ratio;
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
      },
      // colors: array of "#rrggbb", indexed by nation
      setPalette(colors) {
        const bytes = new Uint8Array(PALETTE_SIZE * 4);
        colors.slice(0, PALETTE_SIZE).forEach((hex, i) => {
          const n = parseInt(hex.slice(1), 16);
          bytes.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
        });
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, paletteTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, PALETTE_SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      },
      // The whole owner grid goes up (about 1.9 MB) and the effective owners are rebuilt.
      uploadOwner(owner) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, ownerTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED_INTEGER, gl.SHORT, owner);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, W, H);
        gl.useProgram(eff.prog);
        gl.uniform1i(eff.u.uOwner, 0);
        gl.uniform2i(eff.u.uSize, W, H);
        gl.bindVertexArray(quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      },
      // A canvas the size of a multiple of the grid, white where there is land.
      setLand(source) {
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, landTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, source);
      },
      // A canvas the size of the screen (device pixels), white on land, drawn for one exact view.
      setScreenLand(source) {
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, screenLandTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, source);
        screenSize = [source.width, source.height];
      },
      // view: {k, x, y} of the zoom; map: {ratio, offset:[x, y]} of grid to screen at zoom 1.
      // useScreen: trim to the exact screen coast (only valid while the view is the one it was drawn for).
      draw(view, map, fill, useScreen = false) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(main.prog);
        const u = main.u;
        const tilePx = view.k * map.ratio;
        gl.uniform1i(u.uEff, 1);
        gl.uniform1i(u.uPalette, 2);
        gl.uniform1i(u.uLand, 3);
        gl.uniform1i(u.uScreenLand, 4);
        gl.uniform1f(u.uUseScreen, useScreen ? 1 : 0);
        gl.uniform2f(u.uScreenSize, screenSize[0], screenSize[1]);
        gl.uniform2f(u.uGrid, W, H);
        gl.uniform2f(u.uViewport, cssW, cssH);
        gl.uniform1f(u.uDpr, dpr);
        gl.uniform3f(u.uView, view.k, view.x, view.y);
        gl.uniform3f(u.uMap, map.ratio, map.offset[0], map.offset[1]);
        gl.uniform1f(u.uSigma, Math.min(Math.max(0.7 / tilePx, 0.75), 1.1));
        gl.uniform1f(u.uFill, fill);
        gl.uniform1f(u.uLineHalf, Math.max(1.3, Math.min(tilePx * 0.45, 2.4)) / 2);
        gl.bindVertexArray(quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  } catch (error) {
    console.warn("WebGL territory layer unavailable, using the canvas renderer:", error);
    return null;
  }
}
