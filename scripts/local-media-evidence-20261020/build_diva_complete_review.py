from pathlib import Path
import json,shutil,re,copy,xml.etree.ElementTree as E
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/diva46-spray-completion';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'diva46-complete';T.mkdir(exist_ok=True)
for f in ['after','before','source']:(T/f).mkdir(exist_ok=True)
rows=json.loads((O/'kits.json').read_text());assets=json.loads((O/'development-snapshot.json').read_text())['register']['plates'];N='http://www.w3.org/2000/svg';E.register_namespace('',N)
def node(tag,attrs={},text=None):
 el=E.Element('{'+N+'}'+tag,{k:str(v) for k,v in attrs.items()});el.text=text;return el
finishes=[('ShnSl','Shiny Silver'),('MtSl','Matte Silver'),('ShnGl','Shiny Gold'),('MtGl','Matte Gold'),('ShnBlk','Shiny Black'),('Cu','Copper')];cal=[]
for key,finish in finishes:
 root=node('svg',{'viewBox':'0 0 1100 730','width':1100,'height':730,'role':'img','aria-label':f'Clear and frosted Diva 46 ml, {finish}, at the same scale'});root.append(node('rect',{'width':1100,'height':730,'fill':'#f5f3ef'}));root.append(node('line',{'x1':65,'x2':1050,'y1':620,'y2':620,'stroke':'#bcc8b6'}))
 for entry,ax in zip(sorted([e for e in rows if e['row']['capColor']==finish],key=lambda x:x['row']['color']),[280,760]):
  r=entry['row'];sku=r['websiteSku'];src=E.parse(O/(sku+'-assembly.svg')).getroot();body=next(e for e in src.iter() if e.get('data-builder-layer')=='body');bx,by,bs=[float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',body.get('transform'))];lm=assets[entry['kit']['register']['plateKey']]['anchors'];scale=400/((lm['baselineY']-lm['seatY'])*bs);axis=bx+lm['axisX']*bs;base=by+lm['baselineY']*bs
  g=node('g',{'id':r['color'].lower(),'transform':f'translate({ax} 620) scale({scale}) translate({-axis} {-base})'});prefix=r['color'].lower()+'-'
  for e in src.iter():
   for k,v in list(e.attrib.items()):
    if k=='id':e.set(k,prefix+v)
    elif 'url(#' in v:e.set(k,v.replace('url(#','url(#'+prefix))
  for child in src:
   if not child.tag.endswith('title'):g.append(copy.deepcopy(child))
  root.append(g);root.append(node('text',{'x':ax-65,'y':671,'font-size':23,'font-family':'Arial','fill':'#294333'},r['color']+' · 46 ml'));root.append(node('text',{'x':ax-65,'y':702,'font-size':13,'font-family':'Arial','fill':'#526455'},finish+' spray'))
  cal.append({'sku':sku,'glass':r['color'],'bodyHeightPx':400,'baselineY':620,'uniformAssemblyScale':scale,'sourcePlateAnchors':lm})
  shutil.copy2(O/(sku+'-assembly.svg'),T/(sku+'-assembly.svg'))
  for suffix in ['builder','catalog','catalog-card']:shutil.copy2(O/(sku+'-'+suffix+'.png'),T/'after'/(sku+'-'+suffix+'.png'))
  shutil.copy2(O/(sku+'-source.png'),T/'source'/(sku+'.png'))
  for phase in ['before','after']:
   for p in (O/phase).glob(sku+'-*.png'):shutil.copy2(p,T/phase/p.name)
 (T/('scale-'+key+'.svg')).write_bytes(E.tostring(root,encoding='utf-8',xml_declaration=True))
(T/'scale-check.json').write_text(json.dumps(cal,indent=2))
# Retain the approved pilot's visual language and replace its controls with the full finish set.
h=(D/'diva46-pilot/index.html').read_text()
h=h.replace('Diva 46 ml / Two-bottle pilot','Diva 46 ml / All spray finishes').replace('Best Bottles · Diva 46 ml · Local pilot','Best Bottles · Diva 46 ml · Local completion')
h=h.replace('Clear and frosted.<br>One Shiny Silver assembly.','Clear and frosted.<br>All six spray finishes.')
h=h.replace('These two Shiny Silver bottles now have catalog images exported from their actual Builder assemblies. The existing local Diva glass, hardware and tube placement are preserved.','All twelve standard spray variants now have catalog images from their matching Builder assemblies. The approved glass, hardware and shared-source tube treatment is retained across both glass colors.')
h=h.replace('<a href="matched-scale.svg" target="_blank"><img src="matched-scale.svg" alt="Clear and frosted Diva bottles at equal scale, with aligned glass bases"></a>','<div class="controls" id="finishes">'+''.join(f'<button data-finish="{key}">{name}</button>' for key,name in finishes)+'</div><a id="scale-link" href="scale-ShnSl.svg" target="_blank"><img id="scale" src="scale-ShnSl.svg" alt="Clear and frosted Diva bottles at equal scale, with aligned glass bases"></a>')
h=h.replace('All twelve standard sprays now have matching catalog imagery. The accepted Shiny Silver pair is unchanged. Antique sprayers and tassels remain outside this pass.','The approved Shiny Silver pair is retained. Copper, Matte Gold, Matte Silver, Shiny Gold and Shiny Black now have matching catalog imagery and verified assemblies in both glass colors. The full set remains local for your review.')
h=h.replace('<button data-surface="source">Original source photo</button>','<button data-surface="catalog">Catalog image</button>')
h=h.replace('This pilot preserves that subtle appearance.','The completed set preserves that subtle appearance.')
h=h.replace('id="compare"','id="compare"')
h=h.replace('The small gap under the sprayer came from transparent padding in its image. The source tube is now seated against the visible lower edge. Its shape and length are unchanged.','Each before view shows the state before this extension. The Shiny Silver pair is unchanged from your approved pilot. The other ten variants now join at the visible sprayer edge; tube shape, length and glass geometry are retained.')
h=h.replace('All twelve exact-SKU product pages, both phone layouts, twelve Builder configurations, and twelve catalog selections were checked locally. Automated checks confirm that the other ten spray assemblies remain unchanged and the pilot cannot override production or Vercel.','All twelve exact-SKU product pages were checked in three views, along with their finish selectors, phone layouts, Builder configurations and catalog selections. Automated checks cover preservation of the approved pair and source geometry, the ten additional joins, exact catalog mapping, and exclusion from production and Vercel.')
h=h.replace('Local review only. The Shiny Silver pair is accepted; the remaining ten standard sprays are ready for visual review. No production media, catalog records, orders, or checkout changed.','Local review only. The twelve Diva 46 ml spray variants are ready for visual acceptance. No next family has been started. No production media, catalog records, orders, or checkout changed.')
h=h.replace('Fresh production and development records were read for the two Diva spray groups. The two source PSDs and directly linked legacy images were inspected.','Fresh production and development records were read for both Diva spray groups. Original registered glass and closure image bytes were retained. Native PSD lineage and the original two-bottle source evidence remain available in the approved pilot.')
h=h.replace('Only these two Shiny Silver SKUs receive new catalog images. The other ten spray variants retain their previous local state while you review this pair.','All twelve standard sprays now have matching catalog images. The accepted Shiny Silver pair is unchanged. Antique sprayers and tassels remain outside this pass.')
h=h.replace('Four capped and uncapped native PSDs were inspected.','Twenty-four exact-SKU capped and uncapped PSDs were inspected for all twelve standard sprays.')
h=h.replace('The two product pages, their phone layouts, Builder configurations, and exact catalog selections were checked locally.','All twelve exact-SKU product pages, twelve Builder configurations and twelve catalog selections passed local checks, along with both phone layouts.')
h=h.replace('only the two pilot catalog entries are added','ten additional catalog entries are added')
h=h.replace('This pair is awaiting visual acceptance before the treatment extends to other finishes.','The accepted Shiny Silver pair is retained; the other ten standard sprays are ready for visual review.')
h=h.replace('This pilot preserves that candidate for your visual review.','This full set preserves that candidate for your visual review.')
h=h.replace('Neither Diva source provides an isolated complete tube.','The inspected Diva sources do not provide an isolated complete tube.')
h=h.replace('The frosted raw row has an incorrect Clear cap-color label; the exact registered component and product selector identify Shiny Silver.','The frosted raw rows report Clear as their cap color. Each local export uses the finish verified by its exact registered sprayer component and source image; the product selectors agree.')
h=h[:h.index('<script>')]+'''<script>
let surface='sidecar',glass='Frosted',finish='ShnSl';const names={ShnSl:'Shiny Silver',MtSl:'Matte Silver',ShnGl:'Shiny Gold',MtGl:'Matte Gold',ShnBlk:'Shiny Black',Cu:'Copper'};const sku=g=>`GBDiva${g==='Clear'?'':'Frst'}46Spry${finish}`;
function render(){document.querySelector('#scale').src=`scale-${finish}.svg`;document.querySelector('#scale-link').href=`scale-${finish}.svg`;document.querySelector('#pair').innerHTML=['Clear','Frosted'].map(g=>{const src=surface==='source'?`source/${sku(g)}.png`:`after/${sku(g)}-${surface}.png`;return `<figure><figcaption>${g} · ${names[finish]} · ${sku(g)}</figcaption><a href="${src}" target="_blank"><img src="${src}" alt="${g} Diva ${names[finish]} ${surface}"></a></figure>`}).join('');document.querySelector('#compare').innerHTML=['source','after'].map(phase=>{const src=phase==='source'?`source/${sku(glass)}.png`:`after/${sku(glass)}-sidecar.png`;return `<figure><figcaption>${phase==='source'?'Native source':'Local assembly'} · ${glass} · ${names[finish]}</figcaption><a href="${src}" target="_blank"><img src="${src}" alt="${phase} ${glass} assembly"></a></figure>`}).join('');document.querySelectorAll('[data-surface]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.surface===surface));document.querySelectorAll('[data-glass]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.glass===glass));document.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.finish===finish));const links=document.querySelectorAll('.links a');links[0].href=`http://localhost:3007/products/diva-46ml-clear-18-415-perfumespray?sku=${sku('Clear')}`;links[1].href=`http://localhost:3007/products/diva-46ml-frosted-18-415-perfumespray?sku=${sku('Frosted')}`;}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.surface)surface=b.dataset.surface;if(b.dataset.glass)glass=b.dataset.glass;if(b.dataset.finish)finish=b.dataset.finish;render()});render();
</script></body></html>'''
(T/'index.html').write_text(h);print(T)
