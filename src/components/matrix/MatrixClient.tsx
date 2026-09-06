"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle, Minus, Plus, ShieldCheck, SlidersHorizontal, ShoppingBag } from "@/components/icons";
import { useCart } from "@/components/CartProvider";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import { analytics } from "@/lib/analytics";
import {
    builderOrder, deriveBuilder, emptySelection, isClosurePart, previewParts, reconcileSelection,
    MAX_QUANTITY, ORDER_MINIMUM, type BuilderBody, type BuilderConfiguration, type BuilderSelection,
} from "@/lib/bottle-builder/model";
import styles from "@/components/bottle-builder/Builder.module.css";

const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const steps = ["Bottle", "Color", "Fitment", "Review"];

// Visual size cues for the chooser, not a dimensional product comparison.
// Keep small Cylinder bodies distinct instead of normalizing every bottle to fill its tile.
function chooserScale(body: BuilderBody) {
    if (body.family !== "Cylinder") return 1;
    if (body.capacityMl <= 5) return .56;
    if (body.capacityMl === 9 && body.neck === "13-415") return .68;
    if (body.capacityMl === 9 && body.neck === "17-415") return .84;
    return 1;
}

export default function MatrixClient({ families, openFamily, bodies }: {
    families: { family: string; groups: number }[];
    openFamily: string;
    bodies: BuilderBody[];
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { items, addItems, isCartHydrated } = useCart();
    const [selection, setSelection] = useState<BuilderSelection>(emptySelection);
    const [step, setStep] = useState(0);
    const [size, setSize] = useState("");
    const [neck, setNeck] = useState("");
    const [application, setApplication] = useState("");
    const [moreFilters, setMoreFilters] = useState(false);
    const [pending, startTransition] = useTransition();
    const [adding, setAdding] = useState(false);
    const [lastAdded, setLastAdded] = useState<{ name: string; quantity: number } | null>(null);
    const confirmation = useRef<HTMLDivElement>(null);
    const [error, setError] = useState("");
    const optionHeading = useRef<HTMLHeadingElement>(null);
    const tracked = useRef(false);
    useEffect(() => {
        if (tracked.current) return;
        tracked.current = true;
        const from = searchParams.get("from");
        const source = from === "finder" || from === "pdp" || from === "grace" ? from : "nav";
        analytics.matrixOpened({ source, family: openFamily });
    }, [searchParams, openFamily]);

    const current = deriveBuilder(bodies, selection);
    const { body, color, fitment, closure, configuration } = current;
    const order = builderOrder(configuration, selection.quantity, items);
    const sizes = [...new Set(bodies.map(b => b.capacityMl))].sort((a, b) => a - b);
    const necks = [...new Set(bodies.map(b => b.neck))].sort();
    const applications = [...new Set(bodies.flatMap(b => b.configurations.map(c => c.fitment)))].sort();
    const visibleBodies = useMemo(() => bodies.filter(b => (!size || b.capacityMl === Number(size))
        && (!neck || b.neck === neck) && (!application || b.configurations.some(c => c.fitment === application))), [bodies, size, neck, application]);
    const preview = configuration ?? current.fitted[0] ?? current.colored[0] ?? body?.configurations[0] ?? visibleBodies[0]?.configurations[0];
    const previewStage = configuration ? "complete" : fitment ? "fitment" : "body";
    const completed = [Boolean(body), Boolean(color), Boolean(fitment && closure), false];
    const canContinue = step === 0 ? Boolean(body) : step === 1 ? Boolean(color) : Boolean(configuration);
    const fitmentReady = step === 1 && canContinue && !pending;
    const catalogHref = `/catalog?families=${encodeURIComponent(openFamily)}`;
    const titles = ["Choose your bottle", "Choose your color", "Choose your fitment", "Ready to make it yours?"];
    const subtitles = [
        `${visibleBodies.length} bottle ${visibleBodies.length === 1 ? "shape" : "shapes"} · small to large`,
        "Choose your color, then continue to fitments.",
        `Made to fit your ${body?.neck ?? ""} neck.`,
        "Check your bottle, finish, and quantity before adding.",
    ];
    function goTo(next: number) {
        if (adding) return;
        setStep(next); setLastAdded(null); setError("");
        requestAnimationFrame(() => {
            optionHeading.current?.focus({ preventScroll: true });
            if (window.innerWidth < 1100) document.getElementById("builder-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }
    function update(patch: Partial<BuilderSelection>) {
        setSelection(state => reconcileSelection(bodies, { ...state, ...patch }));
        setLastAdded(null); setError("");
    }
    function reset() {
        setSelection(emptySelection()); setLastAdded(null); setError(""); setSize(""); setNeck(""); setApplication(""); goTo(0);
    }
    function chooseBottle(selected: BuilderBody) {
        const next = reconcileSelection(bodies, { ...selection, bodyId: selected.id });
        setSelection(next); setLastAdded(null); setError("");
        goTo(next.color ? 2 : 1);
    }
    async function addToCart() {
        if (!configuration || !order.canAdd || adding || !isCartHydrated) return;
        setAdding(true); setError("");
        try {
            const response = await fetch("/api/bottle-builder/validate", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ family: openFamily, sku: configuration.id, selection }) });
            const result = await response.json();
            if (!response.ok || !result.configuration) throw new Error(result.error ?? "Unable to check this bottle. Please try again.");
            const fresh = result.configuration as BuilderConfiguration;
            const freshOrder = builderOrder(fresh, selection.quantity, items);
            if (!freshOrder.canAdd) throw new Error("The price has changed. Refresh the builder to review the current price and minimum.");
            if (freshOrder.unitPrice !== order.unitPrice) throw new Error("The price has changed. Refresh the builder before adding this bottle.");
            addItems([{ ...fresh.product, quantity: selection.quantity, unitPrice: freshOrder.unitPrice }]);
            // Recycle the builder only after the exact configuration is in the cart.
            setSelection(emptySelection()); setSize(""); setNeck(""); setApplication(""); setMoreFilters(false); setStep(0);
            setLastAdded({ name: fresh.product.itemName, quantity: selection.quantity });
            requestAnimationFrame(() => {
                confirmation.current?.focus({ preventScroll: true });
                confirmation.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
            });
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add this bottle. Please try again."); }
        finally { setAdding(false); }
    }
    function continueBuild() { goTo(step === 0 && color ? 2 : Math.min(3, step + 1)); }

    const action = step < 3 ? <button key={`${step}-${step === 1 ? color : ""}`} className={`${styles.primary} ${fitmentReady ? styles.nextStepCue : ""}`} disabled={!canContinue || pending} onClick={continueBuild}>
            {step === 0 ? "Continue" : step === 1 ? "Choose Fitment" : "Review Your Bottle"} <ArrowRight size={17} />
        </button> : <button className={styles.primary} disabled={!order.canAdd || adding || !isCartHydrated} onClick={addToCart}>
            {adding ? "Checking your bottle…" : "Add to Cart"} {!adding && <ShoppingBag size={17} />}
        </button>;

    return <div className={styles.builder} data-bottle-builder data-current-step={step} aria-busy={pending || adding}>
        <header className={styles.header}>
            <div><Link className={styles.backLink} href={catalogHref}><ArrowLeft size={13} /> Back to bottles</Link>
                <h1>Build Your Bottle</h1><p>Start with a bottle. Add your color and a compatible fitment.</p></div>
            <nav aria-label="Bottle building progress" className={styles.steps}>
                {steps.map((label, index) => <button key={label} aria-current={step === index ? "step" : undefined}
                    disabled={adding || pending || (index === 1 && !body) || (index === 2 && !color) || (index === 3 && !configuration)}
                    onClick={() => goTo(index)} className={step === index ? styles.activeStep : completed[index] ? styles.completeStep : ""}>
                    <span>{completed[index] ? <Check size={15} weight="bold" /> : index + 1}</span><b>{label}</b>
                </button>)}
            </nav>
        </header>
        {lastAdded && <div ref={confirmation} className={styles.addedNotice} role="status" tabIndex={-1}>
            <CheckCircle size={25} weight="light" />
            <div><h2>Your bottle has been added to cart.</h2><p>{lastAdded.quantity} × {lastAdded.name}</p><p>Ready for another? Choose a bottle below to start a new build.</p></div>
            <div className={styles.addedActions}><button className={styles.secondary} onClick={() => goTo(0)}>Build Another Bottle</button>
                <Link href="/cart" className={styles.primary}>Go to Checkout <ArrowRight size={16} /></Link>
                <Link href={catalogHref} className={styles.textButton}>Continue Shopping</Link></div>
        </div>}
        <div className={styles.filters}>
            <label>Bottle family<select aria-label="Bottle family" value={openFamily} disabled={adding || pending} onChange={e => {
                const family = e.target.value;
                reset();
                startTransition(() => router.push(`/matrix?family=${encodeURIComponent(family)}`));
            }}>{families.map(f => <option key={f.family}>{f.family}</option>)}</select></label>
            <label>Size<select aria-label="Size" value={size} disabled={adding || pending} onChange={e => { setSize(e.target.value); goTo(0); }}>
                <option value="">All sizes</option>{sizes.map(size => <option value={size} key={size}>{size} ml</option>)}</select></label>
            <button className={styles.filterToggle} aria-expanded={moreFilters} onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal size={17} /> More filters{neck || application ? " •" : ""}</button>
            {moreFilters && <><label>Neck size<select aria-label="Neck size" value={neck} onChange={e => { setNeck(e.target.value); goTo(0); }}><option value="">All neck sizes</option>{necks.map(n => <option key={n}>{n}</option>)}</select></label>
                <label>Application<select aria-label="Application" value={application} onChange={e => { setApplication(e.target.value); goTo(0); }}><option value="">All fitments</option>{applications.map(a => <option key={a}>{a}</option>)}</select></label></>}
            {(size || neck || application) && <button className={styles.textButton} onClick={() => { setSize(""); setNeck(""); setApplication(""); }}>Clear filters</button>}
            <span className={styles.filterNote}><ShieldCheck size={18} /> Compatible choices, at every step.</span>
        </div>
        <div className={styles.workspace} id="builder-workspace">
            <section className={styles.options} aria-label="Bottle options">
                <div className={styles.optionHeader}><span className={styles.eyebrow}>Step {step + 1} of 4</span>
                    <h2 tabIndex={-1} ref={optionHeading}>{titles[step]}</h2><p>{subtitles[step]}</p></div>
                <fieldset disabled={adding || pending} className={styles.optionFieldset}>
                {step === 0 && <div className={styles.bottleGrid}>
                    {visibleBodies.map(b => <Option key={b.id} label={`${b.capacityMl} ml, ${b.neck} neck`} selected={body?.id === b.id} onClick={() => chooseBottle(b)}>
                        <div className={styles.bottleThumb}><BuilderImage config={b.configurations[0]} parts={previewParts(b.configurations[0], "body")} label={`${b.capacityMl} ml bare ${b.family} bottle`} scale={chooserScale(b)} /></div>
                        <strong>{b.capacityMl} ml</strong><small>{b.neck} neck</small>
                    </Option>)}
                </div>}
                {step === 0 && !visibleBodies.length && <div className={styles.empty}><h3>No bottles for these choices.</h3><p>Try another size or bottle family.</p><button className={styles.secondary} onClick={() => { setSize(""); setNeck(""); setApplication(""); }}>Clear filters</button><Link href={catalogHref}>Explore the full catalog <ArrowRight size={15} /></Link></div>}
                {step === 1 && <><div className={styles.colorGrid}>
                    {current.colors.map(c => { const example = body!.configurations.find(config => config.color === c)!; return <Option key={c} label={c} selected={color === c} onClick={() => update({ color: c })}>
                        <div className={styles.colorThumb}><BuilderImage config={example} parts={previewParts(example, "body")} label={`${c} bottle`} /></div><strong>{c}</strong>
                    </Option>; })}
                </div><div className={styles.nextStepHint} role="status">{fitmentReady && <><CheckCircle size={17} /><span>Your bottle is ready. Select <strong>Choose Fitment</strong> to continue.</span></>}</div></>}
                {step === 2 && <>
                    <div className={styles.fitmentGrid}>{current.fitments.map(f => {
                        const example = current.colored.find(config => config.fitment === f)!;
                        const parts = example.kit.parts.filter(p => f === "Screw Cap" ? isClosurePart(p) : p.slot !== "body" && !isClosurePart(p) && p.slot !== "diptube");
                        return <Option key={f} label={f} selected={fitment === f} onClick={() => update({ fitment: f })}>
                            <div className={styles.componentThumb}><BuilderImage config={example} parts={parts} label={f} thumbnail /></div><strong>{f}</strong>
                        </Option>;
                    })}</div>
                    {fitment && <div className={styles.closureSection}><h3>{fitment === "Screw Cap" ? "Choose your cap" : /Roller|Reducer/.test(fitment) ? "Finish with a cap" : "Choose your finish"}</h3>
                        <p>{current.closures.length === 1 ? "This finish is included with your bottle." : "Only finishes available with your fitment."}</p>
                        <div className={styles.closureGrid}>{current.fitted.map(c => <Option key={c.id} label={c.closure} selected={closure === c.closure} onClick={() => update({ closure: c.closure })}>
                            <div className={styles.closureThumb}><BuilderImage config={c} parts={c.kit.parts.filter(p => p.slot !== "body" && p.slot !== "diptube")} label={c.closure} thumbnail /></div><strong>{c.closure}</strong>
                        </Option>)}</div>
                    </div>}
                </>}
                {step === 3 && <div className={styles.review}>
                    <ShieldCheck size={30} weight="light" /><h3>Everything fits.</h3><p>Your bottle, {fitment?.toLowerCase()}, and selected finish are included in one complete combination.</p>
                            <dl><div><dt>Bottle</dt><dd>{body?.capacityMl} ml {body?.family}</dd></div><div><dt>Glass</dt><dd>{color}</dd></div><div><dt>Fitment</dt><dd>{fitment}</dd></div><div><dt>Finish</dt><dd>{closure}</dd></div><div><dt>Neck</dt><dd>{body?.neck}</dd></div></dl>
                            <p className={styles.small}>Set your quantity in Your Build. We’ll check current availability before adding.</p>
                </div>}
                </fieldset>
                {step > 0 && <button className={styles.previous} onClick={() => goTo(step - 1)} disabled={adding}><ArrowLeft size={15} /> {steps[step - 1]}</button>}
            </section>
            <section className={styles.preview} aria-label="Live bottle preview" data-preview-stage={previewStage}>
                <div className={styles.previewHeader}><span>YOUR BOTTLE, TAKING SHAPE</span><span className={styles.liveDot}>Live preview</span></div>
                {preview ? <div className={styles.previewImage}><BuilderImage config={preview} parts={previewParts(preview, previewStage)}
                    label={body ? `${preview.capacityMl} ml ${preview.color} ${preview.family}${fitment ? ` with ${fitment}` : " bottle body"}${closure ? `, ${closure}` : ""}` : "Bottle body preview — choose a bottle to begin"} /></div>
                    : <div className={styles.previewEmpty}><ShoppingBag size={32} weight="light" /><p>Your bottle starts here.</p></div>}
                <div className={styles.previewCaption} aria-live="polite">{body ? <><h2>{body.capacityMl} ml {body.family}</h2><p>{color ?? "Choose your glass color"}{fitment ? ` · ${fitment}` : ""}</p></> : <><h2>A bottle. Your possibilities.</h2><p>Choose a bottle to start building.</p></>}</div>
            </section>
            <aside className={styles.summary} aria-label="Your Build">
                <div className={styles.summaryHeading}><h2>Your Build</h2><button onClick={reset} className={styles.textButton} disabled={adding || pending}>Clear all</button></div>
                <SummaryLine number={1} label="Bottle" value={body ? `${body.capacityMl} ml ${body.family}` : null} detail={body ? `${body.neck} neck` : "Start with a bottle shape"} onEdit={() => goTo(0)} />
                <SummaryLine number={2} label="Color" value={color} detail="Choose your glass finish" onEdit={() => goTo(1)} />
                <SummaryLine number={3} label="Fitment" value={fitment} detail="Made to fit your bottle" onEdit={() => goTo(2)} />
                {fitment && <SummaryLine number={null} label={/Roller|Reducer|Cap/.test(fitment) ? "Closure" : "Finish"} value={closure} detail="Complete your selection" onEdit={() => goTo(2)} />}
                <div className={styles.purchase}>
                    <div className={styles.quantityRow}><label htmlFor="builder-quantity">Quantity</label><div className={styles.quantity}>
                        <button aria-label="Decrease quantity" disabled={adding || !body || selection.quantity <= 1} onClick={() => update({ quantity: Math.max(1, selection.quantity - 1) })}><Minus size={14} /></button>
                        <input id="builder-quantity" type="number" inputMode="numeric" min="1" max={MAX_QUANTITY} step="1" value={Number.isNaN(selection.quantity) ? "" : selection.quantity}
                            disabled={adding || !body} aria-describedby="builder-minimum" onChange={e => update({ quantity: e.target.value === "" ? NaN : Number(e.target.value) })} />
                        <button aria-label="Increase quantity" disabled={adding || !body || selection.quantity >= MAX_QUANTITY} onClick={() => update({ quantity: Math.min(MAX_QUANTITY, (Number.isFinite(selection.quantity) ? selection.quantity : 0) + 1) })}><Plus size={14} /></button>
                    </div></div>
                    {configuration?.caseQuantity && <p className={styles.case}>Case pack: {configuration.caseQuantity.toLocaleString("en-US")} units <button disabled={adding} onClick={() => update({ quantity: configuration.caseQuantity! })}>Use case quantity</button></p>}
                    <div id="builder-minimum" className={styles.minimum} aria-live="polite">{!order.validQuantity ? "Enter a whole-number quantity of at least 1."
                        : configuration && order.remainingUnits && order.remainingUnits > 0 ? <><strong>{order.remainingUnits} more {order.remainingUnits === 1 ? "unit" : "units"} required to meet minimum</strong><button disabled={adding} onClick={() => update({ quantity: order.minimumQuantity! })}>Set quantity to {order.minimumQuantity}</button></>
                        : configuration && order.canAdd ? <span><Check size={13} /> {money(ORDER_MINIMUM)} order minimum met</span> : `${money(ORDER_MINIMUM)} minimum per order.`}
                        {order.cartCredit > 0 && <small>{money(order.cartCredit)} already in your cart counts toward the minimum.</small>}
                    </div>
                    <dl className={styles.totals}><div><dt>Unit price</dt><dd>{money(order.unitPrice)}</dd></div><div><dt>Total{order.validQuantity && configuration ? ` (${selection.quantity} units)` : ""}</dt><dd>{money(order.total)}</dd></div></dl>
                    {error && <p className={styles.error} role="alert">{error}</p>}
                    <div className={styles.desktopAction}>{action}</div>

                    <p className={styles.assurance}><ShieldCheck size={20} /><span>Made to work together.<small>Only compatible combinations are shown.</small></span></p>
                </div>
            </aside>
        </div>
        <div className={styles.mobileAction}><div><span>{`Step ${step + 1} of 4`}</span><strong>{configuration ? money(order.total) : steps[step]}</strong>{step === 3 && !!order.remainingUnits && <span>{order.remainingUnits} more units needed</span>}</div>{action}</div>
        <p className={styles.bottomNote}>Same bottles. More possibilities.</p>
    </div>;
}

function Option({ children, selected, onClick, label }: { children: ReactNode; selected: boolean; onClick: () => void; label: string }) {
    return <button type="button" className={`${styles.option} ${selected ? styles.selected : ""}`} aria-label={label} aria-pressed={selected} onClick={onClick}>
        {selected && <span className={styles.selectionCheck}><Check size={12} weight="bold" /></span>}{children}
    </button>;
}
function SummaryLine({ number, label, value, detail, onEdit }: { number: number | null; label: string; value: string | null; detail: string; onEdit: () => void }) {
    return <div className={`${styles.summaryLine} ${value ? styles.summaryComplete : ""}`}><span className={number == null ? styles.summarySubstep : styles.summaryNumber}>{number != null ? value ? <Check size={13} /> : number : ""}</span>
        <div><span className={styles.summaryLabel}>{label}</span><strong>{value ?? detail}</strong>{value && label === "Bottle" && <small>{detail}</small>}</div>{value && <button aria-label={`Edit ${label.toLowerCase()}`} onClick={onEdit}>Edit</button>}</div>;
}
