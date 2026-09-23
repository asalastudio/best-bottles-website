import type { ReactNode } from "react";

/** Keep photographic offsets in the native 1000×1100 coordinate system even
 * when the surrounding desktop stage is height-limited or the viewer is wide. */
export default function PdpPhotoCanvas({ children }: { children: ReactNode }) {
    return <div className="h-full w-full" style={{ containerType: "size", display: "grid", placeItems: "center" }}>
        <div data-pdp-photo-canvas="" className="relative" style={{
            width: "min(100cqw, calc(100cqh * 10 / 11))",
            height: "min(100cqh, calc(100cqw * 11 / 10))",
        }}>{children}</div>
    </div>;
}
