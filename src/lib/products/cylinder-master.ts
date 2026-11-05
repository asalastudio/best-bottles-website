import { pillarReviewSku, PILLAR_MASTER_VERSION } from "./pillar-master";
import { elegant30ReviewSku, ELEGANT30_MASTER_REVIEW_VERSION } from "./elegant30-master";
import { elegant15ReviewSku, ELEGANT15_MASTER_REVIEW_VERSION } from "./elegant15-master";
import { elegant60100ReviewSku, ELEGANT60_100_MASTER_REVIEW_VERSION } from "./elegant60-100-master";
import { circleReviewSku, CIRCLE_MASTER_REVIEW_VERSION } from "./circle-master";
import { bostonReviewSku, BOSTON_MASTER_REVIEW_VERSION } from "./boston-master";
import { roundSleekReviewSku, ROUND_SLEEK_MASTER_REVIEW_VERSION } from "./round-sleek-master";
import { divaReviewSku, DIVA_MASTER_REVIEW_VERSION } from "./diva-master";
import { vialReviewSku, VIAL_MASTER_REVIEW_VERSION } from "./vial-master";
import { sleek8ReviewSku, SLEEK8_MASTER_REVIEW_VERSION } from "./sleek8-master";
import { rectangleApplicatorReviewSku, RECTANGLE_APPLICATOR_REVIEW_VERSION } from "./rectangle-applicator";
import { cylinder5MasterSku, CYLINDER5_MASTER_VERSION } from "./cylinder5-master";
import { cylinder9MasterSku, CYLINDER9_MASTER_VERSION } from "./cylinder9-master";
import { approvedMasterSku, APPROVED_KIT_VERSION, CYLINDER9_COLOR_VERSION, updatedCylinderKitVersion } from "@/lib/paper-doll/approved-kit-index";
function tallSleekReviewSku(sku?: string | null): string | null {
    return process.env.NODE_ENV === "development" && sku?.startsWith("GBTallRect10") ? sku : null;
}

function footedRectangleSprayReviewSku(sku?: string | null): string | null {
    return process.env.NODE_ENV === "development" && sku?.startsWith("GBRect10Spry") ? sku : null;
}

function uniqueShapeReviewSku(sku?: string | null): string | null {
    return process.env.NODE_ENV === "development" && sku && /^GB(?:Bell10|Royal13|Sqr15|Flair15)/.test(sku) ? sku : null;
}

export function cylinderMasterSku(sku: string | null | undefined): string | null {
    return uniqueShapeReviewSku(sku) ?? footedRectangleSprayReviewSku(sku) ?? tallSleekReviewSku(sku) ?? pillarReviewSku(sku) ?? approvedMasterSku(sku) ?? (process.env.NODE_ENV === "development" ? cylinder5MasterSku(sku) ?? cylinder9MasterSku(sku) ?? rectangleApplicatorReviewSku(sku) ?? elegant15ReviewSku(sku) ?? elegant30ReviewSku(sku) ?? elegant60100ReviewSku(sku) ?? circleReviewSku(sku) ?? bostonReviewSku(sku) ?? roundSleekReviewSku(sku) ?? divaReviewSku(sku) ?? vialReviewSku(sku) : null);
}
export function cylinderMasterSource(sku: string) {
    if (uniqueShapeReviewSku(sku)) return { family: "unique-shapes", version: "unique-shapes-shared-13-415-v1" };
    if (footedRectangleSprayReviewSku(sku)) return { family: "footed-rectangle", version: "footed-rectangle-measured-v1" };
    if (tallSleekReviewSku(sku)) return { family: "tall-sleek", version: "tall-sleek-shared-body-v1" };
    if (pillarReviewSku(sku)) return { family: "pillar", version: PILLAR_MASTER_VERSION };
    if (process.env.NODE_ENV === "development" && elegant30ReviewSku(sku)) return { family: "elegant30", version: ELEGANT30_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && elegant15ReviewSku(sku)) return { family: "elegant15", version: ELEGANT15_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && elegant60100ReviewSku(sku)) return { family: "elegant60-100", version: ELEGANT60_100_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && circleReviewSku(sku)) return { family: "circle", version: CIRCLE_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && bostonReviewSku(sku)) return { family: "boston", version: BOSTON_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && roundSleekReviewSku(sku)) return { family: "round-sleek", version: ROUND_SLEEK_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && divaReviewSku(sku)) return { family: "diva", version: DIVA_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && vialReviewSku(sku)) return { family: "vial", version: VIAL_MASTER_REVIEW_VERSION };
    const updatedVersion = updatedCylinderKitVersion(sku);
    if (updatedVersion) return { family: "approved", version: updatedVersion };
    if (/^(?:GBCyl|LBCyl)(?:Amb|Blu)9/.test(sku) && approvedMasterSku(sku)) return { family: "approved", version: CYLINDER9_COLOR_VERSION };
    if (/^LBCyl.*9Ltn/.test(sku) && approvedMasterSku(sku)) return { family: "approved", version: APPROVED_KIT_VERSION };
    if (sleek8ReviewSku(sku)) return { family: "sleek8", version: SLEEK8_MASTER_REVIEW_VERSION };
    if (rectangleApplicatorReviewSku(sku)) return { family: "rectangle9", version: RECTANGLE_APPLICATOR_REVIEW_VERSION };
    if (process.env.NODE_ENV !== "development" && approvedMasterSku(sku)) return { family: "approved", version: APPROVED_KIT_VERSION };
    if (cylinder5MasterSku(sku)) return { family: "cylinder5", version: CYLINDER5_MASTER_VERSION };
    if (cylinder9MasterSku(sku)) return { family: "cylinder9", version: CYLINDER9_MASTER_VERSION };
    return approvedMasterSku(sku) ? { family: "approved", version: APPROVED_KIT_VERSION } : null;
}

/** Replace an existing SKU rather than adding a duplicate that resets PDP selection. */
export function masterProductHref(href: string, sku: string | null): string {
    if (!sku) return href;
    const url = new URL(href, "https://www.bestbottles.com");
    url.searchParams.set("sku", sku);
    return href.startsWith("https://") ? url.href : `${url.pathname}${url.search}${url.hash}`;
}
