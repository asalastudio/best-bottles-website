import type { ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
    ArrowRight,
    ExternalLink,
    FileText,
    Globe,
    Package,
    ShieldCheck,
    ShoppingBag,
    Sparkle,
    Users,
    WarningCircle,
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

const topLineMetrics = [
    {
        label: "Revenue",
        value: "Not connected",
        source: "Shopify Admin",
        state: "Needs API",
        icon: ShoppingBag,
        tone: "amber",
        note: "Completed orders and revenue should come from Shopify, not checkout events.",
    },
    {
        label: "Orders",
        value: "Not connected",
        source: "Shopify Admin",
        state: "Needs API",
        icon: Package,
        tone: "amber",
        note: "Order count, AOV, refunds, and inventory need the approved Shopify definition.",
    },
    {
        label: "Conversion",
        value: "Mapped",
        source: "Mixpanel",
        state: "Ready to wire",
        icon: Globe,
        tone: "blue",
        note: "Use saved funnels for PDP view, add to cart, checkout start, redirect, and form submit.",
    },
    {
        label: "Grace AI",
        value: "Mapped",
        source: "Mixpanel + Convex",
        state: "Default signals set",
        icon: Sparkle,
        tone: "pink",
        note: "Track consistency, no-match, tool errors, voice fallback, and assisted conversions.",
    },
];

const readinessAreas = [
    {
        area: "Catalog health",
        score: 4,
        source: "Convex + audits",
        next: "Run current catalog and Shopify-readiness audits before publishing counts.",
    },
    {
        area: "Grace AI health",
        score: 3,
        source: "Mixpanel + Convex",
        next: "Pull event volumes and set reliability thresholds.",
    },
    {
        area: "CRO behavior",
        score: 2,
        source: "Mixpanel",
        next: "Connect saved funnel/report IDs and service-account access.",
    },
    {
        area: "Content health",
        score: 2,
        source: "Sanity",
        next: "Read live content completeness and merchandising status.",
    },
    {
        area: "Commerce truth",
        score: 1,
        source: "Shopify Admin",
        next: "Connect order reporting and approve revenue definition.",
    },
    {
        area: "Production health",
        score: 1,
        source: "Vercel",
        next: "Connect observability or define manual production-health fallback.",
    },
];

const graceSignals = [
    "Tool success rate",
    "No-match rate",
    "Connection failure rate",
    "Voice fallback rate",
    "Grace-assisted cart adds",
    "Grace-assisted form submissions",
];

const focusLanes = [
    {
        title: "Commerce Truth",
        icon: ShoppingBag,
        source: "Shopify",
        body: "Revenue, completed orders, AOV, refunds, discounts, and inventory availability.",
        status: "Connect first",
    },
    {
        title: "CRO And Behavior",
        icon: Globe,
        source: "Mixpanel",
        body: "Product views, catalog filters, cart adds, checkout starts, checkout redirects, and form paths.",
        status: "Mapped",
    },
    {
        title: "Grace AI Reliability",
        icon: Sparkle,
        source: "Mixpanel + Convex",
        body: "Customer-facing consistency, errors, no-match events, tool outcomes, and assisted conversion.",
        status: "Mapped",
    },
    {
        title: "Operations Risk",
        icon: ShieldCheck,
        source: "Convex + Vercel",
        body: "Catalog readiness, production health, lead submissions, portal status, and launch blockers.",
        status: "Ready to shape",
    },
];

const integrationSteps = [
    {
        label: "Shopify order reporting",
        detail: "Wire completed orders, revenue, AOV, refunds, discounts, and inventory.",
        status: "Required",
    },
    {
        label: "Mixpanel saved reports",
        detail: "Use stable saved funnels and Query API credentials for CRO and Grace signals.",
        status: "Required",
    },
    {
        label: "Grace AI thresholds",
        detail: "Set yellow/red defaults for no-match, tool failure, connection failure, and voice fallback.",
        status: "Recommended",
    },
    {
        label: "Catalog audit cadence",
        detail: "Run Convex, product-truth, and Shopify-readiness checks before displaying current counts.",
        status: "Recommended",
    },
];

const quickLinks = [
    { label: "Team Hub", href: "/team?preview=1" },
    { label: "Sanity Studio", href: "/studio" },
    { label: "Madison Studio", href: getMadisonStudioHref() },
    { label: "Mixpanel Replay", href: "https://mixpanel.com/project/4006168/view/4501946/app/session-replay" },
    { label: "Shopify Admin", href: getShopifyAdminHref() },
    { label: "Convex Dashboard", href: "https://dashboard.convex.dev" },
    { label: "Vercel Project", href: "https://vercel.com/asala/best-bottles-website" },
];

function toneClasses(tone: string) {
    switch (tone) {
        case "blue":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "pink":
            return "border-rose-200 bg-rose-50 text-rose-700";
        default:
            return "border-amber-200 bg-amber-50 text-amber-700";
    }
}

function MetricCard({
    icon: Icon,
    label,
    value,
    source,
    state,
    tone,
    note,
}: {
    icon: IconComponent;
    label: string;
    value: string;
    source: string;
    state: string;
    tone: string;
    note: string;
}) {
    return (
        <Card className="min-h-64 rounded-lg border-champagne/60 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.05)]">
            <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className={cn("flex size-11 items-center justify-center rounded-md border", toneClasses(tone))}>
                        <Icon size={22} weight="duotone" />
                    </div>
                    <Badge variant="outline" className={cn("rounded-md border px-2.5 py-1", toneClasses(tone))}>
                        {state}
                    </Badge>
                </div>
                <div>
                    <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">
                        {label}
                    </CardDescription>
                    <CardTitle className="mt-2 text-3xl font-semibold tracking-normal text-obsidian">
                        {value}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm font-medium text-obsidian">{source}</p>
                <p className="mt-3 text-sm leading-6 text-slate">{note}</p>
            </CardContent>
        </Card>
    );
}

function ReadinessRow({
    area,
    score,
    source,
    next,
}: {
    area: string;
    score: number;
    source: string;
    next: string;
}) {
    return (
        <div className="grid gap-3 border-b border-champagne/50 py-5 last:border-b-0 md:grid-cols-[minmax(160px,0.85fr)_1.1fr_minmax(180px,1fr)] md:items-center">
            <div>
                <p className="font-semibold text-obsidian">{area}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate">{source}</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="h-3 w-full overflow-hidden rounded-full bg-travertine">
                    <div
                        className="h-full rounded-full bg-muted-gold"
                        style={{ width: `${Math.min(score * 20, 100)}%` }}
                    />
                </div>
                <span className="w-9 text-right text-sm font-semibold text-obsidian">{score}/5</span>
            </div>
            <p className="text-sm leading-6 text-slate">{next}</p>
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
        <main className="min-h-screen bg-bone px-5 py-8 text-obsidian sm:px-8 lg:px-10">
            <div className="mx-auto max-w-7xl">
                <header className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.65fr)] lg:items-end">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge className="rounded-md bg-obsidian px-3 py-1 text-linen hover:bg-obsidian">
                                CEO view
                            </Badge>
                            {previewMode ? (
                                <Badge variant="outline" className="rounded-md border-muted-gold/40 bg-linen px-3 py-1 text-gold-dim">
                                    Local preview mode
                                </Badge>
                            ) : null}
                        </div>
                        <h1 className="mt-6 max-w-4xl font-serif text-5xl font-semibold leading-[0.95] tracking-normal text-obsidian sm:text-6xl lg:text-7xl">
                            Executive Hub
                        </h1>
                        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate">
                            A 30,000-foot command center for Best Bottles: commerce truth from Shopify,
                            conversion and Grace AI behavior from Mixpanel, catalog readiness from Convex,
                            and production health from Vercel.
                        </p>
                    </div>

                    <Card className="rounded-lg border-champagne/70 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.05)]">
                        <CardHeader>
                            <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">
                                Current artifact state
                            </CardDescription>
                            <CardTitle className="text-2xl font-semibold tracking-normal">
                                Source-aware V1
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-6 text-slate">
                            <div className="flex gap-3">
                                <WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0 text-amber-700" />
                                <p>
                                    Live Shopify revenue and Mixpanel funnel values are intentionally marked as not connected
                                    until API credentials and saved report IDs are wired.
                                </p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <Button asChild className="bg-obsidian text-linen hover:bg-obsidian/90">
                                    <Link href="#integration-plan">
                                        Review wiring plan
                                        <ArrowRight size={16} weight="bold" />
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    variant="outline"
                                    className="border-muted-gold/40 bg-bone text-obsidian hover:bg-travertine"
                                >
                                    <Link href={getMadisonStudioHref()} target="_blank" rel="noopener noreferrer">
                                        Open Madison Studio
                                        <ExternalLink size={16} weight="bold" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </header>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Executive headline metrics">
                    {topLineMetrics.map((metric) => (
                        <MetricCard key={metric.label} {...metric} />
                    ))}
                </section>

                <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div>
                        <div className="mb-5 flex items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">
                                    Readiness
                                </p>
                                <h2 className="mt-2 font-serif text-4xl font-semibold tracking-normal">
                                    What is safe to show now
                                </h2>
                            </div>
                            <p className="hidden max-w-sm text-sm leading-6 text-slate md:block">
                                Scores show implementation readiness, not live business performance.
                            </p>
                        </div>
                        <Card className="rounded-lg border-champagne/60 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.05)]">
                            <CardContent className="p-6">
                                {readinessAreas.map((area) => (
                                    <ReadinessRow key={area.area} {...area} />
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-4">
                        {focusLanes.map((lane) => {
                            const Icon = lane.icon;
                            return (
                                <Card key={lane.title} className="rounded-lg border-champagne/60 bg-linen">
                                    <CardHeader className="flex-row items-start gap-4 space-y-0">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-muted-gold/30 bg-bone text-gold-dim">
                                            <Icon size={20} weight="duotone" />
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <CardTitle className="text-lg font-semibold tracking-normal">{lane.title}</CardTitle>
                                                <Badge variant="outline" className="rounded-md border-champagne bg-bone text-[11px] text-gold-dim">
                                                    {lane.status}
                                                </Badge>
                                            </div>
                                            <CardDescription className="mt-1 text-xs uppercase tracking-[0.12em]">
                                                {lane.source}
                                            </CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm leading-6 text-slate">{lane.body}</p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </aside>
                </section>

                <section className="mt-14 grid gap-8 lg:grid-cols-[420px_minmax(0,1fr)]" id="integration-plan">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">
                            Grace AI defaults
                        </p>
                        <h2 className="mt-2 font-serif text-4xl font-semibold tracking-normal">
                            Grace belongs in the executive view
                        </h2>
                        <p className="mt-4 text-base leading-7 text-slate">
                            Grace is a customer-facing sales assistant, so consistency and customer errors are
                            leadership-level signals. Raw conversations can stay out of the CEO page; aggregate
                            reliability and assisted-conversion signals should be front and center.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {graceSignals.map((signal) => (
                            <Card key={signal} className="min-h-32 rounded-lg border-rose-100 bg-rose-50/60">
                                <CardContent className="flex h-full flex-col justify-between p-5">
                                    <div className="flex items-center gap-3">
                                        <Sparkle size={19} weight="duotone" className="text-rose-700" />
                                        <p className="font-semibold text-obsidian">{signal}</p>
                                    </div>
                                    <p className="mt-4 text-sm text-rose-800">Waiting for Mixpanel event volumes</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section className="mt-14 grid gap-6 lg:grid-cols-2">
                    <Card className="rounded-lg border-champagne/60 bg-linen">
                        <CardHeader>
                            <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold">
                                Build sequence
                            </CardDescription>
                            <CardTitle className="text-3xl font-semibold tracking-normal">
                                Integration checklist
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {integrationSteps.map((step) => (
                                <div key={step.label} className="flex gap-4">
                                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-travertine text-gold-dim">
                                        <FileText size={17} weight="duotone" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-obsidian">{step.label}</p>
                                            <Badge variant="outline" className="rounded-md border-champagne bg-bone text-[11px] text-slate">
                                                {step.status}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-sm leading-6 text-slate">{step.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="rounded-lg border-obsidian bg-obsidian text-linen">
                        <CardHeader>
                            <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-champagne">
                                Decision rule
                            </CardDescription>
                            <CardTitle className="text-3xl font-semibold tracking-normal">
                                Show outcomes, link to systems
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 text-sm leading-6 text-champagne">
                            <p>
                                The Executive Hub should summarize outcomes and risks. It should not become a
                                second Shopify, a second Mixpanel, or a replay browser.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {quickLinks.map((link) => {
                                    const external = link.href.startsWith("http");
                                    return (
                                        <Button
                                            key={link.label}
                                            asChild
                                            variant="outline"
                                            className="h-11 justify-between border-linen/20 bg-linen/5 text-linen hover:bg-linen/10 hover:text-linen"
                                        >
                                            <Link href={link.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                                                {link.label}
                                                <ExternalLink size={15} weight="bold" />
                                            </Link>
                                        </Button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <footer className="mt-12 flex flex-col gap-3 border-t border-champagne/70 py-8 text-sm leading-6 text-slate sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        Built as a source-aware V1. No live revenue, order, or conversion values are displayed until source reads are connected.
                    </p>
                    <Link href={previewMode ? "/team?preview=1" : "/team"} className="inline-flex items-center gap-2 font-semibold text-obsidian hover:text-muted-gold">
                        Open Team Hub
                        <Users size={16} weight="bold" />
                    </Link>
                </footer>
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
