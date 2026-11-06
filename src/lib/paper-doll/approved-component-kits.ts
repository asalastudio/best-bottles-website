import "server-only";
import pillarCaps from "../../../public/local-kits/pillar-caps-2026-11-04/kits.json";
import pillarSprayers from "../../../public/local-kits/pillar-masters-2026-11-04/kits.json";
import { aliases } from "../products/display-images.generated.json";
import { isPillarRollOnSku, PILLAR_POUR_CAP_SUFFIXES } from "../products/pillar-master";
import manifest from "./approved-kits.generated.json";
import sprays from "./cylinder-spray-kits.generated.json";
import jumbo from "./cylinder-jumbo-overcap.generated.json";
import lotions from "./cylinder-lotion-kits.generated.json";
import spraySeating from "./cylinder-spray-seating.json";
import sleekTubes from "./sleek-large-tubes.generated.json";
import cylinder25Droppers from "./cylinder25-dropper.generated.json";
import cylinder25Reducers from "./cylinder25-reducers.generated.json";
import { CYLINDER25_COPPER_OVERCAP } from "../register/cylinder25-copper-overcap";
import { withSelected25LotionTube } from "../register/cylinder-lotion-tube";
import type { KitLike } from "@/lib/products/pdp-redesign/stage";
import type { BuilderKit, BuilderPart } from "@/lib/bottle-builder/model";

