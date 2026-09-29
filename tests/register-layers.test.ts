import { describe, expect, it } from "vitest";
import { componentLayersStatus, layersForBody, withBodyLayers, withGenericLayers } from "../convex/registerLayers";

type L = { name: string; anchorStatus: "unmeasured" | "measured" | "approved"; bodyId?: string; glass?: string };
const generic: L[] = [{ name: "cap (PSD)", anchorStatus: "approved" }];
const nine: L[] = [
    { name: "cap (Blender)", anchorStatus: "measured", bodyId: "cylinder-9ml-17-415" },
    { name: "see-through amber", anchorStatus: "measured", bodyId: "cylinder-9ml-17-415", glass: "Amber" },
];

describe("register layers: body-scoped writes", () => {
    it("a body draws its own layers, every other body the generic set", () => {
        const layers = withBodyLayers(generic, "cylinder-9ml-17-415", nine);
        expect(layersForBody(layers, "cylinder-9ml-17-415").map((l) => l.name)).toEqual(["cap (Blender)", "see-through amber"]);
        expect(layersForBody(layers, "cylinder-5ml-17-415").map((l) => l.name)).toEqual(["cap (PSD)"]);
    });

    it("a measured load for one body leaves the component-wide status on the generic set", () => {
        // review on #292: a dev run without --approve must not stop other bodies' SKUs from rendering
        expect(componentLayersStatus(withBodyLayers(generic, "cylinder-9ml-17-415", nine))).toBe("approved");
    });

    it("a component with only body layers is rated on them", () => {
        expect(componentLayersStatus(nine)).toBe("measured");
        expect(componentLayersStatus([])).toBe("unmeasured");
    });

    it("reloading a body replaces only that body's layers", () => {
        const other: L[] = [{ name: "tall cap", anchorStatus: "approved", bodyId: "cylinder-9ml-13-415" }];
        const once = withBodyLayers([...generic, ...other], "cylinder-9ml-17-415", nine);
        const again = withBodyLayers(once, "cylinder-9ml-17-415", [{ name: "cap v2", anchorStatus: "approved", bodyId: "cylinder-9ml-17-415" }]);
        expect(again.map((l) => l.name)).toEqual(["cap (PSD)", "tall cap", "cap v2"]);
    });

    it("a generic (Phase 3 / component) push keeps every body's own layers", () => {
        const layers = withBodyLayers(generic, "cylinder-9ml-17-415", nine);
        const pushed = withGenericLayers(layers, [{ name: "cap (PSD, re-cut)", anchorStatus: "approved" }]);
        expect(pushed.map((l) => l.name)).toEqual(["cap (PSD, re-cut)", "cap (Blender)", "see-through amber"]);
    });
});
