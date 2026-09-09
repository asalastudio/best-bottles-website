#!/usr/bin/env node
/**
 * contact-sheet.mjs — render EVERY glass finish in one pass, into one image.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-09-01 five finishes regressed at once and nobody noticed until
 * Jordan did: "clear glass, amber and cobalt look very different than they
 * were before... we keep falling back to the same bullshit again and again."
 *
 * The cause was not carelessness about any one value. It was that the knobs
 * with the WIDEST blast radius are also the easiest to change:
 * colorManagement.ts (tone mapping + exposure) and StudioEnvironment.tsx
 * (the lights) re-tune ALL FIVE finishes simultaneously, and every judgement
 * that day was made on a single amber bottle. A change that improves amber
 * and quietly ruins cobalt is invisible if you only ever look at amber.
 *
 * So: one command, every finish, side by side, before and after. If a change
 * is supposed to affect one finish and the sheet shows four moving, that is
 * the bug — visible in seconds instead of three days later.
 *
 * REQUIRES PLAYWRIGHT, deliberately NOT added to devDependencies: adding it
 * would touch package-lock.json, which is the single worst file to carry in a
 * PR on a repo with this many parallel branches. Install it when you need the
 * sheet:  npx playwright install chromium  (or npm i -D playwright)
 *
 *   node scripts/materials/contact-sheet.mjs                  # -> sheet.png
 *   node scripts/materials/contact-sheet.mjs --out before.png
 *   node scripts/materials/contact-sheet.mjs --port 3100
 *
 * Pair it with the lock, which catches the same class of problem from the
 * other side:
 *   python3 pipeline/paper-doll-3d/scripts/material_lock.py verify
 * The lock proves NOTHING changed; the sheet shows WHAT a change did.
 */
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const PORT = arg("--port", "3000");
const OUT = arg("--out", "sheet.png");
const BASE = `http://localhost:${PORT}/products/cylinder-9ml-amber-17-415-finemist`;

// The five shipping glass finishes. Swatch labels are the accessible names
// on the PDP colourway buttons.
const FINISHES = ["Clear glass", "Amber glass", "Cobalt glass",
                  "Frosted glass", "Swirl glass"];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader",
         "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const shots = [];
for (const name of FINISHES) {
  // a FRESH page per finish: clicking a colourway navigates to another SKU,
  // and reusing one page captured half-loaded canvases
  const page = await browser.newPage({
    viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(13000);              // first paint + GLB load
    await page.getByRole("button", { name }).first().click({ timeout: 12000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(16000);              // transmission needs frames
    const canvas = await page.$("canvas");
    if (!canvas) throw new Error("no canvas");
    const file = `.sheet-${name.split(" ")[0].toLowerCase()}.png`;
    await page.screenshot({ path: file, clip: await canvas.boundingBox(),
                            animations: "disabled" });
    shots.push([name.split(" ")[0], file]);
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.log(`  MISS ${name}  (${e.message.split("\n")[0]})`);
  }
  await page.close();
}
await browser.close();

if (!shots.length) { console.error("nothing rendered"); process.exit(1); }
const { execFileSync } = await import("node:child_process");
execFileSync("python3", ["-c", `
import sys
from PIL import Image, ImageDraw
pairs = [p.split("=") for p in sys.argv[1:-1]]
out = sys.argv[-1]
H = 820
ims = [(n, Image.open(f).convert("RGB")) for n, f in pairs if __import__("os").path.exists(f)]
ims = [(n, im.resize((int(im.width*H/im.height), H))) for n, im in ims]
W = sum(im.width for _, im in ims)
sheet = Image.new("RGB", (W, H+30), (245,243,239))
d = ImageDraw.Draw(sheet); x = 0
for n, im in ims:
    sheet.paste(im, (x, 30)); d.text((x+8, 9), n.upper(), fill=(40,38,34)); x += im.width
sheet.save(out); print("wrote", out, sheet.size)
`, ...shots.map(([n, f]) => `${n}=${f}`), OUT], { stdio: "inherit" });
for (const [, f] of shots) if (existsSync(f)) (await import("node:fs")).unlinkSync(f);