/** Exact owner-approved recipes, independent of the localhost candidate loader. */
const existingRows = manifest.rows as unknown as Record<string, BuilderKit>;
const bodySources = {
    Amber: { url: "/images/cylinder9-masters-2026-11-02/amber.webp", sha256: "e6671c4638ca3141ffd85545a4e9e9409d9e6b979b9d8bdac56873649b81c37d", bytes: 681404, left: 114, right: 629, top: 105, bottom: 2036 },
    "Cobalt Blue": { url: "/images/cylinder9-masters-2026-11-02/cobalt-v2.webp", sha256: "2d83ca5c7262a85d660a39a95be9934e9db39d630f786758f2e6471fdf905615", bytes: 661784, left: 114, right: 630, top: 102, bottom: 2046 },
} as const;
const cylinderNineColorRows = Object.fromEntries(Object.entries(existingRows).flatMap(([sku, kit]) => {
    if (kit.register?.bodyId !== "cylinder-9ml-17-415") return [];
    const source = bodySources[kit.register.glass as keyof typeof bodySources];
    if (!source) return [];
    const scale = (2018 - 113) / (source.bottom - source.top);
    return [[sku, { ...kit, parts: kit.parts.map(part => {
        if (part.slot !== "body" || !part.box) return part;
        const pixelScale = part.box.width / 743;
        return { ...part, image: { ...part.image, url: source.url, key: source.url, sha256: source.sha256, bytes: source.bytes },
            image2x: null, box: { ...part.box,
                x: part.box.x + pixelScale * (375 - (source.left + source.right) / 2 * scale),
                y: part.box.y + pixelScale * (113 - source.top * scale),
                width: part.box.width * scale, height: part.box.height * scale } };
    }) }]];
}));
// The recovered copper spray component references a silver cap. Use the
// previously cleaned copper master, registered by its visible width and foot.
const correctedSprays = Object.fromEntries(Object.entries(sprays.rows).map(([sku, value]) => {
    const kit = value as unknown as BuilderKit;
    const seating = spraySeating[sku as keyof typeof spraySeating] as { sprayer: number; overcap?: number };
    return [sku, { ...kit, parts: kit.parts.map(part => {
        if (part.slot === "diptube" && part.box) {
            // Generated from the selected PSD references. Register the full
            // 100 ml part in physical scale; shorter bottles clip the shaft
            // rather than shrinking the connector or changing its thickness.
            const top = part.bounds.top + seating.sprayer;
            // Fine mist, bulb and tassel share the selected fine-mist tube.
            const source = { url: "/images/cylinder-sprays/finemist-tube-90380032f33f.png", sha256: "90380032f33f09056c1dae23a1bed44a260ca3944afc7e07ef9d233d6677c6fc", bytes: 201725, width: 725, height: 2170, top: 54, bottom: 2109, axis: 414, left: 284, right: 465 };
            const reference = (sprays.rows.GBCyl100SpryMtGl as unknown as BuilderKit);
            const referenceTube = reference.parts.find(p => p.slot === "diptube")!;
            const referenceTop = referenceTube.bounds.top + spraySeating.GBCyl100SpryMtGl.sprayer;
            const referenceScale = (referenceTube.bounds.bottom - referenceTop) / (source.bottom - source.top);
            const scale = referenceScale * (kit.anchors.pxPerMm ?? 5.14) / (reference.anchors.pxPerMm ?? 5.14);
            const x = kit.anchors.axisX - source.axis * scale;
            const y = top - source.top * scale;
            const trimBottomPct = Math.max(0, Math.min(100, 100 * (1 - (part.bounds.bottom - y) / (source.height * scale))));
            return { ...part, image: { url: source.url, key: source.url, sha256: source.sha256, bytes: source.bytes, width: source.width, height: source.height },
                image2x: null, box: { x, y, width: source.width * scale, height: source.height * scale }, trimBottomPct,
                opacity: part.views?.includes("exploded") ? 1 : 0.3,
                bounds: { left: x + source.left * scale, top, right: x + source.right * scale, bottom: part.bounds.bottom } };
        }
        const dy = part.slot === "sprayer" ? seating.sprayer : part.slot === "overcap" ? seating.overcap ?? 0 : 0;
        const shifted = { ...part, box: part.box ? { ...part.box, y: part.box.y + dy } : part.box,
            bounds: { ...part.bounds, top: part.bounds.top + dy, bottom: part.bounds.bottom + dy } };
        if (!/^(?:GBcyl25|GBCyl50|GBCyl100)SpryCu$/.test(sku) || part.slot !== "overcap" || !shifted.box) return shifted;
        const { left, right, bottom } = shifted.bounds;
        const scale = (right - left) / (904 - 101);
        const x = (left + right) / 2 - (101 + 904) / 2 * scale;
        const y = bottom - 1532 * scale;
        return { ...shifted, image: { ...CYLINDER25_COPPER_OVERCAP }, image2x: null,
            box: { x, y, width: CYLINDER25_COPPER_OVERCAP.width * scale, height: CYLINDER25_COPPER_OVERCAP.height * scale },
            bounds: { left, right, top: y + 154 * scale, bottom } };
    }) }];
}));
const correctedJumbo = Object.fromEntries(Object.entries(jumbo.rows).map(([sku, value]) => {
    const kit = value as unknown as BuilderKit;
    return [sku, kit.register?.bodyId === "cylinder-25ml-18-415"
        ? { ...kit, parts: withSelected25LotionTube(kit.parts, kit.register.bodyId, kit.anchors.axisX) } : kit];
}));
const correctedLotions = Object.fromEntries(Object.entries(lotions.rows).map(([sku, value]) => {
    // Keep the corrected clear-overcap assembly; all other variants use their
    // original pump and cap layers and the same glass as the spray recipes.
    const kit = (correctedJumbo as Record<string, BuilderKit>)[sku] ?? value as unknown as BuilderKit;
    const size = /cylinder-(25|50|100)ml-18-415/.exec(kit.register?.bodyId ?? "")?.[1];
    const bodySku = size === "25" ? "GBcyl25SpryMtGl" : `GBCyl${size}SpryMtGl`;
    const body = (correctedSprays as Record<string, BuilderKit>)[bodySku]?.parts.find(part => part.slot === "body");
    let parts = kit.parts.map(part => part.slot === "body" && body ? { ...part, image: body.image, image2x: body.image2x } : part);
    if (size !== "25" && /ClOvrCap$/i.test(sku)) {
        // The older overcap includes the pump in its pixels. Reuse the clean
        // 25 ml clear cover, registered to this size's existing pump.
        const reference = (correctedJumbo as Record<string, BuilderKit>).LBcyl25LtnClOvrCap;
        const fromPump = reference.parts.find(part => part.slot === "pump")!;
        const toPump = kit.parts.find(part => part.slot === "pump")!;
        const scale = (kit.anchors.pxPerMm ?? 1) / (reference.anchors.pxPerMm ?? 1);
        const tx = (x: number) => kit.anchors.axisX + (x - reference.anchors.axisX) * scale;
        const ty = (y: number) => toPump.bounds.bottom + (y - fromPump.bounds.bottom) * scale;
        const box = (v: NonNullable<typeof fromPump.box>) => ({ x: tx(v.x), y: ty(v.y), width: v.width * scale, height: v.height * scale });
        const bounds = (v: typeof fromPump.bounds) => ({ left: tx(v.left), right: tx(v.right), top: ty(v.top), bottom: ty(v.bottom) });
        const covers = reference.parts.filter(part => part.slot === "overcap").map(part => ({
            ...part, componentId: toPump.componentId,
            box: part.box ? box(part.box) : part.box, bounds: bounds(part.bounds),
            detached: part.detached ? { ...part.detached, box: box(part.detached.box), bounds: bounds(part.detached.bounds) } : part.detached,
        }));
        parts = [...parts.filter(part => part.slot !== "overcap"), ...covers];
    }
    return [sku, { ...kit, parts: withSelected25LotionTube(parts, kit.register!.bodyId, kit.anchors.axisX) }];
}));
// The photographed white actuator and its long plastic chamber belong only
// to the 9 ml / 17-415 lotion pump. Keep its collar, cover and glass masters.
const correctedNineLotionRows = Object.fromEntries(Object.entries(existingRows)
    .filter(([, kit]) => kit.register?.bodyId === "cylinder-9ml-17-415" && kit.parts.some(part => part.slot === "pump"))
    .map(([sku, original]) => {
        const kit = (cylinderNineColorRows as Record<string, BuilderKit>)[sku] ?? original;
        return [sku, { ...kit, parts: kit.parts.map(part => {
            if (part.slot === "pump" && part.box) {
                const url = "/images/cylinder-sprays/lotion9-actuator-7ba9d00b02f5.png";
                const scale = (part.bounds.right - part.bounds.left) / (1034 - 222);
                const x = kit.anchors.axisX - 628 * scale, y = part.bounds.top - 59 * scale;
                return { ...part, image: { url, key: url, sha256: "7ba9d00b02f5bec4913e01ac99a790efc394aad7b7ceb6ead162ab3a01ba0f3f", bytes: 1018532, width: 1274, height: 1235 },
                    image2x: null, box: { x, y, width: 1274 * scale, height: 1235 * scale },
                    bounds: { left: x + 222 * scale, right: x + 1034 * scale, top: part.bounds.top, bottom: y + 1180 * scale } };
            }
            if (part.slot === "diptube" && part.box) {
                const url = "/images/cylinder-sprays/lotion9-mechanism-e912bf1bf96d.png";
                const top = part.bounds.top, bottom = part.bounds.bottom;
                const sx = 0.24, sy = (bottom - top) / (1774 - 113);
                const x = kit.anchors.axisX - 424 * sx, y = top - 113 * sy;
                return { ...part, image: { url, key: url, sha256: "e912bf1bf96d1371b4e99032e149035be55779ab5e28eba66c039c281fa25edf", bytes: 277428, width: 850, height: 1850 },
                    image2x: null, box: { x, y, width: 850 * sx, height: 1850 * sy },
                    bounds: { left: x + 256 * sx, right: x + 593 * sx, top, bottom },
                    opacity: part.views?.includes("exploded") ? 1 : 0.3 };
            }
            return part;
        }) }];
    }));
