import Link from "next/link";
import BrandWordmark from "@/components/BrandWordmark";
import ExecutiveFigure from "@/components/executive/ExecutiveFigure";
import ExecutiveColumnChart from "@/components/executive/ExecutiveColumnChart";
import ExecutiveRail from "@/components/executive/ExecutiveRail";
import { GraceAuditPanel } from "@/components/executive/GraceAuditPanel";
import { GraceOperationsPanel } from "@/components/executive/GraceOperationsPanel";
import { PlatformHealthPanel } from "@/components/executive/PlatformHealthPanel";
import type { ExecutiveCommerce } from "@/lib/executive/commerce";
import type { GraceOperationsSnapshot } from "@/lib/executive/graceOperations";
import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";

function money(amount: number | null, currency: string) {
    if (amount === null) return null;
    return amount.toLocaleString("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: amount >= 1000 ? 0 : 2,
    });
}

/**
 * A way out to the system that owns the number.
 *
 * The board is a reading surface, not an investigation tool — when something
 * looks wrong the next move is the source, so every panel that has one says
 * where it is rather than leaving the reader to find the tab.
 */
function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-champagne px-3.5 py-1.5 font-sans text-[12.5px] text-obsidian transition-colors hover:bg-travertine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
        >
            {children}
        </a>
    );
}

function Section({
    id,
    eyebrow,
    title,
    children,
    aside,
}: {
    id: string;
    eyebrow: string;
    title: string;
    children: React.ReactNode;
    aside?: React.ReactNode;
}) {
    return (
        <section className="border-t border-champagne/50 py-9">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                    <p className="mb-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.18em] text-gold-dim">
                        {eyebrow}
                    </p>
                    {/* scroll-mt keeps the heading clear of the top edge when
                        the rail jumps to it. */}
                    <h2 id={id} className="scroll-mt-8 font-serif text-[26px] leading-tight text-obsidian">
                        {title}
                    </h2>
                </div>
                {aside}
            </div>
            {children}
        </section>
    );
}

