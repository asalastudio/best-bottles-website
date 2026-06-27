import type { ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
    ArrowRight,
    Calendar,
    CheckCircle,
    Clock,
    Compass,
    Database,
    ExternalLink,
    FileText,
    Globe,
    GridFour,
    Package,
    ShieldCheck,
    ShoppingBag,
    SlidersHorizontal,
    Sparkle,
    Users,
} from "@/components/icons";
import { SwitchAccountButton } from "@/components/auth/SwitchAccountButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserEmailAddresses, hasExecutiveHubAccess } from "@/lib/teamAccess";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: { absolute: "Executive Hub | Best Bottles" },
    robots: { index: false, follow: false },
};

type ExecutivePageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type IconComponent = ComponentType<{
    className?: string;
    size?: number;
    weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}>;

type Tone = "gold" | "ink" | "ready" | "watch" | "risk";

function isLocalPreview(searchParams: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;

    const preview = searchParams?.preview;
    const previewValues = Array.isArray(preview) ? preview : [preview];

    return previewValues.some((value) => value === "1" || value === "true");
}

function getShopifyAdminHref() {
    const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
        ?.trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

    if (!domain) return "https://admin.shopify.com";

    const storeHandle = domain.replace(/\.myshopify\.com$/i, "").split(".")[0];
    return storeHandle ? `https://admin.shopify.com/store/${storeHandle}` : "https://admin.shopify.com";
}

function getMadisonStudioHref() {
    return process.env.NEXT_PUBLIC_MADISON_STUDIO_URL?.trim() || "https://madison-studio-cursor.vercel.app";
}

const packagingStudioHref = "https://best-bottles-packaging-studio.vercel.app/";

const commandNav = [
    { label: "Overview", href: "#overview", icon: GridFour, active: true },
    { label: "Revenue", href: "#commerce", icon: ShoppingBag },
    { label: "Grace AI", href: "#grace-ai", icon: Sparkle },
    { label: "Catalog", href: "#catalog", icon: Package },
    { label: "Content", href: "#content", icon: FileText },
    { label: "Systems", href: "#source-links", icon: ShieldCheck },
];

const headlineMetrics = [
    {
        label: "Revenue truth",
        value: "Pending",
        source: "Shopify Admin",
        state: "Needs API",
        tone: "watch" as const,
        icon: ShoppingBag,
        detail: "Completed orders, revenue, AOV, discounts, refunds, and inventory.",
    },
    {
        label: "Grace AI",
        value: "Mapped",
        source: "Mixpanel + Convex",
        state: "Ready to wire",
        tone: "ready" as const,
        icon: Sparkle,
        detail: "No-match rate, tool success, voice fallback, and assisted conversion.",
    },
    {
        label: "Catalog health",
        value: "Audit ready",
        source: "Convex + product truth",
        state: "Source-known",
        tone: "gold" as const,
        icon: Package,
        detail: "Product groups, SKU truth, fitments, checkout readiness, and media.",
    },
    {
        label: "Production health",
        value: "Link ready",
        source: "Vercel",
        state: "Needs live read",
        tone: "watch" as const,
        icon: ShieldCheck,
        detail: "Deployment, errors, performance, and release confidence.",
    },
];

const operatingStats = [
    { label: "Executive lanes", value: "6", note: "Commerce, CRO, Grace, catalog, content, production", icon: Compass },
    { label: "Source links", value: "8", note: "Internal and external systems ready from one hub", icon: ExternalLink },
    { label: "Live values", value: "0", note: "Held until Shopify, Mixpanel, Convex, Vercel, and Sanity are read", icon: Database },
    { label: "Board stance", value: "V1", note: "Source-aware dashboard shell for executive operation", icon: SlidersHorizontal },
];

const presidentFocusItems = [
    {
        label: "Approve revenue rules",
        body: "Decide gross vs. net, refunds, discounts, shipping, taxes, cancellations, and test-order exclusions before any CEO revenue number appears.",
    },
    {
        label: "Connect source reads",
        body: "Shopify, Mixpanel, Convex, Sanity, and Vercel should feed the dashboard directly instead of relying on copied snapshots.",
    },
    {
        label: "Set alert thresholds",
        body: "Pick yellow/red thresholds for Grace no-match, checkout handoff, zero-result search, catalog readiness, and production health.",
    },
];

