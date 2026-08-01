// Street-surface texture pipeline (Alive Corner wave). Reproducible processing for
// the CC0 ambientCG color maps shipped at public/assets/textures/ (provenance:
// public/assets/textures/CREDITS.md — fetched from the PUTvision/VITALPad public
// GitHub LFS mirror because ambientcg.com is unreachable from the build container).
//
// What it does, per map:
//  1. Downsample to game res (1024 for hero surfaces, 512 for secondary).
//  2. Desaturate (×0.60) and normalize mean luminance to ~0.72 so the palette tint
//     in createEnvironmentMaterial (diffuseColor × ~1.38) lands ON-palette — the
//     graphic-novel grade owns hue; the photo owns micro-structure. Never ship a
//     raw photo texture: that's how the look drifts photoreal.
//  3. Bake surface story where geometry can't: expansion joints on the sidewalk
//     tile, patch scars + crack + oil sheen on the asphalt tile.
//  4. Emit progressive JPEG q78 (KTX2/basis deferred — no encoder in this
//     container; jpg-at-512/1024 is the sanctioned fallback this round).
//
// Usage:  node assets-pipeline/process-street-textures.mjs <srcDir> [outDir]
//   srcDir must hold the raw ambientCG *_1K_Color.jpg files listed in RECIPES.
//   outDir defaults to public/assets/textures.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = process.argv[2];
const outDir = process.argv[3] ?? path.join(here, '..', 'public', 'assets', 'textures');
if (!srcDir) {
  console.error('usage: node process-street-textures.mjs <srcDir> [outDir]');
  process.exit(1);
}

/** SVG overlay painted onto the asphalt tile: cold-patch scars, a crack web and
 *  oil staining. Tile covers ~4m×4m in world — features sized to read at phone
 *  scale from a 1.6m eye height. */
const asphaltOverlay = (s) => `
<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="oil" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0a0a0c" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="#101014" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#101014" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- cold-patch scars: darker rough rectangles with a lighter rim -->
  <g>
    <rect x="${s * 0.08}" y="${s * 0.55}" width="${s * 0.34}" height="${s * 0.2}" rx="${s * 0.02}"
      fill="#0e0e11" opacity="0.42" transform="rotate(-4 ${s * 0.25} ${s * 0.65})"/>
    <rect x="${s * 0.08}" y="${s * 0.55}" width="${s * 0.34}" height="${s * 0.2}" rx="${s * 0.02}"
      fill="none" stroke="#3c3c40" stroke-width="${s * 0.006}" opacity="0.5"
      transform="rotate(-4 ${s * 0.25} ${s * 0.65})"/>
    <rect x="${s * 0.6}" y="${s * 0.12}" width="${s * 0.26}" height="${s * 0.3}" rx="${s * 0.02}"
      fill="#0f0f12" opacity="0.35" transform="rotate(7 ${s * 0.73} ${s * 0.27})"/>
  </g>
  <!-- crack web -->
  <g stroke="#08080a" fill="none" stroke-linecap="round" opacity="0.8">
    <path d="M ${s * 0.02} ${s * 0.3} q ${s * 0.12} ${s * 0.05} ${s * 0.2} ${s * 0.0}
             t ${s * 0.22} ${s * 0.08} t ${s * 0.2} -${s * 0.04}" stroke-width="${s * 0.007}"/>
    <path d="M ${s * 0.34} ${s * 0.33} q ${s * 0.03} ${s * 0.12} -${s * 0.02} ${s * 0.2}"
      stroke-width="${s * 0.005}"/>
    <path d="M ${s * 0.55} ${s * 0.86} q ${s * 0.1} -${s * 0.08} ${s * 0.24} -${s * 0.06}
             t ${s * 0.2} -${s * 0.1}" stroke-width="${s * 0.006}"/>
  </g>
  <!-- oil sheen where a car idles -->
  <ellipse cx="${s * 0.72}" cy="${s * 0.72}" rx="${s * 0.14}" ry="${s * 0.1}" fill="url(#oil)"/>
  <ellipse cx="${s * 0.24}" cy="${s * 0.18}" rx="${s * 0.1}" ry="${s * 0.07}" fill="url(#oil)"/>
</svg>`;

