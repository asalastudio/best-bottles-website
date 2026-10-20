from pathlib import Path
import json,shutil,re,copy,xml.etree.ElementTree as E
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-lotion-completion';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'round78-lotion-complete';T.mkdir(exist_ok=True)
for f in ['after','before','source']:(T/f).mkdir(exist_ok=True)
rows=json.loads((O/'kits.json').read_text());assets=json.loads((O/'development-snapshot.json').read_text())['register']['plates'];N='http://www.w3.org/2000/svg';E.register_namespace('',N)
def node(tag,attrs={},text=None):
 el=E.Element('{'+N+'}'+tag,{k:str(v) for k,v in attrs.items()});el.text=text;return el
finishes=[('ShnSl','Shiny Silver'),('MtSl','Matte Silver'),('ShnGl','Shiny Gold'),('MtGl','Matte Gold'),('ShnBlk','Shiny Black'),('Cu','Copper'),('ClOvrCap','Clear Overcap')];cal=[]
for key,finish in finishes:
 root=node('svg',{'viewBox':'0 0 1100 730','width':1100,'height':730,'role':'img','aria-label':f'Clear and frosted Round 78 ml lotion pumps, {finish}, at the same scale'});root.append(node('rect',{'width':1100,'height':730,'fill':'#f5f3ef'}));root.append(node('line',{'x1':65,'x2':1050,'y1':620,'y2':620,'stroke':'#bcc8b6'}))
 for entry,ax in zip(sorted([e for e in rows if e['row']['capColor']==finish],key=lambda x:x['row']['color']),[280,760]):
  r=entry['row'];sku=r['websiteSku'];src=E.parse(O/(sku+'-assembly.svg')).getroot();body=next(e for e in src.iter() if e.get('data-builder-layer')=='body');bx,by,bs=[float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',body.get('transform'))];lm=assets[entry['kit']['register']['plateKey']]['anchors'];scale=400/((lm['baselineY']-lm['seatY'])*bs);axis=bx+lm['axisX']*bs;base=by+lm['baselineY']*bs
  g=node('g',{'id':r['color'].lower(),'transform':f'translate({ax} 620) scale({scale}) translate({-axis} {-base})'});prefix=r['color'].lower()+'-'
  for e in src.iter():
   for k,v in list(e.attrib.items()):
    if k=='id':e.set(k,prefix+v)
    elif 'url(#' in v:e.set(k,v.replace('url(#','url(#'+prefix))
  for child in src:
   if not child.tag.endswith('title'):g.append(copy.deepcopy(child))
  root.append(g);root.append(node('text',{'x':ax-65,'y':671,'font-size':23,'font-family':'Arial','fill':'#294333'},r['color']+' · 78 ml'));root.append(node('text',{'x':ax-65,'y':702,'font-size':13,'font-family':'Arial','fill':'#526455'},finish+' lotion pump'))
  cal.append({'sku':sku,'glass':r['color'],'bodyHeightPx':400,'baselineY':620,'uniformAssemblyScale':scale,'sourcePlateAnchors':lm})
  shutil.copy2(O/(sku+'-assembly.svg'),T/(sku+'-assembly.svg'))
  for suffix in ['builder','catalog','catalog-card']:shutil.copy2(O/(sku+'-'+suffix+'.png'),T/'after'/(sku+'-'+suffix+'.png'))
  shutil.copy2(O/(sku+'-source.png'),T/'source'/(sku+'.png'))
  for phase in ['before','after']:
   for p in (O/phase).glob(sku+'-*.png'):shutil.copy2(p,T/phase/p.name)
 (T/('scale-'+key+'.svg')).write_bytes(E.tostring(root,encoding='utf-8',xml_declaration=True))
(T/'scale-check.json').write_text(json.dumps(cal,indent=2))
h=(D/'round78-lotion-pilot/index.html').read_text()
h=h.replace('Round 78 ml / Two-bottle pilot','Round 78 ml / All lotion pumps').replace('Best Bottles · Round 78 ml · Local pilot','Best Bottles · Round 78 ml · Local completion').replace('Shiny Silver lotion pumps.','All seven pump options.')
h=h.replace('These two Shiny Silver bottles now have catalog images exported from their actual Builder assemblies.','All fourteen lotion-pump variants now have catalog images exported from their actual Builder assemblies.')
h=h.replace('<a href="matched-scale.svg" target="_blank"><img src="matched-scale.svg" alt="Clear and frosted Round bottles at equal scale, with aligned glass bases"></a>','<div class="controls" id="finishes">'+''.join(f'<button data-finish="{key}">{name}</button>' for key,name in finishes)+'</div><a id="scale-link" href="scale-ShnSl.svg" target="_blank"><img id="scale" src="scale-ShnSl.svg" alt="Clear and frosted Round lotion bottles at equal scale"></a>')
h=h.replace('Only these two Shiny Silver SKUs receive new catalog images. The other twelve lotion-pump variants retain their previous local state while you review this pair.','The accepted Shiny Silver pair is unchanged. Twelve additional variants now have matching catalog imagery, including the matte silver pumps with clear overcaps. The complete set remains local for review.')
h=h.replace('This pilot preserves that subtle appearance.','The complete set preserves that subtle appearance.').replace('This pilot retains the separate lotion-pump source mechanism.','This set retains the separate lotion-pump source mechanism.')
h=h.replace('The native photos show the exact Shiny Silver bottle assemblies.','The native photos show each exact bottle assembly.')
a=h.index('<details>');b=h.index('<footer>',a)
h=h[:a]+'''<details><summary>Source evidence and verification</summary><p>Fresh production and development records were read for both lotion groups. All fourteen exact SKUs are confirmed on current Best Bottles product pages reached through observed category and finish-selector links. All 56 gallery views were recovered and 28 exact-SKU capped and uncapped PSDs inspected. This resolves the earlier six-SKU gap in the older Nemat listing.</p><p>The frosted raw rows label the finish Frosted. Each local export retains the raw value and uses the finish verified by its registered component and exact product page. All fourteen existing assemblies retain their glass, pump, tube geometry and source pixels. The tube remains the recovered Round Matte Gold lotion source, shared across finishes. Physical fit has not been newly measured. No backend metadata was changed.</p><p>Fourteen exact-SKU product pages passed all three views, along with fourteen Builder configurations, fourteen catalog selections, both seven-option selectors and phone layouts. Automated checks confirm accepted-pair pixel preservation and exclusion from production and Vercel.</p><p><a href="REPORT.md">Local report</a> · <a href="verification.json">Verification records</a> · <a href="legacy/receipts.json">Exact-SKU source evidence</a> · <a href="implementation-bundle.zip">Implementation bundle</a></p></details>'''+h[b:]
h=h.replace('This pair is visually accepted locally. The remaining finishes are being prepared for separate review.','The accepted Shiny Silver pair is retained. The other twelve variants are ready for visual review.')
h=h[:h.index('<script>')]+'''<script>
let surface='sidecar',glass='Frosted',finish='ShnSl';const names={ShnSl:'Shiny Silver',MtSl:'Matte Silver',ShnGl:'Shiny Gold',MtGl:'Matte Gold',ShnBlk:'Shiny Black',Cu:'Copper',ClOvrCap:'Clear Overcap'};const sku=g=>`LBRnd${g==='Clear'?'':'Frst'}78Ltn${finish}`;
function render(){document.querySelector('#scale').src=`scale-${finish}.svg`;document.querySelector('#scale-link').href=`scale-${finish}.svg`;document.querySelector('#pair').innerHTML=['Clear','Frosted'].map(g=>{const src=surface==='source'?`source/${sku(g)}.png`:`after/${sku(g)}-${surface}.png`;return `<figure><figcaption>${g} · ${names[finish]} · ${sku(g)}</figcaption><a href="${src}" target="_blank"><img src="${src}" alt="${g} Round ${names[finish]} ${surface}"></a></figure>`}).join('');document.querySelector('#compare').innerHTML=['source','after'].map(phase=>{const src=phase==='source'?`source/${sku(glass)}.png`:`after/${sku(glass)}-sidecar.png`;return `<figure><figcaption>${phase==='source'?'Native source':'Local assembly'} · ${glass} · ${names[finish]}</figcaption><a href="${src}" target="_blank"><img src="${src}" alt="${phase} ${glass} assembly"></a></figure>`}).join('');document.querySelectorAll('[data-surface]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.surface===surface));document.querySelectorAll('[data-glass]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.glass===glass));document.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.finish===finish));const links=document.querySelectorAll('.links a');links[0].href=`http://localhost:3007/products/round-78ml-clear-18-415-lotionpump?sku=${sku('Clear')}`;links[1].href=`http://localhost:3007/products/round-78ml-frosted-18-415-lotionpump?sku=${sku('Frosted')}`;}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.surface)surface=b.dataset.surface;if(b.dataset.glass)glass=b.dataset.glass;if(b.dataset.finish)finish=b.dataset.finish;render()});render();
</script></body></html>'''
(T/'index.html').write_text(h);print(T)
