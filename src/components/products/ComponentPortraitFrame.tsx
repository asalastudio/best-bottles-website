import { componentLayerStyle, type ComponentLayer, type ComponentPortrait } from "@/lib/products/component-portrait";

/**
 * The configurator layers for one listed component, on the card's bone ground.
 * `view="hover"` shows cap off and swaps to cap on while the nearest `.group` is hovered.
 */
export default function ComponentPortraitFrame({
    portrait,
    label,
    eager = false,
    view = "capOff",
    onError,
}: {
    portrait: ComponentPortrait;
    label: string;
    eager?: boolean;
    view?: "capOff" | "capOn" | "hover";
    onError?: () => void;
}) {
    const capOn = portrait.capOn?.layers.length ? portrait.capOn.layers : null;
    if (!capOn) return <Layers layers={portrait.layers} label={label} eager={eager} onError={onError} />;
    const fade = "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none";
    const offClass = view === "capOn" ? "opacity-0" : view === "hover" ? "opacity-100 group-hover:opacity-0" : "opacity-100";
    const onClass = view === "capOn" ? "opacity-100" : view === "hover" ? "opacity-0 group-hover:opacity-100" : "opacity-0";
    return (
        <>
            <span className={`${fade} ${offClass}`} aria-hidden={view === "capOn" || undefined}>
                <Layers layers={portrait.layers} label={`${label}, cap off`} eager={eager} onError={onError} />
            </span>
            <span className={`${fade} ${onClass}`} aria-hidden={view !== "capOn" || undefined}>
                <Layers layers={capOn} label={`${label}, cap on`} eager={eager && view === "capOn"} onError={onError} />
            </span>
        </>
    );
}

function Layers({ layers, label, eager, onError }: {
    layers: ComponentLayer[];
    label: string;
    eager: boolean;
    onError?: () => void;
}) {
    return (
        <>
            {layers.map((layer, index) => (
                // These layers are already transparent. The frame's parent paints the bone ground.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={`${layer.url}-${index}`}
                    src={layer.url}
                    alt={index === 0 ? label : ""}
                    decoding="async"
                    loading={eager ? "eager" : "lazy"}
                    style={componentLayerStyle(layer)}
                    onError={onError}
                />
            ))}
        </>
    );
}
