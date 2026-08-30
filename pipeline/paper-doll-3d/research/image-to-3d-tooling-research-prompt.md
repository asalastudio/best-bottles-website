# Research Prompt — Image-to-3D / Low-Skill 3D Pipeline for a Packaging E-Commerce Catalog

**How to use this document:** paste it whole into a deep-research AI (ChatGPT Deep Research, Perplexity, Gemini, Claude) or hand it to a consultant. It defines who we are, exactly what the final product must be, what we already have, every hard technical requirement, the full landscape to investigate, and the format the answer must come back in. Do not skip sections — the requirements in §4 are what separate a usable recommendation from a demo-video impression.

---

## 1. Who we are and the stack we're locked into

Best Bottles, a division of Nemat International (Union City, CA) — B2B/DTC e-commerce for perfume and essential-oil packaging: glass bottles, roll-on fitments, caps, sprayers, droppers, pumps.

- **Catalog scale:** 2,285 SKUs organized into ~230 product families (a family = one bottle shape across sizes/colors, e.g. "Boston Round" in 15/30/60 ml × clear/amber/cobalt × many closure options).
- **Web stack (fixed, not up for replacement):** Next.js on Vercel, **Sanity.io** as the CMS (embedded Studio, non-technical editors manage PDP content), Convex as the product database keyed by SKU, Shopify for checkout.
- **In-house packaging configurator (fixed):** a custom three.js / react-three-fiber app that loads glTF/GLB bottle models and lets customers design labels and swap components on a live 3D bottle. It has an existing loader contract (see §4.3).
- **Team:** web developers and graphic designers. **No dedicated 3D artist.** macOS environment. Budget-conscious small business — every recommendation must state real pricing.

## 2. The final product we are trying to achieve

One 3D "perfect twin" per product family, serving three outputs from a single source of truth:

1. **Interactive 3D configurator** — customer picks a bottle, swaps caps/fitments, applies their label artwork, sees it live in the browser (three.js). This is a working app today; it needs *models*.
2. **Consistent studio pack shots at e-commerce quality** — every SKU photographed "in the same studio": identical seamless **bone-colored** backdrop, one large soft key light, soft drop shadow falling to 2 o'clock, straight-on camera. Hundreds of images, batch-renderable, visually identical staging across the whole catalog. These images are served on product pages via Sanity/Shopify.
3. **The paper-doll component system** (§3) — the same components recombined to cover the catalog combinatorially without re-modeling or re-shooting.

Optional later: AR Quick Look (USDZ), turntable animations for marketing. Nice-to-have, not required now.

## 3. The paper-doll technique (non-negotiable concept)

"Paper doll" is our internal name for **component-swappable product assembly**:

- The **bottle body**, the **roll-on fitment** (ball + housing), and each **cap/closure** are **separate 3D objects**, never fused into one mesh.
- All components mate at a shared **neck datum**: the bottle exposes a seating plane at its neck; every component's origin sits at its own mating face, so assembly is "snap component origin to datum" with zero manual positioning.
- One bottle × 12 closures = 12 sellable SKUs from 13 assets. Across ~230 families this combinatorial reuse is the entire economic point.
- The bottle body is ground truth; components adapt to the bottle's neck, never the reverse.
- We already run a 2D version of this (layered Photoshop compositing, ~5,585 prepared layer images) for current site imagery. The 3D lane must reproduce the same swap logic in geometry.

**Any tool or service that outputs a single fused, unsegmented mesh per product photo fails this requirement unless there is a practical separation workflow.** This is the first question to ask of every AI image-to-3D generator.

## 4. Hard technical requirements (the spec any candidate must meet)

### 4.1 Dimensional accuracy — these are fitment parts, not props
- Real-world scale in millimeters. Bottles are built to measured dimensions (example pilot: 30 ml Boston Round = 78 mm bare height, 33 mm outer diameter, 2.45 mm glass wall).
- **Neck finishes follow SPI/GPI standards** and are fitment-critical: e.g. 20-400 (thread outer T = 20.2 mm, thread root E = 17.8 mm, bore I = 15.5 mm, 10 mm finish height, ~1.6 thread turns). 30 ml and 60 ml share the identical 20-400 neck; a naively scaled model breaks cap compatibility. Any acceptable pipeline must keep necks dimensionally exact while body size varies.
- Silhouette accuracy target: within ~0.5 mm of the reference photo/caliper measurements.

