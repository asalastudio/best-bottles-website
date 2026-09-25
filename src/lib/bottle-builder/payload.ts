import type { BuilderBody, BuilderConfiguration, BuilderKit } from "./model";
import { resolveChargedUnitPrice } from "@/lib/volumePricing";

/** The chooser paints before any kit loads. Where a reviewed body image exists
 * it is used; a family whose bare bodies live only in its kits (Cylinder) would
 * otherwise have nothing to draw, so keep that one registered bare-glass layer.
 * No sibling parts, no second resolution, no mask, no kit catalog metadata. */
export function bareChooserKit(kit: BuilderKit): BuilderKit | undefined {
    const body = kit.parts.find(part => part.slot === "body");
    if (!body) return undefined;
    return {
        sku: kit.sku,
        familyId: kit.familyId,
        completeness: kit.completeness,
        conflicts: [],
        canvas: kit.canvas,
        anchors: kit.anchors,
        plateSha256: "",
        three: null,
        parts: [{ ...body, image2x: null, mask: null }],
    };
}

function chooserBodyKit(config: BuilderConfiguration): BuilderKit | undefined {
    const kit = config.previewKit ?? config.kit ?? config.chooserKit;
    return kit ? bareChooserKit(kit) : undefined;
}

/** First paint only needs chooser identities and reviewed body images.
 * Kit layers are restored after the customer selects a bottle. */
export function slimBuilderBodies(bodies: BuilderBody[]): BuilderBody[] {
    return bodies.map(body => {
        // Exactly the configurations the chooser draws: the first of each glass
        // colour, which is what clearBodyPreview and bareGlassPreview resolve to.
        const drawn = new Set<string>();
        return {
            ...body,
            configurations: body.configurations.map(config => {
                const firstOfColor = !drawn.has(config.color);
                drawn.add(config.color);
                return {
                    ...config,
                    previewKitSku: config.previewKit?.sku ?? config.previewKitSku,
                    // Idempotent on purpose. The family loader slims what it caches and the
                    // page slims what it renders, so this runs twice on the same bodies. The
                    // second pass finds `kit: null` and has nothing to cut a body from — it
                    // must keep the layer the first pass kept, not overwrite it with nothing.
                    chooserKit: !config.bodyImage && firstOfColor ? chooserBodyKit(config) ?? config.chooserKit : undefined,
                    kit: null,
                    previewKit: undefined,
                };
            }),
        };
    });
}

/** The chooser's own payload: one configuration per glass colour (exactly the
 * tiles and glass swatches draw), the fitments the filters need, and the
 * cheapest price per body and per colour. The Cylinder first paint inlined all
 * 410 configurations (789 KB) for six tiles; this keeps the dozen the tiles use.
 * The chosen bottle's full configurations load from /api/bottle-builder/bodies. */
export function chooserBodies(bodies: BuilderBody[]): BuilderBody[] {
    const cheapest = (configs: BuilderConfiguration[]) => {
        const prices = configs.map(config => resolveChargedUnitPrice(1, config.product))
            .filter((price): price is number => price != null && Number.isFinite(price) && price > 0);
        return prices.length ? Math.min(...prices) : null;
    };
    return slimBuilderBodies(bodies).map(body => {
        const drawn = new Set<string>();
        const colors = [...new Set(body.configurations.map(config => config.color))];
        return {
            ...body,
            configurations: body.configurations.filter(config => !drawn.has(config.color) && drawn.add(config.color)),
            chooserOnly: true,
            fitments: [...new Set(body.configurations.map(config => config.fitment))],
            priceFrom: cheapest(body.configurations),
            colorPriceFrom: Object.fromEntries(colors.map(color => [color, cheapest(body.configurations.filter(config => config.color === color))])),
        };
    });
}

export function attachBuilderKits(bodies: BuilderBody[], kits: Record<string, BuilderKit | null>): BuilderBody[] {
    return bodies.map(body => ({
        ...body,
        configurations: body.configurations.map(config => {
            const kit = kits[config.id];
            const preview = config.previewKitSku ? kits[config.previewKitSku] : undefined;
            return {
                ...config,
                kit: kit !== undefined ? kit : config.kit,
                previewKit: preview ?? config.previewKit,
            };
        }),
    }));
}
