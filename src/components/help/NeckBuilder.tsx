"use client";
/* eslint-disable @next/next/no-img-element -- parts are layered at measured pixel offsets to assemble at true scale */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ApplicatorKey, BuilderBottle, BuilderPart, MediaImage, NeckBuilder as NeckBuilderView } from "@/lib/help/fit-neck";

/** The product a chosen build matches, if we sell it as one item (mirrors matchProduct in fit-neck.ts). */
function matchProduct(bottle: Pick<BuilderBottle, "products">, partIds: string[]): string | null {
    const want = [...partIds].sort().join("|");
    return bottle.products.find((product) => product.parts.join("|") === want)?.sku ?? null;
}

type Selection = { bottle: string | null; applicator: ApplicatorKey | null; sprayer: string | null; closure: string | null };
type Layer = { image: MediaImage; z: number };
type StepId = "nb-bottle" | "nb-applicator" | "nb-closure" | "nb-result";

// The catalog's current tokens (src/app/catalog/CatalogClient.tsx): ink, hairline, chip and the product stage.
const INK = "#1c1c1e";
const HAIRLINE = "#d9cdb9";
const CHIP = "#f1ebe0";
const STAGE = "#f5f3ef";

/** Lay the parts over the bottle by their measured neck seat, at one scale (px per mm). */
function Assembly({ bottle, layers, maxHeight }: { bottle: MediaImage; layers: Layer[]; maxHeight: number }) {
    const mm = (img: MediaImage) => ({ w: img.width / img.pxPerMm, h: img.height / img.pxPerMm });
    const body = mm(bottle);
    const axis = bottle.axisX / bottle.pxPerMm;
    const seat = bottle.seatY / bottle.pxPerMm;
    const placed = layers.map(({ image, z }) => {
        const size = mm(image);
        return { image, z, w: size.w, h: size.h, x: axis - image.axisX / image.pxPerMm, y: seat - image.seatY / image.pxPerMm };
    });
    const left = Math.min(0, ...placed.map((p) => p.x));
    const top = Math.min(0, ...placed.map((p) => p.y));
    const right = Math.max(body.w, ...placed.map((p) => p.x + p.w));
    const bottom = Math.max(body.h, ...placed.map((p) => p.y + p.h));
    const k = Math.min(maxHeight / (bottom - top), 240 / (right - left));
    const style = (x: number, y: number, w: number, h: number, z: number) => ({ left: (x - left) * k, top: (y - top) * k, width: w * k, height: h * k, zIndex: z });
    return (
        <div className="relative" style={{ width: (right - left) * k, height: (bottom - top) * k }}>
            {placed.map((p, i) => <img key={i} src={p.image.src} alt="" className="absolute max-w-none" style={style(p.x, p.y, p.w, p.h, p.z)} />)}
            <img src={bottle.src} alt="" className="absolute max-w-none" style={style(0, 0, body.w, body.h, 1)} />
        </div>
    );
}

/** A filter-sidebar style section: numbered, uppercase, letter-spaced label over a hairline. */
function Step({ id, n, title, hint, pick, onClear, disabled, children }: { id: StepId; n: number; title: string; hint: string; pick: string | null; onClear?: () => void; disabled?: boolean; children: ReactNode }) {
    return (
        <section id={id} className={`scroll-mt-44 border-t pt-6 lg:scroll-mt-32 ${disabled ? "opacity-45" : ""}`} style={{ borderColor: HAIRLINE }}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h2 className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-gold-dim">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] tracking-normal text-white" style={{ background: pick ? INK : "#b9ab90" }}>{n}</span>
                    {title}
                </h2>
                {pick && (
                    <span className="ml-auto inline-flex max-w-full items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-2.5 text-[12px]" style={{ borderColor: HAIRLINE, background: CHIP, color: INK }}>
                        <span className="truncate">{pick}</span>
                        {onClear && <button type="button" onClick={onClear} aria-label={`Clear ${title.toLowerCase()}`} className="grid h-4 w-4 place-items-center text-[13px] leading-none">×</button>}
                    </span>
                )}
            </div>
            <p className="mb-4 mt-2 text-[13px] text-slate">{hint}</p>
            {children}
        </section>
    );
}

/** Product tiles joined by hairlines, the catalog's visual grid. */
function TileGrid({ cols, children }: { cols: string; children: ReactNode }) {
    // Hairlines drawn per tile (right and bottom) so a short last row leaves no coloured gap.
    return <div className={`grid border-l border-t ${cols}`} style={{ borderColor: HAIRLINE }}>{children}</div>;
}