### 4.2 Inputs we can provide
- Single-angle, white-background product photos for most SKUs (e-commerce shots).
- Layered PSD masters for many products (clean cutouts with alpha).
- **Physical samples of every product** (so scanning/caliper measurement is possible).
- Nearly all our glassware is a **solid of revolution** (round bottles) — a 2D outline revolved 360°. Tools that exploit this (profile/lathe/revolve modeling) have a massive head start over general-purpose mesh generation.

### 4.3 Output contract (what the configurator already expects)
- **glTF/GLB**, Draco compression welcome; our scripted pilot exports ~45 KB per bottle.
- Named meshes, matched case-insensitively by substring: `body` (glass), `liquid`, `cap` (or sprayer/pump/roller/dropper), `collar`, `label_front`, `label_back`. The app assigns its own live materials to these names; unrecognized meshes keep their authored materials.
- +Z up (or convertible), bottle base seated at Z = 0, real mm scale.
- Clean, manifold topology, roughly 10–40k triangles per assembly; interior glass cavity modeled (refraction reads wrong without it).
- Label meshes carry flat 0–1 UVs so customer artwork maps exactly.

### 4.4 Materials
- Physically-plausible **glass** with transmission/refraction and **colored absorption** (amber, cobalt, clear — color must deepen with glass thickness, as real amber does).
- Polypropylene caps (fine ribbed textures), metallic collars/overcaps (shiny gold, matte silver, etc.).
- Materials may be authored in the tool **or** applied downstream (our configurator applies its own three.js materials to named meshes; our pack-shot renderer needs render-quality materials).

### 4.5 Rendering / staging
- The universal studio must be **reproducible and lockable**: same backdrop color, same light, same shadow direction for every product, forever. Batch rendering across hundreds of SKUs without per-image fiddling.
- Transparent amber glass is the hard case: it needs light *behind/around* it (bright-field) to show its color; naive front lighting renders it as dark gray. Judge every tool's sample renders on **transparent colored glass specifically**, not on opaque products.

## 5. What we have today (the baseline any alternative must beat)

We built a **scripted, parametric Blender pipeline** (Python, committed to our repo, no hand-modeling in the loop):

- Photo → automated silhouette extraction → (radius, height) profile in mm → parametric solid-of-revolution builder → validated GLB meeting §4.3 (automated checks: dimensions, manifoldness, volume, naming). Achieved ~0.4 mm silhouette RMS vs the reference photo on the pilot.
- True helical neck threads, measured SPI neck data, physically-solved amber absorption, procedural glass imperfections.
- A scripted universal studio (bone sweep, single large soft key, even backdrop wash, 2:00 shadow) rendered headlessly via Cycles.
- Pilot complete: 30 ml amber Boston Round body + ribbed PP cap. 60/15 ml derives are parameter changes, not remodels.

**The pain point:** every *new shape family* still needs someone comfortable driving Blender/Python. The GUI learning curve for our team is steep; we are re-evaluating whether a lower-skill tool, an AI service, or outsourcing gets equal quality with less specialized skill. The research question is **"switch, hybrid, or stay" — not "is Blender good."**

## 6. Landscape to research — cover ALL of these categories

**A. AI image-to-3D generators** — Meshy, Tripo (TripoSR/Tripo3D), Rodin/Hyper3D, Kaedim, Alpha3D, CSM (Common Sense Machines), Luma Genie, Spline AI, Hunyuan3D, Microsoft Trellis, Stability SF3D/SPAR3D, and whatever is newest (this space moves monthly — prioritize 2025–2026 information). For each: Does it produce real-scale output? Separated components or one fused blob? Watertight clean topology at 10–40k tris? How does it handle **transparent glass** (most fail here)? Can it hit ±0.5 mm on a 33 mm cylinder, or is output "approximately bottle-shaped"? Export formats, licensing of generated assets, pricing per model.