// The Sleek molds have different internal floors from the round Cylinders.
// Coordinates below are visual landmarks on each existing 2192 px plate.
const sleekLandmarks: Record<string, { shoulder: number; floor: number }> = {
    "sleek-30ml-18-415": { shoulder: 463, floor: 1845 },
    "sleek-50ml-18-415": { shoulder: 354, floor: 1830 },
    "sleek-100ml-18-415": { shoulder: 311, floor: 1810 },
};
const correctedSleek = Object.fromEntries(Object.entries(sleekTubes.rows).map(([sku, value]) => {
    const kit = value as unknown as BuilderKit;
    const body = kit.parts.find(part => part.slot === "body");
    const landmarks = sleekLandmarks[kit.register?.bodyId ?? ""];
    if (!body?.box || !landmarks) return [sku, kit];
    if (kit.parts.some(part => part.image.url.endsWith("/sleek-18-415-spray-regenerated.webp"))) return [sku, kit];
    const top = body.box.y + body.box.height * landmarks.shoulder / body.image.height;
    const bottom = body.box.y + body.box.height * landmarks.floor / body.image.height;
    const lotion = kit.parts.some(part => part.slot === "pump");
    const use100 = kit.register?.bodyId === "sleek-100ml-18-415";
    const src = lotion ? (use100
        ? { url: "/images/cylinder-sprays/lotion100-b1a4e22a8bfc.png", sha256: "b1a4e22a8bfc9d070f835e68a6d0b293f4a589f677dcd5e409f380a42a43dfe8", bytes: 242296, width: 724, height: 2172, top: 20, bottom: 2151, axis: 366.5, left: 292, right: 455, perMm: 0.059819839358 }
        : { url: "/images/cylinder-sprays/lotion50-571a47a5cc8b.png", sha256: "571a47a5cc8be422db5c788835e3dc183bc9a1e26ea393ab7ec3b85a6c2c55f3", bytes: 283534, width: 724, height: 2171, top: 17, bottom: 2145, axis: 352.5, left: 264, right: 452, perMm: 0.045674789508 })
        : { url: "/images/cylinder-sprays/finemist-tube-90380032f33f.png", sha256: "90380032f33f09056c1dae23a1bed44a260ca3944afc7e07ef9d233d6677c6fc", bytes: 201725, width: 725, height: 2170, top: 54, bottom: 2109, axis: 414, left: 284, right: 465, perMm: 0.062520817521 };
    const sx = src.perMm * (kit.anchors.pxPerMm ?? 1);
    // Longer shafts may be clipped, while a short source extends vertically
    // without enlarging the pump connection or changing the glass body.
    const sy = Math.max(sx, (bottom - top) / (src.bottom - src.top));
    const x = kit.anchors.axisX - src.axis * sx, y = top - src.top * sy;
    const trimBottomPct = Math.max(0, Math.min(100, 100 * (1 - (bottom - y) / (src.height * sy))));
    return [sku, { ...kit, parts: kit.parts.map(part => part.slot !== "diptube" ? part : {
        ...part, image: { url: src.url, key: src.url, sha256: src.sha256, bytes: src.bytes, width: src.width, height: src.height }, image2x: null,
        box: { x, y, width: src.width * sx, height: src.height * sy }, trimBottomPct,
        bounds: { left: x + src.left * sx, right: x + src.right * sx, top, bottom },
        opacity: part.views?.includes("exploded") ? 1 : 0.3,
    }) }];
}));
const correctedCylinder25Droppers = Object.fromEntries(Object.entries(cylinder25Droppers.rows).map(([sku, value]) => {
    const kit = value as unknown as BuilderKit;
    const body = (correctedSprays as Record<string, BuilderKit>).GBcyl25SpryMtGl.parts.find(part => part.slot === "body")!;
    const fitment = kit.parts.find(part => part.slot === "fitment")!;
    const top = fitment.bounds.bottom - 2, bottom = 974;
    const scale = (bottom - top) / (1425 - 114);
    const x = kit.anchors.axisX - 512 * scale, y = top - 114 * scale;
    const url = "/images/cylinder-sprays/cylinder25-glass-pipette-v1.png";
    return [sku, { ...kit, parts: kit.parts.map(part => {
        if (part.slot === "body") return { ...body, zOrder: 0 };
        if (part.slot === "fitment") return { ...part, zOrder: 2 };
        if (part.slot !== "pipette") return part;
        return { ...part, zOrder: -1, explodeIndex: fitment.explodeIndex, exploded: fitment.exploded,
            image: { url, key: url, sha256: "9a069232e1ad2a806d3d8a8b5d47ddb7c9eb5598479d826c0bcac742f9dc8102", bytes: 0, width: 1024, height: 1536 }, image2x: null,
            box: { x, y, width: 1024 * scale, height: 1536 * scale },
            bounds: { left: x + 438 * scale, right: x + 586 * scale, top, bottom }, opacity: 0.42, blendMode: "multiply" as const };
    }) }];
}));
// The owner measured the bare 28 ml and 50 ml bottles at 81.73 and 97.77 mm.
// Match the bare top-to-foot ratio at the existing 50 ml display scale.
const correctedJumbo28 = Object.fromEntries(Object.entries(existingRows)
    .filter(([, kit]) => kit.register?.bodyId === "cylinder-28ml-16mm" && kit.glassSizing)
    .map(([sku, kit]) => [sku, { ...kit, glassSizing: { ...kit.glassSizing!, heightPct: 44.06975268656447,
        source: "Measured 81.73 mm bare height relative to the 97.77 mm 50 ml bottle" } }]));
