---
name: best-bottles-scroll-motion-website
description: Use this project skill when creating a scroll-stopping cinematic motion section or landing-page experience for the Best Bottles website using Claude Code, Higgsfield/GPT Image 2/Seedance 2.0-style media workflows, deterministic product-image fidelity, GSAP/ScrollTrigger/Lenis, and the existing Next.js Best Bottles codebase.
---

# Best Bottles Scroll Motion Website Skill

## Source pattern

This skill adapts the BurgerLab Claude + Higgsfield MCP workflow from the video "Claude Fable 5 + Higgsfield MCP Built This Motion Website" into a Best Bottles production workflow.

The useful structure from the BurgerLab workflow is:

1. Install a focused project skill before building.
2. Create a workspace and planning files before spending media credits.
3. Generate still assets first, with a hero reference defining visual identity.
4. Generate one cinematic scroll-background motion asset from approved still references.
5. Re-encode video for scroll scrubbing.
6. Build a polished single-page or homepage section with scroll-controlled video, GSAP ScrollTrigger, Lenis, and explicit verification hooks.

For Best Bottles, the workflow must be stricter than BurgerLab because product geometry and catalog fidelity matter more than creative food styling.

## Non-negotiable Best Bottles rule

Do not treat Best Bottles bottles, closures, tubes, applicators, caps, pumps, droppers, rollers, glass silhouettes, labels, scale, or product edges as freeform AI-generated imagery.

Production-safe direction:

```text
Use existing Madison/master/reference product images as the source of truth.
Preserve product pixels and geometry wherever possible.
Use AI primarily for abstract motion plates, lighting, glass/reflection atmospheres, and non-product background environments.
Only use product-aware video generation for concept review, never final catalog truth, unless Jordan explicitly approves it.
```

If an AI model changes the bottle shape, cap geometry, applicator internals, label placement, product scale, or transparent glass edge, the asset is not production-ready.

## Recommended project structure

Create this structure inside a dedicated motion workspace, not scattered through the repo:

```text
creative/best-bottles-scroll-motion/
  assets/
    product-refs/          # approved Madison/master product references only
    images/                # generated or composed stills
    videos/                # raw and encoded video files
    references/            # screenshots, inspiration, brand examples
    masks/                 # product masks / alpha mattes if needed
  copy/
    brand-kit.md
    asset-plan.md
    image-prompts.md
    video-prompt.md
    website-brief.md
    qa-checklist.md
  scripts/
    encode-scroll-video.sh
    make-contact-sheet.py
  README.md
```

If integrating into the live Next.js app, copy only approved final assets into public-facing paths after review, for example:

```text
public/best-bottles/motion/
  bg-scroll.mp4
  bg-scroll-poster.jpg
  hero-composite.png
  product-overlays/*.png
```

## Brand direction

Best Bottles should feel premium, clean, credible, and useful for B2B packaging buyers.

Visual language:

- premium glass and fragrance packaging supplier
- luminous translucent glass, acrylic, chrome, sprayers, rollers, droppers, caps, boxes, and components
- clean white / pearl / soft gray product truth with controlled high-end reflections
- restrained black, graphite, champagne, soft gold, cool white, and glass-blue accents
- elegant studio lighting, shallow glints, caustics, vapor-like highlights, and slow parallax
- modern e-commerce UI, not gimmicky restaurant or nightclub design
- buyer-confidence framing: product families, finishes, sizes, samples, quotes, and consultation

Avoid:

- fake labels or text baked into images/video
- fictional logos on bottles
- hands, people, faces, or lifestyle clutter unless explicitly approved
- chaotic glass explosions or broken glass
- shape-changing bottles
- excessive liquid splashes that obscure product edges
- over-dark luxury that makes transparent products hard to inspect

## Best Bottles motion concept

Replace BurgerLab's "assembled burger to exploded ingredient stack" with a Best Bottles-appropriate reveal:

### Preferred concept: The Glass Lineup Reveal

A continuous cinematic scroll-scrubbed motion plate that starts in an abstract luminous glass studio, then reveals a precise family of Best Bottles product silhouettes / approved product overlays with parallax, reflections, and light sweeps.

Motion arc:

1. Dark-to-light pearl studio opens with macro glass caustics and soft refractions.
2. Camera glides through floating highlights, chrome glints, and subtle vapor-like light.
3. Approved product silhouettes or deterministic product overlays appear in a premium lineup.
4. Products separate into categories: roll-ons, sprayers, droppers, jars, caps/closures, and boxes.
5. End on a clear hero composition with negative space for headline, CTA, search, or sample-request UI.

### Alternative concept: Components in Orbit

