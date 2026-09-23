import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  validateRecovery,
  recoveryOperation,
  assertPlateUnchanged,
  assertKitUnchanged,
} from "../scripts/paperdoll/publish-native-recovery.mjs";
const row = JSON.parse(
  readFileSync(
    "docs/reviews/circle-component-recovery-2026-09-22/native-circle50/kits/manifest.json",
    "utf8",
  ),
).rows[0];
const product = { ...row.source.identity, websiteSku: row.sku };
describe("native component publication gates", () => {
  it("requires explicit insertion with absent before-images", () => {
    expect(recoveryOperation({ sku: "A", operation: "insert" }, null, null)).toBe("insert");
    expect(() => recoveryOperation({ sku: "A" }, null, null)).toThrow("must be explicit");
    expect(() => recoveryOperation({ sku: "A", operation: "insert" }, {}, null)).toThrow("absent");
    expect(() => recoveryOperation({ sku: "A", operation: "insert" }, null, {})).toThrow("absent");
    expect(() => recoveryOperation({ sku: "A", operation: "typo" }, {}, null)).toThrow("Unknown");
    expect(() => assertPlateUnchanged(null, null)).not.toThrow();
    expect(() => assertPlateUnchanged(null, { image: "later" })).toThrow();
    expect(() => assertKitUnchanged(null, null, null)).not.toThrow();
  });
  it("protects a kit changed by a concurrent release, including matching-plate changes", () => {
    const old = {
      sku: "A",
      plateSha256: "hash",
      parts: [{ slot: "body", image: { sha256: "old" } }],
    };
    const plate = { sku: "A", front: { sha256: "hash" } };
    expect(() =>
      assertKitUnchanged(old, plate, { ...old, conflicts: [] }),
    ).not.toThrow();
    expect(() =>
      assertKitUnchanged(old, plate, { ...old, parts: [], conflicts: [] }),
    ).toThrow();
    expect(() => assertKitUnchanged(null, plate, null)).not.toThrow();
    expect(() => assertKitUnchanged(null, plate, old)).toThrow();
  });
  it("accepts the exact source-backed identity and rejects a different body or material", () => {
    expect(() => validateRecovery(row, product)).not.toThrow();
    for (const delta of [
      { color: "Amber" },
      { capacityMl: 100 },
      { neckThreadSize: "13-415" },
      { websiteSku: "different" },
      { graceSku: "alias" },
    ])
      expect(() => validateRecovery(row, { ...product, ...delta })).toThrow();
  });
  it("rejects failed source gates, missing review, and duplicate physical roles", () => {
    expect(() =>
      validateRecovery(
        { ...row, gates: { ...row.gates, sourceParity: { ok: false } } },
        product,
      ),
    ).toThrow();
    expect(() =>
      validateRecovery(
        { ...row, source: { ...row.source, review: undefined } },
        product,
      ),
    ).toThrow();
    expect(() =>
      validateRecovery(
        { ...row, parts: [...row.parts, row.parts[0]] },
        product,
      ),
    ).toThrow();
  });
  it("refuses a changed or missing live plate instead of overwriting a later release", () => {
    const old = {
      sku: "A",
      front: { url: "on" },
      frontCapOff: { url: "off" },
      thumb: { url: "thumb" },
      thumbCapOff: { url: "thumb-off" },
    };
    const live = {
      image: "on",
      imageCapOff: "off",
      thumb: "thumb",
      thumbCapOff: "thumb-off",
    };
    expect(() => assertPlateUnchanged(old, live)).not.toThrow();
    expect(() =>
      assertPlateUnchanged(old, { ...live, imageCapOff: "later-off" }),
    ).toThrow();
    expect(() => assertPlateUnchanged(old, null)).toThrow();
  });
});
