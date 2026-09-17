"""Per-SKU photoreal prompt.

The shape is always the same: tell the model the input is a flat Photoshop cut-out and NOT a
photograph, lock what may not move, then ask for a real photograph. What varies is the glass
material and which components are on the bottle - both read off the SKU, never guessed.
"""
import re

LOCK = (
    "The attached image is a GEOMETRY REFERENCE ONLY. It is a flat cut-out assembled in Photoshop, "
    "not a photograph: the components are pasted shapes with no real lighting, and there is no real "
    "shadow. Do not preserve its rendering.\n\n"
    "Keep from it ONLY: the silhouette, proportions, position and scale of the bottle and of every "
    "component, including any cap standing separately beside the bottle, which stays exactly where "
    "it is and at exactly that size. Add nothing, remove nothing, move nothing, resize nothing. "
    "No label, no liquid, no extra accessory.\n\n"
    "Re-render that same geometry as a real photograph, shot on a seamless bone background #F5F3EF "
    "(warm cream, not white), key light front-left and above.\n\n"
)

COLOUR = (
    "COLOUR IS LOCKED to the input. Every material keeps exactly the colour it has in the reference: "
    "matte gold stays the same pale champagne matte gold, never darker, redder or more orange; matte "
    "silver is LIGHT satin anodised aluminium, pale and bright exactly as in the reference, never dark "
    "gunmetal, graphite or chrome, with soft satin shading and no hard mirror reflections; black stays "
    "black; clear glass stays completely colourless, with the "
    "bone background showing through it unchanged in hue. Neutral daylight white balance over the whole "
    "frame: no warm cast, no yellow cast, no vignette, no overall darkening. Shading may model the form; "
    "it may not change the hue.\n\n"
)

SHADOW = (
    "\nEvery object STANDS on the surface. Render a real contact shadow for each: darkest exactly "
    "where the object meets the surface, feathering outward from its base, with a soft elliptical "
    "cast shadow extending to the right and away from camera. No shadow hanging below the base, no "
    "gap between object and shadow, no hard edge, no second shadow.\n\n"
    "High-end editorial product photography. Photorealistic, physically correct, sharp and clean."
)

HARDWARE = [
    (r"MtSl|MattSl|SlMatt", "Every metal part of the hardware on this bottle - collar, spout, sprayer shell, pump collar "
     "or cap - is MATTE SILVER: satin anodised aluminium with a soft, even brushed sheen. Not chrome, not "
     "mirror-polished, no visible screw threads on the collar, no dark mirror reflections."),
    (r"MtGl|MattGl|GlMatt", "Every metal part of the hardware on this bottle is MATTE GOLD: pale champagne satin "
     "anodised aluminium with a soft, even brushed sheen. Not polished brass, not mirror gold."),
]


GLASS = {
    "frosted": "This bottle is FROSTED glass: satin-etched, translucent, milky-white over the whole "
               "body. Keep it frosted everywhere - do not clear it, do not treat the milky body as "
               "an artefact. Render it as premium satin glass with soft diffused light passing "
               "through it and a subtle sheen on the etched surface, with real wall thickness "
               "visible at the edges and the rim.",
    "swirl":   "This bottle is CLEAR glass with a moulded SWIRL flute running around the body. Keep "
               "every flute exactly where it is. Render the flutes as real moulded glass: each ridge "
               "catching a bright specular line and bending the background behind it, with true "
               "refraction and visible wall thickness, no milky haze.",
    "amber":   "This bottle is AMBER glass: deep warm brown, transparent. Keep the colour exactly. "
               "Render it as real coloured glass - light passing through, the colour deepening where "
               "the walls are thicker at the edges and the base, bright clean rim highlights, true "
               "refraction, no milky haze.",
    "cobalt":  "This bottle is COBALT BLUE glass: deep saturated blue, transparent. Keep the colour "
               "exactly. Render it as real coloured glass - light passing through, the colour "
               "deepening where the walls are thicker at the edges and the base, bright clean rim "
               "highlights, true refraction, no milky haze.",
    "clear":   "This bottle is CLEAR glass. Any flat white or opaque patch inside the glass in the "
               "reference is an artefact of an old cut-out, not part of the product - replace it with "
               "true transparent glass showing the bone background through the bottle. Render thick "
               "walls, bright clean rim highlights, a glossy base, subtle internal reflections and "
               "true refraction, with no milky haze.",
}

FITMENT = {
    "roller":   "a roller-ball fitment: a polished stainless steel ball seated in a clear plastic "
                "collar on the bottle's neck",
    "sprayer":  "a fine-mist sprayer fitted to the neck",
    "pump":     "a lotion pump fitted to the neck",
    "atomizer": "an atomizer with its braided hose and mesh squeeze bulb",
    "reducer":  "an orifice reducer seated in the neck",
    "bare":     "an open threaded neck",
}


def attrs(sku):
    if "Frst" in sku:
        glass = "frosted"
    elif "Swrl" in sku:
        glass = "swirl"
    elif "Amb" in sku:
        glass = "amber"
    elif "Blu" in sku:
        glass = "cobalt"
    else:
        glass = "clear"
    for pat, name in (("AnSp", "atomizer"), ("Spry", "sprayer"), ("Ltn", "pump"),
                      ("Rdcr", "reducer"), ("Roll", "roller")):
        if re.search(pat, sku):
            fit = name
            break
    else:
        fit = "bare"
    return glass, fit


def build(sku, has_loose_cap=True):
    glass, fit = attrs(sku)
    parts = [LOCK, GLASS[glass], "\n\n"]
    comp = (f"The bottle carries {FITMENT[fit]}. "
            "These components are real moulded objects, not stickers: give them true form, depth and "
            "correct material - polished steel, clear or glossy plastic, brushed or polished metal, "
            "with real specular highlights and their own soft shading, so no part reads as a flat "
            "pasted shape.")
    if has_loose_cap:
        comp += (" The cap standing beside the bottle is a real moulded object too - render its "
                 "curved face, its depth, the material it is made of and any inset metal studs as "
                 "real hardware, never as a printed dot on a flat shape.")
    hw = next((txt for pat, txt in HARDWARE if re.search(pat, sku)), None)
    if hw:
        comp += " " + hw
    parts += [comp, "\n\n", COLOUR, SHADOW]
    return "".join(parts)


if __name__ == "__main__":
    import sys
    print(build(sys.argv[1]))