const decisionQueue = [
    { label: "Revenue definition", owner: "President + finance", status: "Needs decision" },
    { label: "Grace AI quality bar", owner: "President + ops", status: "Set target" },
    { label: "Catalog audit cadence", owner: "Ops", status: "Weekly" },
    { label: "Launch risk threshold", owner: "President", status: "Define" },
];

const executiveLanes = [
    {
        id: "commerce",
        label: "Commerce",
        title: "Shopify revenue command",
        source: "Shopify Admin",
        score: 26,
        status: "Needs API",
        tone: "watch" as const,
        icon: ShoppingBag,
        body: "Completed revenue, completed orders, AOV, refunds, discounts, and inventory availability belong here once the finance definition is approved.",
    },
    {
        id: "cro",
        label: "CRO",
        title: "Conversion and behavior",
        source: "Mixpanel",
        score: 38,
        status: "Mapped",
        tone: "gold" as const,
        icon: Globe,
        body: "PDP views, catalog filters, zero-result states, cart adds, checkout starts, redirects, and form submissions should roll into this lane.",
    },
    {
        id: "grace-ai",
        label: "Grace AI",
        title: "Assistant reliability",
        source: "Mixpanel + Convex",
        score: 68,
        status: "Ready to wire",
        tone: "ready" as const,
        icon: Sparkle,
        body: "Tool success, no-match, connection failure, voice fallback, cart proposals, and Grace-assisted forms belong in the executive view.",
    },
    {
        id: "catalog",
        label: "Catalog",
        title: "Product truth and readiness",
        source: "Convex + audits",
        score: 74,
        status: "Audit-ready",
        tone: "ready" as const,
        icon: Package,
        body: "Catalog groups, fitments, media, SKU mapping, and checkout-ready variants should be summarized before customers feel the issue.",
    },
    {
        id: "content",
        label: "Content",
        title: "Merchandising and CMS",
        source: "Sanity",
        score: 42,
        status: "Needs live read",
        tone: "gold" as const,
        icon: FileText,
        body: "Homepage, journal, collection copy, and merchandising completeness should sit beside product and revenue signals.",
    },
    {
        id: "production",
        label: "Production",
        title: "Release and uptime health",
        source: "Vercel",
        score: 34,
        status: "Needs observability",
        tone: "watch" as const,
        icon: ShieldCheck,
        body: "Deploy status, error health, performance, and environment readiness should make release risk visible before launch decisions.",
    },
];

const graceSignals = [
    { label: "Tool success rate", status: "Ready", value: "Mapped" },
    { label: "No-match rate", status: "Watch", value: "Mapped" },
    { label: "Connection failure", status: "Watch", value: "Mapped" },
    { label: "Voice fallback", status: "Watch", value: "Mapped" },
    { label: "Cart proposal acceptance", status: "Ready", value: "Mapped" },
    { label: "Grace-assisted forms", status: "Ready", value: "Mapped" },
];

const sourceLinks = [
    {
        label: "Team Hub",
        href: "/team",
        description: "Team launcher for day-to-day operating tools.",
        badge: "Team",
        icon: Users,
    },
    {
        label: "Sanity Studio",
        href: "/studio",
        description: "CMS, merchandising, homepage, journal, and content editing.",
        badge: "CMS",
        icon: FileText,
    },
    {
        label: "Madison Studio",
        href: getMadisonStudioHref(),
        description: "Product photography, image generation, and creative review.",
        badge: "Image",
        icon: Sparkle,
    },
    {
        label: "Best Bottles Packaging Studio",
        href: packagingStudioHref,
        description: "Packaging layouts, presentation assets, and studio materials.",
        badge: "Packaging",
        icon: Package,
    },
    {
        label: "Backend Shopify Admin",
        href: getShopifyAdminHref(),
        description: "Open the Shopify backend for completed orders, revenue, inventory, refunds, and publishing.",
        badge: "Commerce",
        icon: ShoppingBag,
    },
    {
        label: "Mixpanel Replay",
        href: "https://mixpanel.com/project/4006168/view/4501946/app/session-replay",
        description: "Behavior funnels, session replay, Grace events, and CRO drill-down.",
        badge: "Behavior",
        icon: Globe,
    },
    {
        label: "Convex Dashboard",
        href: "https://dashboard.convex.dev",
        description: "Catalog records, form submissions, Grace data, and internal entities.",
        badge: "Data",
        icon: Database,
    },
    {
        label: "Vercel Project",
        href: "https://vercel.com/asala/best-bottles-website",
        description: "Deployments, environment variables, logs, and production health.",
        badge: "Infra",
        icon: ShieldCheck,
    },
];

