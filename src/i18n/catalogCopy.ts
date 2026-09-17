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
    "cylinder-50ml-clear-18-415-reducer": "Cilindro 50 ml transparente — reductor 18-415",
    "cylinder-100ml-clear-18-415-perfumespray": "Cilindro 100 ml transparente — spray de perfume 18-415",
};

export function localizeFamilyName(locale: AppLocale, family: string): string {
    if (locale !== "es") return family;
    return FAMILY_DISPLAY_ES[family] ?? family;
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
