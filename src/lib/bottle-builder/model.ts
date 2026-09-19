import { exactComponentMatches } from "./component-matches";
import { sourceComponentLink, sourceComponentLinks } from "./source-component-links";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { CartItem } from "@/components/CartProvider";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import bodyMedia from "./bodies.generated.json";
import assemblyMedia from "./circle-assemblies.generated.json";
import fitmentMedia from "./fitments.generated.json";
import rollerMedia from "./rollers.generated.json";
import cobaltRollerMedia from "./rollers-cobalt.generated.json";
import { resolveChargedUnitPrice } from "@/lib/volumePricing";

type MatrixRow = FunctionReturnType<typeof api.matrix.getFamilyRows>["rows"][number];
export type CatalogRow = Omit<MatrixRow, "resolution"> & {
    resolution: MatrixRow["resolution"] | "source_verified";
    compatibilitySources?: string[];
};
export type BuilderKit = NonNullable<FunctionReturnType<typeof api.productKits.forSku>>;
export type BuilderPart = BuilderKit["parts"][number];
export type BuilderConfiguration = {
    id: string;
    bodyId: string;
    family: string;
    capacityMl: number;
    neck: string;
    color: string;
    fitment: string;
    closure: string;
    kit: BuilderKit | null;
    previewKit?: BuilderKit;
    /** Sibling kit used for cap-split previews; kept when kits are stripped from first paint. */
    previewKitSku?: string;
    /** Only the registered bare-glass layer, kept when kits are stripped from
     * first paint so a family with no reviewed body image still draws a chooser
     * tile. The selected bottle's real kit replaces it as soon as it loads. */
    chooserKit?: BuilderKit;
    photoUrl: string | null;
    bodyImage: { url: string; width: number; height: number } | null;
    finishComponent: { websiteSku: string; imageUrl: string | null; name: string };
    profileLabel: string;
    product: CartItem;
    caseQuantity: number | null;
};
export type BuilderBody = {
    id: string;
    profileLabel: string;
    family: string;
    capacityMl: number;
    neck: string;
    configurations: BuilderConfiguration[];
    unavailableFinishes?: { id: string; color: string; fitment: string; closure: string; imageUrl: string }[];
};
export type BuilderSelection = {
    bodyId: string | null;
    color: string | null;
    fitment: string | null;
    closure: string | null;
    quantity: number;
};
export { ORDER_MINIMUM } from "@/lib/checkout";
export const MAX_QUANTITY = 1_000_000;
export const emptySelection = (): BuilderSelection => ({ bodyId: null, color: null, fitment: null, closure: null, quantity: 12 });
const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
const closureSlots = new Set(["cap", "overcap"]);
export const isClosurePart = (part: BuilderPart) => closureSlots.has(part.slot);

/** Join the selected assembly to a real, active component returned by matrix.
 * Neck equality and another finish on a complete SKU are not sufficient.
 * Standalone component publication is independent of the complete assembly's
 * eligibility, checked by isBuilderCandidate and again at cart preflight. */
