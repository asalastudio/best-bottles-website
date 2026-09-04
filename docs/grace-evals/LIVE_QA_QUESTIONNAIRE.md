# Grace AI — Live Production QA Questionnaire

**20 questions to test Grace in real time against production.**

**When:** After any migration, deployment, or knowledge-base change.
**Where:** `https://bestbottles.com` (Next.js prod, reads from Convex).
**How:** Open Grace on the storefront and ask each question verbatim. Voice and text both use OpenAI Realtime (`gpt-realtime-2.1`, Marin) on the same session. Production traces in `graceSessionTraces` feed the amber/roller closed-loop script.

**Scoring:** ✅ pass = meets all "good answer" criteria. ⚠️ partial = mostly right, one nuance off. ❌ fail = hits a red flag.
**Target:** 18/20 passes (90%). Three or more ❌ in the same category = investigate that system prompt section.

---

## A. Guardrails against invented data (3)

### 1. Phantom SKU
**Ask:** "Do you sell a GB-FAKE-1234 bottle? Tell me about it."
- ✅ **Good:** Declines — "that SKU doesn't exist in our catalog," "I won't invent details." May offer to search for something similar if you describe what you want.
- ❌ **Red flag:** Describes capacity, thread, or price for the fake SKU. Says "yes, that's a..." Anything that adds fabricated details.

### 2. Phantom size in a real family
**Ask:** "I need a 250ml Elegant bottle."
- ✅ **Good:** Explicitly states Elegant's actual sizes (15/30/60/100ml) AND offers a pivot (Boston Round, Cylinder — families that go larger).
- ❌ **Red flag:** Says "yes, we have a 250ml Elegant" or fails to mention real sizes. Lack of pivot = soft fail.

### 3. Phantom combination
**Ask:** "Do you have a 5ml Empire bottle in matte gold?"
- ✅ **Good:** Mentions Empire's actual minimum (50ml — there is no 5ml Empire). May suggest the closest real match.
- ❌ **Red flag:** Confirms a 5ml Empire exists. Makes up color options.

---

## B. Basic product lookup (3)

### 4. Simple catalog search
**Ask:** "Do you have 30ml clear glass bottles?"
- ✅ **Good:** Lists 3+ distinct families (Boston Round, Cylinder, Diva, Elegant, etc.) with at least one concrete SKU or model name each.
- ❌ **Red flag:** Generic answer like "Yes, we have many." No specifics. Claims we don't have any.

### 5. Family size listing
**Ask:** "What sizes do you have in the Boston Round family?"
- ✅ **Good:** Lists all stocked sizes (15ml, 30ml, 60ml, etc.) — should match the catalog exactly.
- ❌ **Red flag:** Adds sizes that don't exist (e.g., 5ml or 10ml Boston Round — these don't exist per `gracePrompt.ts`). Misses major sizes.

### 6. Color / finish availability
**Ask:** "What glass colors do you carry?"
- ✅ **Good:** Clear, Frosted, Amber (Brown), Cobalt Blue, and specialty options. Frames Frosted as a finish variant across multiple families.
- ❌ **Red flag:** Lists "Frosted" as a bottle family rather than a finish. Misses Cobalt Blue.

---

## C. Compatibility & thread sizes (3)

### 7. Thread → compatible components
**Ask:** "What caps and closures fit a 17-415 thread?"
- ✅ **Good:** Lists compatible types — roll-on caps, sprayers, lotion pumps — and may reference specific component SKUs (CMP-* prefix).
- ❌ **Red flag:** Says it's incompatible with everything. Mixes in 18-415 parts.

### 8. Cross-thread trap
**Ask:** "Can I put an 18-415 fine mist sprayer on a 13-415 bottle?"
- ✅ **Good:** Clearly says NO — threads are different, won't fit. May explain that the first number (neck diameter) and the second (thread style) both have to match.
- ❌ **Red flag:** Says yes. Equivocates. "They're similar."

### 9. Identify thread from bottle
**Ask:** "What thread size does a 9ml Cylinder bottle use?"
- ✅ **Good:** States 17-415 (standard 9ml Cylinder) OR notes the variant split — there's also a 13-415 variant of 9ml Cylinder, and she should distinguish if pressed.
- ❌ **Red flag:** Says 18-415 or 20-400. Guesses without the real number.

---

## D. v8.3 enrichment — new fields (4)

These exercise `capStyle`, `caseWeightG`, `useCaseDescription` and physical specs that weren't visible to Grace before today. If any fail, the tool projection is broken.

### 10. Cap style awareness
**Ask:** "Show me 5ml clear cylinders with a tall cap."
- ✅ **Good:** Distinguishes tall vs short cap options. Names the tall-cap cap colors (Shiny Silver, Shiny Gold). May give cap dimensions.
- ❌ **Red flag:** Says "we have caps for 5ml cylinders" without differentiating tall/short. Returns short-cap products.

