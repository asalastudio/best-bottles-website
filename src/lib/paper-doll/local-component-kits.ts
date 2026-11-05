import "server-only";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "../bottle-builder/model";
import { approvedComponentKits, revisedCylinderKit } from "./approved-component-kits";
import { withCylinder25LotionTube, withSelected25LotionTube } from "../register/cylinder-lotion-tube";
import { withCylinder25CopperOvercap } from "../register/cylinder25-copper-overcap";
import { ELEGANT_PHOTO_BODIES } from "../register/elegant-photo-bodies";

// Keep older local files and bookmarked pilots on the current shared recipes
// for the Rectangle roll-ons and the corrected 9 ml / 13-415 pour-cap fit.
const currentSharedMasters = Object.fromEntries(Object.entries(approvedComponentKits()).filter(([sku, kit]) =>
    (/^GBRect10(?:MtlRoll|Roll)/.test(sku) && kit.register?.bodyId === "footed-rectangle-10ml-13-415")
    || (kit.register?.bodyId === "cylinder-9ml-13-415" && kit.parts.some(part => part.slot === "cap")
        && !kit.parts.some(part => ["sprayer", "roller"].includes(part.slot)))
    || (kit.register?.bodyId === "cylinder-9ml-17-415" && kit.parts.some(part => part.slot === "pump"))));
function withCurrentSharedMasters(rows: Record<string, BuilderKit>): Record<string, BuilderKit> {
    const current = { ...rows, ...Object.fromEntries(Object.entries(currentSharedMasters).filter(([sku]) => Object.hasOwn(rows, sku))) };
    return Object.fromEntries(Object.entries(current).map(([sku, kit]) => {
        const revised = revisedCylinderKit(sku);
        // A family review master (Round and Sleek, 3 Nov 2026) supersedes the earlier corrected Sleek tube recipes.
        if (revised && !(kit as { reviewMaster?: string }).reviewMaster) return [sku, revised];
        if (kit.register?.bodyId === "elegant-60ml-18-415" && kit.parts.some(part => part.slot === "reducer")) {
            const master = ELEGANT_PHOTO_BODIES[kit.register.plateKey];
            const body = kit.parts.find(part => part.slot === "body" && part.image.url.startsWith("/local-kits/elegant60-reducer-2026-10-31/"));
            if (master && body) {
                const target = body.bounds;
                const scale = (target.bottom - target.top) / (master.bounds.bottom - master.bounds.top);
                const x = (target.left + target.right) / 2 - (master.bounds.left + master.bounds.right) / 2 * scale;
                const y = target.top - master.bounds.top * scale;
                const round = (value: number) => Math.round(value * 100) / 100;
                const replacement = { ...body, image: { ...body.image, url: master.url, key: "", sha256: "", bytes: 0, width: master.width, height: master.height },
                    box: { x: round(x), y: round(y), width: round(master.width * scale), height: round(master.height * scale) },
                    bounds: { left: round(x + master.bounds.left * scale), top: round(y + master.bounds.top * scale),
                        right: round(x + master.bounds.right * scale), bottom: round(y + master.bounds.bottom * scale) } };
                // The photographed frosted body's shoulder is lower than the
                // original review art. Seat its cap against the visible shoulder.
                const capDrop = kit.register.plateKey === "elegant-60ml-18-415|Frosted" ? 26 : 0;
                return [sku, { ...kit, parts: kit.parts.map(part => {
                    if (part === body) return replacement;
                    if (!capDrop || part.slot !== "cap" || !part.box) return part;
                    return { ...part, box: { ...part.box, y: part.box.y + capDrop },
                        bounds: { ...part.bounds, top: part.bounds.top + capDrop, bottom: part.bounds.bottom + capDrop } };
                }) }];
            }
        }
        if (kit.register?.bodyId !== "cylinder-25ml-18-415") return [sku, kit];
        return [sku, {
            ...kit, parts: withCylinder25CopperOvercap(withSelected25LotionTube(withCylinder25LotionTube(kit.parts, kit.register.bodyId, kit.anchors.axisX, kit.anchors.pxPerMm ?? 10.5), kit.register.bodyId, kit.anchors.axisX), kit.register.bodyId),
        }];
    }));
}

type LocalKitReview = {
    rows: Record<string, BuilderKit>;
    /** Exact SKUs the operator wants to review through normal localhost navigation. */
    defaultPdpSkus?: string[];
};