function Tile({ pressed, disabled, onClick, title, image, meta, stage = "h-[200px]", align = "items-end", dim = false }: { pressed: boolean; disabled?: boolean; onClick: () => void; title: string; image: ReactNode; meta: ReactNode; stage?: string; align?: string; dim?: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed}
            className={`group relative flex flex-col border-b border-r bg-warm-white text-left outline-offset-[-2px] transition disabled:cursor-not-allowed disabled:opacity-45 ${dim ? "opacity-25" : ""}`}
            style={{ borderColor: HAIRLINE, ...(pressed ? { outline: `2px solid ${INK}` } : {}) }}>
            <span className={`flex w-full ${align} justify-center px-2 pb-3 pt-3 ${stage}`} style={{ background: STAGE }}>{image}</span>
            <span className="flex flex-1 flex-col gap-1 px-3 pb-3.5 pt-3">
                <span className="text-[14px] font-medium leading-snug tracking-[0.01em]" style={{ color: INK }}>{title}</span>
                <span className="text-[12px] leading-snug text-slate">{meta}</span>
            </span>
        </button>
    );
}

function PartTile({ part, pressed, onClick }: { part: BuilderPart; pressed: boolean; onClick: () => void }) {
    return (
        <Tile pressed={pressed} onClick={onClick} title={part.finish} stage="h-[112px]" align="items-center"
            image={<img src={part.image.src} alt="" className="max-h-[88px] max-w-[80px] object-contain" />}
            meta={part.itemCode ? <code className="font-mono text-[10.5px] break-all">{part.itemCode}</code> : null} />
    );
}

const button = "inline-flex min-h-11 items-center justify-center px-4 text-[12px] font-medium uppercase tracking-[0.14em]";