export function compatibleFinishComponent(row: CatalogRow) {
    const source = sourceComponentLink(row);
    if (!source && sourceComponentLinks.some(link => link.assemblySku === row.websiteSku)) return null;
    const exact = exactComponentMatches[row.websiteSku ?? ""] ?? source;
    if (exact && (row.family !== exact.family || row.capacityMl !== exact.capacityMl || row.color !== exact.color
        || row.neckThreadSize !== exact.neck || (row.applicator ?? null) !== exact.applicator)) return null;
    const app = row.applicator ?? "";
    const kind = /roller/i.test(app) ? "Roll-On Cap" : /pump/i.test(app) && !/spray/i.test(app) ? "Lotion Pump"
        : /spray/i.test(app) ? "Sprayer" : /dropper/i.test(app) ? "Dropper" : "Cap";
    // 2026-09-14: 16 tassel assemblies carry the plain "Vintage Bulb Sprayer"
    // applicator; their catalogue name still says "with tassel", and the
    // tassel sprayer is a different component from the plain bulb sprayer.
    const tassel = /tassel/i.test(app) || (/vintage|bulb/i.test(app) && /with tassel/i.test(row.itemName ?? ""));
    const skuPattern = kind === "Sprayer"
        ? tassel ? /^(AnSpTsl|CP\d+-\d+AnSpTsl)/i
        : /vintage|bulb/i.test(app) ? /^(AnSp(?!Tsl)|CP\d+-\d+AnSp(?!Tsl))/i
        : /^(Spry|CP\d+-\d+Spry)/i
        : kind === "Roll-On Cap" ? /^CPRoll/i : kind === "Lotion Pump" ? /^Ltn/i
        // Boston/Vial short caps are catalogued neck-first ("18-400CpShortBlk", "20-400cp1ozShortBlk")
        : kind === "Dropper" ? /^Drp/i : /^(CP(?!Roll|.*(?:Spry|AnSp))|\d+-\d+cp)/i;
    const finish = getFinishFromWebsiteSku(row.websiteSku)?.label ?? row.capColor?.trim();
    if (!finish && !exact) return null;
    const matches = (row.components[kind] ?? []).filter(part => part.websiteSku && part.graceSku
        && !/__RETIRED__/i.test(part.websiteSku)
        && !/out of stock|discontinued|unavailable/i.test(part.stockStatus ?? "")
        && skuPattern.test(part.websiteSku) && part.websiteSku.includes(row.neckThreadSize ?? "invalid")
        && (exact ? part.websiteSku === exact.componentSku : getFinishFromWebsiteSku(part.websiteSku)?.label === finish));
    if (matches.length !== 1) return null;
    const part = matches[0];
    return { websiteSku: part.websiteSku!, imageUrl: part.imageUrl ?? null, name: part.itemName ?? kind };
}

export function reviewedBodyImage(row: CatalogRow) {
    const media = bodyMedia as Record<string, { url: string; width: number; height: number }>;
    // Distinct moulds of one family and capacity (Footed vs Tall Rectangle 10 ml)
    // carry their own reviewed body, keyed by the group profile; the family key
    // serves every family with a single mould at that capacity.
    const marker = `-${row.capacityMl}ml-`;
    const profile = row.productGroupSlug?.includes(marker) ? row.productGroupSlug.split(marker)[0] : null;
    const byProfile = profile ? media[`${profile}|${row.capacityMl}|${row.color}|${row.neckThreadSize}`] : undefined;
    return byProfile ?? media[`${row.family}|${row.capacityMl}|${row.color}|${row.neckThreadSize}`] ?? null;
}

/** The chooser shows every bottle as bare clear glass. A body whose first
 * configuration is coloured (Boston Round 15 ml sells amber and cobalt on dev)
 * still has its reviewed clear layer, so the tile borrows it. */
export function clearBodyPreview(body: BuilderBody): BuilderConfiguration {
    const first = body.configurations[0];
    const clear = body.configurations.find(config => config.color === "Clear") ?? first;
    if (clear.color === "Clear") return clear;
    const media = bodyMedia as Record<string, { url: string; width: number; height: number }>;
    const profile = body.id.split("|")[0].replace(new RegExp(`-${body.capacityMl}ml$`), "");
    const image = media[`${profile}|${body.capacityMl}|Clear|${body.neck}`] ?? media[`${body.family}|${body.capacityMl}|Clear|${body.neck}`];
    if (!image) return first;
    return { ...first, color: "Clear", bodyImage: image, kit: null, previewKit: undefined, chooserKit: undefined };
}

/** Glass swatches show the same bare glass at the same size. A configuration
 * that carries a kit would otherwise render through the kit's registered
 * frame while its kit-less siblings render the body layer, so one colour
 * came out small beside the others (Boston Round 15 ml, 2026-09-14). */
export function bareGlassPreview(config: BuilderConfiguration): BuilderConfiguration {
    return config.bodyImage ? { ...config, kit: null, previewKit: undefined, chooserKit: undefined } : config;
}

export function reviewedFitmentImage(config: BuilderConfiguration) {
    return (fitmentMedia as Record<string, { url: string; width: number; height: number }>)[`${config.family}|${config.capacityMl}|${config.neck}|${config.fitment}`] ?? null;
}

/** Distinguish data/compatibility failures from missing reviewed imagery. */
export function assessBuilderConfiguration(row: CatalogRow, kit: BuilderKit | null = null) {
    const configuration = configurationFromRow(row, kit) ?? catalogConfigurationFromRow(row);
    const issue = configuration ? null : row.resolution === "unknown" || !compatibleFinishComponent(row)
        ? "compatibility_unresolved" : !isBuilderCandidate(row) ? "catalog_unavailable" : "media_unavailable";
    return { configuration, issue };
}