function readLocalKitReview(): LocalKitReview | null {
    if (process.env.VERCEL) return null;
    const files = [process.env.BUILDER_LOCAL_KITS,
        process.env.NODE_ENV === "development" ? "public/local-kits/small-sprayers-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/cylinder5-profiles-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/elegant60-reducer-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/vial-4ml-measured-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/catalog-followups-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/cylinder5-all71-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/cylinder5-finemist-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/cylinder5-masters-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/cylinder9-masters-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/tulip-rollers-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/remaining-13-415-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/elegant15-additions-2026-11-03/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/elegant30-master-2026-11-03/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/elegant60-100-masters-2026-11-03/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/circle-masters-2026-11-03/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/boston-masters-2026-11-03/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/round-sleek-masters-2026-11-03/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/diva-masters-2026-11-03/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/cylinder25-18415-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/tulip-amber-seating-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/rectangle9-applicator-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/tulip6-glass-depth-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/vial2-matched-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/sleek8-glass-depth-2026-11-01/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/vial2-short-black-2026-11-02/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/vial3-swatches-builder-2026-11-02/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/jumbo28-archive-geometry-2026-11-02/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/jumbo-glass-2026-11-04/kits.json" : undefined,
        // Last: the Vial review kits (2 ml amber reshaped) must win over the vial2 lists above.
        process.env.NODE_ENV === "development" ? "public/local-kits/vial-masters-2026-11-03/kits.json" : undefined,
        // The Pillar 9 ml sprayers on the photographed body (4 Nov 2026) supersede the 13-415 pilot row.
        process.env.NODE_ENV === "development" ? "public/local-kits/pillar-masters-2026-11-04/kits.json" : undefined,
        // Empire, Grace and Diamond review kits (4 Nov 2026, scripts/empire-grace-diamond/).
        process.env.NODE_ENV === "development" ? "public/local-kits/egd-masters-2026-11-04/kits.json" : undefined,
        // The Pillar cap and roller SKUs on the photographed Pillar body (4 Nov 2026, scripts/pillar/pillar-cap-kits.mts).
        process.env.NODE_ENV === "development" ? "public/local-kits/pillar-caps-2026-11-04/kits.json" : undefined];
    const rows: Record<string, BuilderKit> = {};
    const defaults = new Set<string>();
    let loaded = false;
    for (const file of files) {
        if (!file) continue;
        try {
            const next = JSON.parse(readFileSync(file, "utf8")) as LocalKitReview;
            Object.assign(rows, next.rows);
            for (const sku of next.defaultPdpSkus ?? []) defaults.add(sku);
            loaded = true;
        } catch { /* A review file may not be staged in this checkout. */ }
    }
    return loaded ? { rows: withCurrentSharedMasters(rows), defaultPdpSkus: [...defaults] } : null;
}

