#!/usr/bin/env python3
"""
Best Bottles — Prompt Generator
Reads _measurements.json and generates Nano Banana 2 prompts for each variant.

Usage:
  python generate_prompts.py reference/cylinder/_measurements.json
  python generate_prompts.py reference/cylinder/_measurements.json --colors clear,amber,cobalt-blue
"""

import sys, os, json, argparse


# ── Family shape descriptions ──────────────────────────────────────────────
SHAPES = {
    "cylinder": (
        "A tall, narrow, perfectly cylindrical glass tube with perfectly parallel "
        "vertical walls — no taper, no bulge, no curves, no waist. Flat bottom "
        "sits flush on the surface"
    ),
    "boston-round": (
        "A classic round-shouldered bottle with a cylindrical body that curves "
        "smoothly into rounded shoulders, tapering to a narrow neck. The transition "
        "from body to shoulder is a smooth continuous curve, not an abrupt angle"
    ),
    "apothecary": (
        "A traditional apothecary-style bottle with a wider cylindrical body, "
        "distinct shoulder, and proportionally tall narrow neck. The body-to-neck "
        "transition is a pronounced step"
    ),
    "square": (
        "A bottle with a perfectly square cross-section. Four flat faces meet at "
        "crisp 90-degree edges. Shoulders taper from the square body to a round neck"
    ),
    "rectangle": (
        "A bottle with a rectangular cross-section — wider on two faces, narrower "
        "on the other two. Flat faces with crisp edges. Shoulders taper to a round neck"
    ),
    "teardrop": (
        "A curved, organic-shaped bottle that widens from a narrow base to its "
        "widest point in the upper third, then tapers to the neck. The silhouette "
        "is a smooth, flowing curve without flat sections"
    ),
    "bell": (
        "A bell-shaped bottle that flares outward from the neck, reaching maximum "
        "width near the base. The profile follows a smooth bell curve. Flat bottom"
    ),
    "vial": (
        "A very small, narrow cylindrical glass tube — proportionally even taller "
        "and thinner than a standard cylinder. Think test tube proportions"
    ),
}

# ── Glass color material blocks ────────────────────────────────────────────
MATERIALS = {
    "clear": (
        "GLASS: Crystal clear transparent glass. You can see straight through the "
        "bottle. Subtle dark outlines at the edges where the glass refracts light. "
        "The glass walls are thin and uniform in thickness."
    ),
    "amber": (
        "GLASS: Rich warm amber glass — a deep honey-brown color, transparent. "
        "Light passes through showing the warm brown tones. The amber color is "
        "uniform throughout the glass walls. The glass has a slight warm glow "
        "where the studio light hits it."
    ),
    "cobalt-blue": (
        "GLASS: Deep saturated cobalt blue glass — a rich, vivid royal blue. The "
        "glass is transparent with the intense blue visible from every angle. Light "
        "refracts through showing deep blue tones. The blue color is uniform and "
        "saturated throughout."
    ),
    "frosted": (
        "GLASS: Frosted matte translucent glass — a soft white semi-opaque finish. "
        "Not fully transparent, not fully opaque. The frosting diffuses light evenly "
        "across the surface giving a smooth, silky appearance. Uniform frosting "
        "across the entire body."
    ),
    "green": (
        "GLASS: Deep emerald green glass — a rich forest green, transparent. Light "
        "passes through showing deep green tones. The color is uniform and saturated "
        "throughout the glass walls."
    ),
    "swirl": (
        "GLASS: Clear transparent glass with a decorative diagonal swirl twist "
        "pattern molded into the glass surface. The swirl ridges run diagonally at "
        "approximately 45 degrees, wrapping around the body. The glass itself is "
        "clear — the pattern is created by raised ridges. Light catches the twisted "
        "ridges creating highlights and shadows."
    ),
}

# ── Closure descriptions ──────────────────────────────────────────────────
CLOSURES = {
    "matte-silver-rollon": (
        "The matte brushed silver aluminum roll-on cap sits on top, a perfect "
        "cylinder with the same diameter as the body — flush sides, no overhang, "
        "no step. Flat top on the cap"
    ),
    "shiny-gold-rollon": (
        "The polished shiny gold aluminum roll-on cap sits on top, a perfect "
        "cylinder with the same diameter as the body — flush sides, no overhang. "
        "Flat top with subtle gold reflections"
    ),
    "black-screw-cap": (
        "A glossy black plastic screw cap sits on top. The cap diameter matches "
        "the neck diameter (narrower than the body). Flat top, smooth sides"
    ),
    "dropper": (
        "A gold/black dropper assembly with a rubber squeeze bulb on top and a "
        "glass pipette extending down into the bottle. The bulb sits above the cap ring"
    ),
    "sprayer": (
        "A fine mist spray pump with a silver collar and clear overcap. The "
        "actuator button sits at the top"
    ),
}

