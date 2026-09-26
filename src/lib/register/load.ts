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
import { kitsFromRegister, type RegisterKit, type RegisterStagePayload } from "./stage-kit";

const CHUNK = 50;

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
    return kits;
}
