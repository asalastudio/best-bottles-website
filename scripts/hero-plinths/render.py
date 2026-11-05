"""Photograph the plinth layout (compose.py) with gpt-image-2.5-sunburst: the seven bottles kept exactly as drawn, the
scene made real. Writes scripts/hero-plinths/out/render-<n>.png (1536 x 1024).
Usage: python3 scripts/hero-plinths/render.py [style|list,of,styles] [count]   (default: both styles, 2 each, in parallel)
"""
import base64, concurrent.futures, json, os, sys, time, urllib.error, urllib.request, uuid

OUT = "scripts/hero-plinths/out"
PROMPT = """Keep geometry locked to the image: the seven glass perfume bottles exactly as drawn — the same shapes, outlines,
proportions, sizes and positions, each on its own plinth, left to right: a faceted diamond-cut bottle, a tall slim
cylinder, a fluted footed bottle, a tall rectangular bottle, a round flat disc bottle, a short square bottle and a
teardrop bottle. Do not add, remove, reorder, resize or reshape any bottle. Every bottle wears the same glossy black cap.

Make it a luxury product photograph, the hero image of a fragrance packaging website:
- The bottles are clear, empty, raw glass: crisp refraction, thick clear bases, bright highlights and soft reflections,
  no liquid, no labels, no dip tubes.
- The plinths are honed travertine and warm bone plaster blocks of varying heights, with clean edges, set on a matching
  stone floor.
- Soft warm daylight from the left, a gentle window shadow falling across the back wall, soft contact shadows under
  every bottle and plinth, subtle caustics from the glass on the stone.
- Calm, minimal, editorial. Warm neutral palette: bone, sand, travertine, with the black caps as the only dark accents.
- The left 40% of the frame stays an uncluttered wall and floor for the headline text.
No people, no flowers, no props, no text, no logos."""


def key():
    for name in ("SUNBURST_OPENAI_API_KEY", "OPENAI_API_KEY"):
        k = os.environ.get(name)
        if not k and os.path.exists(".env.local"):
            for line in open(".env.local"):
                if line.startswith(f"{name}="):
                    k = line.split("=", 1)[1].strip().strip('"').strip("'")
        if k:
            return k
    raise SystemExit("SUNBURST_OPENAI_API_KEY is not set")


def edit(images, prompt, out, size="1536x1024"):
    b = uuid.uuid4().hex; body = b""
    for k, v in {"model": "gpt-image-2.5-sunburst", "prompt": prompt, "size": size, "quality": "high", "n": "1"}.items():
        body += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for path in images:
        body += (f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(path)}"\r\n'
                 "Content-Type: image/png\r\n\r\n").encode() + open(path, "rb").read() + b"\r\n"
    body += f"--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/edits", data=body,
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": f"multipart/form-data; boundary={b}"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.load(r)
            break
        except urllib.error.HTTPError as e:
            detail = e.read()[:300].decode(errors="replace")
            if e.code != 429 or "insufficient_quota" in detail or attempt == 3:
                raise SystemExit(f"Sunburst request failed for {out}: HTTP {e.code} {detail}")
            time.sleep(30 * (attempt + 1))
    open(out, "wb").write(base64.b64decode(d["data"][0]["b64_json"]))
    return out