const proposedRows = { ...correctedJumbo28, ...correctedSprays, ...correctedJumbo, ...correctedLotions, ...cylinderNineColorRows, ...correctedNineLotionRows, ...correctedSleek, ...correctedCylinder25Droppers, ...cylinder25Reducers.rows } as unknown as Record<string, BuilderKit>;
const cylinderGlassSources = {
    "cylinder-25ml-18-415": {
        sku: "GBcyl25SpryMtGl", left: 81, wallWidth: 650, rim: 62, shoulder: 382, heel: 1872,
        image: { url: "/images/cylinder-sprays/body-25ml-clear-refraction.f496010b9f55.webp", key: "/images/cylinder-sprays/body-25ml-clear-refraction.f496010b9f55.webp", sha256: "f496010b9f55730fb597642049c3e5f84d045b949e9b65a4eddd771ddc82ad29", bytes: 256816, width: 813, height: 1935 },
    },
    "cylinder-50ml-18-415": {
        sku: "GBCyl50SpryMtGl", left: 83, wallWidth: 557, rim: 123, shoulder: 383, heel: 2121,
        image: { url: "/images/cylinder-sprays/body-50ml-clear-refraction.de57293fe027.webp", key: "/images/cylinder-sprays/body-50ml-clear-refraction.de57293fe027.webp", sha256: "de57293fe0274db2fcf9a64f7396fe4d337792b49a6d38111525226f58e02afd", bytes: 299054, width: 724, height: 2171 },
    },
    "cylinder-100ml-18-415": {
        sku: "GBCyl100SpryMtGl", left: 132, wallWidth: 461, rim: 97, shoulder: 308, heel: 2104,
        image: { url: "/images/cylinder-sprays/body-100ml-clear-refraction.9b35f4c3d557.webp", key: "/images/cylinder-sprays/body-100ml-clear-refraction.9b35f4c3d557.webp", sha256: "9b35f4c3d5571c5d204415dd5fc00b9b9fc5302369e3973d4b6e9593e970d1be", bytes: 223872, width: 724, height: 2171 },
    },
};
type CylinderGlassId = keyof typeof cylinderGlassSources;