/**
 * The Executive Hub.
 *
 * Deliberately a different surface from the Team Hub: no tool rail, one wide
 * column, and figures rather than queues. The team hub answers "what do I do
 * next"; this answers "where is the business", and the two should not be
 * mistaken for each other at a glance.
 *
 * Every number is read live. The board it replaces rendered a fixture — $1.84M
 * revenue, a 2.4x pipeline, an EBITDA line — while the store had taken one
 * order for $100. That is worse than an empty board, because nothing on the
 * page told a reader which numbers were real.
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
    /** PostHog only reports once a deployment carries the project token. */
    analyticsConfigured: boolean;
    shopifyAdminUrl: string;
    previewMode?: boolean;
}) {

    return (
        <div className="app-surface flex min-h-screen flex-col bg-bone lg:flex-row lg:items-start">
            <ExecutiveRail
                sections={[
                    { id: "commerce", label: "Commerce" },
                    { id: "wholesale", label: "Wholesale" },
                    { id: "catalogue", label: "Catalogue" },
                    { id: "systems", label: "Systems" },
                ]}
                sources={[
                    { label: "Shopify admin", href: shopifyAdminUrl },
                    { label: "Sentry", href: platformHealth.sentryIssuesUrl ?? "https://sentry.io/" },
                    { label: "PostHog", href: "https://us.posthog.com/" },
                ]}
            />

            <main className="min-w-0 flex-1 px-6 py-10 sm:px-10 sm:py-14">
                <div className="mx-auto max-w-4xl">
                <header className="pb-8">
                    <Link href="/" aria-label="Best Bottles home" className="mb-5 block">
                        <BrandWordmark className="app-wordmark" />
                    </Link>
                    <h1 className="font-serif text-[40px] leading-[1.1] text-obsidian sm:text-[52px]">
                        The business today
                    </h1>
                    <p className="mt-3 max-w-2xl font-sans text-[14px] leading-6 text-slate">
                        Read live from Shopify, Convex and Sentry at the moment this page loaded.
                        Where a source is not connected the figure reads “—”, never zero.
                        {previewMode ? " Local preview." : ""}
                    </p>

                    {/* Scope, stated once and plainly. The reader needs to know
                        what this board can and cannot see before they read a
                        single figure on it. */}
                    <div
                        className="mt-6 rounded-lg px-5 py-4"
                        style={{ background: "var(--color-travertine)" }}
                    >
                        <p className="font-sans text-[13px] leading-6 text-obsidian">
                            <span className="font-medium">Trading history is not here yet.</span>{" "}
                            These figures cover what has gone through Shopify. The company&rsquo;s
                            order history lives in QuickBooks and has not been imported, so revenue
                            and order counts read far lower than the business has actually done.
                        </p>
                    </div>
                </header>

                {/* ─── Commerce ─────────────────────────────────────────── */}
                <Section
                    id="commerce"
                    eyebrow="Commerce"
                    title="What has sold through Shopify"
                    aside={
                        <SourceLink href={shopifyAdminUrl}>Open Shopify ↗</SourceLink>
                    }
                >
                    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
                        <ExecutiveFigure
                            value={money(commerce.revenueAllTime, commerce.currencyCode)}
                            label="Revenue, all time"
                            availability={commerce.revenueAvailability}
                        />
                        <ExecutiveFigure
                            value={commerce.ordersAllTime.toLocaleString()}
                            unit={commerce.ordersAllTime === 1 ? "order" : "orders"}
                            label="Orders, all time"
                            availability={commerce.revenueAvailability}
                        />
                        <ExecutiveFigure
                            value={commerce.ordersLast30.toLocaleString()}
                            unit={commerce.ordersLast30 === 1 ? "order" : "orders"}
                            label="Last 30 days"
                        />
                    </div>

                    <div className="mt-8">
                        <p className="mb-3 font-sans text-[12.5px] font-medium text-obsidian">
                            Orders per month, last 12
                        </p>
                        <ExecutiveColumnChart series={commerce.ordersByMonth} />
                    </div>
                </Section>

                {/* ─── Wholesale ────────────────────────────────────────── */}
                <Section
                    id="wholesale"
                    eyebrow="Wholesale"
                    title="The B2B channel"
                    aside={
                        <Link
                            href="/team/portal-accounts"
                            className="font-sans text-[13px] text-gold-dim underline underline-offset-4"
                        >
                            Manage accounts →
                        </Link>
                    }
                >
                    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
                        <ExecutiveFigure
                            value={commerce.wholesaleAccounts.toLocaleString()}
                            unit={commerce.wholesaleAccounts === 1 ? "account" : "accounts"}
                            label="Wholesale accounts"
                        />
                        <ExecutiveFigure
                            value={commerce.wholesaleReadyToOrder.toLocaleString()}
                            unit="ready"
                            label="Able to place an order"
                            availability={
                                commerce.wholesaleReadyToOrder < commerce.wholesaleAccounts
                                    ? {
                                          state: "partial",
                                          note: `${commerce.wholesaleAccounts - commerce.wholesaleReadyToOrder} still need a shipping address or a linked Shopify customer.`,
                                      }
                                    : undefined
                            }
                        />
                        <ExecutiveFigure
                            value={commerce.portalOrdersAwaiting.toLocaleString()}
                            unit={commerce.portalOrdersAwaiting === 1 ? "order" : "orders"}
                            label="Submitted, awaiting a person"
                            availability={
                                commerce.portalOrdersAwaiting > 0
                                    ? { state: "partial", note: "Sitting in Shopify as drafts. Each needs confirming and invoicing." }
                                    : undefined
                            }
                        />
                    </div>

                    {commerce.accountLocations.length > 0 ? (
                        <div className="mt-8 border-t border-champagne/40 pt-6">
                            <p className="mb-3 font-sans text-[12.5px] font-medium text-obsidian">
                                Where accounts ship
                            </p>
                            <ul className="flex flex-wrap gap-x-8 gap-y-2">
                                {commerce.accountLocations.map((location) => (
                                    <li key={`${location.countryCode}-${location.provinceCode}`} className="font-sans text-[13px] text-slate">
                                        <span className="text-obsidian">{location.label}</span>
                                        {location.count > 1 ? ` · ${location.count}` : ""}
                                    </li>
                                ))}
                            </ul>
                            {/* A world map of one or two points is theatre. It
                                earns its place once there are accounts across
                                enough regions for the shape to say something. */}
                            <p className="mt-3 font-sans text-[12px] text-ash">
                                Shown as a list while there are {commerce.accountLocations.length}{" "}
                                {commerce.accountLocations.length === 1 ? "location" : "locations"}; a map
                                replaces it once accounts spread across more regions.
                            </p>
                        </div>
                    ) : null}
                </Section>

                {/* ─── Catalogue ────────────────────────────────────────── */}
                <Section id="catalogue" eyebrow="Catalogue" title="What is published">
                    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
                        <ExecutiveFigure
                            value={commerce.productsPublished.toLocaleString()}
                            unit="products"
                            label="Live in Shopify"
                        />
                    </div>
                </Section>

                {/* ─── Systems ──────────────────────────────────────────── */}
                <Section
                    id="systems"
                    eyebrow="Systems"
                    title="What is watching the site"
                    aside={
                        <div className="flex flex-wrap gap-2">
                            <SourceLink href={platformHealth.sentryIssuesUrl ?? "https://sentry.io/"}>
                                Open Sentry ↗
                            </SourceLink>
                            <SourceLink href="https://us.posthog.com/">Open PostHog ↗</SourceLink>
                        </div>
                    }
                >
                    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
                        {/* awaitingFirstDelivery is the whole point of this
                            field: "zero errors found" and "zero errors ever
                            reported" are identical in the numbers and opposite
                            in meaning, so the second must never render as a
                            calm zero. */}
                        <ExecutiveFigure
                            value={
                                platformHealth.status === "source-backed" && !platformHealth.awaitingFirstDelivery
                                    ? String(platformHealth.data?.summary.unresolved ?? 0)
                                    : null
                            }
                            unit={
                                platformHealth.status === "source-backed" && !platformHealth.awaitingFirstDelivery
                                    ? "unresolved"
                                    : undefined
                            }
                            label="Sentry errors"
                            availability={
                                platformHealth.status !== "source-backed"
                                    ? { state: "unavailable", note: platformHealth.message ?? "Sentry is not connected." }
                                    : platformHealth.awaitingFirstDelivery
                                      ? {
                                            state: "unavailable",
                                            note: "Connected, but Sentry has never delivered an event — so this is not a clean bill of health. See docs/observability/SENTRY_RUNBOOK.md.",
                                        }
                                      : { state: "live" }
                            }
                        />
                        <ExecutiveFigure
                            value={analyticsConfigured ? "Collecting" : null}
                            label="PostHog"
                            availability={
                                analyticsConfigured
                                    ? { state: "partial", note: "Configured. Figures appear here once there is traffic to report." }
                                    : { state: "unavailable", note: "No project token on this deployment, so nothing is being recorded." }
                            }
                        />
                        <ExecutiveFigure
                            value={
                                graceOperations.status === "source-backed" && graceOperations.requestCount !== null
                                    ? graceOperations.requestCount.toLocaleString()
                                    : null
                            }
                            unit="requests"
                            label="Grace, trailing 30 days"
                            availability={
                                graceOperations.status === "source-backed"
                                    ? { state: "partial", note: "Employee responses only — customer conversations are not counted here." }
                                    : { state: "unavailable", note: graceOperations.message ?? "Grace operations are not reporting." }
                            }
                        />
                    </div>

                    <div className="mt-8 flex flex-col gap-4">
                        <PlatformHealthPanel snapshot={platformHealth} />
                        <GraceOperationsPanel snapshot={graceOperations} />
                        <GraceAuditPanel />
                    </div>
                </Section>
                </div>
            </main>
        </div>
    );
}