const sourceRows = [
    { source: "Shopify", owner: "Commerce truth", status: "Needs API", lane: "Revenue, orders, AOV, inventory" },
    { source: "Mixpanel", owner: "Behavior truth", status: "Needs saved IDs", lane: "CRO, Grace, zero-result searches" },
    { source: "Convex", owner: "Operational truth", status: "Audit-ready", lane: "Catalog, forms, fitments, Grace records" },
    { source: "Sanity", owner: "Content truth", status: "Needs live read", lane: "CMS completeness and merchandising" },
    { source: "Vercel", owner: "Production truth", status: "Needs live read", lane: "Deploys, performance, errors" },
];

function toneClasses(tone: Tone) {
    switch (tone) {
        case "ink":
            return "border-obsidian bg-obsidian text-linen";
        case "ready":
            return "border-emerald-200 bg-emerald-50 text-emerald-800";
        case "watch":
            return "border-amber-200 bg-amber-50 text-amber-800";
        case "risk":
            return "border-rose-200 bg-rose-50 text-rose-800";
        default:
            return "border-muted-gold/30 bg-muted-gold/10 text-gold-dim";
    }
}

function resolveHref(href: string, previewMode: boolean) {
    if (href === "/team" && previewMode) return "/team?preview=1";
    return href;
}

function MetricCard({
    icon: Icon,
    label,
    value,
    source,
    state,
    tone,
    detail,
}: {
    icon: IconComponent;
    label: string;
    value: string;
    source: string;
    state: string;
    tone: Tone;
    detail: string;
}) {
    return (
        <Card className="min-h-52 rounded-lg border-champagne/60 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.045)]">
            <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className={cn("flex size-10 items-center justify-center rounded-md border", toneClasses(tone))}>
                        <Icon size={20} weight="duotone" />
                    </div>
                    <Badge variant="outline" className={cn("rounded-md border px-2.5 py-1 text-[11px]", toneClasses(tone))}>
                        {state}
                    </Badge>
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate">{label}</p>
                <p className="mt-2 text-3xl font-semibold leading-none tracking-normal text-obsidian">{value}</p>
                <p className="mt-3 text-sm font-medium text-obsidian">{source}</p>
                <p className="mt-3 text-sm leading-6 text-slate">{detail}</p>
            </CardContent>
        </Card>
    );
}

function StatTile({
    icon: Icon,
    label,
    value,
    note,
}: {
    icon: IconComponent;
    label: string;
    value: string;
    note: string;
}) {
    return (
        <div className="flex min-h-28 gap-4 border border-champagne/60 bg-linen p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-muted-gold/30 bg-bone text-gold-dim">
                <Icon size={19} weight="duotone" />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">{label}</p>
                <p className="mt-2 text-3xl font-semibold leading-none text-obsidian">{value}</p>
                <p className="mt-2 text-sm leading-5 text-slate">{note}</p>
            </div>
        </div>
    );
}

