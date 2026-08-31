import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

import { api } from "../../../../../convex/_generated/api";
import { getUserEmailAddresses, hasExecutiveHubAccess } from "@/lib/teamAccess";

/**
 * Grace data-integrity sweep — deterministic, no LLM, no spend.
 *
 * Sweeps every product in the catalog (paginated) plus group-level checks, and
 * returns a single roll-up. This is the "every SKU green" view; the
 * conversation audit covers behaviour.
 */

export const maxDuration = 300;

export type IntegrityIssue = { graceSku: string; issue: string; detail: string };

export type IntegrityReport = {
    generatedAt: string;
    environment: string;
    products: {
        scanned: number;
        priced: number;
        named: number;
        grouped: number;
        skuResolvable: number;
        invertedVolumePrice: number;
    };
    groups: { totalGroups: number; withSlug: number; priceRangeOk: number };
    variantCountDrift: Array<{ slug: string; stored: number; actual: number }>;
    issues: IntegrityIssue[];
    checks: Array<{ label: string; verdict: "pass" | "warn" | "fail"; detail: string }>;
};

export async function POST() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await currentUser();
    if (!hasExecutiveHubAccess(user?.publicMetadata, { emailAddresses: getUserEmailAddresses(user) })) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return NextResponse.json({ error: "Convex URL not configured" }, { status: 500 });
    const convex = new ConvexHttpClient(url);

    try {
        const totals = { scanned: 0, priced: 0, named: 0, grouped: 0, skuResolvable: 0, invertedVolumePrice: 0 };
        const issues: IntegrityIssue[] = [];
        let cursor: string | null = null;

        for (let page = 0; page < 40; page++) {
            const res: {
                isDone: boolean;
                continueCursor: string;
                scanned: number;
                priced: number;
                named: number;
                grouped: number;
                skuResolvable: number;
                invertedVolumePrice: number;
                issues: IntegrityIssue[];
            } = await convex.query(api.graceIntegrity.sweepPage, { cursor, pageSize: 300 });
            totals.scanned += res.scanned;
            totals.priced += res.priced;
            totals.named += res.named;
            totals.grouped += res.grouped;
            totals.skuResolvable += res.skuResolvable;
            totals.invertedVolumePrice += res.invertedVolumePrice;
            if (issues.length < 500) issues.push(...res.issues.slice(0, 500 - issues.length));
            if (res.isDone) break;
            cursor = res.continueCursor;
        }

        const groups = await convex.query(api.graceIntegrity.groupIntegrity, {});

        const drift: Array<{ slug: string; stored: number; actual: number }> = [];
        for (let skip = 0; skip < groups.totalGroups; skip += 60) {
            const res = await convex.query(api.graceIntegrity.variantCountDrift, { skip, take: 60 });
            drift.push(...res.drift);
        }

        const pct = (n: number, d: number) => (d === 0 ? 1 : n / d);
        const gate = (ok: boolean, warn: boolean): "pass" | "warn" | "fail" => (ok ? "pass" : warn ? "warn" : "fail");

        const checks: IntegrityReport["checks"] = [
            {
                label: "Every SKU resolvable by exact lookup",
                verdict: gate(totals.skuResolvable === totals.scanned, pct(totals.skuResolvable, totals.scanned) > 0.99),
                detail: `${totals.skuResolvable}/${totals.scanned} resolve via getProductBySku.`,
            },
            {
                label: "Every product priced",
                verdict: gate(totals.priced === totals.scanned, pct(totals.priced, totals.scanned) > 0.99),
                detail: `${totals.priced}/${totals.scanned} have a positive 1-piece price.`,
            },
            {
                label: "Every product named",
                verdict: gate(totals.named === totals.scanned, pct(totals.named, totals.scanned) > 0.99),
                detail: `${totals.named}/${totals.scanned} have an item name.`,
            },
            {
                label: "Every product reachable from a group",
                verdict: gate(totals.grouped === totals.scanned, pct(totals.grouped, totals.scanned) > 0.99),
                detail: `${totals.grouped}/${totals.scanned} belong to a product group.`,
            },
            {
                label: "Every group has a PDP slug",
                verdict: gate(groups.withSlug === groups.totalGroups, true),
                detail: `${groups.withSlug}/${groups.totalGroups} groups are linkable.`,
            },
            {
                label: "Group variant counts match membership",
                verdict: gate(drift.length === 0, drift.length <= 3),
                detail: drift.length === 0 ? "No denormalization drift." : `${drift.length} group(s) drifted.`,
            },
            {
                label: "Volume pricing never exceeds unit price",
                verdict: gate(totals.invertedVolumePrice === 0, false),
                detail: totals.invertedVolumePrice === 0
                    ? "No inverted tiers."
                    : `${totals.invertedVolumePrice} SKU(s) price higher at 12 than at 1 — Grace will quote a markup as a discount.`,
            },
        ];

        const report: IntegrityReport = {
            generatedAt: new Date().toISOString(),
            environment: url,
            products: totals,
            groups,
            variantCountDrift: drift,
            issues,
            checks,
        };

        return NextResponse.json({ report });
    } catch (error) {
        console.error("[executive/grace-integrity]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Integrity sweep failed" },
            { status: 500 },
        );
    }
}
