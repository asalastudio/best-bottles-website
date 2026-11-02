import type { KitLike, KitPartLike } from '../../../src/lib/products/pdp-redesign/stage';
import type { stageLayout } from '../../../src/lib/products/pdp-redesign/stage';
import type { CatalogRow } from '../../../src/lib/bottle-builder/model';

/** Review provenance augments the renderer's intentionally small public shape. */
export type ReviewPart = Omit<KitPartLike, 'image'> & {
    variantKey?: string | null;
    image: KitPartLike['image'] & { key?: string; sha256?: string; bytes?: number };
    image2x?: null;
    mask?: null;
};
export type ReviewKit = Omit<KitLike, 'parts'> & {
    familyId?: string;
    plateSha256?: string;
    completeness?: 'full';
    parts: ReviewPart[];
};

export type FamilySnapshot = { capturedAt: string; families: Record<string, { rows: CatalogRow[] }> };
export type ReviewHold = { sku?: string; profile?: string; bodyId?: string; reason: string; detail?: string };
export type InventoryGroup = {
    key: string; profile: string; glass: string; category: string; capacityMl: number; neck: string;
    rows: string[]; registerAvailable: number; approvedAvailable: number;
    bodies: Record<string, number>; tubeSources: Record<string, number>;
};
export type ProfileCrosswalk = { aliases: Array<{
    websiteSku: string; graceSku: string; sourceProfile: string; sourceCapacityMl: number;
    targetProfile: string; physicalCapacityMl: number;
}> };
export type RecoveredMaster = {
    bodyId: string; glass: string; plateKey: string; capacityMl: number; sourceAvailable: boolean;
    sourceFile: string; fileSha256: string;
    anchors: { axisX: number; seatY: number; baselineY: number; shoulderY: number; bodyShoulderY?: number };
    scale: { targetPct: number; baselinePct: number; source: string };
};
export type MasterReview = {
    key: string; profile: string; label: string; capacityMl: number; neck: string; glass: string;
    status: string; configurations: number; approvedSkus: string[]; candidateSkus: string[]; heldSkus: string[];
    sourceUrl: string | null; sha256: string | null; masterFile: string | null;
    scale: KitLike['glassSizing'] | RecoveredMaster['scale'] | null;
    layout: ReturnType<typeof stageLayout>; reviewSku: string | null; preservation: string;
};
