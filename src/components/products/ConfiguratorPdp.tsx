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
import { HandSoap, HandGrabbing, CaretLeft, CaretDown, CheckCircle, TestTube, Cube,
         Camera, Stack, Copy, Flask as BottleGlyph } from "@phosphor-icons/react";
import { GLASS_PRESETS, type GlassPresetId } from "@/lib/materials/glassPresets";
import { familyForSlugOrDerived, glassFromSlug, CLOSURE_TOKENS,
         type ConfiguratorFamily, type ClosureBase }
  from "@/lib/configurator/families";
import { CLOSURE_META } from "@/lib/configurator/useCases";
import { swatchFor, type SwatchableMaterial } from "@/lib/materials/materialSwatch";
import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import { resolveCapOptionPhoto } from "@/lib/products/closure-swatch-keys";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { useGLTF } from "@react-three/drei";

/** every slug token a base may carry in this family, the family's own first */
function tokensFor(fam: ConfiguratorFamily, base: ClosureBase): string[] {
  const own = fam.slugClosure[base];
  const all = base === "none" ? [] : CLOSURE_TOKENS[base] ?? [];
  return [...new Set([...(own ? [own] : []), ...all])];
}

/** kit slots that come off when the customer lifts the cap; everything else is fitted */
const REMOVABLE_SLOTS = new Set(["cap", "overcap"]);

/**
 * Fitment swatches are photographs, not colour dots, wherever the closure has
 * been rendered as a component plate (Jordan, 2 Sep: the component contact
 * sheets "would be ideal to use for selecting the fitments"). A bottle SKU and
 * a component SKU meet on the FINISH the reviewed vocabulary reads off each —
 * GBCyl9MtlRollShBlk and CpRoll17-415ShnBlk both say "Shiny Black" — so no new
 * SKU rule is invented here; when no component plate exists the dot stays.
 *
 * Component families are `<closure>-<neck>`; the closure comes from the base
 * the customer is on. A family can carry a neighbour's parts (roll-on-cap-17-415
 * also holds the three lotion pumps), so a swatch never borrows a photograph
 * whose SKU begins with another closure's prefix.
 */
const COMPONENT_FAMILY: Partial<Record<ClosureBase, string>> = {
  roller: "roll-on-cap", sprayer: "sprayer", pump: "lotion-pump", dropper: "dropper", none: "cap-closure",
  // a reducer's cap is a plain screw cap: the 18-415 reducer caps
  // (18-415CpRdcr…) are published in the cap-closure family
  reducer: "cap-closure",
};
const FOREIGN_PREFIX: Partial<Record<ClosureBase, RegExp>> = {
  roller: /^(Ltn|Spry|Drp)/i, sprayer: /^(Ltn|Drp|CpRoll)/i, pump: /^(Spry|Drp|CpRoll)/i, dropper: /^(Ltn|Spry|CpRoll)/i,
  reducer: /^(Ltn|Spry|Drp|CpRoll)/i, none: /^(Ltn|Spry|Drp)/i,
};

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

/** fitment swatch name -> materials.json token. The PDP's cap options are
 *  SKU-derived display names ("Pink", "Shiny Black", "Matte Silver"); the
 *  renderer needs the token that carries the approved material values. */
function capTokenFor(name: string | null | undefined): string {
  const n = (name ?? "").toLowerCase()
    .replace(/^(spray|screw cap|lotion pump|perfume (spray )?pump|roller|roll[-\s]on|dropper|atomizer|reducer|cap[/\s]*closure)\s+/i, "")
    .replace(/\s+tall$/i, "").trim();
  if (n.includes("leather")) {
    if (n.includes("black")) return "LEATHER_BLACK";
    if (n.includes("light brown")) return "LEATHER_LIGHT_BROWN";
    if (n.includes("brown")) return "LEATHER_BROWN";
    if (n.includes("ivory")) return "LEATHER_IVORY";
    if (n.includes("pink")) return "LEATHER_PINK";
  }
  if (n.includes("dot")) {
    if (n.includes("pink")) return "CAP_DOTS_PINK";
    if (n.includes("silver")) return "CAP_DOTS_SILVER";
    return "CAP_DOTS_BLACK";
  }
  if (n.includes("copper")) return "CAP_COPPER";
  if (n.includes("gold")) return n.includes("matte") ? "CAP_MATTE_GOLD" : "CAP_SHINY_GOLD";
  if (n.includes("silver")) return n.includes("matte") ? "CAP_MATTE_SILVER" : "CAP_SHINY_SILVER";
  if (n.includes("white") || n.includes("clear") || n.includes("ivory")) return "CAP_WHITE";
  if (n.includes("pink")) return "CAP_PINK";
  if (n.includes("turquoise")) return "SPRAY_TURQUOISE";
  if (n.includes("red")) return "SPRAY_RED";
  return "CAP_SHINY_BLACK";
}

