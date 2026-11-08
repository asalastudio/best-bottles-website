import Link from "next/link";
import HelpGraceButton from "@/components/help/HelpGraceButton";
import { FIT_STATUS_LABEL, FIT_STATUS_MEANING, itemCatalogHref, type FitGroup, type FitStatus } from "@/lib/help/fit";

export const FIT_STATUS_STYLE: Record<FitStatus, { dot: string; text: string; box: string }> = {
    listed: { dot: "bg-[#2F6B45]", text: "text-[#2F6B45]", box: "border-champagne/70 bg-warm-white" },
    "not-confirmed": { dot: "bg-[#B07A1F]", text: "text-[#7A5410]", box: "border-[#E8D6B0] bg-[#FBF5E8]" },
    conflicting: { dot: "bg-[#A23B2A]", text: "text-[#8A2E20]", box: "border-[#E5C4BC] bg-[#FBF0EE]" },
};

/** What the three labels mean, once, before anyone relies on them. */
export function FitLegend({ className = "" }: { className?: string }) {
    return (
        <dl className={`grid gap-3 sm:grid-cols-3 ${className}`}>
            {(Object.keys(FIT_STATUS_LABEL) as FitStatus[]).map((status) => (
                <div key={status} className={`rounded-sm border p-4 ${FIT_STATUS_STYLE[status].box}`}>
                    <dt className={`flex items-center gap-2 text-sm font-semibold ${FIT_STATUS_STYLE[status].text}`}>
                        <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${FIT_STATUS_STYLE[status].dot}`} />
                        {FIT_STATUS_LABEL[status]}
                    </dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate">{FIT_STATUS_MEANING[status]}</dd>
                </div>
            ))}
        </dl>
    );
}

/** Register names end in the thread size, which the page already states. */
export function shortPartName(name: string): string {
    return name.replace(/,?\s*thread\s*size\s*[\d]+-[\d]+\s*$/i, "").replace(/\s+thread\s+[\d]+-[\d]+\s*$/i, "").trim() || name;
}

/** Parts grouped by type. Each shows its item code and a link to its live price and stock. */
export function FitGroups({ groups, status }: { groups: FitGroup[]; status: FitStatus }) {
    const style = FIT_STATUS_STYLE[status];
    return (
        <div className="mt-4 space-y-6">
            {groups.map((group) => (
                <div key={group.type}>
                    <h3 className="text-sm font-semibold">{group.label} <span className="font-normal text-slate">· {group.rows.length}</span></h3>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {group.rows.map((row) => (
                            <li key={row.componentId} className={`rounded-sm border p-3 text-sm ${style.box}`}>
                                <span className="block">{shortPartName(row.name)}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                    {row.itemCode ? (
                                        <>
                                            <span className="font-mono text-slate">Item {row.itemCode}</span>
                                            {status !== "conflicting" && (
                                                <Link href={itemCatalogHref(row.itemCode)} className="text-gold-dim underline underline-offset-4">Price and stock</Link>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-slate">No item code on record</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

/** Physical fit is not formula compatibility; say so wherever fit is shown. */
export function FormulaNote({ className = "", graceQuestion }: { className?: string; graceQuestion?: string }) {
    return (
        <section aria-labelledby="formula" className={`rounded-sm border border-champagne/70 bg-linen p-6 ${className}`}>
            <h2 id="formula" className="text-base font-semibold normal-case tracking-normal">Will it work with my formula?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
                We don&apos;t know. This page covers physical fit only, and we hold no test data on how glass, caps, roller balls or seals react to oils, alcohols or actives. Test samples with your formula before ordering in volume.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/request-sample" className="inline-flex h-11 items-center rounded-md border border-champagne bg-warm-white px-5 text-sm hover:border-gold-dim">Request samples</Link>
                {graceQuestion && <HelpGraceButton question={graceQuestion} label="Ask Grace about this bottle" tone="light" />}
            </div>
        </section>
    );
}
