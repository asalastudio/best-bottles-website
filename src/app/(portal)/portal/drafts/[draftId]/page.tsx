export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PortalTag } from "@/components/portal/ui";
import OrderPad from "@/components/portal/OrderPad";
import SubmitDraftForm from "@/components/portal/SubmitDraftForm";
import { getDraftForViewer } from "@/lib/portal/draftEditor";
import { saveDraftLinesAction, submitDraftAction } from "../../actions";

function formatDate(value: number) {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PortalDraftDetail({
    params,
}: {
    params: Promise<{ draftId: string }>;
}) {
    const { draftId } = await params;
    const draft = await getDraftForViewer(draftId);
    if (!draft) notFound();

    const submitted = draft.status === "submitted";

    return (
        <div className="px-6 py-6 max-w-[900px]">
            <Link
                href="/portal/drafts"
                className="inline-block font-sans text-[12px] text-neutral-400 hover:text-neutral-700 mb-3 transition-colors"
            >
                ← All drafts
            </Link>

            <PageHeader
                eyebrow="Purchase order"
                title={draft.name}
                subtitle={
                    submitted
                        ? "Sent to Best Bottles. Your account manager reviews it and sends the invoice."
                        : "Add what you need, then send it to Best Bottles for review."
                }
            >
                <PortalTag variant={submitted ? "green" : "muted"}>
                    {submitted ? "Sent" : "Draft"}
                </PortalTag>
            </PageHeader>

            {submitted && draft.shopifyDraftOrderName && (
                <div className="bg-white rounded-lg border border-emerald-200 px-5 py-4 mb-4">
                    <p className="font-sans text-[13px] font-medium text-neutral-900">
                        Received as {draft.shopifyDraftOrderName}
                    </p>
                    <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed">
                        Sent {draft.submittedAt ? formatDate(draft.submittedAt) : "recently"}. Nothing is
                        charged yet. Best Bottles confirms quantities and pricing, then sends your invoice.
                    </p>
                </div>
            )}

            <OrderPad
                draftId={draftId}
                readOnly={submitted}
                saveLines={saveDraftLinesAction}
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
                    submitAction={submitDraftAction}
                />
            )}
        </div>
    );
}
