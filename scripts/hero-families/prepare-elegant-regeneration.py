"""Prepare exact-SKU inputs and explicit body locks. No API calls or publication."""
import hashlib,json,shutil
from pathlib import Path
from PIL import Image
from psd_tools import PSDImage

ROOT=Path.cwd()
OUT=ROOT/'output/imagegen/elegant-2026-09-23'
DOC=ROOT/'docs/reviews/next-five-salvage-2026-09-23'
MASTER=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
W,H=2080,2288
BASE=.91*H
TARGETS={15:('Small',39),30:('Medium',43),60:('Large',47),100:('Extra Large',57)}
ASPECTS={15:1.358,30:1.381,60:1.253,100:1.517}
# Initial framing landmarks visually inspected on the exact hashed 360x396 previews.
# Final generated files require fresh pixel checks; these are not final approval.
FROST_VINTAGE={
 'GBElgFrst60AnSpGl':(141,284,176,360),
 'GBElgFrst60AnSpTslGl':(192,339,176,360),
 'GBElgFrst100AnSpGl':(131,281,133,360),
 'GBElgFrst100AnSpTslGl':(180,330,133,360),
}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text())

def main():
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'inputs').mkdir(exist_ok=True)
    registry=[r for r in read(ROOT/'src/lib/products/catalog-heroes.json') if r['family']=='Elegant']
    locks={r['sku']:r for r in read(ROOT/'docs/reviews/elegant-shoulder-alignment-2026-09-07.json')['rows']}
    ledger={r['sku']:r for r in read(ROOT/'src/lib/asset-ledger/ledger.json')['rows']}
    clear=Path('/Users/jordanrichter/.codex/visualizations/2026/09/22/01a0c7b7-e3c4-77d0-8bd4-8a91380759d0/family100/reference-clear.jpg')
    frost=ROOT.parent/'circle-round-empire-scale-2026-09-22/output/imagegen/frosted-circle-round-family/inputs/frosted-material-reference.jpg'
    refs={}
    for name,source in [('Clear',clear),('Frosted',frost)]:
        dest=OUT/'inputs'/f'{name.lower()}-material-reference.jpg';shutil.copyfile(source,dest);refs[name]=dest
    rows=[]
    for r in sorted(registry,key=lambda r:(r['capacityMl'],r['bottleColor'],r['websiteSku'])):
        sku=r['websiteSku'];old=locks[sku];source=ROOT/'public'/r['url'].lstrip('/')
        assert sha(source)==old['assetSha256'],sku
        tier,span=TARGETS[r['capacityMl']];lm=old['landmarks']
        if lm is None:
            left,right,shoulder,base=FROST_VINTAGE[sku]
            lm={'left':left,'right':right,'shoulder':shoulder,'base':base,'coordinateWidth':360,'coordinateHeight':396,'uncertaintyPx':3,'method':'Initial visual framing measurement on exact hashed preview; final generated image must be remeasured'}
        image=Image.open(source).convert('RGB');sw,sh=image.size
        sy=lm['shoulder']/lm['coordinateHeight']*sh
        by=lm['base']/lm['coordinateHeight']*sh
        cx=(lm['left']+lm['right'])/2/lm['coordinateWidth']*sw
        scale=H*span/100/(by-sy)
        # Preserve every component with one whole-scene transform, including shadow.
        wide='tassel' in r['alt'].lower() or 'bulb' in r['alt'].lower()
        tx=W*(.60 if wide else .44)-cx*scale;ty=BASE-by*scale
        frame=Image.new('RGB',(W,H),(245,243,239))
        resized=image.resize((round(sw*scale),round(sh*scale)),Image.Resampling.LANCZOS)
        frame.paste(resized,(round(tx),round(ty)))
        framed=OUT/'inputs'/f'{sku}-framed.png';frame.save(framed)
        entry=ledger[sku];recorded=entry['plate'].get('sourcePath')
        psd=MASTER/recorded if recorded and not recorded.startswith('http') else None
        composite=OUT/'inputs'/f'{sku}-master.png'
        if psd and psd.is_file():
            if not composite.exists():PSDImage.open(psd).topil().convert('RGB').save(composite)
            masterSource=psd;basis='exact catalog-mapped master PSD merged preview; visual review required'
        else:
            # The user reviewed this exact minaret assembly; preserve it as a legacy
            # geometry reference, never mislabel it as a recovered PSD.
            assert sku=='GBElg15MinarCu',sku
            shutil.copyfile(source,composite);masterSource=source;basis='user-reviewed legacy minaret hero; no verified master PSD found'
        material=refs[r['bottleColor']]
        seat=91-span
        materialText=('colorless transparent clear glass with believable refraction, controlled dark edge definition, realistic glass thickness and crisp dimensional highlights. No white paint, frosting or liquid' if r['bottleColor']=='Clear' else 'softly luminous satin frosted glass with restrained translucency, smooth directional light falloff and visible dimensional thickness. Avoid opaque white ceramic, plastic or chalky paint')
        prompt=(f'Edit image 1 into an elite premium ecommerce product photograph of this exact {r["capacityMl"]} mL {r["bottleColor"]} Elegant bottle and its exact original closure. '
                f'Image 1 is the composition and size guide. Image 2 is the exact product geometry and hardware reference; preserve the rectangular rounded-edge Elegant body, its real width-to-height proportions, neck, wall thickness, hardware finish, actuator design and every actual part. Image 3 controls GLASS MATERIAL ONLY, never bottle shape, camera or composition. '
                f'Match {materialText}. Use refined studio softbox lighting, coherent reflections, realistic metal, a gently grounded soft contact shadow and a seamless bone #F5F3EF surface. '
                f'The canvas is exactly 2080 by 2288 pixels. Glass foot baseline is y=2082 (91% from top). Glass shoulder is y={round(H*seat/100)} ({seat}% from top): shoulder-to-foot span {span}% of canvas height, size class {tier}. The shoulder is the outer glass-body shoulder, never the top of a cap or exposed threads. The body center is x={round(W*(.60 if wide else .44))}. '
                'Keep the entire bottle, closure, shadow, hose and tassel within the canvas without resizing the bottle to accommodate its hardware. Retain the exact component presentation in image 1: removable caps are sidecars when already shown beside the bottle; bulb and tassel sprayers remain connected complete assemblies; droppers and reducers remain seated. Preserve visible dip tubes and roller mechanisms from the exact source; do not invent parts. '
                f'The verified glass-body shoulder-to-foot height divided by glass width is approximately {ASPECTS[r["capacityMl"]]}; use the exact master geometry rather than distorting the body to hit a size. '
                'No labels, text, logos, decorative objects, extra bottles, enlarged caps, face flattening or geometry redesign. Preserve product identity while improving photographic realism.')
        if sku=='GBElg15MinarCu':
            prompt+=' For this minaret variant only, remove the original copper minaret cap and stand it upright to the right as a sidecar on the same ground. Image 4 shows the exact matching 15 mL bare-glass body and exposed neck; ignore its gold cap. Preserve the copper minaret design from image 2 at its real proportional size. Use the same Small 39% body span as the other 15 mL bottles.'
        promptFile=OUT/f'{sku}-prompt.txt';promptFile.write_text(prompt+'\n')
        row={'sku':sku,'family':'Elegant','capacityMl':r['capacityMl'],'catalog':{'websiteSku':sku,'graceSku':r['graceSku'],'groupSlug':r['groupSlug'],'color':r['bottleColor'],'applicator':entry.get('applicator')},'target':{'tier':tier,'shoulderPct':span,'baselinePct':91,'shoulderYFromTopPct':seat,'bodyCenterXPct':60 if wide else 44,'landmark':'glass shoulder','basis':'previously recorded Elegant-specific source-body targets, applied to user-requested S/M/L/XL sequence'},'sourceMeasurement':lm,'frameTransform':{'scale':scale,'x':tx,'y':ty},'sourceEvidence':basis,'currentSource':str(source),'currentSha256':sha(source),'masterSource':str(masterSource),'masterSha256':sha(masterSource),'masterComposite':str(composite),'framedInput':str(framed),'materialReference':str(material),'promptFile':str(promptFile),'rawOutput':str(OUT/f'{sku}-native-2080x2288.png'),'state':'prepared-needs-input-geometry-check'}
        row['inputSha256']={k:sha(row[k]) for k in ['framedInput','masterComposite','materialReference','promptFile']};rows.append(row)
        if sku=='GBElg15MinarCu':
            bare=next(v for v in registry if v['websiteSku']=='GBElg15Gl')
            row['bareBodyReference']=str(ROOT/'public'/bare['url'].lstrip('/'))
            row['inputSha256']['bareBodyReference']=sha(row['bareBodyReference'])
            row['imageInputs']=[row[k] for k in ['framedInput','masterComposite','materialReference','bareBodyReference']]
        print(sku,'prepared',flush=True)
    data={'model':'gpt-image-2.5-sunburst','quality':'high','requestedSize':[W,H],'generationAuthorizedBy':'User requested regeneration of all 33 Elegant images with Sunburst 2.5; Small through Extra Large, no Extra Small','targets':TARGETS,'rows':rows}
    (OUT/'manifest.json').write_text(json.dumps(data,indent=2)+'\n');(DOC/'elegant-regeneration-manifest.json').write_text(json.dumps(data,indent=2)+'\n')
    print('Prepared',len(rows),'API calls: 0')
if __name__=='__main__':main()
