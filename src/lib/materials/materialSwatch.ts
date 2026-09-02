/** Material token → swatch CSS. ONE-WAY seam (design handoff, required):
 * the swatch is always DERIVED from the material token — never hand-drawn,
 * never edited in reverse — so a token change moves the dot and the 3D
 * part together. Reads the same materials.json entries the render reads
 * (field is `color` there; `baseColor` accepted for forward compat).
 *
 * Derivation approximates the render system's studio HDRI:
 *  - metalness → specular streak strength + colour-tinted reflection
 *  - roughness → highlight size/softness (rough = broad sheen, smooth = hot spot)
 *  - baseColor → the body, darkened toward the lower rim for form
 */
export type SwatchableMaterial = {
  color?: string;
  baseColor?: string;
  roughness?: number;
  metalness?: number;
};

function hex2rgba(color: string, alpha: number): string {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const full = color.length === 4
      ? "#" + [...color.slice(1)].map((c) => c + c).join("")
      : color;
    const n = parseInt(full.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

export function materialSwatchCSS(material: SwatchableMaterial | undefined): string {
  const baseColor = material?.baseColor ?? material?.color ?? "#CCCCCC";
  const m = Math.max(0, Math.min(1, material?.metalness ?? 0));
  const r = Math.max(0, Math.min(1, material?.roughness ?? 0.5));
  const hiSize = 18 + r * 34;               // % radius of the specular lobe
  const hiAlpha = 0.85 - r * 0.55;          // brightness of the lobe
  // metals tint their reflection with the base colour; dielectrics reflect white
  const hiColor = m > 0.5
    ? `color-mix(in srgb, ${baseColor} 45%, white)`
    : "#ffffff";
  const rimDark = 0.18 + m * 0.22;          // metals get stronger form shading
  const layers = [
    `radial-gradient(circle at 32% 26%, ${hex2rgba(hiColor, hiAlpha)} 0%, transparent ${hiSize}%)`,
    m > 0.5
      ? `linear-gradient(160deg, transparent 42%, ${hex2rgba("#ffffff", Math.max(0, 0.25 - r * 0.18))} 50%, transparent 58%)`
      : null,
    `radial-gradient(circle at 50% 115%, ${hex2rgba("#000000", rimDark)} 0%, transparent 55%)`,
    baseColor,
  ].filter(Boolean);
  return layers.join(", ");
}

/** Fetchless registry hook-mate: components that already hold materials.json
 *  (the viewer fetches it) pass the entry through; anything without an entry
 *  falls back to a neutral dielectric dot rather than a hand-authored hex. */
export function swatchFor(
  mats: Record<string, SwatchableMaterial> | null | undefined,
  id: string,
): string {
  return materialSwatchCSS(mats?.[id]);
}
