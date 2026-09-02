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

export type ClosureBase = "none" | "roller" | "reducer" | "dropper" | "sprayer" | "pump" | "antique" | "antiqueTassel";
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
  /** sells through the guided page on its PLATES alone -- no approved
   *  geometry, so the stage never offers 3D and preloads nothing */
  photoOnly?: boolean;
  /** not in this file: read off the product-group slug because the group's
   *  SKUs carry plates. Everything a derived family knows it read from the
   *  slug grammar; the page prunes its closures and colourways by the
   *  siblings the catalogue actually has. */
  derived?: true;
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
    slugRe: /^elegant-60ml-(clear|frosted)-18-415-(finemist|perfumespray|lotionpump|reducer|dropper)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "reducer", "dropper", "sprayer", "pump"],
    bodyDefault: "Elegant-oval-18-415-87x55",
    slugColour: { clear: "clear", frosted: "frosted" },
    // perfumespray exists in BOTH colourways (finemist is clear-only), so
    // sibling navigation lands on the token every colourway has
    slugClosure: { reducer: "reducer", dropper: "dropper",
                   sprayer: "perfumespray", pump: "lotionpump" },
    closureFromSlug: {
      finemist: "sprayer", perfumespray: "sprayer", lotionpump: "pump",
      reducer: "reducer", dropper: "dropper",
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
    slugRe: /^circle-50ml-(clear|frosted)-18-415-(perfumespray|lotionpump|reducer|dropper)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "reducer", "dropper", "sprayer", "pump"],
    bodyDefault: "Circle-disc-18-415-88x73",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { reducer: "reducer", dropper: "dropper",
                   sprayer: "perfumespray", pump: "lotionpump" },
    closureFromSlug: { reducer: "reducer", dropper: "dropper",
                       perfumespray: "sprayer", lotionpump: "pump" },
    buildSlug: (c, cl) => `circle-50ml-${c}-18-415-${cl}`,
  },
  {
    key: "circle100",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    slugRe: /^circle-100ml-(clear|frosted)-18-415-(perfumespray|lotionpump|reducer)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "reducer", "sprayer", "pump"],
    bodyDefault: "Circle-disc-18-415-111x94",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { reducer: "reducer", sprayer: "perfumespray", pump: "lotionpump" },
    closureFromSlug: { reducer: "reducer", perfumespray: "sprayer", lotionpump: "pump" },
    buildSlug: (c, cl) => `circle-100ml-${c}-18-415-${cl}`,
  },
  // ---- 2026-08-31 scale-out: every family below runs on the SAME finished
  // 18-415 closure set (caps, monochrome spray/pump, reducer, dropper,
  // caps, monochrome spray/pump, reducer, dropper); bodies are harvest-dim (no drawings — request list)
  {
    key: "round128",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    slugRe: /^round-128ml-(clear|frosted)-18-415-(perfumespray|lotionpump|reducer|dropper)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "reducer", "dropper", "sprayer", "pump"],
    bodyDefault: "Round-sphere-18-415-83x69",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { reducer: "reducer", dropper: "dropper",
                   sprayer: "perfumespray", pump: "lotionpump" },
    closureFromSlug: { reducer: "reducer", dropper: "dropper",
                       perfumespray: "sprayer", lotionpump: "pump" },
    buildSlug: (c, cl) => `round-128ml-${c}-18-415-${cl}`,
  },
  {
    key: "round78",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    // SKU truth: no dropper groups on the 78
    slugRe: /^round-78ml-(clear|frosted)-18-415-(perfumespray|lotionpump|reducer)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "reducer", "sprayer", "pump"],
    bodyDefault: "Round-sphere-18-415-73x59",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { reducer: "reducer", sprayer: "perfumespray",
                   pump: "lotionpump" },
    closureFromSlug: { reducer: "reducer", perfumespray: "sprayer",
                       lotionpump: "pump" },
    buildSlug: (c, cl) => `round-78ml-${c}-18-415-${cl}`,
  },
  {
    key: "cyl50",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    // clear-only family; the 16mm roll-on group is a different finish
    slugRe: /^cylinder-50ml-clear-18-415-(perfumespray|lotionpump|reducer)$/,
    glasses: ["clear"],
    bases: ["none", "reducer", "sprayer", "pump"],
    bodyDefault: "Cyl-round-18-415-117x32",
    slugColour: { clear: "clear" },
    slugClosure: { reducer: "reducer", sprayer: "perfumespray",
                   pump: "lotionpump" },
    closureFromSlug: { reducer: "reducer", perfumespray: "sprayer",
                       lotionpump: "pump" },
    buildSlug: (c, cl) => `cylinder-50ml-${c}-18-415-${cl}`,
  },
  {
    key: "cyl100",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    slugRe: /^cylinder-100ml-clear-18-415-(perfumespray|lotionpump|reducer)$/,
    glasses: ["clear"],
    bases: ["none", "reducer", "sprayer", "pump"],
    bodyDefault: "Cyl-round-18-415-154x35",
    slugColour: { clear: "clear" },
    slugClosure: { reducer: "reducer", sprayer: "perfumespray",
                   pump: "lotionpump" },
    closureFromSlug: { reducer: "reducer", perfumespray: "sprayer",
                       lotionpump: "pump" },
    buildSlug: (c, cl) => `cylinder-100ml-${c}-18-415-${cl}`,
  },
  {
    key: "elegant100",
    finish: "18-415",
    trims: ["CAP_SHINY_BLACK", "CAP_SHINY_GOLD", "CAP_MATTE_GOLD",
            "CAP_MATTE_SILVER", "CAP_SHINY_SILVER", "CAP_COPPER"],
    // finemist exists as a lone clear variant, mapped to sprayer like the 60
    slugRe: /^elegant-100ml-(clear|frosted)-18-415-(finemist|perfumespray|lotionpump|reducer)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "reducer", "sprayer", "pump"],
    bodyDefault: "Elegant-oval-18-415-109x61",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { reducer: "reducer", sprayer: "perfumespray",
                   pump: "lotionpump" },
    closureFromSlug: { finemist: "sprayer", perfumespray: "sprayer",
                       lotionpump: "pump", reducer: "reducer" },
    buildSlug: (c, cl) => `elegant-100ml-${c}-18-415-${cl}`,
  },
  {
    // Diva 46 ml: a PHOTO-ONLY guided family. Its 46 clear-glass plates
    // (the diva-46ml-clear-18-415 plates) cover every closure it sells --
    // reducer, spray pump, lotion pump, dropper, vintage bulb, bulb + tassel.
    // No geometry exists, so this entry carries no body and never shows 3D;
    // it is here so Diva sells through the same guided page as the 9 mL.
    key: "diva46",
    finish: "18-415",
    photoOnly: true,
    slugRe: /^diva-46ml-(clear|frosted)-18-415-(perfumespray|lotionpump|reducer|dropper|antiquespray|antiquespray-tassel)$/,
    glasses: ["clear", "frosted"],
    bases: ["none", "reducer", "dropper", "sprayer", "pump", "antique", "antiqueTassel"],
    bodyDefault: "",
    slugColour: { clear: "clear", frosted: "frosted" },
    slugClosure: { reducer: "reducer", dropper: "dropper", sprayer: "perfumespray",
                   pump: "lotionpump", antique: "antiquespray",
                   antiqueTassel: "antiquespray-tassel" },
    // the committed closure is read off the LAST slug token, so the tassel
    // page reads as "tassel"
    closureFromSlug: {
      perfumespray: "sprayer", lotionpump: "pump", reducer: "reducer",
      dropper: "dropper", antiquespray: "antique", tassel: "antiqueTassel",
    },
    buildSlug: (c, cl) => `diva-46ml-${c}-18-415-${cl}`,
  },
];