/** Opt-in GPT-body composition pilot. The hosted application never reads it. */
export function localGpt13ComponentKits(host: string | null, flag: unknown): Record<string, BuilderKit> {
    if (process.env.VERCEL || process.env.NODE_ENV !== "development" || flag !== "gpt13"
        || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? "")) return {};
    const rows: Record<string, BuilderKit> = {};
    try {
        const review = JSON.parse(readFileSync("public/local-kits/gpt-13-415-2026-10-31/kits.json", "utf8")) as LocalKitReview;
        Object.assign(rows, review.rows);
    } catch { /* The optional original pilot may be absent in a clean checkout. */ }
    // Old bookmarked pilot URLs must resolve the current 5 ml master too.
    // Other families keep their explicit pilot artwork.
    try {
        const current = JSON.parse(readFileSync("public/local-kits/cylinder5-masters-2026-11-01/kits.json", "utf8")) as LocalKitReview;
        for (const [sku, kit] of Object.entries(current.rows ?? {})) {
            if (/^GBCyl(?:Blu)?5/.test(sku) && kit.sku === sku) rows[sku] = kit;
        }
    } catch { /* The older pilot remains usable without this review batch. */ }
    // Tulip seating follows the photographed shoulder. Keep this scoped to
    // the explicit pilot until the body/component set is visually approved.
    for (const file of ["public/local-kits/tulip-shoulder-2026-11-01/kits.json",
        "public/local-kits/tulip-amber-tube-2026-11-01/kits.json",
        "public/local-kits/tulip-rollers-2026-11-01/kits.json",
        "public/local-kits/tulip-amber-seating-2026-11-01/kits.json"]) {
        try {
            const tulip = JSON.parse(readFileSync(file, "utf8")) as LocalKitReview;
            for (const [sku, kit] of Object.entries(tulip.rows ?? {})) {
                if (/^GBTulip(?:Amb5|6)(?:Spry|MtlRoll|Roll)/.test(sku) && kit.sku === sku) rows[sku] = kit;
            }
        } catch { /* The original pilot remains available without this local batch. */ }
    }
    // Bookmarked 13-415 pilot URLs must use the same current bodies and parts as the builder.
    try {
        const current = JSON.parse(readFileSync("public/local-kits/remaining-13-415-2026-11-01/kits.json", "utf8")) as LocalKitReview;
        for (const [sku, kit] of Object.entries(current.rows ?? {})) {
            if (kit.sku === sku && kit.register?.bodyId.endsWith("-13-415")) rows[sku] = kit;
        }
    } catch { /* This review batch is optional outside the active checkout. */ }
    // Apply the latest clear Tulip optics after older bookmarked pilot batches.
    try {
        const current = JSON.parse(readFileSync("public/local-kits/tulip6-glass-depth-2026-11-01/kits.json", "utf8")) as LocalKitReview;
        for (const [sku, kit] of Object.entries(current.rows ?? {})) {
            if (/^GBTulip6Spry/.test(sku) && kit.sku === sku) rows[sku] = kit;
        }
    } catch { /* The hosted recipe remains available without the local review mirror. */ }
    // Sleek 8 ml keeps the same current optical treatment on bookmarked pilots.
    try {
        const current = JSON.parse(readFileSync("public/local-kits/sleek8-glass-depth-2026-11-01/kits.json", "utf8")) as LocalKitReview;
        for (const [sku, kit] of Object.entries(current.rows ?? {})) {
            if (kit.register?.bodyId === "sleek-8ml-13-415" && kit.sku === sku) rows[sku] = kit;
        }
    } catch { /* The approved hosted recipes remain available without this local mirror. */ }
    // New 25 ml glass is an explicit localhost candidate, not a hosted master.
    try {
        const current = JSON.parse(readFileSync("public/local-kits/cylinder25-material-cleanup-2026-11-02/kits.json", "utf8")) as LocalKitReview;
        for (const [sku, kit] of Object.entries(current.rows ?? {})) {
            if (kit.register?.bodyId === "cylinder-25ml-18-415" && kit.sku === sku) rows[sku] = kit;
        }
    } catch { /* The optional material review may be absent. */ }
    // Remaining Cylinder review sets keep one recovered body per physical
    // profile. Candidates are opt-in and remain unavailable on hosted builds.
    try {
        const current = JSON.parse(readFileSync("public/local-kits/cylinder-family-completion-2026-11-02/kits.json", "utf8")) as LocalKitReview;
        for (const [sku, kit] of Object.entries(current.rows ?? {})) {
            if (kit.sku === sku && ["cylinder-25ml-18-415", "cylinder-28ml-16mm", "cylinder-50ml-16mm",
                "cylinder-50ml-18-415", "cylinder-100ml-18-415"].includes(kit.register?.bodyId ?? "")) rows[sku] = kit;
        }
    } catch { /* Missing review files do not affect production or older pilots. */ }
    const jumbo = readLocalKitReview();
    for (const [sku, kit] of Object.entries(jumbo?.rows ?? {})) {
        if ((kit as { reviewMaster?: string }).reviewMaster === "jumbo-glass-2026-11-04") rows[sku] = kit;
    }
    return withCurrentSharedMasters(rows);
}

/** Shared local artwork review input for Builder and PDP. Never used on Vercel. */
export function readLocalComponentKits(): Record<string, BuilderKit> | null {
    return readLocalKitReview()?.rows ?? null;
}

/** Localhost only: explicit preview, or exact SKUs enabled in the local review file. */
export function localPdpComponentKits(host: string | null, flag: unknown,
    variants: Array<{ websiteSku?: string | null }>): Record<string, BuilderKit> {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? "")) return {};
    const review = readLocalKitReview();
    const pilot = localGpt13ComponentKits(host, flag);
    if (!review?.rows && !Object.keys(pilot).length) return {};
    const defaults = new Set(review?.defaultPdpSkus ?? []);
    return Object.fromEntries(variants.flatMap(({ websiteSku }) => {
        if (!websiteSku || (flag !== "kits" && flag !== "gpt13" && !defaults.has(websiteSku))) return [];
        const kit = pilot[websiteSku] ?? review?.rows[websiteSku];
        return kit && kit.sku === websiteSku ? [[websiteSku, kit]] : [];
    }));
}