# Jordan (4 Nov 2026), after the first renders: "make the stone plinths" luxury-fragrance-house level. Two directions;
# the bottles stay locked, only the plinths, room and light change.
LOCK = PROMPT.split("Make it a luxury")[0]
STYLES = {
    "tactile": LOCK + """Make it the hero photograph of a high-end apothecary fragrance house: quiet, tactile, architectural.
- The bottles are clear, empty, raw glass: crisp refraction, thick clear bases, bright highlights, no liquid, no labels,
  no dip tubes.
- The plinths are a considered set of sculptural pedestals in raw natural materials, each a different form and finish
  but one family: a rough-hewn sandstone block, a fluted plaster column, a honed travertine cylinder, a split-face
  limestone slab, a smooth warm-grey concrete cube, a stepped plinth with a rounded edge, a tall pale stone pillar.
  Hand-finished surfaces, visible chisel and tool marks, soft eased edges. Keep each plinth's top where the bottle
  stands at the same height as in the image.
- Room: a warm limewashed plaster wall with a shallow arched niche behind the group, matching stone floor.
- Light: soft low afternoon daylight from the left, long gentle shadows, warm amber glow on the stone, soft caustics
  from the glass. Muted earthy palette: sand, ochre, clay, warm grey; the black caps are the only dark accents.
- The left 40% of the frame stays a calm, light, uncluttered wall and floor for black headline text.
No people, no plants, no props, no text, no logos.""",
    "sculptural": LOCK + """Make it the hero photograph of an opulent luxury perfume house: monumental, sculptural, dramatic.
- The bottles are clear, empty, raw glass: crisp refraction, brilliant highlights, deep clear bases, no liquid, no
  labels, no dip tubes.
- The plinths are monumental carved stone pedestals of varying heights: polished cream and honey marble with soft
  veining, a fluted column drum, a rounded cylinder, stepped blocks with crisp bevelled edges, one darker warm-stone
  pedestal for contrast. Precise, gallery-grade craftsmanship. Keep each plinth's top where the bottle stands at the
  same height as in the image.
- Room: a tall warm stone wall with a deep arched alcove behind the group, polished stone floor with soft reflections.
- Light: a single low raking light from the left, rich chiaroscuro, warm golden highlights, deep soft shadows to the
  right; the glass glows with caustics on the stone.
- The left 40% of the frame stays a light, calm, uncluttered wall and floor so black headline text stays readable.
No people, no plants, no props, no text, no logos.""",
    "gallery": LOCK + """Make it the hero photograph of a contemporary design-led fragrance brand: crisp, bright, architectural.
- The bottles are clear, empty, raw glass: crisp refraction, thick clear bases, bright highlights, neutral (never
  tinted), no liquid, no labels, no dip tubes.
- The plinths are precise geometric pedestals of pale terrazzo with fine stone chips, honed white travertine and
  smooth bone-white microcement: cubes, a tall slender column, a low cylinder, a half-round, stepped blocks, all with
  razor-sharp edges. Keep each plinth's top where the bottle stands at the same height as in the image.
- Room: a bright white gallery with a warm white wall and a pale terrazzo floor.
- Light: clean soft north daylight from the left, crisp short shadows, clear glass sparkle.
- The left 40% of the frame stays a calm, light, uncluttered wall and floor for black headline text.
No people, no plants, no props, no text, no logos.""",
    "earth": LOCK + """Make it the hero photograph of a sun-drenched Mediterranean fragrance house: warm, earthy, handmade.
- The bottles are clear, empty, raw glass: crisp refraction, thick clear bases, bright highlights, neutral (never
  tinted), no liquid, no labels, no dip tubes.
- The plinths are rammed-earth and terracotta pedestals of varying heights: layered sandy rammed-earth blocks, a
  hand-formed terracotta cylinder, a sun-bleached limestone step, a clay plinth with a softly rounded top, raw
  unglazed textures. Keep each plinth's top where the bottle stands at the same height as in the image.
- Room: a warm ochre lime-plaster wall and a sandy stone floor.
- Light: strong low late-afternoon sun from the left, long crisp shadows, warm terracotta and sand tones, glowing caustics.
- The left 40% of the frame stays a calm, light, uncluttered wall and floor for black headline text.
No people, no plants, no props, no text, no logos.""",
    "water": LOCK + """Make it the hero photograph of a serene luxury fragrance house: calm, still, reflective.
- The bottles are clear, empty, raw glass: crisp refraction, thick clear bases, bright highlights, neutral (never
  tinted), no liquid, no labels, no dip tubes.
- The plinths are pale honed limestone and travertine pedestals of varying heights rising out of a shallow pool of
  perfectly still clear water; each plinth and bottle reflects in the mirror-calm surface. Monolithic, softly eased
  edges. Keep each plinth's top where the bottle stands at the same height as in the image.
- Room: a warm pale stone wall behind the pool; the water runs the full width of the floor.
- Light: soft diffused morning light from the left, gentle ripples of reflected light on the wall, quiet luminous tones.
- The left 40% of the frame stays a calm, light, uncluttered wall and floor for black headline text.
No people, no plants, no props, no text, no logos.""",
    "oak": LOCK + """Make it the hero photograph of a Scandinavian natural fragrance studio: soft, warm, honest materials.
- The bottles are clear, empty, raw glass: crisp refraction, thick clear bases, bright highlights, neutral (never
  tinted), no liquid, no labels, no dip tubes.
- The plinths are pale white-oak blocks with fine visible grain and softly rounded edges, mixed with a few pale
  sandstone blocks and a linen-wrapped plinth, varying heights, quiet and precise joinery. Keep each plinth's top where the bottle stands at the same height as in the image.
- Room: a soft natural linen backdrop with gentle folds, a pale oak floor.
- Light: soft hazy daylight from a large window on the left, gentle shadows, airy warm-neutral palette.
- The left 40% of the frame stays a calm, light, uncluttered wall and floor for black headline text.
No people, no plants, no props, no text, no logos.""",
}

if __name__ == "__main__":
    chosen = [name for name in (sys.argv[1].split(",") if len(sys.argv) > 1 else []) if name in STYLES] or list(STYLES)
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    jobs = [(name, i) for name in chosen for i in range(1, n + 1)]
    with concurrent.futures.ThreadPoolExecutor(len(jobs)) as pool:
        for path in pool.map(lambda job: edit([f"{OUT}/layout.png"], STYLES[job[0]], f"{OUT}/{job[0]}-{job[1]}.png"), jobs):
            print("wrote", path)
