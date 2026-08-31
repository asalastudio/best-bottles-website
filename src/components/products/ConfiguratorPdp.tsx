"use client";

/**
 * ConfiguratorPdp — the guided configurator hero (design handoff
 * `design_handoff_configurator_pdp`, approved 2026-08-31).
 *
 * Desktop: 50/50 split — 3D stage left, step panel right. Mobile: stacked
 * flow with summary chip, closure rail, accordion steps and a sticky buy
 * bar. Everything INSIDE the <Canvas> belongs to the render design system;
 * this component owns everything outside it.
 *
 * Architecture (decision 2026-08-31): a VENEER over the one-URL-per-closure
 * catalogue. Committing a closure navigates to the sibling product group,
 * so SEO, Shopify SKU binding, pricing and cart wiring are untouched.
 * Selection before commit only PREVIEWS on the stage (previewBase), with
 * the "Previewing X · Return to Y" toast.
 */

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check, CaretRight, Sparkle, ChatCircle, ShoppingBag,
  SprayBottle, Drop, Eyedropper, GitCompare,
} from "@/components/icons";
import { HandSoap, HandGrabbing, CaretLeft, CaretDown, CheckCircle, TestTube }
  from "@phosphor-icons/react";
import { GLASS_PRESETS, type GlassPresetId } from "@/lib/materials/glassPresets";
import { familyForSlug, glassFromSlug, type ConfiguratorFamily, type ClosureBase }
  from "@/lib/configurator/families";
import { USE_CASES, CLOSURE_META, type UseCaseId } from "@/lib/configurator/useCases";
import { swatchFor, type SwatchableMaterial } from "@/lib/materials/materialSwatch";

const Bottle3DViewer = dynamic(() => import("./Bottle3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center"
         style={{ background: "#a29383" }}>
      <span className="text-xs tracking-eyebrow uppercase text-champagne/70">
        Preparing 3D view
      </span>
    </div>
  ),
});

const USE_CASE_ICON = {
  SprayBottle, Drop, Eyedropper, HandSoap, TestTube,
} as const;

/** stand-in glyph when a sibling group has no hero photo yet */
const CLOSURE_GLYPH: Record<string, typeof SprayBottle> = {
  sprayer: SprayBottle, antique: SprayBottle, antiqueTassel: SprayBottle,
  pump: HandSoap, dropper: Eyedropper, roller: Drop, reducer: TestTube,
};

/** glass tint approximations for the GLASS swatches (attenuation-derived) */
const GLASS_TONE: Record<string, SwatchableMaterial> = {
  clear: { color: "#e9edeb", roughness: 0.06 },
  amber: { color: "#8a4c16", roughness: 0.06 },
  cobalt: { color: "#1d3aa8", roughness: 0.06 },
  frosted: { color: "#dfe3e2", roughness: 0.55 },
  swirl: { color: "#e3d9c2", roughness: 0.2 },
};

type Sibling = {
  slug?: string | null;
  priceRangeMin?: number | null;
  applicatorTypes?: string[] | null;
  heroImageUrl?: string | null;
  displayName?: string | null;
};