/** Uses the already resolved compatibility result from convex/matrix.ts.
 * A complete, orderable assembly is the purchase unit: never charge a second
 * loose component on top of an assembly that already includes that component.
 */
export function isBuilderCandidate(row: CatalogRow): boolean {
    return row.resolution !== "unknown"
        && !/__RETIRED__/i.test(row.websiteSku ?? "")
        && Boolean(compatibleFinishComponent(row))
        && Boolean(row.graceSku && row.websiteSku && row.itemName && row.family && row.color && row.neckThreadSize)
        && /bottle|vial/i.test(row.category ?? "")
        && Boolean(row.capacityMl && row.capacityMl > 0)
        && Boolean(row.shopifyVariantId) && row.shopifySellable !== false
        && !/out of stock|discontinued|unavailable/i.test(row.stockStatus ?? "")
        && typeof row.webPrice1pc === "number" && Number.isFinite(row.webPrice1pc) && row.webPrice1pc > 0;
}

/** A capSplit body may include its mechanism. Reuse a validated identical bare
 * bottle only for the body stage; retain the exact kit for fitment and completion. */
export function configurationFromRow(row: CatalogRow, kit: BuilderKit | null, preview?: BuilderConfiguration): BuilderConfiguration | null {
    if (!isBuilderCandidate(row) || !kit || kit.conflicts.length
        || (kit.sku !== row.websiteSku && kit.sku !== row.graceSku)) return null;
    const app = row.applicator?.trim();
    const capOnly = app === "Cap/Closure" || ((!app || app === "N/A") && /\bcap\b/i.test(row.itemName ?? ""));
    const assemblySplit = kit.completeness === "capSplit" && !capOnly && Boolean(app && app !== "N/A")
        && preview?.kit?.completeness === "full" && preview.kit.familyId === kit.familyId
        && preview.family === row.family && preview.capacityMl === row.capacityMl && preview.color === row.color
        && preview.neck === row.neckThreadSize
        && kit.parts.some(isClosurePart);
    if (kit.completeness !== "full" && !(capOnly && kit.completeness === "capSplit") && !assemblySplit) return null;
    const body = kit.parts.find(part => part.slot === "body");
    if (!body || !kit.parts.some(part => part.slot !== "body")) return null;
    // background-matte: the master photograph with its white studio ground stripped (Boston amber/cobalt, 2026-09-16)
    if (!["psd-layer", "madison", "background-matte"].includes(body.derivation)) return null;
    if (!kit.parts.every(part => part.image.width === kit.canvas.width && part.image.height === kit.canvas.height
        && (part.image.url.startsWith("https://") || part.image.url.startsWith("/local-kits/")) && part.assembled.x === 0 && part.assembled.y === 0
        && part.bounds.right > part.bounds.left && part.bounds.bottom > part.bounds.top)) return null;
    if (!(kit.anchors.baselineY > kit.anchors.seatY && kit.anchors.seatY >= 0
        && kit.anchors.baselineY <= kit.canvas.height)) return null;
    const { family, color, capacityMl, neckThreadSize: neck } = row;
    // Fail closed on catalog/asset identity drift, including capacity aliases.
    const suffix = `-${slug(color!)}-${slug(neck!)}`;
    if (!kit.familyId.endsWith(suffix) || !kit.familyId.includes(`-${capacityMl}ml-`)) return null;
    // Short Cylinder 5.5 ml is an unresolved imported identity, not a new body.
    if (family === "Cylinder" && capacityMl === 5.5) return null;
    const fitment = capOnly ? "Screw Cap" : app === "Metal Roller Ball" ? "Metal Roller"
        : app === "Plastic Roller Ball" ? "Plastic Roller" : app === "Perfume Spray Pump" ? "Perfume Sprayer" : app;
    if (!fitment || fitment === "N/A") return null;
    const mechanism = kit.parts.filter(part => part.slot !== "body" && !isClosurePart(part));
    if (!capOnly && !assemblySplit && mechanism.length === 0) return null;
    const config = catalogConfigurationFromRow(row, kit);
    if (assemblySplit) {
        if (!config || config.bodyId !== preview!.bodyId) return null;
        return { ...config, previewKit: preview!.kit! };
    }
    return config;
}

