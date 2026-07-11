import { describe, expect, it } from "vitest";
import {
  isGraceCapacityOnlySearch,
  normalizeGraceCatalogNavigationPath,
} from "../src/lib/graceShapeIntent";

describe("Grace catalog navigation normalization", () => {
  it("detects direct size-only catalog searches", () => {
    expect(isGraceCapacityOnlySearch("50ml")).toBe(true);
    expect(isGraceCapacityOnlySearch("50 ml bottle")).toBe(true);
    expect(isGraceCapacityOnlySearch('"50ml"')).toBe(true);
    expect(isGraceCapacityOnlySearch("50ml fine mist")).toBe(false);
  });

  it("removes inherited filters from Grace size navigation", () => {
    const path = "/catalog?families=Elegant%2CEmpire%2CFlair%2CRectangle%2CSquare&search=50ml&applicators=finemist%2Cperfumespray&sort=best-match&grace=1";
    const normalized = normalizeGraceCatalogNavigationPath(path);
    const params = new URLSearchParams(normalized.split("?")[1]);

    expect(normalized.startsWith("/catalog?")).toBe(true);
    expect(params.get("search")).toBe("50ml");
    expect(params.get("sort")).toBe("best-match");
    expect(params.get("grace")).toBe("1");
    expect(params.has("families")).toBe(false);
    expect(params.has("family")).toBe(false);
    expect(params.has("applicators")).toBe(false);
  });

  it("preserves intentional non-size catalog filters", () => {
    const path = "/catalog?families=Cylinder&search=9ml%20roller&applicators=rollon&grace=1";

    expect(normalizeGraceCatalogNavigationPath(path)).toBe(path);
  });

  it("keeps explicit family intent when the customer's wording was family + size", () => {
    const path = "/catalog?families=Cylinder&search=9ml&grace=1";

    expect(normalizeGraceCatalogNavigationPath(path, "Cylinder 9ml bottles")).toBe(path);
    expect(
      new URLSearchParams(
        normalizeGraceCatalogNavigationPath(path, "9 ml bottles").split("?")[1],
      ).has("families"),
    ).toBe(false);
  });

  it("strips the real catalog thread facet (threads, not neckThreadSizes)", () => {
    const path = "/catalog?threads=13-415&search=50ml&grace=1";
    const params = new URLSearchParams(normalizeGraceCatalogNavigationPath(path).split("?")[1]);

    expect(params.has("threads")).toBe(false);
    expect(params.get("search")).toBe("50ml");
  });

  it("canonicalizes the capacity search token instead of fusing filler words", () => {
    const path = "/catalog?search=50%20ml%20bottles&grace=1";
    const params = new URLSearchParams(normalizeGraceCatalogNavigationPath(path).split("?")[1]);

    expect(params.get("search")).toBe("50ml");
  });
});
