"use client";

import { useRegion } from "@/components/RegionProvider";

import { capLinerNote, fitmentChoiceHints } from "@/lib/bottle-builder/fitment-copy";
import { useEffect, useId, useMemo, useRef, useState, useTransition, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle, ShieldCheck, ShoppingBag } from "@/components/icons";
import { useCart } from "@/components/CartProvider";
import { useBuilderFamilies } from "@/components/bottle-builder/useBuilderFamilies";
import { useBuilderKits } from "@/components/bottle-builder/useBuilderKits";
import { topCloseUp } from "@/lib/bottle-builder/top-close-up";
import BuilderSetQuantity from "@/components/bottle-builder/BuilderSetQuantity";
import { useBuilderBodyConfigurations } from "@/components/bottle-builder/useBuilderBodyConfigurations";
import { prefetchBody } from "@/components/bottle-builder/builder-requests";
import { useTileIntent } from "@/components/bottle-builder/useTileIntent";
import type { BuilderFamily } from "@/lib/bottle-builder/entry";
import { registerDisplayDerivatives, type DisplayDerivativeMap } from "@/lib/products/display-derivative";
import FamilyLoadingStatus from "@/components/bottle-builder/FamilyLoadingStatus";
import FamilyChooser, { useFamilyPreviews, type FamilyPreviewPayload } from "@/components/bottle-builder/FamilyChooser";
import FamilyShapeIcon from "@/components/icons/FamilyShapeIcon";
import BuilderViewStage, { builderViewLabel, builderViews } from "@/components/bottle-builder/BuilderViewStage";
import type { StageView } from "@/lib/products/pdp-redesign/stage";
import bodyHeightMedia from "@/lib/bottle-builder/body-heights.generated.json";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import FitmentIllustration from "@/components/bottle-builder/FitmentIllustration";
import BuilderFinishImage from "@/components/bottle-builder/BuilderFinishImage";
import { checkoutMinimum, checkoutMinimumMessage } from "@/lib/checkout";
import { analytics } from "@/lib/analytics";
import { displayApplicatorName } from "@/lib/catalogFilters";
import {
    borrowedFitmentPreview, builderOrder, builderPriceRange, deriveBuilder, emptySelection, previewParts, reconcileSelection, selectBuilderBody,
    ORDER_MINIMUM, type BuilderBody, type BuilderConfiguration, type BuilderSelection, bareGlassPreview, clearBodyPreview,
} from "@/lib/bottle-builder/model";
import hasIncludedCovers from "@/lib/bottle-builder/exposed-sprayers.generated.json";
import { CHOOSER_PRIORITY_TILES } from "@/lib/bottle-builder/mobile-request";
import { displayImageUrl } from "@/lib/products/optimizable-image";
import styles from "@/components/bottle-builder/Builder.module.css";

// Phones only: a laptop never renders the mobile builder, so it never downloads it.
const MobileBuilder = dynamic(() => import("@/components/bottle-builder/MobileBuilder"));

