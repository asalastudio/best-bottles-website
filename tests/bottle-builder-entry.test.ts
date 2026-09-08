import { describe, it, expect, vi } from "vitest";
import { loadBuilderEntry } from "@/lib/bottle-builder/entry";
import type { BuilderBody } from "@/lib/bottle-builder/model";
const body = { id: "body" } as BuilderBody;
describe("builder entry loading", () => {
    it("opens the requested family without waiting for every other family's kits", async () => {
        const family = vi.fn(async () => [body]);
        const families = vi.fn(() => new Promise<never>(() => {}));
        expect(await loadBuilderEntry("Circle", { family, families })).toEqual({ openFamily: "Circle", bodies: [body], families: [{ family: "Circle", groups: 1 }] });
        expect(families).not.toHaveBeenCalled();
    });
    it("preserves default entry and falls back for an unavailable deep-linked family", async () => {
        const family = vi.fn(async (name: string) => name === "Cylinder" ? [body] : []);
        const families = vi.fn(async () => [{ family: "Cylinder", groups: 1 }]);
        expect((await loadBuilderEntry(undefined, { family, families })).openFamily).toBe("Cylinder");
        expect((await loadBuilderEntry("Unavailable", { family, families })).openFamily).toBe("Cylinder");
    });
    it("uses another eligible family if the default is unavailable and handles an empty catalog", async () => {
        const family = vi.fn(async (name: string) => name === "Circle" ? [body] : []);
        expect((await loadBuilderEntry(undefined, { family, families: async () => [{ family: "Circle", groups: 1 }] })).openFamily).toBe("Circle");
        expect((await loadBuilderEntry(undefined, { family: async () => [], families: async () => [] })).bodies).toEqual([]);
    });
    it("does not turn backend errors into empty or partially compatible choices", async () => {
        await expect(loadBuilderEntry("Circle", { family: async () => { throw Error("offline"); }, families: async () => [] })).rejects.toThrow("offline");
    });
});
