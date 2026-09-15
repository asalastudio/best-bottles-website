import { describe, expect, it } from "vitest";
import { LEGACY_QUERY_REDIRECTS, LEGACY_REDIRECTS, resolveLegacyRedirect } from "../src/lib/seo/legacyRedirects";

describe("generated map", () => {
  it("covers the crawled product URLs", () => {
    const products = [...LEGACY_REDIRECTS.keys()].filter(k => k.startsWith("/product/"));
    expect(products.length).toBeGreaterThan(2700);
  });
  it("maps a product on its SKU, in any spelling the legacy site used", () => {
    const dest = resolveLegacyRedirect("/product/elegant-design-15-ml-glass-bottle-shiny-gold-spray");
    expect(dest).toMatch(/^\/products\/elegant-15ml/);
    expect(resolveLegacyRedirect("//product/Elegant-design-15-ml-glass-bottle-shiny-gold-spray/")).toBe(dest);
  });
  it("decodes percent-encoded legacy paths", () => {
    const k = [...LEGACY_REDIRECTS.keys()].find(k => k.includes(" "));
    if (k) expect(resolveLegacyRedirect(encodeURI(k))).toBe(LEGACY_REDIRECTS.get(k));
  });
  it("reads OPTinv_id case-insensitively", () => {
    const d = resolveLegacyRedirect("/all-bottles/option_details.php", new URLSearchParams("items_count=45&OPTinv_id=2037"));
    expect(d).toMatch(/^\/products\//);
  });
  it("ignores a subcat that does not belong to the page", () => {
    const hub = "/all-bottles/perfume-vials-glass-bottles/perfume-glas-bottle-vials-purchase.php";
    expect(resolveLegacyRedirect(hub, new URLSearchParams("subcat=74"))).toBe(LEGACY_REDIRECTS.get(hub));
  });
  it("tolerates the trailing slashes the legacy crawl recorded on subcat values", () => {
    const vials = "/All-Bottles/Perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php";
    expect(resolveLegacyRedirect(vials, new URLSearchParams("subcat=64////////"))).toBe("/catalog?shop=sample-vials");
  });
  it("sends an unknown legacy product to the catalogue, never null", () => {
    expect(resolveLegacyRedirect("/product/never-existed")).toBe("/catalog");
  });
  it("no destination is itself a legacy URL (no chains)", () => {
    for (const d of [...LEGACY_REDIRECTS.values(), ...LEGACY_QUERY_REDIRECTS.values()]) {
      const p = d.split(/[?#]/)[0].toLowerCase();
      if (p === "/") continue;
      expect(LEGACY_REDIRECTS.has(p), d).toBe(false);
    }
  });
});
