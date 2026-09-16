export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PortalButton, PortalTag } from "@/components/portal/ui";
import { getPortalOrder } from "@/lib/portal/server";
import { reorderToDraftAction } from "../../actions";

function money(value: number | null | undefined) {
    if (typeof value !== "number") return "—";
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatDate(value: number | null | undefined) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusVariant(status: string): "muted" | "blue" | "green" | "gold" {
    if (status === "in_transit") return "blue";
    if (status === "delivered") return "green";
    if (status === "processing") return "gold";
    return "muted";
}

function statusLabel(status: string) {
    switch (status) {
        case "in_transit": return "In transit";
        case "processing": return "Processing";
        case "delivered": return "Delivered";
        default: return "Cancelled";
    }
}

/**
 * Shopify's shipment_status vocabulary, in the customer's words. Unknown values
 * are shown as-is rather than swallowed — a state we have not seen before is
 * still information, and hiding it would be worse than a slightly odd label.
 */
const SHIPMENT_STATUS: Record<string, string> = {
    label_printed: "Label printed",
    label_purchased: "Label purchased",
    attempted_delivery: "Delivery attempted",
    ready_for_pickup: "Ready for pickup",
    confirmed: "Confirmed",
    in_transit: "In transit",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    failure: "Delivery problem",
    success: "Delivered",
};

function shipmentStatusLabel(status: string | undefined) {
    if (!status) return "Shipped";
    return SHIPMENT_STATUS[status] ?? status.replace(/_/g, " ");
}

export default async function PortalOrderDetail({
    params,
}: {
    params: Promise<{ orderId: string }>;
}) {
    const { orderId } = await params;
    const order = await getPortalOrder(decodeURIComponent(orderId));
    if (!order) notFound();

    const lineTotal = (unitPrice: number | undefined, quantity: number) =>
        typeof unitPrice === "number" ? unitPrice * quantity : undefined;

    return (
        <div className="mx-auto max-w-[900px] px-4 py-4 lg:px-6 lg:py-6">
            <Link
                href="/portal/orders"
                className="inline-block font-sans text-[12px] mb-3 transition-colors text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
            >
                ← Order history
            </Link>

            <PageHeader
                eyebrow="Order"
                title={order.orderId}
                subtitle={`Placed ${formatDate(order.orderDate)}${order.shipTo ? ` · shipping to ${order.shipTo}` : ""}`}
            >
                <PortalTag variant={statusVariant(order.status)}>{statusLabel(order.status)}</PortalTag>
            </PageHeader>

            {/* ─── Tracking ───────────────────────────────────────────────── */}
            <section className="mb-4">
                <h2 className="font-sans text-[14px] font-semibold mb-2 text-[color:var(--color-text-primary)]">
                    Tracking
                </h2>

                {order.shipments.length === 0 ? (
                    <div
                        className="rounded-lg border px-5 py-5"
                        style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
                    >
                        <p className="font-sans text-[13px] text-[color:var(--color-text-secondary)]">
                            {order.status === "cancelled"
                                ? "This order was cancelled, so nothing shipped."
                                : "Nothing has shipped yet. Tracking appears here as soon as Best Bottles books the freight."}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {order.shipments.map((shipment, i) => (
                            <div
                                key={shipment.shopifyFulfillmentId ?? shipment.trackingNumber ?? i}
                                className="rounded-lg border px-5 py-4"
                                style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
                            >
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="font-sans text-[13px] font-medium text-[color:var(--color-text-primary)]">
                                            {order.shipments.length > 1 ? `Shipment ${i + 1} · ` : ""}
                                            {shipmentStatusLabel(shipment.shipmentStatus)}
                                        </p>
                                        <p className="font-sans text-[12.5px] mt-1 text-[color:var(--color-text-secondary)]">
                                            {[
                                                shipment.carrier,
                                                shipment.shippedAt ? `shipped ${formatDate(shipment.shippedAt)}` : null,
                                                shipment.estimatedDelivery ? `due ${shipment.estimatedDelivery}` : null,
                                            ]
                                                .filter(Boolean)
                                                .join(" · ") || "Carrier not recorded"}
                                        </p>
                                        {shipment.trackingNumber && (
                                            <p className="font-mono text-[12px] mt-1.5 text-[color:var(--color-text-secondary)]">
                                                {shipment.trackingNumber}
                                            </p>
                                        )}
                                    </div>

                                    {/* Shopify resolves the carrier's own page for
                                        known carriers. When it does not, the number
                                        is still shown — it is what the customer
                                        quotes on the phone. */}
                                    {shipment.trackingUrl && (
                                        <a
                                            href={shipment.trackingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 inline-flex items-center justify-center h-8 px-3 font-sans text-[12.5px] font-medium rounded-md"
                                            style={{ background: "var(--color-text-primary)", color: "var(--color-surface)" }}
                                        >
                                            Track shipment ↗
                                        </a>
                                    )}
                                </div>

                                {shipment.lineItems && shipment.lineItems.length > 0 && (
                                    <ul
                                        className="mt-3 pt-3 flex flex-col gap-1"
                                        style={{ borderTop: "1px solid var(--color-rule)" }}
                                    >
                                        {shipment.lineItems.map((item, j) => (
                                            <li
                                                key={`${item.sku}-${j}`}
                                                className="font-sans text-[12.5px] text-[color:var(--color-text-secondary)]"
                                            >
                                                {item.quantity.toLocaleString()} × {item.description}
                                                <span className="text-[color:var(--color-text-muted)]"> · {item.sku}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ─── What was ordered ───────────────────────────────────────── */}
            <section>
                <h2 className="font-sans text-[14px] font-semibold mb-2 text-[color:var(--color-text-primary)]">
                    Items
                </h2>
                <div
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
                >
                    <div
                        data-portal-table-head
                        className="grid grid-cols-[1fr_90px_110px_120px] gap-3 px-5 py-2.5"
                        style={{ borderBottom: "1px solid var(--color-rule)", background: "var(--color-surface-sunken)" }}
                    >
                        {["Item", "Qty", "Unit", "Line total"].map((h) => (
                            <p
                                key={h}
                                className="font-sans text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]"
                            >
                                {h}
                            </p>
                        ))}
                    </div>

                    {order.lineItems.map((line, i) => (
                        <div
                            key={`${line.sku}-${i}`}
                            data-portal-table-row
                            className="grid grid-cols-[1fr_90px_110px_120px] gap-3 items-center px-5 py-3"
                            style={i < order.lineItems.length - 1 ? { borderBottom: "1px solid var(--color-rule)" } : undefined}
                        >
                            <div data-label="Item" className="min-w-0">
                                <p className="font-sans text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                                    {line.sku}
                                </p>
                                <p className="font-sans text-[13px] text-[color:var(--color-text-primary)]">
                                    {line.description}
                                </p>
                            </div>
                            <p data-label="Qty" className="font-sans text-[13px] tabular-nums text-[color:var(--color-text-primary)]">
                                {line.quantity.toLocaleString()}
                            </p>
                            <p data-label="Unit" className="font-sans text-[13px] tabular-nums text-[color:var(--color-text-secondary)]">
                                {money(line.unitPrice)}
                            </p>
                            <p data-label="Line total" className="font-sans text-[13px] font-medium tabular-nums text-[color:var(--color-text-primary)]">
                                {money(lineTotal(line.unitPrice, line.quantity))}
                            </p>
                        </div>
                    ))}

                    <div
                        className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderTop: "1px solid var(--color-rule)", background: "var(--color-surface-sunken)" }}
                    >
                        <p className="font-sans text-[13px] text-[color:var(--color-text-secondary)]">
                            {order.itemCount.toLocaleString()} units across {order.lineItems.length} line
                            {order.lineItems.length === 1 ? "" : "s"}
                        </p>
                        <p className="font-sans text-[15px] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                            {money(order.totalAmount)}
                        </p>
                    </div>
                </div>
            </section>

            <div className="flex items-center gap-3 mt-4">
                <form action={reorderToDraftAction}>
                    <input type="hidden" name="orderId" value={order.orderId} />
                    <PortalButton type="submit" size="md">Reorder these items</PortalButton>
                </form>
                <a
                    href={`mailto:sales@bestbottles.com?subject=${encodeURIComponent(`Order ${order.orderId}`)}`}
                    className="font-sans text-[13px] underline underline-offset-2 text-[color:var(--color-text-secondary)]"
                >
                    Ask about this order
                </a>
            </div>
        </div>
    );
}
