# Best Bottles Claude + Higgsfield Scroll Motion Prompt Pack

Source video ingested: **Claude Fable 5 + Higgsfield MCP Built This Motion Website** by Code And Create, 11:35, https://www.youtube.com/watch?v=N5JeyaqIa7c

Project skill created at:

```text
.claude/skills/best-bottles-scroll-motion-website/SKILL.md
```

## What the video workflow does well

The BurgerLab video is useful because it demonstrates a complete creative-to-code chain instead of a one-shot design prompt:

1. Connect Higgsfield MCP to Claude so Claude can generate media directly.
2. Install a project-specific skill before asking the agent to build.
3. Create folders and planning documents first.
4. Generate still images before video, using the main hero image as a consistency anchor.
5. Generate one cinematic 8 to 12 second background video designed for scroll scrubbing.
6. Build a React landing page with GSAP, ScrollTrigger, Lenis, and a video whose `currentTime` is mapped to scroll position.
7. Re-encode the video for frame-by-frame scrubbing.
8. Run the dev server and production build before calling the work complete.

## What changes for Best Bottles

BurgerLab can safely use generated burger imagery because the product is fictional. Best Bottles cannot use freeform product generation for production because bottle geometry, caps, closures, transparent glass edges, applicators, and labels must remain exact.

Best Bottles adaptation:

- Use approved Madison/master product images as product truth.
- Preserve product pixels and geometry in final website overlays.
- Generate or animate backgrounds, reflections, caustics, and atmosphere, not final product geometry.
- Treat product-aware generated videos as concept-only unless manually approved.
- Keep all web copy as HTML/CSS, never baked into media.
- Build in the existing Next.js app, not a new Vite app, unless a detached prototype is requested.

## Ready-to-use Claude prompt 1: install the skill

```text
I added a project skill file for the Best Bottles scroll motion website workflow at:
.claude/skills/best-bottles-scroll-motion-website/SKILL.md

Please inspect the skill file, install it correctly for this Claude Code project, and confirm that the skill is available before we start the actual build.

Do not generate media yet.
Do not build the website yet.
For now, only install the skill and summarize what it will help with in this project, especially the Best Bottles product-fidelity constraints.
```

## Ready-to-use Claude prompt 2: create the workspace

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

## Ready-to-use Claude prompt 3: prepare references

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

## Ready-to-use Claude prompt 4: create still assets

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

## Ready-to-use Claude prompt 5: generate the video motion plate

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

## Ready-to-use Claude prompt 6: build the website section

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

## Short creative direction for the animation

**Name:** The Glass Lineup Reveal

**One-line idea:** A luminous, premium glass studio motion plate scrubs with scroll while exact Best Bottles product overlays glide into a clean family lineup.

**Why this is better for Best Bottles:** It keeps the scroll-stopping cinematic effect from BurgerLab but avoids letting AI redraw products. The magic comes from caustics, light sweeps, reflections, parallax, pinned sections, and crisp product overlays from approved source images.

## Media safety decision

Recommended final architecture:

```text
AI-generated video = atmosphere only
Approved product PNGs = exact product layer in the website
HTML/CSS = all text and CTA UI
GSAP/ScrollTrigger = scroll progress and reveal timing
Lenis = smooth scroll if compatible
```

This gives the Best Bottles site the BurgerLab-style premium motion without sacrificing catalog trust.
