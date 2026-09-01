import pw from "/Users/jordanrichter/.hermes/hermes-agent/node_modules/playwright/index.js";
const { chromium } = pw;
const [url, outPrefix] = process.argv.slice(2);
const SWATCHES = ["Clear glass","Amber glass","Cobalt glass","Frosted glass","Swirl glass"];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader",
  "--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
for (const sw of SWATCHES) {
  const p = await b.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(13000);
  try {
    await p.getByRole("button", { name: sw }).first().click({ timeout: 12000 });
    await p.waitForLoadState("domcontentloaded");
  } catch { console.log("(no swatch: " + sw + ")"); await p.close(); continue; }
  await p.waitForTimeout(16000);
  const cv = await p.$("canvas");
  const box = cv ? await cv.boundingBox() : null;
  const f = `${outPrefix}-${sw.split(" ")[0].toLowerCase()}.png`;
  await p.screenshot({ path: f, clip: box || undefined, animations: "disabled" });
  console.log("shot " + f + (box ? "" : "  (NO CANVAS)"));
  await p.close();
}
await b.close();
