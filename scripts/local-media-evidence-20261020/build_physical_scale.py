from pathlib import Path
import xml.etree.ElementTree as E
import json,re,copy,shutil
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot')
R=Path('/private/tmp/best-bottles-empire-alpha-20261019')
if not (D.parent/'empire-both-review-v3').exists():shutil.copytree(D,D.parent/'empire-both-review-v3')
N='http://www.w3.org/2000/svg';E.register_namespace('',N)
def node(tag,attrs={},text=None):
 e=E.Element('{'+N+'}'+tag,{k:str(v) for k,v in attrs.items()});e.text=text;return e
def text(root,x,y,content,size=16,color='#536459'):
 root.append(node('text',{'x':x,'y':y,'font-size':size,'fill':color,'font-family':'Arial, sans-serif'},content))
root=node('svg',{'xmlns':N,'viewBox':'0 0 1100 820','width':1100,'height':820,'role':'img','aria-label':'Empire 50 ml and 100 ml at one physical scale, aligned at the glass base'})
# ElementTree adds xmlns itself.
root.attrib.pop('xmlns')
root.append(node('rect',{'width':1100,'height':820,'fill':'#f5f3ef'}))
base=660;ppm=4;records=[];sprayers=[]
for mm in range(0,151,10):
 y=base-mm*ppm
 root.append(node('line',{'x1':90,'x2':1030,'y1':y,'y2':y,'stroke':'#dedfd6','stroke-width':1}))
 text(root,48,y+5,str(mm),12)
