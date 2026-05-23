import type { CSSProperties } from "react";

const SWATCH_PREFIX_PATTERNS = [
    /^Spray\s+/i,
    /^Screw\s+Cap\s+/i,
    /^Lotion\s+Pump\s+/i,
    /^Perfume\s+(Spray\s+)?Pump\s+/i,
    /^Roller\s+/i,
    /^Roll[-\s]On\s+/i,
    /^Dropper\s+/i,
    /^Atomizer\s+/i,
    /^Reducer\s+/i,
    /^Vintage\s+Bulb\s+Sprayer(\s+with\s+Tassel)?\s+/i,
    /^Antique\s+Spray(\s+Tassel)?\s+/i,
    /^Cap[/\s]*Closure\s+/i,
    /\s+Tall$/i,
];

const MATERIAL_BACKGROUNDS: Record<string, string> = {
    "shiny gold": "radial-gradient(circle at 28% 22%, #fff7c9 0 13%, #f7d766 28%, #b57b20 58%, #f4d378 100%)",
    gold: "radial-gradient(circle at 30% 24%, #fff1b5 0 12%, #e3bd49 31%, #aa7424 64%, #f0cf73 100%)",
    "matte gold": "linear-gradient(135deg, #ead3a0 0%, #c19a56 43%, #8f6d37 100%)",
    "ivory gold": "radial-gradient(circle at 30% 24%, #fff1b5 0 12%, #e3bd49 31%, #aa7424 64%, #f0cf73 100%)",
    "shiny silver": "radial-gradient(circle at 28% 22%, #ffffff 0 13%, #e8ebee 30%, #9da4aa 58%, #f8f8f8 100%)",
    silver: "radial-gradient(circle at 28% 22%, #fbfbfb 0 12%, #d7dbde 31%, #969da3 63%, #eeeeee 100%)",
    "matte silver": "linear-gradient(135deg, #e6e6e2 0%, #b7b8b6 48%, #8b8c8a 100%)",
    "ivory silver": "radial-gradient(circle at 28% 22%, #fbfbfb 0 12%, #d7dbde 31%, #969da3 63%, #eeeeee 100%)",
    copper: "radial-gradient(circle at 28% 22%, #ffd1a7 0 12%, #c97935 35%, #7c421f 64%, #e6a06a 100%)",
    "matte copper": "linear-gradient(135deg, #d59a69 0%, #a95f2b 48%, #67371c 100%)",
    "rose gold": "radial-gradient(circle at 28% 22%, #ffe1d7 0 12%, #e5a18f 37%, #9a5c52 64%, #efc1b5 100%)",
    "shiny black": "radial-gradient(circle at 28% 22%, #7a7a7a 0 10%, #181818 42%, #050505 78%, #303030 100%)",
    black: "linear-gradient(135deg, #4a4a4a 0%, #111111 42%, #050505 100%)",
    "matte black": "linear-gradient(135deg, #454545 0%, #242424 48%, #111111 100%)",
    white: "radial-gradient(circle at 30% 24%, #ffffff 0 18%, #f5f1e8 54%, #d9d2c6 100%)",
    "short white": "radial-gradient(circle at 30% 24%, #ffffff 0 18%, #f5f1e8 54%, #d9d2c6 100%)",
    clear: "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.92) 0 16%, rgba(224,241,246,0.72) 48%, rgba(174,206,214,0.54) 100%)",
    frosted: "linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(219,226,226,0.76) 48%, rgba(185,195,197,0.74) 100%)",
    amber: "radial-gradient(circle at 28% 22%, #f1b45d 0 12%, #b66b20 42%, #6f3a12 100%)",
    red: "radial-gradient(circle at 30% 24%, #ff8a93 0 12%, #c41e3a 44%, #7c1021 100%)",
    pink: "radial-gradient(circle at 30% 24%, #ffe0e7 0 15%, #f4a7b9 48%, #c46d82 100%)",
    lavender: "radial-gradient(circle at 30% 24%, #f5ebff 0 15%, #c9a8e5 48%, #8060a4 100%)",
    blue: "radial-gradient(circle at 30% 24%, #b7d2ee 0 12%, #5b87b5 44%, #29496f 100%)",
    "matte blue": "linear-gradient(135deg, #86acd2 0%, #4d78a5 48%, #2c486a 100%)",
    "cobalt blue": "radial-gradient(circle at 30% 24%, #7fa2db 0 12%, #355c9a 44%, #19305f 100%)",
    cobalt: "radial-gradient(circle at 30% 24%, #7fa2db 0 12%, #355c9a 44%, #19305f 100%)",
    green: "radial-gradient(circle at 30% 24%, #b2d3a9 0 12%, #6b9a6b 44%, #365a38 100%)",
    turquoise: "radial-gradient(circle at 30% 24%, #a6f1e2 0 12%, #40c4aa 44%, #187765 100%)",
    natural: "linear-gradient(135deg, #ead2aa 0%, #c49c68 48%, #8a633a 100%)",
    standard: "linear-gradient(135deg, #ede8dc 0%, #d5cec1 52%, #aaa295 100%)",
    "black leather": "linear-gradient(135deg, #4b382c 0%, #241a14 45%, #100b08 100%)",
    "brown leather": "linear-gradient(135deg, #a66a3d 0%, #734521 48%, #3c2110 100%)",
    "light brown leather": "linear-gradient(135deg, #dfb27d 0%, #ad7745 48%, #6f4526 100%)",
    "ivory leather": "linear-gradient(135deg, #fff4dd 0%, #e6d6bb 48%, #bda989 100%)",
    "pink leather": "linear-gradient(135deg, #f3c5c3 0%, #d89b98 48%, #a76866 100%)",
};

function normalizeMaterialLabel(label: string | null | undefined): string | null {
    if (!label) return null;
    let normalized = label.replace(/\s+/g, " ").trim();
    if (!normalized) return null;
    for (const pattern of SWATCH_PREFIX_PATTERNS) {
        const next = normalized.replace(pattern, "").trim();
        if (next && next !== normalized) normalized = next;
    }
    return normalized.toLowerCase();
}

export function getMaterialSwatchBackground(label: string | null | undefined, fallbackColor?: string | null): string | undefined {
    const key = normalizeMaterialLabel(label);
    if (key && MATERIAL_BACKGROUNDS[key]) return MATERIAL_BACKGROUNDS[key];
    return fallbackColor ?? undefined;
}

export function getMaterialSwatchStyle(
    label: string | null | undefined,
    options: {
        fallbackColor?: string | null;
        imageUrl?: string | null;
        size?: "cover" | "contain";
    } = {},
): CSSProperties {
    if (options.imageUrl) {
        return {
            backgroundImage: `url(${options.imageUrl})`,
            backgroundPosition: "center",
            backgroundSize: options.size ?? "cover",
        };
    }

    const background = getMaterialSwatchBackground(label, options.fallbackColor);
    return background ? { background } : {};
}
