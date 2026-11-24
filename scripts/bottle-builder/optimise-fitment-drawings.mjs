#!/usr/bin/env node
/**
 * Display copies of the Choose Your Fitment pencil drawings.
 *
 * The drawings are kept as PNG masters (public/images/bottle-builder/fitment-pencil-*.png; their
 * sources are recorded in data/paper-doll/fitment-illustration-sources.json). The builder used to
 * load the masters themselves: 1.75 MB for the sheet of eight, 0.6 MB each for the reducer and the
 * 18-415 perfume sprayer, to draw tiles about 100 px tall. This writes a WebP copy of each, same
 * pixel size, which FitmentIllustration.tsx loads instead. The masters are not changed.
 *
 * Usage: node scripts/bottle-builder/optimise-fitment-drawings.mjs
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../public/images/bottle-builder");
/** Pencil hatching survives this quality with no visible change at the size the tiles draw. */
const QUALITY = 90;

for (const name of (await readdir(DIR)).filter((file) => /^fitment-pencil-.*\.png$/.test(file)).sort()) {
    const source = path.join(DIR, name), copy = source.replace(/\.png$/, ".webp");
    const { width, height } = await sharp(source).metadata();
    await sharp(source).webp({ quality: QUALITY, effort: 6, smartSubsample: true }).toFile(copy);
    const [before, after] = [(await stat(source)).size, (await stat(copy)).size];
    console.log(`${name}: ${width}x${height}, ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
}
