/** Provider evidence, never fulfillment creation or label purchase, proves movement. */
export type OrderStatus = "processing" | "in_transit" | "delivered" | "cancelled"
    | "partially_fulfilled" | "label_created" | "delivery_problem" | "unknown";

export interface ShipmentEvidence {
    shipmentStatus?: string;
    fulfillmentStatus?: string;
}

export function orderStatusFromEvidence(
    cancelled: boolean,
    fulfillmentStatus: string | null | undefined,
    shipments: ShipmentEvidence[],
    shipmentSnapshotComplete = true,
): OrderStatus {
    if (cancelled) return "cancelled";
    const active = shipments.filter((s) => s.fulfillmentStatus?.toLowerCase() !== "cancelled");
    const states = active.map((s) => s.shipmentStatus?.toLowerCase());
    if (fulfillmentStatus === "partial") return "partially_fulfilled";
    if (active.some((s) => ["error", "failure"].includes(s.fulfillmentStatus?.toLowerCase() ?? ""))
        || states.some((s) => ["failure", "attempted_delivery", "not_delivered", "delayed"].includes(s ?? ""))) {
        return "delivery_problem";
    }
    // Cancelled fulfillments still represent ordered quantities. Without an
    // item-level resolution/replacement allocation, excluding them cannot prove
    // that the complete order arrived, even if a parent flag says fulfilled.
    const hasCancelledFulfillment = active.length !== shipments.length;
    if (!hasCancelledFulfillment && shipmentSnapshotComplete && fulfillmentStatus === "fulfilled" && states.length > 0 && states.every((s) => s === "delivered")) {
        return "delivered";
    }
    if (states.some((s) => ["in_transit", "out_for_delivery", "carrier_picked_up"].includes(s ?? ""))) {
        return "in_transit";
    }
    if (states.length > 0 && states.every((s) => ["label_printed", "label_purchased"].includes(s ?? ""))) {
        return "label_created";
    }
    if ((fulfillmentStatus === null || fulfillmentStatus === "unfulfilled") && active.length === 0) {
        return "processing";
    }
    return "unknown";
}

export function sourceTimestamp(value: string | null | undefined): number | undefined {
    const at = value ? Date.parse(value) : NaN;
    return Number.isFinite(at) ? at : undefined;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    processing: "Processing", in_transit: "In transit", delivered: "Delivered", cancelled: "Cancelled",
    partially_fulfilled: "Partially fulfilled", label_created: "Label created",
    delivery_problem: "Delivery problem", unknown: "Status unavailable",
};

/** Compare source snapshots independently of object-key order or omitted undefined values. */
export function sameSourceValue(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length
            && left.every((value, i) => sameSourceValue(value, right[i]));
    }
    if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const aKeys = Object.keys(a).filter((key) => a[key] !== undefined).sort();
    const bKeys = Object.keys(b).filter((key) => b[key] !== undefined).sort();
    return aKeys.length === bKeys.length && aKeys.every((key, i) => key === bKeys[i] && sameSourceValue(a[key], b[key]));
}