export function withCylinderProductGlass(kit: KitLike): KitLike {
    const id = kit.register?.bodyId as CylinderGlassId | undefined;
    if (!id || kit.register?.glass !== "Clear" || !Object.hasOwn(cylinderGlassSources, id)) return kit;
    const source = cylinderGlassSources[id];
    const body = kit.parts.find(part => part.slot === "body");
    if (!body || body.image.url === source.image.url) return kit;
    const master = cylinderGlassMasters[id];
    const sizing = master.glassSizing;
    const reference = correctedSprays[source.sku] as BuilderKit;
    const bodyScaleY = (body.bounds.bottom - body.bounds.top) / (source.heel - source.rim);
    const glassSizing = sizing?.landmarkY === undefined ? kit.glassSizing : {
        ...sizing,
        heightPct: sizing.heightPct * (kit.canvas.width / kit.canvas.height) / (reference.canvas.width / reference.canvas.height),
        landmarkY: body.bounds.top + (source.shoulder - source.rim) * bodyScaleY,
    };
    return { ...kit, glassSizing, parts: kit.parts.map(part => {
        if (part !== body) return part;
        const { left, right, top, bottom } = part.bounds;
        // Keep the reducer's existing rim and baseline registration so its hardware stays seated.
        const sx = (right - left) / source.wallWidth;
        const sy = bodyScaleY;
        return { ...part, image: source.image, image2x: null,
            box: { x: left - source.left * sx, y: top - source.rim * sy,
                width: source.image.width * sx, height: source.image.height * sy } };
    }) };
}

