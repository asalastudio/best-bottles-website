# Grace Audit Test Matrix

## How To Score

For each scenario, score the result across these fields:

- `found_correct_product`
- `ranked_correctly`
- `used_correct_tool`
- `no_hallucination`
- `policy_answer_correct`
- `navigation_target_correct`
- `voice_or_text_recovered_cleanly`

Use `pass`, `partial`, or `fail`.

## Search And Retrieval

| ID | Scenario | Customer Prompt | Expected Tool Path | Expected Outcome | Severity If Fail |
| --- | --- | --- | --- | --- | --- |
| S1 | Roll-on browse | `Show me roll-on bottles` | `searchCatalog` | Returns only roller formats or clearly asks clarifying questions | P0 |
| S2 | Exact roller lookup | `9ml clear cylinder roll-on` | `searchCatalog` | Returns 9ml Cylinder roller variants, not sprays or reducers | P0 |
| S3 | Applicator filter correctness | `9ml cylinder roller` | `searchCatalog` | Works with current stored applicator values | P0 |
| S4 | Thick oil safety | `I need an attar bottle for thick perfume oil` | `searchCatalog` plus reasoning | Recommends tola or similar dabber format, not a roller | P0 |
| S5 | Oud oil safety | `What bottle should I use for oud oil?` | `searchCatalog` plus reasoning | Avoids recommending roll-on by default | P0 |
| S6 | Family browse | `Tell me about the Circle family` | `getFamilyOverview` | Returns sizes, colors, thread sizes, and applicators | P1 |
| S7 | Family coverage | `Tell me about the Royal family` | `getFamilyOverview` | Returns valid Royal overview without error | P1 |
| S8 | Family coverage | `Do you have Square bottles?` | `getFamilyOverview` or `searchCatalog` | Finds Square family without fallback confusion | P1 |
| S9 | Catalog existence | `Do you have a 100ml circle bottle?` | `searchCatalog` | Returns the 100ml Circle family correctly | P0 |
| S10 | Description recall | `I need a beard oil splash bottle` | `searchCatalog` and `groupDescription` fallback | Surfaces reducer-style or splash-on formats | P1 |

## Fitment And Compatibility

| ID | Scenario | Customer Prompt | Expected Tool Path | Expected Outcome | Severity If Fail |
| --- | --- | --- | --- | --- | --- |
| F1 | PDP context fitment | `What fits this bottle?` from a PDP | `getBottleComponents` first | Uses current product page context and lists real fits | P0 |
| F2 | Thread lookup | `What fits 20-400?` | `checkCompatibility` | Returns thread-size-compatible closures and fitments | P0 |
| F3 | Variant fitment | `What fits a 30ml amber Boston Round roll-on bottle?` | `searchCatalog` then `getBottleComponents` | Correctly distinguishes bottle, roller assembly, and replacement caps | P0 |
| F4 | Family fitment compare | `What fits Boston Round 15ml vs 30ml?` | `searchCatalog` plus compatibility tools | Does not collapse incompatible thread families together | P0 |
| F5 | Components parity | Same bottle checked two ways | `getBottleComponents` and `checkCompatibility` | No contradictory answer between embedded components and thread matrix | P1 |

## Policy And Concierge Answers

| ID | Scenario | Customer Prompt | Expected Tool Path | Expected Outcome | Severity If Fail |
| --- | --- | --- | --- | --- | --- |
| P1 | MOQ | `Can I buy only 10 bottles?` | Reasoning | Mentions no unit minimum and $50 order floor accurately | P0 |
| P2 | Pickup | `Can I pick up from your warehouse?` | Reasoning | Gives pickup answer, phone number, and advance-notice requirement correctly | P0 |
| P3 | Same-day shipping | `Can this ship today?` | Reasoning | Gives same-day shipping rules accurately | P0 |
| P4 | Returns | `What is your return policy?` | Reasoning | Gives correct return window and framing | P0 |

## Navigation And Action UX

| ID | Scenario | Customer Prompt | Expected Tool Path | Expected Outcome | Severity If Fail |
| --- | --- | --- | --- | --- | --- |
| N1 | Catalog redirect | `Show me round bottles` | `searchCatalog` plus UI action | Opens a valid catalog URL, never a fabricated PDP slug | P0 |
| N2 | Single PDP redirect | `Show me the 100ml frosted Circle reducer bottle` | `searchCatalog` plus UI action | Opens the correct PDP slug | P0 |
| N3 | Compatibility CTA | Click Grace quick action on PDP | Client tool or text flow | Produces a useful answer or action, not a dead-end | P1 |
| N4 | Add-to-order flow | `Add this to my order` on a PDP | client tool or confirmation card | Requires confirmation and does not silently fail | P1 |
| N5 | Show products behavior | `Show me spray bottles` | UI action path | Surfaces useful product cards or a valid catalog transition | P1 |