**B. Photogrammetry & 3D scanning of physical samples** — phone apps (Polycam, KIRI, Luma, RealityScan), desktop (RealityCapture, Metashape), small-object turntable scanners (Revopoint, Creality, Einstar). Critical known problem: **transparent/glossy glass is photogrammetry's worst case** — research cross-polarization rigs, matting sprays (AESUB), and whether scan-then-retopo is realistic for non-3D-artists. Per-unit time and cleanup burden.

**C. Parametric CAD** — Fusion 360, Onshape, Shapr3D, Plasticity, FreeCAD. Bottles are revolve solids: tracing a photo profile and revolving it is a beginner CAD operation. Evaluate: learning curve vs Blender honestly compared; can a junior trace a bottle profile over a photo in under an hour; thread modeling; STEP→GLB export quality (tessellation, naming, scale); cost.

**D. Automated silhouette-to-lathe tools** — is there any commercial/web tool that does specifically what our script does: take a bottle photo, extract the outline, and revolve it into a 3D model? (Sometimes marketed as "lathe from image," "revolve from sketch," vectorize-then-extrude.) This exactly matches our geometry class and would be the shortest path if it exists at quality.

**E. Beginner-friendly 3D design tools** — Spline, Womp, Vectary, SelfCAD, Bezi. Judged on: revolve/lathe workflow, real-mm accuracy, GLB export cleanliness, glass materials, and whether "easier than Blender" survives contact with our accuracy spec.

**F. Full-service 3D commerce platforms** — Threekit, VNTANA, Emersya, Expivi, Sayduck, Zakeke, Cylindo. These both create models (or manage creation) and host configurators/renders. Evaluate: model quality for glass, whether their configurator replaces or can feed our in-house three.js app (we want OUR app fed, not replaced — but price the alternative honestly), per-SKU and platform pricing, lock-in risk, whether they export GLBs we own.

**G. Outsourcing the modeling** — CGTrader/Fiverr/Upwork studios and dedicated product-viz agencies. We can hand over: photos, PSDs, physical samples, exact dimensions, and the §4.3 spec sheet. Research realistic per-model pricing (simple revolve-solid bottle vs cap with threads), turnaround, QA criteria we should impose, and whether ~230 families is better priced as a program than per-model.