export function familyForSlug(slug: string): ConfiguratorFamily | null {
  return CONFIGURATOR_FAMILIES.find((f) => f.slugRe.test(slug)) ?? null;
}

/**
 * The product-group slug grammar the catalogue uses:
 *   <family>-<capacity>ml-<colour>-<neck>[-<closure>]
 *   cylinder-5ml-cobalt-blue-13-415-rollon · boston-round-30ml-amber-20-400
 *   apothecary-30ml-green-ground · cylinder-3ml-clear-12mm-finemist
 * A slug outside it (cylinder-9ml-clear, cylinder-118ml-clear) derives nothing.
 */
const SLUG_GRAMMAR =
  /^([a-z]+(?:-[a-z]+)*?)-(\d+(?:\.\d+)?ml)-([a-z]+(?:-[a-z]+)*?)-(\d+-\d+|\d+mm|ground)(?:-([a-z]+(?:-[a-z]+)*))?$/;
// groups: 1 family · 2 capacity · 3 colour · 4 neck · 5 closure (optional)

/** slug colour token -> glass preset, where one exists; other colours keep
 *  their token as the id and take their label from the group */
export const PRESET_FOR_COLOUR: Record<string, GlassPresetId> = {
  clear: "clear", amber: "amber", "cobalt-blue": "cobalt", cobalt: "cobalt", frosted: "frosted", swirl: "swirl",
};