const subscribeMobile = (callback: () => void) => { const query = window.matchMedia("(max-width: 1099px)"); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
const mobileSnapshot = () => window.matchMedia("(max-width: 1099px)").matches;
const serverMobileSnapshot = (preferMobile: boolean) => () => preferMobile;
// One step index drives both layouts: 0 size, 1 glass, 2 top, 3 its color, 4 review. Glass is its own step: on a
// laptop the colour swatches used to sit below the bottle grid inside a clipped scroll region and never came into
// view (2026-09-24 audit). The desktop step list has no review step; 4 there means every step is folded.
/** What a bottle takes, in a word or two, for the size list. */
const TAKES: Record<string, string> = {
    "Fine Mist Sprayer": "mist sprayer", "Perfume Sprayer": "perfume sprayer", "Metal Roller": "roller", "Plastic Roller": "roller",
    "Screw Cap": "screw cap", "Tear-off Cap": "tear-off cap", "Lotion Pump": "pump", "Dropper": "dropper", "Reducer": "reducer",
    "Vintage Bulb Sprayer": "bulb sprayer", "Vintage Bulb Sprayer with Tassel": "bulb sprayer",
};
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

export default function MatrixClient({ families: initialFamilies, familyList, openFamily, bodies: initialBodies, displayDerivatives, preferMobile = false, initialSelection, initialStep = 0, entryUnavailable = false, chooseFamilyFirst = false, familyPreviews }: {
    families: BuilderFamily[];
    /** Delivery copies for the first-paint bodies (resolved on the server). */
    displayDerivatives?: DisplayDerivativeMap;
    /** Every eligible family, streamed into the page's own response. */
    familyList?: Promise<BuilderFamily[] | null>;
    openFamily: string;
    bodies: BuilderBody[];
    preferMobile?: boolean;
    initialSelection?: BuilderSelection;
    initialStep?: number;
    entryUnavailable?: boolean;
    /** A bare /matrix: open on the family screen instead of the default family's bottles. */
    chooseFamilyFirst?: boolean;
    /** Each family's bottle group for the family screen, streamed into the page's own response. */
    familyPreviews?: Promise<FamilyPreviewPayload>;
}) {
    registerDisplayDerivatives(displayDerivatives);
    const { formatPrice } = useRegion();
    const money = (value: number | null) => (value == null ? "—" : formatPrice(value));
    const { families, status: familyStatus, retry: retryFamilies } = useBuilderFamilies(initialFamilies, familyList);
    const familyNotice = <>{entryUnavailable && <p role="status">This product is not currently available in the builder. Choose another bottle below.</p>}<FamilyLoadingStatus status={familyStatus} onRetry={retryFamilies} /></>;
    const router = useRouter();
    const searchParams = useSearchParams();
    const { items, addItems, isCartHydrated } = useCart();
    const [selection, setSelection] = useState<BuilderSelection>(() => initialSelection ?? emptySelection());
    // First paint is chooser-only; the chosen bottle's configurations load, then its kit layers.
    const chooser = useBuilderBodyConfigurations(openFamily, initialBodies, selection.bodyId, searchParams.get("shop"));
    // A tile about to be picked starts its configurations and kit layers, so the pick finds them in flight.
    const prefetchBottle = (bodyId: string) => prefetchBody(openFamily, bodyId, searchParams.get("shop"));
    const bodies = useBuilderKits(openFamily, chooser.bodies, selection.bodyId);
    const [step, setStep] = useState(initialStep);
    const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, serverMobileSnapshot(preferMobile));
    const [previewExpanded, setPreviewExpanded] = useState(false);
    const reviewHeading = useRef<HTMLHeadingElement>(null);
    const previewId = useId();
    const [showCover, setShowCover] = useState(false);
    const [size, setSize] = useState("");
    const [neck, setNeck] = useState("");
    const [application, setApplication] = useState("");
    const [pending, startTransition] = useTransition();
    // The family select is controlled by the server-rendered family; while the
    // next family loads it must show the family the customer just chose.
    const [chosenFamily, setChosenFamily] = useState(openFamily);
    // The family screen comes before Bottle. It is not one of the shared step indices: MobileBuilder and the
    // selection model keep their five stages, and the screen sits in front of them on both layouts.
    const [familyScreen, setFamilyScreen] = useState(chooseFamilyFirst);
    const [familyScreenReturned, setFamilyScreenReturned] = useState(false);
    const familyPreviewMap = useFamilyPreviews(familyPreviews, familyScreen);
    // Desktop moves on by itself once a choice is made (Jordan, 20 Nov 2026): a bottle opens its glass
    // (or its fitments when it comes in one glass), a glass opens its fitments, a fitment its finishes.
    // The finish stays put until the customer reviews. The target waits here while the bottle's options load.
    const [advanceTo, setAdvanceTo] = useState<number | null>(null);
    // Add to Cart is never below the fold on a finished bottle (Jordan, 25 Nov 2026): see the bar under the workspace.
    const addAnchor = useRef<HTMLDivElement>(null);
    const [addOffScreen, setAddOffScreen] = useState(false);
    // The finished bottle in the product page's views; cap on is how it ships.
    const [finishedView, setFinishedView] = useState<StageView>("capon");
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
    const possibleFrom = body?.chooserOnly ? (color ? fromLabel(body.colorPriceFrom?.[color]) : fromLabel(body.priceFrom)) : priceFrom(possible);
    const buildCents = Math.round((order.total ?? 0) * 100);
    const cartCents = Math.round(cartProgress.subtotal * 100);
    const minimumCents = ORDER_MINIMUM * 100;
    const minimumPct = Math.min(100, Math.round((cartCents + buildCents) / minimumCents * 100));
    const minimumNote = order.total == null ? `${money(ORDER_MINIMUM)} minimum per cart at checkout.`
        : cartCents + buildCents >= minimumCents ? `This build${cartCents ? " and your cart" : ""} meet${cartCents ? "" : "s"} the ${money(ORDER_MINIMUM)} order minimum.`
        : `${money((minimumCents - cartCents - buildCents) / 100)} more reaches the ${money(ORDER_MINIMUM)} order minimum${cartCents ? ` (cart ${money(cartProgress.subtotal)} + this build ${money(order.total)})` : ""}.`;
    const bodyFitments = (b: BuilderBody) => b.fitments ?? b.configurations.map(c => c.fitment);
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
    // Once every part is chosen the bottle is complete: show it the way its product page does.
    const finishedViews = step >= 3 && configuration ? builderViews(configuration) : [];
    const activeFinishedView = finishedViews.includes(finishedView) ? finishedView : finishedViews[0];
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
    // Glass needs only the colours first paint already carries; Fitment needs the full body.
    const awaitingBody = chooser.loading && (step === 1 || (step === 0 && skipGlass));
    // Glass needs only the colours first paint carries; anything past it waits for the chosen bottle's options.
    const advanceReady = advanceTo != null && !pending && (!chooser.loading || (advanceTo === 1 && !skipGlass))
        && (advanceTo !== 1 || Boolean(body)) && (advanceTo !== 2 || Boolean(color)) && (advanceTo !== 3 || Boolean(fitment));
    useEffect(() => {
        if (!advanceReady || advanceTo == null || isMobile) return;
        // A step with one option is taken as read, like one glass: the list says it was chosen for the customer.
        const opening = advanceTo === 1 && skipGlass ? 2 : advanceTo;
        if (opening === 2 && !fitment && current.fitments.length === 1) {
            update({ fitment: current.fitments[0], closure: null }); setAdvanceTo(3); return;
        }
        setAdvanceTo(null);
        goTo(opening === 3 && configuration && current.closures.length === 1 ? 4 : advanceTo);
        // goTo is recreated every render; the advance runs once per choice.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [advanceReady, advanceTo, isMobile]);
    const complete = Boolean(configuration) && !familyScreen && !isMobile;
    useEffect(() => {
        const anchor = addAnchor.current;
        if (!complete || !anchor || typeof IntersectionObserver === "undefined") return;
        // The ratio, not isIntersecting: browsers differ on whether a button that is half on screen still "intersects".
        const observer = new IntersectionObserver(([entry]) => setAddOffScreen(entry.intersectionRatio < .95), { threshold: .95 });
        observer.observe(anchor);
        return () => observer.disconnect();
    }, [complete]);
    const bodyNotice = chooser.failed ? <div className={styles.familyPending} role="status">We couldn’t load this bottle’s options. <button type="button" className={styles.textButton} onClick={chooser.retry}>Try again</button></div> : null;
    const catalogHref = `/catalog?families=${encodeURIComponent(openFamily)}`;
    const unavailableFinishes = body?.unavailableFinishes?.filter(option => option.color === color && option.fitment === fitment) ?? [];
    // The last choice is a color: of the cap where the top has one, of the top itself otherwise.
    const colorLabel = /Roller|Cap|Reducer/.test(fitment ?? "") ? "Cap color" : "Color";
    const colorNote = fitment === "Screw Cap" && body?.family === "Cylinder" && body.capacityMl === 5 && body.neck === "13-415"
        ? "Black and white short caps are ribbed. The other six short caps and the gold and silver tall caps have liners."
        : current.closures.length === 1 ? `This ${colorLabel.toLowerCase()} is included with your bottle.` : null;
    const glassExample = body && color ? body.configurations.find(config => config.color === color) ?? null : null;
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
        setSelection(emptySelection()); setShowCover(false); setLastAdded(null); setError(""); setSize(""); setNeck(""); setApplication(""); setPreviewExpanded(false); goTo(0);
    }
    const familyHref = (family: string) => `/matrix?family=${encodeURIComponent(family)}${searchParams.get("shop") ? `&shop=${encodeURIComponent(searchParams.get("shop")!)}` : ""}`;
    /** Start over clears the build and returns to the family screen, the beginning of the builder. */
    function startOver() {
        if (adding) return;
        reset();
        openFamilyScreen();
    }
    function openFamilyScreen() {
        if (adding) return;
        setFamilyScreen(true); setFamilyScreenReturned(true); setPreviewExpanded(false); setLastAdded(null); setError("");
        requestAnimationFrame(() => builderRoot.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }));
    }
    function chooseFamily(family: string) {
        if (adding) return;
        if (family === openFamily) { setChosenFamily(family); setFamilyScreen(false); goTo(0); return; }
        setChosenFamily(family);
        reset();
        startTransition(() => router.push(familyHref(family)));
    }
    function chooseBottle(selected: BuilderBody) {
        const next = selectBuilderBody(bodies, selection, selected.id);
        setShowCover(false);
        setSelection(next); setLastAdded(null); setError("");
        setAdvanceTo(1);
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
                setSelection(emptySelection()); setShowCover(false); setSize(""); setNeck(""); setApplication(""); setStep(0);
            }
            requestAnimationFrame(() => {
                confirmation.current?.focus({ preventScroll: true });
                confirmation.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
            });
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add this bottle. Please try again."); }
        finally { setAdding(false); }
    }
    const addButton = <button className={styles.primary} disabled={!order.canAdd || adding || !isCartHydrated} onClick={addToCart}>
        {adding ? "Checking your bottle…" : "Add to Cart"} {!adding && <ShoppingBag size={17} />}
    </button>;

    if (isMobile && !familyScreen) return <MobileBuilder onChangeFamily={openFamilyScreen} familyNotice={familyNotice} families={families} family={openFamily} bodies={bodies}
        selection={selection} current={current} order={order} stage={step} onStage={next => { setStep(next); setError(""); }} priceRange={priceRange}
        onUpdate={patch => { update(patch); if (patch.bodyId || patch.color || patch.fitment) setShowCover(false); }} onReset={reset} onFamily={family => { reset(); startTransition(() => router.push(familyHref(family))); }} onAdd={addToCart}
        size={size} neck={neck} application={application} onFilter={(filter, value) => { if (filter === "size") setSize(value); else if (filter === "neck") setNeck(value); else setApplication(value); }}
        pending={pending || awaitingBody} bodyNotice={bodyNotice} adding={adding} hydrated={isCartHydrated} error={error} lastAdded={lastAdded} cartProgress={cartProgress}
        hasIncludedCover={hasIncludedCover} showCover={showCover} onCover={() => setShowCover(value => !value)} chooserScale={b => chooserScale(b, bodies)} onBodyIntent={prefetchBottle}
        setPrice={pieces => current.configuration ? builderOrder(current.configuration, pieces, items) : null} />;

    // The step list (24 Nov 2026): one question open at a time, in order. A finished step folds into a line with its
    // answer, a thumbnail and "Change", so the list is also the summary. Choosing an option is the only way forward;
    // the price and Add to Cart sit under the list instead of on a review step of their own.
    const firstMissing = !body ? 0 : !color ? 1 : !fitment ? 2 : !configuration ? 3 : null;
    const lockedHint = `Choose ${["a size", "a glass", "a top", "a color"][firstMissing ?? 0]} first`;
    const rowState = (index: number) => {
        const done = completed[index], open = step === index;
        return { done, open, locked: !done && !open && firstMissing !== null && index > firstMissing, hint: lockedHint, disabled: adding || pending, onOpen: () => goTo(index) };
    };
    const left = ["size", "glass", "top", "color"].filter((_, index) => !completed[index]);
    const leftLine = `${left.length} ${left.length === 1 ? "choice" : "choices"} to go: ${left.length > 1 ? `${left.slice(0, -1).join(", ")} and ${left[left.length - 1]}` : left[0]}.`;
    // A long family (Cylinder has 14 bottles, three of them 9 ml) reads as a list: what each bottle takes, and its neck.
    const manySizes = visibleBodies.length > 6;
    // One catalog profile arrives as "Pillar Pillar"; say it once.
    const sizeName = (b: BuilderBody) => `${b.capacityMl} ml${b.profileLabel !== b.family ? ` ${[...new Set(b.profileLabel.split(" "))].join(" ")}` : ""}`;
    const takes = (b: BuilderBody) => {
        const names = [...new Set(bodyFitments(b).map(f => TAKES[f] ?? displayApplicatorName(f).toLowerCase()))];
        const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0] ?? "";
        return text.charAt(0).toUpperCase() + text.slice(1);
    };
    // Before a size is picked the preview shows a bottle from the middle of the family instead of an empty stage.
    const ghost = !body ? visibleBodies[Math.floor((visibleBodies.length - 1) / 2)] ?? null : null;
    const built = [chosenFamily, body && sizeName(body), color && `${color} glass`, fitment && displayApplicatorName(fitment), closure].filter(Boolean).join(" · ");
    const previewNote = !body ? (ghost ? `Showing the ${ghost.capacityMl} ml until you pick a size.` : "Pick a size to begin.")
        : !color ? `Showing ${(preview?.color ?? "clear").toLowerCase()} glass until you pick one.`
        : !fitment ? "No top yet. Choose how it dispenses or closes."
        : !configuration ? `Choose a ${colorLabel.toLowerCase()} to finish.`
        : "";
    // What the cart charges for one set of that many pieces, for the "Set of" menu.
    const setPrice = (pieces: number) => configuration ? builderOrder(configuration, pieces, items) : null;
    const topName = fitment ? displayApplicatorName(fitment).toLowerCase() : "";
    const includes = !fitment ? "" : `${fitment === "Screw Cap" ? "Bottle and screw cap" : /Roller|Reducer/.test(fitment) ? `Bottle, ${topName} and cap` : `Bottle and ${topName}`}${hasIncludedCover ? ", with its overcap" : ""}`;
    const topConfig = (f: string) => current.colored.find(c => c.fitment === f && c.kit) ?? null;

    return <div ref={builderRoot} className={styles.builder} data-bottle-builder data-current-step={familyScreen ? "family" : step} data-has-bottle={Boolean(body)} data-family-screen={familyScreen || undefined} aria-busy={pending || adding}>
        <header className={styles.header}>
            <div><div className={styles.headerLinks}><Link className={styles.backLink} href={catalogHref}><ArrowLeft size={13} /> Back to bottles</Link><Link className={styles.mobileCartLink} href="/cart">View cart{isCartHydrated && items.length > 0 ? ` (${items.reduce((sum, item) => sum + item.quantity, 0)})` : ""}</Link></div>
                <h1>Build Your Bottle</h1>
                <p>{familyScreen ? "Five choices: shape, size, glass, top and cap color. Each one narrows the next." : "Five choices, in order. Each one narrows the next, and you can change any of them whenever you like."}</p></div>
            {familyScreen && <ol className={styles.choices} aria-label="The five choices">{["Shape", "Size", "Glass", "Top", "Cap color"].map((label, index) =>
                <li key={label} aria-current={index === 0 ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}</ol>}
        </header>
        {lastAdded && <div ref={confirmation} className={styles.addedNotice} role="status" tabIndex={-1}>
            <CheckCircle size={25} weight="light" />
            <div><h2>Your bottle has been added to cart.</h2><p>{lastAdded.quantity} × {lastAdded.name}</p><p>{checkoutMinimumMessage(cartProgress)}</p><p>Ready for another? Choose a size below to start a new build.</p></div>
            <div className={styles.addedActions}><button className={styles.primary} onClick={() => goTo(0)}>Build Another Bottle</button>
                <Link href="/cart" className={styles.secondary}>View Cart <ArrowRight size={16} /></Link>
</div>
        </div>}
        {familyScreen && <>{familyNotice}<FamilyChooser families={families} previews={familyPreviewMap} current={familyScreenReturned ? openFamily : undefined}
            pendingFamily={pending && chosenFamily !== openFamily ? chosenFamily : null} onChoose={chooseFamily} stepLabel="Step 1 of 5" focusOnMount={familyScreenReturned} disabled={adding} /></>}
        {!familyScreen && step === 0 && familyNotice}
        {!familyScreen && <div className={styles.workspace} id="builder-workspace">
            <section className={styles.preview} aria-label="Live bottle preview" data-preview-stage={previewStage} data-expanded={previewExpanded}>
                <div className={styles.previewHeader}>{configuration && step >= 3
                    ? <span key={configuration.id} className={styles.completeBadge} role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" /><path d="M7.2 12.4l3.1 3.1 6.5-6.8" /></svg>Your bottle is complete</span>
                    : <span>YOUR BOTTLE, TAKING SHAPE</span>}
                    {finishedViews.length > 1 ? <div className={styles.viewSwitch} role="group" aria-label="View">{finishedViews.map(view =>
                        <button key={view} type="button" aria-pressed={activeFinishedView === view} onClick={() => setFinishedView(view)} data-builder-view={view}>{builderViewLabel(view)}</button>)}</div>
                    : <span className={styles.liveDot}>{preview ? "Your bottle preview" : "Live preview"}</span>}</div>
                {configuration && activeFinishedView ? <div id={previewId} className={styles.previewImage}><BuilderViewStage configuration={configuration} view={activeFinishedView}
                    label={`${configuration.capacityMl} ml ${configuration.color} ${configuration.family} with ${displayApplicatorName(configuration.fitment)}, ${configuration.closure}, ${builderViewLabel(activeFinishedView).toLowerCase()}`} /></div>
                : preview && previewConfig ? <div id={previewId} className={`${styles.previewImage} ${previewStage === "complete" && !preview.kit && preview.photoUrl ? styles.plateStage : ""}`}><BuilderImage config={previewConfig} parts={displayParts} stage={displayStage} showCover={showCover} bodyReference={bodyReference} frameConfigurations={body?.configurations}
                    label={`${preview.capacityMl} ml ${preview.color} ${preview.family}${fitment ? ` with ${displayApplicatorName(fitment)}` : preview.kit ? " bottle body" : " bottle"}${closure ? `, ${closure}` : ""}`} /></div>
                : ghost ? <div id={previewId} className={`${styles.previewImage} ${styles.previewGhost}`}><BuilderImage config={clearBodyPreview(ghost)} parts={previewParts(clearBodyPreview(ghost), "body")} stage="body"
                    label={`${ghost.capacityMl} ml ${ghost.family} bottle, shown until you pick a size`} /></div>
                    : <div className={styles.previewEmpty}><ShoppingBag size={32} weight="light" /><p>Your bottle starts here.</p></div>}
                <div className={styles.previewCaption} aria-live="polite"><span className={styles.eyebrow}>Your bottle</span><h2>{built}</h2>{previewNote && <p>{previewNote}</p>}
                    {body && preview && !preview.kit && !borrowed && fitment && !configuration && <p>Your selected top is shown in the options. Choose your {colorLabel.toLowerCase()} to see the complete bottle.</p>}</div>
                {hasIncludedCover && !activeFinishedView && <div className={styles.coverControl}><span>Matching overcap included</span><button type="button" aria-pressed={showCover} onClick={() => setShowCover(value => !value)}>{showCover ? "Hide cap" : "Show cap"}</button></div>}
                {/* What was built, how many, what it costs, and the button: under the bottle it describes (Jordan, 25 Nov 2026). */}
                <div className={styles.orderPanel} role="region" aria-label="Your order" data-builder-order={configuration ? "ready" : "waiting"}>
                    {configuration ? <>
                    <h2 ref={reviewHeading} tabIndex={-1} className={styles.orderTitle}>Ready to order</h2>
                    <div className={styles.orderGrid}>
                        <dl className={styles.orderFacts}>
                            <div><dt>Product</dt><dd>{configuration.product.itemName}</dd></div>
                            <div><dt>SKU</dt><dd data-builder-sku>{configuration.id}</dd></div>
                            <div><dt>Neck</dt><dd>{configuration.neck}</dd></div>
                            <div><dt>Includes</dt><dd>{includes}</dd></div>
                            {configuration.caseQuantity && <div><dt>Case</dt><dd>{configuration.caseQuantity.toLocaleString("en-US")} per case</dd></div>}
                        </dl>
                        <div className={styles.orderBuy}>
                            <BuilderSetQuantity id="builder-quantity" quantity={selection.quantity} caseQuantity={configuration.caseQuantity} disabled={adding || !body}
                                invalid={!order.validQuantity} describedBy="builder-minimum" priceFor={setPrice} onQuantity={quantity => update({ quantity })} />
                            <div className={styles.orderTotal}><span>{order.unitPrice == null ? "" : `${money(order.unitPrice)} each`}</span><strong>{money(order.total)}</strong></div>
                            {error && <p className={styles.error} role="alert">{error}</p>}
                            <div ref={addAnchor} data-builder-add>{addButton}</div>
                        </div>
                    </div>
                    <div id="builder-minimum" className={styles.minimum} aria-live="polite">
                        {!order.validQuantity ? "Enter a whole-number quantity of at least 1." : minimumNote}
                        {order.validQuantity && <div className={styles.meter} aria-hidden="true"><i style={{ width: `${minimumPct}%` }} /></div>}
                    </div>
                    </> : <div className={styles.orderWaiting} aria-live="polite">
                        <span>{body ? leftLine : "The price appears here once the bottle is complete."}</span>
                        <strong>{body ? possibleFrom ?? "Priced when complete" : ""}</strong>
                        <small>{money(ORDER_MINIMUM)} minimum per cart at checkout.</small>
                    </div>}
                </div>
            </section>
            <div className={styles.stepList} data-builder-steps>
                <div className={styles.stepListHeader}><span className={styles.eyebrow}>Five choices, in order</span><button type="button" className={styles.startOver} onClick={startOver} disabled={adding}>Start over</button></div>
                <StepRow number={1} title="Shape" done open={false} locked={false} hint="" disabled={adding || pending} onOpen={openFamilyScreen} value={chosenFamily}
                    thumb={<FamilyShapeIcon family={chosenFamily} size={30} strokeWidth={1} />} />
                <StepRow number={2} title="Size" {...rowState(0)} value={body ? sizeName(body) : null} detail={body ? `${body.neck} neck` : undefined}
                    thumb={body && <BuilderImage config={clearBodyPreview(body)} parts={previewParts(clearBodyPreview(body), "body")} label="" thumbnail />}>
                    <h2 tabIndex={-1} ref={optionHeading}>How much should it hold?</h2>
                    {bodyNotice}
                    <fieldset aria-label="Size" disabled={adding || pending} className={styles.optionFieldset}>
                        <div className={manySizes ? styles.sizeList : styles.bottleGrid}>
                            {visibleBodies.map((b, index) => <Option key={b.id} row={manySizes} label={`${b.capacityMl} ml, ${b.neck} neck${b.profileLabel !== b.family ? `, ${b.profileLabel}` : ""}`} selected={body?.id === b.id} onClick={() => chooseBottle(b)} onIntent={() => prefetchBottle(b.id)}>
                                <div className={styles.bottleThumb}><BuilderImage config={clearBodyPreview(b)} parts={previewParts(clearBodyPreview(b), "body")} label={`${b.capacityMl} ml ${b.family} bottle`} scale={chooserScale(b, bodies)} thumbnail placeholder priority={index < CHOOSER_PRIORITY_TILES} /></div>
                                <div className={styles.sizeText}><strong>{sizeName(b)}</strong><small>{takes(b)}</small><span className={styles.neckBadge}>{b.neck} neck</span></div>
                            </Option>)}
                        </div>
                        {!visibleBodies.length && <div className={styles.empty}><h3>No bottles for these choices.</h3><p>Try another size or bottle family.</p><button className={styles.secondary} onClick={() => { setSize(""); setNeck(""); setApplication(""); }}>Clear filters</button><Link href={catalogHref}>Explore the full catalog <ArrowRight size={15} /></Link></div>}
                    </fieldset>
                </StepRow>
                <StepRow number={3} title="Glass" {...rowState(1)} value={color} auto={skipGlass ? "The only glass for this bottle, so it is chosen for you." : undefined}
                    thumb={body && color && glassExample && <BuilderImage config={bareGlassPreview(glassExample)} parts={previewParts(bareGlassPreview(glassExample), "body")} label="" thumbnail />}>
                    <h2 tabIndex={-1} ref={optionHeading}>Which glass?</h2>
                    {body && <fieldset aria-label="Glass" disabled={adding || pending} className={styles.optionFieldset}><div className={styles.colorGrid}>
                        {current.colors.map(c => { const example = body.configurations.find(config => config.color === c)!; return <Option key={c} label={c} selected={color === c} onClick={() => { update({ color: c, fitment: null, closure: null }); setAdvanceTo(2); }}>
                            <div className={styles.colorThumb}><BuilderImage config={bareGlassPreview(example)} parts={previewParts(bareGlassPreview(example), "body")} label={`${c} bottle`} thumbnail placeholder /></div><strong>{c}</strong>
                        </Option>; })}
                    </div></fieldset>}
                </StepRow>
                <StepRow number={4} title="Top" {...rowState(2)} value={fitment ? displayApplicatorName(fitment) : null} auto={fitment && current.fitments.length === 1 ? "The only top that fits this bottle, so it is chosen for you." : undefined}
                    thumb={fitment && <TopPhoto config={topConfig(fitment)} fitment={fitment} neck={body?.neck} bodyReference={bodyReference} frame={body?.configurations} />}>
                    <h2 tabIndex={-1} ref={optionHeading}>How should it dispense or close?</h2>
                    {bodyNotice}
                    <fieldset aria-label="Top" disabled={adding || pending} className={styles.optionFieldset}><div className={styles.fitmentGrid}>{current.fitments.map(f => {
                        const availableCount = current.colored.filter(c => c.fitment === f).length;
                        const unavailableCount = body?.unavailableFinishes?.filter(c => c.color === color && c.fitment === f).length ?? 0;
                        const count = availableCount + unavailableCount;
                        return <Option key={f} label={displayApplicatorName(f)} description={fitmentChoiceHints[f] ?? fitmentDescriptions[f]} selected={fitment === f} onClick={() => { update({ fitment: f, closure: null }); setShowCover(false); setAdvanceTo(3); }}>
                            <div className={styles.componentThumb}><TopPhoto config={topConfig(f)} fitment={f} neck={body?.neck} bodyReference={bodyReference} frame={body?.configurations} /></div>
                            <strong>{displayApplicatorName(f)}</strong><small>{count} {count === 1 ? "color" : "colors"}{unavailableCount > 0 ? ` · ${availableCount} available` : ""}</small>
                        </Option>;
                    })}</div></fieldset>
                </StepRow>
                <StepRow number={5} title={colorLabel} {...rowState(3)} value={closure} auto={closure && current.closures.length === 1 ? `The only ${colorLabel.toLowerCase()} for this top, so it is chosen for you.` : undefined}
                    thumb={configuration && <BuilderFinishImage config={configuration} peers={current.fitted} />}>
                    <h2 tabIndex={-1} ref={optionHeading}>{`Which ${colorLabel.toLowerCase()}?`}</h2>
                    <div className={styles.closureSection}>
                        {colorNote && <p>{colorNote}</p>}
                        {capLinerNote(body?.neck, fitment) && <p className={styles.linerNote}>{capLinerNote(body?.neck, fitment)}</p>}
                        <fieldset aria-label={colorLabel} disabled={adding || pending} className={styles.optionFieldset}><div className={styles.closureGrid}>{current.fitted.map(c => <Option key={c.id} label={c.closure} selected={closure === c.closure} onClick={() => { update({ closure: c.closure }); setShowCover(false); }}>
                                <div className={styles.closureThumb}><BuilderFinishImage config={c} peers={current.fitted} /></div><strong>{c.closure}</strong>
                            </Option>)}{unavailableFinishes.map(option => <button type="button" disabled key={option.id} className={`${styles.option} ${styles.unavailableOption}`} aria-label={`${option.closure} — Out of stock`}>
                                <div className={styles.closureThumb}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={displayImageUrl(option.imageUrl, 640)} alt="" loading="lazy" />
                                </div><strong>{option.closure}</strong><small>Out of stock</small>
                            </button>)}</div></fieldset>
                    </div>
                    {configuration && hasIncludedCover && <div className={styles.includedCover}>
                        {configuration.kit?.parts.some(p => p.slot === "overcap") && <div className={styles.includedCoverImage}><BuilderImage config={configuration} parts={configuration.kit.parts.filter(p => p.slot === "overcap")} stage="complete" thumbnail label="Included overcap" /></div>}
                        <div><strong>Included overcap</strong><p>Comes with this {fitment?.includes("Pump") ? "pump" : "sprayer"} and cannot be selected separately.</p></div><CheckCircle size={20} />
                    </div>}
                </StepRow>
                <p className={styles.assurance}><ShieldCheck size={20} /><span>Made to work together.<small>Only compatible combinations are shown.</small></span></p>
            </div>
            {configuration && addOffScreen && !lastAdded && <div className={styles.addBar} role="region" aria-label="Add this bottle to your cart" data-builder-add-bar>
                <div className={styles.addBarText}><strong>{built}</strong><span>SKU {configuration.id}{order.validQuantity ? ` · ${selection.quantity.toLocaleString("en-US")} ${selection.quantity === 1 ? "pc" : "pcs"}` : ""}{order.unitPrice == null ? "" : ` · ${money(order.unitPrice)} each`}</span></div>
                <strong className={styles.addBarTotal}>{money(order.total)}</strong>
                {addButton}
            </div>}
        </div>}
        <p className={styles.bottomNote}>Same bottles. More possibilities.</p>
    </div>;
}

function Option({ children, selected, onClick, onIntent, label, description, row = false }: { children: ReactNode; selected: boolean; onClick: () => void; onIntent?: () => void; label: string; description?: string; row?: boolean }) {
    const descriptionId = useId();
    const intent = useTileIntent(onIntent);
    return <button type="button" className={`${styles.option} ${row ? styles.optionRow : ""} ${selected ? styles.selected : ""}`} aria-label={label} aria-describedby={description ? descriptionId : undefined} aria-pressed={selected} onClick={onClick} {...intent}>
        {selected && <span className={styles.selectionCheck}><Check size={12} weight="bold" /></span>}{children}{description && <span id={descriptionId} className={styles.optionDescription}>{description}</span>}
    </button>;
}

/** One line of the step list. Open, it holds its question and options; finished, it is the answer, a thumbnail and "Change". */
function StepRow({ number, title, done, open, locked, hint, value, detail, auto, thumb, disabled, onOpen, children }: {
    number: number; title: string; done: boolean; open: boolean; locked: boolean; hint: string; value: string | null; detail?: string;
    /** Set when this step had one option and was filled in for the customer. */
    auto?: string;
    thumb?: ReactNode; disabled: boolean; onOpen: () => void; children?: ReactNode;
}) {
    return <section className={styles.stepRow} data-builder-step={number} data-step-state={open ? "open" : done ? "done" : locked ? "locked" : "next"}>
        <div className={styles.stepHead}>
            <span className={styles.stepBadge}>{done ? <Check size={14} weight="bold" /> : number}</span>
            <div className={styles.stepText}><span className={styles.stepTitle}>{title}</span>
                {!open && done && <strong>{value}</strong>}
                {!open && done && (auto ?? detail) && <small>{auto ?? detail}</small>}
                {!open && !done && <small>{locked ? hint : "Up next"}</small>}
            </div>
            {!open && done && thumb && <span className={styles.stepThumb} aria-hidden="true">{thumb}</span>}
            {!open && !locked && !auto && <button type="button" className={styles.textButton} disabled={disabled} onClick={onOpen} aria-label={`${done ? "Change" : "Choose"} ${title.toLowerCase()}`}>{done ? "Change" : "Choose"}</button>}
        </div>
        {open && <div className={styles.stepBody}>{children}</div>}
    </section>;
}

/** The top as it looks on this bottle with its cap off: the same layers and camera as the preview, closed in on the
 * neck. Until the bottle's layers arrive, and for a top that has none, the drawing stands in. */
function TopPhoto({ config, fitment, neck, bodyReference, frame }: { config: BuilderConfiguration | null; fitment: string; neck?: string; bodyReference?: BuilderConfiguration; frame?: readonly BuilderConfiguration[] }) {
    const parts = useMemo(() => config ? previewParts(config, "fitment") : [], [config]);
    const closeUp = useMemo(() => topCloseUp(config, parts, bodyReference, frame), [config, parts, bodyReference, frame]);
    if (!config || !closeUp) return <FitmentIllustration fitment={fitment} neck={neck} />;
    return <span className={styles.topPhoto} data-top-photo><span style={closeUp}><BuilderImage config={config} parts={parts} stage="fitment" showCover={false} bodyReference={bodyReference} frameConfigurations={frame} label="" /></span></span>;
}
