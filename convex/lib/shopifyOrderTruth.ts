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
    if (shipmentSnapshotComplete && fulfillmentStatus === "fulfilled" && states.length > 0 && states.every((s) => s === "delivered")) {
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
