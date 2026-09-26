"""Words for "Working with the range", the reference part of the catalogue's house edition.

Every line here restates a rule already written down elsewhere, so the book never says more than the
sources do:
- docs/specs/pdp-item-descriptions/RUBRIC.md        uses, guards, care lines, size bands, claims
- docs/specs/pdp-item-descriptions/COPY-STRATEGY.md titles, vocabulary, words never used, claims policy
- docs/specs/pdp-item-descriptions/SYNTHESIS.md     neck systems, fit rules, data fixes
- data/register/source/neck-thread-2026-09-23/     the neck sheets (stems, count rules, exceptions)

No prices, no stock, no country of origin (undecided; COPY-STRATEGY.md §7.4), and nothing that
reads as a claim. Edit the sources first, then this file.
"""

# Reading an item number: the website SKU, token by token (derived from the 25 Sep 2026 export).
SKU_EXAMPLE = [
    ("GB", "Type", "Glass bottle"),
    ("Cyl", "Family", "Cylinder"),
    ("Amb", "Glass", "Amber"),
    ("9", "Size", "9 ml"),
    ("MtlRoll", "Fitment", "Steel roller ball"),
    ("BlkDot", "Finish", "Black dotted cap"),
]
SKU_TOKENS = [
    ("Type", [("GB", "glass bottle"), ("LB", "bottle sold with a lotion or treatment pump"), ("CJ", "cream jar"), ("PB", "plastic bottle")]),
    ("Family", [("Cyl", "Cylinder"), ("TallCyl", "Tall Cylinder (9 ml, 13-415)"), ("Crcl", "Circle"), ("Elg", "Elegant"),
                ("Slk, Sleek", "Sleek"), ("Slm", "Slim"), ("Diva", "Diva"), ("Emp", "Empire"), ("Bstn", "Boston Round"),
                ("Dmnd", "Diamond"), ("Rnd", "Round"), ("Sqr", "Square"), ("Rect, TallRect", "Rectangle"), ("Grce", "Grace"),
                ("Atom", "Travel atomizer")]),
    ("Glass", [("(none)", "clear"), ("Frst", "frosted"), ("Amb", "amber"), ("Blu", "cobalt blue"), ("Swrl", "swirl")]),
    ("Size", [("9, 30, 100", "millilitres"), ("1oz, 2oz", "Boston Round 30 and 60 ml"), ("1Drm", "1 dram (4 ml) vial")]),
    ("Fitment", [("MtlRoll", "steel roller ball"), ("Roll", "plastic roller ball"), ("Spry", "fine-mist sprayer"),
                 ("Ltn", "lotion or treatment pump"), ("AnSp", "vintage-style bulb sprayer"), ("AnSpTsl", "the same, with tassel"),
                 ("Drp, Dropper", "dropper"), ("Rdcr", "orifice reducer with cap"), ("Cap", "screw cap only"), ("App", "cap with glass rod")]),
    ("Finish", [("Blk, Wht", "black, white"), ("Gl, Sl", "gold, silver"), ("ShnGl, MattSl", "shiny gold, matte silver"),
                ("Cu", "copper"), ("BlkDot", "black dotted"), ("IvyGl", "ivory with a gold collar"), ("Sht, Tall", "short, tall")]),
]
PART_PREFIXES = [
    ("CPRoll, CpRoll", "roll-on cap", "CPRoll13-415SlDot"),
    ("CP", "screw cap", "CP13-415GlSht"),
    ("Spry", "fine-mist sprayer", "Spry18-415ShnGl"),
    ("Ltn", "lotion or treatment pump", "Ltn17-415MattSl"),
    ("AnSp", "vintage-style bulb sprayer", "AnSp18-415Red"),
    ("Drp", "dropper", "Drp20-4001ozWhiteBulb"),
]
GRACE_EXAMPLE = ("GB-CYL-AMB-9ML-MRL-BKDT", ["type", "family", "glass", "size", "fitment", "finish"])