text(root,44,38,'mm',12)
for size,ax,file in [(50,300,'catalog-50-assembly.svg'),(100,760,'catalog-assembly.svg')]:
 source=E.fromstring((D/file).read_text())
 asset=next(a for a in json.loads((R/'src/lib/register/local-empire-bare-glass.json').read_text()) if f'-{size}ml-' in a['plateKey'])
 body=next(e for e in source.iter() if e.get('data-builder-layer')=='body')
 tr=body.get('transform');nums=[float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',tr)];bx,by,bs=nums
 lm=asset['landmarks'];height=asset['physicalGuide']['heightMm'];stageHeight=(lm['baselineY']-lm['seatY'])*bs;stagePxPerMm=stageHeight/height;scale=ppm/stagePxPerMm
 axis=bx+lm['axisX']*bs;baseline=by+lm['baselineY']*bs
 group=node('g',{'id':f'assembly-{size}','transform':f'translate({ax} {base}) scale({scale}) translate({-axis} {-baseline})'})
 # Namespace each clip ID so the two unmodified assemblies can coexist.
 for e in source.iter():
  for key,value in list(e.attrib.items()):
   if key=='id':e.set(key,f's{size}-'+value)
   elif 'url(#' in value:e.set(key,value.replace('url(#','url(#s'+str(size)+'-'))
 for child in source:
  if child.tag.endswith('title'):continue
  group.append(copy.deepcopy(child))
 root.append(group)
 top=base-height*ppm;dx=ax-110
 root.append(node('path',{'d':f'M {dx+7} {top} H {dx} V {base} H {dx+7}','fill':'none','stroke':'#9b7e49','stroke-width':1.5}))
 text(root,dx-59,(top+base)/2,f'{height} mm',13,'#82683d')
 text(root,ax-20,718,f'{size} ml',24,'#26372e')
 text(root,ax-82,746,f'{height} × {asset["physicalGuide"]["widthMm"]} mm glass',14)
 text(root,ax-82,770,'Recorded guide' if size==50 else 'User-confirmed dimensions',12)
 spray=next(e for e in source.iter() if e.get('data-builder-layer')=='sprayer')
 ss=float(re.findall(r'scale\(([^)]+)\)',spray.get('transform'))[-1])
 record={'sizeMl':size,'glassHeightMm':height,'glassWidthGuideMm':asset['physicalGuide']['widthMm'],'sourceStageGlassHeight':stageHeight,'sourceStagePxPerMm':stagePxPerMm,'renderPxPerMm':ppm,'uniformAssemblyScale':scale,'renderGlassHeightPx':stageHeight*scale,'baselineY':base,'sprayerCanvasWidthMm':float(spray.get('width'))*ss/stagePxPerMm,'sprayerCanvasHeightMm':float(spray.get('height'))*ss/stagePxPerMm}
 records.append(record);sprayers.append((size,copy.deepcopy(spray),ss/stagePxPerMm))
text(root,90,805,'One shared scale · glass bases aligned · complete assemblies scaled uniformly · no asset pixels changed',13)
(D/'physical-scale.svg').write_bytes(E.tostring(root,encoding='utf-8',xml_declaration=True))
# Separate hardware display at the same physical scale, preserving current assembly calibration.
sroot=node('svg',{'viewBox':'0 0 1100 320','width':1100,'height':320,'role':'img','aria-label':'The same Matte Gold sprayer source, at each current assembly calibration'})
sroot.append(node('rect',{'width':1100,'height':320,'fill':'#f5f3ef'}))
for (size,spray,smm),ax in zip(sprayers,[300,760]):
 width=float(spray.get('width'))*smm*ppm;height=float(spray.get('height'))*smm*ppm
 spray.attrib.pop('transform',None);spray.set('x',str(ax-width/2));spray.set('y',str(242-height));spray.set('width',str(width));spray.set('height',str(height));sroot.append(spray)
 text(sroot,ax-76,282,f'{size} ml assembly sprayer',14)
sroot.append(node('line',{'x1':90,'x2':1030,'y1':242,'y2':242,'stroke':'#c4cbbf'}))
(D/'physical-sprayers.svg').write_bytes(E.tostring(sroot,encoding='utf-8',xml_declaration=True))
difference=(records[0]['sprayerCanvasHeightMm']/records[1]['sprayerCanvasHeightMm']-1)*100
receipt={'method':'Uniformly scale each existing Builder assembly by its registered glass rim-to-base height, using 88 mm for 50 ml and 107 mm for 100 ml; align glass bases. All child transforms and source image bytes retained.','records':records,'sprayerScaleDifferencePercent50Over100':difference,'hardwareCaveat':'Same exact sprayer image; approximately %.1f%% difference remains in assembly calibration. This is a drawing comparison, not a physical hardware measurement.'%difference}
(D/'physical-scale-calibration.json').write_text(json.dumps(receipt,indent=2)+'\n')
html=(D/'index.html').read_text();start=html.index('<section class="hero"');end=html.index('<section class="catalog">',start)
html=html[:start]+'''<section id="physical-scale"><h2>One physical scale</h2><p class="sub">Glass bases aligned. Every part of each existing assembly scales together using 88 mm and 107 mm glass heights.</p><a href="physical-scale.svg" target="_blank"><img class="physical" src="physical-scale.svg" alt="Both Empire sizes at the same physical scale"></a><div class="note"><p><strong>50 ml:</strong> Uses the recorded 88 × 37 mm guide, which has not been remeasured this session.</p><p><strong>100 ml:</strong> Uses your confirmed 107 × 46 mm glass dimensions.</p><p>The widths remain as drawn; no artwork was stretched to force a match. Screen size changes the display magnification equally for both bottles.</p></div></section>
<section><h2>Sprayers at the same scale</h2><p class="sub">Both use the same exact Matte Gold sprayer image. The current 50 ml assembly renders it about %.1f%% larger after glass-height calibration. That small placement-scale difference is shown here unchanged; these are not measured hardware dimensions.</p><img class="physical" src="physical-sprayers.svg" alt="Both sprayers at a shared scale"></section>
<details><summary>Individually framed catalog exports</summary><div class="columns"><figure><figcaption>Empire 50 ml</figcaption><a class="frame" href="assembly-50.png"><img src="assembly-50.png" alt="50 ml catalog export"></a></figure><figure><figcaption>Empire 100 ml</figcaption><a class="frame" href="assembly-100.png"><img src="assembly-100.png" alt="100 ml catalog export"></a></figure></div></details>
'''%difference+html[end:]
html=html.replace('Revision 3','Revision 4').replace('Both sizes, consistent across the site.','Both sizes, at the same scale.').replace('The 50 ml now uses its continuous Photoshop dip tube and a catalog image exported from the same assembly as the product page and Builder. The corrected 100 ml assembly is retained alongside it.','Compare the current 50 ml and 100 ml assemblies against one millimeter grid. The catalog, product page, and Builder captures remain below for reference.').replace('</style>','.physical{width:100%;height:auto;max-height:none}#physical-scale{overflow:hidden}</style>')
html=html.replace('<a href="REPORT.md">Handoff notes</a>','<a href="physical-scale-calibration.json">Scale calculations</a> · <a href="REPORT.md">Handoff notes</a>')
(D/'index.html').write_text(html)
with (D/'REPORT.md').open('a') as f:f.write('\n## Revision 4: common physical scale\n\nAdded a shared-scale review using the existing Builder assembly SVGs, with glass heights calibrated to 88 mm and 107 mm. Both glass bases align at y=660 on a 4 SVG-pixel-per-mm grid. Every child layer scales uniformly; source pixels and component placement remain unchanged. The 50 ml dimensions remain an unverified recorded guide. Catalog, PDP, and Builder implementation files were not changed in this revision.\n\nThe identical source sprayer is %.2f%% larger in the 50 ml assembly after glass-height calibration. The comparison preserves and discloses that residual calibration difference instead of silently resizing the hardware. It is not a hardware measurement. See physical-scale-calibration.json.\n'%difference)
print(json.dumps(receipt,indent=2))
