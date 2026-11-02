import fs from "node:fs";
import { createHash } from "node:crypto";
import { stageLayout, availableViews, type KitLike, type StageView } from "../../../src/lib/products/pdp-redesign/stage";
import { withCylinder25LotionTube } from "../../../src/lib/register/cylinder-lotion-tube";
import { withCylinder25CopperOvercap } from "../../../src/lib/register/cylinder25-copper-overcap";

const dir = "docs/reviews/cylinder25-material-cleanup-2026-11-02";
const out = "public/local-kits/cylinder25-material-cleanup-2026-11-02";
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const old = JSON.parse(fs.readFileSync("public/local-kits/cylinder25-18415-2026-11-01/kits.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("docs/reviews/cylinder25-18415-2026-11-01/current-catalog.json", "utf8")).configurations;
const bytes = fs.readFileSync(dir + "/sources/25ml-clear-body-v2.png");
const sha256 = hash(bytes), name = "body-cylinder-25ml-clear." + sha256.slice(0, 12) + ".png";
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(out + "/" + name, bytes);
// Source landmarks remeasured in the generated image. One uniform scale maps
// rim and external foot onto the old datum; its shoulder target stays locked.
const native = { width: 851, height: 1849, rimY: 123, baselineY: 1768, axisX: 498 * 851 / 1008 };
const rows: Record<string, KitLike> = {}, before: Record<string, KitLike> = {};
for (const [sku, raw] of Object.entries(old.rows)) {
    const kit = structuredClone(raw) as KitLike;
    kit.parts = withCylinder25LotionTube(kit.parts, kit.register!.bodyId, kit.anchors.axisX, kit.anchors.pxPerMm!);
    before[sku] = structuredClone(kit);
    const body = kit.parts.find(p => p.slot === "body")!;
    const scale = (kit.anchors.baselineY - kit.anchors.seatY) / (native.baselineY - native.rimY);
    body.image = { url: "/local-kits/cylinder25-material-cleanup-2026-11-02/" + name, width: native.width, height: native.height,
        ...{ sha256, bytes: bytes.length } };
    body.box = { x: kit.anchors.axisX - native.axisX * scale, y: kit.anchors.seatY - native.rimY * scale,
        width: native.width * scale, height: native.height * scale };
    kit.parts = withCylinder25CopperOvercap(kit.parts, kit.register!.bodyId);
    rows[sku] = kit;
}
const version = hash(JSON.stringify(rows)).slice(0, 16);
fs.writeFileSync(out + "/kits.json", JSON.stringify({ version, status: "local-visual-review", rows, defaultPdpSkus: [] }, null, 2) + "\n");
fs.writeFileSync(dir + "/registration.json", JSON.stringify({ version, status: "candidate-not-approved", image: { file: out + "/" + name, sha256, bytes: bytes.length, ...native },
    source: "docs/reviews/gpt-master-library-2026-10-31/recovered-master-lock.json", target: { shoulderSpanPct: 46.5, baselinePct: 91 },
    configurations: Object.keys(rows).length, heldTasselConfigurations: 9,
    preserved: ["body bounds", "glassSizing", "canvas", "anchors", "neck finish", "head artwork", "tube material and endpoint", "other closures"],
    capChange: "Copper overcap alone; visible width, axis and bottom retained, source white scraps excluded; new cap is uniformly scaled.",
    generatedWith: "built-in image editor; model version not exposed" }, null, 2) + "\n");
const entries = Object.entries(rows).map(([sku, kit]) => {
    const c = catalog.find((r: { id: string }) => r.id === sku);
    const context = { websiteSku: sku, family: c.family, color: c.color, capacityMl: c.capacityMl, applicator: c.fitment };
    const views = availableViews(kit, context);
    return { sku, title: c.fitment + " · " + c.closure, views,
        product: "/products/" + c.product.productGroupSlug + "?sku=" + sku + "&assetPreview=gpt13",
        before: Object.fromEntries(views.map((view: StageView) => [view, stageLayout(before[sku], view, context)])),
        after: Object.fromEntries(views.map((view: StageView) => [view, stageLayout(kit, view, context)])) };
});
const template = fs.readFileSync(dir + "/review-template.html", "utf8");
const html = template.replace("__DATA__", JSON.stringify(entries).replace(/</g, "\\u003c"));
const review = "public/reviews/cylinder25-material-cleanup-2026-11-02";
fs.mkdirSync(review + "/sources", { recursive: true });
for (const name of ["25ml-lotion-head-original", "25ml-lotion-mechanism-original", "shiny-silver-pump-original"])
    fs.copyFileSync(dir + "/sources/" + name + ".png", review + "/sources/" + name + ".png");
fs.writeFileSync(review + "/index.html", html);
fs.writeFileSync(dir + "/review-data.json", JSON.stringify(entries, null, 2) + "\n");
console.log(JSON.stringify({ version, configurations: entries.length, candidateBodySha256: sha256, bytes: bytes.length }));