# Confirming a fit (SYNTHESIS.md §1-§4; RUBRIC.md §4.5; the neck sheets' thread rules).
FIT_RULES = [
    ("Same neck finish, exactly.", "13-415 and 13-425 are different; so are 18-400, 18-410 and 18-415. Never say "
     "\"universal\", \"fits most\" or \"fits all 18 mm\"."),
    ("A sold combination is a confirmed fit.", "A dot in a family's fit chart, or a part listed on a product page, is a "
     "combination Best Bottles sells. That is the answer to give."),
    ("A thread match is a starting point, not a promise.", "Before offering a part that is not sold on that bottle, check "
     "the dip-tube length for sprayers and pumps, the stem length for droppers, how a roller insert seats, and the liner."),
    ("Droppers are matched to the bottle.", "Boston Round 15 ml takes the 66 mm stem, 30 ml the 76 mm stem and 60 ml the "
     "90 mm stem. The 9 ml vial on 18-400 takes no dropper."),
    ("Complete sets stay complete.", "The 16 mm and 12 mm Cylinders, the 13-425 and 8-425 vials and the 1 ml plug vials "
     "are sold only with their own parts."),
    ("Own-class bottles keep their own closures.", "Ground-glass stoppers, 20-410 aluminum bottles, travel atomizers "
     "and cream jars are matched to their own bottle."),
    ("The 30 ml Cylinder spray pair is an exception.", "Its sprayer is fixed. The 18-415 label does not bring the "
     "25, 50 and 100 ml Cylinder options with it."),
]
FIT_CHECKLIST = [
    "Find the bottle's neck finish (family guide, sizes table).",
    "Is the part sold on that bottle? Check the fit chart or the product page. If yes, it fits.",
    "If not: is it a shared neck (13-415, 15-415, 17-415, 18-400, 18-415, 20-400)? If no, do not offer it: the bottle takes only its own parts.",
    "Shared neck, not sold together: check tube or stem length and seating before saying yes.",
    "When unsure, sell the bottle with the part already on it.",
]

# Answering common questions (RUBRIC.md §4.2-§4.7; COPY-STRATEGY.md §6).
QUESTIONS = [
    ("Which parts fit my bottle?",
     "Start with the neck finish. The family guide shows every part sold on each size; the fit system pages show "
     "every part made for each shared neck."),
    ("Is it leak-proof? Can I fly with it?",
     "No bottle is described as leak-proof, airtight, spill-proof or TSA-approved. Roll-ons, atomizers and droppers "
     "travel capped and upright. Bulb sprayers and glass stoppers are not travel bottles."),
    ("Can I put perfume oil in a sprayer?",
     "No. Sprayers are for thin liquids only: perfume oil and undiluted essential oil clog them. Oils go in a roller, "
     "dropper, reducer or pour bottle."),
    ("Can I put cream in a pump bottle?",
     "Pumps are for liquids that pour. Thick creams and body butters belong in a jar."),
    ("Steel or plastic roller ball?",
     "Both fit the same bottle and take the same roll-on caps. Customers tend to prefer steel for glide. The ball "
     "alone is not a seal, so carry it capped."),
    ("Does amber glass protect my oil?",
     "Amber reduces the light that reaches the contents. Cobalt blue is a colour; for light-sensitive oils amber "
     "filters more. Frosted is a surface finish, not a light filter."),
    ("Can I refill the bottle?",
     "On thread necks the sprayer or pump unscrews, so the bottle can be refilled. Not on the complete sets or the "
     "30 ml Cylinder with a fixed sprayer."),
    ("Will the dropper reach the bottom?",
     "Use the dropper sold for that size: its stem is matched to the bottle."),
    ("What does a lined cap do?",
     "The liner seals the neck when the cap is on (13-415 lined caps). It is still not described as leak-proof."),
    ("Are heights with the cap on?",
     "No. Heights here are the glass without a cap, in millimetres and inches. Capacities are nominal."),
    ("Can I buy caps and sprayers on their own?",
     "Yes, for the shared necks: see Parts sold separately. Complete sets are sold complete."),
    ("Do you have sample sizes?",
     "Yes: see Samples and small sizes."),
]