/** A published separated kit or a reviewed source body is required. A complete
 * product photograph must never stand in for an unassembled bottle. */
export function catalogConfigurationFromRow(row: CatalogRow, kit: BuilderKit | null = null, plateUrl: string | null = null): BuilderConfiguration | null {
    const bodyImage = reviewedBodyImage(row);
    // The complete-stage photograph: a reviewed Circle assembly, else the SKU's
    // own published plate (the same exact master front, registered to the canvas).
    const assembly = (assemblyMedia as Record<string, { url: string }>)[row.websiteSku ?? ""] ?? (plateUrl ? { url: plateUrl } : undefined);
    if (!isBuilderCandidate(row) || (!kit && (!bodyImage || !assembly)) || (row.family === "Cylinder" && row.capacityMl === 5.5)) return null;
    const { family, color, capacityMl, neckThreadSize: neck } = row;
    const app = row.applicator?.trim();
    const capOnly = app === "Cap/Closure" || ((!app || app === "N/A") && /\bcap\b/i.test(row.itemName ?? ""));
    let fitment = capOnly ? /tear[ -]off/i.test(row.itemName ?? "") ? "Tear-off Cap" : "Screw Cap" : app === "Metal Roller Ball" ? "Metal Roller"
        : app === "Plastic Roller Ball" ? "Plastic Roller" : app === "Perfume Spray Pump" ? "Perfume Sprayer"
        : app && app !== "N/A" ? app : /\bapplicator\b/i.test(row.itemName ?? "") ? "Applicator" : null;
    if (!fitment) return null;
    const description = row.itemName ?? "";
    // The same catalogue witness the finish component uses: a tassel assembly
    // whose applicator field says plain "Vintage Bulb Sprayer" is still a
    // tassel sprayer, and shares a selection tuple with the plain one otherwise.
    if (/vintage|bulb/i.test(fitment) && !/tassel/i.test(fitment) && /with\s+tassel/i.test(description)) fitment = `${fitment} with Tassel`;
    const name = getCustomerFacingProductName({ variant: row });
    const finishComponent = compatibleFinishComponent(row)!;
    let closure = name.variantLabel ?? row.capColor?.trim() ?? "Standard finish";
    // Tall or short is the listed cap's own name ("Tall Matt Silver caps" vs
    // "Short Matt Silver caps"); the row's capStyle says Tall on both Diva 46 reducers.
    const capName = finishComponent.name;
    const tall = /\btall\b/i.test(capName) ? true : /\bshort\b/i.test(capName) ? false : row.capStyle === "Tall";
    if (/Cap/.test(closure)) {
        if (tall && !/\bTall\b/i.test(closure)) closure = `Tall ${closure}`;
        if (!tall && /^Tall\s+/i.test(closure)) closure = closure.replace(/^Tall\s+/i, "");
    }
    if (/vintage|bulb/i.test(fitment)) {
        // Ivory bulb with a shiny gold or shiny silver collar; jeweled ring variants.
        const collar = description.match(/\b((?:shiny|matte|matt)\s+)?(gold|silver)\s+collar\b/i);
        if (collar && !new RegExp(`\\b${collar[2]}\\b`, "i").test(closure)) closure = `${closure}, ${titleCase(`${collar[1] ?? ""}${collar[2]}`)} Collar`;
        if (/jewel/i.test(description) && !/ring/i.test(closure)) closure = `${closure}, Jeweled Ring`;
    }
    // A dropper is sold as bulb + collar. The catalogue's cap colour names one or
    // the other ("Black" for GBBstnAmb15mlBlkDropperGlTrim, "Shiny Gold Trim" for
    // GBBstn1ozBlkDrpShnGlTrim), so three trims of one bulb collapsed into one
    // "White Collar" and were dropped as ambiguous. Name both parts from the
    // catalogue description whenever a trim is described.
    if (fitment === "Dropper") {
        const trim = row.itemName?.match(/\b((?:shiny|matte|matt)\s+)?(gold|silver)\s+trim\b/i);
        const bulb = row.itemName?.match(/\b(black|white)\s+dropper\b/i);
        if (trim && bulb) closure = `${titleCase(bulb[1])} Bulb, ${titleCase(`${trim[1] ?? ""}${trim[2]}`)} Trim Collar`;
    }
    // The group prefix preserves distinct molds with equal capacity and neck,
    // such as Footed Rectangle and Tall Rectangle, across colors and tops.
    const { bodyId, profileLabel } = builderBodyIdentity(row);
    return {
        id: row.websiteSku!, bodyId,
        family: family!, capacityMl: capacityMl!, neck: neck!, color: color!, fitment, closure, kit, profileLabel,
        bodyImage, finishComponent,
        photoUrl: assembly?.url ?? null,
        caseQuantity: row.caseQuantity && row.caseQuantity > 0 ? row.caseQuantity : null,
        product: {
            graceSku: row.graceSku!, websiteSku: row.websiteSku, itemName: name.displayName,
            shopifyVariantId: row.shopifyVariantId, shopifySellable: row.shopifySellable,
            checkoutEligible: true, productGroupSlug: row.productGroupSlug, quantity: 1,
            unitPrice: row.webPrice1pc, webPrice1pc: row.webPrice1pc,
            webPrice10pc: row.webPrice10pc, webPrice12pc: row.webPrice12pc,
            family: family!, capacity: `${capacityMl} ml`, color: color!, applicator: row.applicator,
            capColor: row.capColor, category: row.category, neckThreadSize: neck,
        },
    };
}

