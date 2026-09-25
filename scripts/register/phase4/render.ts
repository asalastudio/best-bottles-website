#!/usr/bin/env tsx
/**
 * Phase 4, step 2: render every pilot SKU from the register and composite its
 * legacy kit, both in the kit's own frame, for the parity gate.
 *
 *   npx tsx scripts/register/phase4/render.ts            # all 145 pilot SKUs
 *   npx tsx scripts/register/phase4/render.ts GBCyl9MtlRollBlkDot,...   # a subset
 *   ... --frame recorded                                  # frame on the kit's recorded anchors instead
 *
 * The new render is the plate for the SKU's glass plus its own parts
 * (assemblies.csv buildParts), each cut-out at its native px/mm, placed by
 * src/lib/register/compose.ts. The frame comes from the SKU's legacy kit
 * (frameFromLegacyKit: same axis, seat and foot), or from the pilot datum
 * (the most common kit frame) when a SKU has no kit. The legacy composite is
 * the kit's own full-canvas parts stacked in zOrder, which is what the PDP
 * paints today.
 *
 * By default the kit's frame is read from its body layer's pixels (first and
 * last rows with alpha, and the barrel's centre), because that is where the
 * customer sees the bottle: 133 of 133 pilot kits record axisX = 500, but
 * their bodies stand up to 8 px off it, and their recorded foot sits 1–5 px
 * below the glass. The recorded anchors stay in the manifest for reference.
 *
 * Writes output/register-phase4/renders/<websiteSku>/{new,legacy}[-body|-closure|-behind].png
 * (the last three are the same picture split by slot group, for the gate's
 * per-part overlap) and renders/manifest.json. Reads the pilot cut-outs from
 * output/register-phase3/pilot/ and the kits from fetch-legacy-kits.ts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { compose, footY, frameFromDatum, frameFromLegacyKit, type Frame, type LayerGeometry, type PlateGeometry, type Placement } from "../../../src/lib/register/compose";
import { pilotAssemblies, PILOT_BODY_ID, ROOT } from "./pilot";

const PILOT = resolve(ROOT, "output", "register-phase3", "pilot");
const LEGACY = resolve(ROOT, "output", "register-phase4", "legacy");
const OUT = resolve(ROOT, "output", "register-phase4", "renders");
const CANVAS = { width: 1000, height: 1100 };

type Measurements = {
    bodyId: string;
    plates: (PlateGeometry & { plateKey: string; glass: string; file: string })[];
    components: { componentId: string; type: string; layers: (LayerGeometry & { file: string })[] }[];
};
type KitPart = { slot: string; zOrder: number; image: { url: string; sha256: string; width: number; height: number } };
type Kit = { canvas: { width: number; height: number }; anchors: { axisX: number; seatY: number; baselineY: number }; parts: KitPart[]; plateSha256: string };

/** Legacy slots that stand behind the glass; everything else that is not the body is the closure. */
const BEHIND_SLOTS = new Set(["roller", "diptube"]);
const ALPHA = 16;

/** The legacy body as drawn: its first and last rows with alpha, and the centre of its barrel (rows 30–70 % down). */
async function measureLegacyBody(kit: Kit): Promise<{ axisX: number; seatY: number; baselineY: number } | null> {
    const body = kit.parts.find((part) => part.slot === "body");
    if (!body) return null;
    const ext = body.image.url.split("?")[0].split(".").pop() ?? "webp";
    const path = resolve(LEGACY, "parts", `${body.image.sha256}.${ext}`);
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rows: number[] = [];
    const centres: number[] = [];
    for (let y = 0; y < info.height; y++) {
        let first = -1, last = -1;
        for (let x = 0; x < info.width; x++) {
            if (data[(y * info.width + x) * info.channels + 3] > ALPHA) { if (first < 0) first = x; last = x; }
        }
        if (first >= 0) { rows.push(y); centres.push((first + last) / 2); }
    }
    if (!rows.length) return null;
    const seatY = rows[0], baselineY = rows[rows.length - 1];
    const barrel = centres.filter((_, i) => rows[i] >= seatY + 0.3 * (baselineY - seatY) && rows[i] <= seatY + 0.7 * (baselineY - seatY)).sort((a, b) => a - b);
    return { axisX: barrel[Math.floor(barrel.length / 2)] ?? kit.anchors.axisX, seatY, baselineY };
}

