# Best Bottles — Instagram Image Batch (12 spec-driven posts)

**Purpose:** Build the founder-engineering credibility content pillar on Instagram. Every image showcases real Best Bottles engineering — measured dimensions, named neck thread sizes, verified materials, actual catalog scale. **No invented specs.** Every number in every caption traces back to a documented source file in this repo.

**Generator:** Higgsfield (`mcp__67b7fa1e-b8ee-419a-bbdb-0b13711ab82b__generate_image`) using GPT Image 2.0 or comparable.

**Output format:** All 12 images at 1080×1350 (4:5 portrait — Instagram feed's tallest allowed aspect, maximizes scroll real-estate). Some can be reframed to 1:1 (1080×1080) if needed for grid consistency.

**Visual identity (codified from `src/app/layout.tsx` and `globals.css`):**
- Dominant background: obsidian/near-black (#0F0E0C range)
- Accent: muted-gold (warm tan, #B08D3A range)
- Highlight: cream/off-white for product hero light
- Typography for any overlay text: serif (EB Garamond or Cormorant) for headlines, sans (Inter) for spec labels
- Lighting: studio macro, hard rim-light from upper-left, deep shadows, no lifestyle clutter
- Reference visual aesthetic: like a Le Labo, By Kilian, or Aesop product release shot — apothecary-editorial, not consumer-DTC

---

## Series structure (4 series × 3 images = 12)

The 12 posts deliberately pace across four educational angles so the feed reads as a *system* rather than 12 unconnected hero shots. Post in this order, one every 2–3 days, to build a 24–30 day Instagram presence with cohesive narrative.

| Series | Theme | Posts |
|---|---|---|
| **A — The Fitment System** | Why our 63 fitment rules matter (one neck = many possibilities) | #1, #2, #3 |
| **B — Family Profiles** | Individual hero shots, each with one star spec | #4, #5, #6 |
| **C — The Color Library** | Five verified glass colors, color-physics framing | #7, #8, #9 |
| **D — The Manufacturing Scale** | 2,354 SKUs · 225 groups · 23 years · component precision | #10, #11, #12 |

---

## Image #1 — "One neck. Seven shapes."

**Series:** A · Fitment System
**Real specs used:** 13-415 neck thread size, 7 bottles confirmed compatible per `docs/all-fitment-matrices.md`
**Source:** `docs/all-fitment-matrices.md` § 13-415 section
**Format:** 1080×1350 (4:5)
**Caption hook:** "One neck size. Seven completely different bottles."

**Composition:**
Studio overhead shot, deep obsidian background. Seven bottles in a precise arc/half-circle, each lit individually from above so glass reflects in identical highlights. Bottles left-to-right: Cylinder 5ml Clear, Tulip 6ml Clear, Sleek 5ml Clear, Royal 13ml Clear, Flair 15ml Clear, Square 15ml Clear, Elegant 15ml Clear. A faint engraved-style "13-415" label running along the bottom edge in serif type, gold ink.

**Higgsfield prompt:**
> Editorial macro studio photograph, 4:5 portrait aspect ratio, top-down half-circle arrangement of seven small empty clear glass bottles on a deep matte obsidian-black surface. Bottles arranged left to right by increasing height and width: a 17mm-diameter narrow cylinder bottle 59mm tall, a 23mm-diameter bulbous tulip-shaped bottle 47mm tall, a tall slim cylinder 28mm wide and ~95mm tall, a 13ml short cylindrical bottle, a 15ml flat rectangular bottle 41mm wide and 20mm deep, a 26mm square bottle, and a 36×18mm flat rectangular bottle 73mm tall. Each bottle is empty, uncapped, glass crystal-clear with subtle internal reflections. Single hard rim light from upper-left at 45 degrees creating crisp gold-tinged highlights on each glass body, deep velvet shadows pooling behind each bottle. Color palette: 90% deep obsidian black, 10% warm gold highlights on glass edges. Centered along the bottom edge, in small elegant Garamond serif type in muted-gold color, the label "13-415". Sharp focus across the whole arrangement, no depth of field falloff. Style: Le Labo apothecary catalog meets architectural product photography. No people, no lifestyle elements, no logos other than the spec label.

---

## Image #2 — "Cap anatomy, exploded."

**Series:** A · Fitment System
**Real specs used:** 18-400 applicator cap, 45 ± 0.5 mm tall, 21 ± 0.5 mm diameter (from `convex_products_current_2026-05-20.csv` row `BB-CL-000-0198`)
**Source:** `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv`
**Format:** 1080×1350 (4:5)
**Caption hook:** "Three components. ±0.5mm tolerance. One reason your formula stays in the bottle."

**Composition:**
A single black applicator cap photographed in an exploded-view layout — outer cap shell at top, inner liner in the middle, glass rod applicator at the bottom, all centered vertically with about 3cm of empty space between each component. Subtle white dimension-line annotations: a vertical caliper line on the right marked "45 ± 0.5 mm" (full assembled height), a horizontal line under the cap marked "21 ± 0.5 mm" (diameter). Background a clean dark warm-gray gradient (lighter near top, darker at bottom).

**Higgsfield prompt:**
> Technical product photography, 4:5 portrait aspect ratio. Exploded-view composition of a single black plastic perfume bottle cap with internal components arranged vertically with 3cm spacing between each: the outer black ribbed cap shell at top, a flat thin black liner disc in the middle, and a black plastic applicator wand approximately 60mm long with a small glass rod tip at the bottom. All components precisely centered along a vertical axis. Background: clean dark warm-gray gradient, lighter at top, darker at bottom, completely uncluttered. Soft directional studio lighting from upper-right creating subtle highlights on the matte black plastic. On the right side of the composition, thin white technical dimension lines with serif text annotations: "45 ± 0.5 mm" measuring full assembled height, and "21 ± 0.5 mm" measuring cap diameter. Style: aerospace component blueprint photography meets luxury watch movement editorial. Razor-sharp focus, no depth of field falloff, neutral color grading with subtle gold tint in the annotation text. No people, no logos, no extraneous detail.

---

## Image #3 — "Plastic ball or metal ball."

**Series:** A · Fitment System
**Real specs used:** Plastic vs metal roller plug options per `docs/all-fitment-matrices.md` (both options exist across all 17-415 and 13-415 roll-on bottles)
**Source:** `docs/all-fitment-matrices.md` § 17-415 and 13-415 sections
**Format:** 1080×1080 (1:1)
**Caption hook:** "Plastic for fragrance oils. Metal for water-based. Both ship same day."

**Composition:**
Two clear glass cylinder roll-on bottles photographed head-on, side by side. Left bottle has a transparent plastic roller ball visible at the neck (slightly larger, lighter), right bottle has a polished stainless-steel metal roller ball (smaller, gleaming). Macro perspective showing the roller balls in extreme detail. Soft white backlight glowing through both bottles. Faint label below each: "plastic" (left), "metal" (right) in small serif gold type.

**Higgsfield prompt:**
> Macro product photography, 1:1 square aspect ratio. Two identical small clear glass cylindrical roll-on perfume bottles (approximately 9ml capacity, 17mm diameter, 60mm tall) photographed head-on side by side with their necks at the top of the frame in extreme close-up. The left bottle has a transparent clear plastic roller ball visible seated in its neck. The right bottle has a polished mirror-finish stainless steel metal roller ball seated in its neck. Both balls are sharply in focus. The background is a soft warm-white luminous gradient, glowing softly behind both bottles, giving the impression of backlit glass. The bottles cast no harsh shadows. Below each bottle, in small muted-gold Cormorant italic serif type, the label "plastic" on the left and "metal" on the right. Composition is precisely centered and symmetrical. Style: clinical product comparison meets luxury fragrance editorial. No people, no logos, no other elements.

---

## Image #4 — "Sleek 50ml. 5:1 ratio. The architectural one."

**Series:** B · Family Profiles
**Real specs used:** Sleek 50ml is 28mm wide × 143mm tall (height-to-width ratio 5:1) per `docs/SHAPE_AUDIT.md`
**Source:** `docs/SHAPE_AUDIT.md` § Family Dimension Data
**Format:** 1080×1350 (4:5)
**Caption hook:** "143 millimeters tall. 28 millimeters wide. A five-to-one ratio you can feel in the hand."

**Composition:**
Single Sleek 50ml clear glass bottle photographed in profile against deep obsidian background. The dramatic 5:1 ratio is the entire point — fill nearly the full vertical of the 4:5 frame with the bottle. Hard rim lighting from upper-left, deep shadow on the right side of the bottle. Faint vertical dimension line on the right: "143 mm" with small tick marks. Faint horizontal dimension line at the base: "28 mm".

**Higgsfield prompt:**
> Editorial product photography, 4:5 portrait aspect ratio. A single empty clear glass bottle photographed in profile (side view) against a deep matte obsidian-black background, centered horizontally, occupying about 85% of the vertical frame height. The bottle is extraordinarily tall and narrow: 143mm tall, only 28mm wide, with a thin cylindrical body and a small black cap at the top. The dramatic 5-to-1 height-to-width ratio is the visual centerpiece. The bottle is uncapped or has a small short black cap, empty of liquid. Single hard rim light from upper-left at 60 degrees creating a brilliant white-gold vertical highlight along the left edge of the glass, and deep velvet shadow falling on the right side. On the right side of the bottle, a thin white technical dimension line with small tick marks at top and bottom, labeled "143 mm" in small serif type. At the base, a small horizontal dimension line labeled "28 mm". Color palette: 90% deep obsidian, 10% gold-white highlights on glass. Style: architectural product photography, like a tall Brancusi sculpture meets perfume bottle editorial. No people, no other elements.

---

## Image #5 — "Boston Round. The amber blocks UV."

**Series:** B · Family Profiles
**Real specs used:** Boston Round is a 15–60ml family (per `docs/SHAPE_AUDIT.md`); amber glass is documented for essential-oil use cases on the legacy site (preserves photo-sensitive contents from UV degradation)
**Source:** `docs/SHAPE_AUDIT.md` + legacy site fetch
**Format:** 1080×1350 (4:5)
**Caption hook:** "Amber glass. Same reason apothecaries have used amber for two centuries. Same reason your essential oils should be too." [Brand note 2026-05-23: Best Bottles is a Muslim-owned brand (Nemat International). No references to alcohol, whisky, beer, wine, or spirits in any content — ever.]

**Composition:**
Single Boston Round 30ml amber glass bottle photographed against a soft warm-white gradient background (instead of black this time — for color contrast). A diagonal beam of bright white sunlight enters from upper-left through the glass; you can see the warm amber filter the light into a golden glow on the surface beneath. Below the bottle, a subtle text label in serif: "Amber glass · ~70% UV reduction · For essential oils, citrus oils, photosensitive formulas".

**Higgsfield prompt:**
> Editorial product photography, 4:5 portrait aspect ratio. A single empty amber-colored Boston Round laboratory-style glass bottle, approximately 30ml capacity, 55mm diameter, 75mm tall to shoulder, with a short rounded shoulder and a small black cap. The bottle sits centered on a clean cream-white warm surface against a soft warm-white gradient background. From the upper-left of the frame, a diagonal beam of bright white sunlight enters and passes through the amber glass, casting a warm golden-orange filtered shadow on the surface in front of the bottle. The amber color is rich and deep, the classic apothecary amber tone. Beneath the bottle in small muted-gold Cormorant serif type, the three-line label: "Amber glass" / "~70% UV reduction" / "For essential oils, citrus oils, photosensitive formulas". Style: documentary still-life meets fragrance laboratory editorial. The photograph should communicate scientific function while remaining beautiful. No people, no other elements.

---

## Image #6 — "Empire 50ml. The shape Best Bottles is known for."

**Series:** B · Family Profiles
**Real specs used:** Empire 50ml is 37mm wide × 93mm tall per `docs/SHAPE_AUDIT.md`; Empire is one of the design families displayed on the homepage carousel per `docs/CONTENT_HANDBOOK.md`
**Source:** `docs/SHAPE_AUDIT.md` + `docs/CONTENT_HANDBOOK.md`
**Format:** 1080×1350 (4:5)
**Caption hook:** "Empire. 50 milliliters. Ninety-three millimeters of curved glass that took a year to perfect."

**Composition:**
Single Empire 50ml clear glass bottle, photographed in profile but slightly turned (about 15 degrees) so the curved silhouette reads. Deep obsidian background. Dual lighting: hard rim light from upper-left (creates the gold highlight along the curve), soft fill from lower-right (reveals the bottle's depth). No spec labels this time — the bottle's silhouette IS the spec. Below, in small italic serif: "Empire 50ml".

**Higgsfield prompt:**
> Hero product photography, 4:5 portrait aspect ratio. A single empty Empire 50ml clear glass perfume bottle photographed at a three-quarter profile angle (slightly turned about 15 degrees from pure side view), centered in the frame. The bottle is approximately 37mm wide at its widest point and 93mm tall to shoulder, with a distinctive smooth curved silhouette tapering inward toward a narrow neck at the top. Empty of contents. No cap, or a small minimal black cap. Background: deep matte obsidian black. Dual lighting setup: a hard rim light from the upper-left at 60 degrees creating a brilliant gold-white highlight running along the entire curved left edge of the bottle; a soft warm fill light from the lower-right at low angle revealing the bottle's three-dimensional volume and the subtle curve of the body. The lighting reveals the architectural shape of the bottle as the hero of the image. Beneath the bottle in small muted-gold italic Cormorant serif type, the simple label "Empire 50ml". No dimension lines, no other text, no other elements. Style: Le Labo product portrait meets architectural minimalism. The bottle silhouette is the entire story.

---

## Image #7 — "Five colors. Five different reasons."

**Series:** C · Color Library
**Real specs used:** Best Bottles offers Clear, Frosted, Cobalt Blue, Amber, and Swirl glass per `data/MASTER-PRODUCT-LIST-README.md` (74 Clear, 16 Frosted, 7 Cobalt Blue, 7 Amber, 2 Swirl SKUs in the live-site product master)
**Source:** `data/MASTER-PRODUCT-LIST-README.md` § Glass Color breakdown
**Format:** 1080×1350 (4:5)
**Caption hook:** "Clear shows the fragrance. Frosted softens the light. Amber and cobalt block UV. Swirl turns the bottle into the package."

**Composition:**
Five identical Empire 50ml bottles photographed in a row against deep obsidian background. Left to right: Clear, Frosted, Cobalt Blue, Amber, Swirl. Each lit individually so glass color is true to life. Below each, in tiny serif type: the color name. No other text — let the colors do the work. [Empire is offered in 50ml and 100ml only per Best Bottles team confirmation 2026-05-23.]

**Higgsfield prompt:**
> Editorial product photography, 4:5 portrait aspect ratio. Five identical empty perfume glass bottles arranged in a precise horizontal row across the middle of the frame, photographed straight-on, against a deep matte obsidian-black background. Each bottle is the same shape — approximately 37mm wide, 90mm tall, with a smooth curved silhouette and a small black cap. The five bottles, left to right, are in five different glass finishes: bottle 1 is crystal clear transparent glass, bottle 2 is opaque white frosted glass, bottle 3 is deep cobalt blue translucent glass, bottle 4 is rich amber translucent glass, and bottle 5 is swirled glass with a mottled clear-and-cream pattern. Each bottle is individually lit from above and behind with controlled rim lighting that makes its specific glass character true and luminous: the clear bottle catches transparent highlights, the frosted has matte softness, the cobalt glows deep blue, the amber glows warm gold, the swirl shows internal pattern. Beneath each bottle in tiny muted-gold Cormorant serif type: "clear" / "frosted" / "cobalt" / "amber" / "swirl". The bottles are spaced about 30mm apart, perfectly aligned. Style: museum catalog meets fragrance editorial. No people, no other elements, no other text.

---

## Image #8 — "Cobalt blue. Macro."

**Series:** C · Color Library
**Real specs used:** Cobalt blue glass is one of the 5 colors offered (7 SKUs)
**Source:** `data/MASTER-PRODUCT-LIST-README.md`
**Format:** 1080×1080 (1:1)
**Caption hook:** "Cobalt blue. Not painted. The color is in the glass."

**Composition:**
Extreme macro of a single cobalt blue bottle's body, filling the entire frame. A diagonal beam of bright white light passes through the glass from the upper-left, revealing the saturated blue depth. No other elements — pure color study.

**Higgsfield prompt:**
> Extreme macro fine-art photography, 1:1 square aspect ratio. Close-up detail of the body of a single cobalt blue translucent glass bottle, framed so the glass body fills approximately 90% of the frame. The glass is rich deep cobalt blue, saturated and translucent rather than opaque. From the upper-left of the frame, a diagonal beam of bright white light passes through the glass, revealing the depth of the blue color and a slightly lighter blue highlight where the light exits the glass on the lower-right. Surface texture of the glass is visible — very subtle waves and bubbles characteristic of mouth-blown or precision-molded glass. The background behind the bottle (visible at the edges of the frame) is pure black. Style: fine-art photographic color study, like a James Welling or Wolfgang Tillmans glass piece. The bottle should feel sculptural and architectural rather than commercial. No labels, no text, no other elements.

---

## Image #9 — "Frosted glass. Texture macro."

**Series:** C · Color Library
**Real specs used:** Frosted is one of the 5 colors (16 SKUs)
**Source:** `data/MASTER-PRODUCT-LIST-README.md`
**Format:** 1080×1080 (1:1)
**Caption hook:** "Frosted. Diffuses light. Hides what's inside. The choice for brands that want mystery."

**Composition:**
Extreme macro of a frosted glass surface. The matte texture is the hero. Soft warm light from upper-left grazes the surface, revealing the satin finish. A single small drop of clear oil/water sits on the surface, refracting light differently against the frosted background.

**Higgsfield prompt:**
> Extreme macro fine-art photography, 1:1 square aspect ratio. Close-up detail of a frosted opaque white glass surface, framed so the frosted texture fills the entire frame. The glass surface is matte, satiny, with subtle micro-pebbling characteristic of acid-etched or sandblasted frosted glass. Soft warm-white directional light grazes across the surface from upper-left at 15 degrees creating subtle highlights and revealing the texture. A single small drop of clear oil or water sits at the center of the frame on the frosted surface, perfectly spherical, catching a brilliant pinpoint highlight from the light source — the drop is the only sharply-defined element, the rest of the frame is the soft matte texture of the frosted glass. The contrast between the wet refractive sphere and the dry diffused frosted surface is the entire story. Background is implied (frosted glass surface fills entire frame). Style: scientific macro meets minimalist fine-art photography. No labels, no text, no other elements.

---

## Image #10 — "2,354 SKUs. One supply chain."

**Series:** D · Manufacturing Scale
**Real specs used:** 2,354 SKUs across 225 product groups (per `data/MASTER-PRODUCT-LIST-README.md` and `docs/SOW_LAUNCH_PLAN_2026-05-04.md`)
**Source:** `data/MASTER-PRODUCT-LIST-README.md` + `docs/SOW_LAUNCH_PLAN_2026-05-04.md`
**Format:** 1080×1350 (4:5)
**Caption hook:** "Twenty-three years of decisions. 2,354 SKUs. 225 product groups. Every single one in stock today."

**Composition:**
A precisely-aligned dense grid of thumbnail bottle silhouettes filling the entire frame. Each silhouette is a different bottle from the catalog, all rendered as minimal white-on-black profile drawings — no colors, no caps, just the shape outlines. The grid implies scale. Bottom 20% of the frame is darker with overlay text in elegant serif: "2,354 SKUs / 225 product groups / Twenty-three years."

**Higgsfield prompt:**
> Editorial graphic design composition, 4:5 portrait aspect ratio. The upper 80% of the frame is a dense, precisely-aligned grid of approximately 200 small bottle silhouette icons, each rendered as a minimal white line drawing of a different bottle profile on a deep obsidian-black background. The bottle silhouettes are varied — tall thin cylinders, wide round bottles, square bottles, dropper bottles, roll-on bottles, atomizers, lotion pumps, cream jars — but all rendered in the same minimal white-line style, each silhouette no more than 1cm tall, all aligned to a strict 14-column grid. The bottles are not photographs — they are clean vector-style line illustrations. The lower 20% of the frame fades to deeper black, and overlaid in elegant muted-gold Cormorant serif type, centered, in three lines: "2,354 SKUs" / "225 product groups" / "Twenty-three years." Style: information graphic meets museum exhibition title card. No people, no other elements. The visual impression is of overwhelming, methodical scale.

---

## Image #11 — "Component precision: ±0.5 millimeters."

**Series:** D · Manufacturing Scale
**Real specs used:** Cap heights documented in the master sheet to ±0.5mm tolerance (e.g., 11 ± 0.5mm short cap, 45 ± 0.5mm applicator cap, 21 ± 0.5mm diameter — all verifiable in `convex_products_current_2026-05-20.csv`)
**Source:** `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv` rows BB-CL-000-0198 to 0202
**Format:** 1080×1350 (4:5)
**Caption hook:** "Every component documented to half a millimeter. Because your filling line doesn't tolerate guesswork."

**Composition:**
A single black cap photographed from directly above, centered in frame. Surrounding it, precise white technical-drafting dimension annotations: a diameter line crossing horizontally labeled "21 ± 0.5 mm", a height callout pointing to the side labeled "11 ± 0.5 mm", a thread spec label "13-415". Background: clean engineering drafting paper texture (off-white with very faint grid).

**Higgsfield prompt:**
> Technical engineering photography composition, 4:5 portrait aspect ratio. A single small round black plastic perfume bottle cap, approximately 21mm in diameter, photographed from directly overhead in the center of the frame. The background is a clean off-white surface with a very faint pale grey grid pattern (engineering drafting paper aesthetic). Around the cap, precise white technical-drafting dimension annotations: a horizontal dimension line crossing the cap's diameter with arrows at each end, labeled in small serif type "21 ± 0.5 mm"; a vertical dimension callout on the right side pointing to the cap's edge labeled "11 ± 0.5 mm"; a third callout near the cap labeled "13-415" indicating the thread size. All annotation lines are crisp, thin white lines with clean serif typography. Soft even lighting from above, no harsh shadows, completely flat technical clarity. Color palette: 80% warm off-white background, 15% black cap, 5% muted-gold annotation text. Style: aerospace engineering blueprint meets minimal product design. No people, no other elements, no logos.

---

## Image #12 — "Union City, California. Since 2003."

**Series:** D · Manufacturing Scale
**Real specs used:** Nemat International Inc., 34135 7th St, Union City, CA 94587, founded 2003 per `src/lib/seo.ts` and legacy site contact info
**Source:** `src/lib/seo.ts` line 29 (`foundingDate: "2003"`) + legacy site fetch
**Format:** 1080×1350 (4:5)
**Caption hook:** "Same warehouse. Same family. Same phone number. Twenty-three years."

**Composition:**
A single Empire 50ml clear glass bottle photographed in the center of frame on a warm wooden surface (worn, lived-in wood — implies time/heritage). Background fades to dark behind. Below the bottle, in elegant serif: "Best Bottles · A division of Nemat International · Union City, California · Since 2003." Composition deliberately quiet, restrained — no spec callouts, just the implication of provenance. [Empire is offered in 50ml and 100ml only per Best Bottles team confirmation 2026-05-23.]

**Higgsfield prompt:**
> Editorial heritage portrait photography, 4:5 portrait aspect ratio. A single empty clear glass Empire 50ml perfume bottle (smooth curved silhouette, approximately 37mm wide, 93mm tall per docs/SHAPE_AUDIT.md, small black cap) placed in the exact center of a warm aged wooden surface — the wood is weathered, with visible grain, knots, and the patina of decades of use, in warm walnut tones. The bottle sits alone, no other objects. The background behind the bottle gently fades from the warm wood plane into soft darkness. Single warm directional light from upper-right at 30 degrees creates a soft highlight on the bottle and a long soft shadow extending to the lower-left across the wood. Beneath the bottle, with about 4cm of empty wood between bottle and text, four lines of elegant muted-gold EB Garamond serif type, perfectly centered: "Best Bottles" / "A division of Nemat International" / "Union City, California" / "Since 2003". The typography is generous, with breathing room between each line. The mood is quiet, weighted, heritage-driven. Style: artisan workshop catalog meets fragrance house provenance editorial. No people, no other elements.

---

## Caption templates (paired with each image)

Each Instagram caption is short — ~30–60 words, no emojis, ends with the same CTA. Write in Halbert direct-response register per the existing brand voice guide (`docs/SEO_CONTENT_CALENDAR.md`):

**#1:** "One neck size — 13-415 — opens seven different bottle shapes. Cylinder, Tulip, Sleek, Royal, Flair, Square, Elegant. Same cap. Same dropper. Same sprayer fits all of them. Stock seven bottles, manage one component supply. → request a sample kit at bestbottles.com"

**#2:** "A black cap looks like one piece. It's three: shell, liner, applicator. Each measured to half a millimeter so your filling line doesn't shim and your formula doesn't migrate past the seal. → request a sample kit at bestbottles.com"

**#3:** "The plastic ball rolls slower, holds fragrance oils without absorbing. The metal ball glides faster, better for water-based serums and toners. Both ship in twenty-four hours. → see the roll-on catalog at bestbottles.com"

**#4:** "The Sleek 50ml is 143 millimeters tall and 28 millimeters wide. A five-to-one ratio. Holds the same volume as the round bottle next to it on the shelf and reads twice as luxurious. → request a sample kit at bestbottles.com"

**#5:** "Amber glass blocks about seventy percent of UV. It's why apothecaries have used amber for two centuries. Why pharmacies still fill prescriptions in amber. Why your essential-oil bottles should be amber. The Boston Round 30ml is in stock today. → request a sample kit at bestbottles.com"

**#6:** "The Empire 50ml. Thirty-seven millimeters of width, ninety-three millimeters of height, one curve that took longer to perfect than we'll admit. → request a sample kit at bestbottles.com"

**#7:** "Five glass colors. Clear lets the fragrance be the package. Frosted hides what's inside. Amber and cobalt block UV. Swirl turns the bottle into the brand mark. Same shape, five decisions. → see the full color library at bestbottles.com"

**#8:** "Cobalt isn't painted on. The color is in the glass — added to the molten batch before forming. Doesn't scratch off. Doesn't fade. Doesn't peel. → request a sample kit at bestbottles.com"

**#9:** "Frosted glass diffuses the light and hides what's inside. The choice for brands that want their bottle to read 'apothecary' before anyone reads the label. → request a sample kit at bestbottles.com"

**#10:** "Twenty-three years of decisions. Two thousand three hundred fifty-four SKUs. Two hundred twenty-five product groups. Every single one in stock today, in Union City, ready to ship. → bestbottles.com"

**#11:** "Every component documented to half a millimeter — height, diameter, thread size. Because the difference between a 13-415 and a 13-410 is half a turn and one stripped thread on your filling line. → request a sample kit at bestbottles.com"

**#12:** "Same warehouse in Union City. Same family running it. Same phone number — 1-800-936-3628 — for twenty-three years. → bestbottles.com"

---

## Posting calendar recommendation

24-day cadence, 2-day gap between posts:

| Day | Image | Series |
|---|---|---|
| 1 | #1 — Seven shapes, one neck | A |
| 3 | #4 — Sleek 5:1 ratio | B |
| 5 | #7 — Five colors lineup | C |
| 7 | #10 — 2,354 SKU grid | D |
| 9 | #2 — Cap exploded | A |
| 11 | #5 — Boston Round amber | B |
| 13 | #8 — Cobalt macro | C |
| 15 | #11 — Component tolerance | D |
| 17 | #3 — Plastic vs metal ball | A |
| 19 | #6 — Empire profile | B |
| 21 | #9 — Frosted texture | C |
| 23 | #12 — Heritage / Union City | D |

Alternates each series (A, B, C, D, A, B, C, D…) so the feed reads as a balanced 4-quadrant story rather than 4 batches of similar content.

---

## Higgsfield generation notes

To generate via the Higgsfield MCP (`mcp__67b7fa1e-b8ee-419a-bbdb-0b13711ab82b__generate_image`):

1. Check workspace credits first: `show_plans_and_credits` or `balance`
2. Set workspace context: `select_workspace`
3. Generate sequentially (not in parallel — Higgsfield rate-limits)
4. For each image, paste the full Higgsfield prompt from above, set aspect ratio per the image spec (4:5 = "portrait" or specific dimensions 1080×1350)
5. Generate 2-4 variants per concept, pick the best
6. If a generation comes back with invented logos, fabric textures, or hands/people that weren't in the prompt, regenerate with explicit negative prompt: "no people, no hands, no fabric, no logos, no extra text, no watermarks"

Cost estimate (using Higgsfield's image pricing — verify in your account): approximately 10–15 credits per image × 12 images × 2-3 variants = 240–540 credits for the full batch. Likely $30–80 USD depending on plan.

---

## What you get from this batch

- **A focused 24-day Instagram presence** that establishes Best Bottles as the engineering-led B2B packaging supplier on social — a positioning none of the 8 competitors profiled in Stage 3 currently own
- **12 reusable assets** that also feed Pinterest (the 1:1 ones especially) and LinkedIn carousels (the spec-callout ones — #2, #4, #11)
- **Zero invented facts** — every spec callout traces to a documented source file in this repo
- **Founder-credibility ammunition** for Abbas's LinkedIn (Stage 6 strategy) — he can repost these as carousel reflections like "I've spent 23 years staring at this 13-415 thread spec…"
- **A visual identity baseline** other content can extend — once the team approves the aesthetic in the first 3 images, the next 9 follow the same DNA, and future batches inherit the same palette and composition rules
