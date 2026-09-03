"use client";

/**
 * ConfiguratorPdp — the guided configurator hero (design handoff
 * `design_handoff_configurator_pdp`, approved 2026-08-31).
 *
 * The shared focused shell keeps one 10:11 stage beside one coherent purchase
 * panel, then stacks them stage-first when its own container gets narrow.
 * Everything INSIDE the <Canvas> belongs to the render design system; this
 * component owns everything outside it.
 *
 * The buy panel is intentionally scoped to the current product application.
 * Glass and real SKU selections resolve through the canonical PDP route; a
 * cross-application comparison belongs in the below-fold discovery section.
 */

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Check, ChatCircle, ShoppingBag,
} from "@/components/icons";
import { HandGrabbing, CaretDown,
         Copy, Flask as BottleGlyph } from "@phosphor-icons/react";
import { GLASS_PRESETS, type GlassPresetId } from "@/lib/materials/glassPresets";
import { familyForSlugOrDerived, glassFromSlug, type ClosureBase }
  from "@/lib/configurator/families";
import { CLOSURE_META } from "@/lib/configurator/useCases";
import { swatchFor, type SwatchableMaterial } from "@/lib/materials/materialSwatch";
import { componentPhotoSkuBelongsToBase, photoKeysForVariant, resolveCapOptionPhoto } from "@/lib/products/closure-swatch-keys";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { useGLTF } from "@react-three/drei";
import FocusedPdpLayout from "./FocusedPdpLayout";
import PdpStageModeDock from "./PdpStageModeDock";
import {
  getPdpStageModes,
  hasRealPdpDimensions,
  preservePdpStageMode,
  type PdpStageMode,
} from "@/lib/products/pdp-stage-modes";

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

