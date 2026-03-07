"use client";

import { useState } from "react";
import { PageHeader, PortalButton } from "@/components/portal/ui";

const priceTiers = [
    { min: 100, max: 249, price: 0.89 },
    { min: 250, max: 499, price: 0.76 },
    { min: 500, max: 999, price: 0.64 },
    { min: 1000, max: 2499, price: 0.55 },
    { min: 2500, max: null, price: 0.44 },
] as const;

export default function PortalTools() {
    const [capacity, setCapacity] = useState(30);
    const [labelH, setLabelH] = useState(55);
    const [qty, setQty] = useState(500);

    const fillLine = (capacity * 0.88).toFixed(1);
    const headspace = (capacity * 0.12).toFixed(1);
    const labelCirc = `${(capacity * 2.9).toFixed(0)}mm`;
    const safeZone = labelH - 6;

    const activeTier = priceTiers.find(
        (t) => qty >= t.min && (t.max === null || qty <= t.max)
    );
    const orderTotal = activeTier
        ? (activeTier.price * qty).toLocaleString("en-US", { style: "currency", currency: "USD" })
        : "—";

    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader
                eyebrow="Tools"
                title="Packaging Tools"
                subtitle="Calculators for fill volume, label dimensions, and volume pricing."
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
                        <p className="font-sans text-[12px] text-neutral-400">Exact specs ready for your designer</p>
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
                        <PortalButton variant="outline" size="sm">Export as PDF</PortalButton>
                    </div>
                </div>
            </div>

            {/* Volume Pricing */}
            <div className="bg-white rounded-lg border border-neutral-200">
                <div className="px-5 py-3 border-b border-neutral-200">
                    <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Volume Pricing Calculator</h2>
                    <p className="font-sans text-[12px] text-neutral-400">18-415 Frosted Elegant, 30ml · See your per-unit cost at any quantity</p>
                </div>
                <div className="grid grid-cols-[1fr_1.2fr] divide-x divide-neutral-200">
                    <div className="px-5 py-4">
                        <label className="font-sans text-[12px] text-neutral-500 mb-2 block">
                            Quantity — <span className="font-medium text-neutral-900">{qty.toLocaleString()} units</span>
                        </label>
                        <input
                            type="range" min={100} max={5000} step={50} value={qty}
                            onChange={(e) => setQty(Number(e.target.value))}
                            className="w-full accent-neutral-900 mb-5"
                        />
                        <div className="bg-neutral-900 rounded-lg px-5 py-4">
                            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">Your Price</p>
                            <p className="font-sans text-3xl font-bold text-white leading-tight">
                                ${activeTier?.price.toFixed(2)}
                                <span className="text-sm text-neutral-400 font-normal ml-1">/unit</span>
                            </p>
                            <div className="h-px bg-neutral-700 my-3" />
                            <p className="font-sans text-[13px] text-neutral-300">
                                Order total: <span className="font-medium text-white">{orderTotal}</span>
                            </p>
                        </div>
                    </div>
                    <div className="px-5 py-4">
                        <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">All Pricing Tiers</p>
                        <div className="flex flex-col gap-1.5">
                            {priceTiers.map((tier) => {
                                const active = activeTier === tier;
                                return (
                                    <div
                                        key={tier.min}
                                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-md border transition-colors ${
                                            active
                                                ? "bg-neutral-900 border-neutral-900 text-white"
                                                : "bg-neutral-50 border-neutral-100"
                                        }`}
                                    >
                                        <span className={`font-sans text-[13px] ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                                            {tier.min.toLocaleString()}{tier.max ? `–${tier.max.toLocaleString()}` : "+"} units
                                        </span>
                                        <span className={`font-sans text-[15px] font-semibold ${active ? "text-white" : "text-neutral-900"}`}>
                                            ${tier.price.toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
