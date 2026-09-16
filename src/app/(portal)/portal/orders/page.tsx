export const dynamic = "force-dynamic";
import Link from "next/link";
import { PageHeader, PortalButton, PortalTag } from "@/components/portal/ui";
import { getPortalOrdersData } from "@/lib/portal/server";
import { reorderToDraftAction } from "../actions";

function formatCurrency(value: number | null | undefined) {
    if (typeof value !== "number") return "—";
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(value: number) {
    return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function statusVariant(status: string): "muted" | "blue" | "green" | "gold" {
    if (status === "in_transit") return "blue";
    if (status === "delivered") return "green";
    if (status === "processing") return "gold";
    return "muted";
}

function statusLabel(status: string) {
    switch (status) {
        case "in_transit":
            return "In Transit";
        case "processing":
            return "Processing";
        case "delivered":
            return "Delivered";
        default:
            return "Cancelled";
    }
}

const colClass = "grid grid-cols-[100px_1fr_150px_120px_100px_110px] gap-4 items-center";

export default async function PortalOrders() {
    const { orders } = await getPortalOrdersData();

    return (
        <div className="mx-auto max-w-[1200px] px-4 py-4 lg:px-6 lg:py-6">
            <PageHeader
                eyebrow="History"
                title="Order history"
                subtitle={
                    orders.length > 0
                        ? `${orders.length} order${orders.length === 1 ? "" : "s"} · open one to track its shipments or reorder it.`
                        : "Orders appear here once Best Bottles confirms them in Shopify."
                }
            />

            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                {/* Table header */}
                <div data-portal-table-head className={`${colClass} px-5 py-3 bg-neutral-50 border-b border-neutral-200`}>
                    {["Order", "Product", "Date", "Tracking", "Status", ""].map((h) => (
                        <p key={h} className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                            {h}
                        </p>
                    ))}
                </div>

                {orders.length === 0 ? (
                    <div className="px-5 py-10">
                        <p className="font-sans text-[13px] text-neutral-500">
                            No orders yet. Once Best Bottles confirms an order in Shopify, it
                            appears here with its tracking.
                        </p>
                    </div>
                ) : (
                    orders.map((order, i) => (
                        <div
                            key={order._id}
                            data-portal-table-row
                            className={`${colClass} px-5 py-3.5 hover:bg-neutral-50 transition-colors ${
                                i < orders.length - 1 ? "border-b border-neutral-100" : ""
                            }`}
                        >
                            <Link
                                data-label="Order"
                                href={`/portal/orders/${encodeURIComponent(order.orderId)}`}
                                className="font-sans text-[13px] font-medium text-neutral-900 hover:underline"
                            >
                                {order.orderId}
                            </Link>
                            <div data-label="Product">
                                <p className="font-sans text-[13px] text-neutral-900">
                                    {order.primaryLineItem?.description ?? "Order items"}
                                </p>
                                <p className="font-sans text-[12px] text-neutral-400">
                                    {order.itemCount} units · {formatCurrency(order.totalAmount)}
                                </p>
                            </div>
                            <span data-label="Date" className="font-sans text-[13px] text-neutral-500">{formatDate(order.orderDate)}</span>
                            {/* The tracking link is the thing a customer opens this
                                page for, so it sits in the row rather than one
                                click deeper. Several shipments collapse to a count
                                that opens the order. */}
                            <div data-label="Tracking" className="min-w-0">
                                {order.shipments.length > 1 ? (
                                    <Link
                                        href={`/portal/orders/${encodeURIComponent(order.orderId)}`}
                                        className="font-sans text-[13px] text-neutral-900 underline underline-offset-2"
                                    >
                                        {order.shipments.length} shipments
                                    </Link>
                                ) : order.shipments[0]?.trackingUrl ? (
                                    <a
                                        href={order.shipments[0].trackingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-sans text-[13px] text-neutral-900 underline underline-offset-2"
                                    >
                                        {order.shipments[0].carrier ?? "Track"} ↗
                                    </a>
                                ) : order.trackingNumber ? (
                                    <p className="font-mono text-[11.5px] text-neutral-500 truncate" title={order.trackingNumber}>
                                        {order.trackingNumber}
                                    </p>
                                ) : (
                                    <span className="font-sans text-[13px] text-neutral-400">—</span>
                                )}
                            </div>
                            <div data-label="Status"><PortalTag variant={statusVariant(order.status)}>{statusLabel(order.status)}</PortalTag></div>
                            <div data-actions className="flex gap-1.5 justify-end">
                                <form action={reorderToDraftAction}>
                                    <input type="hidden" name="orderId" value={order.orderId} />
                                    <PortalButton variant="outline" size="sm" type="submit">
                                        Reorder
                                    </PortalButton>
                                </form>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
