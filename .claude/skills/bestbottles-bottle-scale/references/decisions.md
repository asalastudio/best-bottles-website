# Decisions and history: bottle sizing (to 2026-09-16)

Newest first. Quotes are Jordan's words.

## 2026-09-16

**Measurements review prepared for Jordan's boss.** Jordan planned to email it with a drafted note; whether it went out is not recorded here. Production Convex snapshot, 2,269 live container SKUs grouped into
108 glass bodies. 19 glasses flagged: 15 with SKUs that disagree, 3 impossible heights (Cylinder 30 ml tube
GBSpry1ozGl 50.8 × 42 mm; Apothecary 118 ml at 52.2 mm; Lotion Bottle 3 ml at 118 mm) and 1 with blank SKUs (25 ml
Cylinder, 30 of 45). Review copy built so every glass has one place to answer, with the issues on a red tab:
"make it glaringly obvious, like with a separate tab, the issues that need to be sorted through."

**Universal scale card v1: proposal, not approved.** Asked for: "a proper scale card that's universal, that we could
look at and just tag each bottle moving forward." Rule: bare glass height in mm (Convex heightWithoutCap, foot to
rim) sets how tall the glass stands on the 1560 × 1716 card, foot on the 91 % baseline. Tag = nearest 10 mm
(S20…S200). PCHIP curve through (mm → glass %): 20 → 23.0, 40 → 33.0, 68 → 46.7 (Boston 15, locked), 78 → 52.4 (Boston
30, locked), 106 → 65.5 (9 ml Slim ≈ 1.4× the 9 ml Classic), 117 → 68.0 (50 ml Cylinder a little above the Slim),
154 → 74.0 (100 ml frame limit), 195 → 80.0 (tallest glass). If approved, full glass changes: Cylinder 5 ml −18 %,
9 ml Classic −10 %, 28/25 ml −4/−3 %, 50 ml roller +6 %, Slim +7 %, 50 ml +7 %, 100 ml −1 %, vials +6 %; Boston
15/30 unchanged, 60 ml −3 %. Example on the real card: 9 ml Clear Cylinder Roll-On, 53.8 % today → S70 47.8 %.

**Why families need one measure.** Cylinder is locked by glass shoulder %, Boston by full glass %. Converted, they
disagree: Cylinder 9 ml (70 mm) draws 53.2 % while Boston 15 ml (68 mm) draws 46.7 %; Boston 60 ml (94 mm) draws
62.4 % while the Cylinder 50 ml roller (98 mm) draws 59.1 %.

**9 ml Slim vs 9 ml Classic vs 50 ml.** Jordan saw the Slim sprayer, Slim roller and the Classic cobalt lotion pump
level in the grid: "Why is the 9 ml tall the same as the 9 tall roller, the same as the 9 ml lotion pump?" Not a
bug: the Classic's glass was 20 % shorter, but the pump head closed the gap. Option with the Slim back at 62.5 %
("This is accurate, but the 50 ml cylinder would have to be maybe 2% taller, or we just leave it the way it is").
The 50 ml Cylinder can rise at most to 62.5 % (its atomizer bulb meets the top margin); raising both was mocked.
**Decision: leave it as it is** (Slim 54.1 %, 50 ml 56 %).

**Cylinder lock amendment (approved, merged to main via PR #179).** Checked bottle to bottle against Jordan's true-scale lineup
(5 ml 53, 9 ml 70, 28 ml 81, 50 ml roller 98, 9 ml Slim 106, 25 ml 83, 50 ml 117, 100 ml 154 mm; "not exact geometry,
just the visual scale"; "we'd have to account for roller balls, fitments"). Four bodies moved onto the lock's own
progression through 5/9/50/100 (`shoulder % = 3.965 × mm^0.56`): 28 ml 50.5 → 46.5, 25 ml 46.5 → 47.2, 50 ml roller
56 → 51.8, 9 ml Slim 62.5 → 54.1. "It's actually just right. The top of the 9 ml slim tall is at the stop at the
shoulder of the 50 ml cylinder." The two no-PSD Slim photographs were scaled onto the same line.

**Colour of Sunburst renders.** "The sunburst rendering is discoloring the image." Matte silver came out 12–57 levels
darker than the PSD; matte gold went pale. First fix, a per-channel brightness lift, was rejected: "The 100 ml
reducer cap looks like it's going to rub off", "the silver on that also looks a little strange", "Make sure you're
using Sunburst 2.5." What works: COLOUR and HARDWARE clauses in the prompt (matte silver = light satin anodised
aluminium, not chrome, no visible threads; matte gold = pale champagne satin) and re-render. Atomizer collars need
the hardware clause or they come back as threaded chrome.

**25 ml and cap-off.** The six 25 ml Cylinder SKUs render from the 30 ml masters the lock aliased for them. "The 100 ml
needs to be rendered without the cap on to show the spray". The base builder had matched the "Capped & Uncapped"
folder name and picked capped PSDs.

**Back to the lock.** After a fitted curve and a proposed "glass band 42–70 % of the canvas" made bottles 15–20 %
smaller than approved: "I thought we had created an official scaled plan… We already normalized the height for the
individual bottles. Why are we doing this now?" Sizes restored to the 2026-09-07 lock.

**Shoulder, not cap.** "The bottles need to line up by the glass shoulder, not by the top of the cap."
heightWithoutCap is the bare glass (70 mm for the 9 ml sprayer, roller and pump alike).

## 2026-09-12 and 2026-09-07

- **Boston Round standards locked** (09-12): 15 ml 46.7 %, 30 ml 52.4 %, 60 ml 62.4 % full glass, shared across clear,
  amber and cobalt.
- **Cylinder family locked** (09-07): "Call cylinder bottles look perfect. Let's lock it in." Per-body glass-shoulder
  % with the foot on the 91 % baseline: 3.3 ml 26.5, 4 ml 31.5, 5 ml 36.5, 9 ml 43.5, Tall 9 ml 62.5, 25 ml 46.5,
  28 ml 50.5, 30 ml 46, 50 ml 56, 100 ml 67.5 (clearance-limited), plastic 4/8/16 oz 49.5/63/71.5.
