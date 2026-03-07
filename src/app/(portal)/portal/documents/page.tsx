export const dynamic = "force-dynamic";
import { PageHeader, PortalButton } from "@/components/portal/ui";

const categories = [
    {
        label: "Invoices",
        docs: [
            { name: "INV-2026-0047", desc: "18-415 Frosted Elegant, 30ml × 500", date: "Feb 24, 2026", size: "184 KB" },
            { name: "INV-2026-0038", desc: "Cobalt Roll-On 10ml × 1,000", date: "Feb 11, 2026", size: "201 KB" },
            { name: "INV-2026-0029", desc: "20-400 Boston Round, Amber × 250", date: "Jan 28, 2026", size: "168 KB" },
        ],
    },
    {
        label: "Spec Sheets",
        docs: [
            { name: "18-415 Frosted Elegant Series", desc: "Dimensions, weights, fill line specs", date: "Jan 2026", size: "412 KB" },
            { name: "Cobalt Roll-On 10ml", desc: "Bottle and roller ball specifications", date: "Jan 2026", size: "298 KB" },
        ],
    },
    {
        label: "SDS Documents",
        docs: [
            { name: "Glass Packaging Safety Data Sheet", desc: "Safety data for all glass SKUs", date: "2025", size: "540 KB" },
        ],
    },
    {
        label: "Agreements",
        docs: [
            { name: "Account Agreement — Lumière Atelier", desc: "Terms, net terms, tax exemption certificate", date: "Mar 2021", size: "612 KB" },
        ],
    },
] as const;

const colClass = "grid grid-cols-[1fr_180px_80px_100px] gap-4 items-center";

export default function PortalDocuments() {
    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader
                eyebrow="Document Vault"
                title="Documents"
                subtitle="Invoices, spec sheets, SDS documents, and agreements."
            />

            <div className="flex flex-col gap-5">
                {categories.map((category) => (
                    <div key={category.label} className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                        <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200">
                            <h2 className="font-sans text-[13px] font-semibold text-neutral-900">{category.label}</h2>
                        </div>
                        <div className={`${colClass} px-5 py-2 border-b border-neutral-100`}>
                            {["Document", "Date", "Size", ""].map((h) => (
                                <p key={h} className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">{h}</p>
                            ))}
                        </div>
                        {category.docs.map((doc, i) => (
                            <div
                                key={doc.name}
                                className={`${colClass} px-5 py-3 hover:bg-neutral-50 transition-colors ${
                                    i < category.docs.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <div>
                                    <p className="font-sans text-[13px] font-medium text-neutral-900">{doc.name}</p>
                                    <p className="font-sans text-[12px] text-neutral-400">{doc.desc}</p>
                                </div>
                                <span className="font-sans text-[13px] text-neutral-500">{doc.date}</span>
                                <span className="font-sans text-[12px] text-neutral-400">{doc.size}</span>
                                <div className="flex justify-end">
                                    <PortalButton variant="outline" size="sm">Download</PortalButton>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
