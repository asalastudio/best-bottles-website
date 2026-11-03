import "server-only";
import manifest from "./approved-kits.generated.json";
import type { BuilderKit } from "@/lib/bottle-builder/model";

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
const revisedRows = cylinderNineColorRows as unknown as Record<string, BuilderKit>;
const rows = { ...manifest.rows, ...revisedRows } as unknown as Record<string, BuilderKit>;
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
