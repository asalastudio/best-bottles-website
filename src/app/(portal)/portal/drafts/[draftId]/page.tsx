export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PortalTag } from "@/components/portal/ui";
import OrderPad from "@/components/portal/OrderPad";
import SubmitDraftForm from "@/components/portal/SubmitDraftForm";
import DiscardDraftButton from "@/components/portal/DiscardDraftButton";
import { getDraftForViewer } from "@/lib/portal/draftEditor";
import { getPortalAddresses } from "@/lib/portal/server";
import { addressIsUsable } from "@/lib/portal/address";
import { discardDraftAction, saveDraftLinesAction, searchProductsAction, submitDraftAction } from "../../actions";

function formatDate(value: number) {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PortalDraftDetail({
    params,
}: {
    params: Promise<{ draftId: string }>;
}) {
    const { draftId } = await params;
    const [draft, addresses] = await Promise.all([getDraftForViewer(draftId), getPortalAddresses()]);
    if (!draft) notFound();

    const hasAddress = addressIsUsable(addresses.shippingAddress);

    const submitted = draft.status === "submitted";

    return (
        <div className="mx-auto max-w-[900px] px-4 py-4 lg:px-6 lg:py-6">
            <Link
                href="/portal/drafts"
                className="inline-block font-sans text-[12px] text-neutral-400 hover:text-neutral-700 mb-3 transition-colors"
            >
                ← All orders
            </Link>

            <PageHeader
                eyebrow="Order"
                title={draft.name}
                subtitle={
                    submitted
                        ? "Your order has been submitted. Best Bottles will handle the rest."
                        : "Add what you need, then submit it to Best Bottles."
                }
            >
                <div className="flex items-center gap-3">
                    <PortalTag variant={submitted ? "green" : "muted"}>
                        {submitted ? "Submitted" : "In progress"}
                    </PortalTag>
                    <DiscardDraftButton
                        draftId={draftId}
                        submitted={submitted}
                        action={discardDraftAction}
                    />
                </div>
            </PageHeader>

            {submitted && draft.shopifyDraftOrderName && (
                <div className="bg-white rounded-lg border border-emerald-200 px-5 py-4 mb-4">
                    <p className="font-sans text-[13px] font-medium text-neutral-900">
                        Your order has been submitted
                    </p>
                    <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed">
                        Received {draft.submittedAt ? formatDate(draft.submittedAt) : "just now"} as{" "}
                        {/* The Shopify reference is what staff will quote back on the
                            phone, so it is worth showing — but as a reference number,
                            not as the name of the thing. */}
                        <span className="tabular-nums">{draft.shopifyDraftOrderName}</span>. Nothing is
                        charged yet. Best Bottles confirms quantities and freight, then sends your invoice.
                    </p>
                </div>
            )}

            <OrderPad
                draftId={draftId}
                readOnly={submitted}
                saveLines={saveDraftLinesAction}
                searchProducts={searchProductsAction}
                initialLines={draft.lineItems.map((line) => ({
                    sku: line.sku,
                    description: line.description,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    shopifyVariantId: line.shopifyVariantId,
                }))}
            />

            {!submitted && (
                <SubmitDraftForm
                    draftId={draftId}
                    lineCount={draft.lineItems.length}
                    hasAddress={hasAddress}
                    submitAction={submitDraftAction}
                />
            )}
        </div>
    );
}
