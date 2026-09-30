import { describe, expect, it, vi } from "vitest";
import type { ConvexHttpClient } from "convex/browser";
import { loadRegisterKits } from "@/lib/register/load";

const EMPTY = { plates: {}, components: {}, bodies: {}, assemblies: {} };
// Two lookups of 50: the first answers, the second fails.
const SKUS = Array.from({ length: 60 }, (_, index) => `GB-SKU-${index}`);

function convex(...answers: unknown[]) {
    const query = vi.fn(async () => {
        const next = answers.shift();
        if (next instanceof Error) throw next;
        return next;
    });
    return { client: { query } as unknown as ConvexHttpClient, query };
}

describe("register lookup failures", () => {
    it("the product page keeps what it drew, draws the rest from the legacy kits, and logs the failure", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { client, query } = convex(EMPTY, new Error("register down"));
        await expect(loadRegisterKits(client, SKUS)).resolves.toEqual({});
        expect(query).toHaveBeenCalledTimes(2);
        expect(error).toHaveBeenCalledWith("[register] stage lookup failed; drawing legacy kits", "register down");
        error.mockRestore();
    });

    it("a strict caller gets the error, so what it caches is never a half-drawn bottle", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const down = new Error("register down");
        const { client } = convex(EMPTY, down);
        await expect(loadRegisterKits(client, SKUS, { strict: true })).rejects.toBe(down);
        expect(error).toHaveBeenCalledWith("[register] stage lookup failed", "register down");
        error.mockRestore();
    });
});
