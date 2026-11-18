import portraits from "./component-portraits.generated.json";

/**
 * The component layers the configurator already seats on a bottle, drawn with
 * no bottle and no background. Card width is 88 mm and every part shares that
 * scale, so an 8-425 cap reads smaller than a 13-415 and a pump reads taller.
 */
export type ComponentLayer = {
    url: string;
    left: number;
    top: number;
    width: number;
    height: number;
};

/** `layers` is the default view; for sprayers and pumps that is cap off, with the cap standing beside. */
export type ComponentPortrait = {
    mm: number;
    layers: ComponentLayer[];
    capOn?: { layers: ComponentLayer[] };
};

const PORTRAITS = portraits as Record<string, ComponentPortrait>;

export function componentPortrait(sku: string | null | undefined): ComponentPortrait | null {
    const portrait = sku ? PORTRAITS[sku] : undefined;
    if (!portrait?.layers?.length) return null;
    return portrait;
}

export function componentLayerStyle(layer: ComponentLayer): {
    position: "absolute";
    left: string;
    top: string;
    width: string;
    height: string;
    maxWidth: "none";
} {
    return {
        position: "absolute",
        left: `${layer.left}%`,
        top: `${layer.top}%`,
        width: `${layer.width}%`,
        height: `${layer.height}%`,
        maxWidth: "none",
    };
}