function LaneRow({
    lane,
}: {
    lane: (typeof executiveLanes)[number];
}) {
    const Icon = lane.icon;

    return (
        <div id={lane.id} className="grid gap-4 border-b border-champagne/50 py-5 last:border-b-0 lg:grid-cols-[220px_minmax(0,1fr)_150px] lg:items-center">
            <div className="flex items-start gap-3">
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-md border", toneClasses(lane.tone))}>
                    <Icon size={19} weight="duotone" />
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">{lane.label}</p>
                    <p className="mt-1 font-semibold text-obsidian">{lane.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate">{lane.source}</p>
                </div>
            </div>
            <div>
                <div className="flex items-center gap-3">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-travertine">
                        <div className="h-full rounded-full bg-obsidian" style={{ width: `${lane.score}%` }} />
                    </div>
                    <span className="w-11 text-right text-sm font-semibold text-obsidian">{lane.score}%</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate">{lane.body}</p>
            </div>
            <Badge variant="outline" className={cn("w-fit rounded-md border px-3 py-1 text-[11px] lg:justify-self-end", toneClasses(lane.tone))}>
                {lane.status}
            </Badge>
        </div>
    );
}

async function getExecutiveAccessFallback(previewMode: boolean) {
    if (previewMode) return null;

    const { userId, redirectToSignIn } = await auth();

    if (!userId) {
        return redirectToSignIn({ returnBackUrl: "/executive" });
    }

    const user = await currentUser();
    const emailAddresses = getUserEmailAddresses(user);
    if (!hasExecutiveHubAccess(user?.publicMetadata, { emailAddresses })) {
        return <ExecutiveAccessPending emailAddresses={emailAddresses} />;
    }

    return null;
}

export default async function ExecutivePage({ searchParams }: ExecutivePageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const previewMode = isLocalPreview(resolvedSearchParams);

    const accessFallback = await getExecutiveAccessFallback(previewMode);
    if (accessFallback) return accessFallback;

    return (
        <main className="min-h-screen overflow-x-hidden bg-bone text-obsidian" id="overview" data-executive-hub>
            <style>
                {`
                    body:has([data-executive-hub]) button[class*="z-[55]"],
                    body:has([data-executive-hub]) nav[class*="bottom-0"][class*="z-50"] {
                        display: none !important;
                    }
                `}
            </style>
            <div className="mx-auto grid w-full max-w-[1680px] lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="min-w-0 border-b border-champagne/70 bg-linen px-5 py-5 lg:sticky lg:top-0 lg:min-h-screen lg:border-b-0 lg:border-r">
                    <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-md border border-muted-gold/30 bg-bone text-gold-dim">
                            <ShieldCheck size={24} weight="duotone" />
                        </div>
                        <div>
                            <p className="font-serif text-xl font-semibold leading-tight text-obsidian">Best Bottles</p>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate">Executive command</p>
                        </div>
                    </div>

                    <nav className="mt-8 grid gap-2" aria-label="Executive Hub sections">
                        {commandNav.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={cn(
                                        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold",
                                        item.active
                                            ? "bg-obsidian text-linen"
                                            : "text-obsidian hover:bg-travertine",
                                    )}
                                >
                                    <Icon size={18} weight="duotone" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="mt-8 border-t border-champagne/70 pt-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">Source stance</p>
                        <p className="mt-3 text-sm leading-6 text-slate">
                            Live revenue, orders, conversion, and production values stay hidden until the source is read.
                        </p>
                        <Button asChild className="mt-5 w-full justify-between rounded-md bg-obsidian text-linen hover:bg-obsidian/90">
                            <Link href={resolveHref("/team", previewMode)}>
                                Team Hub
                                <ArrowRight size={16} weight="bold" />
                            </Link>
                        </Button>
                    </div>
                </aside>

                <div className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
                    <header className="border-b border-champagne/70 pb-6">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Badge className="rounded-md bg-obsidian px-3 py-1 text-linen hover:bg-obsidian">
                                        Boss view
                                    </Badge>
                                    {previewMode ? (
                                        <Badge variant="outline" className="rounded-md border-muted-gold/40 bg-linen px-3 py-1 text-gold-dim">
                                            Local preview mode
                                        </Badge>
                                    ) : null}
                                </div>
                                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted-gold">
                                    Executive Hub
                                </p>
                                <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-obsidian sm:text-5xl">
                                    Best Bottles Operating Dashboard
                                </h1>
                                <p className="mt-4 max-w-3xl text-base leading-7 text-slate">
                                    A polished command center for the boss: source-aware business health, Grace AI signals,
                                    catalog readiness, production risk, and one-click paths into the systems that own the truth.
                                </p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
                                <div className="flex min-h-10 items-center gap-2 rounded-md border border-champagne/70 bg-linen px-3 text-sm font-semibold text-obsidian">
                                    <Clock size={16} weight="duotone" className="text-gold-dim" />
                                    Source-aware V1
                                </div>
                                <div className="flex min-h-10 items-center gap-2 rounded-md border border-champagne/70 bg-linen px-3 text-sm font-semibold text-obsidian">
                                    <Calendar size={16} weight="duotone" className="text-gold-dim" />
                                    Today
                                </div>
                                <div className="flex min-h-10 items-center gap-2 rounded-md border border-champagne/70 bg-linen px-3 text-sm font-semibold text-obsidian">
                                    <Database size={16} weight="duotone" className="text-gold-dim" />
                                    All sources
                                </div>
                                <Button asChild className="min-h-10 rounded-md bg-obsidian text-linen hover:bg-obsidian/90">
                                    <Link href="#source-links">
                                        Links
                                        <ExternalLink size={15} weight="bold" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </header>

                    <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)_minmax(300px,0.75fr)]">
                        <Card className="rounded-lg border-champagne/70 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.045)]">
                            <CardContent className="p-6 sm:p-7">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-gold">President focus</p>
                                <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight text-obsidian">
                                    Start here, then drill down only if needed.
                                </h2>
                                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate">
                                    The dashboard should make the next leadership move obvious in under a minute:
                                    what needs a decision, what is waiting on source data, and where the team should go next.
                                </p>

                                <div className="mt-6 grid gap-3">
                                    {presidentFocusItems.map((item) => (
                                        <div key={item.label} className="border border-champagne/70 bg-bone p-4">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-gold-dim" />
                                                <div>
                                                    <p className="font-semibold text-obsidian">{item.label}</p>
                                                    <p className="mt-1 text-sm leading-6 text-slate">{item.body}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-lg border-champagne/70 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.045)]">
                            <CardHeader>
                                <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">
                                    Decision queue
                                </CardDescription>
                                <CardTitle className="font-serif text-3xl font-semibold tracking-normal text-obsidian">
                                    Waiting on leadership
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {decisionQueue.map((item) => (
                                    <div key={item.label} className="grid gap-2 border-b border-champagne/60 pb-3 last:border-b-0 last:pb-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-semibold text-obsidian">{item.label}</p>
                                            <Badge variant="outline" className="shrink-0 rounded-md border-muted-gold/40 bg-bone text-[11px] text-gold-dim">
                                                {item.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs uppercase tracking-[0.12em] text-slate">{item.owner}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="rounded-lg border-obsidian bg-obsidian text-linen shadow-[0_18px_45px_rgba(29,29,31,0.08)]">
                            <CardHeader>
                                <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-champagne">
                                    Do next
                                </CardDescription>
                                <CardTitle className="font-serif text-3xl font-semibold tracking-normal">
                                    Open the source owner.
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button asChild className="w-full justify-between rounded-md bg-linen text-obsidian hover:bg-travertine">
                                    <Link href="#source-links">
                                        Source links
                                        <ArrowRight size={16} weight="bold" />
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    variant="outline"
                                    className="w-full justify-between rounded-md border-linen/20 bg-linen/5 text-linen hover:bg-linen/10 hover:text-linen"
                                >
                                    <Link href="#grace-ai">
                                        Grace AI signals
                                        <ArrowRight size={16} weight="bold" />
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    variant="outline"
                                    className="w-full justify-between rounded-md border-linen/20 bg-linen/5 text-linen hover:bg-linen/10 hover:text-linen"
                                >
                                    <Link href="#commerce">
                                        Commerce lane
                                        <ArrowRight size={16} weight="bold" />
                                    </Link>
                                </Button>
                                <p className="pt-3 text-sm leading-6 text-champagne">
                                    Keep the page short: decide what needs approval, assign the owner, then open the source system.
                                </p>
                            </CardContent>
                        </Card>
                    </section>

                    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Today at a glance">
                        {headlineMetrics.map((metric) => (
                            <MetricCard key={metric.label} {...metric} />
                        ))}
                    </section>

                    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {operatingStats.map((stat) => (
                            <StatTile key={stat.label} {...stat} />
                        ))}
                    </section>

                    <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.75fr)]">
                        <Card className="rounded-lg border-champagne/70 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.045)]">
                            <CardHeader>
                                <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">
                                    Executive lanes
                                </CardDescription>
                                <CardTitle className="font-serif text-3xl font-semibold tracking-normal text-obsidian">
                                    Source readiness by operating area
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {executiveLanes.map((lane) => (
                                    <LaneRow key={lane.id} lane={lane} />
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="rounded-lg border-champagne/70 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.045)]">
                            <CardHeader>
                                <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">
                                    Signal board
                                </CardDescription>
                                <CardTitle className="font-serif text-3xl font-semibold tracking-normal text-obsidian">
                                    What should get attention first
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="border border-champagne/70 bg-bone p-5">
                                    <p className="text-sm font-semibold text-obsidian">First executive unlock</p>
                                    <p className="mt-2 text-sm leading-6 text-slate">
                                        Approve the Shopify revenue definition, then wire completed order truth before any CEO number is displayed.
                                    </p>
                                </div>
                                <div className="border border-champagne/70 bg-bone p-5">
                                    <p className="text-sm font-semibold text-obsidian">Best immediate dashboard value</p>
                                    <p className="mt-2 text-sm leading-6 text-slate">
                                        Grace AI and catalog health can become operating signals quickly because event names, routes, and data ownership are already mapped.
                                    </p>
                                </div>
                                <div className="border border-champagne/70 bg-obsidian p-5 text-linen">
                                    <p className="text-sm font-semibold">Boss rule</p>
                                    <p className="mt-2 text-sm leading-6 text-champagne">
                                        Show outcomes here. Use source links for investigation.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section className="mt-10 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]" id="grace-ai">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">Grace AI</p>
                            <h2 className="mt-2 font-serif text-4xl font-semibold leading-tight text-obsidian">
                                Customer trust belongs in the executive room.
                            </h2>
                            <p className="mt-4 text-base leading-7 text-slate">
                                Grace is not just a chat widget. It affects search, product confidence, cart building, sample requests,
                                and customer support load. The executive view should summarize reliability, not expose raw conversation content.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {graceSignals.map((signal) => (
                                <div key={signal.label} className="min-h-32 border border-champagne/70 bg-linen p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <Sparkle size={19} weight="duotone" className="text-gold-dim" />
                                        <Badge variant="outline" className="rounded-md border-muted-gold/30 bg-muted-gold/10 text-[11px] text-gold-dim">
                                            {signal.status}
                                        </Badge>
                                    </div>
                                    <p className="mt-4 font-semibold text-obsidian">{signal.label}</p>
                                    <p className="mt-2 text-sm text-slate">{signal.value}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="mt-10" id="source-links">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">Source links</p>
                                <h2 className="mt-2 font-serif text-4xl font-semibold tracking-normal text-obsidian">
                                    Where the links go
                                </h2>
                            </div>
                            <p className="max-w-xl text-sm leading-6 text-slate">
                                These destinations keep the Executive Hub useful without turning it into a duplicate of every system.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {sourceLinks.map((link) => {
                                const Icon = link.icon;
                                const href = resolveHref(link.href, previewMode);
                                const external = href.startsWith("http");

                                return (
                                    <Link
                                        key={link.label}
                                        href={href}
                                        target={external ? "_blank" : undefined}
                                        rel={external ? "noopener noreferrer" : undefined}
                                        className="group flex min-h-52 flex-col border border-champagne/70 bg-linen p-5 transition hover:-translate-y-0.5 hover:border-muted-gold/60 hover:shadow-[0_18px_45px_rgba(29,29,31,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex size-10 items-center justify-center rounded-md border border-muted-gold/30 bg-bone text-gold-dim">
                                                <Icon size={19} weight="duotone" />
                                            </div>
                                            <Badge variant="outline" className="rounded-md border-champagne bg-bone text-[11px] text-gold-dim">
                                                {link.badge}
                                            </Badge>
                                        </div>
                                        <h3 className="mt-5 font-serif text-2xl font-semibold leading-tight text-obsidian">{link.label}</h3>
                                        <p className="mt-3 text-sm leading-6 text-slate">{link.description}</p>
                                        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-obsidian transition-colors group-hover:text-muted-gold">
                                            Open
                                            <ExternalLink size={15} weight="bold" />
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>

                    <section className="mt-10 border border-champagne/70 bg-linen p-5 sm:p-6">
                        <div className="flex flex-col gap-3 border-b border-champagne/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">Source data</p>
                                <h2 className="mt-2 font-serif text-3xl font-semibold tracking-normal text-obsidian">
                                    Line item explorer
                                </h2>
                            </div>
                            <Button variant="outline" className="w-fit rounded-md border-muted-gold/40 bg-bone text-obsidian hover:bg-travertine">
                                <CheckCircle size={16} weight="duotone" />
                                Source map
                            </Button>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="border-b border-champagne/70 text-xs uppercase tracking-[0.14em] text-slate">
                                    <tr>
                                        <th className="py-3 pr-4 font-semibold">Source</th>
                                        <th className="py-3 pr-4 font-semibold">Owner</th>
                                        <th className="py-3 pr-4 font-semibold">Executive lane</th>
                                        <th className="py-3 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-champagne/60">
                                    {sourceRows.map((row) => (
                                        <tr key={row.source}>
                                            <td className="py-4 pr-4 font-semibold text-obsidian">{row.source}</td>
                                            <td className="py-4 pr-4 text-slate">{row.owner}</td>
                                            <td className="py-4 pr-4 text-slate">{row.lane}</td>
                                            <td className="py-4">
                                                <Badge variant="outline" className="rounded-md border-champagne bg-bone text-[11px] text-gold-dim">
                                                    {row.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <footer className="mt-10 flex flex-col gap-3 border-t border-champagne/70 py-8 text-sm leading-6 text-slate sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            Built with Best Bottles design tokens. Live business values remain source-gated until current reads are connected.
                        </p>
                        <Link href={resolveHref("/team", previewMode)} className="inline-flex items-center gap-2 font-semibold text-obsidian hover:text-muted-gold">
                            Open Team Hub
                            <Users size={16} weight="bold" />
                        </Link>
                    </footer>
                </div>
            </div>
        </main>
    );
}

function ExecutiveAccessPending({ emailAddresses }: { emailAddresses: string[] }) {
    const signedInEmail = emailAddresses[0];

    return (
        <main className="min-h-screen bg-bone px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-2xl border border-champagne/60 bg-linen p-8 shadow-[0_18px_45px_rgba(29,29,31,0.04)]">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-muted-gold">
                    Best Bottles
                </p>
                <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-5xl">
                    Executive Hub access pending
                </h1>
                <p className="mt-5 text-base leading-7 text-slate">
                    You are signed in, but this account is not enabled for the Executive Hub yet.
                    Use the approved executive email for your Clerk login, or ask a Best Bottles admin to turn on executive access.
                </p>
                {signedInEmail ? (
                    <p className="mt-4 text-sm leading-6 text-slate">
                        Signed in as <span className="font-semibold text-obsidian">{signedInEmail}</span>.
                    </p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                    <SwitchAccountButton
                        redirectUrl="/executive"
                        className="inline-flex border border-obsidian bg-obsidian px-5 py-3 text-sm font-semibold text-linen transition hover:border-muted-gold hover:bg-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                    >
                        Use another executive email
                    </SwitchAccountButton>
                    <a
                        href="mailto:jordan@asala.ai"
                        className="inline-flex border border-champagne bg-bone px-5 py-3 text-sm font-semibold text-obsidian transition hover:border-muted-gold hover:text-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                    >
                        Contact Jordan
                    </a>
                </div>
            </div>
        </main>
    );
}
