/**
 * Server-side loader for register-drawn kits (Phase 5 consumers: the product
 * page and Build Your Bottle). One `registerStage:forSkus` round trip per 50
 * Grace SKUs, then `kitsFromRegister` on the payload. Anything the register
 * cannot draw is simply absent from the result, so a caller falls through to
 * the legacy kit. A deployment without the register functions (production
 * until the register merges) or a failed call yields an empty map, never an
 * error. `NEXT_PUBLIC_REGISTER_STAGE=off` turns the register off everywhere.
 */
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { kitFromRegister, kitsFromRegister, type RegisterKit, type RegisterStagePayload } from "./stage-kit";

const CHUNK = 50;

// The frosted Elegant matte-gold spray SKU entered the live catalog after the
// register snapshot. Both of its exact parts are already approved in the same
// 15 ml / 13-415 body: the frosted plate and the matte-gold sprayer. Compose
// only this documented combination until the next register snapshot includes it.
const FROSTED_ELEGANT_GOLD = {
    graceSku: "GB-ELG-FRS-15ML-SPR-MGLD",
    websiteSku: "GBElgFrst15SpryGlMatt",
    frostedDonor: "GB-ELG-FRS-15ML-SPR",
    sprayerDonor: "GB-ELG-CLR-15ML-SPR-MGLD",
    componentId: "CMP-CAP-SGLD-13-415-02",
} as const;

export function composeFrostedElegantGold(payload: RegisterStagePayload): RegisterKit | null {
    const frosted = payload.assemblies[FROSTED_ELEGANT_GOLD.frostedDonor];
    const gold = payload.assemblies[FROSTED_ELEGANT_GOLD.sprayerDonor];
    if (!frosted?.renderable || !gold?.renderable ||
        frosted.bodyId !== gold.bodyId || frosted.bodyId !== "elegant-15ml-13-415" ||
        frosted.glass !== "Frosted" || frosted.neck !== "13-415" || gold.neck !== "13-415" ||
        gold.parts.length !== 1 || gold.parts[0].componentId !== FROSTED_ELEGANT_GOLD.componentId ||
        gold.parts[0].role !== "sprayer") return null;
    return kitFromRegister(FROSTED_ELEGANT_GOLD.graceSku, {
        ...payload,
        assemblies: {
            ...payload.assemblies,
            [FROSTED_ELEGANT_GOLD.graceSku]: {
                ...frosted,
                graceSku: FROSTED_ELEGANT_GOLD.graceSku,
                websiteSku: FROSTED_ELEGANT_GOLD.websiteSku,
                parts: gold.parts,
            },
        },
    });
}

export function registerStageEnabled(): boolean {
    return process.env.NEXT_PUBLIC_REGISTER_STAGE !== "off";
}

export async function loadRegisterKits(convex: ConvexHttpClient, graceSkus: ReadonlyArray<string | null | undefined>): Promise<Record<string, RegisterKit>> {
    if (!registerStageEnabled()) return {};
    const wanted = [...new Set(graceSkus.filter((sku): sku is string => typeof sku === "string" && sku.length > 0))];
    if (wanted.length === 0) return {};
    const kits: Record<string, RegisterKit> = {};
    for (let index = 0; index < wanted.length; index += CHUNK) {
        try {
            const payload = await convex.query(api.registerStage.forSkus, { graceSkus: wanted.slice(index, index + CHUNK) }) as RegisterStagePayload;
            Object.assign(kits, kitsFromRegister(payload));
        } catch (error) {
            // The register is additive: without it the stages draw the legacy kits.
            if (process.env.NODE_ENV !== "production") console.warn("[register] stage lookup unavailable; drawing legacy kits", error instanceof Error ? error.message : error);
            return kits;
        }
    }
    if (wanted.includes(FROSTED_ELEGANT_GOLD.graceSku) && !kits[FROSTED_ELEGANT_GOLD.graceSku]) {
        try {
            const payload = await convex.query(api.registerStage.forSkus, {
                graceSkus: [FROSTED_ELEGANT_GOLD.frostedDonor, FROSTED_ELEGANT_GOLD.sprayerDonor],
            }) as RegisterStagePayload;
            const kit = composeFrostedElegantGold(payload);
            if (kit) {
                kits[FROSTED_ELEGANT_GOLD.graceSku] = kit;
                kits[FROSTED_ELEGANT_GOLD.websiteSku] = kit;
            }
        } catch (error) {
            if (process.env.NODE_ENV !== "production") console.warn("[register] frosted Elegant kit unavailable", error instanceof Error ? error.message : error);
        }
    }
    return kits;
}
