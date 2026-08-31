import type { PaperDollMode } from "./types";

export const PAPER_DOLL_CANVAS = Object.freeze({
    width: 2080,
    height: 2288,
});

export const PAPER_DOLL_CANVAS_PRESET = "pdp-2080x2288" as const;

export const PAPER_DOLL_SLOTS = [
    "body",
    "roller",
    "cap",
    "sprayer",
    "overcap",
    "pump",
    "shortcap",
] as const;

export type PaperDollSlot = (typeof PAPER_DOLL_SLOTS)[number];
export type PaperDollRenderMode = PaperDollMode | "shortcap";

export const PAPER_DOLL_LAYER_HIERARCHY = Object.freeze({
    rollon: ["body", "roller", "cap"],
    spray: ["body", "sprayer", "overcap"],
    lotion: ["body", "pump", "overcap"],
    shortcap: ["body", "shortcap"],
} satisfies Record<PaperDollRenderMode, readonly PaperDollSlot[]>);

export const PAPER_DOLL_RELEASE_FIELDS = [
    "pipelineVersion",
    "assetRevision",
    "storefrontReady",
] as const;

export type PaperDollReleaseMetadata = {
    pipelineVersion?: string | null;
    assetRevision?: string | null;
    storefrontReady?: boolean | null;
};

export type PaperDollReleaseState =
    | { status: "ready" }
    | { status: "preparing"; missing: Array<(typeof PAPER_DOLL_RELEASE_FIELDS)[number]> };

export function paperDollReleaseState(metadata: PaperDollReleaseMetadata): PaperDollReleaseState {
    const missing: Array<(typeof PAPER_DOLL_RELEASE_FIELDS)[number]> = [];
    if (!metadata.pipelineVersion?.trim()) missing.push("pipelineVersion");
    if (!metadata.assetRevision?.trim()) missing.push("assetRevision");
    if (metadata.storefrontReady !== true) missing.push("storefrontReady");
    return missing.length === 0 ? { status: "ready" } : { status: "preparing", missing };
}
