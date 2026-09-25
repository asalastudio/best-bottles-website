/**
 * Lab: the Phase 4 parity gate for the 17-415 Cylinder 9 mL pilot.
 *
 * For each pilot SKU: the legacy kit as the PDP paints it today, the register
 * render written by scripts/register/phase4/render.ts, the same composition
 * drawn live in the browser by RegisterStage (the storefront renderer), and
 * the overlay the gate measured. Reads the local gate output; on a deployment
 * the page only explains what to run.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import RegisterStage, { type StageLayer, type StagePlate } from "@/components/register/RegisterStage";
import type { Frame, LayerGeometry, PlateGeometry } from "@/lib/register/compose";

export const dynamic = "force-dynamic";

type ManifestItem = {
    websiteSku: string; graceSku: string; glass: string; fitmentType: string; capColor: string;
    buildParts: { role: string; componentId: string }[];
    frame: Frame; frameSource: string;
    legacy: { anchors: { axisX: number; seatY: number; baselineY: number }; measured: { axisX: number; seatY: number; baselineY: number } | null } | null;
};
type Manifest = { renderedAt: string; bodyId: string; frameMode?: string; items: ManifestItem[] };
type Result = {
    websiteSku: string; passes: boolean; checks: Record<string, boolean>;
    seat: { deltaPx: number | null }; foot: { deltaPx: number | null };
    body: { iou: number; edgeP95Px: number }; closure: { iou: number; edgeP95Px: number }; silhouette: { iou: number };
    behindAboveRim: { iou: number | null };
};
type Parity = {
    measuredOn: string; thresholds: Record<string, number>;
    counts: Record<string, number>; failuresByCheck: Record<string, number>;
    distribution: Record<string, { min: number; median: number; max: number }>;
    withoutLegacyKit: string[]; results: Result[];
};
type Measurements = {
    plates: (PlateGeometry & { glass: string; file: string })[];
    components: { componentId: string; layers: (LayerGeometry & { file: string })[] }[];
};

const ROOT = process.cwd();
const FILE = "/lab/register-parity/file";

function readJson<T>(path: string): T | null {
    return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}

const GLASSES = ["Clear", "Frosted", "Amber", "Cobalt Blue", "Swirl"];

export default async function RegisterParityPage({ searchParams }: { searchParams: Promise<{ glass?: string; only?: string }> }) {
    const params = await searchParams;
    const manifest = readJson<Manifest>(resolve(ROOT, "output", "register-phase4", "renders", "manifest.json"));
    const parity = readJson<Parity>(resolve(ROOT, "data", "register", "phase4", "parity-pilot.json"));
    const measurements = readJson<Measurements>(resolve(ROOT, "data", "register", "phase3", "pilot-measurements.json"));

    if (!manifest || !measurements) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-16 text-[#1c1c1e]">
                <h1 className="text-2xl font-semibold">Register parity gate</h1>
                <p className="mt-4 text-sm text-[#5d6b7e]">No local gate output. Run, in order:</p>
                <pre className="mt-3 bg-[#f1ebe0] p-4 text-xs">npx tsx scripts/register/phase4/fetch-legacy-kits.ts{"\n"}npx tsx scripts/register/phase4/render.ts{"\n"}python3 scripts/register/phase4/parity_gate.py</pre>
            </main>
        );
    }

    const glass = GLASSES.includes(params.glass ?? "") ? params.glass! : params.glass === "all" ? "all" : "Clear";
    const results = new Map((parity?.results ?? []).map((r) => [r.websiteSku, r]));
    const plates = new Map(measurements.plates.map((p) => [p.glass, p]));
    const components = new Map(measurements.components.map((c) => [c.componentId, c]));
    const items = manifest.items
        .filter((item) => glass === "all" || item.glass === glass)
        .filter((item) => params.only !== "fail" || (results.get(item.websiteSku) && !results.get(item.websiteSku)!.passes))
        .sort((a, b) => Number(results.get(a.websiteSku)?.passes ?? true) - Number(results.get(b.websiteSku)?.passes ?? true) || a.websiteSku.localeCompare(b.websiteSku));

    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

    return (
        <main className="mx-auto max-w-[1720px] px-6 py-10 text-[#1c1c1e]">
            <header className="border-b border-[#1c1c1e] pb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a7a48]">Component register · Phase 4</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-[0.04em]">Parity gate: {manifest.bodyId}</h1>
                <p className="mt-2 max-w-3xl text-[13px] text-[#5d6b7e]">
                    Per SKU: the legacy kit as the product page paints it today · the register render (Node, the gate&rsquo;s input) ·
                    the same composition drawn live in this browser by the storefront renderer · the gate&rsquo;s overlay (blue = legacy only,
                    gold = register only, dark = both). Rendered {new Date(manifest.renderedAt).toLocaleString()}; frame: {manifest.frameMode === "pixels" ? "the legacy body's own pixels" : "recorded kit anchors"}.
                </p>
                {parity && (
                    <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-[13px] sm:grid-cols-4 lg:grid-cols-8">
                        {[
                            ["Pilot SKUs", parity.counts.pilotSkus], ["With a legacy kit", parity.counts.withLegacyKit], ["Pass", parity.counts.pass], ["Fail", parity.counts.fail],
                            ["Seat Δ max", `${parity.distribution.seatDeltaPx?.max ?? "–"} px`], ["Foot Δ max", `${parity.distribution.footDeltaPx?.max ?? "–"} px`],
                            ["Body IoU (min · median)", `${parity.distribution.bodyIou.min} · ${parity.distribution.bodyIou.median}`],
                            ["Closure IoU (min · median)", `${parity.distribution.closureIou.min} · ${parity.distribution.closureIou.median}`],
                        ].map(([label, value]) => (
                            <div key={String(label)}><dt className="text-[11px] uppercase tracking-[0.1em] text-[#8a93a0]">{label}</dt><dd className="tabular-nums">{value}</dd></div>
                        ))}
                    </dl>
                )}
                {parity && (
                    <p className="mt-2 text-[12px] text-[#8a93a0]">
                        Thresholds: seat/foot ≤ {parity.thresholds.seatPx} px · body ≥ {parity.thresholds.bodyIou} · closure ≥ {parity.thresholds.closureIou} · silhouette ≥ {parity.thresholds.silhouetteIou}.
                        Misses by check: {Object.entries(parity.failuresByCheck).map(([k, v]) => `${k} ${v}`).join(" · ")}. {parity.withoutLegacyKit.length} SKUs have no legacy kit and render on the pilot datum.
                    </p>
                )}
                <nav className="mt-4 flex flex-wrap gap-1.5 text-[12px]">
                    {[...GLASSES, "all"].map((g) => (
                        <Link key={g} href={`?glass=${encodeURIComponent(g)}${params.only ? `&only=${params.only}` : ""}`}
                            className={`border px-3 py-1.5 ${g === glass ? "border-[#1c1c1e] bg-[#1c1c1e] text-white" : "border-[#d9cdb9] hover:border-[#1c1c1e]"}`}>
                            {g}
                        </Link>
                    ))}
                    <Link href={`?glass=${encodeURIComponent(glass)}${params.only === "fail" ? "" : "&only=fail"}`}
                        className={`ml-4 border px-3 py-1.5 ${params.only === "fail" ? "border-[#1c1c1e] bg-[#1c1c1e] text-white" : "border-[#d9cdb9] hover:border-[#1c1c1e]"}`}>
                        failing only
                    </Link>
                </nav>
            </header>

            <ol className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-2">
                {items.map((item) => {
                    const result = results.get(item.websiteSku);
                    const plate = plates.get(item.glass);
                    const layers: StageLayer[] = item.buildParts.flatMap((part) =>
                        (components.get(part.componentId)?.layers ?? []).map((layer) => ({ ...layer, componentId: part.componentId, url: `${FILE}/pilot/${layer.file}` })));
                    const stagePlate: StagePlate | null = plate ? { ...plate, url: `${FILE}/pilot/${plate.file}` } : null;
                    const dir = `${FILE}/renders/${item.websiteSku}`;
                    const failing = result ? Object.entries(result.checks).filter(([, ok]) => !ok).map(([k]) => k) : [];
                    return (
                        <li key={item.websiteSku} className="border border-[#e6dccd] bg-white p-4" data-testid="parity-item" data-sku={item.websiteSku} data-pass={result ? String(result.passes) : "no-kit"}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                <h2 className="text-[15px] font-medium">{item.websiteSku} <span className="text-[12px] font-normal text-[#5d6b7e]">{item.glass} · {item.fitmentType} · {item.capColor}</span></h2>
                                {result ? (
                                    <span className={`text-[12px] font-semibold ${result.passes ? "text-[#3d7a4f]" : "text-[#b0362b]"}`}>{result.passes ? "PASS" : `FAIL ${failing.join(", ")}`}</span>
                                ) : <span className="text-[12px] text-[#8a93a0]">no legacy kit · pilot datum</span>}
                            </div>
                            <p className="mt-1 text-[12px] tabular-nums text-[#5d6b7e]">
                                {result ? <>seat Δ{result.seat.deltaPx} · foot Δ{result.foot.deltaPx} · body {pct(result.body.iou)} (p95 {result.body.edgeP95Px} px) · closure {pct(result.closure.iou)} (p95 {result.closure.edgeP95Px} px) · silhouette {pct(result.silhouette.iou)}{result.behindAboveRim.iou != null && <> · insert above rim {pct(result.behindAboveRim.iou)}</>}</> : "—"}
                                {" · "}parts {item.buildParts.map((p) => `${p.role}:${p.componentId}`).join(", ")}
                            </p>
                            <div className={`mt-3 grid gap-2 ${item.legacy ? "grid-cols-4" : "grid-cols-2"}`}>
                                {item.legacy && (
                                    <figure>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={`${dir}/legacy.png`} alt={`${item.websiteSku} legacy kit`} width={1000} height={1100} loading="lazy" className="w-full bg-[#f5f3ef]" />
                                        <figcaption className="mt-1 text-[11px] text-[#8a93a0]">Legacy kit (today)</figcaption>
                                    </figure>
                                )}
                                <figure>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`${dir}/new.png`} alt={`${item.websiteSku} register render`} width={1000} height={1100} loading="lazy" className="w-full bg-[#f5f3ef]" />
                                    <figcaption className="mt-1 text-[11px] text-[#8a93a0]">Register render (Node)</figcaption>
                                </figure>
                                <figure>
                                    {stagePlate ? <RegisterStage plate={stagePlate} layers={layers} frame={item.frame} alt={`${item.websiteSku} drawn in the browser`} className="w-full" /> : null}
                                    <figcaption className="mt-1 text-[11px] text-[#8a93a0]">Register, live in the browser</figcaption>
                                </figure>
                                {item.legacy && (
                                    <figure>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={`${dir}/overlay.png`} alt={`${item.websiteSku} overlay`} width={1000} height={1100} loading="lazy" className="w-full bg-[#f5f3ef]" />
                                        <figcaption className="mt-1 text-[11px] text-[#8a93a0]">Overlay: blue legacy · gold register</figcaption>
                                    </figure>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </main>
    );
}
