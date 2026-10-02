# Sunburst 2.5 hero review lane (2026-09-09 → 10)

Every catalogue hero re-rendered once through GPT-Image-2.5 Sunburst as an **enhancement of the
existing image**: same source, same silhouette, same parts, same material, only the glass, metal
and shadow rendered at higher fidelity on the bone background. Nothing here is published. Visual
approval, technical clearance and publication are three separate states, and only the first one
happens in this lane.

## Where things are

| what | where |
|---|---|
| review library (local) | `~/.codex/visualizations/2026/09/09/…/plates-kits-heroes-handoff/tools/hero-review`, `node server.cjs --port 3028` |
| the card to review | `sunburst-all-heroes-latest-2026-09-09-r5` — 420 rows = 391 registry heroes + 29 new heroes for groups that had none; one page per family in [`family-links.md`](./family-links.md) |
| re-look card | `sunburst-relook-2026-09-10` — only rows approved on an earlier image that has since changed |
| raw renders, sidecars, built bases, locked images, r5 card files | handoff `sunburst-preserve-2026-09-10/` |
| scripts | [`scripts/sunburst-heroes/`](../../../scripts/sunburst-heroes/) |

## States

- **Approved (visual)** — Jordan's click in the library, keyed to the exact image hash.
- **Locked** — an approval frozen in [`approved-lock.json`](./approved-lock.json) (33 as of r5). The
  sizing step copies locked files through byte-for-byte and the card shows them as
  "Approved · sizing locked". Re-issues cannot move them.
- **Technical clearance** — not done for anything. Geometry gate, sizing, shadow audit and
  canvas margins are pre-checked and written into each row's notes, but clearance is a separate
  human step.
- **Published** — nothing. The registry (`public/images/catalog/bone-review`) and the release
  manifest have not been touched.

## The standards a row is judged by

1. Product truth: only the parts Convex lists, in the source's material and colour. An invented
   bottle under a lone cap, a frosted jar turned clear, an aluminum atomizer turned glass — Reject.
2. Locked geometry: the source silhouette. Gate = top and left anchors within 8 px plus mid-body
   width (the left anchor reads the shadow feather on shadowless bases; the notes say so).
3. Sizing: one target height per physical body (family × capacity × neck, tall bodies separate),
   set on any one SKU where the **glass top** should sit, propagated to every SKU of that body.
   Jordan's numbers are the anchors; siblings use their own width ratio unless the ruler is blind
   (frosted, tassel), then the siblings' median. A hard cap keeps every scale inside the canvas.
4. Glass and material: premium refraction, no white patches, no streaks on coloured glass
   (colour references in `heroes/ref-cobalt.png` / `ref-amber.png`), plastic reads as plastic.
5. Shadow: the locked contact-plus-2-o'clock cast (see the shadow memory); audited per row.
6. Framing: whole product group centred at x = 780, base on the 91 % baseline (y = 1562), nothing
   clipped, bone `#F5F3EF`.

## What the manifests hold

- `approved-lock.json` — sku → sha256, locked file, card, timestamp.
- `targets.json` / `targets-report.json` — per-body targets (width px, anchor scale, anchor SKUs,
  Jordan's %); `targets-chat.json` — numbers given in conversation (newest of all).
- `sizing-r5.json` — the r5 sizing result per SKU (group, scale, baseline, flags).
- `new-hero-bases.json` — the 29 PSD-built bases (source PSD, layers or flatten-matte, sibling,
  scale).
- `nonbottle-shape-audit.json` — aspect check output ÷ original for the 121 non-bottle rows.

## Next

1. Jordan reviews family by family (links above), Boston Round onward; re-look card for the 46.
2. Each pass: `apply_targets.py` (cards + chat) → `size_group.py … targets.json` → audit →
   `master_collection.py` → `relook_card.py`; lock new approvals into `approved-lock.json`.
3. Still open: Sleek 5/8 and Rectangle 10 sizes (marked "too small", no number), the lavender
   antique bulb sprayer ("deformed") and the pink 18-415 atomizer ("dip tube too low") not yet
   re-rendered, 5 product groups with no PSD or no sized sibling, two 100 ml cylinder sprayers
   that touch the canvas top at the locked baseline.
4. After visual sign-off: technical clearance, then the registry + release manifest move together.
