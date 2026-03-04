"use client";

import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { GoldRule, SectionLabel, PortalTag, StatCard } from "@/components/portal/ui";
import { TextureButton } from "@/components/ui/texture-button";

// ─── Static data ──────────────────────────────────────────────────────────────

const ACCOUNT        = "BB-004821";
const TIER           = "The Scaler";
const YTD_SPEND      = 48_200;
const CREDIT_LIMIT   = 100_000;
const CREDIT_USED    = 48_200;
const NEXT_MILESTONE = 100_000;

const monthlySpend = [
    { month: "Oct", amount: 6_400 },
    { month: "Nov", amount: 9_800 },
    { month: "Dec", amount: 14_200 },
    { month: "Jan", amount: 18_000 },
    { month: "Feb", amount: 26_600 },
    { month: "Mar", amount: 3_600, current: true },
];

const pipelineOrders = [
    { id: "ORD-9851", product: "Antique Gold Sprayer",         detail: "18-415 · Qty 1,000", stage: 0, eta: "Est. Mar 12", carrier: "Pending" },
    { id: "ORD-9839", product: "Cobalt Roll-On 10ml",          detail: "Qty 1,250",           stage: 2, eta: "Est. Mar 4",  carrier: "UPS"     },
    { id: "ORD-9841", product: "18-415 Frosted Elegant 30ml",  detail: "Qty 500",             stage: 2, eta: "Est. Mar 6",  carrier: "FedEx"   },
] as const;

const recentOrders = [
    { id: "ORD-9798", product: "Cobalt Roll-On 10ml",        qty: "1,000", date: "Feb 11, 2026", total: "$3,200" },
    { id: "ORD-9762", product: "Boston Round, Amber 20-400", qty: "250",   date: "Jan 28, 2026", total: "$1,850" },
    { id: "ORD-9744", product: "Frosted Diva 50ml",          qty: "500",   date: "Jan 14, 2026", total: "$4,750" },
    { id: "ORD-9711", product: "Clear Reducer 10ml",         qty: "2,000", date: "Dec 22, 2025", total: "$2,400" },
];

const quickReorder = [
    { product: "18-415 Frosted Elegant, 30ml", sku: "BB-FE-30-415",  lastQty: 500,   lastDate: "Feb 24" },
    { product: "Cobalt Roll-On, 10ml",          sku: "BB-CRO-10",     lastQty: 1_000, lastDate: "Feb 11" },
    { product: "Boston Round Amber, 20-400",    sku: "BB-BRA-20400",  lastQty: 250,   lastDate: "Jan 28" },
];

const graceRecs = [
    { name: "Frosted Diva, 50ml",           reason: "Pairs with your current Frosted Elegant 30ml line",           tag: "New to catalog" },
    { name: "Antique Gold Sprayer, 18-415", reason: "Compatible with your Elegant family — elevates presentation",  tag: "Best seller"    },
    { name: "Reducer Bottle, 10ml Clear",   reason: "Alternative to your Roll-On with more closure options",        tag: "Grace suggests" },
];

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const STAGES = ["Processing", "Confirmed", "In Transit", "Delivered"] as const;

