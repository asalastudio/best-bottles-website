import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rebuild = () => readFileSync("convex/productGroupsRebuild.ts", "utf8");
const runner = () => readFileSync("scripts/rebuild_product_groups.mjs", "utf8");

describe("productGroups rebuild --apply interlock", () => {
  it("keeps dry-run the default so a bare run never writes", () => {
    expect(rebuild()).toContain("const dryRun = args.dryRun ?? true");
  });

  it("refuses to apply a run that would create more groups than the limit unless forced", () => {
    const source = rebuild();
    expect(source).toContain("const APPLY_CREATE_LIMIT = 20");
    // The create count is computed before any write happens.
    expect(source).toContain("const plannedCreates = canonical.filter((g) => !existingBySlug.has(g.slug)).length");
    expect(source).toContain("plannedCreates > APPLY_CREATE_LIMIT && !force");
    expect(source).toContain("throw new Error(");
    // The guard sits inside the write path, ahead of the insert loop.
    const guardIdx = source.indexOf("Refusing to apply");
    const insertIdx = source.indexOf("insertGroup", guardIdx);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(guardIdx);
  });

  it("never auto-deletes: deletion stays in a separate explicit mutation", () => {
    const source = rebuild();
    expect(source).toContain("export const deleteOrphanedGroups");
    // The rebuild action itself performs no deletes.
    const actionStart = source.indexOf("export const rebuildFromCsv");
    const actionEnd = source.indexOf("export const listAllGroups");
    expect(source.slice(actionStart, actionEnd)).not.toContain("ctx.db.delete");
  });

  it("threads --force from the runner and fails loudly when the interlock throws", () => {
    const source = runner();
    expect(source).toContain('const force = argv.includes("--force")');
    expect(source).toContain("force,");
    expect(source).toContain("Rebuild refused");
    expect(source).toContain("process.exit(1)");
  });
});
