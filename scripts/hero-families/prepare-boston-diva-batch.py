"""Prepare the user-requested 26 Boston + 21 Diva edits without making API calls."""
import hashlib, json, shutil
from pathlib import Path
from psd_tools import PSDImage

ROOT = Path.cwd()
OUT = ROOT / 'output/imagegen/boston-diva-2026-09-23'
(OUT / 'inputs').mkdir(parents=True, exist_ok=True)
digest = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
intake = json.loads((ROOT / 'docs/reviews/next-five-salvage-2026-09-23/intake.json').read_text())['rows']
diva = {r['sku']: r for r in json.loads((ROOT / 'docs/reviews/diva-family-final-manifest-2026-09-06.json').read_text())['rows']}
scale = json.loads((ROOT / 'output/shoulder-lock-review-2026-09-23/manifest.json').read_text())
guides = {(f['family'], r['capacityMl']): r for f in scale['families'] for r in f['rows']}
master_root = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
reference_root = Path('/Users/jordanrichter/.codex/visualizations/2026/09/22/01a0c7b7-e3c4-77d0-8bd4-8a91380759d0/family9')
preserved = {'GBBstnAmb15mlBlkCapSht', 'GBBstn1ozBlkCapSht', 'GBBstnBlu2ozBlkDropperShnGlTrim'}
rows = []
for catalog in intake:
    family, sku, capacity = catalog['family'], catalog['websiteSku'], catalog['capacityMl']
    if family not in ('Boston Round', 'Diva') or sku in preserved:
        continue
    source = ROOT / 'public' / catalog['url'].lstrip('/')
    assert digest(source) == catalog['sha256'], sku
    master = Path(diva[sku]['sourcePsd']) if family == 'Diva' else master_root / catalog['sourcePath']
    master_hash = digest(master)
    if family == 'Diva':
        assert master_hash == diva[sku]['sourcePsdSha256'], (sku, 'changed Diva master')
    composite = OUT / 'inputs' / f'{sku}-master.png'
    if not composite.exists():
        PSDImage.open(master).topil().convert('RGB').save(composite)
    material = {'Clear':'clear', 'Amber':'amber', 'Cobalt Blue':'cobalt', 'Frosted':'frosted'}[catalog['bottleColor']]
    reference = OUT / 'inputs' / f'reference-{material}.jpg'
    if not reference.exists():
        shutil.copyfile(reference_root / f'reference-{material}.jpg', reference)
    guide = guides[(family, capacity)]
    scale_image = ROOT / guide['preview']
    assert digest(scale_image) == guide['previewSha256']
    if 'Tsl' in sku:
        mechanism = 'Keep the exact connected vintage bulb, hose, tassel and collar assembly. Preserve its specific color, hardware, hose route and tassel design. The bulb, hose and tassel remain connected and must not become detached sidecars. Fit all of this complete assembly with generous canvas margins; shift the bottle horizontally if needed, never shrink its body to fit.'
    elif 'AnSp' in sku:
        mechanism = 'Keep the exact vintage bulb sprayer attached as one complete assembly, with the original gold hardware and textured bulb. Do not detach any part or add a sidecar cap.'
    elif any(t in sku for t in ('Dropper','Drp','Drpr')):
        mechanism = 'Keep the exact dropper attached, including its original bulb color, collar finish and a complete realistic pipette inside the bottle. Preserve those colors from the exact SKU master, even if the size guide differs. No sidecar for the dropper.'
    elif 'Roll' in sku:
        ball = 'polished METAL roller ball' if 'Mtl' in sku else 'white PLASTIC roller ball'
        mechanism = f'Show the {ball} correctly seated in its original roller housing. Remove its screw cap and stand that exact cap beside the bottle to the right on the same ground plane. Preserve the cap finish and original roller design from image 2. The metal/plastic distinction is essential; do not substitute one for the other.'
    elif 'Rdcr' in sku:
        mechanism = 'Keep the reducer closure assembled and seated exactly as the product identity image and exact PSD master show it. Preserve the original shiny gold finish and detailed cap design. Do not turn it into a pump, sprayer or dropper.'
    elif 'Spry' in sku or 'Ltn' in sku:
        kind = 'lotion pump' if 'Ltn' in sku else 'perfume sprayer'
        mechanism = f'Keep the exact {kind} exposed and correctly seated, preserving the original nozzle, actuator, collar and finish. Its removable overcap stands beside the bottle to the right on the same ground plane. Show the complete dip tube through clear glass; through frost it is subtly diffused. Do not confuse lotion and spray actuators or invent different hardware.'
    else:
        mechanism = 'Show the empty bottle uncapped with the exact short black ribbed screw cap standing beside it to the right on the same surface. Preserve the exposed neck and threads. No roller, sprayer or dropper.'
    shape = ('Preserve Boston Round cylindrical walls, softly rounded shoulders, exact neck and substantial base. Never make it spherical or a flattened circle.' if family == 'Boston Round' else 'Preserve the distinctive ornate Diva urn geometry: narrow upper neck, curved shoulders, fluted/scalloped sculpted body, taper and exact pedestal foot. Preserve every flute and its depth. Do not replace it with a smooth round, cylinder or circle bottle. Preserve the flutes even in frosted glass.')
    glass = {'clear':'Neutral colorless transparent clear glass: realistic wall thickness, crisp controlled edge reflections, luminous transmission and restrained refraction; no smoky cast or liquid.', 'amber':'Rich transparent brown amber glass, darker edges and luminous warm interior. Never opaque paint, pale orange plastic or filled liquid.', 'cobalt':'Deep saturated transparent cobalt blue glass, naturally darker edges and transmitted blue light. Never opaque painted plastic or electric neon.', 'frosted':'Premium acid-etched frosted glass with fine satin diffusion, translucent depth and soft curved light gradients. Never opaque chalk-white ceramic or plastic. Keep sculptural glass contours legible.'}[material]
    upper = round(2288 * guide['upperYPercent'] / 100)
    prompt = f'''Create a premium, realistic ecommerce studio photograph of the exact {capacity} mL {catalog['bottleColor']} {family} SKU {sku}.
REFERENCE ROLES: Image 1 is the exact product identity and composition: preserve its bottle and specific components. Image 2 is that SKU's exact master PSD composite: it is authoritative for original geometry, hardware and component colors. Image 3 is GLASS MATERIAL ONLY: transfer its optical material quality, never its bottle shape, proportions, neck, hardware or props. Image 4 is the approved SAME-CAPACITY family body-scale guide ONLY: match its glass body height and vertical landmarks, never transfer its different closure or material. Modernize lighting/material realism while retaining exact product identity.
{shape}
{mechanism}
{glass}
LOCKED FRAMING: native canvas exactly 2080 x 2288. Actual glass foot at y=2082 (91% from top). {guide['landmark']} at y={upper} ({guide['upperYPercent']}% from top); body landmark-to-foot span {guide['spanPct']}% of canvas height. Match image 4's GLASS BODY height and natural proportions, excluding hardware above the junction. Do not resize the body based on total assembly bounds. Keep the complete assembly and its soft shadow inside canvas; do not crop caps, bulbs, hoses or tassels. Keep the bottle upright, straight front view and undistorted. Cap and bottle sit naturally on the same surface.
Restrained elite ecommerce lighting: broad coherent softbox highlights, defined shape, clean metal, realistic transparent/etched glass and subtle grounded contact shadow with soft falloff. Empty bottle; no colored liquid, labels, logos, text, guide lines, props, horizon or mirror-floor reflection. Uniform seamless bone sRGB #F5F3EF RGB(245,243,239) background across all empty areas and edges, with no tint, gradient or vignette. The localized natural shadow must remain. Output one finished photograph, no collage.'''
    prompt_file = OUT / f'{sku}-prompt.txt'
    prompt_file.write_text(prompt + '\n')
    row = {'sku':sku, 'family':family, 'capacityMl':capacity, 'material':material, 'catalog':catalog,
           'currentSource':str(source), 'masterSource':str(master), 'masterSha256':master_hash,
           'masterComposite':str(composite), 'materialReference':str(reference), 'scaleReference':str(scale_image),
           'promptFile':str(prompt_file), 'rawOutput':str(OUT / f'{sku}-native-2080x2288.png'),
           'target':{'spanPct':guide['spanPct'], 'upperY':upper, 'baseY':2082, 'landmark':guide['landmark']},
           'catalogPublicationHold':None if catalog['catalogIdentityFound'] and catalog['shopifyVariantId'] else 'Catalog identity or Shopify variant association is incomplete in intake. Reconcile exact SKU before publication; source artwork is verified.'}
    row['imageInputs'] = [row[k] for k in ('currentSource','masterComposite','materialReference','scaleReference')]
    row['inputSha256'] = {k:digest(row[k]) for k in ('currentSource','masterComposite','materialReference','scaleReference','promptFile')}
    rows.append(row)
    print(f'{len(rows)} prepared: {sku}', flush=True)
assert len(rows) == 47
manifest = {'model':'gpt-image-2.5-sunburst', 'quality':'high', 'requestedSize':[2080,2288], 'background':'#F5F3EF',
            'authorization':'User requested rendering the remaining 26 Boston Round heroes and the complete Diva family together, then final review sheets.',
            'reusedBostonPilots':sorted(preserved), 'rows':rows}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Ready: 26 Boston Round + 21 Diva; no API calls made.')
