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
        <div className="px-6 py-6 max-w-[1200px]">

            {/* Welcome bar */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-sans text-[22px] font-semibold text-neutral-900 leading-tight">
                        Welcome back, {companyName}
                    </h1>
                    <p className="font-sans text-sm text-neutral-400 mt-0.5">
                        {accountNumber} · {account?.netTerms ?? "Terms pending"} · {account?.taxExempt ? "Tax Exempt" : "Taxable"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/portal/grace"
                        className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                        Ask Grace
                    </Link>
                    <form action={createDraftAction}>
                        <PortalButton size="sm" type="submit">
                            New Draft
                        </PortalButton>
                    </form>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                <StatCard label="YTD Spend" numericValue={stats.ytdSpend} format={formatCurrency} sub="Delivered orders this year" highlight />
                <StatCard label="Active Orders" numericValue={stats.activeOrderCount} sub={`${stats.inTransitCount} in transit`} />
                <StatCard label="Units In Flight" numericValue={stats.unitsInFlight} sub="Across active shipments" />
                <StatCard label="Credit Available" value={formatCurrency(stats.availableCredit)} sub={account ? `${account.netTerms} · ${account.tier}` : "Available after account sync"} />
            </div>

            {/* Quick action: Price List */}
            <div className="mb-4">
                <Link
                    href="/portal/price-list"
                    className="block p-4 bg-white rounded-lg border border-neutral-200 hover:border-muted-gold/40 hover:shadow-sm transition-all"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-sans text-[14px] font-semibold text-neutral-900">Build a Price List</h3>
                            <p className="font-sans text-[12px] text-neutral-500 mt-0.5">
                                Add line items with SKUs, quantities, and pricing. Save to a draft or use for quote requests.
                            </p>
                        </div>
                        <span className="font-sans text-[12px] font-medium text-muted-gold">→ Price List</span>
                    </div>
                </Link>
            </div>

            <div className="grid grid-cols-[1.5fr_1fr] gap-4 mb-4">

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

            <div className="grid grid-cols-[1fr_1fr] gap-4">
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