const cylinderGlassMasters = Object.fromEntries(Object.entries(cylinderGlassSources).map(([id, source]) => {
    const reference = (correctedSprays as Record<string, BuilderKit>)[source.sku];
    const body = reference.parts.find(part => part.slot === "body")!;
    const shoulder = reference.glassSizing?.landmarkY;
    if (shoulder === undefined) throw new Error(`Missing Cylinder shoulder anchor for ${source.sku}`);
    const sx = (body.bounds.right - body.bounds.left) / source.wallWidth;
    const sy = (body.bounds.bottom - shoulder) / (source.heel - source.shoulder);
    return [id, {
        glassSizing: reference.glassSizing,
        body: { ...body, image: source.image, image2x: null,
            bounds: { ...body.bounds, top: shoulder - (source.shoulder - source.rim) * sy },
            box: { x: body.bounds.left - source.left * sx, y: shoulder - source.shoulder * sy,
                width: source.image.width * sx, height: source.image.height * sy } },
    }];
}));

// Share the registered body and framing across the compatible fitments.
const revisedRows = Object.fromEntries(Object.entries(proposedRows).map(([sku, kit]) => {
    const id = kit.register?.bodyId as CylinderGlassId | undefined;
    const master = id && Object.hasOwn(cylinderGlassMasters, id) ? cylinderGlassMasters[id] : null;
    if (!master || kit.register?.glass !== "Clear") return [sku, kit];
    return [sku, { ...kit, glassSizing: master.glassSizing, parts: kit.parts.map(part => {
        if (part.slot === "body") return { ...master.body, zOrder: part.zOrder };
        if (sku === cylinderGlassSources[id!].sku && part.box && (part.slot === "sprayer" || part.slot === "overcap")
            && master.glassSizing?.landmarkY !== undefined) {
            // Leave the thin glass shoulder highlight visible beneath the gold collar.
            const dy = Math.min(0, master.glassSizing.landmarkY - 4 - part.bounds.bottom);
            return { ...part, box: { ...part.box, y: part.box.y + dy },
                bounds: { ...part.bounds, top: part.bounds.top + dy, bottom: part.bounds.bottom + dy } };
        }
        if (id !== "cylinder-25ml-18-415" || part.slot !== "diptube" || !part.box) return part;
        const bottom = part.bounds.bottom - 8;
        const seated = !part.views?.includes("exploded");
        // Paint the seated tube through the Sunburst glass alpha so its
        // highlights and the interior floor retain their depth.
        const optics = seated ? { zOrder: master.body.zOrder - 1, opacity: 0.42 } : {};
        const bounds = { ...part.bounds, bottom };
        if (part.trimBottomPct !== undefined) {
            return { ...part, ...optics, bounds,
                trimBottomPct: Math.min(100, part.trimBottomPct + 800 / part.box.height) };
        }
        const scale = (bottom - part.bounds.top) / (part.bounds.bottom - part.bounds.top);
        return { ...part, ...optics, bounds, box: { ...part.box,
            y: part.bounds.top + (part.box.y - part.bounds.top) * scale,
            height: part.box.height * scale } };

    }) }];
})) as Record<string, BuilderKit>;
const publishedImageAliases: Readonly<Record<string, string>> = aliases;
type PillarKit = BuilderKit & { capCloseUp?: BuilderPart["image"] | null };
function hostedPillarKit(kit: PillarKit): PillarKit {
    const hostedImage = <T extends { url: string }>(image: T): T => {
        if (!image.url.startsWith("/local-kits/")) return image;
        const url = publishedImageAliases[image.url];
        if (!url) throw new Error(`Missing approved Pillar image for ${kit.sku}: ${image.url}`);
        return { ...image, url, ...("key" in image ? { key: url.startsWith("/") ? url : new URL(url).pathname.slice(1) } : {}) };
    };
    return {
        ...kit,
        parts: kit.parts.map(part => ({
            ...part,
            image: hostedImage(part.image),
            image2x: part.image2x ? hostedImage(part.image2x) : part.image2x,
            mask: part.mask ? hostedImage(part.mask) : part.mask,
            ...(part.detached ? { detached: { ...part.detached, image: hostedImage(part.detached.image) } } : {}),
        })),
        capCloseUp: kit.capCloseUp ? hostedImage(kit.capCloseUp) : kit.capCloseUp,
    };
}
const pillarRollOnRows = Object.fromEntries(Object.entries(pillarCaps.rows).filter(([sku]) => isPillarRollOnSku(sku)));
const pillarPourBase = pillarCaps.rows.GBPillar9BlkShSht as unknown as BuilderKit;
const cylinderPourSeat = existingRows.GBCyl5BlkShSht.parts.find(part => part.slot === "cap")!.bounds.bottom;
const pillarPourRows = Object.fromEntries(PILLAR_POUR_CAP_SUFFIXES.map(suffix => {
    const sku = `GBPillar9${suffix}`;
    if (suffix === "BlkShSht") return [sku, pillarPourBase];
    const donor = existingRows[`GBCyl5${suffix}`];
    const cap = donor.parts.find(part => part.slot === "cap")!;
    const pillarCap = pillarPourBase.parts.find(part => part.slot === "cap")!;
    const scale = pillarPourBase.anchors.pxPerMm! / donor.anchors.pxPerMm!;
    const box = cap.box!;
    const x = (value: number) => pillarPourBase.anchors.axisX + (value - donor.anchors.axisX) * scale;
    // Preserve the donor's measured cap length and its seating relative to the glass shoulder.
    const y = (value: number) => pillarCap.bounds.bottom + (value - cylinderPourSeat) * scale;
    const fittedCap = {
        ...cap,
        bounds: { left: x(cap.bounds.left), right: x(cap.bounds.right), top: y(cap.bounds.top), bottom: y(cap.bounds.bottom) },
        box: { x: x(box.x), y: y(box.y), width: box.width * scale, height: box.height * scale },
        exploded: { dx: 0, dy: pillarPourBase.anchors.seatY - y(cap.bounds.bottom) - 16 },
    };
    return [sku, {
        ...pillarPourBase,
        sku,
        parts: pillarPourBase.parts.map(part => part.slot === "cap" ? fittedCap : part),
        register: { ...pillarPourBase.register!, componentIds: [cap.componentId!] },
    }];
}));
const pillarKits = { ...pillarSprayers.rows, ...pillarRollOnRows, ...pillarPourRows } as unknown as Record<string, BuilderKit>;
const pillarRows = Object.fromEntries(Object.entries(pillarKits).map(([sku, kit]) => [sku, hostedPillarKit(kit)]));

