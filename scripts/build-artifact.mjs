// Builds the game and inlines it into one self-contained page,
// dist/nations-artifact.html, for publishing as a claude.ai Artifact.
// The Artifact host adds the <!doctype>/<head>/<body> skeleton itself, so
// this file holds only the title, styles, markup and script.
//
// Run with: npm run build:artifact

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { build } from "vite";

const root = new URL("..", import.meta.url);
await build({ root: root.pathname.replace(/^\/([A-Za-z]:)/, "$1"), logLevel: "warn" });

const assets = new URL("dist/assets/", root);
const files = readdirSync(assets);
const read = (ext) => readFileSync(new URL(files.find((f) => f.endsWith(ext)), assets), "utf8");
const css = read(".css");
// A literal "</script" inside the bundle would end the inline script early.
const js = read(".js").replace(/<\/script/gi, "<\\/script");

// The page's own markup comes from index.html, so the two never drift apart.
const html = readFileSync(new URL("index.html", root), "utf8");
const markup = html.slice(html.indexOf("<body>") + 6, html.indexOf('<script type="module"')).replace(/^\s+/gm, "").trim();

const page = `<title>Nations</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
${markup}
<script type="module">${js}</script>
`;

writeFileSync(new URL("dist/nations-artifact.html", root), page);
console.log(`dist/nations-artifact.html: ${(page.length / 1024).toFixed(0)} KB`);