export function builderBodyIdentity(row: CatalogRow) {
    const { family, color, capacityMl, neckThreadSize: neck } = row;
    const capacityMarker = `-${capacityMl}ml-`;
    const profileName = row.productGroupSlug?.includes(capacityMarker)
        ? row.productGroupSlug.split(capacityMarker)[0] : slug(family!);
    const profile = `${profileName}-${capacityMl}ml`;
    const distinctShape = row.shape && !["standard", slug(family!), slug(color!)].includes(slug(row.shape)) ? slug(row.shape) : null;
    const profileLabel = (distinctShape ? `${distinctShape}-${profileName}` : profileName).split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    return { bodyId: `${profile}|${neck}|${row.category}${distinctShape ? `|${distinctShape}` : ""}`, profileLabel };
}

/** Reuse only a validated identical bare bottle/glass for the bottle-selection preview.
 * The selected SKU keeps its own complete assembly; canvases are never mixed. */
export function resolveBuilderConfigurations(rows: CatalogRow[], kits: (BuilderKit | null)[], plateUrls: (string | null)[] = []) {
    const full = rows.map((row, i) => configurationFromRow(row, kits[i]));
    return rows.map((row, i) => full[i] ?? full.reduce<BuilderConfiguration | null>((found, preview) =>
        found ?? (preview ? configurationFromRow(row, kits[i], preview) : null), null)
        ?? catalogConfigurationFromRow(row, null, plateUrls[i] ?? null));
}

const titleCase = (value: string) => value.trim().toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

export function groupBuilderBodies(configurations: BuilderConfiguration[]): BuilderBody[] {
    const groups = new Map<string, BuilderBody>();
    const identities = new Map<string, BuilderConfiguration[]>();
    for (const config of configurations) {
        const key = JSON.stringify([config.bodyId, config.color, config.fitment, config.closure]);
        identities.set(key, [...(identities.get(key) ?? []), config]);
    }
    // Ambiguous selection tuples must not silently choose an arbitrary SKU.
    for (const entries of identities.values()) {
        const unique = [...new Map(entries.map(config => [config.id, config])).values()];
        if (unique.length !== 1) continue;
        const config = unique[0];
        const group = groups.get(config.bodyId) ?? {
            id: config.bodyId, profileLabel: config.profileLabel, family: config.family, capacityMl: config.capacityMl, neck: config.neck, configurations: [],
        };
        group.configurations.push(config);
        groups.set(group.id, group);
    }
    for (const body of groups.values()) body.configurations.sort((a, b) =>
        (a.color === b.color ? 0 : a.color === "Clear" ? -1 : b.color === "Clear" ? 1 : a.color.localeCompare(b.color))
        || Number(Boolean(b.kit)) - Number(Boolean(a.kit)) || a.fitment.localeCompare(b.fitment) || a.closure.localeCompare(b.closure));
    return [...groups.values()].sort((a, b) => a.capacityMl - b.capacityMl || a.neck.localeCompare(b.neck));
}