# ── Lighting lookup by glass color ─────────────────────────────────────────
LIGHTING = {
    "clear":       {"temp": "6200", "fill": "60", "backlight": "defining the glass edges"},
    "amber":       {"temp": "6200", "fill": "60", "backlight": "enhancing the amber glow"},
    "cobalt-blue": {"temp": "6200", "fill": "60", "backlight": "making the cobalt blue glow"},
    "frosted":     {"temp": "6200", "fill": "60", "backlight": "creating a gentle glow through the frosted glass"},
    "green":       {"temp": "6200", "fill": "60", "backlight": "revealing the deep green tones"},
    "swirl":       {"temp": "6200", "fill": "60", "backlight": "revealing the swirl texture"},
}


def build_prompt(family, color, capacity_ml, closure, measurements):
    """Build a complete 6-block Nano Banana 2 prompt."""
    hw = measurements.get("height_width_ratio", 4.0)
    cap_pct = measurements.get("cap_percent", 30)
    frame_pct = measurements.get("frame_occupancy_height_pct", 65)

    shape = SHAPES.get(family, SHAPES["cylinder"])
    material = MATERIALS.get(color, MATERIALS["clear"])
    closure_desc = CLOSURES.get(closure, CLOSURES["matte-silver-rollon"])
    light = LIGHTING.get(color, LIGHTING["clear"])

    # Clamp frame occupancy to reasonable range
    frame_target = max(55, min(75, round(frame_pct)))

    prompt = f"""Professional studio product photograph of a {capacity_ml}ml {color.replace('-', ' ')} glass {family.replace('-', ' ')} bottle.

EXACT SHAPE — critical, do not deviate: {shape}. The overall height-to-width ratio is {hw} to 1. {closure_desc}, occupying exactly the top {round(cap_pct)}% of the total bottle height. The closure diameter matches the body diameter exactly — no overhang, no lip, no rim. Flat top on the closure.

{material}

COMPOSITION: Single bottle, perfectly centered in a 2400x2400 pixel square frame. The bottle occupies {frame_target}% of the frame height. Ample negative space on all sides. Slight 5-degree angle from straight-on for subtle dimension.

LIGHTING: Soft diffused studio lighting. Key light at 45 degrees, warm neutral {light['temp']}K color temperature. Subtle backlight rim illumination {light['backlight']}. Fill light at {light['fill']}% of key intensity. Small, soft natural shadow directly beneath the bottle on the surface.

BACKGROUND: Pure clean white seamless background. No gradient, no texture, no props, no pedestal, no label on the bottle. Absolutely no wine bottles, no corks, no beverage aesthetics.

STYLE: Premium luxury product photography. Tack sharp focus on the closure and glass body. Photorealistic. No illustration, no stylization, no artistic effects. This is a fragrance/cosmetics packaging product — not a beverage bottle."""

    return prompt.strip()


def main():
    parser = argparse.ArgumentParser(description="Generate Nano Banana 2 prompts from measurements")
    parser.add_argument("measurements_json", help="Path to _measurements.json")
    parser.add_argument("--family", default="cylinder", help="Product family name")
    parser.add_argument("--colors", default="clear,amber,cobalt-blue,frosted,green",
                        help="Comma-separated list of glass colors")
    parser.add_argument("--closure", default="matte-silver-rollon",
                        help="Closure type key")
    parser.add_argument("--capacity", type=int, default=None,
                        help="Override capacity in ml (otherwise inferred from filename)")
    parser.add_argument("--output-dir", default=None,
                        help="Directory to write prompt files (default: prompts/)")
    args = parser.parse_args()

    with open(args.measurements_json) as f:
        all_measurements = json.load(f)

    colors = [c.strip() for c in args.colors.split(",")]
    out_dir = args.output_dir or os.path.join(os.path.dirname(args.measurements_json), "..", "..", "prompts")
    os.makedirs(out_dir, exist_ok=True)

    prompts_generated = []

    for image_key, meas in all_measurements.items():
        if "error" in meas:
            continue

        # Try to extract capacity from filename (e.g., "9ml", "30ml")
        capacity = args.capacity
        if capacity is None:
            import re
            match = re.search(r'(\d+)\s*ml', image_key, re.IGNORECASE)
            if match:
                capacity = int(match.group(1))
            else:
                match = re.search(r'(\d+)\s*oz', image_key, re.IGNORECASE)
                if match:
                    capacity = round(int(match.group(1)) * 29.5735)
                else:
                    capacity = 0  # Unknown

        for color in colors:
            prompt = build_prompt(args.family, color, capacity, args.closure, meas)
            filename = f"{args.family}-{color}-{capacity}ml.txt"
            filepath = os.path.join(out_dir, filename)

            with open(filepath, "w") as f:
                f.write(prompt)

            prompts_generated.append({
                "file": filename,
                "family": args.family,
                "color": color,
                "capacity_ml": capacity,
                "hw_ratio": meas.get("height_width_ratio"),
                "cap_pct": meas.get("cap_percent"),
            })
            print(f"  ✓ {filename}")

    # Write manifest
    manifest_path = os.path.join(out_dir, f"{args.family}-prompt-manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(prompts_generated, f, indent=2)
    print(f"\n  → {len(prompts_generated)} prompts written to {out_dir}/")
    print(f"  → Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
