// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import type { BuilderConfiguration } from "@/lib/bottle-builder/model";

const config = {
    id: "thumb", bodyId: "a", color: "Clear", fitment: "Metal Roller", closure: "Gold", family: "Cylinder",
    capacityMl: 9, neck: "13-415", profileLabel: "Cylinder", kit: null, bodyImage: { url: "/body.webp", width: 400, height: 520 },
    photoUrl: null, finishComponent: { websiteSku: "x", imageUrl: null, name: "Gold" }, caseQuantity: 24,
    product: { graceSku: "thumb", webPrice1pc: 1, shopifyVariantId: "1", shopifySellable: true },
} as BuilderConfiguration;

let root: ReturnType<typeof createRoot>;
let el: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
});
afterEach(() => { act(() => root.unmount()); el.remove(); vi.unstubAllGlobals(); });

it("shows a slate placeholder until the chooser image loads, then reveals the bottle", async () => {
    await act(async () => root.render(<BuilderImage config={config} parts={[]} label="9 ml Cylinder" placeholder priority />));
    const thumb = el.querySelector("[data-builder-thumb]")!;
    expect(thumb.getAttribute("data-loaded")).toBe("false");
    expect(thumb.querySelector("[data-slate]")).toBeTruthy();
    expect(el.querySelector("img")?.getAttribute("fetchpriority") ?? el.querySelector("img")?.getAttribute("fetchPriority")).toBe("high");
    await act(async () => { el.querySelector("img")!.dispatchEvent(new Event("load")); });
    expect(el.querySelector("[data-builder-thumb]")?.getAttribute("data-loaded")).toBe("true");
    expect(el.querySelector("[data-slate]")).toBeNull();
});