/** rail tile fills per colourway — glass reads as a gradient, not a dot */
const GLASS_TILE: Record<string, string> = {
  clear: "linear-gradient(150deg,#f7f9f8 0%,#dde3e1 55%,#c9d1cf 100%)",
  frosted: "linear-gradient(150deg,#f4f5f4 0%,#e3e6e4 55%,#d2d6d4 100%)",
  amber: "linear-gradient(150deg,#c98a45 0%,#8a4c16 55%,#5b3010 100%)",
  cobalt: "linear-gradient(150deg,#3f63d6 0%,#1d3aa8 55%,#12246b 100%)",
  swirl: "linear-gradient(150deg,#efe7d8 0%,#dccfb4 55%,#c3b392 100%)",
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

/** sessionStorage key for the stage mode ("3d" | "photo") */
/** Resolve once the bytes are ready to paint. A cached part resolves immediately,
 *  which is why swapping a cap costs one frame and not a fade. */
function decodeImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => (img.decode ? img.decode().then(() => resolve(), () => resolve()) : resolve());
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

const STAGE_MODE_KEY = "bb:pdp-stage";

export default function ConfiguratorPdp({
  currentSlug, groupTitle, capacityLabel, priceEach, stepCountLabel,
  siblings, heroImageUrl, onAddToCart, onAskGrace,
  displayName, categoryLabel, inStock = true, caseQty,
  neckSize, capacityText, skuLabel, graceSku, websiteSku, price10, price12, priceTiers,
  quoteHref, qty = 1, onQtyChange,
  capOptions, capOptionPhotoKeys, activeCapOption, onCapOptionChange, capSwatchStyle, glassOptions,
  rollerVariant: rollerVariantProp, rollerVariantsAvailable, onRollerVariantChange,
  plateImage = null, plateImageCapOff = null, variantImageUrl = null,
}: {
  currentSlug: string;
  /** paper-doll plate for the SELECTED SKU (productPlates index, served from Vercel Blob): the
   *  stage leads with this photograph; 3D is a toggle on top of it */
  plateImage?: string | null;
  plateImageCapOff?: string | null;
  /** the selected SKU's catalogue photograph: the stage's fallback when the
   *  SKU has no plate (never photographed as a plate, or not built yet) */
  variantImageUrl?: string | null;
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
  /** the selected SKU, for the component kit — the stage stacks the kit's
   *  parts when one exists, so changing a cap changes the cap and nothing else */
  graceSku?: string | null;
  websiteSku?: string | null;
  price10?: number | null;     // 10+ tier unit price
  price12?: number | null;     // 12+ tier unit price
  /** the real 5-step ladder; when present it replaces price10/price12 */
  priceTiers?: Array<{ minQty: number; unitPrice: number; totalPrice?: number }> | null;
  quoteHref?: string;
  /** SKU TRUTH for the fitment row: the cap/trim colourways this closure
   *  actually ships in, derived from the group's own variants. A reducer
   *  has ~14 caps, a lotion pump far fewer, a bulb its own colourways —
   *  a single hardcoded palette was wrong for every closure but spray. */
  /** Roller material is a separate catalogue SKU (Metal Roller Ball vs
   *  Plastic Roller Ball), so the chooser is CONTROLLED by the product page:
   *  picking Plastic switches the applicator, and the SKU, plate and price
   *  follow. Uncontrolled (3D-only) when the page passes nothing. */
  rollerVariant?: "metal" | "plastic";
  rollerVariantsAvailable?: Array<"metal" | "plastic">;
  onRollerVariantChange?: (variant: "metal" | "plastic") => void;
  capOptions?: string[];
  /** per pill, the token swatch names its variants' website SKUs spell — the
   *  component families are keyed by token ("Pink"), the pills by catalogue
   *  colourway ("Pink with Dots"); see src/lib/products/closure-swatch-keys.ts */
  capOptionPhotoKeys?: Record<string, string[]>;
  activeCapOption?: string | null;
  onCapOptionChange?: (name: string) => void;
  capSwatchStyle?: (name: string) => React.CSSProperties;
  /** glass colourways this family sells, for the stage-side rail */
  glassOptions?: Array<{ id: string; label: string; href: string;
                        active: boolean; imageUrl?: string | null }>;
  qty?: number;
  onQtyChange?: (n: number) => void;
}) {
  const router = useRouter();
  const fam = familyForSlugOrDerived(currentSlug);
  const slugGlass: GlassPresetId = fam ? glassFromSlug(fam, currentSlug) : "clear";
  // optimistic: the canvas swaps the instant a colourway is picked, while
  // the slug (SKU/pricing truth) is replaced underneath without a reload
  const [glassOverride, setGlassOverride] = useState<GlassPresetId | null>(null);
  const [rollerLocal, setRollerLocal] = useState<"metal" | "plastic">("metal");
  const rollerVariant = rollerVariantProp ?? rollerLocal;
  const setRollerVariant = (variant: "metal" | "plastic") => {
    setRollerLocal(variant);
    onRollerVariantChange?.(variant);
  };
  const rollerOffered = (variant: "metal" | "plastic") =>
    !rollerVariantsAvailable || rollerVariantsAvailable.includes(variant);
  const [withCap, setWithCap] = useState(false);
  // Photographs lead; the 3D viewer is opened by the customer, never for
  // them. Nothing about it -- its chunk, a WebGL context, the GLB -- is
  // paid for until this flips.
  //
  // The choice outlives the page. A glass or closure swap NAVIGATES to the
  // sibling slug, and Next remounts the [slug] segment, so plain state would
  // drop the customer back to the photograph every time they changed
  // colour in 3D (Jordan, 2026-09-01). The mode is kept for the session and
  // re-applied on mount; the server always renders the photograph, so
  // there is nothing to mismatch on hydration.
  const [show3d, setShow3dState] = useState(false);
  // Exploded: the kit's parts slide apart along the axis by the offsets the
  // builder recorded (`exploded.dx/dy`, plate pixels). Only a kitted SKU has
  // them, so the mode is offered only when the stack is on screen.
  const [exploded, setExploded] = useState(false);
  const [skuCopied, setSkuCopied] = useState(false);
  // URLs whose <img> fired onError this session: the stage falls through to
  // the catalogue photograph instead of showing a broken image on white.
  const [brokenPlates, setBrokenPlates] = useState<ReadonlySet<string>>(() => new Set());
  // The component kit for this SKU.
  //
  // Two things make a colourway change seamless, and both are about NOT letting
  // the stage go empty:
  //
  //   1. useQuery returns undefined while the next SKU's kit loads. Treating
  //      that as "no kit" tears the whole stack down — measured at 30 ms after a
  //      cap click: three part images unmounted, the flat plate faded back in,
  //      then the parts faded in again. The entire bottle flashed to change a
  //      cap. So the last resolved kit is held until the next one resolves.
  //   2. The new parts are decoded BEFORE they go on screen. Body and fitment
  //      keep the URLs they already had, so they come from cache instantly and
  //      only the cap is genuinely new; when its bytes are ready the whole set
  //      swaps in one frame. No fade, because there is nothing to hide.
  const kitQuery = useQuery(
    api.productKits.forSku,
    graceSku || websiteSku ? { graceSku: graceSku ?? null, websiteSku: websiteSku ?? null } : "skip",
  );
  const [heldKit, setHeldKit] = useState<typeof kitQuery>(undefined);
  useEffect(() => { if (kitQuery !== undefined) setHeldKit(kitQuery); }, [kitQuery]);
  const kit = kitQuery === undefined ? heldKit : kitQuery;

  // "Without cap" on a kitted SKU removes the cap PART. The cap-off PLATE swap
  // below still happens, but the kit stacks above the plate, so with the cap
  // part left in the stack the toggle did nothing visible (Jordan, 2 Sep).
  // The body and fitment stay exactly where they were — that is the whole
  // point of a kit — and only the removable closure leaves.
  const targetParts = useMemo(() => {
    if (!kit?.parts?.length) return null;
    const parts = [...kit.parts].sort((a, b) => a.zOrder - b.zOrder);
    return withCap ? parts : parts.filter((p) => !REMOVABLE_SLOTS.has(p.slot));
  }, [kit, withCap]);
  // what is actually on screen: only ever a fully decoded set
  const [shownParts, setShownParts] = useState<typeof targetParts>(null);
  useEffect(() => {
    // Still loading: keep whatever is on screen rather than emptying the stage.
    if (kitQuery === undefined) return;
    // Resolved with no kit — a SKU that was never kitted. The stale stack would
    // otherwise keep showing the PREVIOUS bottle, which is worse than a flat plate.
    if (!targetParts?.length) { setShownParts(null); return; }
    let cancelled = false;
    Promise.all(targetParts.map((part) => decodeImage(part.image.url)))
      .then(() => { if (!cancelled) setShownParts(targetParts); })
      .catch(() => { if (!cancelled) setShownParts(null); });   // fall back to the plate
    return () => { cancelled = true; };
  }, [kitQuery, targetParts]);
  const kitReady = Boolean(shownParts?.length);
  const kitParts = shownParts;
  const markPlateBroken = (url: string) => {
    console.error("[plates] image failed to load", url);
    setBrokenPlates((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  };
  useEffect(() => {
    try { if (window.sessionStorage.getItem(STAGE_MODE_KEY) === "3d") setShow3dState(true); } catch {}
  }, []);
  const setShow3d = (next: boolean | ((on: boolean) => boolean)) => {
    setShow3dState((on) => {
      const value = typeof next === "function" ? next(on) : next;
      try { window.sessionStorage.setItem(STAGE_MODE_KEY, value ? "3d" : "photo"); } catch {}
      return value;
    });
  };
  useEffect(() => { setGlassOverride(null); }, [currentSlug]);
  const glass: GlassPresetId = glassOverride ?? slugGlass;
  const committedToken = currentSlug.split("-").pop() ?? "";
  const committedBase: ClosureBase =
    fam?.closureFromSlug[committedToken] ?? (fam?.derived ? "none" : "sprayer");

  const [capMatLocal, setCapMat] = useState("ANSP_BLACK");
  const [trimMatLocal, setTrimMat] = useState(
    fam?.trims?.[0] ?? "CAP_SHINY_BLACK");
  // when the fitment row is SKU-driven, the selected colourway is the
  // material for both the cap and the spray/pump trim
  const skuToken = capOptions?.length ? capTokenFor(activeCapOption) : null;
  const capMat = skuToken ?? capMatLocal;
  const trimMat = skuToken ?? trimMatLocal;
  const [tiersOpen, setTiersOpen] = useState(false);
  const [mats, setMats] = useState<Record<string, SwatchableMaterial> | null>(null);
  useEffect(() => {
    let dead = false;
    fetch("/models/materials.json").then((r) => r.json())
      .then((j) => { if (!dead) setMats(j.materials); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const activeBase = committedBase;

  // a roll-on SKU with a cap colourway IS a capped product ("Pink Dotted
  // Cap") — render the cap by default; the toggle can still remove it
  useEffect(() => {
    setWithCap((committedBase === "roller" || committedBase === "reducer")
      && (capOptions?.length ?? 0) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlug, committedBase]);

  // warm the sibling colourway bodies: same family, so a swap should not
  // hit a loader
  useEffect(() => {
    if (!fam || fam.photoOnly) return;
    const ids = new Set<string>([fam.bodyDefault]);
    for (const g of fam.glasses) {
      const b = fam.bodyForGlass?.[g];
      if (b) ids.add(b);
    }
    for (const id of ids) {
      try { useGLTF.preload(`/models/bodies-thickness/${id}.glb`); } catch {}
    }
  }, [fam]);

  // sibling lookup: slug token -> sibling row (price, photo)
  const siblingFor = useMemo(() => {
    const bySlug = new Map<string, Sibling>();
    for (const s of siblings) if (s.slug) bySlug.set(s.slug, s);
    return (base: ClosureBase): Sibling | null => {
      if (!fam) return null;
      const colour = fam.slugColour[glass] ?? "clear";
      // a sibling may live under any of the tokens the catalogue writes for
      // this base (perfumespray beside finemist): take the one that exists
      for (const token of tokensFor(fam, base)) {
        const hit = bySlug.get(fam.buildSlug(colour, token));
        if (hit) return hit;
      }
      return null;
    };
  }, [siblings, fam, glass]);

  /** every closure this family SELLS in this colourway (registry ∪ catalog
   *  antique photo groups — decision: bulb selectable, photo fallback) */
  const sellableBases = useMemo(() => {
    const out: ClosureBase[] = [];
    if (!fam) return out;
    for (const b of fam.bases) if (b !== "none") out.push(b);
    if (fam.derived) {
      // read off a slug, so it claims every base; keep the ones that exist
      return out.filter((b) => b === activeBase || siblingFor(b) !== null);
    }
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
  void CLOSURE_META;
  const ranked = useMemo(
    () => COMPONENT_ORDER.filter((b) => sellableBases.includes(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sellableBases]);

  const activeMeta = activeBase === "none" ? null : CLOSURE_META[activeBase] ?? null;

  const priceDelta = (base: ClosureBase): string => {
    const sib = siblingFor(base);
    if (sib?.priceRangeMin == null || priceEach == null) return "";
    const d = sib.priceRangeMin - priceEach;
    return `${d >= 0 ? "+" : "−"}$${Math.abs(d).toFixed(2)}`;
  };

  const antiqueSibling = siblingFor("antique");
  // bulb has no live 3D (parked): the stage shows the product photo
  // Without a plate the stage shows a photograph, never nothing: the SKU's
  // own catalogue image first, then the group's hero.
  const photoFallback =
    variantImageUrl
    ?? (activeBase === "antique" || activeBase === "antiqueTassel"
      ? (antiqueSibling?.heroImageUrl ?? heroImageUrl ?? null)
      : (heroImageUrl ?? null));

  const commit = (base: ClosureBase) => {
    if (!fam) return;
    const colour = fam.slugColour[glass];
    const token = tokensFor(fam, base).find((t) => colour && siblings.some((sb) => sb.slug === fam.buildSlug(colour, t)))
      ?? fam.slugClosure[base];
    if (!token || !colour) return;
    const to = fam.buildSlug(colour ?? "clear", token ?? "");
    if (to !== currentSlug) router.replace(`/products/${to}`, { scroll: false });
  };

  // antique maps to "none": the geometry is parked, the photo fallback
  // covers the stage (decision 2026-08-31)
  const CLOSURE_MODE: Record<ClosureBase, string> = {
    none: "none", roller: "roller", reducer: "reducerCapped", dropper: "dropper",
    antique: "none", antiqueTassel: "none", sprayer: "sprayer", pump: "pump",
  };
  /** which closures can wear a cap/overcap on top */
  const CAPPABLE: Partial<Record<ClosureBase, string>> = {
    none: "capped", roller: "rollerCapped", reducer: "reducerCapped",
    sprayer: "sprayerCapped", pump: "pumpCapped",
  };
  const kitHasCap = Boolean(kit?.parts?.some((p) => REMOVABLE_SLOTS.has(p.slot)));

  // photographed fitment swatches for this closure at this neck (see COMPONENT_FAMILY)
  const componentFamilyId = neckSize && COMPONENT_FAMILY[activeBase]
    ? `${COMPONENT_FAMILY[activeBase]}-${neckSize}` : null;
  const componentPlates = useQuery(api.productPlates.byFamily,
    componentFamilyId ? { familyId: componentFamilyId, limit: 200 } : "skip");
  // At some necks the plain screw caps were published into the roll-on-cap
  // family (13-415: CP13-415Gl, CP13-415Sl, … beside CPRoll13-415…), so a
  // bottle on its cap has no cap-closure family to draw from. Read the
  // roll-on-cap family too and keep only its non-roll-on rows.
  const wantsCapFallback = (activeBase === "none" || activeBase === "reducer") && Boolean(neckSize)
    && componentPlates !== undefined && (componentPlates?.page.length ?? 0) === 0;
  const fallbackCapPlates = useQuery(api.productPlates.byFamily,
    wantsCapFallback ? { familyId: `roll-on-cap-${neckSize}`, limit: 200 } : "skip");
  const thumbBySwatch = useMemo(() => {
    const out = new Map<string, string>();
    const foreign = FOREIGN_PREFIX[activeBase];
    const rows = [
      ...(componentPlates?.page ?? []),
      ...(fallbackCapPlates?.page ?? []).filter((row) => row.websiteSku && /^CP(?!Roll)/i.test(row.websiteSku)),
    ];
    for (const row of rows) {
      if (!row.websiteSku || (foreign && foreign.test(row.websiteSku))) continue;
      const finish = getFinishFromWebsiteSku(row.websiteSku);
      if (finish && !out.has(finish.swatchName)) out.set(finish.swatchName, row.thumb);
    }
    return out;
  }, [componentPlates, fallbackCapPlates, activeBase]);
  // The toggle is offered for every closure that can wear a cap; whether it
  // can actually show both states depends on a cap-off photograph (or live
  // geometry / a kit) existing for the selected colourway. It never vanishes
  // between colourways — it disables and says why (2026-09-02: on 5 ml
  // cobalt roll-on, 8 of 18 colourways have no cap-off plate yet, and the
  // control disappearing read as "the toggle is broken").
  const canCap = CAPPABLE[activeBase] != null;
  const capToggleLive = canCap
    && ((show3d && Boolean(fam) && !fam?.photoOnly) || Boolean(plateImageCapOff) || kitHasCap);
  const closureFor = (base: ClosureBase) =>
    ((withCap && CAPPABLE[base]) || CLOSURE_MODE[base]) as
      import("./Bottle3DViewer").ClosureMode;

  const isAntiquePreview = activeBase === "antique" || activeBase === "antiqueTassel";

  /* ---------------------------------------------------------- the stage */
  // the plate for the selected SKU; cap-off plate when the cap is lifted
  const wantedPlate = (!withCap && plateImageCapOff) ? plateImageCapOff : plateImage;
  const plate = wantedPlate && !brokenPlates.has(wantedPlate) ? wantedPlate : null;
  // A photo-only family (no approved geometry) never shows 3D; otherwise the
  // customer opens it. A plate outranks the catalogue photo: it is the exact
  // configuration, the photo is the group's hero.
  const has3d = Boolean(fam) && !fam?.photoOnly;
  const showPlate = !(show3d && has3d) && Boolean(plate);
  const showPhoto = !showPlate && !(show3d && has3d) && Boolean(photoFallback);
  const showLive3d = !showPlate && !showPhoto && has3d;
  const stage = (
    <div className="relative h-full w-full overflow-hidden">
      {showPlate ? (
        <div className="relative h-full w-full bg-white">
          {/* The flat plate: first paint, and what stays if the kit never arrives.
              Once the stack is up the plate is dropped entirely — leaving it
              mounted made every colourway change refetch a plate nobody sees. */}
          {!kitReady && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={plate!} src={plate!} alt={`${groupTitle} — ${activeMeta?.name ?? ""}`}
                 width={1000} height={1100} decoding="async"
                 onError={() => markPlateBroken(plate!)}
                 className="absolute inset-0 h-full w-full object-contain" />
          )}
          {/* the kit, stacked in z-order. Every part was written on the plate's
              own canvas, so they need no positioning here -- they line up by
              construction, which is what keeps the bottle still. */}
          {kitParts?.map((part) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={part.slot} src={part.image.url}
                 alt={part.slot === "body" ? `${groupTitle} bottle` : `${part.slot} — ${part.variantKey ?? ""}`}
                 width={part.image.width} height={part.image.height} decoding="async"
                 style={{
                   zIndex: part.zOrder,
                   // offsets are plate pixels on a 1000x1100 canvas; the image IS the
                   // canvas here, so a percentage of its own box is the same distance
                   transform: exploded
                     ? `translate(${(part.exploded.dx / 10).toFixed(2)}%, ${(part.exploded.dy / 11).toFixed(2)}%)`
                     : "translate(0, 0)",
                 }}
                 className="absolute inset-0 h-full w-full object-contain transition-transform
                            duration-500 ease-[cubic-bezier(.4,0,.2,1)]
                            motion-safe:animate-[kitIn_180ms_ease-out]" />
          ))}
        </div>
      ) : showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoFallback!} alt={`${groupTitle} — ${activeMeta?.name ?? ""}`}
             className="h-full w-full object-cover" />
      ) : showLive3d && fam ? (
        <Bottle3DViewer
          bodyId={fam.bodyForGlass?.[glass] ?? fam.bodyDefault}
          finish={fam.finish}
          glass={glass}
          closure={closureFor(activeBase)}
          capMat={capMat}
          rollerVariant={rollerVariant}
          trimMat={trimMat}
          backdrop="#a29383"
          className="h-full w-full"
          fill
        />
      ) : null}

      {/* mode badge, and the cap pill opposite it — both on the stage, where
          the design puts them; the pill is the same withCap the panel drives */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-[40] flex items-center justify-between gap-3 pointer-events-none">
        {/* The plain photograph carries no badge: the mode bar below the stage
            already says so, and the chip read as a label on the product. */}
        {(showLive3d || (exploded && kitReady)) ? (
          <span className="flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 backdrop-blur"
                style={{ background: "rgba(29,29,31,.85)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-muted-gold" />
            <span className="text-2xs font-semibold uppercase tracking-label text-white whitespace-nowrap">
              {showLive3d ? "Live 3D" : "Exploded view"}
            </span>
          </span>
        ) : <span />}
        {canCap && (
          <button type="button" onClick={() => setWithCap((v) => !v)}
                  aria-pressed={withCap} aria-label="Cap on or off"
                  disabled={!capToggleLive}
                  title={capToggleLive ? undefined : "Cap-off photograph not published for this colourway yet"}
                  className="pointer-events-auto flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-40">
            <span className="text-2xs font-semibold uppercase tracking-label text-obsidian whitespace-nowrap">
              {withCap ? "Cap on" : "Cap off"}
            </span>
            <span className={`relative block h-[30px] w-[52px] rounded-full border border-champagne/80
                              transition-colors duration-200
                              ${withCap ? "bg-obsidian" : "bg-linen/95"}`}>
              <span className={`absolute top-[2px] block h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(29,29,31,.3)]
                                transition-[left] duration-200 ease-[cubic-bezier(.4,0,.2,1)]
                                ${withCap ? "left-[24px]" : "left-[2px]"}`} />
            </span>
          </button>
        )}
      </div>

      {/* drag affordance */}
      {showLive3d && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center
                        gap-2 text-sm text-white/85 pointer-events-none">
          <HandGrabbing className="h-4 w-4" />
          <span>Drag to rotate</span>
        </div>
      )}
    </div>
  );

  // 3D is opt-in, and the switch sits right below the image (Jordan,
  // 2026-09-01) -- never in front of the photograph
  // Photo | 3D | Exploded — one configuration, three ways of looking at it.
  // 3D is offered when the family has approved geometry; Exploded when the
  // SKU's kit is on screen (the parts carry their own offsets).
  // The bar reports what the stage is SHOWING, not what was asked for. A SKU
  // with no plate and no catalogue photograph in a family that has geometry
  // falls through to Live 3D; the bar used to keep "Photo" lit while the 3D
  // rendered, and a closure click that landed on a sibling with a plate then
  // flipped it back (Jordan, 2 Sep, the 100 ml reducer mid-publish).
  const stageMode: "photo" | "3d" | "exploded" =
    showLive3d ? "3d" : exploded && kitReady ? "exploded" : "photo";
  const pickMode = (m: "photo" | "3d" | "exploded") => {
    setShow3d(m === "3d");
    setExploded(m === "exploded");
  };
  const modes: Array<{ id: "photo" | "3d" | "exploded"; label: string; icon: React.ReactNode; enabled: boolean; why?: string }> = [
    { id: "photo", label: "Photo", icon: <Camera className="h-4 w-4" />,
      enabled: Boolean(plate || photoFallback), why: "No photograph for this configuration yet" },
    { id: "3d", label: "3D", icon: <Cube className="h-4 w-4" />, enabled: has3d, why: "3D is on its way for this family" },
    { id: "exploded", label: "Exploded", icon: <Stack className="h-4 w-4" />, enabled: kitReady, why: "Exploded view comes with the component kit" },
  ];
  const stageToggle = (plateImage || photoFallback || has3d) ? (
    <div className="flex border border-champagne/60" role="tablist" aria-label="Stage mode">
      {modes.map((m) => (
        <button key={m.id} type="button" role="tab" aria-selected={stageMode === m.id}
                disabled={!m.enabled} title={m.enabled ? undefined : m.why}
                onClick={() => pickMode(m.id)}
                className={`flex flex-1 items-center justify-center gap-2 -ml-px border-l border-champagne/60
                            px-2 py-3.5 text-2xs font-semibold uppercase tracking-label transition-colors duration-200
                            first:ml-0 first:border-l-0 disabled:cursor-not-allowed disabled:opacity-40
                            ${stageMode === m.id ? "bg-obsidian text-white" : "bg-white text-slate hover:text-obsidian"}`}>
          {m.icon}{m.label}
        </button>
      ))}
    </div>
  ) : null;

  /* ----------------------------------------------- swatch rows (seam) */
  const finishRow = (compact = false, eyebrow = "3. Closure Finish") => {
    // SKU truth first: what this closure actually ships in
    if (capOptions && capOptions.length > 0) {
      return (
        <div>
          <p className="text-2xs font-semibold uppercase tracking-label">
            <span className="text-slate">{eyebrow}</span>
            <span className="text-slate"> · </span>
            <span className="text-obsidian normal-case tracking-normal text-caption">
              {activeCapOption ?? capOptions[0]}
            </span>
          </p>
          <div className="flex items-center gap-3 flex-wrap mt-2.5">
            {capOptions.map((name) => {
              const photo = resolveCapOptionPhoto(name, thumbBySwatch, capOptionPhotoKeys);
              return (
                // A photographed closure is a tall, narrow thing: in a 32 px circle it
                // read as a stripe (the cap fills a third of its square thumb). So a
                // photo chip is a small cap-shaped tile with the whole cap in frame,
                // the way the design draws its finish swatches; a colour stays a dot.
                <button key={name} type="button"
                        onClick={() => onCapOptionChange?.(name)}
                        aria-label={name} aria-pressed={activeCapOption === name}
                        title={name} data-swatch={photo ? "photo" : "colour"}
                        className={`overflow-hidden transition-all duration-200
                                    focus-visible:outline-2 focus-visible:outline-offset-2
                                    focus-visible:outline-muted-gold
                                    ${photo ? "h-14 w-11 rounded-[3px] bg-white" : "h-8 w-8 rounded-full"}
                                    ${activeCapOption === name
                                      ? "outline outline-2 outline-offset-2 outline-obsidian"
                                      : "ring-1 ring-champagne hover:ring-ash"}`}
                        style={photo ? undefined : capSwatchStyle?.(name)}>
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" decoding="async"
                         className="h-full w-full object-contain scale-[1.9] translate-y-[4%]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
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
        <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-2xs uppercase tracking-label font-semibold text-slate">
          2. Closure Type
          <CheckCircle className="h-3.5 w-3.5 text-gold-dim" />
          <span className="normal-case tracking-normal text-caption text-obsidian ml-0.5">
            · {activeMeta?.name ?? "Bottle only"}
          </span>
        </p>
        {neckSize && (
          <p className="min-w-0 text-right text-spec text-slate">All closures verified for {neckSize} neck</p>
        )}
      </div>

      {/* every closure the family sells sits on ONE row: the panel is wide
          enough for six (the Diva) because the stage yields width to it */}
      <div className="flex gap-2.5 mt-3 pb-1">
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
    </div>
  );

  /* CTA stack — quantity + add to cart, then the working price summary.
     The sample CTA was retired 2026-09-02: samples go through the quote
     flow and Grace, not a second button competing with the cart. */
  const linePrice = tierPrice != null ? tierPrice * qty : null;
  const ctaStack = (
    <div className="mt-5">
      <div className="flex items-stretch gap-3">
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
                  <div key={t.minQty}
                       className={`grid grid-cols-[1fr_auto_auto_92px] items-center gap-2
                                   rounded-[2px] px-2.5 py-1.5 transition-colors duration-200
                                   ${active ? "bg-white ring-1 ring-champagne/60" : ""}`}>
                    <button type="button" onClick={() => onQtyChange?.(t.minQty)}
                            aria-label={`Set quantity to ${t.minQty}`}
                            className={`text-left text-sm ${active
                              ? "font-semibold text-obsidian"
                              : "text-slate hover:text-obsidian"}`}>
                      {t.minQty.toLocaleString()}+ units
                    </button>
                    <span>
                      {save > 0 && (
                        <span className="text-2xs uppercase tracking-label font-semibold
                                         text-[#1F6B49] bg-[#2E9E6B]/10 border border-[#2E9E6B]/30
                                         rounded-full px-1.5 py-0.5">
                          Save {save}%
                        </span>
                      )}
                    </span>
                    <span className={`text-sm tabular-nums text-right ${active
                      ? "font-semibold text-obsidian" : "text-obsidian"}`}>
                      ${t.price.toFixed(2)} ea
                    </span>
                    {active ? (
                      <button type="button" onClick={onAddToCart}
                              className="text-2xs uppercase tracking-label font-semibold
                                         bg-obsidian text-white rounded-[2px] py-1.5
                                         transition-colors duration-200
                                         hover:bg-muted-gold hover:text-obsidian">
                        Add to cart
                      </button>
                    ) : (
                      <button type="button" onClick={() => onQtyChange?.(t.minQty)}
                              className="text-2xs uppercase tracking-label font-semibold
                                         text-slate hover:text-gold-dim py-1.5">
                        Select
                      </button>
                    )}
                  </div>
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

  /* ------------------------------------------------- guided column */
  const glassLabel = glassOptions?.find((g) => g.active)?.label ?? GLASS_PRESETS[glass]?.label ?? glass;
  const finishLabel = activeCapOption ?? capOptions?.[0] ?? null;
  const resolvedSku = websiteSku ?? skuLabel ?? null;
  const copySku = () => {
    if (!resolvedSku) return;
    try { void navigator.clipboard.writeText(resolvedSku); setSkuCopied(true); setTimeout(() => setSkuCopied(false), 1400); } catch {}
  };

  /* 1. Glass Finish — the colourways this family sells, as cards */
  const glassStep = (glassOptions?.length ?? 0) > 0 ? (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-label text-slate">
        1. Glass Finish
        <span className="normal-case tracking-normal text-caption text-obsidian ml-0.5">· {glassLabel}</span>
      </p>
      <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-[repeat(auto-fill,minmax(64px,92px))]">
        {(glassOptions ?? []).map((g) => {
          const on = g.active;
          return (
            <button key={g.id} type="button" aria-pressed={on}
               onClick={() => {
                 if (g.id in GLASS_PRESETS) setGlassOverride(g.id as GlassPresetId);
                 if (g.href && g.href !== "#") router.replace(g.href, { scroll: false });
               }}
               className={`group relative block w-full rounded-[2px] bg-white text-center transition-colors duration-200
                           ${on ? "border-[1.5px] border-obsidian" : "border border-champagne hover:border-muted-gold"}`}>
              <span className="relative block aspect-[4/3] overflow-hidden rounded-t-[2px]"
                    style={{ background: GLASS_TILE[g.id] ?? "#e9edeb" }}>
                {g.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.imageUrl} alt={g.label} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <BottleGlyph className="h-8 w-8 text-obsidian/25" />
                  </span>
                )}
              </span>
              <span className={`block px-1 py-2 text-spec leading-tight ${on ? "font-semibold text-obsidian" : "text-slate"}`}>
                {g.label}
              </span>
              {on && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-obsidian">
                  <Check className="h-2.5 w-2.5 text-white" weight="bold" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  /* the summary strip under the title: what is configured, in one line */
  const summaryStrip = (
    <div className="mt-4 flex items-center gap-3 border-t border-champagne/50 pt-4">
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 border border-champagne/50 bg-linen px-4 py-2.5 text-sm text-obsidian">
        <span>{glassLabel} glass</span>
        <span className="text-muted-gold">·</span>
        <span>{activeMeta?.name ?? "Bottle only"}</span>
        {finishLabel && (<><span className="text-muted-gold">·</span><span>{finishLabel}</span></>)}
      </div>
    </div>
  );

  /* Your Configuration — the spec card with the resolved SKU */
  const configRows: Array<[string, string]> = [
    ["Family", groupTitle],
    ["Glass Finish", glassLabel],
    ...(neckSize ? [["Neck Finish", neckSize] as [string, string]] : []),
    ["Closure", activeMeta?.name ?? "Bottle only"],
    ...(finishLabel ? [["Closure Finish", finishLabel] as [string, string]] : []),
    ...(canCap ? [["View", withCap ? "Cap on" : "Cap off"] as [string, string]] : []),
  ];
  const configCard = (
    <div className="border border-champagne/50 bg-linen p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-label text-slate">Your Configuration</span>
        <span className={`flex items-center gap-1.5 text-spec font-medium ${inStock ? "text-obsidian" : "text-amber-700"}`}>
          {inStock ? "In stock" : "Confirm availability"}
          <span className={`inline-block h-[7px] w-[7px] rounded-full ${inStock ? "bg-[#2F7D5B]" : "bg-amber-500"}`} />
        </span>
      </div>
      <div className="flex flex-col">
        {configRows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-champagne/35 py-2 text-sm">
            <span className="text-slate">{k}</span>
            <span className="text-right font-medium tabular-nums text-obsidian">{v}</span>
          </div>
        ))}
      </div>
      {resolvedSku && (
        <div className="mt-4">
          <button type="button" onClick={copySku}
                  className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-label text-slate hover:text-gold-dim">
            Resolved SKU <Copy className="h-3.5 w-3.5" />
            {skuCopied && <span className="normal-case tracking-normal text-caption text-gold-dim">copied</span>}
          </button>
          <p className="mt-1.5 font-serif text-[22px] tracking-[.01em] tabular-nums text-obsidian">{resolvedSku}</p>
        </div>
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
      {/* The overcap chooser is gone: the stage's cap-on/off toggle is the one
          cap control (decision 2026-09-02). Roller material now sits here,
          above the fold. */}
      {activeBase === "roller" && (
        <div className="mt-6 pt-5 border-t border-champagne/50">
          <p className="text-2xs font-semibold uppercase tracking-label">
            <span className="text-slate">Roller ball</span>
            <span className="text-slate"> · </span>
            <span className="text-obsidian normal-case tracking-normal text-caption">
              {rollerVariant === "metal" ? "Stainless steel" : "Plastic"}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-2.5 max-w-xs">
            {([["metal", "Stainless steel", "Smooth, cooling glide"],
               ["plastic", "Plastic", "Lighter, lower cost"]] as const).map(
              ([id, label, note]) => (
                <button key={id} type="button" onClick={() => setRollerVariant(id)}
                        aria-pressed={rollerVariant === id}
                        disabled={!rollerOffered(id)}
                        title={rollerOffered(id) ? undefined : "Not offered for this bottle"}
                        className={`rounded-[3px] px-3 py-2 text-left transition-colors
                                    duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${rollerVariant === id
                                      ? "border-[1.5px] border-obsidian bg-white"
                                      : "border border-champagne hover:border-muted-gold"}`}>
                  <span className="block text-spec font-semibold text-obsidian">{label}</span>
                  <span className="block text-2xs text-slate mt-0.5">{note}</span>
                </button>
              ))}
          </div>
        </div>
      )}
      <div className="mt-6 pt-5 border-t border-champagne/50">{finishRow()}</div>
      {ctaStack}
    </div>
  );

  /* --------------------------------------------------------- mobile */
  const mobile = (
    <div className="lg:hidden">
      <div className="px-4 pb-3.5">
        {identity}
        <p className="mt-2 flex gap-2 text-caption text-slate tabular-nums">
          {neckSize && <span>{neckSize} Neck</span>}
          {neckSize && capacityText && <span className="text-muted-gold">·</span>}
          {capacityText && <span>{capacityText}</span>}
        </p>
      </div>
      <div className="mx-4 relative aspect-[4/5] overflow-hidden border border-champagne/50 bg-travertine">
        {stage}
      </div>
      {stageToggle ? <div className="mx-4 border-t-0">{stageToggle}</div> : null}

      {/* 1. glass */}
      {glassStep && <div className="mt-7 px-4">{glassStep}</div>}

      {/* 2. closure */}
      <div className="mt-7 px-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-label text-slate">
            2. Closure Type <CheckCircle className="h-3.5 w-3.5 text-gold-dim" />
          </p>
          {neckSize && <span className="text-spec text-slate">Verified for {neckSize}</span>}
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
      </div>

      {/* 3. finish */}
      <div className="mt-7 px-4">{finishRow(true)}</div>

      {/* the configuration, resolved */}
      <div className="mt-8 px-4">{configCard}</div>
      <div className="mt-4 px-4 flex items-center justify-between text-caption text-slate">
        {ladder.length > 1 ? (
          <a href="#volume-pricing" onClick={() => setTiersOpen(true)} className="text-gold-dim underline underline-offset-2">
            ${ladder[ladder.length - 1].price.toFixed(2)} at {ladder[ladder.length - 1].minQty.toLocaleString()}+ · {ladder.length} volume tiers
          </a>
        ) : <span />}
      </div>

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

      {/* No sticky bar of its own: the site already fixes a buy bar and the
          bottom navigation to the viewport on mobile, and a third layer sat
          on top of both (seen 2 Sep). The spacer keeps the last step clear
          of them. */}
      <div className="h-24" />
    </div>
  );

  return (
    <section className="w-full">
      {/* desktop — glass rail | stage | buy column. The rail runs down the
          left of the viewport (Jordan) and takes lifestyle tiles later. */}
      {/* desktop — stage panel | guided steps | configuration + price.
          The proportions are the approved design's (2 Sep 2026); the
          tokens are ours, which is what the design was drawn in. */}
      {/* 40 px page gutters, as the design has them (the host gives 24). The
          global Grace button is fixed 56 px wide at the bottom-right, so the
          right gutter is wider: "Add to cart" must never sit underneath it
          (measured 2 Sep: button x 1362-1418 on a 1440 viewport). */}
      <div className="hidden lg:grid grid-cols-[minmax(400px,1fr)_minmax(360px,470px)_300px] gap-5 items-start"
           style={{ paddingLeft: 16, paddingRight: 96 }}>
        <section className="flex flex-col gap-3 border border-champagne/50 bg-linen p-4">
          {/* 10/11 is the plate's aspect, so photo, kit and 3D are always the same size */}
          <div className="relative aspect-[10/11] overflow-hidden bg-travertine">{stage}</div>
          {stageToggle}
          <p className="flex items-center justify-center gap-1.5 text-center text-caption text-slate">
            <Sparkle className="h-3.5 w-3.5 text-muted-gold" weight="fill" />
            Same configuration across all modes. Changes update in real time.
          </p>
        </section>

        <section className="min-w-0 px-2 pt-1.5">
          {identity}
          <p className="mt-2.5 flex gap-2.5 text-sm text-slate tabular-nums">
            {neckSize && <span>{neckSize} Neck</span>}
            {neckSize && capacityText && <span>·</span>}
            {capacityText && <span>{capacityText}</span>}
          </p>
          {summaryStrip}
          <div className="mt-6">{glassStep}</div>
          {closureRow}
          {activeBase === "roller" && (
            <div className="mt-6 border-t border-champagne/50 pt-5">
              <p className="text-2xs font-semibold uppercase tracking-label">
                <span className="text-slate">Roller ball</span>
                <span className="text-slate"> · </span>
                <span className="text-obsidian normal-case tracking-normal text-caption">
                  {rollerVariant === "metal" ? "Stainless steel" : "Plastic"}
                </span>
              </p>
              <div className="mt-2.5 grid max-w-xs grid-cols-2 gap-2.5">
                {([["metal", "Stainless steel", "Smooth, cooling glide"],
                   ["plastic", "Plastic", "Lighter, lower cost"]] as const).map(
                  ([id, label, note]) => (
                    <button key={id} type="button" onClick={() => setRollerVariant(id)}
                            aria-pressed={rollerVariant === id}
                            disabled={!rollerOffered(id)}
                            title={rollerOffered(id) ? undefined : "Not offered for this bottle"}
                            className={`rounded-[3px] px-3 py-2 text-left transition-colors duration-200
                                        disabled:cursor-not-allowed disabled:opacity-40 ${rollerVariant === id
                                          ? "border-[1.5px] border-obsidian bg-white"
                                          : "border border-champagne hover:border-muted-gold"}`}>
                      <span className="block text-spec font-semibold text-obsidian">{label}</span>
                      <span className="block text-2xs text-slate mt-0.5">{note}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div className="mt-6">{finishRow()}</div>
        </section>

        <aside className="flex flex-col gap-3.5">
          {configCard}
          <div className="border border-champagne/50 bg-linen p-5">
            {priceBlock}
            {ctaStack}
            <div className="mt-4 flex justify-between text-caption text-slate">
              <span>Secure checkout</span><span>30-day returns</span>
            </div>
          </div>
        </aside>
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