/** every closure token the catalogue writes into a slug, by base. The first
 *  is what a derived family writes when it navigates; the page tries the
 *  others when a sibling only exists under one of them. */
export const CLOSURE_TOKENS: Record<Exclude<ClosureBase, "none">, string[]> = {
  roller: ["rollon"],
  sprayer: ["finemist", "perfumespray"],
  pump: ["lotionpump"],
  reducer: ["reducer"],
  dropper: ["dropper"],
  antique: ["antiquespray"],
  antiqueTassel: ["antiquespray-tassel"],
};

/**
 * A photo-only family read off the slug, for a group that sells through its
 * plates but has no entry above. Same contract as a registered family, so the
 * guided page needs no second code path: it shows the plate, offers the
 * closures and colourways its siblings prove exist, and never 3D.
 */
export function deriveFamily(slug: string): ConfiguratorFamily | null {
  const m = SLUG_GRAMMAR.exec(slug);
  if (!m) return null;
  const [, fam, cap, colour, neck] = m;
  const preset = PRESET_FOR_COLOUR[colour] ?? "clear";
  const closureFromSlug: Record<string, Exclude<ClosureBase, "none">> = {};
  const slugClosure: Partial<Record<ClosureBase, string>> = {};
  for (const [base, tokens] of Object.entries(CLOSURE_TOKENS) as Array<[Exclude<ClosureBase, "none">, string[]]>) {
    slugClosure[base] = tokens[0];
    for (const t of tokens) closureFromSlug[t.split("-").pop() ?? t] = base;
  }
  return {
    key: `${fam}-${cap}-${neck}`,
    // photo-only: the finish only ever reaches the 3D closures, which never mount
    finish: neck === "17-415" ? "17-415" : "18-415",
    slugRe: new RegExp(`^${fam}-${cap}-[a-z-]+-${neck}(?:-[a-z-]+)?$`),
    glasses: [preset],
    bases: ["none", "roller", "reducer", "dropper", "sprayer", "pump", "antique", "antiqueTassel"],
    bodyDefault: "",
    photoOnly: true,
    derived: true,
    slugColour: { [preset]: colour },
    slugClosure,
    closureFromSlug,
    buildSlug: (c, cl) => (cl ? `${fam}-${cap}-${c}-${neck}-${cl}` : `${fam}-${cap}-${c}-${neck}`),
  };
}

/** a registered family first, else one derived from the slug */
export function familyForSlugOrDerived(slug: string): ConfiguratorFamily | null {
  return familyForSlug(slug) ?? deriveFamily(slug);
}

/** the colour token in a slug, or null when the slug is outside the grammar */
export function colourTokenFromSlug(slug: string): string | null {
  return SLUG_GRAMMAR.exec(slug)?.[3] ?? null;
}

/** The closure token a sibling slug must carry for this family, read from
 *  the current slug. Tokens are not always one word (Diva's tassel page is
 *  "...-antiquespray-tassel"), so the last word only identifies the BASE;
 *  the registry writes the full token back. */
export function closureTokenFromSlug(f: ConfiguratorFamily, slug: string): string {
  const last = slug.split("-").pop() ?? "";
  const base = f.closureFromSlug[last];
  return (base && f.slugClosure[base]) || last;
}

export function glassFromSlug(f: ConfiguratorFamily, slug: string): GlassPresetId {
  for (const [glass, token] of Object.entries(f.slugColour)) {
    if (slug.includes(`-${token}-`)) return glass as GlassPresetId;
  }
  return f.glasses[0];
}
