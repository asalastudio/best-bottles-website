# Best Bottles — Product Copy Generation
## IDE Handoff Brief (paste into Cursor / Claude Code / Codex)

**Audit lead:** Asala Studio · Jordan Richter (jordan@asala.ai)
**Created:** 2026-05-23
**Target launch:** 2026-06-15 (23 days)
**Scope:** Generate all PDP copy for the new Best Bottles website — 225 product groups + 2,354 SKU variants — sourced strictly from the Convex master data, written in the established brand voice, with zero fabricated attributes.

---

## Mission

Produce the entire product-page copy library for the new Best Bottles site on bestbottles.com (replacing legacy PHP, launching 2026-06-15). Every word must be grounded in a verifiable source. Every product description must comply with the brand voice guardrails (especially: no references to alcohol, whisky, beer, wine, or spirits — Best Bottles / Nemat International is a Muslim-owned brand).

---

## Source-of-truth files (read these first, in this order)

1. **Brand voice guardrails (NON-NEGOTIABLE):** `seo-audit-2026-05-23/BRAND-VOICE-GUARDRAILS.md`
2. **Brand brain (voice, mission, positioning):** `data/grace-training/01-brand-knowledge/brand-brain-v2.md`
3. **Brand brain v2 (alternate):** `data/grace-training/01-brand-knowledge/best-bottles-brand-book.md`
4. **SEO content calendar (Halbert/Ogilvy/Schwartz copy frameworks):** `docs/SEO_CONTENT_CALENDAR.md`
5. **Convex master product data (PRIMARY SOURCE):** `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv` (25 MB, 2,354 SKUs)
6. **Convex product groups (PARENT GROUPING):** `data/audits/2026-05-20-image-audit/convex_product_groups_current_2026-05-20.csv` (225 groups)
7. **Convex JSON snapshot (for programmatic access):** `data/audits/2026-05-20-image-audit/convex_snapshot.json` (34 MB)
8. **Master spec workbook (canonical product spec):** `docs/BestBottles_MasterSheet_v1.4_MASTER.xlsx`
9. **Shape/dimension reference:** `docs/SHAPE_AUDIT.md`
10. **Fitment compatibility:** `docs/all-fitment-matrices.md` and `docs/bottles-and-fitment-options.md`
11. **Content style handbook:** `docs/CONTENT_HANDBOOK.md`
12. **Legacy site copy (TONE REFERENCE ONLY — do not copy verbatim):** Fetch `https://www.bestbottles.com/` and category pages for voice continuity
13. **Sanity schema for PDP fields:** `schemaTypes/` and `sanity.config.ts`
14. **Convex schema:** `convex/schema.ts`

---

## Convex CSV column reference (every column the copy generator can use)

```
_creationTime, _id, applicator, assemblyType, ballMaterial, bottleCollection,
bottleWeightG, capColor, capHeight, capStyle, capacity, capacityMl, capacityOz,
caseQuantity, caseWeightG, category, color, componentGroup, components,
dataGrade, depthMm, diameter, family, fitmentStatus, graceDescription,
graceSku, heightWithCap, heightWithoutCap, imageUrl, imageUrlCapOff,
importSource, itemDescription, itemName, neckThreadSize, productGroupId,
productId, productUrl, qbPrice, shape, stockStatus, trimColor,
useCaseDescription, verified, webPrice10pc, webPrice12pc, webPrice1pc,
websiteSku, widthMm
```

