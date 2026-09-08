// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { useBuilderFamilies } from "@/components/bottle-builder/useBuilderFamilies";
function Harness() {
    const { families, status, retry } = useBuilderFamilies([{ family: "Cylinder", groups: 5 }]);
    return <><p>Selected bottle stays usable</p><select>{families.map(f => <option key={f.family}>{f.family}</option>)}</select><span>{status}</span><button onClick={retry}>Retry</button></>;
}
it("keeps the selected workspace available during discovery, failure and retry", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let resolve!: (response: unknown) => void;
    const fetcher = vi.fn(() => new Promise(r => { resolve = r; })); vi.stubGlobal("fetch", fetcher);
    const el = document.createElement("div"); const root = createRoot(el);
    try {
        await act(async () => root.render(<Harness />));
        expect(el.textContent).toContain("Selected bottle stays usable"); expect(el.textContent).toContain("loading");
        await act(async () => resolve({ ok: false }));
        expect(el.textContent).toContain("error"); expect(el.querySelector("option")?.textContent).toBe("Cylinder");
        await act(async () => el.querySelector("button")!.click());
        await act(async () => resolve({ ok: true, json: async () => ({ families: [{ family: "Circle", groups: 4 }, { family: "Cylinder", groups: 5 }] }) }));
        expect(el.textContent).toContain("ready"); expect([...el.querySelectorAll("option")].map(o => o.textContent)).toEqual(["Circle", "Cylinder"]);
    } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});
