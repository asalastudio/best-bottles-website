# Style-Reference Photographer Handoff Package

Everything the photographer needs in one place. Print this, walk through
it before the shoot, sign the checklist at the end.

---

## 1. The shoot in one paragraph

Shoot **10 reference photos** that capture the visual language of glass
photography for the Best Bottles PDP pipeline. These are calibration
references — they teach the AI model what each glass behavior looks like
under studio light, not what a specific product looks like. Aesthetic
anchor: Wallpaper\* / Aperture editorial glass photography. Quiet,
restrained, material-forward.

## 2. What to bring

**Equipment (you should have):**
- Medium-format camera or full-frame mirrorless (Hasselblad / Phase
  One / Sony A7R / Canon R5)
- 85mm macro prime (~f/2.8, will shoot at f/11)
- Tripod, absolutely rigid
- Large softbox (~80×100cm or larger) for key
- Smaller softbox or white card for fill
- White card / strip light for edge separation
- Backdrop paper — Bone `#F5F3EF`, matte finish, at least 9ft wide
- Color checker (X-Rite ColorChecker or Datacolor Spyder)
- Light meter (incident, or use camera's)
- Tether cable if you want to review on laptop

**Lighting setup per shot** — same three lights every time:
- Key: large softbox, upper camera-left, ~30° elevation, ~5200K
- Fill: white card or small softbox, camera-right, ~4800K, ~1.5 stops below key
- Edge card: white card behind subject, slightly camera-left, ~30cm back
- No kicker, no second rim, no atmospheric haze

**Settings per shot:**
- f/11 (everything sharp, no DOF falloff)
- ISO 100
- Tripod, 2s self-timer or remote release
- Color temperature: capture RAW, convert to sRGB PNG for handoff

## 3. The 10 shots

For each shot below: filename → what the bottle should look like →
what the lighting tweak is (overrides to the canonical setup above).

### Shot 01 — `clear_short.png`
- **Subject:** 50ml clear Boston Round + plain black phenolic cap
- **Purpose:** baseline clear-glass lighting
- **Tweak:** none (canonical)

### Shot 02 — `clear_tall.png`
- **Subject:** 100ml clear Slim + polished silver collar + white plastic
  fine-mist sprayer + clear over-cap DETACHED to the right on baseline
- **Purpose:** demonstrates detached over-cap rendering
- **Tweak:** none (canonical)

### Shot 03 — `colored_clear_cobalt.png`
- **Subject:** 100ml cobalt blue Cylinder + polished silver collar + white plastic fine-mist sprayer
- **Purpose:** colored glass with internal glow + rim only
- **Tweak:** Key produces internal glow, NOT a vertical specular streak.
  Add a tight white strip light behind the bottle, slightly camera-left,
  to create thin rim highlights on both sidewall edges.

### Shot 04 — `colored_clear_amber.png`
- **Subject:** 50ml amber Boston Round + polished silver collar + roll-on cap
- **Purpose:** amber glass with warm internal glow + soft caustic
- **Tweak:** same as 03. A soft warm caustic pool under the heavy base
  is welcome (and grounds the bottle).

### Shot 05 — `colored_clear_green.png`
- **Subject:** 50ml emerald green Apothecary bottle + ground-glass stopper
- **Purpose:** colored glass + stopper closure (not sprayer)
- **Tweak:** rim-only lighting, no specular streak. Heavy base should
  show visible edge density at the bottom greater than at sidewalls.

### Shot 06 — `frosted_short.png`
- **Subject:** 30ml frosted Boston Round + white phenolic cap
- **Purpose:** frosted glass with luminous wash, no surface streak
- **Tweak:** add a wide softbox directly behind the bottle (~50cm back)
  to backlight through the body. Exposure ~1 stop higher than clear-glass
  shots. NO surface specular streak — replace with a soft luminous
  wash across the left side.

### Shot 07 — `frosted_tall.png`
- **Subject:** 100ml frosted Slim + polished silver collar + reducer + matte silver cap
- **Purpose:** frosted glass at tall aspect ratio with multi-component closure
- **Tweak:** same as 06.

### Shot 08 — `swirl.png`
- **Subject:** 100ml clear Cylinder with diagonal swirl ridges + white
  plastic fine-mist sprayer
- **Purpose:** swirl ridges revealed by grazing light
- **Tweak:** canonical key PLUS a narrow strip light positioned high and
  slightly behind camera-left, ~60° elevation, ~10-15° off the bottle.
  This grazing key rakes across the ridges and reveals the spiral.

### Shot 09 — `apothecary.png`
- **Subject:** 30ml cobalt blue Apothecary bottle + ground-glass stopper INSIDE neck
- **Purpose:** thick walls, heavy base, stopper closure (no sprayer)
- **Tweak:** same as 03 (internal glow + rim). The stopper sits inside
  the neck — make sure the smooth dome top is visible above the rim.

### Shot 10 — `novelty.png`
- **Subject:** 10ml heart-shaped keychain perfume bottle + attached
  chain/ring + decorative cap. Use cobalt or clear.
- **Purpose:** asymmetric body shape, attached hardware
- **Tweak:** base on the glass behavior, then render the hardware
  extending UPWARD from the bottle's top. Heart-shaped contact shadow
  (not oval). Both lobes must be lit equally.

## 4. Background and ground plane

- Bone `#F5F3EF` paper, edge to edge, no visible tabletop line
- 1-2% vertical gradient (slightly darker toward bottom) — read as
  seamless cyclorama paper, not flat fill
- Contact shadow ~20% opacity, soft, feathered outward
- No horizon line. No tabletop edge. No vignette. No paper texture.
  No props. No labels. No text.

## 5. Hand-off deliverables

When the shoot is complete, deliver:

- [ ] **10 PNG files** at 2080×2288 minimum resolution, sRGB color space
- [ ] **Filenames match the convention** (clear_short.png, etc.) — exactly
- [ ] **Each file 4096×4576 preferred** (downsample to 2080×2288 only if
      you can't shoot at full resolution)
- [ ] **Contact sheet PDF** showing all 10 at thumbnail scale for quick review
- [ ] **One-line setup note per shot** describing any deviation from the
      brief (different softbox size, distance tweaks, etc.)
- [ ] **Color-checker reference frame** — first shot of each session with
      the X-Rite / Datacolor chart in frame for color accuracy QA
- [ ] **Drop files into** `pipeline/image-gen/sku-lock/style-references/`
      (or deliver via shared folder; we'll move them)

## 6. Compliance checklist — sign off before delivering

For each shot, confirm:

- [ ] **Canvas is 2080×2288 portrait** (or 4096×4576 / 2x)
- [ ] **Background is Bone `#F5F3EF`** (no visible paper texture, no
      horizon line, no tabletop edge, no vignette)
- [ ] **No labels, no logos, no text** anywhere in the frame
- [ ] **No hands, no models, no props** in frame
- [ ] **No colored gel on key light** (color comes from the glass)
- [ ] **No heavy post-processing** — no high-contrast curves, no
      saturation boost, no LUT, no vignette
- [ ] **Subject occupies ~50-60% of canvas height**, vertically centered
- [ ] **Component count matches the brief** — for shot 02, the over-cap
      is visibly separate from the bottle. For shot 09, there's no
      sprayer (the stopper is the closure). For shot 10, the hardware
      is attached.

## 7. Communication

While shooting, you can reach us at:
- Slack: #best-bottles-imaging (or your equivalent channel)
- Email: jordan@...

If a shot doesn't look right, send a phone snapshot (not a full-res
file) and we'll discuss before continuing. Don't burn through the full
shot list if there's a setup issue.

---

## Reference: composition cheat sheet

```
                ┌──────────────────────────────────┐
                │                                  │
                │       TOP AIR (consistent)       │
                │                                  │
                │           ╔═══════╗               │
                │           ║       ║               │
                │           ║ BOT-  ║               │
                │           ║ TLE   ║               │
                │           ║       ║ ← component   │
                │           ╚═══╤═══╝    stack     │
                │               │                   │
                │               ├───────┐           │
                │               │DETACH │ ← only    │
                │               │COMP   │   if      │
                │               │       │   spec'd │
                │         ▔▔▔▔▔▔      └───────     │
                │         CONTACT SHADOW           │
                │                                  │
                │       BOTTOM (cyc paper)         │
                └──────────────────────────────────┘
                   ↑                          ↑
                   left margin          right margin
                   (consistent)         (consistent)
```

Every shot has consistent top air, consistent margins, centered product,
baseline at the same Y-coordinate.

---

## Reference: forbidden mutations

These show up as failures in the QA gate. Check for them in-camera:

| You see | What it means | Fix |
|---|---|---|
| Vertical bright streak on colored glass | Model will treat as clear glass | Move key, add strip light, kill the streak |
| Hard contact shadow | Looks like cutout pasted on | Increase distance, soften light |
| Off-center product | Wrong baseline | Re-level the bottle on the surface |
| Two caps on a SKU that has one | Component count wrong | Remove the extra closure |
| Closure merged into body | Single ambiguous shape | Increase separation, lower the closure |
| Apothecary with sprayer | Wrong closure family | Replace sprayer with stopper |
| Heavy post-processing | Won't match downstream renders | Reset, reshoot without LUT |
| Visible paper texture | Won't match the #F5F3EF flat fill | Re-paint or replace paper |

## Reference: contact-sheet format

After delivery, lay out all 10 PNGs in a 5×2 or 2×5 grid in a single
PDF. Add the filename under each thumbnail. Make it easy for the team
to scan and approve in one read.