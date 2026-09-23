import Link from "next/link";
import { PortalTag, StatCard, PortalButton } from "@/components/portal/ui";
import { getPortalDashboardData } from "@/lib/portal/server";
import { createDraftAction } from "./actions";

function formatCurrency(value: number | null | undefined) {
    if (typeof value !== "number") return "—";
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(value: number) {
    return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
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
        case "cancelled":
            return "Cancelled";
        case "in_review":
            return "In Review";
        default:
            return "Draft";
    }
}

export default async function PortalDashboard() {
    const { account, stats, activeOrders, recentOrders, drafts, quickReorder } = await getPortalDashboardData();
    const companyName = account?.companyName ?? "Your organization";
    const accountNumber = account?.accountNumber ?? "Awaiting sync";

    return (
        <div className="mx-auto max-w-[1200px] px-4 py-4 lg:px-6 lg:py-6">

            {/* Welcome bar */}
            <div className="mb-5 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h1 className="font-sans text-[20px] font-semibold leading-tight text-neutral-900 lg:text-[22px]">
                        Welcome back, {companyName}
                    </h1>
                    <p className="mt-0.5 font-sans text-sm text-neutral-400">
                        {accountNumber} · {account?.taxExempt ? "Tax Exempt" : "Taxable"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/grace-workspace"
                        className="inline-flex h-11 min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 font-sans text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 lg:h-8 lg:min-h-8"
                    >
                        Talk with Grace
                    </Link>
                    <form action={createDraftAction}>
                        <PortalButton size="sm" type="submit" className="h-11 min-h-11 px-4 lg:h-8 lg:min-h-8">
                            New Draft
                        </PortalButton>
                    </form>
                </div>
            </div>

            {/* KPI row */}
            <div className="mb-5 grid grid-cols-2 gap-2.5 lg:mb-6 lg:grid-cols-4 lg:gap-3">
                <StatCard href="/portal/orders" label="YTD Spend" numericValue={stats.ytdSpend} format={formatCurrency} sub="Delivered orders this year" highlight />
                <StatCard href="/portal/orders" label="Active Orders" numericValue={stats.activeOrderCount} sub={`${stats.inTransitCount} in transit`} />
                <StatCard href="/portal/orders" label="Units In Flight" numericValue={stats.unitsInFlight} sub="Across active shipments" />
                <StatCard href="/portal/drafts" label="Open Drafts" numericValue={stats.openDraftCount} sub={account ? account.tier : "Available after account sync"} />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">

                {/* Active orders table */}
                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                        <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Active Orders</h2>
                        <Link href="/portal/orders" className="font-sans text-[12px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">
                            View all →
                        </Link>
                    </div>
                    {activeOrders.length === 0 ? (
                        <div className="px-5 py-8">
                            <p className="font-sans text-[13px] text-neutral-500">
                                No active orders yet. Once orders sync into Convex, they will show up here automatically.
                            </p>
                        </div>
                    ) : (
                        activeOrders.map((order, i) => (
                            <div
                                key={order._id}
                                className={`px-5 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors ${
                                    i < activeOrders.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-sans text-[12px] font-medium text-neutral-400">{order.orderId}</span>
                                        <PortalTag variant={statusVariant(order.status)}>{statusLabel(order.status)}</PortalTag>
                                    </div>
                                    <p className="font-sans text-[13px] text-neutral-900">
                                        {order.primaryLineItem?.description ?? "Order items"}
                                    </p>
                                    <p className="font-sans text-[12px] text-neutral-400">
                                        {order.itemCount} units
                                    </p>
                                </div>
                                <span className="font-sans text-[12px] text-neutral-400 shrink-0 ml-4">
                                    {order.estimatedDelivery ? `ETA ${order.estimatedDelivery}` : "Date pending"}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                {/* Recent deliveries */}
                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                        <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Recent Deliveries</h2>
                        <Link href="/portal/orders" className="font-sans text-[12px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">
                            Full history →
                        </Link>
                    </div>
                    {recentOrders.length === 0 ? (
                        <div className="px-5 py-8">
                            <p className="font-sans text-[13px] text-neutral-500">
                                Delivered orders will appear here once your order history is synced.
                            </p>
                        </div>
                    ) : (
                        recentOrders.map((order, i) => (
                            <div
                                key={order._id}
                                className={`px-5 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors ${
                                    i < recentOrders.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-sans text-[12px] font-medium text-neutral-400">{order.orderId}</span>
                                        <span className="font-sans text-[11px] text-neutral-300">{formatDate(order.orderDate)}</span>
                                    </div>
                                    <p className="font-sans text-[13px] text-neutral-900">
                                        {order.primaryLineItem?.description ?? "Order items"}
                                    </p>
                                </div>
                                <div className="text-right shrink-0 ml-4">
                                    <p className="font-sans text-[13px] font-medium text-neutral-900">{formatCurrency(order.totalAmount)}</p>
                                    <p className="font-sans text-[11px] text-neutral-400">{order.itemCount} units</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                        <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Saved Drafts</h2>
                        <Link href="/portal/drafts" className="font-sans text-[12px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">
                            Manage drafts →
                        </Link>
                    </div>
                    {drafts.length === 0 ? (
                        <div className="px-5 py-8">
                            <p className="font-sans text-[13px] text-neutral-500 mb-3">
                                No saved drafts yet.
                            </p>
                            <form action={createDraftAction}>
                                <PortalButton size="sm" type="submit">
                                    Create your first draft
                                </PortalButton>
                            </form>
                        </div>
                    ) : (
                        drafts.map((draft, i) => (
                            <div
                                key={draft._id}
                                className={`px-5 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors ${
                                    i < drafts.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <div>
                                    <p className="font-sans text-[13px] font-medium text-neutral-900">{draft.name}</p>
                                    <p className="font-sans text-[12px] text-neutral-400">
                                        {draft.lineItemCount} line items · Updated {formatDate(draft.updatedAt)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <PortalTag variant={draft.status === "in_review" ? "gold" : "muted"}>
                                        {statusLabel(draft.status)}
                                    </PortalTag>
                                    <p className="font-sans text-[12px] text-neutral-400 mt-1">
                                        {formatCurrency(draft.totalAmount)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                        <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Quick Reorder</h2>
                        <Link href="/portal/orders" className="font-sans text-[12px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">
                            Order history →
                        </Link>
                    </div>
                    {quickReorder.length === 0 ? (
                        <div className="px-5 py-8">
                            <p className="font-sans text-[13px] text-neutral-500">
                                Reorder suggestions appear after your first delivered order.
                            </p>
                        </div>
                    ) : (
                        quickReorder.map((item, i) => (
                            <div
                                key={item.sku}
                                className={`px-5 py-3 hover:bg-neutral-50 transition-colors ${
                                    i < quickReorder.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">{item.sku}</p>
                                <p className="font-sans text-[13px] font-medium text-neutral-900 mb-0.5">{item.description}</p>
                                <p className="font-sans text-[12px] text-neutral-400">
                                    Last ordered {item.quantity.toLocaleString()} units
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
