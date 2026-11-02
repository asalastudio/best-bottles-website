import { sleek8ReviewSku, SLEEK8_MASTER_REVIEW_VERSION } from "./sleek8-master";
import { rectangleApplicatorReviewSku, RECTANGLE_APPLICATOR_REVIEW_VERSION } from "./rectangle-applicator";
import { cylinder5MasterSku, CYLINDER5_MASTER_VERSION } from "./cylinder5-master";
import { cylinder9MasterSku, CYLINDER9_MASTER_VERSION } from "./cylinder9-master";
import { approvedMasterSku, APPROVED_KIT_VERSION } from "@/lib/paper-doll/approved-kit-index";
export function cylinderMasterSku(sku: string | null | undefined): string | null {
    return approvedMasterSku(sku) ?? (process.env.NODE_ENV === "development" ? cylinder5MasterSku(sku) ?? cylinder9MasterSku(sku) ?? rectangleApplicatorReviewSku(sku) : null);
}
export function cylinderMasterSource(sku: string) {
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