# Samples (RUBRIC.md §4.3 size bands; VIAL and DAB cards).
SIZE_BANDS = [
    ("Sample", "5 ml or less, and every vial", "Samples, testers and promotional giveaways lead. The 9 ml glass-rod vial is also a sample vial."),
    ("Small", "6 to 9 ml", "Samples, promotions and travel."),
    ("Purse", "10 to 15 ml", "Decants, promotions and travel. 10 ml is the standard roll-on size."),
    ("Everyday", "25 to 60 ml", "30 ml (1 oz) is the usual size for beard oil and serums."),
    ("Full size", "78 to 128 ml", "Full retail size."),
    ("Stock", "Over 130 ml", "Stock or refills."),
]

# How we name and describe products (COPY-STRATEGY.md §2-§3, §6; TEMPLATE.md).
TITLE_FORMULA = "{Capacity} {Glass} {Family} {Type}"
TITLE_EXAMPLES = [
    ("GBCylAmb9MtlRollWht", "9 ml Amber Cylinder Roll-On Bottle", "Steel Ball, White Cap"),
    ("GBBstnAmb1ozBlkCapSht", "30 ml (1 oz) Amber Boston Round Pour Bottle", ""),
    ("GBCrcl100RdcrPnkLthr", "100 ml Clear Circle Pour Bottle with Reducer", ""),
    ("GBVAmb1DrmWhtCapSht", "1 Dram (4 ml) Amber Vial", ""),
]
TYPE_NOUNS = ["Roll-On Bottle", "Fine-Mist Spray Bottle", "Perfume Spray Bottle", "Vintage-Style Bulb Spray Bottle",
              "Pour Bottle", "Pour Bottle with Reducer", "Dropper Bottle", "Lotion Pump Bottle", "Bottle with Glass Stopper",
              "Sample Vial with Glass Rod", "Vial", "Cream Jar", "Travel Atomizer", "Stock Bottle"]
DESCRIPTION_FORMAT = [
    "Two or three sentences: what it is for, then the one fact that prevents a wrong purchase.",
    "Included: the parts in the box, in the words below.",
    "Fits: the other parts sold for the same bottle.",
    "Glass: one line, only when the glass changes the use (amber).",
    "Good to know: one extra verified fact, if there is one.",
]
UNITS = [
    ("Capacity", "9 ml", "9ml, 9 mL"),
    ("Ounces", "30 ml (1 oz), on Boston Rounds and 4, 8, 12 and 16 oz sizes", "1 oz (30 ml), 1/2oz"),
    ("Neck finish", "18-415; other necks as 16 mm", "18/415, 18mm"),
    ("Glass", "Clear, Frosted, Amber, Cobalt Blue, Swirl", "Flint, Blue alone, Crystal"),
]
VOCABULARY = [
    ("Steel roller ball, plastic roller ball", "metal roller plug, roll-on plug"),
    ("Short lined cap, tall lined cap, lined cap", "metal cap, liner cap, travel cap"),
    ("Short ribbed cap (with a white liner)", ""),
    ("Faux-leather cap", "leather cap"),
    ("Fine-mist sprayer", "perfume spray pump (for this part), microsprayer"),
    ("Lotion pump; treatment pump (9 ml Cylinder)", ""),
    ("Vintage-style bulb sprayer, with or without tassel", "vintage bulb sprayer, antique sprayer"),
    ("Orifice reducer", "reducer plug"),
    ("Glass pipette dropper, rubber bulb, collar", "trim cap"),
    ("Ground-glass stopper; cap with glass rod", "applicator cap"),
]
NEVER_WORDS = [
    ("Claims", "leak-proof (except \"not leak-proof\"), airtight, spill-proof, TSA-approved, FDA-approved, food-grade, "
               "medical-grade, cosmetic-grade, UV-proof, shatterproof, unbreakable, universal, fits most"),
    ("Promotion", "premium, luxury, high quality, best, perfect, bestseller, new, sale"),
    ("Brand", "no beverage or bar words, anywhere"),
    ("Format", "ALL CAPS, emoji, \"w/\", \"approx.\", \"qty\", \"pcs\", prices or case counts in descriptions"),
]
PUBLISH_CHECKLIST = [  # RUBRIC.md §5 lint rules; COPY-STRATEGY.md §2-§3
    "The title follows the formula and fits in 60 characters.",
    "Capacity reads \"9 ml\" and the neck reads \"18-415\".",
    "Every part is named in the words on the previous page.",
    "The Fits line lists only parts sold on that bottle.",
    "No claim beyond the four allowed, and no promotional word.",
    "No price, case count or measurement in the description.",
    "The amber line appears only on amber glass.",
    "No exclamation points or superlatives.",
]
ALLOWED_CLAIMS = [
    "Amber reduces the light that reaches the contents.",
    "The liner seals the neck when capped. (13-415 lined caps only)",
    "Not leak-proof. (as a warning)",
    "Made by hand; each stopper is ground to its own bottle.",
]