async function overlay(file: string, placement: Placement<unknown>, frame: Frame) {
    const width = Math.max(1, Math.round(placement.width));
    const height = Math.max(1, Math.round(placement.height));
    const x = Math.round(placement.x), y = Math.round(placement.y);
    // sharp composites only what fits inside the base: crop the scaled image to the canvas.
    const left = Math.max(0, x), top = Math.max(0, y);
    const right = Math.min(frame.width, x + width), bottom = Math.min(frame.height, y + height);
    if (right <= left || bottom <= top) return null;
    const input = await sharp(file).ensureAlpha()
        .resize(width, height, { fit: "fill", kernel: "lanczos3" })
        .extract({ left: left - x, top: top - y, width: right - left, height: bottom - top })
        .png().toBuffer();
    return { input, left, top };
}

async function renderNew(plate: Measurements["plates"][number], layers: (LayerGeometry & { file: string })[], frame: Frame, file: string, only?: "plate" | "front" | "behind") {
    const placements = compose(plate, layers, frame).filter((placement) => {
        if (!only) return true;
        if (only === "plate") return placement.kind === "plate";
        return placement.kind === "layer" && ((placement.source as LayerGeometry).z === "behind-body") === (only === "behind");
    });
    const overlays = [];
    for (const placement of placements) {
        const source = placement.source as { file: string };
        const layer = await overlay(resolve(PILOT, source.file), placement, frame);
        if (layer) overlays.push(layer);
    }
    await sharp({ create: { width: frame.width, height: frame.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(overlays).png().toFile(file);
}

async function renderLegacy(kit: Kit, file: string, only?: "body" | "closure" | "behind") {
    const parts = [...kit.parts].sort((a, b) => a.zOrder - b.zOrder).filter((part) => {
        if (!only) return true;
        if (only === "body") return part.slot === "body";
        if (only === "behind") return BEHIND_SLOTS.has(part.slot);
        return part.slot !== "body" && !BEHIND_SLOTS.has(part.slot);
    });
    const overlays = [];
    for (const part of parts) {
        const ext = part.image.url.split("?")[0].split(".").pop() ?? "webp";
        const path = resolve(LEGACY, "parts", `${part.image.sha256}.${ext}`);
        if (!existsSync(path)) throw new Error(`missing legacy part ${path}; run fetch-legacy-kits.ts`);
        // Kit parts are full-canvas images registered to the plate: they stack at (0, 0).
        overlays.push({ input: await sharp(path).ensureAlpha().png().toBuffer(), left: 0, top: 0 });
    }
    await sharp({ create: { width: kit.canvas.width, height: kit.canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(overlays).png().toFile(file);
}

async function main() {
    const argv = process.argv.slice(2);
    const frameMode = argv.includes("--frame") ? argv[argv.indexOf("--frame") + 1] : "pixels";
    if (frameMode !== "pixels" && frameMode !== "recorded") throw new Error("--frame must be pixels or recorded");
    const only = new Set(argv.filter((a) => !a.startsWith("--") && a !== frameMode).join(",").split(",").map((s) => s.trim()).filter(Boolean));
    const m = JSON.parse(readFileSync(resolve(ROOT, "data", "register", "phase3", "pilot-measurements.json"), "utf8")) as Measurements;
    if (m.bodyId !== PILOT_BODY_ID) throw new Error(`measurements are for ${m.bodyId}, expected ${PILOT_BODY_ID}`);
    const kitsFile = resolve(LEGACY, "kits.json");
    if (!existsSync(kitsFile)) throw new Error("run fetch-legacy-kits.ts first");
    const kits = (JSON.parse(readFileSync(kitsFile, "utf8")) as { kits: Record<string, Kit | null> }).kits;
    const plates = new Map(m.plates.map((plate) => [plate.glass, plate]));
    const components = new Map(m.components.map((component) => [component.componentId, component]));

    // The pilot datum: the frame most kits share, for SKUs without a kit.
    const frameCounts = new Map<string, { count: number; kit: Kit }>();
    for (const kit of Object.values(kits)) {
        if (!kit) continue;
        const key = `${kit.canvas.width}x${kit.canvas.height}@${kit.anchors.axisX},${kit.anchors.seatY},${kit.anchors.baselineY}`;
        const entry = frameCounts.get(key) ?? { count: 0, kit };
        entry.count++;
        frameCounts.set(key, entry);
    }
    const datumKit = [...frameCounts.values()].sort((a, b) => b.count - a.count)[0]?.kit;
    const datum = datumKit ? { canvas: datumKit.canvas, anchors: datumKit.anchors } : { canvas: CANVAS, anchors: { axisX: 500, seatY: 279, baselineY: 1055 } };

    mkdirSync(OUT, { recursive: true });
    const manifest: Record<string, unknown>[] = [];
    let rendered = 0;
    for (const assembly of pilotAssemblies()) {
        if (only.size && !only.has(assembly.websiteSku) && !only.has(assembly.graceSku)) continue;
        const plate = plates.get(assembly.glass);
        if (!plate) { console.error(`${assembly.websiteSku}: no plate for glass ${assembly.glass}`); continue; }
        const layers: (LayerGeometry & { file: string; componentId: string })[] = [];
        const missing: string[] = [];
        for (const part of assembly.buildParts) {
            const component = components.get(part.componentId);
            if (!component) { missing.push(part.componentId); continue; }
            for (const layer of component.layers) layers.push({ ...layer, componentId: part.componentId });
        }
        if (missing.length) { console.error(`${assembly.websiteSku}: no measured layers for ${missing.join(", ")}`); continue; }
        const kit = kits[assembly.graceSku] ?? null;
        const measured = kit && frameMode === "pixels" ? await measureLegacyBody(kit) : null;
        const frame = kit
            ? frameFromLegacyKit({ canvas: kit.canvas, anchors: measured ?? kit.anchors }, plate)
            : frameFromDatum(datum.canvas, datum.anchors, plate);
        const dir = resolve(OUT, assembly.websiteSku);
        mkdirSync(dir, { recursive: true });
        await renderNew(plate, layers, frame, resolve(dir, "new.png"));
        await renderNew(plate, layers, frame, resolve(dir, "new-body.png"), "plate");
        await renderNew(plate, layers, frame, resolve(dir, "new-closure.png"), "front");
        await renderNew(plate, layers, frame, resolve(dir, "new-behind.png"), "behind");
        if (kit) {
            await renderLegacy(kit, resolve(dir, "legacy.png"));
            await renderLegacy(kit, resolve(dir, "legacy-body.png"), "body");
            await renderLegacy(kit, resolve(dir, "legacy-closure.png"), "closure");
            await renderLegacy(kit, resolve(dir, "legacy-behind.png"), "behind");
        }
        manifest.push({
            websiteSku: assembly.websiteSku, graceSku: assembly.graceSku, glass: assembly.glass, fitmentType: assembly.fitmentType,
            capColor: assembly.capColor, buildParts: assembly.buildParts, layers: layers.map((l) => ({ componentId: l.componentId, slot: l.slot, z: l.z, explodeIndex: l.explodeIndex })),
            frame, frameSource: kit ? (measured ? "legacy-kit-pixels" : "legacy-kit-anchors") : "pilot-datum",
            expected: { seatY: frame.seatY, footY: footY(plate, frame), axisX: frame.axisX },
            legacy: kit ? { anchors: kit.anchors, measured, canvas: kit.canvas, plateSha256: kit.plateSha256, parts: kit.parts.map((p) => ({ slot: p.slot, zOrder: p.zOrder })) } : null,
        });
        rendered++;
        if (rendered % 20 === 0) console.log(`  ${rendered} rendered`);
    }
    writeFileSync(resolve(OUT, "manifest.json"), JSON.stringify({ renderedAt: new Date().toISOString(), bodyId: PILOT_BODY_ID, frameMode, datum, canvas: CANVAS, items: manifest }, null, 1));
    console.log(`${rendered} SKUs rendered → ${OUT}; datum ${JSON.stringify(datum.anchors)} on ${datum.canvas.width}×${datum.canvas.height}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
