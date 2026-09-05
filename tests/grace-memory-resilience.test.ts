// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGraceMemory } from "../src/lib/grace/useGraceMemory";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

it("keeps the purchase surface mounted when memory fails and recovers when memory returns", async () => {
    const client = new ConvexReactClient("https://example.convex.cloud", { unsavedChangesWarning: false });
    let result: unknown = new Error("Could not find public function for 'graceMemory:getByOwner'.");
    const listeners = new Set<() => void>();
    // Replace only the backend watch; the real Convex hooks handle the error.
    vi.spyOn(client, "watchQuery").mockImplementation(() => ({
        localQueryResult: () => {
            if (result instanceof Error) throw result;
            return result;
        },
        onUpdate: (listener: () => void) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        journal: () => undefined,
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    function PurchaseSurface() {
        const note = useGraceMemory("preview-test-owner");
        return createElement("main", null,
            createElement("button", null, "Add to Cart"),
            createElement("span", null, note?.profile ?? "No saved preferences"),
        );
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
        await act(async () => root.render(createElement(ConvexProvider, { client }, createElement(PurchaseSurface))));
        expect(container.querySelector("button")?.textContent).toBe("Add to Cart");
        expect(container.textContent).toContain("No saved preferences");
        result = { ownerKey: "preview-test-owner", profile: "Gold caps", updatedAt: 1 };
        await act(async () => { for (const notify of listeners) notify(); });
        expect(container.textContent).toContain("Gold caps");
        result = new Error("Memory service unavailable");
        await act(async () => { for (const notify of listeners) notify(); });
        expect(container.querySelector("button")?.textContent).toBe("Add to Cart");
        expect(container.textContent).not.toContain("Gold caps");
    } finally {
        await act(async () => root.unmount());
        await client.close();
    }
});
