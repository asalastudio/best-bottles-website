# Best Bottles — "Beautifully Contained"

A one-page, award-grade **scroll-cinematic** site for Best Bottles (beauty-packaging house).
Plain HTML / CSS / JS. No frameworks. The viral "3D scroll" effect is a **canvas
image-sequence scrub** — short cinematic sequences split into frames, painted onto a
full-viewport canvas at a frame index driven by scroll position.

## The hero mechanic — one body, endless tops
The site opens on an empty **square Empire flacon** on the void. As you scroll, **real
Best Bottles closures seat onto the same fixed neck one after another** — the body never
moves, only the top changes — climaxing on the antique bulb sprayer with its tassel. This
proves "interchangeable" by moving it, not stating it.

Every bottle and every closure on screen is a **real, orderable Best Bottles product** —
composited from the house's own studio photography. Nothing is AI-generated geometry.

## Run it
```bash
cd site
python3 -m http.server 8123
# open http://localhost:8123
```
Fonts (Cormorant Garamond + Inter) load from Google Fonts in production; there is a
graceful serif/sans fallback if the network is unavailable.

## Running order
1. **Cold open** — swing-in scrubs; the empty Empire locks in the right third; the
   `Beautifully contained.` wordmark letter-spaces in on the left.
2. **The combinations** — the swap cascade: real tops seat one after another, body pinned;
   a thin combination counter climbs to **2,285** (live-catalogue orderable SKUs).
3. **The light** — a live **WebGL** beat: a hard white beam descends, the clear glass
   becomes the prism, a full spectrum scatters across the void; one poetic line per step.
4. **The range** — one Empire multiplies into a constellation of real forms, then collapses.
5. **Reassembly** — held line: `One vessel. Endless expression.`
6. **Macro** — a slow glide across the real glass, threads, chrome collar and crimp.
7. **Specs** — a minimal two-column hairline grid.
8. **CTA** — request a sample kit / start a custom order.

## Architecture (`app.js`)
- **Loader** — preloads all 372 frames behind a chrome progress bar; scroll unlocks at 100%.
- **Smooth scroll** — a compact Lenis-style engine (`window.__bbLenis`) lerps a virtual
  scroll target from wheel / touch / keyboard.
- **Scrub** — each pinned `100vh` chapter maps its scroll progress to a frame index with
  lerp smoothing; `drawImage` uses cover-fit math and repaints only when the index changes
  (`requestAnimationFrame`, 60 fps target).
- **Refraction** — a GLSL fragment shader (beam → prism → dispersed spectrum + caustics),
  with a canvas-2d fallback if WebGL is unavailable.
- **Counter** — `bodies × closures × finishes`, easing to the real catalogue figure.
- **Dev hooks** — `__bbLenis`, `__bbScrollTrigger`, `__bbFrames`, `__bbRefraction`.

## Mobile & reduced motion (`< 768px` or `prefers-reduced-motion`)
The heavy canvas scrub is swapped for the pre-encoded **looping MP4s** in `media/`
(all-keyframe H.264), lazy-played on scroll into view, with poster fallbacks and
scroll-triggered reveals. No frame preload on mobile.

## Layout
```
site/
  index.html  styles.css  app.js
  frames/{swingin,cascade,range,macro}/frame_####.jpg   # the scrub sequences
  media/*.mp4  *-poster.jpg                              # mobile / reduced-motion fallback
  build/*.py                                             # the deterministic asset pipeline
  verify.mjs                                             # Playwright QA harness
```

## How the frames were made
`build/composite.py` places real Best Bottles studio photos onto the navy void by
**deviation transfer** — estimating each photo's beige backdrop, then transferring the
product's departure from it. Clear glass renders as authentic refraction on black; chrome,
gold and colour render solid. `build/prep_assets.py` cuts the Empire body and each closure;
`build/render_frames.py` composites the cascade, swing-in, range and macro sequences and
writes the JPEG frames. 100% deterministic NumPy/Pillow — no ML, no drift.