export function deriveBuilder(bodies: BuilderBody[], state: BuilderSelection) {
    const body = bodies.find(body => body.id === state.bodyId) ?? null;
    const configurations = body?.configurations ?? [];
    const colors = [...new Set(configurations.map(config => config.color))];
    const color = colors.includes(state.color ?? "") ? state.color : null;
    const colored = configurations.filter(config => config.color === color);
    const fitments = [...new Set(colored.map(config => config.fitment))];
    const fitment = fitments.includes(state.fitment ?? "") ? state.fitment : null;
    const fitted = colored.filter(config => config.fitment === fitment);
    const closures = [...new Set(fitted.map(config => config.closure))];
    const closure = closures.includes(state.closure ?? "") ? state.closure : null;
    const matches = fitted.filter(config => config.closure === closure);
    const configuration = matches.length === 1 ? matches[0] : null;
    return { body, colors, color, colored, fitments, fitment, fitted, closures, closure, configuration };
}

/** Reconcile at each transition, preserving downstream values only where an
 * exact currently available configuration still supports them. */
export function reconcileSelection(bodies: BuilderBody[], state: BuilderSelection): BuilderSelection {
    const next = { ...state };
    let derived = deriveBuilder(bodies, next);
    if (!derived.body) return { ...emptySelection(), quantity: state.quantity };
    next.color = derived.color;
    // One glass only (clear-only bottles): there is nothing to choose, so the
    // glass is taken as read and the shopper goes straight to the fitment
    // (Jordan, 2026-09-16: "if there's just single-color glass, is it necessary?").
    if (!next.color && derived.colors.length === 1) next.color = derived.colors[0];
    derived = deriveBuilder(bodies, next);
    next.fitment = derived.fitment;
    next.closure = deriveBuilder(bodies, next).closure;
    const closures = deriveBuilder(bodies, next).closures;
    if (!next.closure && closures.length === 1) next.closure = closures[0];
    return next;
}

/** Choosing a body starts a new physical build, without carrying over a top. */
export function selectBuilderBody(bodies: BuilderBody[], state: BuilderSelection, bodyId: string): BuilderSelection {
    return reconcileSelection(bodies, { ...state, bodyId, color: null, fitment: null, closure: null });
}

export function previewParts(config: BuilderConfiguration, stage: "body" | "fitment" | "complete"): BuilderPart[] {
    const parts = [...((stage === "body" ? config.previewKit ?? config.kit ?? config.chooserKit : config.kit)?.parts ?? [])];
    const restored = ({ ...rollerMedia, ...cobaltRollerMedia } as Record<string, { bodySha256: string; part: BuilderPart }>)[config.id];
    // Exact source registration only. Never put a roller on a changed body asset,
    // a different fitment, or the bare-bottle stage.
    if (stage !== "body" && config.fitment === "Metal Roller" && restored
        && !parts.some(part => part.slot === "roller")
        && parts.some(part => part.slot === "body" && part.image.sha256 === restored.bodySha256)) {
        parts.push(restored.part);
    }
    return parts.filter(part => stage === "complete" || part.slot === "body"
        || (stage === "fitment" && (!isClosurePart(part) || /^(Screw|Tear-off) Cap$/.test(config.fitment))))
        .sort((a, b) => a.zOrder - b.zOrder);
}

export function builderCartItem(config: BuilderConfiguration, quantity: number): CartItem {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new Error("Enter a valid whole-number quantity.");
    const unitPrice = resolveChargedUnitPrice(quantity, config.product);
    if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0 || !config.product.shopifyVariantId
        || config.product.shopifySellable === false) throw new Error("This combination is no longer available.");
    return { ...config.product, quantity, unitPrice };
}

/** Match the cart's merged-SKU pricing, in cents, including any tier change. */
export function builderOrder(config: BuilderConfiguration | null, quantity: number, cart: CartItem[]) {
    const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
    const existingQuantity = cart.find(item => item.graceSku === config?.product.graceSku)?.quantity ?? 0;
    const priceAt = (qty: number) => config ? resolveChargedUnitPrice(qty + existingQuantity, config.product) : null;
    const unitPrice = validQuantity ? priceAt(quantity) : null;
    const total = unitPrice == null ? null : Math.round(unitPrice * 100) * quantity / 100;
    return { unitPrice, total, validQuantity,
        canAdd: Boolean(config && validQuantity && unitPrice && Number.isFinite(unitPrice) && unitPrice > 0
            && config.product.shopifyVariantId && config.product.shopifySellable !== false),
    };
}
