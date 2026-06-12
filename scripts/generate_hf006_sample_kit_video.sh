#!/usr/bin/env bash
set -euo pipefail

# Best Bottles HF-006: Sample Kit First Look
# Requires: higgsfield CLI authenticated with `higgsfield auth login`

PROMPT=$(cat <<'EOF'
Top-down product unboxing shot, locked overhead camera, warm wooden table surface filling the frame. Centered in frame: a kraft brown corrugated shipping box, approximately 12 inches square, sealed with brown packing tape. A pair of hands enters from below frame holding a small box cutter. The hands carefully slice the tape on three sides: left, top, right, with deliberate ASMR pacing. The hands fold back the cardboard flaps.

The box reveal: nestled in white crinkle tissue paper, an arrangement of approximately 12 empty glass cosmetic bottles in different shapes: Boston Rounds, Euro droppers, slim sprays, cream jars, and roll-ons. Each bottle sits in its own tissue cradle. The hands lift out one amber Boston Round dropper bottle and hold it up to the soft natural window light entering from frame left. Camera holds.

Lighting: soft natural window light from frame left, warm afternoon tone, gentle shadows. Color grade: warm neutral, documentary aesthetic with editorial polish. 9:16 vertical aspect ratio, 12 seconds, no music, premium unboxing pacing. Designed for later sound design: tape cutting, cardboard flexing, tissue rustling, and glass tinks. No logos, no readable labels, no alcohol references, no beverage context.
EOF
)

higgsfield generate create seedance_2_0 \
  --prompt "$PROMPT" \
  --duration 12 \
  --aspect_ratio 9:16 \
  --wait \
  --wait-timeout 20m
