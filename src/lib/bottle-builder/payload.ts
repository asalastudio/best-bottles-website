import type { BuilderBody, BuilderConfiguration, BuilderKit } from "./model";

/** The chooser paints before any kit loads. Where a reviewed body image exists
 * it is used; a family whose bare bodies live only in its kits (Cylinder) would
 * otherwise have nothing to draw, so keep that one registered bare-glass layer.
 * No sibling parts, no second resolution, no mask: this is not a kit catalog. */
function chooserBodyKit(config: BuilderConfiguration): BuilderKit | undefined {
    const kit = config.previewKit ?? config.kit;
    const body = kit?.parts.find(part => part.slot === "body");
    if (!kit || !body) return undefined;
    return { ...kit, parts: [{ ...body, image2x: null, mask: null }] };
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
                    chooserKit: !config.bodyImage && firstOfColor ? chooserBodyKit(config) : undefined,
                    kit: null,
                    previewKit: undefined,
                };
            }),
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
