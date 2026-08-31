/**
 * Configurator family registry — the data that turns a product-group slug
 * into a live 3D configuration. One entry per onboarded family; the PDP,
 * the configurator and the viewer all resolve from HERE so adding a family
 * never touches component logic again.
 *
 * A family enters this file only when its whole chain is approved:
 * hollow body GLB + thickness bake + locked glass presets + closure GLBs
 * for every base it offers (the configurator-lane skill's checklist).
 */

import type { GlassPresetId } from "@/lib/materials/glassPresets";

export type ClosureBase = "none" | "roller" | "sprayer" | "pump";
export type FinishCode = "17-415" | "18-415";

export type ConfiguratorFamily = {
  key: string;
  finish: FinishCode;
  /** matches the product-group slugs this family owns AND can render */
  slugRe: RegExp;
  /** glass colourways the family actually sells (SKU truth) */
  glasses: GlassPresetId[];
  /** closure bases the family sells AND we have geometry for */
  bases: ClosureBase[];
  /** spray/pump trim material ids this finish ships (SKU truth); omit for
   *  the default 17-415 palette. 18-415 sprayers come in MtGl/ShnGl/
   *  ShnBlk/MtSl/Cu/ShnSl — copper and matte gold exist ONLY here, and
   *  turquoise/red only on 17-415 (Spry PSD folders per finish). */
  trims?: string[];
  bodyDefault: string;
  /** colourways that live on their own mesh (flutes etc.) */
  bodyForGlass?: Partial<Record<GlassPresetId, string>>;
  slugColour: Partial<Record<GlassPresetId, string>>;
  /** base -> slug closure token used when NAVIGATING to a sibling */
  slugClosure: Partial<Record<ClosureBase, string>>;
  /** slug closure token -> base used when READING the current slug */
  closureFromSlug: Record<string, Exclude<ClosureBase, "none">>;
  buildSlug: (colourToken: string, closureToken: string) => string;
};

export const CONFIGURATOR_FAMILIES: ConfiguratorFamily[] = [
  {
    key: "cyl9",
    finish: "17-415",
    slugRe: /^cylinder-9ml-.*17-415-(rollon|finemist|lotionpump)$/,
    glasses: ["clear", "amber", "cobalt", "frosted", "swirl"],
    bases: ["none", "roller", "sprayer", "pump"],
    bodyDefault: "Cyl-round-17-415-70x20",
    bodyForGlass: { swirl: "CylSwrl-round-17-415-74x21" },
    slugColour: {
      clear: "clear", amber: "amber", cobalt: "cobalt-blue",
      frosted: "frosted", swirl: "swirl",
    },
    slugClosure: { roller: "rollon", sprayer: "finemist", pump: "lotionpump" },
    closureFromSlug: { rollon: "roller", finemist: "sprayer", lotionpump: "pump" },
    buildSlug: (c, cl) => `cylinder-9ml-${c}-17-415-${cl}`,
  },
  {
    key: "elegant60",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    // SKU truth (2026-08-31): elegant-60ml sells clear + frosted with
    // finemist (clear only) / perfumespray / lotionpump renderable today;
    // dropper, reducer and antique-bulb pages keep the photo gallery
    // until their geometry lands.
    slugRe: /^elegant-60ml-(clear|frosted)-18-415-(finemist|perfumespray|lotionpump)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "sprayer", "pump"],
    bodyDefault: "Elegant-oval-18-415-87x55",
    slugColour: { clear: "clear", frosted: "frosted" },
    // perfumespray exists in BOTH colourways (finemist is clear-only), so
    // sibling navigation lands on the token every colourway has
    slugClosure: { sprayer: "perfumespray", pump: "lotionpump" },
    closureFromSlug: {
      finemist: "sprayer", perfumespray: "sprayer", lotionpump: "pump",
    },
    buildSlug: (c, cl) => `elegant-60ml-${c}-18-415-${cl}`,
  },
  {
    key: "circle50",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    // SKU truth: clear + frosted; perfumespray + lotionpump renderable
    // (antique bulb, dropper, reducer keep the photo gallery; the lone
    // 18-400 reducer variant is a different finish entirely)
    slugRe: /^circle-50ml-(clear|frosted)-18-415-(perfumespray|lotionpump)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "sprayer", "pump"],
    bodyDefault: "Circle-disc-18-415-88x73",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { sprayer: "perfumespray", pump: "lotionpump" },
    closureFromSlug: { perfumespray: "sprayer", lotionpump: "pump" },
    buildSlug: (c, cl) => `circle-50ml-${c}-18-415-${cl}`,
  },
  {
    key: "circle100",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    slugRe: /^circle-100ml-(clear|frosted)-18-415-(perfumespray|lotionpump)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "sprayer", "pump"],
    bodyDefault: "Circle-disc-18-415-111x94",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { sprayer: "perfumespray", pump: "lotionpump" },
    closureFromSlug: { perfumespray: "sprayer", lotionpump: "pump" },
    buildSlug: (c, cl) => `circle-100ml-${c}-18-415-${cl}`,
  },
];

export function familyForSlug(slug: string): ConfiguratorFamily | null {
  return CONFIGURATOR_FAMILIES.find((f) => f.slugRe.test(slug)) ?? null;
}

export function glassFromSlug(f: ConfiguratorFamily, slug: string): GlassPresetId {
  for (const [glass, token] of Object.entries(f.slugColour)) {
    if (slug.includes(`-${token}-`)) return glass as GlassPresetId;
  }
  return f.glasses[0];
}