function PipelineDots({ stage }: { stage: number }) {
    return (
        <div className="flex items-center">
            {STAGES.map((_, i) => (
                <div key={i} className="flex items-center">
                    <div className={`w-2 h-2 rounded-full transition-all ${
                        i < stage   ? "bg-muted-gold/60" :
                        i === stage ? "bg-muted-gold shadow-[0_0_6px_rgba(197,160,101,0.55)]" :
                        "bg-champagne"
                    }`} />
                    {i < STAGES.length - 1 && (
                        <div className={`w-5 h-px ${i < stage ? "bg-muted-gold/35" : "bg-champagne"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function SpendBar({ month, amount, max, current }: { month: string; amount: number; max: number; current?: boolean }) {
    const pct = Math.round((amount / max) * 100);
    return (
        <div className="flex flex-col items-center gap-2 flex-1">
            <div className="flex items-end w-full" style={{ height: 64 }}>
                <div
                    className={`w-full rounded-t-[2px] transition-all ${current ? "bg-muted-gold/75" : "bg-champagne hover:bg-muted-gold/25"}`}
                    style={{ height: `${Math.max(pct, 6)}%` }}
                />
            </div>
            <span className={`font-sans text-[11px] whitespace-nowrap ${current ? "text-muted-gold" : "text-slate"}`}>
                {month}
            </span>
        </div>
    );
}

const grainStyle: React.CSSProperties = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    opacity: 0.038,
    mixBlendMode: "overlay" as const,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalDashboard() {
    const { organization } = useOrganization();
    const orgName = organization?.name ?? "Lumière Atelier";

    const maxSpend       = Math.max(...monthlySpend.map(m => m.amount));
    const creditPct      = Math.round((CREDIT_USED / CREDIT_LIMIT) * 100);
    const milestonePct   = Math.min(Math.round((YTD_SPEND / NEXT_MILESTONE) * 100), 100);
    const toMilestone    = NEXT_MILESTONE - YTD_SPEND;
    const inTransitCount = pipelineOrders.filter(o => o.stage === 2).length;

    return (
        <div className="min-h-full">

            {/* ── Hero banner ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-obsidian px-10 py-10 border-b border-white/[0.06]">
                <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: "radial-gradient(circle, rgba(197,160,101,0.10) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                }} />
                <div className="absolute inset-0 pointer-events-none" style={grainStyle} />
                <div className="absolute top-0 right-0 w-[480px] h-[220px] bg-gradient-to-bl from-muted-gold/[0.10] to-transparent pointer-events-none" />

                <div className="relative flex items-center justify-between gap-8">
                    <div>
                        <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-muted-gold/65 mb-3">
                            Welcome back
                        </p>
                        <h1 className="font-serif text-[38px] text-bone font-normal tracking-[0.01em] leading-[1.06] mb-4">
                            {orgName}
                        </h1>
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-gold shadow-[0_0_6px_rgba(197,160,101,0.65)] animate-pulse shrink-0" />
                                <span className="font-sans text-sm text-bone/75">{inTransitCount} orders in transit</span>
                            </div>
                            <div className="w-px h-3 bg-white/[0.1]" />
                            <span className="font-sans text-sm text-bone/55">{ACCOUNT}</span>
                            <div className="w-px h-3 bg-white/[0.1]" />
                            <span className="font-sans text-sm text-bone/55">Net 30 · Tax Exempt</span>
                        </div>
                    </div>

                    <div className="flex items-stretch gap-4 shrink-0">
                        {/* Tier card */}
                        <div className="bg-white/[0.04] border border-muted-gold/[0.22] rounded-lg px-6 py-4 flex flex-col justify-between min-w-[160px]">
                            <p className="font-sans text-[11px] tracking-[0.2em] uppercase text-muted-gold/65 mb-3">
                                Tier Status
                            </p>
                            <div>
                                <p className="font-serif text-[24px] text-bone font-normal leading-none mb-1.5">{TIER}</p>
                                <p className="font-sans text-xs text-bone/55">$200K – $1M volume</p>
                            </div>
                        </div>

                        {/* PRD: texture-button for primary hero CTAs */}
                        <div className="flex flex-col gap-2.5 justify-center">
                            <TextureButton variant="secondary" size="default" asChild>
                                <Link href="/portal/drafts" className="flex items-center gap-2 font-sans text-sm tracking-[0.06em]">
                                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-[10px] h-[10px] shrink-0">
                                        <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
                                    </svg>
                                    New Draft
                                </Link>
                            </TextureButton>
                            <TextureButton variant="minimal" size="default" asChild>
                                <Link href="/portal/grace" className="flex items-center justify-center font-sans text-sm tracking-[0.06em]">
                                    Ask Grace
                                </Link>
                            </TextureButton>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main content ─────────────────────────────────────────────── */}
            <div className="px-10 py-8 space-y-6">

                {/* KPI strip — AnimatedNumber counts up on mount */}
                <div className="grid grid-cols-4 gap-4">
                    <StatCard
                        label="YTD Spend"
                        numericValue={YTD_SPEND}
                        format={(n) => `$${n.toLocaleString()}`}
                        sub="Jan – Mar 2026"
                        highlight
                    />
                    <StatCard
                        label="Active Orders"
                        numericValue={3}
                        sub={`${inTransitCount} in transit · 1 processing`}
                    />
                    <StatCard
                        label="Units In Flight"
                        numericValue={2_750}
                        sub="Across 2 shipments"
                    />
                    <StatCard
                        label="Credit Available"
                        numericValue={51_800}
                        format={(n) => `$${n.toLocaleString()}`}
                        sub="of $100K Net 30 limit"
                    />
                </div>

                {/* Middle grid */}
                <div className="grid grid-cols-[1.55fr_1fr] gap-5">

                    {/* Order pipeline */}
                    <div className="bg-linen rounded-lg border border-champagne shadow-[rgba(17,24,28,0.08)_0_0_0_1px,rgba(17,24,28,0.04)_0_2px_4px] px-7 py-6">
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <SectionLabel>Active Orders</SectionLabel>
                                <h2 className="font-serif text-xl text-obsidian font-normal">Order Pipeline</h2>
                            </div>
                            <Link href="/portal/orders" className="font-sans text-xs text-muted-gold hover:text-muted-gold/65 transition-colors pt-1">
                                View all →
                            </Link>
                        </div>

                        <div className="flex items-center gap-0 mb-5">
                            {STAGES.map((stage, i) => (
                                <div key={stage} className="flex items-center">
                                    <span className="font-sans text-[11px] text-slate">{stage}</span>
                                    {i < STAGES.length - 1 && (
                                        <div className="flex items-center mx-3">
                                            <div className="w-3 h-px bg-champagne" />
                                            <svg viewBox="0 0 4 4" className="w-[4px] h-[4px] ml-px text-champagne" fill="currentColor">
                                                <path d="M0 0 L4 2 L0 4 Z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <GoldRule className="mb-0" />

                        {pipelineOrders.map((order, i) => (
                            <div key={order.id}>
                                <div className="flex items-center justify-between py-5 gap-6">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1.5">
                                            <span className="font-sans text-xs text-gold-dim font-medium">{order.id}</span>
                                            {order.carrier !== "Pending" && (
                                                <>
                                                    <div className="w-px h-3 bg-champagne" />
                                                    <span className="font-sans text-xs text-slate">{order.carrier}</span>
                                                </>
                                            )}
                                        </div>
                                        <p className="font-serif text-[15px] text-obsidian mb-1">{order.product}</p>
                                        <p className="font-sans text-xs text-slate">{order.detail}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                                        <PipelineDots stage={order.stage} />
                                        <div className="flex items-center gap-2">
                                            <span className={`font-sans text-xs ${order.stage === 2 ? "text-muted-gold" : "text-slate"}`}>
                                                {STAGES[order.stage]}
                                            </span>
                                            <div className="w-px h-3 bg-champagne" />
                                            <span className="font-sans text-xs text-slate">{order.eta}</span>
                                        </div>
                                    </div>
                                </div>
                                {i < pipelineOrders.length - 1 && <GoldRule />}
                            </div>
                        ))}
                    </div>

                    {/* Right column */}
                    <div className="flex flex-col gap-5">

                        <div className="bg-linen rounded-lg border border-champagne shadow-[rgba(17,24,28,0.08)_0_0_0_1px,rgba(17,24,28,0.04)_0_2px_4px] px-7 py-6 flex-1">
                            <SectionLabel>Spend Momentum</SectionLabel>
                            <h2 className="font-serif text-[19px] text-obsidian font-normal mb-5">6-Month Trend</h2>
                            <div className="flex items-end gap-2 mb-5">
                                {monthlySpend.map(m => (
                                    <SpendBar key={m.month} month={m.month} amount={m.amount} max={maxSpend} current={m.current} />
                                ))}
                            </div>
                            <GoldRule className="mb-4" />
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-sans text-xs text-slate">Extended pricing unlock</span>
                                    <span className="font-sans text-xs text-muted-gold">{milestonePct}%</span>
                                </div>
                                <div className="h-[3px] bg-champagne rounded-full overflow-hidden mb-2">
                                    <div className="h-full bg-gradient-to-r from-gold-dim to-muted-gold rounded-full" style={{ width: `${milestonePct}%` }} />
                                </div>
                                <p className="font-sans text-xs text-slate">${(toMilestone / 1_000).toFixed(1)}K remaining to $100K milestone</p>
                            </div>
                        </div>

                        <div className="bg-linen rounded-lg border border-champagne shadow-[rgba(17,24,28,0.08)_0_0_0_1px,rgba(17,24,28,0.04)_0_2px_4px] px-7 py-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <SectionLabel>Net 30 Credit</SectionLabel>
                                    <p className="font-serif text-[24px] text-obsidian font-normal leading-none">
                                        $51,800
                                        <span className="font-sans text-sm text-ash ml-2">available</span>
                                    </p>
                                </div>
                                <span className="font-sans text-xs text-slate pt-1">of $100K limit</span>
                            </div>
                            <div className="h-[3px] bg-champagne rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-muted-gold/55 rounded-full" style={{ width: `${creditPct}%` }} />
                            </div>
                            <p className="font-sans text-xs text-slate">${(CREDIT_USED / 1_000).toFixed(1)}K used · next statement Mar 30</p>
                        </div>
                    </div>
                </div>

                {/* Lower grid */}
                <div className="grid grid-cols-[1.55fr_1fr] gap-5">

                    {/* Recent deliveries */}
                    <div className="bg-linen rounded-lg border border-champagne shadow-[rgba(17,24,28,0.08)_0_0_0_1px,rgba(17,24,28,0.04)_0_2px_4px] px-7 py-6">
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <SectionLabel>Completed</SectionLabel>
                                <h2 className="font-serif text-xl text-obsidian font-normal">Recent Deliveries</h2>
                            </div>
                            <Link href="/portal/orders" className="font-sans text-xs text-muted-gold hover:text-muted-gold/65 transition-colors pt-1">
                                Full history →
                            </Link>
                        </div>

                        <div className="grid grid-cols-[2fr_0.65fr_0.9fr_0.65fr_auto] gap-4 pb-2.5 mb-1 border-b border-champagne">
                            {["Product", "Qty", "Date", "Total", ""].map((h, i) => (
                                <span key={i} className="font-sans text-xs text-slate">{h}</span>
                            ))}
                        </div>

                        {recentOrders.map((order, i) => (
                            <div key={order.id}>
                                <div className="grid grid-cols-[2fr_0.65fr_0.9fr_0.65fr_auto] gap-4 py-3.5 items-center group hover:bg-travertine/25 -mx-2 px-2 rounded-sm transition-colors cursor-pointer">
                                    <div>
                                        <p className="font-sans text-[11px] tracking-[0.1em] uppercase text-gold-dim mb-0.5">{order.id}</p>
                                        <p className="font-serif text-sm text-obsidian">{order.product}</p>
                                    </div>
                                    <span className="font-sans text-sm text-slate">{order.qty}</span>
                                    <span className="font-sans text-sm text-slate">{order.date}</span>
                                    <span className="font-serif text-[15px] text-obsidian">{order.total}</span>
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity font-sans text-xs text-muted-gold hover:text-muted-gold/70 whitespace-nowrap">
                                        Reorder
                                    </button>
                                </div>
                                {i < recentOrders.length - 1 && <GoldRule />}
                            </div>
                        ))}
                    </div>

                    {/* Grace recommendations */}
                    <div className="relative overflow-hidden bg-obsidian rounded-lg border border-muted-gold/[0.14] shadow-[0_2px_8px_rgba(0,0,0,0.14)] px-7 py-6 flex flex-col">
                        <div className="absolute inset-0 pointer-events-none" style={grainStyle} />
                        <div className="absolute top-0 left-0 w-full h-[120px] bg-gradient-to-b from-muted-gold/[0.06] to-transparent pointer-events-none" />

                        <div className="relative flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-1 h-1 rounded-full bg-muted-gold animate-pulse shrink-0" />
                                <SectionLabel>Grace · For You</SectionLabel>
                            </div>
                            <h2 className="font-serif text-xl text-bone font-normal mb-1">Curated for your line</h2>
                            <p className="font-sans text-sm text-bone/65 mb-5">Based on your order history</p>

                            <GoldRule className="mb-0" />

                            <div className="flex-1">
                                {graceRecs.map((rec, i) => (
                                    <div key={rec.name}>
                                        <div className="py-4 group cursor-pointer">
                                            <div className="flex items-start justify-between gap-3 mb-1.5">
                                                <p className="font-serif text-[15px] text-bone group-hover:text-muted-gold/90 transition-colors">
                                                    {rec.name}
                                                </p>
                                                <PortalTag variant="gold">{rec.tag}</PortalTag>
                                            </div>
                                            <p className="font-sans text-sm text-bone/75 leading-relaxed">{rec.reason}</p>
                                        </div>
                                        {i < graceRecs.length - 1 && <GoldRule />}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-muted-gold/[0.12] mt-1">
                                <Link
                                    href="/portal/grace"
                                    className="inline-flex items-center gap-2.5 bg-muted-gold px-5 py-2.5 rounded-sm font-sans text-[11px] tracking-[0.14em] uppercase text-obsidian hover:bg-muted-gold/90 active:scale-[0.97] transition-all"
                                >
                                    Open Grace Workspace
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick reorder */}
                <div className="bg-linen rounded-lg border border-champagne shadow-[rgba(17,24,28,0.08)_0_0_0_1px,rgba(17,24,28,0.04)_0_2px_4px] px-7 py-6">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <SectionLabel>Repeat Orders</SectionLabel>
                            <h2 className="font-serif text-xl text-obsidian font-normal">Quick Reorder</h2>
                        </div>
                        <Link href="/portal/drafts" className="font-sans text-xs text-muted-gold hover:text-muted-gold/65 transition-colors pt-1">
                            New draft →
                        </Link>
                    </div>

                    <GoldRule className="mb-5" />

                    <div className="grid grid-cols-3 gap-4">
                        {quickReorder.map((item) => (
                            <div
                                key={item.sku}
                                className="border border-champagne rounded-lg px-5 py-4 hover:border-muted-gold/45 hover:bg-travertine/20 transition-all group cursor-pointer"
                            >
                                <p className="font-sans text-[11px] tracking-[0.12em] uppercase text-gold-dim mb-1.5">{item.sku}</p>
                                <p className="font-serif text-[15px] text-obsidian mb-2 leading-[1.3]">{item.product}</p>
                                <p className="font-sans text-xs text-slate mb-4">
                                    Last: {item.lastQty.toLocaleString()} units · {item.lastDate}
                                </p>
                                <button className="w-full font-sans text-[11px] tracking-[0.14em] uppercase border border-muted-gold/40 text-muted-gold py-2.5 rounded-sm hover:bg-muted-gold hover:text-obsidian hover:border-muted-gold active:scale-[0.97] transition-all duration-150">
                                    Reorder Same
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
