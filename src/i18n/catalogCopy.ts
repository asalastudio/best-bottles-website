import type { AppLocale } from "./config";

/** Merchandising overlay for one family in the first Spanish slice. Technical tokens stay English. */
export const FAMILY_DISPLAY_ES: Record<string, string> = {
    Cylinder: "Cilindro",
};

export const GROUP_DISPLAY_ES: Record<string, string> = {
    "cylinder-9ml-clear-17-415-rollon": "Cilindro 9 ml transparente — roll-on 17-415",
    "cylinder-9ml-clear-17-415-finemist": "Cilindro 9 ml transparente — spray de niebla fina 17-415",
    "cylinder-9ml-frosted-17-415-rollon": "Cilindro 9 ml esmerilado — roll-on 17-415",
    "cylinder-9ml-amber-17-415-rollon": "Cilindro 9 ml ámbar — roll-on 17-415",
    "cylinder-9ml-clear-13-415": "Cilindro 9 ml transparente 13-415",
    "cylinder-30ml-clear-18-415-finemist": "Cilindro 30 ml transparente — spray de niebla fina 18-415",
    "cylinder-50ml-clear-18-415-perfumespray": "Cilindro 50 ml transparente — spray de perfume 18-415",
    "cylinder-50ml-clear-18-415-reducer": "Cilindro 50 ml transparente — reductor de orificio 18-415",
    "cylinder-100ml-clear-18-415-perfumespray": "Cilindro 100 ml transparente — spray de perfume 18-415",
};

/** Shop-collection merchandising overlay. Keyed by collection id so Sanity English titles still localize on /es. */
export const COLLECTION_DISPLAY_ES: Record<string, { title: string; subtitle: string }> = {
    "roll-on-bottles": {
        title: "Frascos roll-on",
        subtitle: "Una aplicación precisa y personal.",
    },
    "perfume-atomizers": {
        title: "Atomizadores de perfume",
        subtitle: "Fragancia recargable, lista para viajar.",
    },
    "glass-spray-bottles": {
        title: "Frascos spray de vidrio",
        subtitle: "Niebla fina, perfume y sprays vintage de pera.",
    },
    "dropper-bottles": {
        title: "Frascos gotero",
        subtitle: "Una gota medida para aceites y sueros.",
    },
    "sample-vials": {
        title: "Viales de muestra",
        subtitle: "Formatos pequeños para primeras impresiones.",
    },
    "lotion-pump-bottles": {
        title: "Frascos con bomba para loción",
        subtitle: "Dosificación para lociones y tratamientos.",
    },
    "splash-on-bottles": {
        title: "Frascos splash-on",
        subtitle: "Frascos de fragancia con reductores de orificio.",
    },
    "decorative-bottles": {
        title: "Frascos decorativos",
        subtitle: "Corazones, lágrimas y formas distintivas.",
    },
    "apothecary-bottles": {
        title: "Frascos tipo boticario",
        subtitle: "Aplicadores y tapones de vidrio tradicionales.",
    },
    "cream-jars": {
        title: "Tarros para crema",
        subtitle: "Bocas anchas para cremas y bálsamos.",
    },
    "accessories-packaging": {
        title: "Accesorios y empaque",
        subtitle: "Componentes sueltos, herramientas, bolsas y cajas.",
    },
};

export function localizeFamilyName(locale: AppLocale, family: string): string {
    if (locale !== "es") return family;
    return FAMILY_DISPLAY_ES[family] ?? family;
}

export function localizeCollectionName(
    locale: AppLocale,
    key: string | null | undefined,
    fallback?: string | null,
): string {
    if (!key) return fallback ?? "";
    const overlay = locale === "es" ? COLLECTION_DISPLAY_ES[key] : undefined;
    if (overlay) return overlay.title;
    return fallback ?? key;
}

export function localizeCollectionSubtitle(
    locale: AppLocale,
    key: string | null | undefined,
    fallback?: string | null,
): string {
    if (!key) return fallback ?? "";
    const overlay = locale === "es" ? COLLECTION_DISPLAY_ES[key] : undefined;
    if (overlay) return overlay.subtitle;
    return fallback ?? "";
}

export function localizeMerchandisingName(
    locale: AppLocale,
    input: { displayName: string; family?: string | null; slug?: string | null },
): string {
    if (locale !== "es") return input.displayName;
    const slug = input.slug?.trim();
    if (slug && GROUP_DISPLAY_ES[slug]) return GROUP_DISPLAY_ES[slug];
    if (input.family === "Cylinder") {
        return input.displayName.replace(/\bCylinder\b/g, FAMILY_DISPLAY_ES.Cylinder ?? "Cilindro");
    }
    return input.displayName;
}
