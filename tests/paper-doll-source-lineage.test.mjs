import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";

let validatePlateSource;
try {
    ({ validatePlateSource } = await import("../scripts/paperdoll/lib/source-lineage.mjs"));
} catch {
    // The first red test documents the API before the validator exists.
}

test("exports a plate-source lineage validator", () => {
    assert.equal(typeof validatePlateSource, "function");
});

const scratch = mkdtempSync(join(tmpdir(), "best-bottles-source-lineage-"));
const masterRoot = join(scratch, "BB-PSD-Files-Master");
mkdirSync(masterRoot);

after(() => rmSync(scratch, { recursive: true, force: true }));

function addMasterFile(relativePath) {
    const target = join(masterRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "fixture");
    return target;
}

test("accepts a numbered PSD basename that matches the row SKU inside the master", () => {
    addMasterFile("5. 13-415 Bottles/Capped/26. GBCrcl15MtlRollBlkDot.psd");

    assert.deepEqual(validatePlateSource({
        sku: "GBCrcl15MtlRollBlkDot",
        sourcePath: "5. 13-415 Bottles/Capped/26. GBCrcl15MtlRollBlkDot.psd",
    }, { masterRoot }), []);
});

test("rejects an absolute source outside the master without following it", () => {
    const outside = join(scratch, "legacy", "GBCrcl15MtlRollBlkDot.psd");
    mkdirSync(dirname(outside), { recursive: true });
    writeFileSync(outside, "legacy fixture");

    assert.deepEqual(
        validatePlateSource({ sku: "GBCrcl15MtlRollBlkDot", sourcePath: outside }, { masterRoot }).map((issue) => issue.issue),
        ["source_outside_master"],
    );
});

test("rejects a relative source that does not exist in the master", () => {
    assert.deepEqual(
        validatePlateSource({ sku: "GBCrcl15SprySlSh", sourcePath: "Circle/GBCrcl15SprySlSh.psd" }, { masterRoot }).map((issue) => issue.issue),
        ["source_missing_from_master"],
    );
});

test("rejects an uncapped PSD used as the front source", () => {
    addMasterFile("Circle/1. Circle (Uncapped) PSD/9. GBCrcl15SprySlSh.psd");

    assert.deepEqual(
        validatePlateSource({ sku: "GBCrcl15SprySlSh", sourcePath: "Circle/1. Circle (Uncapped) PSD/9. GBCrcl15SprySlSh.psd" }, { masterRoot }).map((issue) => issue.issue),
        ["front_source_uncapped"],
    );
});

test("rejects a front PSD whose basename belongs to another SKU", () => {
    addMasterFile("Cylinder/Capped/9. GBCylBlu5MtlRollGlSh.psd");

    assert.deepEqual(
        validatePlateSource({ sku: "GBCyl5MtlRollGlSh", sourcePath: "Cylinder/Capped/9. GBCylBlu5MtlRollGlSh.psd" }, { masterRoot }).map((issue) => issue.issue),
        ["front_source_sku_mismatch"],
    );
});

test("uses the capped child of a mixed capped-and-uncapped parent", () => {
    const sourcePath = "31. Capped & Uncapped/Capped/56. LBCyl100LtnCu.psd";
    addMasterFile(sourcePath);
    assert.deepEqual(validatePlateSource({ sku: "LBCyl100LtnCu", sourcePath }, { masterRoot }), []);
});

test("still rejects the uncapped child of a mixed parent and an ambiguous parent alone", () => {
    for (const dir of ["31. Capped & Uncapped/Uncapped", "31. Capped & Uncapped"]) {
        const sourcePath = `${dir}/56. LBCyl100LtnCu.psd`;
        addMasterFile(sourcePath);
        assert.deepEqual(validatePlateSource({ sku: "LBCyl100LtnCu", sourcePath }, { masterRoot }).map(x => x.issue), ["front_source_uncapped"]);
    }
});

test("rejects a symlink that escapes the master", () => {
    const outside = join(scratch, "outside.psd");
    writeFileSync(outside, "outside fixture");
    const link = join(masterRoot, "linked.psd");
    symlinkSync(outside, link);

    assert.deepEqual(
        validatePlateSource({ sku: "linked", sourcePath: "linked.psd" }, { masterRoot }).map((issue) => issue.issue),
        ["source_outside_master"],
    );
});