**Critical fields for copy:**
- `family` — Cylinder, Empire, Diva, Boston Round, Sleek, Flair, Royal, Grace, Elegant, Circle, Square, Rectangle, Round, Apothecary, Slim, Tulip, Diamond, etc.
- `color` — Clear, Frosted, Cobalt Blue, Amber, Swirl
- `capacityMl` + `capacityOz` — for size-of-product copy
- `applicator` — roller, fine mist sprayer, lotion pump, treatment pump, dropper, glass stopper, atomizer
- `capColor` — copper, silver, gold, matte silver (MSLV), matte gold (MGLD), black, black leather, etc.
- `neckThreadSize` — 8-425, 13-415, 15-415, 17-415, 18-400, 18-415, 20-400
- `heightWithCap`, `diameter`, `widthMm`, `depthMm`, `bottleWeightG` — physical specs (always cite with ±tolerance when available)
- `caseQuantity` — for MOQ copy
- `webPrice1pc`, `webPrice10pc`, `webPrice12pc` — tiered pricing
- `useCaseDescription` — existing seed for use-case copy
- `itemDescription`, `graceDescription` — existing seed copy (REWRITE, don't reuse verbatim — many have grammar issues per Stage 0 discovery)

**Known size constraints (per Best Bottles team confirmation 2026-05-23):**
- **Empire family: only 50ml and 100ml.** Do NOT generate Empire 15ml or 30ml copy. If Convex has phantom Empire SKUs at other sizes, flag them in an exceptions report.
- **Diva family: 30ml, 46ml, 100ml.** Verify against Convex before copy generation.
- **Cylinder family: 5ml through 454ml.** Multiple sizes available.

---

## Output format (default — Sanity import JSON)

```json
{
  "productGroups": [
    {
      "_type": "productGroup",
      "slug": "cylinder-9ml-amber",
      "familyName": "Cylinder",
      "displayName": "Cylinder 9ml Amber",
      "heroDescription": "60-100 word hook (Halbert direct-response or Ogilvy authority register)",
      "body": [
        { "_type": "block", "_key": "intro", "style": "normal", "children": [{"text": "..."}] },
        { "_type": "block", "_key": "use-cases", "style": "h3", "children": [{"text": "What it's for"}] },
        { "_type": "block", "_key": "use-cases-list", "style": "normal", "children": [{"text": "..."}] },
        { "_type": "block", "_key": "compatibility", "style": "h3", "children": [{"text": "What pairs with it"}] },
        { "_type": "block", "_key": "fitment", "style": "normal", "children": [{"text": "..."}] }
      ],
      "faq": [
        { "_type": "object", "_key": "q1", "question": "...", "answer": "..." },
        { "_type": "object", "_key": "q2", "question": "...", "answer": "..." }
      ],
      "specHighlights": {
        "neckFinish": "17-415",
        "capacity": "9 ml · 0.30 oz",
        "diameter": "17 mm",
        "heightWithCap": "60 mm ±0.5",
        "material": "Glass",
        "compatibleAccessories": "Roll-on plug, Cap, Fine mist sprayer, Lotion pump"
      },
      "seo": {
        "metaTitle": "55-60 char title with keyword + brand",
        "metaDescription": "150-155 char value-prop with CTA hint",
        "h1": "Same or refined version of displayName",
        "productSchemaDescription": "120-180 char clean factual description for JSON-LD Product schema"
      }
    }
  ],
  "products": [
    {
      "_type": "product",
      "slug": "cyl-9ml-amber-roller-copper",
      "parentGroupSlug": "cylinder-9ml-amber",
      "variantName": "Cylinder 9ml Amber Roller — Copper Cap",
      "variantDescription": "50-80 words. Describes only what this variant differs from parent on: color + applicator + cap color + price + MOQ. No restating of parent attributes.",
      "spec": {
        "websiteSku": "GBCyl9AmbRollCpr",
        "graceSku": "GB-CYL-AMB-9ML-RLR-CPR",
        "color": "Amber",
        "applicator": "Roller",
        "capColor": "Copper",
        "capacityMl": 9,
        "neckThreadSize": "17-415"
      },
      "pricing": {
        "qty1": 2.14,
        "qty10": 1.95,
        "qty12": 1.85,
        "moq": 1,
        "caseQuantity": 144
      },
      "stockStatus": "In Stock"
    }
  ]
}
```

**Alternative output formats (if user prefers):**
- Markdown files: one per product group in `/copy/products/{family}/{slug}.md`
- TypeScript Convex mutations: ready-to-run `npx convex run` files
- CSV/Excel for client review before import

---

## Three-tier copy production system

### Tier A — Hero PDPs (top 50 product groups)
**Length:** 300-500 words
**Method:** Fully custom — written deliberately
**Voice:** Rotate Halbert direct-response / Ogilvy authority / Schwartz desire amplification per the SEO calendar tradition
**Structure per page:**
1. **Hook headline** (italic serif rendering on site — write as plain text)
2. **Opening paragraph** (3-5 sentences, problem-or-promise framing)
3. **Authority block** (specific verifiable facts — neck thread, dimensions, material, fitment system)
4. **Use cases** (3-5 specific buyer scenarios, named when possible)
5. **What pairs with it** (compatibility narrative — link to applicator/closure SKUs from fitment matrix)
6. **FAQ block** (3-5 Q+A pairs — AEO-optimized per Stage 2 audit recommendation)
7. **CTA line** (Request a sample / Get a quote / Contact)

**Hero PDP selection criteria:**
- Top 10 by legacy site SEO performance (cite when known)
- All Cylinder 9ml × 5 colors = 5 hero PDPs (highest-photographed family)
- All Empire 50ml + 100ml × 5 colors = 10 hero PDPs (signature family)
- All Diva 30ml + 46ml + 100ml × 5 colors = 15 hero PDPs (decorative star family)
- All Boston Round 15/30/60ml × 5 colors = 15 hero PDPs (highest-search family per Stage 3 baseline)
- All Sleek 50ml × 5 colors = 5 hero PDPs (dramatic silhouette)
- Total: ~50 hero PDPs

### Tier B — Standard PDPs (remaining 175 product groups)
**Length:** 150-250 words
**Method:** Template-driven + brand-voice polish
**Voice:** Consistent Ogilvy authority register
**Structure per page:**
1. **Headline** (display name + key spec)
2. **Two-paragraph product overview** (what it is, what it's for)
3. **Spec block** (auto-filled from Convex)
4. **Fitment note** (auto-filled from fitment matrix)
5. **Single FAQ** (most common question per family)

### Tier C — Variant copy (all 2,354 SKUs)
**Length:** 50-80 words
**Method:** Pure template — auto-generated from Convex fields
**Voice:** Plain factual, brand-aligned, no hype
**Template:**
```
{{family}} {{capacity}} {{color}} {{applicator}} — {{capColor}} cap.
{{useCaseShort}}. Neck finish: {{neckThreadSize}}. Diameter: {{diameter}}.
{{webPrice1pc ? `From $${webPrice1pc}/unit.` : ''}}
{{caseQuantity ? `Case quantity: ${caseQuantity}.` : ''}}
{{stockStatus === 'In Stock' ? 'Ships same day from Union City.' : 'Available on backorder.'}}
```

Variant copy lives below the parent group's main description on the same PDP — not separate pages.

---

## Brand voice rules (NON-NEGOTIABLE — pull from BRAND-VOICE-GUARDRAILS.md)

### 🚫 NEVER reference
- Alcohol, spirits, whisky, whiskey, bourbon, beer, wine, champagne, vodka, gin, rum, tequila, liquor, cocktails, breweries, distilleries
- Pork, lard, gelatin (verify no pork-derived components before mentioning materials)
- Gambling / lottery metaphors
- Non-shared religious holiday references

### ✅ Approved alternatives for common talking points

| If you'd reach for... | Use instead |
|---|---|
| "Same reason whisky bottles are amber" | "The same reason apothecaries have used amber for two centuries" or "Why pharmacies still fill prescriptions in amber" |
| "Aged like fine wine" | "Built to last decades on the shelf" or "Heritage glass-making" |
| "Spirits-grade" | "Pharmaceutical-grade" or "Laboratory-grade" |

### Voice register (per SEO_CONTENT_CALENDAR.md)
- **Halbert direct-response** — hero PDPs, problem→solution→CTA arc
- **Ogilvy authority** — standard PDPs, specifics over vagueness
- **Schwartz desire amplification** — aspirational/decorative families (Diva, Apothecary, Decorative)

### Sentence-level rules
- Average 8-15 words per sentence
- Specific numbers over hedge phrases ("17-415 neck" not "the right thread size")
- Active voice
- No emojis in body copy
- No "we believe" hedging — state facts
- No "elevate your brand" / "take it to the next level" empty B2B clichés
- "Best Bottles" or "Nemat International" — never "Bestbottles.com" in copy
- Parent company is "Nemat International, Inc." (founded 2003)

---

## Quality gates (apply before output)

For every generated description, the IDE must verify:

1. ✅ **Voice guardrail screen:** Run a regex check against the banned list (whisky|beer|wine|alcohol|spirits|bourbon|vodka|gin|rum|tequila|liquor|cocktail|brewery|distillery|aged like|fine wine). Flag any hit.

2. ✅ **Attribute accuracy:** Every claim about applicator/capacity/neck/color/material must trace to a Convex field for that specific SKU. No inferring from filenames or sibling SKUs.

3. ✅ **Family-size validation:**
   - Empire ∈ {50ml, 100ml} only. Reject any other.
   - Diva ∈ {30ml, 46ml, 100ml} only.
   - Verify any unfamiliar family-size combo against Convex before generating.

4. ✅ **No fabricated specs:** Numbers (dimensions, tolerance, weight, MOQ) must come from Convex. Don't round, don't estimate, don't extrapolate. If a field is missing in Convex, omit the claim — don't make it up.

5. ✅ **SEO meta length:**
   - metaTitle: 55-60 chars
   - metaDescription: 150-160 chars
   - productSchemaDescription: 120-180 chars

6. ✅ **FAQ AEO format:** Question-shaped (true question, not statement). Answer 1-3 sentences, fact-dense. Include the question's key term in the first 6 words of the answer (for AEO extraction).

7. ✅ **Internal-link opportunities:** Every standard/hero PDP should mention 1-2 compatible accessories (caps, applicators, droppers) — these become internal links in the CMS.

---

## Recommended sequencing (3-week sprint)

### Week 1 (May 23-30): Pilot + templates
- [ ] IDE reads all 14 source-of-truth files
- [ ] IDE writes Tier A copy for **Cylinder 9ml × 5 colors** (5 hero PDPs + 25 variants) as the pilot
- [ ] Stakeholder review (Abbas + team)
- [ ] Apply feedback to templates
- [ ] IDE builds Tier B template + Tier C variant template

### Week 2 (May 31 – June 6): Hero PDPs (50 groups)
- [ ] Tier A copy for remaining 45 hero PDPs (Empire 10, Diva 15, Boston Round 15, Sleek 5)
- [ ] Variant copy auto-generated for those 50 groups (~500 SKUs)
- [ ] QA pass against quality gates

### Week 3 (June 7-13): Tier B + final variants
- [ ] Tier B copy for remaining 175 standard PDPs
- [ ] Tier C variant copy for remaining ~1,854 SKUs
- [ ] Full QA pass + brand voice screen
- [ ] Convert to import-ready format for Sanity/Convex
- [ ] Engineering import + spot-check on staging
- [ ] **June 14:** Code freeze
- [ ] **June 15:** Launch

---

## Edge cases the IDE must handle

1. **Missing data:** If a Convex SKU has null/empty fields for a referenced template variable, omit that sentence. Never write "color: undefined" or fabricate.

2. **Phantom SKUs:** If Convex contains SKUs for invalid family-size combos (e.g., Empire 30ml — confirmed nonexistent), produce an exceptions report `/copy/EXCEPTIONS.md` listing these for cleanup before import. Do not generate copy for them.

3. **Component-only products:** ~207 of the 2,354 Convex SKUs are components (caps, closures, pumps, vials) that may not need full PDP copy. Filter `category=Component` and apply Tier C only — short factual product description, not narrative.

4. **Discontinued contract packaging:** Best Bottles no longer offers contract filling/capping/labeling services. Do NOT include any "we can fill your bottles for you" language. The `/services/contract-packaging` page is discontinued — redirect target is `/contact`.

5. **Multi-color variant groups:** When a parent group has multiple colors (e.g., Cylinder 9ml in Clear/Frosted/Amber/Cobalt/Swirl), the parent group description should mention all colors, but each color is its own product group (not a variant) per Convex's productGroup structure.

---

## Companion deliverables the IDE should also produce

1. **`/copy/EXCEPTIONS.md`** — Phantom SKUs, missing data, fields requiring human verification
2. **`/copy/STATS.md`** — Total counts, word counts, generation log
3. **`/copy/IMPORT-INSTRUCTIONS.md`** — Steps for engineering to import the JSON into Sanity/Convex
4. **`/copy/BRAND-VOICE-COMPLIANCE-REPORT.md`** — Confirmation that every generated description passed the regex banned-list check

---

## What the IDE should NOT do

- Do NOT invent product attributes that aren't in Convex
- Do NOT reference alcohol, spirits, or any haram beverage comparisons
- Do NOT generate Empire 15ml/30ml or other phantom sizes
- Do NOT write the variant SHA-style spec into the variant description (the spec block handles that — variant copy is the human-readable framing)
- Do NOT use AI-rewritten versions of legacy site copy verbatim (legacy copy often has run-on sentences and inconsistent voice — see for tone reference only)
- Do NOT promise inventory, lead times, or pricing tiers not visible in Convex (`stockStatus`, `caseQuantity`, `webPrice*` columns)

---

## Companion files in this audit folder for the IDE to reference

| File | What it provides |
|---|---|
| `seo-audit-2026-05-23/BRAND-VOICE-GUARDRAILS.md` | Authoritative ban list + approved alternatives |
| `seo-audit-2026-05-23/04-keyword-content/persona-keyword-corpus.md` | Persona-keyword mappings (use to inform metaTitle keyword selection) |
| `seo-audit-2026-05-23/04-keyword-content/content-roadmap-90d.md` | 28 post-launch content pieces that link back to PDPs |
| `seo-audit-2026-05-23/04-keyword-content/copy-templates.md` | PDP + category copy templates with worked examples (Cylinder Amber Boston Round Dropper template inside) |
| `seo-audit-2026-05-23/02-geo-aeo/geo-aeo-audit.md` | AEO best practices to apply to FAQ blocks |
| `seo-audit-2026-05-23/02-geo-aeo/llms.txt` | Brand facts the AI crawler will consult — keep PDPs consistent |
| `seo-audit-2026-05-23/03-legacy-baseline/legacy-equity-baseline.md` | What legacy URLs are preserving equity (don't accidentally diverge from those keywords) |
| `seo-audit-2026-05-23/01-technical-seo/technical-seo-audit.md` | Per-page canonical + Product schema requirements |
| `pipeline/instagram-overlays/SOURCE-INVENTORY-VERIFIED.md` | What's in each image folder (for referencing image URLs in copy) |

---

## How to invoke this in your IDE

Paste into Cursor / Claude Code / Codex as a system prompt or in a task brief:

```
You are generating the complete product copy library for Best Bottles
(Nemat International), a B2B wholesale glass-packaging supplier launching
a new Next.js + Convex + Sanity website on 2026-06-15.

Read PRODUCT-COPY-IDE-BRIEF.md in full. Then read the source-of-truth files
in the order listed in the brief. Generate copy following the three-tier
production system. Output as Sanity import JSON (default) at
/copy/sanity-import.json.

Apply every quality gate before writing output. Produce the companion
deliverables (EXCEPTIONS.md, STATS.md, IMPORT-INSTRUCTIONS.md,
BRAND-VOICE-COMPLIANCE-REPORT.md).

Sequence: start with the Cylinder 9ml × 5 colors pilot (5 hero PDPs + 25
variants). Stop, output, wait for stakeholder review before scaling.
```

---

## Final notes

This brief is self-contained and survives handoff. Every file path is repo-relative. Every constraint traces to a documented source. The IDE has everything it needs to execute without further clarification.

**Estimated total output:**
- ~80,000 words of copy across 225 product groups + 2,354 variants
- 1 Sanity import JSON file (~10 MB)
- 4 companion deliverables
- Estimated IDE compute: 6-12 hours for full generation depending on model

**One last reminder:** Best Bottles is a Muslim-owned brand. The brand voice guardrail isn't optional — it's a values-level commitment. Any single alcohol reference in published copy is a brand-trust violation. The IDE's banned-list regex check is the safety net.

Good luck. Ship clean.