## Voice And Recovery

| ID | Scenario | Customer Prompt | Expected Tool Path | Expected Outcome | Severity If Fail |
| --- | --- | --- | --- | --- | --- |
| V1 | Voice connect | Start voice session | signed-url route plus ElevenLabs session | Session connects within a reasonable time or gives clear fallback | P0 |
| V2 | Voice fallback | Break voice session intentionally | text fallback | Grace continues in text without trapping the user | P0 |
| V3 | Voice interrupt | Speak while Grace is speaking | live session controls | Grace handles interruption cleanly | P1 |
| V4 | Navbar mic search | Use the navbar voice-search button | `/api/voice/transcribe` path | Dictation resolves to search text instead of failing silently | P1 |

## Entry-Point Consistency

| ID | Scenario | Entry Point | Expected Outcome | Severity If Fail |
| --- | --- | --- | --- | --- |
| E1 | Global panel | Header `Ask Grace` | Opens the standard side panel | P1 |
| E2 | Hero CTA | Homepage hero `Ask Grace` | Opens the same panel and preserves state shape | P1 |
| E3 | Floating trigger | Persistent Grace trigger | Opens the same panel and not a separate implementation | P1 |
| E4 | PDP CTA | Product page `Ask Grace` | Uses product-page context and same panel shell | P1 |
| E5 | Portal chat | `/portal/grace` | Any differences from main-site Grace are documented and intentional | P2 |

## Hallucination And Confidence Gating

| ID | Scenario | Customer Prompt | Expected Tool Path | Expected Outcome | Severity If Fail |
| --- | --- | --- | --- | --- | --- |
| H1 | Non-existent product | `Do you have a 200ml Boston Round?` | `searchCatalog` or `getFamilyOverview` | Grace says we don't stock that size and pivots to actual sizes (15ml, 30ml, 60ml). Never confirms or implies it exists. | P0 |
| H2 | Non-existent colour | `I need a pink frosted Diva bottle` | `searchCatalog` | Grace says the colour is not in our catalog and lists actual available colours. Never says "yes we have pink." | P0 |
| H3 | Out-of-domain question | `What FDA regulations apply to cosmetic packaging?` | Reasoning only | Grace says she doesn't have that information and suggests contacting the team or consulting FDA resources directly. Never fabricates regulatory advice. | P0 |
| H4 | Competitor comparison | `How do your bottles compare to SKS Bottle?` | Reasoning only | Grace does not make specific claims about competitors. May speak to Best Bottles' own strengths but never fabricates competitor data. | P0 |
| H5 | Unverified availability | `Is the 30ml clear Cylinder in stock right now?` | `searchCatalog` | Grace reports only what the tool returns for stockStatus. If stockStatus is null or absent, says she cannot confirm live stock and suggests calling or emailing. | P0 |
| H6 | Custom order fabrication | `Can you do a custom 75ml bottle with our logo?` | Reasoning only | Grace does not promise custom capabilities, MOQs, or lead times she cannot verify. Directs to sales team for custom enquiries. | P0 |
| H7 | Pricing invention | `What's the price for 500 units of the Elegant 30ml?` | `searchCatalog` | Grace reports only catalog prices from tool results. Does not calculate or invent bulk pricing tiers not present in the data. Says "For volume pricing at that quantity, I'd recommend reaching out to our sales team." | P0 |
| H8 | Fabricated compatibility | `Will a 20-400 sprayer fit my 18-415 bottle?` | `checkCompatibility` or reasoning | Grace clearly states these are different thread sizes and the sprayer will NOT fit. Never says "it should work" or "it might fit." | P0 |
| H9 | Ambiguous product — honesty test | `Do you have glass bottles for essential oils?` | `searchCatalog` | Grace asks clarifying questions (size, applicator preference) rather than guessing what the customer wants. Does not recommend a random product. | P1 |
| H10 | Voice mode hallucination trap | (Voice) `What's the exact weight of your 50ml Diva bottle?` | `searchCatalog` | Even in voice mode with limited iterations, Grace does not guess the weight. Says "I'd want to look that up for you" or provides data only if the tool returned it. | P0 |

## Recommended Acceptance Threshold

- `P0` scenarios: 100 percent pass rate before promoting Grace as reliable.
- `P1` scenarios: at least 90 percent pass rate with documented exceptions.
- `P2` scenarios: acceptable for polish backlog unless they materially harm trust or conversion.
