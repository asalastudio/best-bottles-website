"""Recover exact master previews and provenance for a three-image Boston pilot."""
import hashlib,json,shutil
from pathlib import Path
from psd_tools import PSDImage
root=Path.cwd();out=root/'output/imagegen/boston-round-2026-09-23';(out/'inputs').mkdir(parents=True,exist_ok=True)
rows=json.loads((root/'docs/reviews/next-five-salvage-2026-09-23/intake.json').read_text())['rows']
master=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
refroot=Path('/Users/jordanrichter/.codex/visualizations/2026/09/22/01a0c7b7-e3c4-77d0-8bd4-8a91380759d0/family9')
locksource=Path('/Users/jordanrichter/Projects/Madison Studio/madison-app/.worktrees/hero-catalog-scale-plan-2026-09-22/src/lib/bestBottlesShoulderLock.ts')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
pilots={'GBBstnAmb15mlBlkCapSht':(42,1.947,'amber',[109,192,194,357]),'GBBstn1ozBlkCapSht':(45,1.727,'clear',[107,205,186,357]),'GBBstnBlu2ozBlkDropperShnGlTrim':(52,1.817,'cobalt',[124,241,147,358])}
allrows=[];selected=[]
for r in rows:
 if r['family']!='Boston Round':continue
 source=root/'public'/r['url'].lstrip('/');psd=master/r['sourcePath'];assert sha(source)==r['sha256'];assert psd.is_file()
 allrows.append({'sku':r['websiteSku'],'groupSlug':r['groupSlug'],'capacityMl':r['capacityMl'],'material':r['bottleColor'],'masterSource':str(psd),'masterSha256':sha(psd),'existingSha256':r['sha256'],'assessment':'Regenerate under user direction; retain exact source geometry. Existing family has inconsistent body sizes and cap presentations.'})
 if r['websiteSku'] not in pilots:continue
 sku=r['websiteSku'];span,aspect,material,lm=pilots[sku];composite=out/'inputs'/f'{sku}-master.png'
 if not composite.exists():PSDImage.open(psd).topil().convert('RGB').save(composite)
 reference=out/'inputs'/f'reference-{material}.jpg';shutil.copyfile(refroot/f'reference-{material}.jpg',reference)
 selected.append({'sku':sku,'catalog':r,'capacityMl':r['capacityMl'],'currentSource':str(source),'currentSha256':sha(source),'masterSource':str(psd),'masterSha256':sha(psd),'masterComposite':str(composite),'materialReference':str(reference),'target':{'shoulderPct':span,'baselinePct':91,'bodyAspect':aspect,'bodyCenterXPct':44 if material!='cobalt' else 50,'basis':'Recorded September 20 Boston-specific lock, not capacity-ratio scaling'},'sourceLandmarks':{'left':lm[0],'right':lm[1],'shoulder':lm[2],'base':lm[3],'coordinateWidth':360,'coordinateHeight':396,'uncertaintyPx':3,'method':'Visual initial guide measurement; generated output requires independent measurement'}})
(out/'source-intake.json').write_text(json.dumps({'family':'Boston Round','totalHeroes':29,'totalGroups':23,'allMastersFound':True,'lockSource':str(locksource),'lockSourceSha256':sha(locksource),'rows':allrows,'pilots':selected},indent=2)+'\n')
print('29 master paths and original image hashes checked; 3 exact master composites extracted')
