# Cobalt Contact Shadow V2 Design

## Objective

Use the approved grounded-contact cobalt render as the exact baseline and make
only its contact shadow slightly darker and tighter so the bottle feels more
firmly seated on the floor.

## Locked Baseline

- Scene: `009ml-cobalt-grounded-contact-candidate-v1.blend`
- Cobalt absorption density: `1.80`
- Surface roughness: `0.032`
- Bottle and 17-415 finish geometry
- Camera and -30 degree packshot orientation
- Bottle and floor elevation at Z = 0
- Curved scrim, top fill, neck fill, background, exposure, and rightward shadow
- No base-halo reflection card

## Adjustment

Modify only `BB_FINAL_LEFT_SHADOW_KEY`:

- reduce width from `37 mm` to `35 mm`;
- reduce height from `80 mm` to `76 mm`;
- lower the key from Z `84 mm` to Z `82 mm`;
- retain energy at `89,000 W`; raising it canceled the intended contact darkening.

This should concentrate the darkest shadow immediately beneath the base while
retaining a soft falloff toward camera-right.

## Pass Conditions

- Contact shadow visibly touches the base across its central footprint.
- Contact region is slightly darker and tighter than V1.
- Broad rightward shadow remains soft.
- No black outline, halo increase, or floating effect.
- Bottle color, clarity, highlights, threads, and background remain unchanged.

## Safety and Deliverables

Save as a new V2 scene and render. Produce a 200% V1/V2 base comparison. Reject
V2 if any change is visible above the base or if the shadow becomes graphic.
