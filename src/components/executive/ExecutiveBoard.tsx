import Link from "next/link";
import BrandWordmark from "@/components/BrandWordmark";
import ExecutiveColumnChart from "@/components/executive/ExecutiveColumnChart";
import ExecutiveDonut from "@/components/executive/ExecutiveDonut";
import ExecutiveErrorPanel from "@/components/executive/ExecutiveErrorPanel";
import ExecutivePanel from "@/components/executive/ExecutivePanel";
import ExecutiveRail from "@/components/executive/ExecutiveRail";
import { GraceAuditPanel } from "@/components/executive/GraceAuditPanel";
import type { ExecutiveCommerce } from "@/lib/executive/commerce";
import type { GraceOperationsSnapshot } from "@/lib/executive/graceOperations";
import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";

function money(amount: number | null, currency: string) {
    if (amount === null) return "—";
    return amount.toLocaleString("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: amount >= 1000 ? 0 : 2,
    });
}

/**
 * One figure in the summary strip.
 *
 * Numeral and noun on one serif line, label beneath — the register Faire uses
 * for figures. `attention` is not an alarm colour; it is the gold the rest of
 * the system uses to mean "this is the thing to look at", so a number that
 * wants a person reads differently from one that is merely true.
 */
function Figure({
    value,
    unit,
    label,
    attention = false,
    note,
}: {
    value: string;
    unit?: string;
    label: string;
    attention?: boolean;
    note?: string;
}) {
    return (
        <div className="min-w-0">
            <p
                className="font-serif text-[30px] leading-[1.05]"
                style={{ color: attention ? "var(--color-gold-dim)" : "var(--color-obsidian)" }}
            >
                {value}
                {unit ? <span className="text-[19px]"> {unit}</span> : null}
            </p>
            <p className="mt-1 font-sans text-[12px] font-medium text-obsidian">{label}</p>
            {note ? <p className="mt-0.5 font-sans text-[11.5px] leading-4 text-slate">{note}</p> : null}
        </div>
    );
}

/** Group unresolved errors by the route they happen on. */
function errorsBySurface(snapshot: PlatformHealthSnapshot) {
    const grouped = new Map<string, number>();
    for (const issue of snapshot.data?.issues ?? []) {
        const label = issue.culprit?.trim() || "unattributed";
        grouped.set(label, (grouped.get(label) ?? 0) + issue.count);
    }
    return [...grouped.entries()].map(([label, value]) => ({ label, value }));
}

/**
 * The Executive Hub.
 *
 * A summary strip of the numbers that matter, then a grid of panels — so the
 * business fits on a screen or two rather than a long scroll past three
 * sections to reach the fourth. Every figure is read live; where a source is
 * not connected it reads "—" and says why, because "not connected" and "zero"
 * are different facts and drawing them the same way lies about the second.
 */
