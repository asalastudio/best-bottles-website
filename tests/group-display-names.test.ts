// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Product-group display names must be unique enough to choose from.
 *
 * The group key separates on neck finish but the name never mentioned one, so
 * the catalogue listed two "9 ml Clear Cylinder Roll-On Bottle" rows that were
 * actually 17-415 and 13-415. A customer had no way to pick correctly.
 */

import { convexTest } from "convex-test";
import { describe, expect, it, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
const WRITE_TOKEN = "test-write-token";

beforeEach(() => {
    process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = WRITE_TOKEN;
});

type GroupFixture = { slug: string; displayName: string; neck: string | null };

async function seed(t: ReturnType<typeof convexTest>, rows: GroupFixture[]) {
    await t.run(async (ctx) => {
        for (const row of rows) {
            await ctx.db.insert("productGroups", {
                slug: row.slug,
                displayName: row.displayName,
                family: "Cylinder",
                category: "Glass Bottle",
                color: "Clear",
                capacity: "9 ml (0.3 oz)",
                capacityMl: 9,
                neckThreadSize: row.neck,
                bottleCollection: null,
                variantCount: 20,
                priceRangeMin: 1,
                priceRangeMax: 2,
            } as never);
        }
    });
}

const run = (t: ReturnType<typeof convexTest>, dryRun = false) =>
    t.mutation(api.productGroupNames.disambiguateDisplayNames, { writeToken: WRITE_TOKEN, dryRun });

const names = (t: ReturnType<typeof convexTest>) =>
    t.run(async (ctx) => (await ctx.db.query("productGroups").collect()).map((g) => g.displayName).sort());

const COLLIDING: GroupFixture[] = [
    { slug: "cylinder-9ml-clear-17-415-rollon", displayName: "9 ml Clear Cylinder Roll-On Bottle", neck: "17-415" },
    { slug: "cylinder-9ml-clear-13-415-rollon", displayName: "9 ml Clear Cylinder Roll-On Bottle", neck: "13-415" },
];

describe("disambiguateDisplayNames", () => {
    it("refuses a mutation without the shared token", async () => {
        const t = convexTest(schema, modules);
        await seed(t, COLLIDING);
        await expect(
            t.mutation(api.productGroupNames.disambiguateDisplayNames, { writeToken: "wrong" }),
        ).rejects.toThrow(/unauthorized_convex_write/);
    });

    it("separates two groups that differ only by neck finish", async () => {
        const t = convexTest(schema, modules);
        await seed(t, COLLIDING);
        expect(await run(t)).toMatchObject({ collisions: 1, renamed: 2 });
        expect(await names(t)).toEqual([
            "9 ml Clear Cylinder Roll-On Bottle — 13-415 neck",
            "9 ml Clear Cylinder Roll-On Bottle — 17-415 neck",
        ]);
    });

    it("leaves a name that was never ambiguous alone", async () => {
        const t = convexTest(schema, modules);
        await seed(t, [
            { slug: "cylinder-9ml-amber-17-415-rollon", displayName: "9 ml Amber Cylinder Roll-On Bottle", neck: "17-415" },
            ...COLLIDING,
        ]);
        await run(t);
        expect(await names(t)).toContain("9 ml Amber Cylinder Roll-On Bottle");
    });

    it("is idempotent", async () => {
        const t = convexTest(schema, modules);
        await seed(t, COLLIDING);
        await run(t);
        expect(await run(t)).toMatchObject({ collisions: 0, renamed: 0 });
    });

    it("changes nothing on a dry run", async () => {
        const t = convexTest(schema, modules);
        await seed(t, COLLIDING);
        expect(await run(t, true)).toMatchObject({ renamed: 2 });
        expect(new Set(await names(t)).size).toBe(1);
    });

    it("reports a group it cannot disambiguate instead of guessing", async () => {
        const t = convexTest(schema, modules);
        await seed(t, [
            { slug: "lotion-bottle-30ml-clear", displayName: "30 ml Clear Lotion Bottle", neck: null },
            { slug: "lotion-bottle-30ml-clear-18-415", displayName: "30 ml Clear Lotion Bottle", neck: "18-415" },
        ]);
        const result = await run(t);
        expect(result.unresolved).toEqual(["lotion-bottle-30ml-clear"]);
        expect(result.renamed).toBe(1);
    });
});