A clean product-component choreography where approved transparent product cutouts stay locked while background and small non-product accent elements move around them.

Motion arc:

1. Macro cap / glass / mist detail.
2. Components orbit gently as category cards scroll into place.
3. Bottle family aligns into a final ordering/search experience.

Use this only if exact component references are available.

## Still image workflow

Before video generation, create or collect still references in this order:

1. **Source product references**
   - Use Madison/master/reference images.
   - Confirm dimensions, SKU/source, and approval state.
   - Do not edit product pixels except deterministic background normalization.

2. **Hero composite still**
   - Build a composed still using approved product PNGs on a premium glass/reflection background.
   - Prefer deterministic compositing in code/Photoshop/Canvas over AI redrawing.
   - Save as `assets/images/hero-lineup-composite.png`.

3. **Motion poster still**
   - A website-safe poster frame matching the final video ending.
   - Save as `assets/images/scroll-motion-poster.jpg`.

4. **Category stills**
   - Product cards or family panels for key categories.
   - Use approved product images only.
   - Save as `assets/images/category-*.png`.

5. **Abstract motion plates**
   - If using GPT Image 2 for stills, generate background-only or atmosphere-only frames with no product geometry.
   - Save as `assets/images/background-plate-*.png`.

## Image prompt guidance

For GPT Image 2 or similar still generation, prefer background plates and atmospheres:

```text
Create a premium product-advertising background plate for a glass bottle packaging supplier website. Luminous pearl-white and soft graphite studio environment, glossy reflective surface, subtle glass caustics, champagne highlights, clean negative space for website headline and product overlays, luxury e-commerce composition, photorealistic, high-end B2B packaging brand, no people, no hands, no text, no logos, no bottles, no product shapes, no packaging labels.
```

If generating a concept-only product-aware image, label it as non-production and use strict language:

```text
Concept-only reference frame for a premium glass bottle packaging supplier website. A clean family lineup of transparent cosmetic/fragrance bottles, sprayers, roll-ons, droppers, jars, and caps in a luminous studio setting, precise product-commerce layout, elegant reflections, soft champagne and glass-blue lighting, no labels, no text, no logos, no people, no hands. This is for mood exploration only and must not replace approved product images.
```

## Video prompt guidance

The safest final video prompt is background-motion-first, with product overlays handled by the website.

### Preferred Seedance 2.0 prompt: background motion plate

Use this when the product layer will be composited in the website with real Best Bottles PNGs:

```text
Create a continuous cinematic background motion plate for a premium Best Bottles e-commerce landing page.

This video will sit behind exact product PNG overlays on a website and will be controlled by scroll progress with GSAP ScrollTrigger, Lenis, and frame-by-frame video scrubbing. The motion must feel beautiful, premium, and scroll-stopping, but it must not include any readable product, bottle shape, label, logo, text, people, or hands.

Core concept:
A luminous glass studio reveal for a high-end bottle and packaging supplier. The camera glides through elegant abstract glass caustics, soft chrome reflections, champagne light sweeps, pearl-white gradients, subtle vapor-like highlights, and glossy tabletop reflections. The environment should feel like a premium fragrance/cosmetic packaging campaign without showing actual products.

Motion requirements:
- one continuous uninterrupted shot
- no cuts, no scene changes, no montage, no jump cuts
- smooth push-in, orbit-like parallax, elegant pull-back
- stable enough for manual scroll scrubbing
- cinematic but not chaotic
- enough negative space for website text and UI overlays
- readable on desktop and mobile poster fallback

Visual style:
- premium B2B packaging supplier
- luminous glass and chrome atmosphere
- pearl white, soft graphite, champagne gold, and faint glass-blue accents
- glossy reflective surface
- subtle caustics and refractions
- clean luxury e-commerce look
- high-end product campaign energy

Do not include:
- no bottles
- no product silhouettes
- no labels
- no text
- no logos
- no people
- no hands
- no packaging clutter
- no broken glass
- no liquid splashes obscuring the frame
- no extreme flicker
- no chaotic motion blur

Sequence:
1. Start in a soft graphite and pearl studio with faint glass caustics.
2. Push through luminous reflections and champagne light sweeps.
3. Add elegant parallax, vapor-like highlights, and slow floating glass-like bokeh.
4. Pull back into a clean final hero frame with broad negative space for exact product overlays and CTA text.
```

Save raw output as:

```text
assets/videos/best-bottles-scroll-background-raw.mp4
```

### Riskier concept-only prompt: product-aware motion

Only use this for exploration after Jordan approves the risk:

