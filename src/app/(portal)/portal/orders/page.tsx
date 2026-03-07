export const dynamic = "force-dynamic";
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

const colClass = "grid grid-cols-[100px_1fr_140px_100px_100px_120px] gap-4 items-center";

export default async function PortalOrders() {
    const { orders } = await getPortalOrdersData();

    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader
                eyebrow="History"
                title="Orders"
                subtitle={orders.length > 0 ? `${orders.length} synced orders · Reorder any previous purchase.` : "Order history will appear here as it syncs into Convex."}
            />

            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                {/* Table header */}
                <div className={`${colClass} px-5 py-3 bg-neutral-50 border-b border-neutral-200`}>
                    {["Order", "Product", "Date", "Total", "Status", ""].map((h) => (
                        <p key={h} className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                            {h}
                        </p>
                    ))}
                </div>

                {orders.length === 0 ? (
                    <div className="px-5 py-10">
                        <p className="font-sans text-[13px] text-neutral-500">
                            No orders are synced for this organization yet.
                        </p>
                    </div>
                ) : (
                    orders.map((order, i) => (
                        <div
                            key={order._id}
                            className={`${colClass} px-5 py-3.5 hover:bg-neutral-50 transition-colors ${
                                i < orders.length - 1 ? "border-b border-neutral-100" : ""
                            }`}
                        >
                            <span className="font-sans text-[13px] font-medium text-neutral-900">
                                {order.orderId}
                            </span>
                            <div>
                                <p className="font-sans text-[13px] text-neutral-900">
                                    {order.primaryLineItem?.description ?? "Order items"}
                                </p>
                                <p className="font-sans text-[12px] text-neutral-400">
                                    {order.itemCount} units
                                    {order.carrier ? ` · ${order.carrier}` : ""}
                                </p>
                            </div>
                            <span className="font-sans text-[13px] text-neutral-500">{formatDate(order.orderDate)}</span>
                            <span className="font-sans text-[13px] font-medium text-neutral-900">{formatCurrency(order.totalAmount)}</span>
                            <PortalTag variant={statusVariant(order.status)}>{statusLabel(order.status)}</PortalTag>
                            <div className="flex gap-1.5 justify-end">
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
