# Best Bottles — Brand Voice Guardrails

**Status:** Authoritative · Override any guidance in other audit documents
**Last updated:** 2026-05-23

This doc captures non-negotiable brand-voice rules for **all** Best Bottles content — Instagram captions, blog posts, PDP copy, ad copy, social posts, sample-request emails, anything customer-facing. Every other strategy doc in this audit must comply with these rules.

---

## 🚫 Never reference

### Alcohol / spirits / haram beverages
Best Bottles / Nemat International is a **Muslim-owned brand**. Content must never reference whisky, whiskey, bourbon, scotch, beer, wine, champagne, vodka, gin, rum, tequila, liquor, spirits, cocktails, breweries, distilleries, or any alcohol-adjacent comparison — even when the comparison is technically about glass color, UV protection, or packaging history.

**Banned phrases include but are not limited to:**
- "Same reason whisky bottles are amber"
- "Aged like a fine wine"
- "Spirits-grade glass"
- "Beer bottle brown"

**Use instead (for amber glass / UV protection talking points):**
- "The same reason apothecaries have used amber for two centuries"
- "Why pharmacies still fill prescriptions in amber"
- "The medical-grade standard for photo-sensitive contents"
- "Used in laboratory and pharmaceutical packaging for 150+ years"
- "The choice for essential oils, vitamins, supplements, photo-sensitive serums"

### Other categories to avoid in customer-facing content
- Pork, lard, gelatin (if discussing material/lid manufacturing — verify no pork-derived components)
- Gambling / lottery metaphors
- Religious holiday references that aren't shared (no Christmas-specific imagery in feed unless explicitly approved)
- Anything that culturally clashes with a Muslim-owned, family-run, multi-generational supplier serving global brands

---

## ✅ On-brand reference points (always safe)

### For glass / packaging history and authority
- Apothecary tradition (1700s–1800s)
- Pharmaceutical packaging (still the standard for amber bottles today)
- Laboratory glassware (Boston Round is literally laboratory-derived)
- Perfume and fragrance heritage (Best Bottles' core market)
- Wellness, aromatherapy, essential oils
- Personal care, beauty, skincare

### For brand heritage
- Nemat International — parent company, family-run, founded 2003
- Union City, California — Bay Area HQ since founding
- Multi-generational supplier (Abbas Nematullah leads)
- 23 years in business (as of 2026)
- 2,354 SKUs, 225 product groups — methodical scale
- B2B partnership model — bottles as the brand's first impression

### For product positioning
- "Muted Luxury" (per brand brain v2.0)
- "The vessel is as vital as the scent it holds" (core philosophy)
- Curated selection from world-class glassmakers
- Flexible MOQs (we serve indie founders AND established brands)
- Custom design partnership for brands that need it

---

## Voice register

### Per the existing SEO_CONTENT_CALENDAR.md, three copywriting traditions are in rotation:

- **Gary Halbert** — direct-response. Problem → emotional stakes → specific solution → CTA. Used for decision-stage and ad copy.
- **David Ogilvy** — authority + narrative. Long-form credibility. Specific facts, confident, never boastful. Used for brand-story and technical-authority pieces.
- **Eugene Schwartz** — desire amplification. The reader already wants what we sell; the copy channels their existing desire. Used for aspirational posts targeting scaling brands.

### Tone consistencies across all three:
- Sentences average 8–15 words
- Specific numbers over hedge phrases ("17-415 neck" not "the right size")
- Active voice
- No emojis in body copy (✅ ❌ allowed in admin/internal docs only)
- No "we believe" hedging — state facts
- No "elevate your brand" / "take it to the next level" empty B2B clichés

---

## How this doc gets enforced

1. Every new caption, blog post, ad, or social piece is screened against the 🚫 list before publishing
2. The Instagram overlay script (`pipeline/instagram-overlays/concepts.json`) is the source-of-truth for caption text — any banned phrase that appears there gets rejected at render time (future addition: lint pass before render)
3. Audit deliverables that referenced banned content have been corrected as of 2026-05-23 (see `BRAND-VOICE-GUARDRAILS-CHANGELOG.md` if/when more corrections needed)

---

## Changelog

- **2026-05-23 — Initial creation.** Triggered by founder feedback that "whisky" comparison in Image #3 caption was inappropriate for a Muslim brand. Audit-wide search-and-replace completed across `instagram-image-batch-12.md` (3 references) and `pipeline/instagram-overlays/concepts.json` (1 reference). Image IG-CYL9ML-03-amber-uv-protection.png re-rendered with apothecary framing.
