/**
 * The register renderer in the browser: a body plate and its component
 * layers composed by src/lib/register/compose.ts and drawn as absolutely
 * positioned images inside a box shaped like the frame. Every position is a
 * percentage of the box, so the stage scales with its container and paints
 * the same picture the Node renderer wrote for the parity gate.
 *
 * Takes geometry and URLs only: the lab feeds it the local pilot cut-outs,
 * and a storefront consumer will feed it register:composition. No Convex here.
 */
import { compose, placementStyle, type Frame, type LayerGeometry, type PlateGeometry } from "@/lib/register/compose";

export type StagePlate = PlateGeometry & { url: string };
export type StageLayer = LayerGeometry & { url: string; componentId?: string };

type Props = {
    plate: StagePlate;
    layers: readonly StageLayer[];
    frame: Frame;
    alt: string;
    className?: string;
    /** Stage background; the pilot plates are baked for the hero bone. */
    background?: string;
};

export default function RegisterStage({ plate, layers, frame, alt, className, background = "#f5f3ef" }: Props) {
    const placements = compose(plate, layers, frame);
    return (
        <div
            className={`relative overflow-hidden ${className ?? ""}`}
            style={{ aspectRatio: `${frame.width} / ${frame.height}`, background }}
            data-register-stage=""
            data-frame={`${frame.axisX},${frame.seatY},${frame.pxPerMm.toFixed(4)}`}
        >
            {placements.map((placement) => {
                const source = placement.source as StagePlate | StageLayer;
                const isPlate = placement.kind === "plate";
                const layer = isPlate ? null : (source as StageLayer);
                return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        key={`${placement.zIndex}-${source.url}`}
                        src={source.url}
                        alt={isPlate ? alt : ""}
                        aria-hidden={isPlate ? undefined : true}
                        width={source.width}
                        height={source.height}
                        decoding="async"
                        loading="lazy"
                        draggable={false}
                        data-slot={isPlate ? "body" : layer?.slot}
                        data-component={layer?.componentId}
                        style={{ ...placementStyle(placement, frame), maxWidth: "none" }}
                    />
                );
            })}
        </div>
    );
}