export default function ConfiguratorPdp({
  currentSlug, groupTitle, capacityLabel, priceEach, stepCountLabel,
  siblings, heroImageUrl, onAddToCart, onAskGrace,
  displayName, categoryLabel, inStock = true, caseQty,
  neckSize, capacityText, skuLabel, price10, price12,
  sampleHref, quoteHref, qty = 1, onQtyChange,
}: {
  currentSlug: string;
  groupTitle: string;          // "Elegant 60 ml"
  capacityLabel: string;       // "Clear glass"
  priceEach: number | null;    // committed group's unit price
  stepCountLabel?: string;
  siblings: Sibling[];         // applicator siblings incl. prices (deltas)
  heroImageUrl?: string | null;
  onAddToCart?: () => void;
  onAskGrace?: () => void;
  /** product identity — the panel IS the buy box and leads with it
      (Mobbin verdict 2026-08-31: every strong commerce PDP puts
      title → price → options → CTA above the fold) */
  displayName?: string;
  categoryLabel?: string;      // "Glass Bottle · Cylinder"
  inStock?: boolean;
  caseQty?: number | null;
  /** transaction column (BuildDirect-pattern structure, our brand):
      spec strip + tiered price + sample-first CTA stack */
  neckSize?: string | null;    // "17-415"
  capacityText?: string | null;// "9 ml (0.3 oz)"
  skuLabel?: string | null;
  price10?: number | null;     // 10+ tier unit price
  price12?: number | null;     // 12+ tier unit price
  sampleHref?: string;
  quoteHref?: string;
  qty?: number;
  onQtyChange?: (n: number) => void;
}) {
  const router = useRouter();
  const fam = familyForSlug(currentSlug);
  const glass: GlassPresetId = fam ? glassFromSlug(fam, currentSlug) : "clear";
  const committedToken = currentSlug.split("-").pop() ?? "";
  const committedBase: ClosureBase =
    fam?.closureFromSlug[committedToken] ?? "sprayer";

  const [mode, setMode] = useState<"guided" | "direct">("guided");
  const [useCase, setUseCase] = useState<UseCaseId>("fragrance");
  const [previewBase, setPreviewBase] = useState<ClosureBase | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [capMat, setCapMat] = useState("ANSP_BLACK");
  const [trimMat, setTrimMat] = useState(
    fam?.trims?.[0] ?? "CAP_SHINY_BLACK");
  const [mats, setMats] = useState<Record<string, SwatchableMaterial> | null>(null);
  useEffect(() => {
    let dead = false;
    fetch("/models/materials.json").then((r) => r.json())
      .then((j) => { if (!dead) setMats(j.materials); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const activeBase = previewBase ?? committedBase;

  // sibling lookup: slug token -> sibling row (price, photo)
  const siblingFor = useMemo(() => {
    const bySlug = new Map<string, Sibling>();
    for (const s of siblings) if (s.slug) bySlug.set(s.slug, s);
    return (base: ClosureBase): Sibling | null => {
      if (!fam) return null;
      const token = fam.slugClosure[base];
      if (!token) return null;
      const colour = fam.slugColour[glass] ?? "clear";
      return bySlug.get(fam.buildSlug(colour, token)) ?? null;
    };
  }, [siblings, fam, glass]);

  /** every closure this family SELLS in this colourway (registry ∪ catalog
   *  antique photo groups — decision: bulb selectable, photo fallback) */
  const sellableBases = useMemo(() => {
    const out: ClosureBase[] = [];
    if (!fam) return out;
    for (const b of fam.bases) if (b !== "none") out.push(b);
    // antique sells as a photo-only group even where 3D is parked
    if (!out.includes("antique")) {
      const colour = fam.slugColour[glass] ?? "clear";
      const antiqueSlug = fam.buildSlug(colour, "antiquespray");
      if (siblings.some((s) => s.slug === antiqueSlug)) out.push("antique");
    }
    return out;
  }, [fam, glass, siblings]);

  const ranked = useMemo(() => {
    const order = USE_CASES.find((u) => u.id === useCase)?.ranked ?? [];
    const inOrder = order.filter((b) => sellableBases.includes(b));
    const rest = sellableBases.filter((b) => !inOrder.includes(b));
    return [...inOrder, ...rest];
  }, [useCase, sellableBases]);

  const visible = showAll ? ranked : ranked.slice(0, 2);
  const activeMeta = activeBase !== "none" ? CLOSURE_META[activeBase] : null;

  const priceDelta = (base: ClosureBase): string => {
    const sib = siblingFor(base);
    if (sib?.priceRangeMin == null || priceEach == null) return "";
    const d = sib.priceRangeMin - priceEach;
    return `${d >= 0 ? "+" : "−"}$${Math.abs(d).toFixed(2)}`;
  };

  const antiqueSibling = siblingFor("antique");
  // bulb has no live 3D (parked): the stage shows the product photo
  const photoFallback =
    activeBase === "antique" || activeBase === "antiqueTassel"
      ? (antiqueSibling?.heroImageUrl ?? heroImageUrl ?? null)
      : null;

  const commit = (base: ClosureBase) => {
    if (!fam) return;
    const token = fam.slugClosure[base];
    const colour = fam.slugColour[glass];
    if (!token || !colour) return;
    const to = fam.buildSlug(colour, token);
    if (to !== currentSlug) router.push(`/products/${to}`);
    setPreviewBase(null);
  };

  // antique maps to "none": the geometry is parked, the photo fallback
  // covers the stage (decision 2026-08-31)
  const CLOSURE_MODE: Record<ClosureBase, "none" | "roller" | "reducer" | "dropper" | "sprayer" | "pump"> = {
    none: "none", roller: "roller", reducer: "reducer", dropper: "dropper",
    antique: "none", antiqueTassel: "none", sprayer: "sprayer", pump: "pump",
  };
  const closureFor = (base: ClosureBase) => CLOSURE_MODE[base];

  const isAntiquePreview = activeBase === "antique" || activeBase === "antiqueTassel";

  /* ---------------------------------------------------------- the stage */
  const stage = (
    <div className="relative h-full w-full overflow-hidden">
      {photoFallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoFallback} alt={`${groupTitle} — ${activeMeta?.name ?? ""}`}
             className="h-full w-full object-cover" />
      ) : fam ? (
        <Bottle3DViewer
          bodyId={fam.bodyForGlass?.[glass] ?? fam.bodyDefault}
          finish={fam.finish}
          glass={glass}
          closure={closureFor(activeBase)}
          capMat={capMat}
          rollerVariant="metal"
          trimMat={trimMat}
          backdrop="#a29383"
          className="h-full w-full"
          fill
        />
      ) : null}

      {/* LIVE 3D badge */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-[3px]
                      px-2.5 py-1.5 backdrop-blur"
           style={{ background: "rgba(29,29,31,.55)" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-gold" />
        <span className="text-xs font-semibold uppercase tracking-label text-white">
          {photoFallback ? "Product photo" : "Live 3D"}
        </span>
      </div>

      {/* preview toast */}
      <AnimatePresence>
        {previewBase && previewBase !== committedBase && activeMeta && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center
                       gap-2 rounded-[3px] px-5 py-3 text-sm text-white whitespace-nowrap"
            style={{ background: "rgba(29,29,31,.92)" }}
          >
            <Sparkle className="h-4 w-4 text-muted-gold" weight="fill" />
            <span>Previewing {activeMeta.name}</span>
            <span className="text-white/50">·</span>
            <button type="button" onClick={() => setPreviewBase(null)}
                    className="text-muted-gold underline underline-offset-[3px]">
              Return to {CLOSURE_META[committedBase]?.name ?? "bottle"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* drag affordance */}
      {!photoFallback && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center
                        gap-2 text-sm text-white/85 pointer-events-none">
          <HandGrabbing className="h-4 w-4" />
          <span>Drag to rotate</span>
        </div>
      )}
    </div>
  );

  /* ----------------------------------------------- swatch rows (seam) */
  const finishRow = (compact = false) => {
    const isBulb = isAntiquePreview;
    const trims = fam?.trims ?? [];
    return (
      <div className={compact ? "space-y-3" : "space-y-4"}>
        {isBulb && (
          <SwatchRow
            eyebrow="Bulb" mats={mats}
            options={["ANSP_BLACK","ANSP_WHITE","ANSP_RED","ANSP_PINK",
                      "ANSP_LAVENDER","ANSP_SILVER","ANSP_IVORY","ANSP_GOLD"]}
            names={{ ANSP_BLACK:"Black", ANSP_WHITE:"White", ANSP_RED:"Red",
                     ANSP_PINK:"Pink", ANSP_LAVENDER:"Lavender",
                     ANSP_SILVER:"Silver", ANSP_IVORY:"Ivory", ANSP_GOLD:"Gold" }}
            value={capMat} onChange={setCapMat}
          />
        )}
        <SwatchRow
          eyebrow="Fitment" mats={mats}
          options={trims}
          names={{ CAP_SHINY_BLACK:"Shiny black", CAP_SHINY_GOLD:"Shiny gold",
                   CAP_MATTE_GOLD:"Matte gold", CAP_MATTE_SILVER:"Matte silver",
                   CAP_SHINY_SILVER:"Shiny silver", CAP_COPPER:"Copper",
                   SPRAY_TURQUOISE:"Turquoise", SPRAY_RED:"Red" }}
          value={trimMat} onChange={setTrimMat}
        />
      </div>
    );
  };

  /* --------------------------------------------- identity header */
  const identity = (
    <header>
      {categoryLabel && (
        <p className="text-xs uppercase tracking-eyebrow font-semibold
                      text-gold-dim">
          {categoryLabel}
        </p>
      )}
      <h1 className="font-serif font-medium text-[30px] leading-[1.12]
                     tracking-[-0.02em] text-obsidian mt-1.5">
        {displayName ?? `${groupTitle} · ${capacityLabel}`}
      </h1>
    </header>
  );

  /* spec strip — the certainty facts inline (BuildDirect's dimension row,
     recast for B2B packaging: fitment is the consequential spec) */
  const specStrip = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-y
                    border-champagne/50 py-2.5 mt-4">
      {neckSize && (
        <span className="text-sm text-obsidian">
          <span className="text-slate">Neck</span>{" "}
          <span className="font-semibold">{neckSize}</span>
        </span>
      )}
      {capacityText && (
        <span className="text-sm text-obsidian">
          <span className="text-slate">Capacity</span>{" "}
          <span className="font-semibold">{capacityText}</span>
        </span>
      )}
      {caseQty ? (
        <span className="text-sm text-obsidian">
          <span className="text-slate">Case</span>{" "}
          <span className="font-semibold">{caseQty}</span>
        </span>
      ) : null}
      {skuLabel && (
        <span className="text-spec text-slate font-mono">{skuLabel}</span>
      )}
    </div>
  );

  /* price block — unit price leads; the tier teaser sells volume */
  const tierPrice = qty >= 12 && price12 ? price12
                  : qty >= 10 && price10 ? price10
                  : priceEach;
  const priceBlock = (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-4">
      {priceEach != null && (
        <p className="text-[28px] font-semibold text-obsidian tabular-nums leading-none">
          ${priceEach.toFixed(2)}
          <span className="text-sm font-normal text-slate ml-1.5">/each</span>
        </p>
      )}
      {price12 != null && price12 < (priceEach ?? Infinity) && (
        <a href="#volume-pricing" className="text-ui text-gold-dim underline
                                             underline-offset-2">
          ${price12.toFixed(2)} at 12+ · volume by quote
        </a>
      )}
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                        text-xs uppercase tracking-label font-semibold border
                        ${inStock
                          ? "text-[#1F6B49] border-[#2E9E6B]/30 bg-[#2E9E6B]/10"
                          : "text-amber-700 border-amber-300 bg-amber-50"}`}>
        <span className={`h-1.5 w-1.5 rounded-full
                          ${inStock ? "bg-[#2E9E6B]" : "bg-amber-500"}`} />
        {inStock ? "Available to order" : "Confirm availability"}
      </span>
    </div>
  );

  /* closure selector — compact tile row (their style swatches), with the
     guided use-case helper folded behind a link */
  const closureRow = (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-obsidian">
          <span className="text-slate">Closure:</span>{" "}
          <span className="font-semibold">{activeMeta?.name ?? "Bottle only"}</span>
        </p>
        <button type="button"
                onClick={() => setMode(mode === "guided" ? "direct" : "guided")}
                className="text-ui text-gold-dim underline underline-offset-2">
          {mode === "guided" ? "Hide guide" : "Help me choose"}
        </button>
      </div>

      {mode === "guided" && (
        <div className="grid grid-cols-5 gap-2 mt-3">
          {USE_CASES.map((u) => {
            const Icon = USE_CASE_ICON[u.icon];
            const active = useCase === u.id;
            return (
              <button key={u.id} type="button" onClick={() => setUseCase(u.id)}
                      aria-pressed={active}
                      className={`relative bg-white rounded-[3px] px-1.5 py-2.5
                                  flex flex-col items-center gap-1.5 transition-colors
                                  duration-200 focus-visible:outline-2
                                  focus-visible:outline-offset-2
                                  focus-visible:outline-muted-gold
                                  ${active
                                    ? "border-[1.5px] border-obsidian"
                                    : "border border-champagne hover:border-muted-gold"}`}>
                <Icon className="h-5 w-5 text-obsidian" />
                <span className="text-xs leading-tight text-center text-obsidian">
                  {u.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {ranked.map((base) => {
          const meta = base !== "none" ? CLOSURE_META[base] : null;
          const sib = siblingFor(base);
          const selected = activeBase === base;
          if (!meta) return null;
          const Glyph = CLOSURE_GLYPH[base] ?? SprayBottle;
          return (
            <button key={base} type="button"
                    onClick={() => setPreviewBase(base === committedBase ? null : base)}
                    aria-pressed={selected} title={meta.benefit}
                    className="shrink-0 w-[86px] text-center group">
              <div className={`relative aspect-square bg-product-well rounded-[3px]
                               overflow-hidden transition-colors duration-200
                               ${selected
                                 ? "border-[1.5px] border-obsidian"
                                 : "border border-champagne group-hover:border-muted-gold"}`}>
                {sib?.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sib.heroImageUrl} alt={meta.name}
                       className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Glyph className="h-7 w-7 text-obsidian/25" />
                  </span>
                )}
                {selected && (
                  <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full
                                   bg-obsidian flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" weight="bold" />
                  </span>
                )}
              </div>
              <span className={`block mt-1.5 text-spec leading-tight
                                ${selected ? "font-semibold text-obsidian" : "text-slate"}`}>
                {meta.name}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-spec text-slate">
        <CheckCircle className="h-3.5 w-3.5 text-gold-dim" />
        All {ranked.length} closures shown are verified to fit this bottle.
        {priceDelta(activeBase) && activeBase !== committedBase ? (
          <span className="text-obsidian tabular-nums ml-1">
            {priceDelta(activeBase)} vs current
          </span>
        ) : null}
      </p>
    </div>
  );

  /* CTA stack — sample-first (B2B buyers sample before they order),
     then quantity + add to cart, then the working price summary */
  const linePrice = tierPrice != null ? tierPrice * qty : null;
  const savings = priceEach != null && tierPrice != null && tierPrice < priceEach
    ? (priceEach - tierPrice) * qty : 0;
  const ctaStack = (
    <div className="mt-7">
      {sampleHref && (
        <>
          <a href={sampleHref}
             className="block w-full py-3.5 bg-obsidian text-white text-md
                        font-semibold text-center rounded-[3px] transition-colors
                        duration-200 hover:bg-muted-gold hover:text-obsidian
                        focus-visible:outline-2 focus-visible:outline-offset-2
                        focus-visible:outline-muted-gold">
            Request a free sample
          </a>
          <p className="text-spec text-slate mt-2">
            Samples ship fast — and Grace confirms fitment before you commit
            a production run.{" "}
            {onAskGrace && (
              <button type="button" onClick={onAskGrace}
                      className="text-gold-dim underline underline-offset-2">
                Ask Grace
              </button>
            )}
          </p>
        </>
      )}

      <div className="flex items-stretch gap-3 mt-4">
        <div className="flex items-center border border-champagne rounded-[3px]">
          <button type="button" aria-label="Decrease quantity"
                  onClick={() => onQtyChange?.(Math.max(1, qty - 1))}
                  className="px-3.5 py-2.5 text-obsidian hover:text-muted-gold
                             transition-colors duration-200">−</button>
          <span className="min-w-[2.5rem] text-center text-md font-semibold
                           text-obsidian tabular-nums">{qty}</span>
          <button type="button" aria-label="Increase quantity"
                  onClick={() => onQtyChange?.(qty + 1)}
                  className="px-3.5 py-2.5 text-obsidian hover:text-muted-gold
                             transition-colors duration-200">+</button>
        </div>
        <button type="button" onClick={onAddToCart}
                className="flex-1 flex items-center justify-center gap-2 py-2.5
                           border border-obsidian text-obsidian text-md font-semibold
                           rounded-[3px] transition-colors duration-200
                           hover:bg-obsidian hover:text-white
                           focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-muted-gold">
          <ShoppingBag className="h-4 w-4" />
          Add to cart
        </button>
      </div>

      {linePrice != null && (
        <div className="mt-4 rounded-[3px] border border-champagne/60 bg-travertine/40
                        px-4 py-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate">Your price</span>
            <span className="text-md font-semibold text-obsidian tabular-nums">
              ${linePrice.toFixed(2)}
            </span>
          </div>
          {savings > 0 && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate">Volume savings</span>
              <span className="text-sm font-semibold text-[#1F6B49] tabular-nums">
                −${savings.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-0.5">
            <a href="#volume-pricing"
               className="text-spec text-gold-dim underline underline-offset-2">
              Full volume pricing
            </a>
            {quoteHref && (
              <a href={quoteHref}
                 className="text-spec text-gold-dim underline underline-offset-2">
                Request a quote for 12+
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );

  /* ------------------------------------------------------- step panel */
  const stepPanel = (
    <div className="h-full overflow-y-auto px-6 lg:px-11 py-7">
      {identity}
      {specStrip}
      {priceBlock}
      {closureRow}
      <div className="mt-6">{finishRow()}</div>
      {ctaStack}
    </div>
  );

  /* --------------------------------------------------------- mobile */
  const mobile = (
    <div className="lg:hidden">
      <div className="px-4 pb-4">{identity}</div>
      <div className="mx-4 aspect-[10/13] rounded-[2px] overflow-hidden relative">
        {stage}
      </div>

      {/* summary chip */}
      <div className="mx-4 mt-4 flex items-center justify-between gap-3 bg-white
                      border border-champagne/55 rounded-md p-3.5">
        <span className="text-md text-obsidian min-w-0 truncate">
          {groupTitle} · {capacityLabel}
          {activeMeta ? ` · ${activeMeta.name}` : ""}
        </span>
        <button type="button" onClick={() => setShowAll(true)}
                className="shrink-0 text-sm font-semibold text-gold-dim">
          Edit ›
        </button>
      </div>

      {/* step 2 rail */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-obsidian">
            2. Choose how it dispenses
          </h2>
          <CaretDown className="h-4 w-4 text-slate" />
        </div>
        <div className="mt-3 -mx-4 px-4 flex gap-2.5 overflow-x-auto pb-1
                        [scrollbar-width:none]">
          {ranked.map((base) => {
            const meta = base !== "none" ? CLOSURE_META[base] : null;
            const sib = siblingFor(base);
            const selected = activeBase === base;
            if (!meta) return null;
            return (
              <button key={base} type="button"
                      onClick={() => setPreviewBase(base === committedBase ? null : base)}
                      className="shrink-0 w-[118px] text-left">
                <div className={`relative aspect-square bg-product-well rounded-[3px]
                                 ${selected ? "border-[1.5px] border-obsidian"
                                            : "border border-champagne"}`}>
                  {sib?.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sib.heroImageUrl} alt={meta.name}
                         className="h-full w-full object-cover rounded-[2px]" />
                  ) : (() => {
                    const Glyph = CLOSURE_GLYPH[base] ?? SprayBottle;
                    return (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Glyph className="h-8 w-8 text-obsidian/25" />
                      </span>
                    );
                  })()}
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 h-[22px] w-[22px]
                                     rounded-full bg-obsidian flex items-center
                                     justify-center">
                      <Check className="h-3 w-3 text-white" weight="bold" />
                    </span>
                  )}
                </div>
                <div className={`mt-0 px-2 py-1.5 bg-white border border-t-0
                                 border-champagne rounded-b-[3px] text-md
                                 ${selected ? "font-semibold border-obsidian" : ""}`}>
                  {meta.name.split(" ")[0] === "Fine" ? "Spray"
                    : meta.name.split(" ")[0] === "Bulb" ? "Bulb"
                    : meta.name.split(" ")[0] === "Glass" ? "Dropper"
                    : meta.name.split(" ")[0] === "Pour" ? "Reducer"
                    : meta.name.split(" ")[0] === "Lotion" ? "Pump"
                    : meta.name.split(" ")[0]}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate">
          <CheckCircle className="h-4 w-4 text-gold-dim" />
          All {ranked.length} options shown are verified to fit this bottle.
        </p>
      </div>

      {/* finish swatches */}
      <div className="mt-5 px-4">{finishRow(true)}</div>

      {/* Grace hook */}
      {onAskGrace && (
        <p className="mt-6 px-4 flex items-center gap-2 text-sm text-slate">
          <ChatCircle className="h-4 w-4" />
          Need help choosing?{" "}
          <button type="button" onClick={onAskGrace}
                  className="text-gold-dim underline underline-offset-2">
            Ask Grace
          </button>
        </p>
      )}

      {/* sticky buy bar */}
      <div className="fixed bottom-3 left-3 right-3 z-40 flex items-center gap-3
                      bg-white border border-champagne/50 rounded-[10px] p-2.5"
           style={{ boxShadow: "var(--shadow-drawer)" }}>
        <div className="h-[52px] w-[52px] rounded-md bg-product-well overflow-hidden
                        shrink-0">
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate">Your bottle</p>
          {priceEach != null && (
            <p className="text-[17px] font-semibold text-obsidian tabular-nums">
              ${priceEach.toFixed(2)} <span className="text-sm font-normal">each</span>
            </p>
          )}
        </div>
        <button type="button" onClick={onAddToCart}
                className="flex items-center gap-2 min-h-[44px] px-5 bg-obsidian
                           text-white text-base font-semibold rounded-lg
                           transition-colors duration-200 hover:bg-muted-gold
                           hover:text-obsidian">
          <ShoppingBag className="h-4 w-4" />
          Add to cart
        </button>
      </div>
      <div className="h-24" />
    </div>
  );

  return (
    <section className="w-full">
      {/* desktop 50/50 */}
      <div className="hidden lg:grid grid-cols-2 h-[calc(100vh-140px)]
                      min-h-[620px] max-h-[860px] border border-champagne/40
                      rounded-sm overflow-hidden bg-white">
        <div className="relative">{stage}</div>
        {stepPanel}
      </div>
      {mobile}
    </section>
  );
}

/* ---------------------------------------------------- SwatchRow (seam) */
function SwatchRow({ eyebrow, options, names, value, onChange, mats }: {
  eyebrow: string;
  options: string[];
  names: Record<string, string>;
  value: string;
  onChange: (id: string) => void;
  mats: Record<string, SwatchableMaterial> | null;
}) {
  if (!options.length) return null;
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-label">
        <span className="text-slate">{eyebrow}</span>
        <span className="text-slate"> · </span>
        <span className="text-obsidian normal-case tracking-normal text-caption">
          {names[value] ?? value}
        </span>
      </p>
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {options.map((id) => (
          <button key={id} type="button" onClick={() => onChange(id)}
                  aria-label={names[id] ?? id} aria-pressed={value === id}
                  title={names[id] ?? id}
                  className={`h-[26px] w-[26px] rounded-full transition-all duration-200
                              focus-visible:outline-2 focus-visible:outline-offset-2
                              focus-visible:outline-muted-gold
                              ${value === id
                                ? "outline outline-2 outline-offset-2 outline-obsidian"
                                : "ring-1 ring-champagne hover:ring-ash"}`}
                  style={{ background: swatchFor(mats, id) }} />
        ))}
      </div>
    </div>
  );
}
