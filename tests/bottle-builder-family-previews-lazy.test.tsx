// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFamilyPreviews, type FamilyPreviewPayload } from "@/components/bottle-builder/FamilyChooser";

const payload = { families: [{ family: "Cylinder", groups: 3, sizes: [9, 50, 100], options: 3 }] } satisfies NonNullable<FamilyPreviewPayload>;
function Probe({ streamed, shown }: { streamed?: Promise<FamilyPreviewPayload>; shown: boolean }) {
    return <output>{Object.keys(useFamilyPreviews(streamed, shown)).join(",")}</output>;
}

describe("family screen previews load only when the screen is shown", () => {
    let root: Root; let host: HTMLDivElement;
    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        host = document.createElement("div"); root = createRoot(host);
    });
    afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals(); });

    it("asks for nothing while a bottle link's family screen stays closed, then asks once", async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => payload }));
        vi.stubGlobal("fetch", fetchMock);
        await act(async () => root.render(<Probe shown={false} />));
        expect(fetchMock).not.toHaveBeenCalled();
        await act(async () => root.render(<Probe shown />));
        expect(host.textContent).toBe("Cylinder");
        await act(async () => root.render(<Probe shown={false} />));
        await act(async () => root.render(<Probe shown />));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("/api/bottle-builder/family-previews");
    });

    it("uses the streamed groups without a request when the page opened on the family screen", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const streamed = Promise.resolve(payload);
        await act(async () => root.render(<Probe streamed={streamed} shown />));
        expect(host.textContent).toBe("Cylinder");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("the page builds the groups only for a bare /matrix", () => {
        expect(readFileSync("src/app/matrix/page.tsx", "utf8")).toMatch(/const familyPreviews = chooseFamilyFirst \? familyList/);
    });
});