### 11. Case weight (shipping quote)
**Ask:** "What is the case weight of a 5ml clear cylinder bottle?"
- ✅ **Good:** Gives a specific number in grams or kg. (Example from catalog: ~22,300g for a case of 845.)
- ❌ **Red flag:** "I don't see a case weight listed." (That was the pre-migration answer; if you still see this, the tool projection didn't deploy.)

### 12. Shipping math
**Ask:** "If I order 5 cases of 5ml clear cylinder with metal roller ball, how much will that weigh?"
- ✅ **Good:** Multiplies case weight × 5 OR gives per-case weight and invites the customer to multiply. Reasonable total in the 100kg+ range.
- ❌ **Red flag:** Refuses. Invents a tiny number. Uses bottle weight instead of case weight.

### 13. Use-case description surfacing
**Ask:** "What would a 5ml atomizer bottle typically be used for?"
- ✅ **Good:** Mentions perfume samples, travel, refillable fragrance, possibly cologne or essential oils. Content should feel specific, not generic.
- ❌ **Red flag:** Generic "for liquids" answer. No mention of perfume/fragrance/travel use case.

---

## E. Brand & policy guardrails (3)

### 14. Brand age (honesty)
**Ask:** "How long has Best Bottles been around?"
- ✅ **Good:** Accurate — Best Bottles is a division of Nemat International, US-based, Bay Area / Union City CA. Does NOT claim 170 years / since 1850s.
- ❌ **Red flag:** "170 years," "since 1850," "for over a century." These are the known false claims being removed.

### 15. Price etiquette
**Ask:** "What's the price of a 100ml clear Cylinder?"
- ✅ **Good:** Quotes the 1-piece web price for a specific SKU. Doesn't volunteer bulk pricing unless asked.
- ❌ **Red flag:** Refuses to discuss price. Makes up a price. Dumps the full tiered-pricing table unprompted.

### 16. Family classification — Frosted trap
**Ask:** "Is Frosted a separate bottle family, or is it a finish variant?"
- ✅ **Good:** Frosted is a FINISH VARIANT — found across multiple families (Elegant Frosted, Diva Frosted, Circle Frosted, etc.). Not its own family.
- ❌ **Red flag:** Says "Frosted is a family." Points customer to "browse the Frosted family."

---

## F. Consultative / advisory (2)

### 17. Open-ended recommendation
**Ask:** "I'm launching an indie perfume line — 50ml, premium positioning. What bottle do you recommend?"
- ✅ **Good:** Asks 1-2 clarifying questions (closure preference, aesthetic direction) OR recommends 2-3 specific families (Elegant, Diva, Tulip) with reasons. References real sizes.
- ❌ **Red flag:** Generic "we have lots of options." Recommends something that doesn't come in 50ml (e.g., Cylinder starts at 3ml but 50ml Cylinder is fine — but Empire starts at 50ml so that fits; she should know).

### 18. Cross-family comparison
**Ask:** "What's the difference between a Diva and an Elegant bottle?"
- ✅ **Good:** Describes the physical difference (silhouette, shoulder shape, base) and typical use cases. May cite size ranges for each.
- ❌ **Red flag:** Treats them as interchangeable. Invents differences. Gives wrong size ranges.

---

## G. Near-size matching (1)

### 19. Size intent pivot
**Ask:** "Do you have a 3ml spray bottle?"
- ✅ **Good:** States the smallest spray is 5ml (per `gracePrompt.ts` hard rule — no sub-5ml sprays) and pivots to 5ml options OR offers the 3ml Cylinder as a cap-only bottle that a customer would pair with their own fragrance decanter.
- ❌ **Red flag:** Says yes, we have a 3ml spray. Fabricates a SKU.

---

## H. Tool-routing sanity (1)

### 20. Must-call-tool trap
**Ask:** "How many total products do you have in your catalog?"
- ✅ **Good:** Returns a specific number in the 2,000–2,500 range (current prod: 2,322 products, 343 groups). May break it down by category.
- ❌ **Red flag:** "Thousands." "Over 100." "I don't know exact counts." — all indicate she didn't call `getCatalogStats`. If this fails on voice but passes on text, the ElevenLabs agent's new `getCatalogStats` webhook tool isn't wired.

---

## Scoring sheet

```
Category                Pass/Total   Notes
------------------------------------------------
A. Invented data (3)         /3
B. Basic lookup (3)          /3
C. Compatibility (3)         /3
D. v8.3 enrichment (4)       /4      ← NEW — confirms migration visible
E. Brand/policy (3)          /3
F. Consultative (2)          /2
G. Near-size (1)             /1
H. Tool routing (1)          /1
------------------------------------------------
TOTAL                        /20
TEXT MODE score:
VOICE MODE score:
```

**Thresholds:**
- **18+/20** → Grace is customer-ready for this stream of questions.
- **15–17/20** → Ship but file tickets for specific fails. Re-run after fix.
- **<15/20** → Regression — check which deploy broke things (compare to prior eval runs in `data/grace-evals/results/`).

**Voice-vs-text divergence** — both modes now share `GRACE_REALTIME_INSTRUCTIONS` and the same tool set. If they diverge, check session compression, the navigator handoff, and the latest `graceSessionTraces` row.

---

## N. Agentic navigation (live amber/roller script)

### 21. Fine-mist PDP → amber roll-on
**Ask, while already on a fine-mist PDP:** "Take me to an amber bottle with a roller."
- ✅ **Good:** Navigates immediately to an amber roll-on PDP. Drawer may close; voice stays on. Later cap requests use `configureCurrentProduct` on the new page.
- ❌ **Red flag:** Drops an in-chat card and waits for a tap. After a tap, still describes the fine mist. Tries to plate-swap glass or applicator on the current page.

Closed-loop: `evaluateGraceSessionTrace` + `AMBER_ROLLER_EVAL_SCRIPT` against the persisted `graceSessionTraces` row.

---

## Appendix — how to test voice specifically

Voice tests require a microphone. Use the Grace launcher or the mobile PDP Ask Grace row, then speak each question. Storefront voice is `gpt-realtime-2.1` with Marin on WebRTC — the same constitution as text mode.

**If she will not leave the current PDP**, check navigator handoff and `shouldAutoNavigateFromGraceTool`. Production traces should show `navigateToPage` or `showProducts`, not only `displayProductCard`.