const tulipGlass = {
    url: publishedImageAliases["/images/tulip6-clear-master.webp"],
    sha256: "18117b2e238d5eb497fbc6ee1851aa6e1055e5851a7c4e12237b2ca5f868567b",
    bytes: 878504, width: 1024, height: 1536,
};
const tulipRows = Object.fromEntries(Object.entries(existingRows).flatMap(([sku, kit]) => {
    if (kit.register?.bodyId !== "tulip-6ml-13-415" || kit.register.glass !== "Clear") return [];
    return [[sku, { ...kit, parts: kit.parts.map(part => {
        if (part.slot === "roller" && part.box) {
            // Keep the reviewed roller flange seated on the rim in the sidecar view.
            return { ...part, box: { ...part.box, y: part.box.y + 5 },
                bounds: { ...part.bounds, top: part.bounds.top + 5, bottom: part.bounds.bottom + 5 } };
        }
        if (part.slot !== "body") return part;
        const { left, right, top, bottom } = part.bounds;
        // Register the photographed glass by its visible bounds inside the image.
        const sx = (right - left) / 720;
        const sy = (bottom - top) / 1341;
        return { ...part, image: { ...tulipGlass, key: tulipGlass.url }, image2x: null,
            box: { x: left - 152 * sx, y: top - 103 * sy, width: tulipGlass.width * sx, height: tulipGlass.height * sy } };
    }) }]];
}));
const rows: Record<string, BuilderKit> = { ...existingRows, ...revisedRows, ...pillarRows, ...tulipRows };
export { APPROVED_KIT_VERSION } from "./approved-kit-index";

export function revisedCylinderKit(sku: string): BuilderKit | undefined {
    return Object.hasOwn(revisedRows, sku) ? revisedRows[sku] : undefined;
}
export function originalApprovedComponentKit(sku: string | null): BuilderKit | null {
    return sku && Object.hasOwn(existingRows, sku) ? existingRows[sku] : null;
}
export function approvedComponentKit(sku: string | null | undefined): BuilderKit | null {
    return sku && Object.hasOwn(rows, sku) ? rows[sku] : null;
}
export function approvedComponentKits(): Record<string, BuilderKit> { return rows; }