**H. Manufacturer & standards CAD sources (don't skip this one)** — glass bottles are made in standardized molds. Do manufacturers/distributors (SGD Pharma, Stoelzle, Berlin Packaging, O.Berk, Gerresheimer, etc.) supply STEP/IGES CAD for stock bottles? Are SPI/GPI neck-finish drawings freely downloadable (they are published standards — find the source)? Check GrabCAD/TraceParts/3D Warehouse for existing accurate bottle CAD. Free accurate CAD + a convert-to-GLB step could bypass modeling entirely for stock shapes.

**I. Skip-3D alternatives for the pack shots specifically** — we already run an AI image-generation pipeline (GPT-Image-class) for product photos. Research the 2026 state of AI product photography for **catalog consistency**: can current image models render the *same* bottle identically across hundreds of SKUs with a locked studio look, or does geometry drift remain? (Our experience: drift remains; that's partly why the 3D lane exists. Verify against current tools.) Note: this only addresses output #2 — the configurator still needs real geometry.

**J. Sanity.io integration (required section)** — for whichever pipeline wins:
   - Storing/serving GLB (and later USDZ) — Sanity file assets vs Vercel/CDN vs the configurator's own hosting; CDN caching and versioning of model files.
   - Any Sanity plugins/custom input components for previewing 3D models inside the Studio (e.g. `<model-viewer>`-based), so editors can see the asset they're attaching.
   - Schema pattern: product family document referencing its GLB asset + its rendered pack-shot image set + component compatibility list (which caps fit which necks) — so editors assemble PDPs without touching 3D tools.
   - Rendered pack shots as Sanity image assets (crops/hotspots) vs Shopify media — pros/cons given both exist in our stack.
   - Any known e-commerce case studies combining Sanity + three.js configurators.

## 7. Evaluation rubric — score every serious candidate 1–5 on each

| Criterion | Weight |
|---|---|
| Dimensional accuracy achievable (±0.5 mm, exact necks) | ×3 |
| Component separation (paper-doll) supported | ×3 |
| Skill floor — can a web dev/designer run it after a day? | ×3 |
| Glass material quality (transmission + colored absorption) | ×2 |
| GLB export cleanliness (naming, scale, topology, size) | ×2 |
| Marginal cost + time per additional family (230 total) | ×2 |
| Batch render consistency (locked universal studio) | ×2 |
| Integration effort with Next.js/Sanity/three.js | ×1 |
| Asset ownership/licensing clarity | ×1 |
| Vendor longevity / lock-in risk | ×1 |

## 8. Required output format of the research

1. **Landscape table** — every tool/service examined, category, verdict in one line, pricing, last-verified date.
2. **Top 3 recommended workflows**, each described as a concrete step-by-step pipeline for our test case (below), with hours and cost estimated per family.
3. **Cost & time projection** for the full ~230-family catalog under each of the top 3.
4. **Risks and gotchas** per recommendation (especially: transparent glass, neck accuracy, mesh naming, licensing).
5. **Explicit verdict vs our baseline** (scripted Blender pipeline, §5): switch entirely, hybrid (e.g. CAD or AI for rough shape + our scripts for necks/export), or stay. Argue it with the rubric.
6. **Sanity.io integration recommendation** (§6-J) regardless of which pipeline wins.
7. **Sources with dates.** Discard pre-2025 claims about AI 3D generation quality — the field changes too fast.

## 9. Standard test case (use this to trial any tool hands-on)

> Model a 30 ml amber glass Boston Round bottle: 78 mm bare height, 33 mm outer diameter, 2.45 mm wall, 20-400 SPI neck (T 20.2 / E 17.8 / I 15.5 mm, 10 mm finish height, 1.6 thread turns), interior cavity modeled, amber transmission material. Separate ribbed black PP cap (23.5 mm OD × 11.8 mm tall) as its own object seating on the neck. Export a single GLB, real mm, base at Z = 0, meshes named `body` and `cap`, under 40k triangles. Then render it straight-on against a seamless bone backdrop with one soft key light and a soft shadow to 2 o'clock.

A tool that survives this test case survives our catalog.

## 10. Pointed questions that must come back answered

1. Which, if any, AI image-to-3D tool outputs **separated, named components** rather than one fused mesh?
2. Which, if any, outputs **true-scale** geometry, or accepts a dimension to calibrate to?
3. Can any current AI generator model a **threaded neck** accurately enough that a separately-modeled cap seats on it? If not, what's the accepted hybrid (AI body + CAD/library neck)?
4. What is the state of the art for **scanning transparent glossy glass**, and is it viable for non-specialists?
5. Do bottle **manufacturers publish CAD** for stock molds, and are SPI/GPI neck drawings obtainable? Where exactly?
6. Is there a commercial **image-outline→revolve** tool (our exact geometry class)?
7. For revolve-solid products specifically, is parametric CAD (Fusion/Onshape/Shapr3D) genuinely lower-skill than scripted Blender, measured in time-to-first-accurate-bottle for a web developer?
8. What do product-viz studios charge **per bottle** and **per threaded closure** in 2026, and what spec sheet should we hand them to get §4.3-compliant GLBs back?
9. Can any full-service platform (§6-F) feed models into OUR three.js app, or do they all require using their viewer?
10. What is the recommended way to store, version, and serve GLB assets alongside **Sanity.io**, and are there Studio plugins to preview them?
11. For locked-consistency catalog pack shots, does anything beat batch 3D rendering today — honestly compare 2026 AI image generation on geometric consistency.
12. If we keep the scripted pipeline for geometry, is there a tool that removes the *Blender GUI* from the humans entirely (headless renders + web-based review), so the team never opens Blender?

---
*Context date: August 2026. Prepared for Best Bottles / Nemat International 3D asset lane re-evaluation.*
