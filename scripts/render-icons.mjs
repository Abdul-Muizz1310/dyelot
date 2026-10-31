// Renders dyelot's raster icons from src/app/icon.svg with Playwright's Chromium.
//
//   node scripts/render-icons.mjs            rewrites the committed icons in place
//   node scripts/render-icons.mjs <outDir>   writes the same five files into <outDir> instead
//
// In place, the files land where Next and the manifest read them: favicon.ico and apple-icon.png
// in src/app/, and icon-192.png, icon-512.png and icon-maskable-512.png in public/.
//
// Every variant is icon.svg with a few attributes swapped, so the rasters cannot drift from the
// vector source. A swap that does not match throws instead of silently doing nothing.
//
// Run `pnpm exec playwright install chromium` once first. The output is deterministic for one
// Chromium build, and a different build can move anti-aliased pixels, so a diff in the committed
// files after a Playwright upgrade is expected.
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] ? resolve(process.argv[2]) : null;

/** Where each file goes when no <outDir> is given. */
const HOME = {
  "favicon.ico": "src/app",
  "apple-icon.png": "src/app",
  "icon-192.png": "public",
  "icon-512.png": "public",
  "icon-maskable-512.png": "public",
};

// sharp ships with next as an optional dependency. It only re-encodes the PNGs losslessly (zlib
// level 9, adaptive filters, no palette), because Chromium's own encoder writes larger files.
// Without it the icons still render, but they will not match the committed bytes.
const sharp = (() => {
  try {
    return createRequire(realpathSync(join(root, "node_modules/next/package.json")))("sharp");
  } catch {
    console.warn("sharp not found: the PNGs are not re-encoded, so they will not match the commit");
    return null;
  }
})();
const squeeze = (data) =>
  sharp
    ? sharp(data).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer()
    : data;

const source = await readFile(join(root, "src/app/icon.svg"), "utf8");

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">';
const TILE = '<rect x="1" y="1" width="62" height="62" rx="14" fill="#12121a"/>';
const GLOW = '<rect x="1" y="1" width="62" height="62" rx="14" fill="url(#glow)"/>';
const RING =
  '<rect x="1" y="1" width="62" height="62" rx="14" fill="none" stroke="#2a2a3d" stroke-width="2"/>';
const GLYPH = 'transform="translate(10 10) scale(1.8333)"';
const STROKE = 'stroke="#f66c6d" stroke-width="2.25"';

function swap(svg, from, to) {
  if (!svg.includes(from)) throw new Error(`icon.svg no longer contains: ${from}`);
  return svg.replace(from, to);
}

/** The glyph's 18-unit box (lucide spans 3..21), centered on the 64-unit tile at `scale`. */
const centered = (scale) => {
  const at = (32 - 12 * scale).toFixed(3);
  return `transform="translate(${at} ${at}) scale(${scale})"`;
};

/** The tile as designed: ring, rounded corners (transparent outside), glyph at the house scale. */
const designed = (svg) => svg;

/** A larger glyph with a heavier stroke, for 16 px, where the house scale turns to mush. */
const small = (svg) =>
  swap(swap(svg, GLYPH, centered(2.1)), STROKE, 'stroke="#f66c6d" stroke-width="2.6"');

/** Full-bleed: no ring, no rounded corners (iOS and Android round and crop it themselves). */
const fullBleed = (scale) => (svg) => {
  let out = swap(svg, TILE, '<rect width="64" height="64" fill="#12121a"/>');
  out = swap(out, GLOW, '<rect width="64" height="64" fill="url(#glow)"/>');
  out = swap(out, RING, "");
  return swap(out, GLYPH, centered(scale));
};

const sized = (svg, px) =>
  swap(svg, SVG_OPEN, SVG_OPEN.replace("<svg ", `<svg width="${px}" height="${px}" `));

const browser = await chromium.launch();
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();

async function png(variant, px) {
  const svg = sized(variant(source), px);
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`,
  );
  return squeeze(
    await page.screenshot({
      type: "png",
      omitBackground: true,
      clip: { x: 0, y: 0, width: px, height: px },
    }),
  );
}

/** An .ico of PNG frames, smallest first. */
function ico(frames) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const entries = frames.map(({ px, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = px % 256; // 0 means 256
    entry[1] = px % 256;
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([head, ...entries, ...frames.map((f) => f.data)]);
}

async function write(name, data) {
  const dir = outDir ?? join(root, HOME[name]);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), data);
  console.log(`wrote ${join(dir, name)}`);
}

await write(
  "favicon.ico",
  ico([
    { px: 16, data: await png(small, 16) },
    { px: 32, data: await png(designed, 32) },
    { px: 48, data: await png(designed, 48) },
  ]),
);
// The glyph box is about 44% of the canvas for iOS's full-bleed icon and about 39% for the Android
// maskable icon, so the glyph stays inside the 80% safe-zone circle.
await write("apple-icon.png", await png(fullBleed(1.404), 180));
await write("icon-192.png", await png(designed, 192));
await write("icon-512.png", await png(designed, 512));
await write("icon-maskable-512.png", await png(fullBleed(1.245), 512));

await browser.close();
