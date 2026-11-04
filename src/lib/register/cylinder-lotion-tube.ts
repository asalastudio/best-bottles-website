import type { KitPartLike } from "@/lib/products/pdp-redesign/stage";

/** Transparent cleanup of the internal part in the 25 ml catalogue photograph.
 * Exterior pumps, collars, caps and bottle bodies are separate, unchanged assets.
 * Registration values below are image coordinates, not physical measurements. */
export const CYLINDER_LOTION_TUBE_IMAGE = {
    url: "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/reviewed-master-media/2026-11-02/6c26aa96b7c791e53319c78bd519514479170d45f27f17a61ff5b4b07d435ffa.png",
    key: "reviewed-master-media/2026-11-02/6c26aa96b7c791e53319c78bd519514479170d45f27f17a61ff5b4b07d435ffa.png",
    sha256: "6c26aa96b7c791e53319c78bd519514479170d45f27f17a61ff5b4b07d435ffa",
    bytes: 252512, width: 725, height: 2170,
} as const;

/** One material/curve, uniformly registered to a bottle's connection and tip. */
export function lotionTubeGeometry(axisX: number, top: number, tip: number) {
    const outline = { left: 240, top: 157, right: 474, bottom: 2096 };
    const scale = (tip - top) / (outline.bottom - outline.top);
    const x = axisX - 328.5 * scale;
    const y = top - outline.top * scale;
    return {
        image: { ...CYLINDER_LOTION_TUBE_IMAGE },
        box: { x, y, width: CYLINDER_LOTION_TUBE_IMAGE.width * scale, height: CYLINDER_LOTION_TUBE_IMAGE.height * scale },
        bounds: { left: x + outline.left * scale, top, right: x + outline.right * scale, bottom: tip },
    };
}

/** The 25 ml photo crop includes metal and glass fragments. Replace only its
 * internals, including EXPLODED. Other necks/bodies retain their own registration. */
export function withCylinder25LotionTube<P extends KitPartLike>(parts: P[], bodyId: string, axisX: number, pxPerMm: number): P[] {
    if (bodyId !== "cylinder-25ml-18-415" || !parts.some(part => part.slot === "pump")) return parts;
    const seated = parts.find(part => part.slot === "diptube" && part.box
        && (!part.views || part.views.includes("capon"))
        && (part.image.url.includes("cylinder-25ml-18-415-clear-lotion.")
            || part.image.url.includes("cylinder25-18415-2026-11-01/lotion-tube.")));
    const pump = parts.find(part => part.slot === "pump");
    if (!seated?.box || !pump) return parts;
    // The original crop's tube ends at row 1723; the remaining rows are the
    // photographed glass floor. Match that visible tip rather than the crop edge.
    const tip = seated.image.url.includes("cylinder-25ml-18-415-clear-lotion.")
        ? seated.box.y + seated.box.height * 1723 / 1789 : seated.bounds.bottom;
    const geometry = lotionTubeGeometry(axisX, pump.bounds.bottom - pxPerMm, tip);
    return parts.map(part => part.slot !== "diptube" ? part : {
        ...part, ...geometry,
        opacity: part.views?.includes("exploded") ? 1 : 0.62,
        blendMode: part.views?.includes("exploded") ? undefined : "multiply",
    });
}

/** Separate generated lotion internals based on each size's selected PSD. */
export function withSelected25LotionTube<P extends KitPartLike>(parts: P[], bodyId: string, axisX: number): P[] {
    if (!/^cylinder-(25|50|100)ml-18-415$/.test(bodyId) || !parts.some(part => part.slot === "pump")) return parts;
    return parts.map(part => {
        if (part.slot !== "diptube" || !part.box) return part;
        const top = part.bounds.top, bottom = part.bounds.bottom;
        const src = bodyId.includes("-100ml-")
            ? { url: "/images/cylinder-sprays/lotion100-b1a4e22a8bfc.png", sha256: "b1a4e22a8bfc9d070f835e68a6d0b293f4a589f677dcd5e409f380a42a43dfe8", bytes: 242296, width: 724, height: 2172, top: 20, bottom: 2151, axis: 366.5, left: 292, right: 455 }
            : bodyId.includes("-50ml-")
                ? { url: "/images/cylinder-sprays/lotion50-571a47a5cc8b.png", sha256: "571a47a5cc8be422db5c788835e3dc183bc9a1e26ea393ab7ec3b85a6c2c55f3", bytes: 283534, width: 724, height: 2171, top: 17, bottom: 2145, axis: 352.5, left: 264, right: 452 }
                : { url: "/images/cylinder-sprays/lotion-tube-d100d687646a.png", sha256: "d100d687646afa68f8781395c88332c7a51eb488b0f6b805c6cf26dca07934cc", bytes: 381864, width: 724, height: 2172, top: 60, bottom: 2115, axis: 361, left: 241, right: 502 };
        const scale = (bottom - top) / (src.bottom - src.top);
        const x = axisX - src.axis * scale, y = top - src.top * scale;
        return { ...part, image: { url: src.url, key: src.url, sha256: src.sha256, bytes: src.bytes, width: src.width, height: src.height }, image2x: null,
            box: { x, y, width: src.width * scale, height: src.height * scale },
            bounds: { left: x + src.left * scale, right: x + src.right * scale, top, bottom },
            opacity: part.views?.includes("exploded") ? 1 : 0.3 };
    });
}
