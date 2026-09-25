"use client";

import { useRegion } from "@/components/RegionProvider";

import { capLinerNote, fitmentChoiceHints, fitmentContents } from "@/lib/bottle-builder/fitment-copy";
import { useEffect, useId, useMemo, useRef, useState, useTransition, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle, Minus, Plus, ShieldCheck, SlidersHorizontal, ShoppingBag } from "@/components/icons";
import { useCart } from "@/components/CartProvider";
import { useBuilderFamilies } from "@/components/bottle-builder/useBuilderFamilies";
import { useBuilderKits } from "@/components/bottle-builder/useBuilderKits";
import { useBuilderBodyConfigurations } from "@/components/bottle-builder/useBuilderBodyConfigurations";
import FamilyLoadingStatus from "@/components/bottle-builder/FamilyLoadingStatus";
import bodyHeightMedia from "@/lib/bottle-builder/body-heights.generated.json";
import MobileBuilder from "@/components/bottle-builder/MobileBuilder";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import FitmentIllustration from "@/components/bottle-builder/FitmentIllustration";
import BuilderFinishImage from "@/components/bottle-builder/BuilderFinishImage";
import { checkoutMinimum, checkoutMinimumMessage } from "@/lib/checkout";
import { analytics } from "@/lib/analytics";
import { displayApplicatorName } from "@/lib/catalogFilters";
import {
    borrowedFitmentPreview, builderOrder, builderPriceRange, deriveBuilder, emptySelection, previewParts, reconcileSelection, selectBuilderBody,
    MAX_QUANTITY, ORDER_MINIMUM, type BuilderBody, type BuilderConfiguration, type BuilderSelection, bareGlassPreview, clearBodyPreview,
} from "@/lib/bottle-builder/model";
import hasIncludedCovers from "@/lib/bottle-builder/exposed-sprayers.generated.json";
import { CHOOSER_PRIORITY_TILES } from "@/lib/bottle-builder/mobile-request";
import { displayImageUrl } from "@/lib/products/optimizable-image";
import styles from "@/components/bottle-builder/Builder.module.css";