# Where product information lives (the repository's own layout).
DATA_FLOW = [
    ("Component register", "Every body, part and sold combination, with its neck and status.", "data/register"),
    ("Product records", "Every item number: name, glass, size, neck, case and page.", "Convex"),
    ("Website", "Product pages, family pages and the downloadable family guides.", "bestbottles.com"),
    ("Checkout", "Cart and payment.", "Shopify"),
    ("Marketplaces and feeds", "Faire today; a Google Merchant feed is planned.", "Faire, Google"),
    ("Print", "This book, the family guides and the order inserts.", "scripts/print"),
]
LOOKUP = [  # question, where the answer is, and the page key in this book
    ("Price, stock, quantity breaks", "The product page at bestbottles.com, or 1-800-936-3628.", None),
    ("Which parts are sold on a bottle", "The family guide's fit chart, or the product page.", "part-families"),
    ("Every part made for a neck", "The fit system pages.", "part-fit"),
    ("Item numbers for parts", "Parts sold separately.", "parts"),
    ("Height, diameter, case quantity", "Every bottle, measured.", "ops-bodies"),
    ("Which page an item is on", "The index, by item number.", "index"),
    ("How to word a title or description", "Naming products and Describing products; the copy standard in the repository.", "ops-naming"),
]
REBUILD = [
    "Update the register and the product records first; the book follows them.",
    "Export the product records, then run: python3 scripts/print/family_guides.py --export <export>",
    "Every page regenerates: fit charts, line sheets, fit systems, contents and index.",
    "Wording rules live in docs/specs/pdp-item-descriptions; change them there, not on the page.",
]

GLOSSARY = [
    ("Assembly", "A body in one glass colour with one set of parts. Each assembly has its own item number."),
    ("Body", "One glass shape at one capacity and neck finish."),
    ("Case", "The number of units in a full factory case. It differs by bottle."),
    ("Complete set", "A bottle sold only with its own parts, such as the 16 mm Cylinder or the 13-425 vials."),
    ("Dip tube", "The tube that draws liquid up to a sprayer or pump. Its length must suit the bottle."),
    ("Dram", "A vial size: 1 dram is 4 ml and 5/8 dram is 3 ml."),
    ("Dropper", "A glass pipette with a rubber bulb and a collar; the stem length is given in millimetres."),
    ("Faux-leather cap", "An 18-415 cap covered in faux leather."),
    ("Fine-mist sprayer", "A screw-on spray head for thin liquids."),
    ("Fitment", "The part that dispenses: roller ball, sprayer, pump, dropper, reducer or bulb sprayer."),
    ("Fit system", "All the bottles that share one neck finish, and all the parts made for it."),
    ("Ground-glass stopper", "A glass stopper ground to its own bottle. It seats by friction and is not leak-proof."),
    ("Lined cap", "A screw cap with a liner that seals the neck when the cap is on."),
    ("Lotion pump", "A pump for lotions and other liquids that pour."),
    ("Neck finish", "The diameter and thread of a neck, written 18-415: 18 mm across, thread style 415."),
    ("Orifice reducer", "An insert in the neck, under a cap, that slows a pour to a splash or drip."),
    ("Overcap", "A clear cap that fits over a sprayer or pump."),
    ("Own class", "Bottles whose closures are matched to the bottle: stoppers, aluminum, atomizers and jars."),
    ("Roll-on cap", "The outer cap that screws on over a roller ball."),
    ("Roller ball", "A steel or plastic ball in an insert that sits in the neck, under the roll-on cap."),
    ("Short ribbed cap", "The black or white ribbed 13-415 cap with a white liner."),
    ("Treatment pump", "The small pump made for the 9 ml Cylinder on 17-415."),
    ("Vintage-style bulb sprayer", "A spray head worked by squeezing a rubber bulb, with or without a tassel."),
]
