"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/portal/ui";

export default function PortalTools() {
    const [capacity, setCapacity] = useState(30);
    const [labelH, setLabelH] = useState(55);

    const fillLine = (capacity * 0.88).toFixed(1);
    const headspace = (capacity * 0.12).toFixed(1);
    const labelCirc = `${(capacity * 2.9).toFixed(0)}mm`;
    const safeZone = labelH - 6;

    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader
                eyebrow="Tools"
                title="Packaging Tools"
                subtitle="Calculators for fill volume and label dimensions."
            />

            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Fill Volume */}
                <div className="bg-white rounded-lg border border-neutral-200">
                    <div className="px-5 py-3 border-b border-neutral-200">
                        <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Fill Volume Calculator</h2>
                        <p className="font-sans text-[12px] text-neutral-400">Find your actual fill line for any bottle size</p>
                    </div>
                    <div className="px-5 py-4">
                        <label className="font-sans text-[12px] text-neutral-500 mb-2 block">
                            Bottle capacity — <span className="font-medium text-neutral-900">{capacity}ml</span>
                        </label>
                        <input
                            type="range" min={5} max={120} value={capacity}
                            onChange={(e) => setCapacity(Number(e.target.value))}
                            className="w-full accent-neutral-900 mb-4"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: "Recommended Fill", value: `${fillLine}ml` },
                                { label: "Headspace", value: `${headspace}ml` },
                                { label: "Fill Level", value: "88%" },
                                { label: "Expansion Room", value: "Thermal safe" },
                            ].map((r) => (
                                <div key={r.label} className="bg-neutral-50 rounded-md px-3.5 py-2.5 border border-neutral-100">
                                    <p className="font-sans text-[11px] text-neutral-400 mb-0.5">{r.label}</p>
                                    <p className="font-sans text-[15px] font-semibold text-neutral-900">{r.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Label Dimension */}
                <div className="bg-white rounded-lg border border-neutral-200">
                    <div className="px-5 py-3 border-b border-neutral-200">
                        <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Label Dimension Generator</h2>
                        <p className="font-sans text-[12px] text-neutral-400">Starting dimensions for your designer — confirm against the product spec</p>
                    </div>
                    <div className="px-5 py-4">
                        <label className="font-sans text-[12px] text-neutral-500 mb-2 block">
                            Label height — <span className="font-medium text-neutral-900">{labelH}mm</span>
                        </label>
                        <input
                            type="range" min={20} max={100} value={labelH}
                            onChange={(e) => setLabelH(Number(e.target.value))}
                            className="w-full accent-neutral-900 mb-4"
                        />
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {[
                                { label: "Label Height", value: `${labelH}mm` },
                                { label: "Wrap Circumference", value: labelCirc },
                                { label: "Safe Zone", value: `${safeZone}mm` },
                                { label: "Bleed", value: "3mm each side" },
                            ].map((r) => (
                                <div key={r.label} className="bg-neutral-50 rounded-md px-3.5 py-2.5 border border-neutral-100">
                                    <p className="font-sans text-[11px] text-neutral-400 mb-0.5">{r.label}</p>
                                    <p className="font-sans text-[15px] font-semibold text-neutral-900">{r.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Volume pricing intentionally absent.
                This card used to show a five-tier ladder of invented prices
                against one named SKU. Real tier pricing is per product and
                lives in Convex; the catalogue already renders it. A second,
                fabricated source of price would be worse than no calculator. */}
            <div className="bg-white rounded-lg border border-neutral-200 px-5 py-5">
                <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Volume pricing</h2>
                <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed max-w-[560px]">
                    Price breaks depend on the exact product, so they live with the product.
                    Open any item in the catalogue to see your account&rsquo;s full tier ladder
                    and the quantity needed to reach the next break.
                </p>
                <Link
                    href="/catalog"
                    className="mt-4 inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                    Browse the catalogue
                </Link>
            </div>
        </div>
    );
}