```text
Create a continuous cinematic video concept for a premium Best Bottles website hero. Use the provided approved product lineup image as the only product identity reference. Preserve the exact bottle shapes, cap geometry, glass proportions, product count, spacing, material feel, and overall lineup identity. The motion should be a smooth premium camera glide with light sweeps, reflections, and subtle parallax. Products should remain stable and recognizable at all times. No new bottles, no changed caps, no labels, no text, no people, no hands, no packaging clutter. One continuous shot, no cuts, no scene changes, stable for scroll scrubbing.
```

Treat output as QA-hold until visually approved.

## Website implementation pattern

The existing Best Bottles repo is a Next.js app. Do not create a separate Vite app unless the user explicitly asks for a detached prototype. Adapt the BurgerLab structure to Next.js:

Recommended stack:

- Next.js / React / TypeScript
- CSS variables or Tailwind-compatible tokens already used by the repo
- Framer Motion if already present for small UI animations
- GSAP + ScrollTrigger for the pinned scrubbed video section
- Lenis only if it does not conflict with existing app scroll behavior
- all-keyframe H.264 MP4 for scrubbed background video
- poster image fallback for mobile and reduced-motion users

Key section structure:

1. **Hero** — Best Bottles headline, buyer promise, sample/quote CTA, search/category CTA.
2. **Motion reveal** — pinned full-screen scroll-scrubbed background plate with real product PNG overlays.
3. **Category split** — roll-ons, sprayers, droppers, jars, caps/closures, boxes.
4. **Product confidence** — MOQ, finishes, sizes, samples, fulfillment, support.
5. **Consultation CTA** — sample request / quote / talk to Grace.

## Scroll video system

Use a fixed or pinned video layer behind HTML content. Map scroll progress to `video.currentTime`.

Implementation requirements:

- preload metadata and guard against `duration === 0`
- use `requestAnimationFrame` or GSAP ticker to smooth currentTime updates
- encode video as all-keyframe H.264 to improve seek/scrub behavior
- use poster frame on mobile / `prefers-reduced-motion`
- expose dev hooks:
  - `window.__bbLenis`
  - `window.__bbScrollTrigger`
  - `window.__bbBackgroundVideo`
- keep all copy as HTML/CSS, never baked into video
- ensure the product overlay layer remains sharp and untouched by video compression

Encode command template:

```bash
ffmpeg -y -i assets/videos/best-bottles-scroll-background-raw.mp4 \
  -vf "scale=1920:-2:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 18 \
  -x264-params keyint=1:min-keyint=1:scenecut=0 \
  -pix_fmt yuv420p -movflags +faststart \
  public/best-bottles/motion/bg-scroll.mp4
```

## QA checklist

Before claiming the work is ready:

- [ ] Planning files exist and match this skill.
- [ ] Product reference images came from approved Madison/master sources.
- [ ] No generated media is presented as product truth without approval.
- [ ] Product pixels/geometry are preserved in final website overlays.
- [ ] AI video contains no accidental labels, logos, fake products, or people.
- [ ] Video re-encoded as all-keyframe H.264 for scrub performance.
- [ ] Poster fallback exists.
- [ ] Reduced-motion fallback exists.
- [ ] Desktop scroll-scrub works.
- [ ] Mobile fallback is usable.
- [ ] `npm run build` passes.
- [ ] Visual QA screenshot/contact sheet is produced.
- [ ] Final answer reports exact paths and known limitations.

## Phase prompts for Claude Code

Use these prompts to drive the project safely.

### 1. Install skill

```text
I added a project skill file for the Best Bottles scroll motion website workflow.

Please inspect the skill file, install it correctly for this Claude Code project, and confirm that the skill is available before we start the actual build.

Do not generate media yet.
Do not build the website yet.
For now, only install the skill and summarize what it will help with in this project, especially the Best Bottles product-fidelity constraints.
```

### 2. Create workspace

```text
We are starting the Best Bottles scroll motion website project.
The Best Bottles scroll motion project skill is installed and available in this Claude Code workspace.
Follow the installed skill and create the initial project workspace only.

Create this structure:
- creative/best-bottles-scroll-motion/assets/product-refs
- creative/best-bottles-scroll-motion/assets/images
- creative/best-bottles-scroll-motion/assets/videos
- creative/best-bottles-scroll-motion/assets/references
- creative/best-bottles-scroll-motion/assets/masks
- creative/best-bottles-scroll-motion/copy
- creative/best-bottles-scroll-motion/scripts

Create these planning files:
- creative/best-bottles-scroll-motion/copy/brand-kit.md
- creative/best-bottles-scroll-motion/copy/asset-plan.md
- creative/best-bottles-scroll-motion/copy/image-prompts.md
- creative/best-bottles-scroll-motion/copy/video-prompt.md
- creative/best-bottles-scroll-motion/copy/website-brief.md
- creative/best-bottles-scroll-motion/copy/qa-checklist.md
- creative/best-bottles-scroll-motion/README.md

Define the Best Bottles brand identity, visual direction, required approved source assets, background-only image prompts, safe Seedance video concept, website section plan, build workflow, and QA gates.

Important:
- Do not generate any images yet.
- Do not generate any videos yet.
- Do not modify the live website yet.
- Do not spend any Higgsfield credits yet.
- Do not use AI to redraw Best Bottles product geometry.

After creating the folders and files, summarize exactly what was created and show the planned next steps before media generation.
```