export function ExecutiveBoard({
    commerce,
    graceOperations,
    platformHealth,
    analyticsConfigured,
    shopifyAdminUrl,
    previewMode = false,
}: {
    commerce: ExecutiveCommerce;
    graceOperations: GraceOperationsSnapshot;
    platformHealth: PlatformHealthSnapshot;
    analyticsConfigured: boolean;
    shopifyAdminUrl: string;
    previewMode?: boolean;
}) {
    const sentryConnected = platformHealth.status === "source-backed" && !platformHealth.awaitingFirstDelivery;
    const openErrors = platformHealth.data?.summary.unresolved ?? 0;
    const needsSetup = commerce.wholesaleAccounts - commerce.wholesaleReadyToOrder;
    const surfaces = errorsBySurface(platformHealth);
    const countsAreLive = Boolean(platformHealth.data?.apiSyncConfigured);

    return (
        <div className="app-surface flex min-h-screen flex-col bg-bone lg:flex-row lg:items-start">
            <ExecutiveRail
                sections={[
                    { id: "commerce", label: "Commerce" },
                    { id: "wholesale", label: "Wholesale" },
                    { id: "reliability", label: "Reliability" },
                    { id: "grace", label: "Grace" },
                ]}
                sources={[
                    { label: "Shopify admin", href: shopifyAdminUrl },
                    { label: "Sentry", href: platformHealth.sentryIssuesUrl ?? "https://sentry.io/" },
                    { label: "PostHog", href: "https://us.posthog.com/" },
                ]}
            />

            <main className="min-w-0 flex-1 px-6 py-8 sm:px-8 sm:py-10">
                <div className="mx-auto max-w-[1080px]">
                    <header className="mb-6">
                        <Link href="/" aria-label="Best Bottles home" className="mb-4 block">
                            <BrandWordmark className="app-wordmark" />
                        </Link>
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <h1 className="font-serif text-[34px] leading-tight text-obsidian sm:text-[40px]">
                                The business today
                            </h1>
                            <p className="font-sans text-[12px] text-slate">
                                Read live from Shopify, Convex and Sentry{previewMode ? " · local preview" : ""}
                            </p>
                        </div>
                    </header>

                    {/* ─── Summary strip ────────────────────────────────── */}
                    <div
                        className="mb-4 grid gap-x-6 gap-y-5 rounded-lg px-6 py-5 sm:grid-cols-3 lg:grid-cols-5"
                        style={{ background: "var(--color-travertine)" }}
                    >
                        <Figure
                            value={money(commerce.revenueAllTime, commerce.currencyCode)}
                            label="Revenue, all time"
                            note="Shopify only"
                        />
                        <Figure
                            value={commerce.ordersAllTime.toLocaleString()}
                            unit={commerce.ordersAllTime === 1 ? "order" : "orders"}
                            label="Orders, all time"
                            note={`${commerce.ordersLast30} in the last 30 days`}
                        />
                        <Figure
                            value={commerce.portalOrdersAwaiting.toLocaleString()}
                            unit={commerce.portalOrdersAwaiting === 1 ? "order" : "orders"}
                            label="Awaiting a person"
                            attention={commerce.portalOrdersAwaiting > 0}
                            note={commerce.portalOrdersAwaiting > 0 ? "Submitted, not yet invoiced" : undefined}
                        />
                        <Figure
                            value={commerce.wholesaleAccounts.toLocaleString()}
                            unit={commerce.wholesaleAccounts === 1 ? "account" : "accounts"}
                            label="Wholesale accounts"
                            note={needsSetup > 0 ? `${needsSetup} cannot order yet` : "all able to order"}
                        />
                        <Figure
                            value={sentryConnected ? openErrors.toLocaleString() : "—"}
                            unit={sentryConnected && openErrors > 0 ? "open" : undefined}
                            label="Errors unresolved"
                            attention={sentryConnected && openErrors > 0}
                            note={sentryConnected ? undefined : "Sentry not reporting"}
                        />
                    </div>

                    {/* Scope, stated once. The reader needs to know what this
                        board cannot see before reading a figure on it. */}
                    <p
                        className="mb-6 rounded-lg px-5 py-3 font-sans text-[12.5px] leading-5 text-obsidian"
                        style={{ background: "var(--color-linen)", border: "1px solid var(--color-rule)" }}
                    >
                        <span className="font-medium">Trading history is not here yet.</span>{" "}
                        These figures cover Shopify. The company&rsquo;s order history lives in QuickBooks
                        and has not been imported, so revenue and order counts read far lower than the
                        business has actually done.
                    </p>

                    {/* ─── Grid ─────────────────────────────────────────── */}
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ExecutivePanel
                            eyebrow="Commerce"
                            title="Orders per month"
                            action={{ label: "Shopify ↗", href: shopifyAdminUrl, external: true }}
                        >
                            <ExecutiveColumnChart series={commerce.ordersByMonth} height={104} />
                        </ExecutivePanel>

                        <ExecutivePanel
                            eyebrow="Reliability"
                            title="What is breaking"
                            action={{
                                label: "Sentry ↗",
                                href: platformHealth.sentryIssuesUrl ?? "https://sentry.io/",
                                external: true,
                            }}
                        >
                            <ExecutiveErrorPanel snapshot={platformHealth} limit={4} />
                        </ExecutivePanel>

                        {surfaces.length > 0 ? (
                            <ExecutivePanel
                                eyebrow="Reliability"
                                title={countsAreLive ? "Where errors happen" : "Which routes have errors"}
                            >
                                <ExecutiveDonut
                                    segments={surfaces}
                                    centreLabel={countsAreLive ? "Events" : "Issues"}
                                    size={148}
                                />
                                {!countsAreLive ? (
                                    <p className="mt-3 font-sans text-[11.5px] leading-4 text-slate">
                                        Counting distinct issues, not events — event counts are not
                                        syncing from Sentry yet.
                                    </p>
                                ) : null}
                            </ExecutivePanel>
                        ) : null}

                        <ExecutivePanel
                            eyebrow="Wholesale"
                            title="The B2B channel"
                            action={{ label: "Manage accounts", href: "/team/portal-accounts" }}
                        >
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                <Figure
                                    value={commerce.wholesaleReadyToOrder.toLocaleString()}
                                    unit="ready"
                                    label="Able to place an order"
                                />
                                <Figure
                                    value={commerce.productsPublished.toLocaleString()}
                                    unit="products"
                                    label="Live in Shopify"
                                />
                            </div>
                            {commerce.accountLocations.length > 0 ? (
                                <div className="mt-4 border-t border-champagne/40 pt-3">
                                    <p className="mb-1.5 font-sans text-[11.5px] font-medium text-obsidian">
                                        Where accounts ship
                                    </p>
                                    <ul className="flex flex-wrap gap-x-5 gap-y-1">
                                        {commerce.accountLocations.map((location) => (
                                            <li
                                                key={`${location.countryCode}-${location.provinceCode}`}
                                                className="font-sans text-[12.5px] text-slate"
                                            >
                                                <span className="text-obsidian">{location.label}</span>
                                                {location.count > 1 ? ` · ${location.count}` : ""}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </ExecutivePanel>

                        <ExecutivePanel
                            eyebrow="Audience"
                            title="Behaviour"
                            action={{ label: "PostHog ↗", href: "https://us.posthog.com/", external: true }}
                        >
                            <p className="font-sans text-[13px] leading-6 text-slate">
                                {analyticsConfigured
                                    ? "Heatmaps, dead clicks and scroll depth are recording on the storefront. Heatmaps are viewed over the live site through PostHog's toolbar rather than embedded here — there is no widget for them."
                                    : "No project token on this deployment, so nothing is being recorded."}
                            </p>
                        </ExecutivePanel>

                        <ExecutivePanel
                            eyebrow="Grace"
                            title="AI operations"
                            action={{ label: "Workspace", href: "/grace-workspace" }}
                        >
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                <Figure
                                    value={
                                        graceOperations.status === "source-backed" && graceOperations.requestCount !== null
                                            ? graceOperations.requestCount.toLocaleString()
                                            : "—"
                                    }
                                    unit="requests"
                                    label="Trailing 30 days"
                                    note="Employee responses only"
                                />
                                <Figure
                                    value={
                                        graceOperations.pendingCorrections === null
                                            ? "—"
                                            : graceOperations.pendingCorrections.toLocaleString()
                                    }
                                    label="Pending corrections"
                                    attention={(graceOperations.pendingCorrections ?? 0) > 0}
                                />
                            </div>
                        </ExecutivePanel>
                    </div>

                    <div id="grace" className="mt-4 scroll-mt-8">
                        <GraceAuditPanel />
                    </div>

                    {/* Anchors for the rail. The headings live inside panels, so
                        the observer needs targets at the grid's own rhythm. */}
                    <span id="commerce" aria-hidden className="sr-only" />
                    <span id="wholesale" aria-hidden className="sr-only" />
                    <span id="reliability" aria-hidden className="sr-only" />
                </div>
            </main>
        </div>
    );
}
