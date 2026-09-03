import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";

const EXPECTED_MASTER = "/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master";
const scratch = mkdtempSync(join(tmpdir(), "best-bottles-master-policy-"));

after(() => rmSync(scratch, { recursive: true, force: true }));

test("configures the paper-doll pipeline with the PSD master as its only library", () => {
    const sources = JSON.parse(readFileSync("data/paper-doll/sources.json", "utf8"));

    assert.deepEqual(Object.keys(sources.libraries), ["master"]);
    assert.equal(sources.libraries.master.root, EXPECTED_MASTER);
    assert.equal(sources.libraries.master.role, "master");
});

test("inventory refuses a non-master library selector before walking any files", () => {
    const result = spawnSync("python3", [
        "scripts/paperdoll/inventory.py",
        "--library",
        "not-master",
        "--no-hash",
        "--limit",
        "1",
        "--out",
        scratch,
    ], { encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /only permitted library is master/i);
});

test("renderer can isolate an audited SKU before validating other family sources", () => {
    const source = readFileSync("scripts/paperdoll/build_plates.py", "utf8");
    const skuFilter = 'if args.sku and rec["websiteSku"] not in args.sku:';

    assert.match(source, /add_argument\("--sku", action="append"/);
    assert.ok(source.indexOf(skuFilter) >= 0);
    assert.ok(source.indexOf(skuFilter) < source.indexOf('entry = selection["stems"][rec["stemKey"]]'));
});

test("dedupe prefers the organized canonical component folder over an older nested duplicate", () => {
    const result = spawnSync("python3", ["-c", String.raw`
import sys
sys.path.insert(0, "scripts/paperdoll")
import dedupe

canonical = {
    "library": "master",
    "role": "component",
    "dirKey": "20. Caps/8. 18-415 Lotion",
    "relPath": "20. Caps/8. 18-415 Lotion/16. Ltn18-415MtGl.psd",
}
nested = {
    "library": "master",
    "role": "component",
    "dirKey": "2.  18-415 Bottles/32. 18415 Caps/18415 Caps",
    "relPath": "2.  18-415 Bottles/32. 18415 Caps/18415 Caps/16. CP18-415LtnMtGl.psd",
}

assert dedupe.precedence(canonical) < dedupe.precedence(nested), (
    dedupe.precedence(canonical), dedupe.precedence(nested)
)
`], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
});