/** sessionStorage key for the customer's current stage mode. */
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
  currentSlug, groupTitle, capacityLabel, priceEach,
  heroImageUrl, onAddToCart, onAskGrace,
  displayName, categoryLabel, inStock = true, caseQty,
  neckSize, capacityText, skuLabel, graceSku, websiteSku, price10, price12, priceTiers,
  quoteHref, checkoutReady = true, qty = 1, onQtyChange,
  capOptions, capOptionPhotoKeys, activeCapOption, onCapOptionChange, capSwatchStyle, glassOptions,
  rollerVariant: rollerVariantProp, rollerVariantsAvailable, onRollerVariantChange, onVariantSelectionChange,
  onProductUrlChange,
  plateImage = null, plateImageCapOff = null, variantImageUrl = null,
  heightWithCap = null, heightWithoutCap = null, diameter = null,
}: {
  currentSlug: string;
  /** paper-doll plate for the SELECTED SKU (productPlates index, served from Vercel Blob): the
   *  stage leads with this photograph; 3D is a toggle on top of it */
  plateImage?: string | null;
  plateImageCapOff?: string | null;
  /** the selected SKU's catalogue photograph: the stage's fallback when the
   *  SKU has no plate (never photographed as a plate, or not built yet) */
  variantImageUrl?: string | null;
  heightWithCap?: string | null;
  heightWithoutCap?: string | null;
  diameter?: string | null;
  groupTitle: string;          // "Elegant 60 ml"
  capacityLabel: string;       // "Clear glass"
  priceEach: number | null;    // committed group's unit price
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
  /** False means the selected Shopify variant cannot check out and must quote. */
  checkoutReady?: boolean;
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
  /** Resolves a real in-intent variant at the product-route boundary. */
  onVariantSelectionChange?: (selection: { rollerVariant?: "metal" | "plastic"; capOption?: string }) => void;
  /** A glass sibling is another real product group, never a local preview. */
  onProductUrlChange?: (href: string) => void;
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
  const fam = familyForSlugOrDerived(currentSlug);
  const slugGlass: GlassPresetId = fam ? glassFromSlug(fam, currentSlug) : "clear";
  const [rollerLocal, setRollerLocal] = useState<"metal" | "plastic">("metal");
  const rollerVariant = rollerVariantProp ?? rollerLocal;
  const setRollerVariant = (variant: "metal" | "plastic") => {
    setRollerLocal(variant);
    onRollerVariantChange?.(variant);
    onVariantSelectionChange?.({ rollerVariant: variant });
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
  const [requestedStageMode, setRequestedStageMode] = useState<PdpStageMode>("photo");
  const show3d = requestedStageMode === "3d";
  // Exploded: the kit's parts slide apart along the axis by the offsets the
  // builder recorded (`exploded.dx/dy`, plate pixels). Only a kitted SKU has
  // them, so the mode is offered only when the stack is on screen.
  const exploded = requestedStageMode === "exploded";
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
  // A published kit is capability truth; decoding only controls when its
  // layers are safe to paint. Keeping these separate preserves Exploded while
  // the next valid in-intent variant's image bytes are still arriving.
  const releasedKitAvailable = Boolean(kit?.parts?.length);
  const kitReady = Boolean(shownParts?.length);
  const kitParts = shownParts;
  const markPlateBroken = (url: string) => {
    console.error("[plates] image failed to load", url);
    setBrokenPlates((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  };
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STAGE_MODE_KEY);
      if (saved === "photo" || saved === "3d" || saved === "exploded" || saved === "dimensions") {
        setRequestedStageMode(saved);
      }
    } catch {}
  }, []);
  const pickMode = (mode: PdpStageMode) => {
    setRequestedStageMode(mode);
    try { window.sessionStorage.setItem(STAGE_MODE_KEY, mode); } catch {}
  };
  const glass: GlassPresetId = slugGlass;
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

  const activeMeta = activeBase === "none" ? null : CLOSURE_META[activeBase] ?? null;
  // bulb has no live 3D (parked): the stage shows the product photo
  // Without a plate the stage shows a photograph, never nothing: the SKU's
  // own catalogue image first, then the group's hero.
  const photoFallback =
    variantImageUrl
    ?? heroImageUrl
    ?? null;

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
    const rows = [
      ...(componentPlates?.page ?? []),
      ...(fallbackCapPlates?.page ?? []).filter((row) => row.websiteSku && /^CP(?!Roll)/i.test(row.websiteSku)),
    ];
    for (const row of rows) {
      if (!row.websiteSku || !componentPhotoSkuBelongsToBase(activeBase, row.websiteSku)) continue;
      const finish = photoKeysForVariant({ websiteSku: row.websiteSku })[0];
      if (finish && !out.has(finish)) out.set(finish, row.thumb);
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
  const dimensions = { heightWithCap, heightWithoutCap, diameter };
  const showDimensions = requestedStageMode === "dimensions" && hasRealPdpDimensions(dimensions);
  const showPlate = !(show3d && has3d) && Boolean(plate);
  const showPhoto = !showPlate && !(show3d && has3d) && Boolean(photoFallback);
  const showLive3d = !showPlate && !showPhoto && has3d;
  const stage = (
    <div className="relative h-full w-full overflow-hidden">
      {showDimensions ? (
        <div className="flex h-full w-full items-center justify-center bg-linen px-8 py-10">
          <div className="w-full max-w-sm border-y border-champagne/70">
            <p className="py-4 font-serif text-2xl text-obsidian">Product dimensions</p>
            <dl>
              {heightWithCap?.trim() ? <DimensionRow label="Height with cap" value={heightWithCap} /> : null}
              {heightWithoutCap?.trim() ? <DimensionRow label="Height without cap" value={heightWithoutCap} /> : null}
              {diameter?.trim() ? <DimensionRow label="Diameter" value={diameter} /> : null}
            </dl>
          </div>
        </div>
      ) : showPlate ? (
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
                            motion-reduce:transition-none motion-reduce:duration-0" />
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
        {(!showDimensions && (showLive3d || (exploded && kitReady))) ? (
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
      {showLive3d && !showDimensions && (
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
  const modes = getPdpStageModes({
    hasApprovedImageOrPlate: Boolean(plate || photoFallback),
    hasApprovedGeometry: has3d,
    hasReleasedExplodedKit: releasedKitAvailable,
    dimensions,
    photoOnly: fam?.photoOnly,
    productFamily: displayName?.toLowerCase().includes("diva") ? "Diva" : groupTitle.split(" ")[0],
  });
  const stageMode: PdpStageMode | null = showDimensions
    ? "dimensions"
    : requestedStageMode === "exploded" && releasedKitAvailable
      ? "exploded"
    : showLive3d
      ? "3d"
      : preservePdpStageMode("photo", modes);
  useEffect(() => {
    if (kitQuery === undefined) return;
    const preserved = preservePdpStageMode(requestedStageMode, modes);
    if (preserved && preserved !== requestedStageMode) pickMode(preserved);
    // Mode capabilities are primitive truth values; keeping the array out of
    // this dependency list prevents an effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedStageMode, has3d, releasedKitAvailable, plate, photoFallback, heightWithCap, heightWithoutCap, diameter, kitQuery]);
  const stageToggle = (
    <PdpStageModeDock modes={modes} activeMode={stageMode} onModeChange={pickMode} />
  );

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
                        onClick={() => {
                          onCapOptionChange?.(name);
                          onVariantSelectionChange?.({ capOption: name });
                        }}
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

  /* CTA stack — quantity + add to cart, then the working price summary.
     The sample CTA was retired 2026-09-02: samples go through the quote
     flow and Grace, not a second button competing with the cart. */
  const linePrice = tierPrice != null ? tierPrice * qty : null;
  const ctaStack = (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold tabular-nums text-obsidian">
          {tierPrice != null ? `$${tierPrice.toFixed(2)} /ea` : "Price on request"}
        </span>
        {caseQty && tierPrice != null ? (
          <span className="text-slate">
            ${ (tierPrice * caseQty).toFixed(2) } per case of {caseQty.toLocaleString()}
          </span>
        ) : null}
      </div>
      <div className="flex items-stretch gap-3">
        <div className="flex items-center border border-champagne rounded-[3px]">
          <button type="button" aria-label="Decrease quantity"
                  onClick={() => onQtyChange?.(Math.max(1, qty - 1))}
                  className="px-3.5 py-2.5 text-obsidian hover:text-muted-gold
                             transition-colors duration-200">−</button>
          <input type="number" min={1} inputMode="numeric" aria-label="Quantity"
                 value={qty}
                 onChange={(event) => {
                   const next = Number(event.target.value);
                   onQtyChange?.(Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1);
                 }}
                 className="min-w-[3rem] bg-transparent text-center text-md font-semibold text-obsidian tabular-nums outline-none" />
          <button type="button" aria-label="Increase quantity"
                  onClick={() => onQtyChange?.(qty + 1)}
                  className="px-3.5 py-2.5 text-obsidian hover:text-muted-gold
                             transition-colors duration-200">+</button>
        </div>
        {checkoutReady ? (
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
        ) : (
          <a href={quoteHref ?? "#"}
             className="flex-1 flex items-center justify-center py-2.5 border border-obsidian bg-obsidian text-md font-semibold text-white rounded-[3px] hover:bg-muted-gold">
            Request Quote
          </a>
        )}
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
                    {active && checkoutReady ? (
                      <button type="button" onClick={onAddToCart}
                              className="text-2xs uppercase tracking-label font-semibold
                                         bg-obsidian text-white rounded-[2px] py-1.5
                                         transition-colors duration-200
                                         hover:bg-muted-gold hover:text-obsidian">
                        Add to cart
                      </button>
                    ) : active ? (
                      <a href={quoteHref ?? "#"}
                         className="text-2xs uppercase tracking-label font-semibold bg-obsidian text-white rounded-[2px] py-1.5 text-center hover:bg-muted-gold hover:text-obsidian">
                        Request Quote
                      </a>
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
                 if (g.href && g.href !== "#") onProductUrlChange?.(g.href);
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
    <div className="min-w-0">
      {identity}
      {specStrip}
      {priceBlock}
      {summaryStrip}
      {glassStep ? <div className="mt-6">{glassStep}</div> : null}
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
      <div className="mt-6">{configCard}</div>
      {ctaStack}
      <div className="mt-4 flex justify-between text-caption text-slate">
        <span>Secure checkout</span><span>30-day returns</span>
      </div>
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

      {/* 2. finish */}
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
  void mobile;

  return (
    <section className="w-full">
      <FocusedPdpLayout
        className="px-4 sm:px-0"
        stage={(
          <div className="relative h-full w-full border border-champagne/50 bg-travertine">
            {stage}
            <div className="absolute inset-x-[-1px] top-full">{stageToggle}</div>
          </div>
        )}
        purchase={stepPanel}
      />
    </section>
  );
}

function DimensionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-5 border-t border-champagne/50 py-3 text-sm">
      <dt className="text-slate">{label}</dt>
      <dd className="font-semibold tabular-nums text-obsidian">{value}</dd>
    </div>
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
