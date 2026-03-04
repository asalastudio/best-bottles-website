"use client";

import { useState } from "react";
import { GoldRule, PageHeader, PortalButton, PortalCard, SectionLabel } from "@/components/portal/ui";

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
        <div className="px-12 py-10 max-w-[1400px]">
            <PageHeader
                eyebrow="Tools & Calculators"
                title="Packaging Reference"
                subtitle="Everything you need to spec, fill, and label your products — in one place."
            />

            {/* Top row — two calculators side by side */}
            <div className="grid grid-cols-2 gap-5 mb-5">

                {/* 01 — Fill Volume */}
                <PortalCard>
                    <SectionLabel>Calculator 01</SectionLabel>
                    <h2 className="font-serif text-xl text-obsidian font-normal mb-1">
                        Fill Volume Calculator
                    </h2>
                    <p className="font-serif text-sm text-ash italic mb-5">
                        Find your actual fill line for any bottle size
                    </p>
                    <GoldRule className="mb-5" />

                    <div className="mb-5">
                        <p className="font-sans text-xs text-ash mb-3">
                            Bottle capacity —{" "}
                            <span className="text-muted-gold font-medium">{capacity}ml</span>
                        </p>
                        <input
                            type="range"
                            min={5}
                            max={120}
                            value={capacity}
                            onChange={(e) => setCapacity(Number(e.target.value))}
                            className="w-full accent-muted-gold"
                        />
                        <div className="flex justify-between mt-2">
                            <span className="font-sans text-xs text-ash">5ml</span>
                            <span className="font-sans text-xs text-ash">120ml</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Recommended Fill", value: `${fillLine}ml` },
                            { label: "Headspace", value: `${headspace}ml` },
                            { label: "Fill Level", value: "88% of capacity" },
                            { label: "Expansion Room", value: "Thermal safe" },
                        ].map((r) => (
                            <div key={r.label} className="bg-travertine rounded-lg px-4 py-3">
                                <p className="font-sans text-xs text-ash mb-1.5">
                                    {r.label}
                                </p>
                                <p className="font-serif text-lg text-obsidian font-medium">
                                    {r.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </PortalCard>

                {/* 02 — Label Dimension */}
                <PortalCard>
                    <SectionLabel>Calculator 02</SectionLabel>
                    <h2 className="font-serif text-xl text-obsidian font-normal mb-1">
                        Label Dimension Generator
                    </h2>
                    <p className="font-serif text-sm text-ash italic mb-5">
                        Exact specs ready for your designer
                    </p>
                    <GoldRule className="mb-5" />

                    <div className="mb-5">
                        <p className="font-sans text-xs text-ash mb-3">
                            Label height —{" "}
                            <span className="text-muted-gold font-medium">{labelH}mm</span>
                        </p>
                        <input
                            type="range"
                            min={20}
                            max={100}
                            value={labelH}
                            onChange={(e) => setLabelH(Number(e.target.value))}
                            className="w-full accent-muted-gold"
                        />
                        <div className="flex justify-between mt-2">
                            <span className="font-sans text-xs text-ash">20mm</span>
                            <span className="font-sans text-xs text-ash">100mm</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                        {[
                            { label: "Label Height", value: `${labelH}mm` },
                            { label: "Wrap Circumference", value: labelCirc },
                            { label: "Safe Zone", value: `${safeZone}mm` },
                            { label: "Bleed", value: "3mm each side" },
                        ].map((r) => (
                            <div key={r.label} className="bg-travertine rounded-lg px-4 py-3">
                                <p className="font-sans text-xs text-ash mb-1.5">
                                    {r.label}
                                </p>
                                <p className="font-serif text-lg text-obsidian font-medium">
                                    {r.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <PortalButton size="sm">Export as PDF</PortalButton>
                </PortalCard>
            </div>

            {/* 03 — Volume Pricing — full width */}
            <PortalCard>
                <div className="grid grid-cols-[1fr_1.2fr] gap-16">

                    {/* Slider side */}
                    <div>
                        <SectionLabel>Calculator 03</SectionLabel>
                        <h2 className="font-serif text-xl text-obsidian font-normal mb-1">
                            Volume Pricing Calculator
                        </h2>
                        <p className="font-serif text-sm text-ash italic mb-5">
                            See your per-unit cost at any quantity
                        </p>
                        <GoldRule className="mb-5" />

                        <p className="font-sans text-xs text-ash mb-3">
                            Quantity —{" "}
                            <span className="text-muted-gold font-medium">{qty.toLocaleString()} units</span>
                        </p>
                        <input
                            type="range"
                            min={100}
                            max={5000}
                            step={50}
                            value={qty}
                            onChange={(e) => setQty(Number(e.target.value))}
                            className="w-full accent-muted-gold mb-6"
                        />

                        {/* Result display */}
                        <div className="bg-obsidian rounded-lg px-6 py-5">
                            <p className="font-sans text-xs tracking-[0.18em] uppercase text-muted-gold mb-2">
                                Your Price
                            </p>
                            <p className="font-serif text-[38px] text-bone font-normal leading-none mb-1">
                                ${activeTier?.price.toFixed(2)}
                                <span className="text-base text-ash ml-1">/unit</span>
                            </p>
                            <GoldRule className="my-3" />
                            <p className="font-serif text-base text-bone">
                                Order total:{" "}
                                <span className="text-muted-gold">{orderTotal}</span>
                            </p>
                        </div>
                    </div>

                    {/* Tier table side */}
                    <div>
                        <SectionLabel>All Pricing Tiers</SectionLabel>
                        <p className="font-serif text-base text-obsidian mb-5">
                            18-415 Frosted Elegant, 30ml
                        </p>
                        <div className="flex flex-col gap-2">
                            {priceTiers.map((tier) => {
                                const active = activeTier === tier;
                                return (
                                    <div
                                        key={tier.min}
                                        className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                                            active
                                                ? "bg-muted-gold/10 border-muted-gold"
                                                : "bg-travertine border-transparent"
                                        }`}
                                    >
                                        <span
                                            className={`font-sans text-xs ${
                                                active ? "text-obsidian" : "text-ash"
                                            }`}
                                        >
                                            {tier.min.toLocaleString()}
                                            {tier.max ? `–${tier.max.toLocaleString()}` : "+"} units
                                        </span>
                                        <span
                                            className={`font-serif text-lg ${
                                                active ? "text-muted-gold font-medium" : "text-obsidian"
                                            }`}
                                        >
                                            ${tier.price.toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </PortalCard>
        </div>
    );
}
