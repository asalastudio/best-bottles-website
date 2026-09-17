import type { BuilderBody, BuilderKit } from "./model";

/** First paint only needs chooser identities and reviewed body images.
 * Kit layers are restored after the customer selects a bottle. */
export function slimBuilderBodies(bodies: BuilderBody[]): BuilderBody[] {
    return bodies.map(body => ({
        ...body,
        configurations: body.configurations.map(config => ({
            ...config,
            previewKitSku: config.previewKit?.sku ?? config.previewKitSku,
            kit: null,
            previewKit: undefined,
        })),
    }));
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