### 3. Prepare approved product references

```text
The workspace planning files are approved.

Now prepare the approved Best Bottles product references only.
Find or receive the Madison/master/reference product images selected for the motion section, copy them into:
creative/best-bottles-scroll-motion/assets/product-refs/

Create a manifest that records source path, SKU or family name if known, approval state, dimensions, and notes:
creative/best-bottles-scroll-motion/copy/product-reference-manifest.md

Do not generate media yet.
Do not redraw product pixels.
Do not modify the live website yet.
After copying references, create a contact sheet for review and report the paths.
```

### 4. Generate or compose still assets

```text
The product references are approved.

Now create the still assets for the Best Bottles motion section.
Prefer deterministic compositing with the approved product PNGs. Use AI only for background plates that contain no bottles, no labels, no logos, no people, and no text.

Required outputs:
1. creative/best-bottles-scroll-motion/assets/images/hero-lineup-composite.png
2. creative/best-bottles-scroll-motion/assets/images/scroll-motion-poster.jpg
3. creative/best-bottles-scroll-motion/assets/images/category-roll-ons.png
4. creative/best-bottles-scroll-motion/assets/images/category-sprayers.png
5. creative/best-bottles-scroll-motion/assets/images/category-droppers.png
6. creative/best-bottles-scroll-motion/assets/images/category-jars-closures.png
7. creative/best-bottles-scroll-motion/assets/images/background-plate-hero.png

Important rules:
- Preserve exact product pixels and geometry.
- Do not generate new bottles as production assets.
- No text baked into images.
- No logos, people, hands, fake labels, or third-party marks.
- Save every generated/composed image immediately to the exact path.

After generation/compositing, report the saved files and wait for visual review before moving to video generation.
```

### 5. Generate scroll background video

```text
The still assets are approved.

Now generate the final scroll-driven background motion plate.
Use the background-motion-first prompt from the Best Bottles skill.
The final video should not contain product geometry. The website will overlay exact approved product PNGs above it.

Settings:
- Model: Seedance 2.0 or approved equivalent
- Aspect ratio: 16:9
- Resolution: 720p or 1080p depending on budget
- Duration: 8 to 12 seconds
- Quality: high

Save raw output as:
creative/best-bottles-scroll-motion/assets/videos/best-bottles-scroll-background-raw.mp4

Important:
- Do not build the website yet.
- Do not re-encode the video yet.
- Do not include bottles, labels, logos, people, or hands in the generated video.
- After generation, report the saved video path and wait for review.
```

### 6. Build the website section

```text
The Best Bottles media assets and planning files are approved.

Switching into website build phase now.
Use the installed Best Bottles scroll motion project skill as the source of truth.

Build inside the existing Next.js Best Bottles app, not a detached Vite project, unless explicitly instructed otherwise.

Use:
- Next.js / React / TypeScript
- GSAP + ScrollTrigger for the pinned scroll-scrub section
- Lenis only if compatible with the existing app scroll behavior
- existing CSS/Tailwind conventions where possible
- all-keyframe H.264 background video
- approved product PNG overlays

Build requirements:
1. Copy approved final assets into public/best-bottles/motion/.
2. Re-encode the raw video to all-keyframe H.264 as public/best-bottles/motion/bg-scroll.mp4.
3. Add a polished homepage section or route section with:
   - hero buyer promise
   - scroll-driven motion reveal
   - category story
   - product confidence / sourcing support
   - sample or quote CTA
4. Map scroll progress to the background video currentTime.
5. Keep real product overlays separate from the video so exact product pixels stay sharp.
6. Add mobile and prefers-reduced-motion fallback using the poster image and product still.
7. Expose development hooks:
   - window.__bbLenis
   - window.__bbScrollTrigger
   - window.__bbBackgroundVideo
8. Run the dev server and verify the section in browser.
9. Run npm run build and fix any build errors.

After the build is complete, summarize:
- files created or modified
- how the scroll video system works
- how product fidelity was preserved
- how to run locally
- how to preview production build
- issues or limitations noticed
```
