export const dynamic = "force-dynamic";
import Link from "next/link";
import { PageHeader, PortalButton, PortalTag } from "@/components/portal/ui";
import DiscardDraftButton from "@/components/portal/DiscardDraftButton";
import { getPortalDraftsData } from "@/lib/portal/server";
import { createDraftAction, discardDraftAction } from "../actions";

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

function statusVariant(status: string): "gold" | "muted" {
    return status === "in_review" ? "gold" : "muted";
}

function statusLabel(status: string) {
    // "Draft" is Best Bottles' word for this — on the Shopify side it lands
    // under Orders → Drafts. To the customer it is simply their order, and
    // calling it a draft reads as "not real yet".
    return status === "in_review" ? "In Review" : status === "submitted" ? "Submitted" : "In progress";
}

const colClass = "grid grid-cols-[1fr_80px_100px_130px_100px_200px] gap-4 items-center";

export default async function PortalDrafts() {
    const { drafts } = await getPortalDraftsData();

    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader
                eyebrow="Purchasing"
                title="Orders"
                subtitle={
                    drafts.length > 0
                        ? "Orders you are still building, and orders already submitted to Best Bottles."
                        : "Start an order to save what you need before submitting it."
                }
            />

            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                <div className={`${colClass} px-5 py-3 bg-neutral-50 border-b border-neutral-200`}>
                    {["Name", "Items", "Total", "Last Edited", "Status", ""].map((h) => (
                        <p key={h} className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                            {h}
                        </p>
                    ))}
                </div>

                {drafts.length === 0 ? (
                    <div className="px-5 py-10">
                        <p className="font-sans text-[13px] text-neutral-500">
                            No orders yet. Start one to gather what you need before submitting it.
                        </p>
                    </div>
                ) : (
                    drafts.map((draft, i) => (
                        <div
                            key={draft._id}
                            className={`${colClass} px-5 py-3.5 hover:bg-neutral-50 transition-colors ${
                                i < drafts.length - 1 ? "border-b border-neutral-100" : ""
                            }`}
                        >
                            <span className="font-sans text-[13px] font-medium text-neutral-900">{draft.name}</span>
                            <span className="font-sans text-[13px] text-neutral-500">{draft.lineItemCount}</span>
                            <span className="font-sans text-[13px] font-medium text-neutral-900">{formatCurrency(draft.totalAmount)}</span>
                            <span className="font-sans text-[13px] text-neutral-500">{formatDate(draft.updatedAt)}</span>
                            <PortalTag variant={statusVariant(draft.status)}>{statusLabel(draft.status)}</PortalTag>
                            <div className="flex gap-1.5 justify-end">
                                <Link
                                    href={`/portal/drafts/${draft._id}`}
                                    className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                                >
                                    {draft.status === "submitted" ? "View" : "Open"}
                                </Link>
                                <DiscardDraftButton
                                    draftId={draft._id}
                                    submitted={draft.status === "submitted"}
                                    action={discardDraftAction}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form action={createDraftAction}>
                <PortalButton type="submit" size="md" className="mt-4">
                    Start an order
                </PortalButton>
            </form>
        </div>
    );
}
