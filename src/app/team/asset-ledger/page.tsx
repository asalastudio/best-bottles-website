import { auth, currentUser } from "@clerk/nextjs/server";
import ledgerJson from "@/lib/asset-ledger/ledger.json";
import { compact, DONE, type Kind, type Ledger } from "@/lib/asset-ledger/types";
import LedgerTable from "./LedgerTable";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";

export const dynamic = "force-dynamic";

export const metadata = {
    title: { absolute: "Visual asset ledger — Best Bottles" },
    robots: { index: false, follow: false },
};

const ledger = ledgerJson as unknown as Ledger;
const KINDS: Array<{ kind: Kind; label: string; key: "heroes" | "plates" | "kits"; doneLabel: string }> = [
    { kind: "hero", label: "Heroes", key: "heroes", doneLabel: "in the catalogue registry" },
    { kind: "plate", label: "Plates", key: "plates", doneLabel: "served by the plate index" },
    { kind: "kit", label: "Kits", key: "kits", doneLabel: "served by the kit index" },
];

const sum = (counts: Record<string, number>, keys: string[]) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/**
 * One page that answers "how many heroes, plates and kits are done" from a
 * single generated file, instead of five stores added up by hand.
 *
 * The numbers are a snapshot: `node scripts/asset-ledger/build.mjs` rebuilds
 * src/lib/asset-ledger/ledger.json from Convex, the hero registry and locks,
 * the review library and the kit ledgers. Commit the file to update this page.
 * Nothing here publishes, approves or changes any asset.
 */
