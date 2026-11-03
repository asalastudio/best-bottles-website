import { elegant30ReviewSku, ELEGANT30_MASTER_REVIEW_VERSION } from "./elegant30-master";
import { elegant15ReviewSku, ELEGANT15_MASTER_REVIEW_VERSION } from "./elegant15-master";
import { elegant60100ReviewSku, ELEGANT60_100_MASTER_REVIEW_VERSION } from "./elegant60-100-master";
import { circleReviewSku, CIRCLE_MASTER_REVIEW_VERSION } from "./circle-master";
import { sleek8ReviewSku, SLEEK8_MASTER_REVIEW_VERSION } from "./sleek8-master";
import { rectangleApplicatorReviewSku, RECTANGLE_APPLICATOR_REVIEW_VERSION } from "./rectangle-applicator";
import { cylinder5MasterSku, CYLINDER5_MASTER_VERSION } from "./cylinder5-master";
import { cylinder9MasterSku, CYLINDER9_MASTER_VERSION } from "./cylinder9-master";
import { approvedMasterSku, APPROVED_KIT_VERSION, CYLINDER9_COLOR_VERSION, updatedCylinderKitVersion } from "@/lib/paper-doll/approved-kit-index";
export function cylinderMasterSku(sku: string | null | undefined): string | null {
    return approvedMasterSku(sku) ?? (process.env.NODE_ENV === "development" ? cylinder5MasterSku(sku) ?? cylinder9MasterSku(sku) ?? rectangleApplicatorReviewSku(sku) ?? elegant15ReviewSku(sku) ?? elegant30ReviewSku(sku) ?? elegant60100ReviewSku(sku) ?? circleReviewSku(sku) : null);
}
export function cylinderMasterSource(sku: string) {
    if (process.env.NODE_ENV === "development" && elegant30ReviewSku(sku)) return { family: "elegant30", version: ELEGANT30_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && elegant15ReviewSku(sku)) return { family: "elegant15", version: ELEGANT15_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && elegant60100ReviewSku(sku)) return { family: "elegant60-100", version: ELEGANT60_100_MASTER_REVIEW_VERSION };
    if (process.env.NODE_ENV === "development" && circleReviewSku(sku)) return { family: "circle", version: CIRCLE_MASTER_REVIEW_VERSION };
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
