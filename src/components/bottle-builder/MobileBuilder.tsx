"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, SlidersHorizontal, X, ArrowsOutSimple } from "@/components/icons";
import { builderOrder, deriveBuilder, MAX_QUANTITY, previewParts, type BuilderBody, type BuilderSelection } from "@/lib/bottle-builder/model";
import { checkoutMinimum, checkoutMinimumMessage } from "@/lib/checkout";
import BuilderImage from "./BuilderImage";
import BuilderFinishImage from "./BuilderFinishImage";
import FitmentIllustration from "./FitmentIllustration";
import styles from "./MobileBuilder.module.css";

const stages = ["Bottle", "Glass", "Fitment", "Finish"];
const titles = ["Choose your bottle", "Choose your glass", "Choose your fitment", "Choose your finish", "Review your bottle"];
const money = (n: number | null) => n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

type Props = {
    familyNotice?: import("react").ReactNode;
    families: { family: string; groups: number }[]; family: string; bodies: BuilderBody[];
    selection: BuilderSelection; current: ReturnType<typeof deriveBuilder>; order: ReturnType<typeof builderOrder>;
    stage: number; onStage: (stage: number) => void; onUpdate: (patch: Partial<BuilderSelection>) => void;
    onReset: () => void; onFamily: (family: string) => void; onAdd: () => Promise<void>;
    size: string; neck: string; application: string;
    onFilter: (filter: "size" | "neck" | "application", value: string) => void;
    pending: boolean; adding: boolean; hydrated: boolean; error: string;
    lastAdded: { name: string; quantity: number } | null; cartProgress: ReturnType<typeof checkoutMinimum>;
    hasIncludedCover: boolean; showCover: boolean; onCover: () => void;
    chooserScale: (body: BuilderBody) => number;
};