/** Sidewalk tile = ONE 2m concrete slab: expansion joints on two edges (the tile
 *  repeat turns them into the 2m joint grid), one hairline crack, edge grime. */
const sidewalkOverlay = (s) => `
<svg width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
  <!-- expansion joints: shadow line + lit lip reads as a real groove -->
  <rect x="0" y="0" width="${s * 0.012}" height="${s}" fill="#2f2c26" opacity="0.85"/>
  <rect x="${s * 0.012}" y="0" width="${s * 0.006}" height="${s}" fill="#b5b0a2" opacity="0.5"/>
  <rect x="0" y="0" width="${s}" height="${s * 0.012}" fill="#2f2c26" opacity="0.85"/>
  <rect x="0" y="${s * 0.012}" width="${s}" height="${s * 0.006}" fill="#b5b0a2" opacity="0.5"/>
  <!-- hairline crack off one corner -->
  <path d="M ${s * 0.7} ${s * 0.99} q ${s * 0.05} -${s * 0.18} ${s * 0.18} -${s * 0.26}"
    stroke="#3a362e" stroke-width="${s * 0.004}" fill="none" opacity="0.65"/>
  <!-- grime pooled along the joint -->
  <rect x="0" y="0" width="${s * 0.05}" height="${s}" fill="#22201c" opacity="0.12"/>
  <rect x="0" y="0" width="${s}" height="${s * 0.05}" fill="#22201c" opacity="0.12"/>
</svg>`;

// name → { src, size, overlay }.  All srcs are ambientCG 1K color maps (CC0).
const RECIPES = {
  'brick_a.jpg': { src: 'Bricks030_1K_Color.jpg', size: 1024 }, // warm red mix — bldg A hero wall
  'brick_b.jpg': { src: 'Bricks074_1K_Color.jpg', size: 1024 }, // red + pale mortar — bldg B
  'brick_aged.jpg': { src: 'Bricks073C_1K_Color.jpg', size: 1024 }, // sooty aged — west row + plinths
  'brick_grey.jpg': { src: 'Bricks034_1K_Color.jpg', size: 512 }, // blue-grey — teal-tinted c1
  'asphalt.jpg': { src: 'Asphalt016_1K_Color.jpg', size: 1024, overlay: asphaltOverlay },
  'sidewalk.jpg': { src: 'Concrete037_1K_Color.jpg', size: 1024, overlay: sidewalkOverlay },
  'wood.jpg': { src: 'Planks013_1K_Color.jpg', size: 512 }, // grimy dark planks — storefront band
  'stucco.jpg': { src: 'Concrete006_1K_Color.jpg', size: 512 }, // smooth render — c3 massing
};

// Mean-luma target 0.55 with the gain capped at 1.8× — dark sources (sooty brick,
// grimy planks) keep their character instead of clipping to chalk. The engine tint
// compensates: createEnvironmentMaterial scales the palette diffuse by 1/0.55.
const TARGET_LUMA = 0.55 * 255;
const MAX_GAIN = 1.8;

for (const [out, r] of Object.entries(RECIPES)) {
  const srcPath = path.join(srcDir, r.src);
  // Desaturate first so the normalize pass measures the shipped grey balance.
  let img = sharp(srcPath).resize(r.size, r.size, { fit: 'cover' }).modulate({ saturation: 0.6 });
  const stats = await sharp(await img.toBuffer()).stats();
  const luma =
    0.299 * stats.channels[0].mean + 0.587 * stats.channels[1].mean + 0.114 * stats.channels[2].mean;
  img = sharp(await img.linear(Math.min(TARGET_LUMA / luma, MAX_GAIN), 0).toBuffer());
  if (r.overlay) {
    img = img.composite([{ input: Buffer.from(r.overlay(r.size)) }]);
  }
  await img.jpeg({ quality: 78, progressive: true }).toFile(path.join(outDir, out));
  const kb = ((await sharp(path.join(outDir, out)).metadata()).size / 1024) | 0;
  console.log(`${out}  ${r.size}px  ${kb}KB  (from ${r.src}, mean luma ${(luma / 255).toFixed(2)} → 0.72)`);
}
console.log('done →', outDir);
