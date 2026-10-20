from pathlib import Path
import json,shutil,re,copy,xml.etree.ElementTree as E
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-spray-completion';D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot');T=D/'round78-complete';T.mkdir(exist_ok=True)
for f in ['after','before']:(T/f).mkdir(exist_ok=True)
rows=json.loads((O/'kits.json').read_text());assets=json.loads((O/'development-snapshot.json').read_text())['register']['plates'];N='http://www.w3.org/2000/svg';E.register_namespace('',N)
def node(tag,attrs={},text=None):
 el=E.Element('{'+N+'}'+tag,{k:str(v) for k,v in attrs.items()});el.text=text;return el
finishes=[('ShnSl','Shiny Silver'),('MtSl','Matte Silver'),('ShnGl','Shiny Gold'),('MtGl','Matte Gold'),('ShnBlk','Shiny Black'),('Cu','Copper')];cal=[]
for key,finish in finishes:
 root=node('svg',{'viewBox':'0 0 1100 730','width':1100,'height':730,'role':'img','aria-label':f'Clear and frosted Round 78 ml, {finish}, at the same scale'});root.append(node('rect',{'width':1100,'height':730,'fill':'#f5f3ef'}));root.append(node('line',{'x1':65,'x2':1050,'y1':620,'y2':620,'stroke':'#bcc8b6'}))
 for entry,ax in zip(sorted([e for e in rows if e['row']['capColor']==finish],key=lambda x:x['row']['color']),[280,760]):
  r=entry['row'];sku=r['websiteSku'];src=E.parse(O/(sku+'-assembly.svg')).getroot();body=next(e for e in src.iter() if e.get('data-builder-layer')=='body');bx,by,bs=[float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',body.get('transform'))];lm=assets[entry['kit']['register']['plateKey']]['anchors'];scale=400/((lm['baselineY']-lm['seatY'])*bs);axis=bx+lm['axisX']*bs;base=by+lm['baselineY']*bs
  g=node('g',{'id':r['color'].lower(),'transform':f'translate({ax} 620) scale({scale}) translate({-axis} {-base})'});prefix=r['color'].lower()+'-'
  for e in src.iter():
   for k,v in list(e.attrib.items()):
    if k=='id':e.set(k,prefix+v)
    elif 'url(#' in v:e.set(k,v.replace('url(#','url(#'+prefix))
  for child in src:
   if not child.tag.endswith('title'):g.append(copy.deepcopy(child))
  root.append(g);root.append(node('text',{'x':ax-65,'y':671,'font-size':23,'font-family':'Arial','fill':'#294333'},r['color']+' · 78 ml'));root.append(node('text',{'x':ax-65,'y':702,'font-size':13,'font-family':'Arial','fill':'#526455'},finish+' spray'))
  cal.append({'sku':sku,'glass':r['color'],'bodyHeightPx':400,'baselineY':620,'uniformAssemblyScale':scale,'sourcePlateAnchors':lm})
  shutil.copy2(O/(sku+'-assembly.svg'),T/(sku+'-assembly.svg'))
  for suffix in ['builder','catalog','catalog-card']:shutil.copy2(O/(sku+'-'+suffix+'.png'),T/'after'/(sku+'-'+suffix+'.png'))
  for phase in ['before','after']:
   for p in (O/phase).glob(sku+'-*.png'):shutil.copy2(p,T/phase/p.name)
 (T/('scale-'+key+'.svg')).write_bytes(E.tostring(root,encoding='utf-8',xml_declaration=True))
(T/'scale-check.json').write_text(json.dumps(cal,indent=2))
# Retain the approved pilot's visual language and replace its controls with the full finish set.
h=(D/'round78-pilot/index.html').read_text()
h=h.replace('Round 78 ml / Two-bottle pilot','Round 78 ml / All spray finishes').replace('Best Bottles · Round 78 ml · Local pilot','Best Bottles · Round 78 ml · Local completion')
h=h.replace('Clear and frosted.<br>One Shiny Silver assembly.','Clear and frosted.<br>All six spray finishes.')
h=h.replace('The two pilot bottles use the same source-backed spray mechanism. The tube now joins the visible edge of its sprayer, and each catalog image is exported from its actual Builder assembly.','All twelve spray variants now use the approved Round treatment. Each native tube joins the visible lower edge of its own sprayer, and each catalog image comes from its matching Builder assembly.')
h=h.replace('<a href="matched-scale.svg" target="_blank"><img src="matched-scale.svg" alt="Clear and frosted Round bottles at equal scale, with aligned glass bases"></a>','<div class="controls" id="finishes">'+''.join(f'<button data-finish="{key}">{name}</button>' for key,name in finishes)+'</div><a id="scale-link" href="scale-ShnSl.svg" target="_blank"><img id="scale" src="scale-ShnSl.svg" alt="Clear and frosted Round bottles at equal scale, with aligned glass bases"></a>')
h=h.replace('Only these two Shiny Silver SKUs have the new treatment. The other ten spray finishes remain at their previous local state while you review this pair.','The approved Shiny Silver pair is retained. Copper, Matte Gold, Matte Silver, Shiny Gold and Shiny Black now have the same treatment in both glass colors. The full set remains local for your review.')
h=h.replace('<button data-surface="source">Original source photo</button>','<button data-surface="catalog">Catalog image</button>')
h=h.replace('This pilot preserves that subtle appearance.','The completed set preserves that subtle appearance.')
h=h.replace('id="compare"','id="compare"')
h=h.replace('The small gap under the sprayer came from transparent padding in its image. The source tube is now seated against the visible lower edge. Its shape and length are unchanged.','Each before view shows the state before this extension. The Shiny Silver pair is unchanged from your approved pilot. The other ten variants now join at the visible sprayer edge; tube shape, length and glass geometry are retained.')
h=h.replace('The two product pages, their phone layouts, Builder configurations, and exact catalog selections were checked locally. Automated checks confirm that the other ten spray assemblies remain unchanged and the pilot cannot override production or Vercel.','All twelve exact-SKU product pages were checked in three views, along with their finish selectors, phone layouts, Builder configurations and catalog selections. Automated checks cover preservation of the approved pair and source geometry, the ten additional joins, exact catalog mapping, and exclusion from production and Vercel.')
h=h.replace('Local review only. This pair is awaiting visual acceptance before the treatment extends to other finishes. No production media, catalog records, orders, or checkout changed.','Local review only. The twelve Round 78 ml spray variants are ready for visual acceptance. No next family has been started. No production media, catalog records, orders, or checkout changed.')
h=h.replace('Fresh production and development records were read for the two Round spray groups. The two source PSDs and directly linked legacy images were inspected.','Fresh production and development records were read for both Round spray groups. Original registered glass and closure image bytes were retained. Native PSD lineage and the original two-bottle source evidence remain available in the approved pilot.')
h=h[:h.index('<script>')]+'''<script>
let surface='sidecar',glass='Frosted',finish='ShnSl';const names={ShnSl:'Shiny Silver',MtSl:'Matte Silver',ShnGl:'Shiny Gold',MtGl:'Matte Gold',ShnBlk:'Shiny Black',Cu:'Copper'};const sku=g=>`GBRnd${g==='Clear'?'':'Frst'}78Spry${finish}`;
function render(){document.querySelector('#scale').src=`scale-${finish}.svg`;document.querySelector('#scale-link').href=`scale-${finish}.svg`;document.querySelector('#pair').innerHTML=['Clear','Frosted'].map(g=>{const src=`after/${sku(g)}-${surface}.png`;return `<figure><figcaption>${g} · ${names[finish]} · ${sku(g)}</figcaption><a href="${src}" target="_blank"><img src="${src}" alt="${g} Round ${names[finish]} ${surface}"></a></figure>`}).join('');document.querySelector('#compare').innerHTML=['before','after'].map(phase=>`<figure><figcaption>${phase==='before'?'Before':'After'} · ${glass} · ${names[finish]}</figcaption><a href="${phase}/${sku(glass)}-exploded.png" target="_blank"><img src="${phase}/${sku(glass)}-exploded.png" alt="${phase} ${glass} exploded view"></a></figure>`).join('');document.querySelectorAll('[data-surface]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.surface===surface));document.querySelectorAll('[data-glass]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.glass===glass));document.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.finish===finish));const links=document.querySelectorAll('.links a');links[0].href=`http://localhost:3007/products/round-78ml-clear-18-415-perfumespray?sku=${sku('Clear')}`;links[1].href=`http://localhost:3007/products/round-78ml-frosted-18-415-perfumespray?sku=${sku('Frosted')}`;}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.surface)surface=b.dataset.surface;if(b.dataset.glass)glass=b.dataset.glass;if(b.dataset.finish)finish=b.dataset.finish;render()});render();
</script></body></html>'''
(T/'index.html').write_text(h);print(T)