const subscribeMobile = (callback: () => void) => { const query = window.matchMedia("(max-width: 1099px)"); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
const mobileSnapshot = () => window.matchMedia("(max-width: 1099px)").matches;
const serverMobileSnapshot = (preferMobile: boolean) => () => preferMobile;
// The same five stages as MobileBuilder, so one step index drives both layouts.
// Glass is its own step: on a laptop the colour swatches used to sit below the
// bottle grid inside a clipped scroll region and never came into view (2026-09-24 audit).
const steps = ["Bottle", "Glass", "Fitment", "Finish", "Review"];
const fitmentDescriptions: Record<string, string> = {
    "Screw Cap": "Close and reopen your bottle.",
    "Reducer": "Control the flow through a small opening.",
    "Metal Roller": "Apply with a metal roller ball.",
    "Plastic Roller": "Apply with a plastic roller ball.",
    "Fine Mist Sprayer": "Dispense a fine spray.",
    "Perfume Sprayer": "Spray your fragrance.",
    "Lotion Pump": "Dispense with a press of the pump.",
    "Vintage Bulb Sprayer": "Spray by squeezing the bulb.",
    "Vintage Bulb Sprayer with Tassel": "A squeeze-bulb spray with a decorative tassel.",
};

// Chooser tiles keep the family's physical proportions: each body is shown at
// its measured glass height relative to the tallest body on offer (canonical
// body-geometry audit, 2026-07-12), floored so the smallest stays legible.
// Cylinder keeps its hand-tuned cues for the two 9 ml necks the audit merges.
const bodyHeights = (bodyHeightMedia as { heights: Record<string, { bodyHeightMm: number }> }).heights;
export function bodyHeightMm(body: Pick<BuilderBody, "family" | "capacityMl">) {
    return bodyHeights[`${body.family}|${body.capacityMl}`]?.bodyHeightMm ?? null;
}
function physicalChooserScale(body: BuilderBody, all: BuilderBody[]) {
    const mine = bodyHeightMm(body);
    const tallest = Math.max(...all.map(b => bodyHeightMm(b) ?? 0));
    if (!mine || !tallest) return null;
    return Math.max(.48, mine / tallest);
}
function chooserScale(body: BuilderBody, all: BuilderBody[] = [body]) {
    if (body.family !== "Cylinder") return physicalChooserScale(body, all) ?? 1;
    if (body.capacityMl <= 5) return .52;
    if (body.capacityMl === 9 && body.neck === "13-415") return .84;
    if (body.capacityMl === 9 && body.neck === "17-415") return .68;
    if (body.capacityMl === 25) return .9;
    if (body.capacityMl === 50) return 1.06;
    if (body.capacityMl === 100) return 1.24;
    return 1;
}

export default function MatrixClient({ families: initialFamilies, openFamily, bodies: initialBodies, preferMobile = false }: {
    families: { family: string; groups: number }[];
    openFamily: string;
    bodies: BuilderBody[];
    preferMobile?: boolean;
}) {
    const { formatPrice } = useRegion();
    const money = (value: number | null) => (value == null ? "—" : formatPrice(value));
    const { families, status: familyStatus, retry: retryFamilies } = useBuilderFamilies(initialFamilies);
    const familyNotice = <FamilyLoadingStatus status={familyStatus} onRetry={retryFamilies} />;
    const router = useRouter();
    const searchParams = useSearchParams();
    const { items, addItems, isCartHydrated } = useCart();
    const [selection, setSelection] = useState<BuilderSelection>(emptySelection);
    // First paint is chooser-only; the chosen bottle's configurations load, then its kit layers.
    const chooser = useBuilderBodyConfigurations(openFamily, initialBodies, selection.bodyId, searchParams.get("shop"));
    const bodies = useBuilderKits(openFamily, chooser.bodies, selection.bodyId);
    const [step, setStep] = useState(0);
    const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, serverMobileSnapshot(preferMobile));
    const [previewExpanded, setPreviewExpanded] = useState(false);
    const reviewHeading = useRef<HTMLHeadingElement>(null);
    const previewId = useId();
    const [showCover, setShowCover] = useState(false);
    const [size, setSize] = useState("");
    const [neck, setNeck] = useState("");
    const [application, setApplication] = useState("");
    const [moreFilters, setMoreFilters] = useState(false);
    const [pending, startTransition] = useTransition();
    // The family select is controlled by the server-rendered family; while the
    // next family loads it must show the family the customer just chose.
    const [chosenFamily, setChosenFamily] = useState(openFamily);
    const [adding, setAdding] = useState(false);
    const [lastAdded, setLastAdded] = useState<{ name: string; quantity: number; total?: number | null; lines?: string[] } | null>(null);
    const confirmation = useRef<HTMLDivElement>(null);
    const [error, setError] = useState("");
    const optionHeading = useRef<HTMLHeadingElement>(null);
    const optionsScroller = useRef<HTMLFieldSetElement>(null);
    const builderRoot = useRef<HTMLDivElement>(null);
    const stepsBar = useRef<HTMLDivElement>(null);
    const tracked = useRef(false);
    // The site header is position: fixed and its height depends on the breakpoint; the steps bar and the
    // workspace panels stick directly under it, so they read the live heights instead of a guessed 120px.
    useEffect(() => {
        const root = builderRoot.current;
        if (!root) return;
        const header = document.querySelector<HTMLElement>("header[class~='fixed']");
        const apply = () => {
            root.style.setProperty("--site-header-h", `${Math.round(header?.getBoundingClientRect().height ?? 0)}px`);
            root.style.setProperty("--steps-h", `${Math.round(stepsBar.current?.getBoundingClientRect().height ?? 0)}px`);
        };
        apply();
        if (typeof ResizeObserver !== "function") return;
        const observer = new ResizeObserver(apply);
        if (header) observer.observe(header);
        if (stepsBar.current) observer.observe(stepsBar.current);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (tracked.current) return;
        tracked.current = true;
        const from = searchParams.get("from");
        const source = from === "finder" || from === "pdp" || from === "grace" ? from : "nav";
        analytics.matrixOpened({ source, family: openFamily });
    }, [searchParams, openFamily]);

    const current = deriveBuilder(bodies, selection);
    const { body, color, fitment, closure, configuration } = current;
    const cartProgress = checkoutMinimum(items);
    const order = builderOrder(configuration, selection.quantity, items);
    // A price from the first click: the narrowest set of configurations the
    // current selection can still become, priced like the cart would price them.
    const priceRange = (configs: BuilderConfiguration[]) => builderPriceRange(configs, selection.quantity, items);
    const priceFrom = (configs: BuilderConfiguration[]) => {
        const range = priceRange(configs);
        return range ? (range.min === range.max ? `${money(range.min)} each` : `from ${money(range.min)}`) : null;
    };
    const possible = configuration ? [configuration] : fitment ? current.fitted : color ? current.colored : body?.configurations ?? [];
    // Chooser-only bodies carry the server's precomputed minimums until their configurations arrive.
    const fromLabel = (min: number | null | undefined) => min == null ? null : `from ${money(min)}`;
    const bodyFrom = (b: BuilderBody) => b.chooserOnly ? fromLabel(b.priceFrom) : priceFrom(b.configurations);
    const colorFrom = (b: BuilderBody, c: string) => b.chooserOnly ? fromLabel(b.colorPriceFrom?.[c]) : priceFrom(b.configurations.filter(config => config.color === c));
    const possibleFrom = body?.chooserOnly ? (color ? fromLabel(body.colorPriceFrom?.[color]) : fromLabel(body.priceFrom)) : priceFrom(possible);
    const buildCents = Math.round((order.total ?? 0) * 100);
    const cartCents = Math.round(cartProgress.subtotal * 100);
    const minimumCents = ORDER_MINIMUM * 100;
    const minimumPct = Math.min(100, Math.round((cartCents + buildCents) / minimumCents * 100));
    const minimumNote = order.total == null ? `${money(ORDER_MINIMUM)} minimum per cart at checkout.`
        : cartCents + buildCents >= minimumCents ? `This build${cartCents ? " and your cart" : ""} meet${cartCents ? "" : "s"} the ${money(ORDER_MINIMUM)} order minimum.`
        : `${money((minimumCents - cartCents - buildCents) / 100)} more reaches the ${money(ORDER_MINIMUM)} order minimum${cartCents ? ` (cart ${money(cartProgress.subtotal)} + this build ${money(order.total)})` : ""}.`;
    const sizes = [...new Set(bodies.map(b => b.capacityMl))].sort((a, b) => a - b);
    const necks = [...new Set(bodies.map(b => b.neck))].sort();
    const bodyFitments = (b: BuilderBody) => b.fitments ?? b.configurations.map(c => c.fitment);
    const applications = [...new Set(bodies.flatMap(bodyFitments))].sort();
    const visibleBodies = useMemo(() => bodies.filter(b => (!size || b.capacityMl === Number(size))
        && (!neck || b.neck === neck) && (!application || bodyFitments(b).includes(application))), [bodies, size, neck, application]);
    const preview = configuration ?? current.fitted[0] ?? current.colored[0] ?? body?.configurations[0];
    // one fixed body per bottle and glass: the first full kit (vintage first, its body is the reference for the bulb sprayers)
    // reducer photographs carry the insert inside the neck, so a reducer body is the last choice of reference
    const bodyReference = current.colored.find(c => c.fitment === "Vintage Bulb Sprayer" && c.kit?.completeness === "full")
        ?? current.colored.find(c => c.kit?.completeness === "full" && c.fitment !== "Reducer") ?? current.colored.find(c => c.kit?.completeness === "full")
        ?? current.colored[0] ?? body?.configurations[0];
    const hasIncludedCover = Boolean(configuration && /Sprayer|Pump/.test(configuration.fitment)
        && ((configuration.id in hasIncludedCovers) || (configuration.kit?.parts.some(p => p.slot === "overcap")
        && configuration.kit?.parts.some(p => !["body", "overcap", "diptube"].includes(p.slot)))));
    const previewStage = step <= 1 ? "body" : configuration ? "complete" : fitment ? "fitment" : "body";
    // the overcap is never dropped from the preview: worn when showCover, standing on the ground beside the bottle otherwise (BuilderImage)
    // A fitment with no layered kit yet (every 5 ml cobalt plastic roller, for one) has nothing to draw at
    // the fitment stage. Seat a sibling glass's mechanism on this glass's universal body; failing that,
    // show the universal body alone instead of "Image unavailable".
    const kitless = Boolean(preview && !preview.kit && previewStage === "fitment");
    const borrowed = kitless ? borrowedFitmentPreview(body, color, fitment, bodyReference) : null;
    const previewConfig = borrowed ?? (kitless && bodyReference?.kit ? bodyReference : preview);
    const displayStage = borrowed || previewConfig === preview ? previewStage : "body";
    const displayParts = previewConfig ? previewParts(previewConfig, displayStage) : [];
    // One glass only: the colour is taken as read and the Glass step is passed
    // over in either direction, exactly as MobileBuilder does.
    const skipGlass = Boolean(body) && current.colors.length === 1;
    const completed = [Boolean(body), Boolean(color), Boolean(fitment), Boolean(configuration), false];
    const canContinue = step === 0 ? Boolean(body) : step === 1 ? Boolean(color) : step === 2 ? Boolean(fitment) : Boolean(configuration);
    const fitmentReady = step === 0 && canContinue && !pending;
    // Glass needs only the colours first paint already carries; Fitment needs the full body.
    const awaitingBody = chooser.loading && (step === 1 || (step === 0 && skipGlass));
    const bodyNotice = chooser.failed ? <div className={styles.familyPending} role="status">We couldn’t load this bottle’s options. <button type="button" className={styles.textButton} onClick={chooser.retry}>Try again</button></div> : null;
    const catalogHref = `/catalog?families=${encodeURIComponent(openFamily)}`;
    const choosingFinish = step === 3;
    const unavailableFinishes = body?.unavailableFinishes?.filter(option => option.color === color && option.fitment === fitment) ?? [];
    const finishLabel = /Roller/.test(fitment ?? "") ? "Roller cap"
        : /Cap|Reducer/.test(fitment ?? "") ? "Cap finish"
        : /Sprayer/.test(fitment ?? "") ? "Sprayer finish"
        : /Pump/.test(fitment ?? "") ? "Pump finish" : "Component finish";
    const finishTitle = /Roller/.test(fitment ?? "") ? "Select your cap" : `Choose your ${finishLabel.toLowerCase()}`;
    const titles = ["Choose your bottle", "Choose your glass color", "Choose your fitment", finishTitle, "Review your bottle"];
    const subtitles = [
        `${visibleBodies.length} bottle ${visibleBodies.length === 1 ? "option" : "options"} · small to large`,
        `${current.colors.length} glass ${current.colors.length === 1 ? "option" : "options"} for this bottle.`,
        "Choose how your bottle dispenses or closes.",
        fitment === "Screw Cap" && body?.family === "Cylinder" && body.capacityMl === 5 && body.neck === "13-415"
            ? "Black and white short caps are ribbed. The other six short caps and the gold and silver tall caps have liners."
            : `Choose the look of your ${/Roller/.test(fitment ?? "") ? "roller cap" : (fitment ? displayApplicatorName(fitment).toLowerCase() : "component")}. Every option shown fits your selection.`,
        "Check your bottle, finish, and quantity before adding.",
    ];
    function goTo(target: number) {
        if (adding) return;
        const next = skipGlass && target === 1 ? (step < 1 ? 2 : 0) : target;
        setStep(next); setPreviewExpanded(false); setLastAdded(null); setError("");
        requestAnimationFrame(() => {
            if (optionsScroller.current) optionsScroller.current.scrollTop = 0;
            const heading = next === 4 && window.matchMedia("(max-width: 639px)").matches ? reviewHeading.current : optionHeading.current;
            heading?.focus({ preventScroll: true });
            document.getElementById("builder-workspace")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
        });
    }
    function update(patch: Partial<BuilderSelection>) {
        setSelection(state => reconcileSelection(bodies, { ...state, ...patch }));
        setLastAdded(null); setError("");
    }
    function reset() {
        setSelection(emptySelection()); setShowCover(false); setLastAdded(null); setError(""); setSize(""); setNeck(""); setApplication(""); setMoreFilters(false); setPreviewExpanded(false); goTo(0);
    }
    function chooseBottle(selected: BuilderBody) {
        const next = selectBuilderBody(bodies, selection, selected.id);
        setShowCover(false);
        setSelection(next); setLastAdded(null); setError("");
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
            if (!freshOrder.canAdd) throw new Error("This build is no longer available. Refresh the builder and try again.");
            if (freshOrder.unitPrice !== order.unitPrice) throw new Error("The price has changed. Refresh the builder before adding this bottle.");
            addItems([{ ...fresh.product, quantity: selection.quantity, unitPrice: freshOrder.unitPrice }]);
            setLastAdded({
                name: fresh.product.itemName,
                quantity: selection.quantity,
                total: freshOrder.total,
                lines: [`${fresh.capacityMl} ml ${fresh.profileLabel}`, fresh.color, displayApplicatorName(fresh.fitment), fresh.closure],
            });
            // Desktop recycles into a fresh chooser. Mobile keeps this build
            // on screen so the confirmation is not mistaken for a reset.
            if (!isMobile) {
                setSelection(emptySelection()); setShowCover(false); setSize(""); setNeck(""); setApplication(""); setMoreFilters(false); setStep(0);
            }
            requestAnimationFrame(() => {
                confirmation.current?.focus({ preventScroll: true });
                confirmation.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
            });
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add this bottle. Please try again."); }
        finally { setAdding(false); }
    }
    function continueBuild() { goTo(Math.min(4, step + 1)); }

    const nextActionLabel = step === 0 ? (skipGlass ? "Choose Your Fitment" : "Choose Your Glass")
        : step === 1 ? "Choose Your Fitment"
        : step === 2 ? /Roller|Cap|Reducer/.test(fitment ?? "") ? "Choose Your Caps"
            : fitment ? `Choose Your ${finishLabel.replace(/\b\w/g, letter => letter.toUpperCase())}` : "Choose Your Finish"
        : "Review Your Bottle";
    const action = step < 4 ? <button key={`${step}-${body?.id}-${step <= 1 ? color : step === 2 ? fitment : closure}`} className={`${styles.primary} ${canContinue && !pending && !awaitingBody ? styles.nextStepCue : ""}`} disabled={!canContinue || pending || awaitingBody} onClick={continueBuild}>
            {awaitingBody ? "Loading compatible choices…" : nextActionLabel} <ArrowRight size={17} />
        </button> : <button className={styles.primary} disabled={!order.canAdd || adding || !isCartHydrated} onClick={addToCart}>
            {adding ? "Checking your bottle…" : "Add to Cart"} {!adding && <ShoppingBag size={17} />}
        </button>;

    if (isMobile) return <MobileBuilder familyNotice={familyNotice} families={families} family={openFamily} bodies={bodies}
        selection={selection} current={current} order={order} stage={step} onStage={next => { setStep(next); setError(""); }} priceRange={priceRange}
        onUpdate={patch => { update(patch); if (patch.bodyId || patch.color || patch.fitment) setShowCover(false); }} onReset={reset} onFamily={family => { reset(); startTransition(() => router.push(`/matrix?family=${encodeURIComponent(family)}${searchParams.get("shop") ? `&shop=${encodeURIComponent(searchParams.get("shop")!)}` : ""}`)); }} onAdd={addToCart}
        size={size} neck={neck} application={application} onFilter={(filter, value) => { if (filter === "size") setSize(value); else if (filter === "neck") setNeck(value); else setApplication(value); }}
        pending={pending || awaitingBody} bodyNotice={bodyNotice} adding={adding} hydrated={isCartHydrated} error={error} lastAdded={lastAdded} cartProgress={cartProgress}
        hasIncludedCover={hasIncludedCover} showCover={showCover} onCover={() => setShowCover(value => !value)} chooserScale={b => chooserScale(b, bodies)} />;

    return <div ref={builderRoot} className={styles.builder} data-bottle-builder data-current-step={step} data-has-bottle={Boolean(body)} aria-busy={pending || adding}>
        <header className={styles.header}>
            <div><div className={styles.headerLinks}><Link className={styles.backLink} href={catalogHref}><ArrowLeft size={13} /> Back to bottles</Link><Link className={styles.mobileCartLink} href="/cart">View cart{isCartHydrated && items.length > 0 ? ` (${items.reduce((sum, item) => sum + item.quantity, 0)})` : ""}</Link></div>
                <h1>Build Your Bottle</h1><p>Choose your bottle and glass, then how it dispenses or closes and the finish you like.</p></div>
        </header>
        {/* Sticky on desktop: the nodes light up and the connectors fill as each step completes, in view at every step. */}
        <div ref={stepsBar} className={styles.stepsBar}>
            <nav aria-label="Bottle building progress" className={styles.steps}>
                {steps.map((label, index) => <button key={label} aria-current={step === index ? "step" : undefined}
                    disabled={adding || pending || (index === 1 && (!body || skipGlass)) || (index === 2 && !color) || (index === 3 && !fitment) || (index === 4 && !configuration)}
                    onClick={() => goTo(index)} className={step === index ? styles.activeStep : completed[index] ? styles.completeStep : ""}>
                    <span>{completed[index] ? <Check size={15} weight="bold" /> : index + 1}</span><b>{label}</b>
                </button>)}
            </nav>
        </div>
        {lastAdded && <div ref={confirmation} className={styles.addedNotice} role="status" tabIndex={-1}>
            <CheckCircle size={25} weight="light" />
            <div><h2>Your bottle has been added to cart.</h2><p>{lastAdded.quantity} × {lastAdded.name}</p><p>{checkoutMinimumMessage(cartProgress)}</p><p>Ready for another? Choose a bottle below to start a new build.</p></div>
            <div className={styles.addedActions}><button className={styles.primary} onClick={() => goTo(0)}>Build Another Bottle</button>
                <Link href="/cart" className={styles.secondary}>View Cart <ArrowRight size={16} /></Link>
</div>
        </div>}
        {step === 0 && familyNotice}
        {step === 0 && <div className={styles.filters}>
            <label>Bottle family<select aria-label="Bottle family" value={chosenFamily} disabled={adding} onChange={e => {
                const family = e.target.value;
                setChosenFamily(family);
                reset();
                startTransition(() => router.push(`/matrix?family=${encodeURIComponent(family)}${searchParams.get("shop") ? `&shop=${encodeURIComponent(searchParams.get("shop")!)}` : ""}`));
            }}>{families.map(f => <option key={f.family}>{f.family}</option>)}</select></label>
            {pending && chosenFamily !== openFamily && <p role="status" className={styles.familyPending}>Loading {chosenFamily} bottles…</p>}
            <label>Size<select aria-label="Size" value={size} disabled={adding || pending} onChange={e => { setSize(e.target.value); goTo(0); }}>
                <option value="">All sizes</option>{sizes.map(size => <option value={size} key={size}>{size} ml</option>)}</select></label>
            <button className={styles.filterToggle} aria-expanded={moreFilters} onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal size={17} /> More filters{neck || application ? " •" : ""}</button>
            {moreFilters && <><label>Neck size<select aria-label="Neck size" value={neck} onChange={e => { setNeck(e.target.value); goTo(0); }}><option value="">All neck sizes</option>{necks.map(n => <option key={n}>{n}</option>)}</select></label>
                <label>Application<select aria-label="Application" value={application} onChange={e => { setApplication(e.target.value); goTo(0); }}><option value="">All fitments</option>{applications.map(a => <option key={a} value={a}>{displayApplicatorName(a)}</option>)}</select></label></>}
            {(size || neck || application) && <button className={styles.textButton} onClick={() => { setSize(""); setNeck(""); setApplication(""); }}>Clear filters</button>}
            <span className={styles.filterNote}><ShieldCheck size={18} /> Compatible choices, at every step.</span>
        </div>}
        <div className={styles.workspace} id="builder-workspace">
            <section className={styles.options} aria-label="Bottle options">
                <div className={styles.optionHeader}><div className={styles.optionToolbar}><span className={styles.eyebrow}>Step {step + 1} of 5</span><button type="button" className={styles.startOver} onClick={reset} disabled={adding}>Start over</button></div>
                    <h2 tabIndex={-1} ref={optionHeading}>{titles[step]}</h2><p>{subtitles[step]}</p></div>
                {bodyNotice}
                <fieldset ref={optionsScroller} aria-label={titles[step]} disabled={adding || pending} className={styles.optionFieldset}>
                {step === 0 && <div className={styles.bottleGrid}>
                    {visibleBodies.map((b, index) => <Option key={b.id} label={`${b.capacityMl} ml, ${b.neck} neck${b.profileLabel !== b.family ? `, ${b.profileLabel}` : ""}`} selected={body?.id === b.id} onClick={() => chooseBottle(b)}>
                        <div className={styles.bottleThumb}><BuilderImage config={clearBodyPreview(b)} parts={previewParts(clearBodyPreview(b), "body")} label={`${b.capacityMl} ml ${b.family} bottle`} scale={chooserScale(b, bodies)} thumbnail placeholder priority={index < CHOOSER_PRIORITY_TILES} /></div>
                        <strong>{b.capacityMl} ml</strong>{b.profileLabel !== b.family && <small>{b.profileLabel}</small>}{bodyFrom(b) && <small className={styles.tilePrice}>{bodyFrom(b)}</small>}<span className={styles.neckBadge}>Neck: {b.neck}</span>
                    </Option>)}
                </div>}
                {step === 0 && !visibleBodies.length && <div className={styles.empty}><h3>No bottles for these choices.</h3><p>Try another size or bottle family.</p><button className={styles.secondary} onClick={() => { setSize(""); setNeck(""); setApplication(""); }}>Clear filters</button><Link href={catalogHref}>Explore the full catalog <ArrowRight size={15} /></Link></div>}
                {step === 0 && body && <div className={styles.nextStepHint} role="status">{fitmentReady && <><CheckCircle size={17} /><span>{skipGlass ? <>{color} glass, the only glass for this bottle. Select <strong>Choose Your Fitment</strong> to continue.</> : <>Your bottle is ready. Select <strong>Choose Your Glass</strong> to continue.</>}</span></>}</div>}
                {step === 1 && body && <>
                    <div className={styles.compatibilityContext}><ShieldCheck size={18} /><span><strong>{body.capacityMl} ml {body.profileLabel}</strong><span>Neck: {body.neck} · Every glass below is this bottle</span></span></div>
                    <div className={styles.colorGrid}>
                        {current.colors.map(c => { const example = body.configurations.find(config => config.color === c)!; return <Option key={c} label={c} selected={color === c} onClick={() => update({ color: c, fitment: null, closure: null })}>
                            <div className={styles.colorThumb}><BuilderImage config={bareGlassPreview(example)} parts={previewParts(bareGlassPreview(example), "body")} label={`${c} bottle`} thumbnail placeholder /></div><strong>{c}</strong>{colorFrom(body, c) && <small className={styles.tilePrice}>{colorFrom(body, c)}</small>}
                        </Option>; })}
                    </div>
                </>}
                {(step === 2 || step === 3) && <>
                    {step === 2 && <div className={styles.compatibilityContext}><ShieldCheck size={18} /><span><strong>{body?.capacityMl} ml {body?.family} · {color}</strong><span>Neck: {body?.neck} · Compatible components below</span></span></div>}
                    {step === 2 ? <div className={styles.fitmentGrid}>{current.fitments.map(f => {
                        const availableCount = current.colored.filter(c => c.fitment === f).length;
                        const unavailableCount = body?.unavailableFinishes?.filter(c => c.color === color && c.fitment === f).length ?? 0;
                        const count = availableCount + unavailableCount;
                        return <Option key={f} label={displayApplicatorName(f)} description={fitmentChoiceHints[f] ?? fitmentDescriptions[f]} selected={fitment === f} onClick={() => { update({ fitment: f, closure: null }); setShowCover(false); }}>
                            <div className={styles.componentThumb}><FitmentIllustration fitment={f} neck={body?.neck} /></div>
                            <strong>{displayApplicatorName(f)}</strong><small>{count} {/(Roller|Cap)/.test(f) ? (count === 1 ? "cap option" : "cap options") : (count === 1 ? "finish" : "finishes")}{unavailableCount > 0 ? ` · ${availableCount} available` : ""}</small>{priceFrom(current.colored.filter(c => c.fitment === f)) && <small className={styles.tilePrice}>{priceFrom(current.colored.filter(c => c.fitment === f))}</small>}
                        </Option>;
                    })}</div> : <>
                        <div className={styles.selectedFitment}><div><strong>{displayApplicatorName(fitment ?? "")}</strong><small>{body?.neck} neck · {color} glass</small></div>
                            <button className={styles.textButton} onClick={() => goTo(2)}>Change fitment</button></div>
                        <div className={styles.closureSection}>
                            <p>{current.closures.length === 1 ? `This ${finishLabel.toLowerCase()} is included with your bottle.` : `Select your ${finishLabel.toLowerCase()} to see the complete bottle.`}</p>
                            {capLinerNote(body?.neck, fitment) && <p className={styles.linerNote}>{capLinerNote(body?.neck, fitment)}</p>}
                        <div className={styles.closureGrid}>{current.fitted.map(c => <Option key={c.id} label={c.closure} selected={closure === c.closure} onClick={() => { update({ closure: c.closure }); setShowCover(false); }}>
                                <div className={styles.closureThumb}><BuilderFinishImage config={c} /></div><strong>{c.closure}</strong>{priceFrom([c]) && <small className={styles.tilePrice}>{priceFrom([c])}</small>}
                            </Option>)}{unavailableFinishes.map(option => <button type="button" disabled key={option.id} className={`${styles.option} ${styles.unavailableOption}`} aria-label={`${option.closure} — Out of stock`}>
                                <div className={styles.closureThumb}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={displayImageUrl(option.imageUrl, 640)} alt="" loading="lazy" />
                                </div><strong>{option.closure}</strong><small>Out of stock</small>
                            </button>)}</div>
                        </div>
                        {configuration && hasIncludedCover && <div className={styles.includedCover}>
                            {configuration.kit?.parts.some(p => p.slot === "overcap") && <div className={styles.includedCoverImage}><BuilderImage config={configuration} parts={configuration.kit.parts.filter(p => p.slot === "overcap")} stage="complete" thumbnail label="Included overcap" /></div>}
                            <div><strong>Included overcap</strong><p>Comes with this {fitment?.includes("Pump") ? "pump" : "sprayer"} and cannot be selected separately.</p></div><CheckCircle size={20} />
                        </div>}
                    </>}
                </>}
                {step === 4 && <div className={styles.review}>
                    <ShieldCheck size={30} weight="light" /><h3>Everything fits.</h3><p>{fitmentContents(fitment)}</p>{hasIncludedCover && <p>Matching protective overcap included.</p>}
                            <dl><div><dt>Bottle</dt><dd>{body?.capacityMl} ml {body?.family}</dd></div><div><dt>Glass</dt><dd>{color}</dd></div><div><dt>Fitment</dt><dd>{displayApplicatorName(fitment ?? "")}</dd></div><div><dt>{finishLabel}</dt><dd>{closure}</dd></div><div><dt>Neck</dt><dd>{body?.neck}</dd></div></dl>
                            <p className={styles.small}>Set your quantity in Your Build. We’ll check current availability before adding.</p>
                </div>}
                </fieldset>
                <div className={styles.optionFooter}>
                    {step > 0 && <button className={styles.previous} onClick={() => goTo(step - 1)} disabled={adding}><ArrowLeft size={15} /> Back</button>}
                    {step < 3 && <div className={styles.optionAction}>{action}</div>}
                </div>
            </section>
            <section className={styles.preview} aria-label="Live bottle preview" data-preview-stage={previewStage} data-expanded={previewExpanded}>
                <div className={styles.previewHeader}><span>YOUR BOTTLE, TAKING SHAPE</span><span className={styles.liveDot}>{preview ? "Your bottle preview" : "Live preview"}</span></div>
                {preview && previewConfig ? <div id={previewId} className={`${styles.previewImage} ${previewStage === "complete" && !preview.kit && preview.photoUrl ? styles.plateStage : ""}`}><BuilderImage config={previewConfig} parts={displayParts} stage={displayStage} showCover={showCover} bodyReference={bodyReference} frameConfigurations={body?.configurations}
                    label={body ? `${preview.capacityMl} ml ${preview.color} ${preview.family}${fitment ? ` with ${displayApplicatorName(fitment)}` : preview.kit ? " bottle body" : " bottle"}${closure ? `, ${closure}` : ""}` : "Bottle body preview — choose a bottle to begin"} /></div>
                    : <div className={styles.previewEmpty}><ShoppingBag size={32} weight="light" /><p>Your bottle starts here.</p></div>}
                <div className={styles.previewCaption} aria-live="polite">{body ? <><h2>{body.capacityMl} ml {body.profileLabel}</h2><p>{color ?? "Choose your glass"}{fitment ? ` · ${displayApplicatorName(fitment)}` : ""}</p>{preview && !preview.kit && !borrowed && fitment && !configuration && <p>Your selected fitment is shown in the options. Choose your {finishLabel.toLowerCase()} to see the complete bottle.</p>}</> : <><h2>A bottle. Your possibilities.</h2><p>Choose a bottle to start building.</p></>}</div>
                {hasIncludedCover && <div className={styles.coverControl}><span>Matching overcap included</span><button type="button" aria-pressed={showCover} onClick={() => setShowCover(value => !value)}>{showCover ? "Hide cap" : "Show cap"}</button></div>}
                {body && <button className={styles.previewToggle} aria-expanded={previewExpanded} aria-controls={previewId} onClick={() => setPreviewExpanded(value => !value)}>{previewExpanded ? "Minimize preview" : "View larger bottle"}</button>}
            </section>
            <aside className={styles.summary} aria-label="Your Build">
                <div className={styles.summaryHeading}><h2 ref={reviewHeading} tabIndex={-1}>{step === 4 ? "Review your bottle" : "Your Build"}</h2></div>
                {step < 4 && <div className={styles.summaryNextAction}>{action}</div>}
                <SummaryLine number={1} label="Bottle" value={body ? `${body.capacityMl} ml ${body.profileLabel}` : null} detail={body ? `${body.neck} neck` : "Start with a bottle shape"} onEdit={() => goTo(0)} />
                <SummaryLine number={2} label="Glass" value={color} detail="Choose your glass" onEdit={() => goTo(1)} />
                <SummaryLine number={3} label="Fitment" value={fitment ? displayApplicatorName(fitment) : null} detail="Made to fit your bottle" onEdit={() => goTo(2)} />
                {fitment && <SummaryLine number={4} label={finishLabel} value={closure} detail={finishTitle} onEdit={() => goTo(3)} />}
                <div className={styles.purchase}>
                    {step === 4 ? <>
                    <div className={styles.quantityRow}><label htmlFor="builder-quantity">Quantity</label><div className={styles.quantity}>
                        <button aria-label="Decrease quantity" disabled={adding || !body || selection.quantity <= 1} onClick={() => update({ quantity: Math.max(1, selection.quantity - 1) })}><Minus size={14} /></button>
                        <input id="builder-quantity" type="number" inputMode="numeric" min="1" max={MAX_QUANTITY} step="1" value={Number.isNaN(selection.quantity) ? "" : selection.quantity}
                            disabled={adding || !body} aria-invalid={!order.validQuantity} aria-describedby="builder-minimum" onChange={e => update({ quantity: e.target.value === "" ? NaN : Number(e.target.value) })} />
                        <button aria-label="Increase quantity" disabled={adding || !body || selection.quantity >= MAX_QUANTITY} onClick={() => update({ quantity: Math.min(MAX_QUANTITY, (Number.isFinite(selection.quantity) ? selection.quantity : 0) + 1) })}><Plus size={14} /></button>
                    </div></div>
                    {configuration?.caseQuantity && <p className={styles.case}>Case pack: {configuration.caseQuantity.toLocaleString("en-US")} units <button disabled={adding} onClick={() => update({ quantity: configuration.caseQuantity! })}>Use case quantity</button></p>}
                    <div id="builder-minimum" className={styles.minimum} aria-live="polite">
                        {!order.validQuantity ? "Enter a whole-number quantity of at least 1." : minimumNote}
                        {order.validQuantity && <div className={styles.meter} aria-hidden="true"><i style={{ width: `${minimumPct}%` }} /></div>}
                    </div>
                    <dl className={styles.totals}><div><dt>Unit price</dt><dd>{money(order.unitPrice)}</dd></div><div><dt>Total{order.validQuantity && configuration ? ` (${selection.quantity} units)` : ""}</dt><dd>{money(order.total)}</dd></div></dl>
                    {error && <p className={styles.error} role="alert">{error}</p>}
                    <div className={styles.desktopAction}>{action}</div>
                    <button className={styles.mobileReviewBack} disabled={adding} onClick={() => goTo(3)}><ArrowLeft size={16} /> Back to {finishLabel.toLowerCase()}</button>

                    </> : configuration ? <>
                    <dl className={styles.totals}><div><dt>Unit price</dt><dd>{money(order.unitPrice)}</dd></div><div><dt>Total{order.validQuantity ? ` (${selection.quantity} units)` : ""}</dt><dd>{money(order.total)}</dd></div></dl>
                    <div className={styles.minimum} aria-live="polite">Set your quantity at review. {minimumNote}<div className={styles.meter} aria-hidden="true"><i style={{ width: `${minimumPct}%` }} /></div></div>
                    </> : body ? <div className={styles.fromPrice} aria-live="polite">
                        <span className={styles.summaryLabel}>Price</span><strong>{possibleFrom ?? "Priced at review"}</strong>
                        <small>{fitment ? "Final price once you choose a finish." : color ? "Final price depends on the fitment and finish." : "Final price depends on the glass, fitment and finish."}</small>
                        <small>{money(ORDER_MINIMUM)} minimum per cart at checkout.</small>
                    </div> : <p className={styles.purchaseHint}>Choose your bottle, glass, fitment, and its cap or finish. Then review your quantity and price.<small>{money(ORDER_MINIMUM)} minimum per cart at checkout.</small></p>}
                    <p className={styles.assurance}><ShieldCheck size={20} /><span>Made to work together.<small>Only compatible combinations are shown.</small></span></p>
                </div>
            </aside>
        </div>
        {!lastAdded && <div className={styles.mobileAction}><div><span>{`Step ${step + 1} of 5`}</span><strong>{configuration ? money(order.total) : choosingFinish ? finishLabel : steps[step]}</strong></div>{action}</div>}
        <p className={styles.bottomNote}>Same bottles. More possibilities.</p>
    </div>;
}

function Option({ children, selected, onClick, label, description }: { children: ReactNode; selected: boolean; onClick: () => void; label: string; description?: string }) {
    const descriptionId = useId();
    return <button type="button" className={`${styles.option} ${selected ? styles.selected : ""}`} aria-label={label} aria-describedby={description ? descriptionId : undefined} aria-pressed={selected} onClick={onClick}>
        {selected && <span className={styles.selectionCheck}><Check size={12} weight="bold" /></span>}{children}{description && <span id={descriptionId} className={styles.optionDescription}>{description}</span>}
    </button>;
}
function SummaryLine({ number, label, value, detail, onEdit }: { number: number | null; label: string; value: string | null; detail: string; onEdit: () => void }) {
    return <div className={`${styles.summaryLine} ${value ? styles.summaryComplete : ""}`}><span className={number == null ? styles.summarySubstep : styles.summaryNumber}>{number != null ? value ? <Check size={13} /> : number : ""}</span>
        <div><span className={styles.summaryLabel}>{label}</span><strong>{value ?? detail}</strong>{value && label === "Bottle" && <small>{detail}</small>}</div>{value && <button aria-label={`Edit ${label.toLowerCase()}`} onClick={onEdit}>Edit</button>}</div>;
}
