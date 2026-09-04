import { describe, expect, it } from "vitest";
import {
    applicationFinderHref,
    browseContextToFilters,
    familyFinderHref,
    parseBrowseContext,
} from "@/lib/products/focused-shopping";

describe("focused shopping browse context", () => {
    it("resolves the Roll-On application route to the canonical catalog bucket", () => {
        const context = parseBrowseContext("/catalog/application/roll-on", new URLSearchParams());

        expect(context).toMatchObject({
            entryMode: "application",
            application: "rollon",
        });
        expect(browseContextToFilters(context)).toMatchObject({ applicators: ["rollon"] });
        expect(applicationFinderHref("rollon")).toBe("/catalog/application/roll-on");
    });

    it("round-trips Cylinder Roll-On refinements through canonical URL parameters", () => {
        const context = parseBrowseContext(
            "/catalog/cylinder",
            new URLSearchParams("applicators=rollon&capacities=9+ml&roller=metal"),
        );

        expect(context).toMatchObject({
            entryMode: "family",
            family: "Cylinder",
            application: "rollon",
            capacities: ["9 ml"],
            rollerMaterials: ["metal"],
        });
        expect(browseContextToFilters(context)).toMatchObject({
            families: ["Cylinder"],
            applicators: ["rollon"],
            capacities: ["9 ml"],
            rollerMaterials: ["metal"],
        });

        const href = familyFinderHref("Cylinder", context);
        const roundTripped = parseBrowseContext(
            href.split("?")[0],
            new URLSearchParams(href.split("?")[1]),
        );
        expect(roundTripped).toMatchObject({
            family: "Cylinder",
            application: "rollon",
            capacities: ["9 ml"],
            rollerMaterials: ["metal"],
        });
    });

    it("round-trips Boston Round through a dedicated family landing path", () => {
        expect(familyFinderHref("Boston Round")).toBe("/catalog/boston-round");
        const context = parseBrowseContext(
            "/catalog/boston-round",
            new URLSearchParams("applicators=dropper&capacities=30+ml"),
        );
        expect(context).toMatchObject({
            entryMode: "family",
            family: "Boston Round",
            application: "dropper",
            capacities: ["30 ml"],
        });
        expect(browseContextToFilters(context)).toMatchObject({
            families: ["Boston Round"],
            applicators: ["dropper"],
            capacities: ["30 ml"],
        });
    });

    it("rejects unknown application routes and roller materials", () => {
        const context = parseBrowseContext(
            "/catalog/application/unknown-application",
            new URLSearchParams("applicators=rollon&roller=titanium"),
        );

        expect(context.application).toBeUndefined();
        expect(context.rollerMaterials).toBeUndefined();
        expect(browseContextToFilters(context)).not.toHaveProperty("applicators");
        expect(browseContextToFilters(context)).not.toHaveProperty("rollerMaterials");
    });
});