export default function NeckBuilder({ view, initial }: { view: NeckBuilderView; initial: Partial<Selection> }) {
    const [sel, setSel] = useState<Selection>(() => sanitize(view, { bottle: null, applicator: null, sprayer: null, closure: null, ...initial }));
    const [query, setQuery] = useState("");
    const first = useRef(true);

    const bottle = view.bottles.find((b) => b.id === sel.bottle) ?? null;
    const applicator = view.applicators.find((a) => a.key === sel.applicator) ?? null;
    const sprayer = sel.sprayer ? view.parts[sel.sprayer] : null;
    const closure = sel.closure ? view.parts[sel.closure] : null;
    const fits = (b: BuilderBottle | null, id: string | null) => Boolean(b && id && b.fits.includes(id));
    const appDone = Boolean(applicator) && (sel.applicator !== "spray" || Boolean(sprayer));
    const closeDone = sel.applicator === "spray" ? Boolean(sprayer) : Boolean(closure);
    const done = Boolean(bottle) && appDone && closeDone;
    const roller = sel.applicator === "roll-plastic" ? view.rollers.plastic : sel.applicator === "roll-metal" ? view.rollers.metal : null;
    const maxMm = useMemo(() => Math.max(...view.bottles.map((b) => b.image.height / b.image.pxPerMm)), [view.bottles]);

    const chosenParts = [roller, sel.applicator === "spray" ? sel.sprayer : null, sel.applicator === "spray" ? null : sel.closure].filter((id): id is string => Boolean(id));
    const sku = done && bottle ? matchProduct(bottle, chosenParts) : null;
    const builderHref = bottle ? `/matrix?family=${encodeURIComponent(bottle.family)}${sku ? `&sku=${encodeURIComponent(sku)}` : ""}` : "/matrix";
    const shareParams = new URLSearchParams();
    if (bottle) shareParams.set("bottle", bottle.id);
    if (sel.applicator) shareParams.set("applicator", sel.applicator);
    if (sel.applicator === "spray" && sprayer?.itemCode) shareParams.set("sprayer", sprayer.itemCode);
    if (sel.applicator !== "spray" && closure?.itemCode) shareParams.set("closure", closure.itemCode);
    const share = shareParams.toString();

    // Arriving with a bottle chosen (from the fit finder or a shared link) opens at the next open step.
    useEffect(() => {
        if (!initial.bottle) return;
        const next = !appDone ? "nb-applicator" : !closeDone ? "nb-closure" : "nb-result";
        if (next === "nb-result" && !window.matchMedia("(max-width: 1023px)").matches) return;
        requestAnimationFrame(() => document.getElementById(next)?.scrollIntoView({ block: "start" }));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, for the arrival state
    }, []);

    // Keep the address shareable: it names the exact build, for people and agents.
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        window.history.replaceState(null, "", `${window.location.pathname}${share ? `?${share}` : ""}`);
    }, [share]);

    const advance = (id: StepId) => {
        if (!window.matchMedia("(max-width: 1023px)").matches) return;
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    };
    const pickBottle = (id: string) => { setSel((s) => sanitize(view, { ...s, bottle: id })); advance("nb-applicator"); };
    const pickApplicator = (key: ApplicatorKey) => {
        setSel((s) => ({ ...s, applicator: key, sprayer: key === "spray" ? s.sprayer : null, closure: s.applicator === key ? s.closure : null }));
        advance(key === "spray" ? "nb-applicator" : "nb-closure");
    };
    const pickSprayer = (id: string) => { setSel((s) => ({ ...s, sprayer: id })); advance("nb-result"); };
    const pickClosure = (id: string) => { setSel((s) => ({ ...s, closure: id })); advance("nb-result"); };
    const reset = () => setSel({ bottle: null, applicator: null, sprayer: null, closure: null });

    const layers: Layer[] = [];
    // The insert sits inside the neck: drawn behind the glass so the threads cover its plug and only the ball shows.
    if (roller) layers.push({ image: view.parts[roller].image, z: 0 });
    if (sel.applicator === "spray" && sprayer) {
        layers.push({ image: sprayer.image, z: 2 });
        if (sprayer.overcap) layers.push({ image: sprayer.overcap, z: 3 });
    }
    if (sel.applicator !== "spray" && closure && fits(bottle, closure.id)) layers.push({ image: closure.image, z: 3 });

    const applicatorPick = applicator ? (sel.applicator === "spray" && sprayer ? `${sprayer.finish} sprayer` : applicator.label) : null;
    const closurePick = sel.applicator === "spray" && sprayer ? "Matching overcap" : closure ? closure.finish : null;
    const q = query.trim().toLowerCase();
    const glassOf = (b: BuilderBottle) => (b.id.startsWith("tulip-5ml") ? "Amber" : "Clear");

    return (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-8">
                <Step id="nb-bottle" n={1} title="Choose your bottle" pick={bottle?.label ?? null} onClear={bottle ? reset : undefined}
                    hint={`Smallest to largest, at true relative height. All ${view.bottles.length} take the same ${view.neck} parts.`}>
                    <label className="mb-4 flex h-11 items-center gap-2 rounded-full border bg-white px-[18px] focus-within:border-[#1c1c1e] lg:h-10" style={{ borderColor: HAIRLINE }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Bottle name or size" aria-label="Find a bottle" className="w-full bg-transparent text-[13px] outline-none" />
                    </label>
                    <TileGrid cols="grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                        {view.bottles.map((b) => {
                            const ratio = b.image.height / b.image.pxPerMm / maxMm;
                            const hidden = q && !`${b.label} ${b.id}`.toLowerCase().includes(q);
                            return (
                                <Tile key={b.id} dim={Boolean(hidden)} pressed={b.id === sel.bottle} onClick={() => pickBottle(b.id)} title={`${b.label} Bottle`}
                                    image={<img src={b.image.src} alt="" style={{ height: Math.round(168 * ratio) }} className="w-auto" />}
                                    meta={`${b.capacityMl} ml · ${view.neck} · ${glassOf(b)} · ${b.heightMm} mm tall`} />
                            );
                        })}
                    </TileGrid>
                </Step>

                <Step id="nb-applicator" n={2} title="Choose your applicator" pick={applicatorPick} disabled={!bottle}
                    onClear={applicator ? () => setSel((s) => ({ ...s, applicator: null, sprayer: null, closure: null })) : undefined}
                    hint="How the liquid comes out. Choose none for a pour bottle with just a cap.">
                    <TileGrid cols="grid-cols-2 sm:grid-cols-3">
                        {view.applicators.map((a) => {
                            const ok = Boolean(bottle) && a.available && (a.key === "roll-plastic" ? bottle!.rollers.includes("plastic") : a.key === "roll-metal" ? bottle!.rollers.includes("metal") : true);
                            const src = a.key === "roll-plastic" && view.rollers.plastic ? view.parts[view.rollers.plastic].image.src
                                : a.key === "roll-metal" && view.rollers.metal ? view.parts[view.rollers.metal].image.src
                                : a.key === "spray" && view.sprayers.length ? view.parts[view.sprayers.find((id) => view.parts[id].itemCode?.includes("BluMt")) ?? view.sprayers[0]].image.src : null;
                            const image = src ? <img src={src} alt="" className="max-h-[118px] w-auto" />
                                : a.key === "none" ? <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8B6F42" strokeWidth="1.1" aria-hidden="true"><path d="M9 3h6M10 3v4l-3 4v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9l-3-4V3" /></svg>
                                : <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#c9bba0" strokeWidth="1.1" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M7 17 17 7" /></svg>;
                            return (
                                <Tile key={a.key} pressed={a.key === sel.applicator} disabled={!ok} onClick={() => pickApplicator(a.key)} title={a.label} stage="h-[150px]" align="items-center" image={image}
                                    meta={a.available ? a.note : <span className="text-[#a9623f]">Not made for {view.neck}.{a.elsewhere.length ? ` See ${a.elsewhere.join(" and ")}.` : ""}</span>} />
                            );
                        })}
                    </TileGrid>
                    {sel.applicator === "spray" && bottle && (
                        <div className="mt-6">
                            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate">Sprayer finish</h3>
                            <TileGrid cols="grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {view.sprayers.filter((id) => fits(bottle, id)).map((id) => <PartTile key={id} part={view.parts[id]} pressed={id === sel.sprayer} onClick={() => pickSprayer(id)} />)}
                            </TileGrid>
                        </div>
                    )}
                </Step>

                <Step id="nb-closure" n={3} title="Choose your closure" pick={closurePick} disabled={!appDone}
                    onClear={closure ? () => setSel((s) => ({ ...s, closure: null })) : undefined}
                    hint="The cap that closes it, with the item code you order by.">
                    {!appDone ? (
                        <p className="border border-dashed p-5 text-center text-[13px] text-slate" style={{ borderColor: HAIRLINE }}>{bottle ? "Choose an applicator first." : "Choose a bottle first."}</p>
                    ) : sel.applicator === "spray" && sprayer ? (
                        <div className="flex items-center gap-4 border p-3" style={{ borderColor: HAIRLINE, background: "#fdfbf8" }}>
                            <span className="flex h-20 w-20 flex-none items-center justify-center" style={{ background: STAGE }}><img src={(sprayer.overcap ?? sprayer.image).src} alt="" className="max-h-16 w-auto" /></span>
                            <p className="text-[13px]" style={{ color: INK }}><span className="block font-medium">Included: matching {sprayer.finish.toLowerCase()} overcap</span><span className="text-slate">The sprayer comes with its own overcap, so there is nothing more to choose.</span></p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {(sel.applicator === "none" ? view.capGroups : [{ key: "roll-on-cap", label: "Roll-on caps", note: "Each fits over either roller ball.", partIds: view.rollOnCaps }]).map((group) => {
                                const ids = group.partIds.filter((id) => fits(bottle, id));
                                if (!ids.length) return null;
                                return (
                                    <div key={group.key}>
                                        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate">{group.label} <span className="font-medium normal-case tracking-normal">· {group.note}</span></h3>
                                        <div className="mt-3"><TileGrid cols="grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                            {ids.map((id) => <PartTile key={id} part={view.parts[id]} pressed={id === sel.closure} onClick={() => pickClosure(id)} />)}
                                        </TileGrid></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Step>
            </div>

            <aside id="nb-result" aria-live="polite" className="flex scroll-mt-44 flex-col border bg-warm-white lg:sticky lg:top-32 lg:scroll-mt-32" style={{ borderColor: HAIRLINE }}>
                <div className="flex items-center justify-between px-4 pb-3 pt-4">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em]" style={{ color: INK }}>Your bottle</h2>
                    {bottle && <button type="button" onClick={reset} className="text-[12px] text-gold-dim underline underline-offset-4">Start over</button>}
                </div>
                <div className="flex min-h-[290px] flex-col items-center justify-end gap-2 px-3 pb-3 pt-5" style={{ background: STAGE }}>
                    {bottle ? <>
                        <Assembly bottle={bottle.image} layers={layers} maxHeight={250} />
                        <p className="text-center text-[11px] text-slate">{layers.length ? "Assembled from our master images at true scale" : "Bare glass, true scale"}</p>
                    </> : <p className="mb-auto mt-auto px-6 text-center text-[13px] text-slate">Your bottle appears here as you build it.</p>}
                </div>
                <div className="flex flex-col gap-3 p-4">
                    <dl className="grid gap-2 text-[13px]">
                        {[["Bottle", bottle?.label], ["Applicator", sel.applicator === "spray" && sprayer ? `${sprayer.finish} sprayer` : applicator?.label], ["Closure", sel.applicator === "spray" && sprayer ? "Matching overcap, included" : closure?.finish]].map(([k, v]) => (
                            <div key={k as string} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
                                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate">{k}</dt>
                                <dd style={{ color: v ? INK : undefined }} className={v ? "" : "text-slate"}>{v ?? "Not chosen"}</dd>
                            </div>
                        ))}
                        {(sprayer?.itemCode || closure?.itemCode) && (
                            <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2"><dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate">Item code</dt><dd className="font-mono text-[12px]">{sel.applicator === "spray" ? sprayer?.itemCode : closure?.itemCode}</dd></div>
                        )}
                    </dl>
                    <p className="border-t pt-3 text-[13px]" style={{ borderColor: HAIRLINE, color: done ? "#2f6b45" : undefined }}>
                        {done ? <><span className="font-medium">Fits.</span> {view.ruling ? `Every ${view.neck} part fits every ${view.neck} bottle.` : "We sell this bottle with this closure."}{sel.applicator === "none" ? " A pour bottle with a cap and no applicator." : ""} <span className="text-slate">{sku ? `Sold as ${sku}.` : "Not sold as one item yet; we can put it together for you."}</span></>
                            : <span className="text-slate">{!bottle ? "Step 1: choose your bottle." : !appDone ? (sel.applicator === "spray" ? "Step 2: choose the sprayer finish." : "Step 2: choose your applicator.") : "Step 3: choose your closure."}</span>}
                    </p>
                    {done && <div className="flex flex-col gap-2">
                        {sku ? <Link href={builderHref} className={`${button} text-white`} style={{ background: INK }}>Build this bottle</Link>
                            : <Link href="/request-quote" className={`${button} text-white`} style={{ background: INK }}>Request this combination</Link>}
                        <div className="flex gap-2">
                            {(sel.applicator === "spray" ? sprayer?.catalogUrl : closure?.catalogUrl) && <Link href={(sel.applicator === "spray" ? sprayer?.catalogUrl : closure?.catalogUrl) ?? "/catalog"} className={`${button} flex-1 border`} style={{ borderColor: HAIRLINE, color: INK }}>Price and stock</Link>}
                            <Link href="/request-sample" className={`${button} flex-1 border`} style={{ borderColor: HAIRLINE, color: INK }}>Samples</Link>
                        </div>
                    </div>}
                    {bottle && <p className="text-[11px] text-slate">Link to this build, for people and agents
                        <code className="mt-1 block break-all px-2 py-1.5 font-mono text-[10.5px]" style={{ background: CHIP, color: INK }}>/help/fit/neck/{view.neck}{share ? `?${share}` : ""}</code></p>}
                    <p className="border-t pt-3 text-[11.5px] text-slate" style={{ borderColor: HAIRLINE }}>Will it work with your formula? We don&apos;t know. This shows physical fit only. Test samples with your formula before ordering in volume.</p>
                </div>
            </aside>

            <nav aria-label="Your build" className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t bg-white px-4 pt-2.5 lg:hidden" style={{ borderColor: HAIRLINE, paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
                <div className="flex min-w-0 flex-1 gap-1.5">
                    {[[bottle?.label, "1 Bottle", Boolean(bottle)], [applicatorPick, "2 Applicator", appDone], [closurePick, "3 Closure", closeDone]].map(([v, k, on], i) => (
                        <span key={i} className="min-w-0 flex-1 truncate rounded-full border px-2.5 py-1.5 text-[11px]" style={on ? { background: CHIP, borderColor: HAIRLINE, color: INK } : { borderColor: HAIRLINE, color: "#637588" }}>{(v as string) || (k as string)}</span>
                    ))}
                </div>
                <a href="#nb-result" className={`${button} flex-none text-white`} style={{ background: INK }}>{done ? "Build" : "View"}</a>
            </nav>
        </div>
    );
}

/** Drop choices that do not belong together (a link may name a closure from another group). */
function sanitize(view: NeckBuilderView, s: Selection): Selection {
    const bottle = view.bottles.find((b) => b.id === s.bottle) ?? null;
    const app = view.applicators.find((a) => a.key === s.applicator && a.available) ?? null;
    const applicator = bottle && app ? app.key : null;
    const sprayer = applicator === "spray" && s.sprayer && view.sprayers.includes(s.sprayer) && bottle!.fits.includes(s.sprayer) ? s.sprayer : null;
    const allowed = applicator?.startsWith("roll") ? view.rollOnCaps : applicator === "none" ? view.capGroups.flatMap((g) => g.partIds) : [];
    const closure = s.closure && allowed.includes(s.closure) && bottle!.fits.includes(s.closure) ? s.closure : null;
    return { bottle: bottle?.id ?? null, applicator, sprayer, closure };
}
