# Cobalt Gloss Refraction Bracket

## Objective

Evaluate the supplied glossy cobalt reference against the protected grounded-contact V1 Blender scene without changing geometry, camera, studio, background, or shadow design.

## Candidate set

1. `baseline-v1`: absorption density `1.80`, surface roughness `0.032`.
2. `polished`: absorption density `1.80`, surface roughness `0.020`.
3. `luminous-polished`: absorption density `1.55`, surface roughness `0.020`.

All other material inputs and all scene inputs remain identical.

## Execution

1. Add failing Blender gates for the three candidates and immutable scene state.
2. Add isolated material derivatives and a non-overwriting render entry point.
3. Render the three full-frame candidates from the protected V1 scene.
4. Export 200% neck, body, and base diagnostics plus a labeled comparison.
5. Verify body/finish hashes, camera, lighting, backdrop, floor, exposure, and shadow settings before reporting.

