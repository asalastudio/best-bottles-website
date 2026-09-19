// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { useBuilderKits } from "@/components/bottle-builder/useBuilderKits";
import type { BuilderConfiguration, BuilderKit } from "@/lib/bottle-builder/model";
import { slimBuilderBodies } from "@/lib/bottle-builder/payload";

const kit = {
    sku: "Cylinder9MetalBlack", websiteSku: "Cylinder9MetalBlack", graceSku: null, familyId: "cylinder-9ml-clear-17-415", completeness: "full", conflicts: [],
    canvas: { width: 10, height: 10 }, anchors: { axisX: 5, neckAxisX: 5, seatY: 1, baselineY: 9, pxPerMm: null },
    plateSha256: "p", three: null, parts: [],
} as BuilderKit;
const bodies = slimBuilderBodies([{
    id: "cylinder-9ml|17-415|Glass Bottle", profileLabel: "Cylinder", family: "Cylinder", capacityMl: 9, neck: "17-415",
    configurations: [{
        id: "Cylinder9MetalBlack", bodyId: "cylinder-9ml|17-415|Glass Bottle", family: "Cylinder", capacityMl: 9, neck: "17-415",
        color: "Clear", fitment: "Metal Roller", closure: "Black", kit, photoUrl: null, bodyImage: null,
        finishComponent: { websiteSku: "x", imageUrl: null, name: "Black" }, profileLabel: "Cylinder", caseQuantity: 24,
        product: { graceSku: "GB", websiteSku: "Cylinder9MetalBlack", itemName: "Bottle", shopifyVariantId: "1", shopifySellable: true, quantity: 1, unitPrice: 1, webPrice1pc: 1 },
    } as BuilderConfiguration],
}]);

function Harness({ bodyId }: { bodyId: string | null }) {
    const hydrated = useBuilderKits("Cylinder", bodies, bodyId);
    return <span>{hydrated[0]?.configurations[0]?.kit ? "layered" : "chooser"}</span>;
}

it("loads kit layers only after a bottle is selected", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fetcher = vi.fn(async (_url: RequestInfo | URL) => ({ ok: true, json: async () => ({ kits: { Cylinder9MetalBlack: kit } }) }));
    vi.stubGlobal("fetch", fetcher);
    const el = document.createElement("div");
    const root = createRoot(el);
    try {
        await act(async () => root.render(<Harness bodyId={null} />));
        expect(el.textContent).toBe("chooser");
        expect(fetcher).not.toHaveBeenCalled();
        await act(async () => root.render(<Harness bodyId={bodies[0]!.id} />));
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("family=Cylinder"), expect.anything());
        expect(el.textContent).toBe("layered");
    } finally {
        act(() => root.unmount());
        vi.unstubAllGlobals();
    }
});