/** Mobile presentation only. Exact configuration, pricing and submission stay in MatrixClient. */
export default function MobileBuilder(p: Props) {
    const { body, color, fitment, closure, configuration } = p.current;
    const stage = body ? p.stage : 0;
    const heading = useRef<HTMLHeadingElement>(null);
    const root = useRef<HTMLDivElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const submitting = useRef(false);
    const filters = useRef<HTMLDialogElement>(null);
    const expanded = useRef<HTMLDialogElement>(null);
    const [notice, setNotice] = useState("");
    const [barHeight, setBarHeight] = useState(0);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [largeText, setLargeText] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const filterTrigger = useRef<HTMLButtonElement>(null);
    const expandTrigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    const busy = p.pending || p.adding;
    const canAdvance = [Boolean(body), Boolean(color), Boolean(fitment), Boolean(configuration), p.order.canAdd && p.hydrated][stage];
    const reason = p.pending ? "Loading compatible choices…" : stage === 0 ? "Select a bottle to choose its glass."
        : stage === 1 ? "Select your glass to continue." : stage === 2 ? "Select a fitment to continue."
        : stage === 3 ? "Select an available finish to continue."
        : !p.order.validQuantity ? "Enter a whole-number quantity from 1 to 1,000,000."
        : !p.hydrated ? "Loading your cart…" : "This combination is unavailable. Edit your choices to continue.";
    const finishLabel = /Roller/.test(fitment ?? "") ? "Roller cap" : /Pump/.test(fitment ?? "") ? "Pump finish" : /Sprayer/.test(fitment ?? "") ? "Sprayer finish" : "Cap finish";
    const preview = configuration ?? p.current.fitted[0] ?? p.current.colored[0] ?? body?.configurations[0];
    const previewStage = stage < 2 ? "body" : stage === 2 ? "fitment" : configuration ? "complete" : "fitment";
    const parts = preview ? previewParts(preview, previewStage).filter(part => !(p.hasIncludedCover && !p.showCover && part.slot === "overcap")) : [];
    const bodyReference = p.current.colored.find(c => c.fitment === "Vintage Bulb Sprayer" && c.kit?.completeness === "full") ?? p.current.colored[0] ?? body?.configurations[0];
    const unavailable = body?.unavailableFinishes?.filter(c => c.color === color && c.fitment === fitment) ?? [];
    const visible = p.bodies.filter(b => (!p.size || b.capacityMl === Number(p.size)) && (!p.neck || b.neck === p.neck) && (!p.application || b.configurations.some(c => c.fitment === p.application)));
    const selected = stage === 1 ? color : stage === 2 ? fitment : stage === 3 ? closure : null;
    const activeFilters = Boolean(p.size || p.neck || p.application);
    const showBar = !p.lastAdded && (stage > 0 || Boolean(body));

    useEffect(() => {
        if (!bar.current || !showBar) return;
        const element = bar.current;
        const observer = new ResizeObserver(() => setBarHeight(element.getBoundingClientRect().height));
        observer.observe(element); return () => observer.disconnect();
    }, [showBar]);
    useEffect(() => {
        const viewport = window.visualViewport;
        const update = () => setKeyboardOpen(Boolean(viewport && viewport.height < window.innerHeight * .75));
        viewport?.addEventListener("resize", update); return () => viewport?.removeEventListener("resize", update);
    }, []);
    useEffect(() => {
        if (!heading.current) return;
        const observer = new ResizeObserver(() => setLargeText(parseFloat(getComputedStyle(document.documentElement).fontSize) >= 24));
        observer.observe(heading.current); return () => observer.disconnect();
    }, [stage]);
    useEffect(() => {
        if (p.lastAdded) root.current?.querySelector<HTMLElement>("[role=status]")?.focus();
    }, [p.lastAdded]);
    function go(next: number) {
        if (busy) return;
        p.onStage(next); setNotice("");
        requestAnimationFrame(() => {
            heading.current?.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: "instant" });
        });
    }
    function choose(patch: Partial<BuilderSelection>) {
        // The shared reconciler preserves each downstream choice if still valid.
        p.onUpdate(patch);
        if ((patch.bodyId && patch.bodyId !== body?.id || patch.color && patch.color !== color) && fitment) {
            const next = deriveBuilder(p.bodies, { ...p.selection, ...patch });
            setNotice(!next.fitment ? "Choose a compatible fitment for this bottle and glass." : !next.closure && closure ? "Choose a finish for your updated selection." : "");
        } else if (patch.fitment && patch.fitment !== fitment && closure) {
            setNotice(deriveBuilder(p.bodies, { ...p.selection, ...patch }).closure ? "" : "Choose a finish for this fitment.");
        } else setNotice("");
    }
    async function submitBuild() {
        // Guard repeated taps before React has rendered the pending state.
        if (submitting.current || busy || !canAdvance) return;
        submitting.current = true;
        try { await p.onAdd(); } finally { submitting.current = false; }
    }
    function resetBuild() {
        p.onReset(); setNotice("");
        requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); });
    }
    function closeFilters() { filters.current?.close(); setFilterOpen(false); filterTrigger.current?.focus(); }
    const clearFilters = () => { p.onFilter("size", ""); p.onFilter("neck", ""); p.onFilter("application", ""); };
    const previewImage = preview && <BuilderImage config={preview} parts={parts} stage={previewStage} scale={/Vintage|Tassel/.test(fitment ?? "") ? 1 : 1.18} showCover={p.showCover} bodyReference={bodyReference}
        label={`${body?.capacityMl} ml ${stage < 2 ? preview.color : color} ${body?.profileLabel}${stage >= 2 && fitment ? ` with ${fitment}` : " bottle"}${stage >= 3 && closure ? `, ${closure}` : ""}`} />;

    return <div ref={root} className={styles.mobile} data-mobile-builder data-stage={stage} data-keyboard={keyboardOpen} data-large-text={largeText} aria-busy={busy}
        style={{ "--action-height": `${showBar ? barHeight : 0}px` } as CSSProperties}>
        <nav className={styles.progress} aria-label="Bottle building progress">
            {stages.map((name, n) => <button key={name} aria-current={stage === n ? "step" : undefined} disabled={busy || n > 0 && ![body, color, fitment][n - 1]} onClick={() => go(n)}>
                <span>{name}</span>{[body, color, fitment, configuration][n] && stage !== n && <Check size={14} weight="bold" aria-label="complete" />}
            </button>)}
        </nav>
        {p.lastAdded && <section className={styles.success} role="status" tabIndex={-1}>
            <h2>Your bottle has been added.</h2><p>{p.lastAdded.quantity} × {p.lastAdded.name}</p><p>{checkoutMinimumMessage(p.cartProgress)}</p>
            <button className={styles.primary} onClick={resetBuild}>Build another bottle</button><Link href="/cart">View cart</Link>
        </section>}
        {stage > 0 && body && stage < 4 && <div className={styles.selectedBottle}>
            <div><h2>{body.capacityMl} ml {body.profileLabel}{color ? ` · ${color}` : ""}</h2><p>{fitment && stage > 1 ? `${fitment} · ` : ""}{body.neck} neck</p></div>
            <button onClick={() => go(0)} disabled={busy} aria-label="Edit bottle">Edit</button>
        </div>}
        {stage === 4 && <h1 ref={heading} tabIndex={-1} className={styles.title}>{titles[stage]}</h1>}
        {stage > 0 && preview && <section className={styles.preview} aria-label="Live bottle preview">
            <div className={styles.previewImage}>{previewImage}</div>
            <button ref={expandTrigger} className={styles.expand} aria-label="Expand bottle preview" onClick={() => expanded.current?.showModal()}><ArrowsOutSimple size={20} /></button>
            {stage >= 3 && p.hasIncludedCover && <button className={styles.coverToggle} aria-pressed={p.showCover} onClick={p.onCover}>{p.showCover ? "Hide overcap" : "Show included overcap"}</button>}
        </section>}
        {stage < 4 && <h1 ref={heading} tabIndex={-1} className={styles.title}>{titles[stage]}</h1>}
        {stage === 0 && <>
            {p.familyNotice}
            <div className={styles.filters}><label><span className={styles.srOnly}>Bottle family</span><select aria-label="Bottle family" value={p.family} disabled={busy} onChange={e => p.onFamily(e.target.value)}>{p.families.map(f => <option key={f.family}>{f.family}</option>)}</select></label>
                <button ref={filterTrigger} aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => { setFilterOpen(true); filters.current?.showModal(); }}><SlidersHorizontal size={20} /> Filters{activeFilters && <span aria-label="active">●</span>}</button>
            </div><p className={styles.count}>{visible.length} bottle {visible.length === 1 ? "option" : "options"}</p>
            <fieldset disabled={busy} className={styles.group}><legend className={styles.srOnly}>Bottle</legend><div className={styles.bottleGrid}>
                {visible.map(b => <Choice key={b.id} name={`${id}-bottle`} value={b.id} selected={body?.id === b.id} label={`${b.capacityMl} ml, ${b.neck} neck${b.profileLabel !== b.family ? `, ${b.profileLabel}` : ""}`} onSelect={() => choose({ bodyId: b.id })}>
                    <div className={styles.bottleThumb}><BuilderImage config={b.configurations[0]} parts={previewParts(b.configurations[0], "body")} scale={Math.max(1.08, p.chooserScale(b))} label={`${b.capacityMl} ml ${b.profileLabel}`} /></div>
                    <strong>{b.capacityMl} ml</strong>{b.profileLabel !== b.family && <span>{b.profileLabel}</span>}<span>Neck: {b.neck}</span>
                </Choice>)}
            </div></fieldset>
            {!visible.length && <div className={styles.empty}><p>No bottles match these filters.</p><button onClick={clearFilters}>Clear filters</button><Link href={`/catalog?families=${encodeURIComponent(p.family)}`}>Browse catalog</Link></div>}
            {!body && <p className={styles.guidance}>Select a bottle to choose its glass.</p>}
        </>}
        {stage > 0 && stage < 4 && <>
            <p className={styles.selectionStatus} role="status">{stage === 3 ? `${finishLabel} · ` : ""}{selected ? <>{selected} selected <Check size={16} weight="bold" /></> : stage === 3 && p.current.closures.length === 0 ? "No finish available for this selection." : `Select ${stage === 1 ? "your glass" : stage === 2 ? "how your bottle works" : "a finish"}.`}</p>
            <fieldset disabled={busy} className={styles.group}><legend className={styles.srOnly}>{stages[stage]}</legend>
                {stage === 1 && <div className={styles.glassGrid}>{p.current.colors.map(c => { const example = body!.configurations.find(item => item.color === c)!; return <Choice key={c} name={`${id}-glass`} value={c} selected={color === c} label={c} onSelect={() => choose({ color: c })}>
                    <div className={styles.glassThumb}><BuilderImage config={example} parts={previewParts(example, "body")} label={`${c} bottle`} /></div><strong>{c}</strong>
                </Choice>; })}</div>}
                {stage === 2 && <div className={styles.fitmentGrid}>{p.current.fitments.map(f => { return <Choice key={f} name={`${id}-fitment`} value={f} selected={fitment === f} label={f} onSelect={() => choose({ fitment: f })}>
                    <div className={styles.componentThumb}><FitmentIllustration fitment={f} /></div><strong>{f}</strong>
                </Choice>; })}</div>}
                {stage === 3 && <div className={styles.finishGrid}>{p.current.fitted.map(c => <Choice key={c.id} name={`${id}-finish`} value={c.closure} selected={closure === c.closure} label={c.closure} onSelect={() => choose({ closure: c.closure })}>
                    <div className={styles.finishThumb}><BuilderFinishImage config={c} /></div><strong>{c.closure}</strong>
                </Choice>)}{unavailable.map(c => <Choice key={c.id} name={`${id}-finish`} value={c.id} selected={false} label={`${c.closure} — Out of stock`} onSelect={() => {}} disabled>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <div className={styles.finishThumb}><img src={c.imageUrl} alt={c.closure} loading="lazy" onError={e => { e.currentTarget.hidden = true; }} /></div><strong>{c.closure}</strong><span>Out of stock</span>
                </Choice>)}</div>}
            </fieldset>
            {stage === 3 && p.hasIncludedCover && <p className={styles.included}>Matching overcap included: <strong>{closure}</strong>. Supplied with this {fitment?.includes("Pump") ? "pump" : "sprayer"}; it cannot be mixed and matched.</p>}
        </>}
        {stage === 4 && <section className={styles.review} aria-label="Review and quantity">
            <dl className={styles.summary}>{[["Bottle", `${body?.capacityMl} ml ${body?.profileLabel}`, 0], ["Glass", color, 1], ["Fitment", fitment, 2], [finishLabel, closure, 3]].map(([label, value, to]) => <div key={label}>
                <dt>{label}</dt><dd>{value}{to === 0 && <small>{body?.neck} neck</small>}</dd><dd className={styles.summaryEdit}><button aria-label={`Edit ${label?.toString().toLowerCase()}`} disabled={busy} onClick={() => go(Number(to))}>Edit</button></dd>
            </div>)}</dl>
            {p.hasIncludedCover && <p className={styles.included}>Matching protective overcap included.</p>}
            <div className={styles.quantityRow}><label htmlFor={`${id}-quantity`}>Quantity</label><div className={styles.quantity}>
                <button aria-label="Decrease quantity" disabled={busy || p.selection.quantity <= 1} onClick={() => p.onUpdate({ quantity: Math.max(1, p.selection.quantity - 1) })}><Minus size={18} /></button>
                <input id={`${id}-quantity`} type="number" inputMode="numeric" min="1" max={MAX_QUANTITY} step="1" value={Number.isNaN(p.selection.quantity) ? "" : p.selection.quantity} disabled={busy} aria-invalid={!p.order.validQuantity} aria-describedby={`${id}-reason`} onChange={e => p.onUpdate({ quantity: e.target.value === "" ? NaN : Number(e.target.value) })} />
                <button aria-label="Increase quantity" disabled={busy || p.selection.quantity >= MAX_QUANTITY} onClick={() => p.onUpdate({ quantity: Math.min(MAX_QUANTITY, (Number.isFinite(p.selection.quantity) ? p.selection.quantity : 0) + 1) })}><Plus size={18} /></button>
            </div></div>
            {configuration?.caseQuantity && <p className={styles.case}>Case pack: {configuration.caseQuantity.toLocaleString()} units <button disabled={busy} onClick={() => p.onUpdate({ quantity: configuration.caseQuantity! })}>Use case quantity</button></p>}
            <dl className={styles.totals}><div><dt>Unit price</dt><dd>{money(p.order.unitPrice)} each</dd></div><div><dt>Total · {p.order.validQuantity ? p.selection.quantity : "—"} bottles</dt><dd>{money(p.order.total)}</dd></div></dl>
            <p className={styles.included}>A $50 minimum applies to your entire cart at checkout.</p>
        </section>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {body && <div className={styles.recovery}><button onClick={resetBuild} disabled={busy}>Start over</button><Link href="/contact">Need help?</Link></div>}
        {showBar && <div ref={bar} className={styles.actionBar}>
            <div id={`${id}-reason`} aria-live="polite">{p.error ? <p role="alert" className={styles.error}>{p.error}</p> : !canAdvance ? <p>{reason}</p> : null}</div>
            <div className={styles.actionRow}>{stage > 0 ? <button className={styles.back} disabled={busy} onClick={() => go(stage - 1)}><ArrowLeft size={18} /> Back</button> : <span />}
                <button className={styles.primary} disabled={!canAdvance || busy} aria-describedby={`${id}-reason`} onClick={() => stage === 4 ? void submitBuild() : go(stage + 1)}>
                    {stage === 4 ? p.adding ? "Checking your bottle…" : `Add to cart · ${money(p.order.total)}` : ["Continue to glass", "Continue to fitment", "Continue to finish", "Review bottle"][stage]}{!p.adding && <ArrowRight size={18} />}
                </button>
            </div>
        </div>}
        <dialog ref={filters} className={styles.dialog} aria-labelledby={`${id}-filters`} onCancel={closeFilters} onClose={() => { setFilterOpen(false); filterTrigger.current?.focus(); }}>
            <div className={styles.dialogHeading}><h2 id={`${id}-filters`}>Filter bottles</h2><button aria-label="Close filters" onClick={closeFilters}><X size={22} /></button></div>
            {([['size', 'Size', [...new Set(p.bodies.map(b => b.capacityMl))].sort((a,b) => a-b).map(n => [String(n), `${n} ml`])], ['neck', 'Neck size', [...new Set(p.bodies.map(b => b.neck))].map(n => [n,n])], ['application', 'Application', [...new Set(p.bodies.flatMap(b => b.configurations.map(c => c.fitment)))].map(n => [n,n])]] as ["size" | "neck" | "application", string, string[][]][]).map(([key,label,values]) => <label className={styles.filterField} key={key}>{label}<select aria-label={label} value={p[key]} onChange={e => p.onFilter(key,e.target.value)}><option value="">All {label.toLowerCase()}{key === "size" ? "s" : " options"}</option>{values.map(([value,text]) => <option value={value} key={value}>{text}</option>)}</select></label>)}
            <button onClick={clearFilters}>Clear filters</button><button className={styles.primary} onClick={closeFilters}>Show {visible.length} {visible.length === 1 ? "bottle" : "bottles"}</button>
        </dialog>
        <dialog ref={expanded} className={`${styles.dialog} ${styles.largePreview}`} aria-label="Expanded bottle preview" onClose={() => expandTrigger.current?.focus()}>
            <button className={styles.closePreview} aria-label="Close preview" onClick={() => expanded.current?.close()}><X size={22} /> Close</button><div>{previewImage}</div>
        </dialog>
    </div>;
}

function Choice({ name, value, selected, label, onSelect, disabled, children }: { name: string; value: string; selected: boolean; label: string; onSelect: () => void; disabled?: boolean; children: ReactNode }) {
    return <label className={styles.choice} data-selected={selected} data-disabled={disabled}>
        <input type="radio" name={name} value={value} checked={selected} onChange={onSelect} aria-label={label} disabled={disabled} />
        {selected && <span className={styles.check}><Check size={13} weight="bold" /></span>}{children}
    </label>;
}
