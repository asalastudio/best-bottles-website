/** Replays every catalog configuration through the actual Builder framing code.
 * This checks media structure and display geometry; it does not certify physical
 * fit or replace exact legacy/PSD and visual review. No remote writes.
 * node --import tsx scripts/audit_four_family_fit.ts --input PATH --out DIRECTORY
 */
import fs from "node:fs";
import path from "node:path";
import {
  resolveBuilderConfigurations,
  groupBuilderBodies,
  previewParts,
  type CatalogRow,
  type BuilderKit,
} from "../src/lib/bottle-builder/model";
import { registerVintagePreview } from "../src/lib/bottle-builder/preview-registration";
import {
  builderPreviewLayout,
  builderBodyFrame,
} from "../src/lib/bottle-builder/preview-layout";
const arg = (key: string) => {
  const i = process.argv.indexOf(key);
  if (i < 0 || !process.argv[i + 1]) throw Error(`${key} required`);
  return process.argv[i + 1];
};
const input = JSON.parse(fs.readFileSync(arg("--input"), "utf8")) as {
  checkedAt: string;
  endpoint: string;
  families: {
    family: string;
    rows: CatalogRow[];
    kits: (BuilderKit | null)[];
  }[];
};
const out = arg("--out");
fs.mkdirSync(out, { recursive: true });
const views: {
  sku: string;
  family: string;
  bodyId: string;
  glass: string;
  stage: string;
  showCover: boolean;
  clipped: string[];
  bodyWidth: number | null;
  base: number | null;
  sidecarGap: number | null;
  sidecarBaseDelta: number | null;
}[] = [];
const records: Record<string, unknown>[] = [];
const groups: Record<string, unknown>[] = [];
for (const family of input.families) {
  const configs = resolveBuilderConfigurations(family.rows, family.kits);
  const bodies = groupBuilderBodies(configs.filter((c) => c !== null));
  const visible = new Set(
    bodies.flatMap((b) => b.configurations.map((c) => c.id)),
  );
  for (let i = 0; i < family.rows.length; i++) {
    const r = family.rows[i],
      k = family.kits[i];
    const slots = k?.parts.map((p) => p.slot) ?? [];
    const flags: string[] = [];
    if (!k) flags.push("no_published_matching_kit");
    else {
      if (k.completeness !== "full")
        flags.push("partial_kit_requires_visual_review");
      if (k.conflicts.length) flags.push("kit_alias_conflict");
      if (slots.filter((s) => s === "body").length !== 1)
        flags.push("body_role_missing_or_duplicated");
      if (new Set(slots).size !== slots.length)
        flags.push("duplicate_component_role");
      for (const p of k.parts)
        if (
          p.bounds.left < 0 ||
          p.bounds.top < 0 ||
          p.bounds.right > k.canvas.width ||
          p.bounds.bottom > k.canvas.height
        )
          flags.push(`source_canvas_overflow:${p.slot}`);
      if (/spray|pump/i.test(r.applicator ?? "") && !slots.includes("diptube"))
        flags.push("dip_tube_not_separate_review_source");
      if (/roller/i.test(r.applicator ?? "") && !slots.includes("roller"))
        flags.push("roller_not_separate_review_source");
      if (/dropper/i.test(r.applicator ?? "") && !slots.includes("pipette"))
        flags.push("pipette_not_separate_review_source");
      if (
        /spray|pump/i.test(r.applicator ?? "") &&
        !slots.some((s) => ["sprayer", "pump", "fitment"].includes(s))
      )
        flags.push("mechanism_not_separate_review_source");
    }
    records.push({
      sku: r.websiteSku,
      graceSku: r.graceSku,
      family: r.family,
      capacityMl: r.capacityMl,
      glass: r.color,
      neck: r.neckThreadSize,
      fitment: r.applicator,
      finish: r.capColor,
      builderVisible: visible.has(r.websiteSku ?? ""),
      slots,
      completeness: k?.completeness ?? null,
      flags,
      visualApproval: "pending_exact_source_and_render_review",
    });
  }
  for (const body of bodies) {
    for (const c of body.configurations) {
      const colored = body.configurations.filter((x) => x.color === c.color);
      const reference =
        colored.find(
          (x) =>
            x.fitment === "Vintage Bulb Sprayer" &&
            x.kit?.completeness === "full",
        ) ??
        colored.find(
          (x) => x.kit?.completeness === "full" && x.fitment !== "Reducer",
        ) ??
        colored.find((x) => x.kit?.completeness === "full") ??
        colored[0];
      for (const stage of ["body", "fitment", "complete"] as const)
        for (const showCover of [false, true]) {
          const layout = builderPreviewLayout(c, previewParts(c, stage), {
            stage,
            showCover,
            bodyReference: reference,
          });
          if (!layout) continue;
          const frame = builderBodyFrame(
            c,
            body.configurations,
            reference,
            layout,
          );
          const glass = layout.layers.find(
            (l) => l.part.slot === "body",
          )?.bounds;
          const cover = layout.layers.find(
            (l) => l.part.slot === "overcap",
          )?.bounds;
          const clipped = layout.layers
            .filter(
              (l) =>
                l.bounds.left < frame.x - 0.01 ||
                l.bounds.top < frame.y - 0.01 ||
                l.bounds.right > frame.x + frame.width + 0.01 ||
                l.bounds.bottom > frame.y + frame.height + 0.01,
            )
            .map((l) => l.part.slot);
          const sidecar = stage === "complete" && !showCover && glass && cover;
          // Ground is the measured glass foot, not the bottom of its shadow/halo.
          const ground =
            registerVintagePreview(c, previewParts(c, stage), reference)
              ?.groundY ??
            c.kit?.anchors.baselineY ??
            glass?.bottom;
          views.push({
            sku: c.id,
            family: c.family,
            bodyId: c.bodyId,
            glass: c.color,
            stage,
            showCover,
            clipped,
            bodyWidth: glass ? (glass.right - glass.left) / frame.width : null,
            base: glass ? (glass.bottom - frame.y) / frame.height : null,
            sidecarGap: sidecar
              ? (cover.left - glass.right) / (glass.right - glass.left)
              : null,
            sidecarBaseDelta: sidecar
              ? (cover.bottom - (ground ?? glass.bottom)) /
                (glass.right - glass.left)
              : null,
          });
        }
    }
    const all = views.filter(
      (v) => v.bodyId === body.id && v.family === family.family,
    );
    const widths = all.flatMap((v) =>
        v.bodyWidth === null ? [] : [v.bodyWidth],
      ),
      bases = all.flatMap((v) => (v.base === null ? [] : [v.base]));
    groups.push({
      family: family.family,
      bodyId: body.id,
      capacityMl: body.capacityMl,
      neck: body.neck,
      configurations: body.configurations.length,
      views: all.length,
      bodyWidthSpread: widths.length
        ? Math.max(...widths) - Math.min(...widths)
        : null,
      baseSpread: bases.length ? Math.max(...bases) - Math.min(...bases) : null,
      clippedViews: all.filter((v) => v.clipped.length).length,
      sidecarOverlapViews: all.filter(
        (v) => v.sidecarGap !== null && v.sidecarGap < 0,
      ).length,
      sidecarGroundReviewSkus: [
        ...new Set(
          all
            .filter(
              (v) =>
                v.sidecarBaseDelta !== null &&
                Math.abs(v.sidecarBaseDelta) > 0.015,
            )
            .map((v) => v.sku),
        ),
      ],
    });
  }
}
const summary = input.families.map((f) => {
  const r = records.filter((r) => r.family === f.family);
  const v = views.filter((v) => v.family === f.family);
  return {
    family: f.family,
    catalogRows: r.length,
    builderVisible: r.filter((r) => r.builderVisible).length,
    rowsWithMediaFlags: r.filter((r) => (r.flags as string[]).length).length,
    renderedStates: v.length,
    clippedStates: v.filter((v) => v.clipped.length).length,
  };
});
const report = {
  checkedAt: new Date().toISOString(),
  sourceSnapshotAt: input.checkedAt,
  endpoint: input.endpoint,
  scope:
    "All current catalog rows in the four requested families; separate source census and visual clearance required.",
  summary,
  groups,
  records,
  views,
};
fs.writeFileSync(
  path.join(out, "fit-audit.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const csv = (v: unknown) =>
  `"${String(Array.isArray(v) ? v.join(" | ") : (v ?? "")).replaceAll('"', '""')}"`;
const columns = [
  "sku",
  "graceSku",
  "family",
  "capacityMl",
  "glass",
  "neck",
  "fitment",
  "finish",
  "builderVisible",
  "completeness",
  "slots",
  "flags",
  "visualApproval",
];
fs.writeFileSync(
  path.join(out, "component-fit-ledger.csv"),
  [
    columns.join(","),
    ...records.map((r) => columns.map((k) => csv(r[k])).join(",")),
  ].join("\n") + "\n",
);
console.log(
  JSON.stringify(
    {
      summary,
      bodyGroups: groups.length,
      groupsNeedingFrameReview: groups.filter(
        (g) =>
          (g.bodyWidthSpread as number) > 0.005 ||
          (g.baseSpread as number) > 0.005 ||
          g.clippedViews ||
          g.sidecarOverlapViews ||
          (g.sidecarGroundReviewSkus as string[]).length,
      ),
    },
    null,
    2,
  ),
);
