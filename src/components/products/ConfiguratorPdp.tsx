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
import { CLOSURE_META } from "@/lib/configurator/useCases";
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
  neckSize, capacityText, skuLabel, price10, price12, priceTiers,
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
  /** the real 5-step ladder; when present it replaces price10/price12 */
  priceTiers?: Array<{ minQty: number; unitPrice: number; totalPrice?: number }> | null;
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

  const [capMat, setCapMat] = useState("ANSP_BLACK");
  const [trimMat, setTrimMat] = useState(
    fam?.trims?.[0] ?? "CAP_SHINY_BLACK");
  const [tiersOpen, setTiersOpen] = useState(false);
  const [mats, setMats] = useState<Record<string, SwatchableMaterial> | null>(null);
  useEffect(() => {
    let dead = false;
    fetch("/models/materials.json").then((r) => r.json())
      .then((j) => { if (!dead) setMats(j.materials); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const activeBase = committedBase;

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

  // ONE row of actual components in a stable trade order (Jordan:
  // "just one row ... the actual components ... reducer, roll-on, spray,
  // lotion") — no use-case re-ranking layer
  const COMPONENT_ORDER: ClosureBase[] = [
    "sprayer", "roller", "pump", "dropper", "reducer", "antique", "antiqueTassel"];
  const ranked = useMemo(
    () => COMPONENT_ORDER.filter((b) => sellableBases.includes(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sellableBases]);

  const activeMeta = CLOSURE_META[activeBase] ?? null;

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
  // the ladder: real 5-step tiers when synced, else the legacy 1/10/12
  const ladder = useMemo(() => {
    if (priceTiers?.length) {
      return [...priceTiers].sort((a, b) => a.minQty - b.minQty)
        .map((t) => ({ minQty: t.minQty, price: t.unitPrice }));
    }
    const out = [{ minQty: 1, price: priceEach ?? 0 }];
    if (price10 != null && priceEach != null && price10 < priceEach)
      out.push({ minQty: 10, price: price10 });
    if (price12 != null && priceEach != null && price12 < priceEach)
      out.push({ minQty: 12, price: price12 });
    return out;
  }, [priceTiers, price10, price12, priceEach]);

  const activeTier = [...ladder].reverse().find((t) => qty >= t.minQty) ?? ladder[0];
  const nextTier = ladder.find((t) => t.minQty > qty) ?? null;
  const tierPrice = activeTier?.price ?? priceEach;
  const priceBlock = (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-3.5">
      {priceEach != null && (
        <p className="text-[28px] font-semibold text-obsidian tabular-nums leading-none">
          ${priceEach.toFixed(2)}
          <span className="text-sm font-normal text-slate ml-1.5">/each</span>
        </p>
      )}
      {ladder.length > 1 && (
        <a href="#volume-pricing" onClick={() => setTiersOpen(true)}
           className="text-ui text-gold-dim underline underline-offset-2">
          ${ladder[ladder.length - 1].price.toFixed(2)} at{" "}
          {ladder[ladder.length - 1].minQty}+ · {ladder.length} volume tiers
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

  /* closure selector — ONE row of the actual closure components */
  const closureRow = (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-eyebrow font-semibold text-slate">
          Compatible closures
          <span className="normal-case tracking-normal text-caption text-obsidian ml-2">
            {activeMeta?.name ?? "Bottle only"}
          </span>
        </p>
        {neckSize && (
          <p className="text-spec text-slate shrink-0">{neckSize} neck</p>
        )}
      </div>

      <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {ranked.map((base) => {
          const meta = base !== "none" ? CLOSURE_META[base] : null;
          const sib = siblingFor(base);
          const selected = activeBase === base;
          if (!meta) return null;
          return (
            <ClosureTile key={base} name={meta.name} benefit={meta.benefit}
                         imageUrl={sib?.heroImageUrl ?? null}
                         glyph={CLOSURE_GLYPH[base] ?? SprayBottle}
                         selected={selected}
                         onClick={() => commit(base)} />
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-spec text-slate">
        <CheckCircle className="h-3.5 w-3.5 text-gold-dim" />
        All {ranked.length} closures are verified to fit
        {neckSize ? ` the ${neckSize} neck` : " this bottle"}.
      </p>
    </div>
  );

  /* CTA stack — sample-first (B2B buyers sample before they order),
     then quantity + add to cart, then the working price summary */
  const linePrice = tierPrice != null ? tierPrice * qty : null;
  const ctaStack = (
    <div className="mt-5">
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

      {priceEach != null && ladder.length > 0 && (
        <div id="volume-pricing" style={{ scrollMarginTop: 120 }}
             className="mt-4 border-y border-champagne/50">
          <button type="button" onClick={() => setTiersOpen((v) => !v)}
                  aria-expanded={tiersOpen}
                  className="w-full flex items-center justify-between py-3">
            <span className="text-xs uppercase tracking-eyebrow font-semibold text-slate">
              Volume pricing · by quote
            </span>
            <span className="flex items-baseline gap-3">
              {ladder.length > 1 && (
                <span className="text-spec text-slate tabular-nums">
                  from ${ladder[ladder.length - 1].price.toFixed(2)} ea
                </span>
              )}
              <CaretDown className={`h-3.5 w-3.5 text-slate transition-transform
                                     duration-200 ${tiersOpen ? "rotate-180" : ""}`} />
            </span>
          </button>

          {tiersOpen && (<>
            <div className="pb-1 space-y-1">
              {ladder.map((t) => {
                const active = activeTier?.minQty === t.minQty;
                const save = priceEach > 0
                  ? Math.round((1 - t.price / priceEach) * 100) : 0;
                return (
                  <button key={t.minQty} type="button"
                          onClick={() => onQtyChange?.(t.minQty)}
                          aria-label={`Set quantity to ${t.minQty}`}
                          className={`w-full flex items-baseline justify-between rounded-[2px]
                                      px-2.5 py-2 text-left transition-colors duration-200
                                      ${active
                                        ? "bg-white ring-1 ring-champagne/60"
                                        : "hover:bg-white/60"}`}>
                    <span className={`text-sm ${active ? "font-semibold text-obsidian" : "text-slate"}`}>
                      {t.minQty.toLocaleString()}+ units
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className={`text-sm tabular-nums ${active ? "font-semibold text-obsidian" : "text-obsidian"}`}>
                        ${t.price.toFixed(2)} ea
                      </span>
                      {save > 0 && (
                        <span className="text-2xs uppercase tracking-label font-semibold
                                         text-[#1F6B49] bg-[#2E9E6B]/10 border border-[#2E9E6B]/30
                                         rounded-full px-1.5 py-0.5">
                          Save {save}%
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {linePrice != null && (
              <div className="flex items-baseline justify-between mt-1 pt-2 border-t border-champagne/50">
                <span className="text-sm text-slate">Your price · {qty.toLocaleString()} unit{qty === 1 ? "" : "s"}</span>
                <span className="text-md font-semibold text-obsidian tabular-nums">
                  ${linePrice.toFixed(2)}
                </span>
              </div>
            )}
            <p className="text-spec text-slate mt-2 pb-3">
              Volume rates are confirmed on a quote — online checkout is billed
              at the ${priceEach.toFixed(2)}/ea rate.{" "}
              {quoteHref && (
                <a href={quoteHref} className="font-semibold text-gold-dim underline underline-offset-2">
                  Request a quote
                </a>
              )}
            </p>
          </>)}
        </div>
      )}

      {/* next-tier nudge — one tap to the next price break */}
      {nextTier && priceEach != null && nextTier.price < priceEach && (
        <button type="button" onClick={() => onQtyChange?.(nextTier.minQty)}
                className="w-full mt-3 flex items-center justify-between gap-3 rounded-[3px]
                           border border-muted-gold/40 bg-muted-gold/10 px-3 py-2.5
                           text-left transition-colors duration-200
                           hover:bg-muted-gold hover:text-obsidian group">
          <span className="text-spec text-obsidian">
            Add <span className="font-semibold">{(nextTier.minQty - qty).toLocaleString()} more</span>{" "}
            to reach <span className="font-semibold">{nextTier.minQty.toLocaleString()}+</span> at{" "}
            <span className="font-semibold">${nextTier.price.toFixed(2)}/ea</span>
          </span>
          <span className="shrink-0 text-2xs uppercase tracking-label font-semibold text-gold-dim
                           group-hover:text-obsidian">
            Save {Math.round((1 - nextTier.price / priceEach) * 100)}%
          </span>
        </button>
      )}
    </div>
  );

  /* ------------------------------------------------------- step panel */
  const stepPanel = (
    <div className="h-full overflow-y-auto px-1.5">
      {identity}
      {specStrip}
      {priceBlock}
      {closureRow}
      <div className="mt-6 pt-5 border-t border-champagne/50">{finishRow()}</div>
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
        <span className="shrink-0 text-sm font-semibold text-gold-dim">
          Edit below
        </span>
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
                      onClick={() => commit(base)}
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
      {/* desktop 50/50 — tone-on-background, no card chrome (Jordan:
          "we don't need that card... give a little bit more width") */}
      <div className="hidden lg:grid grid-cols-2 gap-10 h-[calc(100vh-150px)]
                      min-h-[600px] max-h-[820px]">
        <div className="relative rounded-sm overflow-hidden">{stage}</div>
        {stepPanel}
      </div>
      {mobile}
    </section>
  );
}

/* ------------------------------------------------------- ClosureTile */
function ClosureTile({ name, benefit, imageUrl, glyph: Glyph, selected, onClick }: {
  name: string; benefit: string; imageUrl: string | null;
  glyph: typeof SprayBottle; selected: boolean; onClick: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = imageUrl && !broken;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
            title={benefit} className="shrink-0 w-24 text-center group">
      <div className={`relative aspect-square bg-product-well rounded-[3px]
                       overflow-hidden transition-colors duration-200
                       ${selected
                         ? "border-[1.5px] border-obsidian"
                         : "border border-champagne group-hover:border-muted-gold"}`}>
        {showImg ? (
          // the swatch shows the CLOSURE, not a shrunken bottle: the
          // renders are 2080x2288 packshots with the closure at the top,
          // so crop to the upper portion (Jordan: "the actual photo of
          // that component, the top of it")
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} onError={() => setBroken(true)}
               className="absolute left-1/2 top-0 max-w-none w-[185%]
                          -translate-x-1/2 -translate-y-[4%]" />
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
        {name}
      </span>
    </button>
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
      <div className="flex items-center gap-3 flex-wrap mt-2.5">
        {options.map((id) => (
          <button key={id} type="button" onClick={() => onChange(id)}
                  aria-label={names[id] ?? id} aria-pressed={value === id}
                  title={names[id] ?? id}
                  className={`h-8 w-8 rounded-full transition-all duration-200
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
