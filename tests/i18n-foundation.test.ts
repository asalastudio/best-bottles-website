import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { localizeCollectionName, localizeCollectionSubtitle, localizeFamilyName, localizeMerchandisingName } from "@/i18n/catalogCopy";
import { localizeHref, stripLocalePrefix, switchLocaleHref } from "@/i18n/paths";
import { localeAfterProxyPass, resolveLocale } from "@/i18n/resolveLocale";
import { isEnglishOnlyPath } from "@/i18n/config";

function keysOf(value: unknown, prefix = ""): string[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) return prefix ? [prefix] : [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        keysOf(child, prefix ? `${prefix}.${key}` : key),
    );
}

describe("Spanish locale foundation", () => {
    it("keeps English unprefixed and Spanish on /es", () => {
        expect(localizeHref("en", "/catalog")).toBe("/catalog");
        expect(localizeHref("es", "/catalog")).toBe("/es/catalog");
        expect(localizeHref("es", "/")).toBe("/es");
        expect(localizeHref("es", "/catalog?search=9ml")).toBe("/es/catalog?search=9ml");
        expect(localizeHref("es", "/products/cylinder-9ml-clear-17-415-rollon")).toBe("/es/products/cylinder-9ml-clear-17-415-rollon");
        expect(localizeHref("es", "/sign-in?redirect_url=%2Fportal")).toBe("/sign-in?redirect_url=%2Fportal");
        expect(stripLocalePrefix("/es/catalog")).toBe("/catalog");
        expect(stripLocalePrefix("/es")).toBe("/");
        expect(switchLocaleHref("es", "/catalog", "search=cylinder")).toBe("/es/catalog?search=cylinder");
        expect(switchLocaleHref("en", "/es/catalog", "search=cylinder")).toBe("/catalog?search=cylinder");
    });

    it("rewrites public /es routes and redirects internal ones back to English", () => {
        expect(resolveLocale("/catalog")).toEqual({ kind: "next", locale: "en", pathname: "/catalog" });
        expect(resolveLocale("/es")).toEqual({ kind: "rewrite", locale: "es", pathname: "/es", rewritePath: "/" });
        expect(resolveLocale("/es/catalog")).toEqual({
            kind: "rewrite",
            locale: "es",
            pathname: "/es/catalog",
            rewritePath: "/catalog",
        });
        expect(resolveLocale("/es/portal/orders")).toEqual({
            kind: "redirect",
            locale: "en",
            pathname: "/es/portal/orders",
            redirectPath: "/portal/orders",
        });
        expect(isEnglishOnlyPath("/team/products")).toBe(true);
        expect(isEnglishOnlyPath("/catalog")).toBe(false);
        expect(localeAfterProxyPass("/es/catalog", null)).toBe("es");
        expect(localeAfterProxyPass("/catalog", "es")).toBe("es");
        expect(localeAfterProxyPass("/catalog", null)).toBe("en");
    });

    it("does not treat /esfoo as a locale prefix", () => {
        expect(resolveLocale("/estate")).toEqual({ kind: "next", locale: "en", pathname: "/estate" });
        expect(stripLocalePrefix("/estate")).toBe("/estate");
    });

    it("keeps English and Spanish dictionaries aligned", () => {
        expect(keysOf(es).sort()).toEqual(keysOf(en).sort());
        expect(es.nav.fullCatalog).toBe("Catálogo completo");
        expect(es.nav.browseFullCatalog).toBe("Ver el catálogo completo");
        expect(es.nav.journal).toBe("Journal");
        expect(es.nav.journal).not.toBe("Diario");
        expect(es.nav.askGrace).toBe("Preguntar a Gracia");
        expect(es.tabs.grace).toBe("Gracia");
        expect(es.grace.name).toBe("Gracia");
        expect(es.catalog.loadMore).toBe("Cargar más");
        expect(es.catalog.description).toContain("tarros");
        expect(es.catalog.visibleHelp).toContain("especialista en frascos");
        expect(es.catalog.visibleHelp).toContain("Gracia");
        expect(es.catalog.familyIntro.startsWith("Los frascos")).toBe(true);
        expect(es.footer.fitmentGuide).toBe("Guía de compatibilidad");
        expect(es.footer.packagingInsights).toBe("Artículos de empaque");
        expect(es.home.packagingInsights).toBe("Artículos de empaque");
        expect(es.home.viewAllArticles).toBe("Ver todos los artículos");
        expect(en.nav.askGrace).toBe("Ask Grace");
        expect(en.grace.name).toBe("Grace");
        expect(en.catalog.masterTitle).toBe("Master Catalog");
    });

    it("does not use the English agent name Grace in Spanish chrome copy", () => {
        const offenders: string[] = [];
        const walk = (value: unknown, path: string) => {
            if (typeof value === "string") {
                if (/\bGrace\b/.test(value) && path !== "familiesDirectory.seoDescription") {
                    offenders.push(`${path}: ${value}`);
                }
                return;
            }
            if (value && typeof value === "object" && !Array.isArray(value)) {
                for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
                    walk(child, path ? `${path}.${key}` : key);
                }
            }
        };
        walk(es, "");
        expect(offenders).toEqual([]);
    });

    it("overlays Cylinder merchandising copy without translating SKUs or neck threads", () => {
        expect(localizeFamilyName("es", "Cylinder")).toBe("Cilindro");
        expect(localizeFamilyName("en", "Cylinder")).toBe("Cylinder");
        expect(localizeFamilyName("es", "Boston Round")).toBe("Boston Round");
        expect(localizeMerchandisingName("es", {
            displayName: "9 ml Clear Cylinder Roll-On Bottle",
            family: "Cylinder",
            slug: "cylinder-9ml-clear-17-415-rollon",
        })).toBe("Cilindro 9 ml transparente — roll-on 17-415");
        expect(localizeMerchandisingName("es", {
            displayName: "9 ml Clear Cylinder Roll-On Bottle",
            family: "Cylinder",
            slug: "unknown-slug",
        })).toContain("Cilindro");
        expect(localizeMerchandisingName("es", {
            displayName: "9 ml Clear Cylinder Roll-On Bottle",
            family: "Cylinder",
            slug: "cylinder-9ml-clear-17-415-rollon",
        })).toContain("17-415");
        expect(localizeMerchandisingName("es", {
            displayName: "50 ml Clear Cylinder Reducer Bottle",
            family: "Cylinder",
            slug: "cylinder-50ml-clear-18-415-reducer",
        })).toBe("Cilindro 50 ml transparente — reductor de orificio 18-415");
    });

    it("overlays shop collection titles by key so English CMS copy does not leak on /es", () => {
        expect(localizeCollectionName("es", "cream-jars", "Cream Jars")).toBe("Tarros para crema");
        expect(localizeCollectionName("en", "cream-jars", "Cream Jars")).toBe("Cream Jars");
        expect(localizeCollectionName("es", "roll-on-bottles", "Roll-On Bottles")).toBe("Frascos roll-on");
        expect(localizeCollectionSubtitle("es", "accessories-packaging", "Loose components, tools, bags and boxes.")).toBe(
            "Componentes sueltos, herramientas, bolsas y cajas.",
        );
        expect(localizeCollectionSubtitle("en", "accessories-packaging", "Loose components, tools, bags and boxes.")).toBe(
            "Loose components, tools, bags and boxes.",
        );
    });
});