/** The Team Hub's own local-preview escape hatch, for sandboxes that run with Clerk disabled. Never in production. */
function isLocalPreview(params: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;
    const preview = params?.preview;
    return (Array.isArray(preview) ? preview : [preview]).some((v) => v === "1" || v === "true");
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    // Same gate as the rest of the Team Hub: this page lists every SKU we sell
    // and the state of its imagery, which is internal operational truth.
    if (!isLocalPreview(searchParams ? await searchParams : undefined)) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) return redirectToSignIn({ returnBackUrl: "/team/asset-ledger" });
        const user = await currentUser();
        const emailAddresses = getUserEmailAddresses(user);
        if (!hasTeamHubAccess(user?.publicMetadata, { emailAddresses })) return <AccessPending />;
    }

    const rows = ledger.rows;
    const products = rows.filter((r) => r.productRecord).length;
    const indexedByGeneration = rows.reduce<Record<string, number>>((acc, r) => {
        if (r.hero.state === "indexed" && r.hero.generation) acc[r.hero.generation] = (acc[r.hero.generation] ?? 0) + 1;
        return acc;
    }, {});
    const groups = new Set(rows.filter((r) => r.productRecord && r.groupSlug).map((r) => r.groupSlug));
    const groupsWithHero = new Set(rows.filter((r) => r.hero.state === "indexed" && r.groupSlug).map((r) => r.groupSlug));
    const compactRows = rows.map(compact);
    const families = ledger.families.map((f) => ({
        family: f.family,
        skus: f.skus,
        hero: sum(f.heroes, DONE.hero),
        plate: sum(f.plates, DONE.plate),
        kit: sum(f.kits, DONE.kit),
        heroWaiting: sum(f.heroes, ["approved-not-locked", "approved-not-indexed", "indexed-stale"]),
        kitWaiting: sum(f.kits, ["approved-not-published", "candidate"]),
    }));

    return (
        <main className="min-h-screen bg-linen text-obsidian">
            <div className="mx-auto max-w-7xl px-6 py-10">
                <header className="mb-8">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate">
                        <a href="/team" className="hover:text-obsidian">Team Hub</a> · asset ledger
                    </p>
                    <h1 className="mt-1 font-serif text-3xl">Visual asset ledger</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate">
                        One row per SKU, one state per asset kind, read from every store at once. Snapshot taken{" "}
                        <time dateTime={ledger.generatedAt}>{ledger.generatedAt.replace("T", " ").slice(0, 16)} UTC</time>
                        {ledger.deployment ? <> against Convex <code className="rounded bg-travertine px-1">{ledger.deployment}</code></> : null}.
                        Refresh with <code className="rounded bg-travertine px-1">npm run ledger:build</code>, then commit the snapshot.
                    </p>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    {KINDS.map(({ kind, label, key, doneLabel }) => {
                        const counts = ledger.summary[key];
                        const done = sum(counts, DONE[kind]);
                        return (
                            <div key={kind} className="rounded-lg border border-champagne bg-warm-white p-5">
                                <div className="flex items-baseline justify-between">
                                    <h2 className="text-lg font-medium">{label}</h2>
                                    <span className="text-xs text-slate">of {products} products</span>
                                </div>
                                <p className="mt-2 text-4xl font-light tabular-nums">
                                    {done}
                                    <span className="ml-2 text-base text-slate">{pct(done, products)}%</span>
                                </p>
                                <p className="text-xs text-slate">{doneLabel}</p>
                                {kind === "hero" ? (
                                    <p className="mt-1 text-xs text-slate">
                                        {indexedByGeneration["sunburst-approved"] ?? 0} Sunburst-approved · {indexedByGeneration["prior-release"] ?? 0} from the prior release
                                        <br />the catalogue shows one hero per group: {groupsWithHero.size} of {groups.size} groups have one
                                    </p>
                                ) : null}
                                <ul className="mt-4 space-y-1 text-xs">
                                    {Object.entries(counts).map(([state, n]) => (
                                        <li key={state} className="flex justify-between gap-3">
                                            <span title={ledger.states[kind][state] ?? ""} className={DONE[kind].includes(state) ? "font-medium" : "text-slate"}>{state}</span>
                                            <span className="tabular-nums">{n}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </section>

                <section className="mt-10">
                    <h2 className="text-lg font-medium">By family</h2>
                    <p className="mb-3 text-xs text-slate">Done counts per family. “Waiting” = approved or candidate work that is not served yet.</p>
                    <div className="overflow-x-auto rounded-lg border border-champagne bg-warm-white">
                        <table className="w-full text-sm">
                            <thead className="bg-travertine text-left text-xs uppercase tracking-wide text-slate">
                                <tr>
                                    <th className="px-3 py-2">Family</th>
                                    <th className="px-3 py-2 text-right">SKUs</th>
                                    <th className="px-3 py-2 text-right">Heroes</th>
                                    <th className="px-3 py-2 text-right">Hero waiting</th>
                                    <th className="px-3 py-2 text-right">Plates</th>
                                    <th className="px-3 py-2 text-right">Kits</th>
                                    <th className="px-3 py-2 text-right">Kit waiting</th>
                                </tr>
                            </thead>
                            <tbody>
                                {families.map((f) => (
                                    <tr key={f.family} className="border-t border-champagne/60">
                                        <td className="px-3 py-1.5">{f.family}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">{f.skus}</td>
                                        <Cell n={f.hero} d={f.skus} />
                                        <td className="px-3 py-1.5 text-right tabular-nums text-slate">{f.heroWaiting || ""}</td>
                                        <Cell n={f.plate} d={f.skus} />
                                        <Cell n={f.kit} d={f.skus} />
                                        <td className="px-3 py-1.5 text-right tabular-nums text-slate">{f.kitWaiting || ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="mt-10">
                    <h2 className="text-lg font-medium">Every SKU</h2>
                    <LedgerTable rows={compactRows} states={ledger.states} />
                </section>

                <section className="mt-10 text-xs text-slate">
                    <h2 className="text-sm font-medium text-obsidian">Stores read for this snapshot</h2>
                    <ul className="mt-2 space-y-0.5 font-mono">
                        {ledger.sources.map((s, i) => (
                            <li key={i}>{Object.entries(s).map(([k, v]) => `${k}=${v}`).join("  ")}</li>
                        ))}
                    </ul>
                </section>
            </div>
        </main>
    );
}

function AccessPending() {
    return (
        <main className="min-h-screen bg-bone px-6 py-24">
            <div className="mx-auto max-w-[640px] rounded-xl border border-champagne/40 bg-white px-8 py-8">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-gold">Staff only</p>
                <h1 className="mb-3 font-serif text-3xl text-obsidian">You don&rsquo;t have access to the asset ledger</h1>
                <p className="text-sm leading-relaxed text-slate">
                    The ledger is limited to Best Bottles staff. If you should have access, ask an administrator to add
                    you to the Team Hub.
                </p>
            </div>
        </main>
    );
}

function Cell({ n, d }: { n: number; d: number }) {
    const p = pct(n, d);
    return (
        <td className="px-3 py-1.5 text-right tabular-nums">
            <span className="mr-2 inline-block h-1.5 w-16 rounded bg-travertine align-middle">
                <span className="block h-1.5 rounded bg-muted-gold" style={{ width: `${p}%` }} />
            </span>
            {n}
        </td>
    );
}
