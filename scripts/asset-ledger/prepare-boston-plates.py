"""Prepare local Boston plate review candidates from explicit master source records.
Preserves approved plates. Uniform photo transforms only; no shadow editing.
The plate presentation is derived from approved plates, separate from hero framing.
"""
import json, hashlib, io, pathlib, collections, datetime
import numpy as np
from PIL import Image
from scipy import ndimage
from psd_tools import PSDImage
ROOT=pathlib.Path(__file__).resolve().parents[2]
MASTER=pathlib.Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master').resolve()
REVIEW=ROOT/'docs/reviews/boston-plate-completion-2026-09-12'
DEST=ROOT/'public/images/boston-plate-candidates';DEST.mkdir(exist_ok=True)
CANVAS=(1000,1100)
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads((ROOT/p).read_text())
def white(im):
 im=im.convert('RGBA');bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);return bg.convert('RGB')
def save(im):
 b=io.BytesIO();im.save(b,format='WEBP',lossless=True,method=3);raw=b.getvalue();h=sha(raw);p=DEST/(h+'.webp')
 if p.exists() and sha(p.read_bytes())!=h:raise ValueError('Changed immutable output')
 if not p.exists():p.write_bytes(raw)
 return {'url':'/images/boston-plate-candidates/'+p.name,'sha256':h,'width':im.width,'height':im.height}
def verified(asset):
 p=(MASTER/asset['sourcePath']).resolve()
 if not p.is_relative_to(MASTER) or sha(p.read_bytes())!=asset['sourceSha256']:raise ValueError('Master source changed')
 preview=ROOT/'public'/asset['url'].lstrip('/')
 if sha(preview.read_bytes())!=asset['sha256']:raise ValueError('Reviewed source preview changed')
 return white(Image.open(preview))
def measure(im):
 a=np.asarray(white(im));ink=np.max(255-a.astype(float),axis=2)>15
 ink=ndimage.binary_fill_holes(ndimage.binary_closing(ink,iterations=2));labels,n=ndimage.label(ink)
 components=[]
 for i,sl in enumerate(ndimage.find_objects(labels),1):
  if sl is None:continue
  h=sl[0].stop-sl[0].start;w=sl[1].stop-sl[1].start
  if h>im.height*.35 and w>im.width*.08:components.append((h*w,i,sl))
 if not components:raise ValueError('Bottle geometry unresolved')
 _,label,sl=max(components);m=labels==label;ys,xs=np.where(m);top,base=int(ys.min()),int(ys.max())
 band=m[top+int((base-top)*.50):top+int((base-top)*.86)]
 left=[];right=[]
 for line in band:
  cols=np.where(line)[0]
  if len(cols):left.append(cols.min());right.append(cols.max())
 x0=float(np.percentile(left,10));x1=float(np.percentile(right,90))
 return {'width':x1-x0+1,'baseY':base,'topY':top,'centerX':(x0+x1)/2,'left':int(xs.min()),'right':int(xs.max())}
def transformed(im,scale,x,y):
 return im.transform(CANVAS,Image.Transform.AFFINE,(1/scale,0,-x/scale,0,1/scale,-y/scale),Image.Resampling.BICUBIC,fillcolor='white')
def ink_bounds(im):
 a=np.asarray(im.convert('RGB'));ys,xs=np.where(np.max(255-a.astype(float),axis=2)>20)
 if not len(xs):raise ValueError('Blank plate')
 return [int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())]
def framing(im):
 s=min(CANVAS[0]/im.width,CANVAS[1]/im.height);return transformed(im,s,(CANVAS[0]-im.width*s)/2,(CANVAS[1]-im.height*s)/2)

def main():
 if (ROOT/'data/asset-ledger/boston-completion-decisions.json').exists():raise ValueError('Review decisions exist: prepare a new version instead of replacing the sheet')
 ledger=read('src/lib/asset-ledger/ledger.json');scope=[r for r in ledger['rows'] if r['productRecord'] and r['family']=='Boston Round'];existing=read('docs/reviews/boston-plate-completion-2026-09-12/existing-source-inspection.json');plan=read('data/asset-ledger/boston-approved-source-plan.json');standards=read('data/asset-ledger/bottle-standards.json');sheet=read('data/asset-ledger/boston-plate-contact-sheet.json');cards={r['sku']:r for r in sheet['rows']};catalog={r['sku']:r for r in scope}
 protected=ROOT/'data/asset-ledger/boston-plate-contact-decisions.json';protected_sha=sha(protected.read_bytes());standard_sha=sha((ROOT/'data/asset-ledger/bottle-standards.json').read_bytes())
 # These nine layer roles were inspected in short-cap-layer-audit.png.
 glassrefs={};layerrefs={}
 for row in existing:
  if row['applicator'] is not None:continue
  asset=row['candidates'][0];verified(asset);psd=PSDImage.open(MASTER/asset['sourcePath']);glass=white(psd[1].topil());g=measure(glass);full=g['baseY']-g['topY'];glassrefs[row['capacityMl'],row['color']]={'image':glass,'metrics':g,'height':full,'source':asset,'glassLayer':1,'capLayer':2};layerrefs[row['sku']]=psd
 # Reuse the current approved PLATE framing. Hero percentages never silently
 # become plate targets. These explicit plate targets are reviewed with the images.
 targets={}
 for size in [15,30,60]:
  samples=[]
  for row in scope:
   if row['capacityMl']!=size or not row['plate'].get('complete'):continue
   v=cards[row['sku']]['views'][0];p=ROOT/'public'/v['url'].lstrip('/')
   if sha(p.read_bytes())!=v['sha256']:raise ValueError('Approved plate bytes changed')
   g=measure(Image.open(p));ref=glassrefs[size,row['color']];height=g['width']/ref['metrics']['width']*ref['height'];samples.append({'sku':row['sku'],'sha256':v['sha256'],'glassHeight':height,'baseY':g['baseY']})
  reference=next((s for s in samples if s['sku']=='GBBstnBlu2ozWhtDropper'),None) if size==60 else None
  targets[size]={'glassHeight':round(reference['glassHeight'] if reference else float(np.median([x['glassHeight']for x in samples])),2),'baseY':1060,'centerX':500,'samples':samples,'reference':reference,'state':'proposed-plate-presentation','basis':'60 mL uses the existing approved white-dropper plate framing for closure headroom; 15/30 mL use median approved plate registration. Common plate baseline. Separate from hero framing.'}
 cap_recipes={r['sku']:r for r in read('docs/reviews/boston-plate-completion-2026-09-12/loose-cap-layer-audit.json')}
 # View classifications are recorded from actual pixels in existing-source-audit.png.
 selections=[(0,None),(0,None),(0,None),(0,1),(0,1),(0,1),(0,1),(0,None),(1,0),(0,None),(0,None),(0,1),(0,1),(0,None),(1,0),(1,0),(1,0),(1,0),(1,0),(0,None),(0,None),(0,1),(0,2),(0,2),(1,2),(1,2),(0,2),(0,None)]
 jobs=[]
 for row,(on,off) in zip(existing,selections):jobs.append({'sku':row['sku'],'on':row['candidates'][on],'off':row['candidates'][off]if off is not None else None,'short':row['applicator'] is None,'origin':'existing-correction'})
 for row in plan['rows']:jobs.append({'sku':row['sku'],'on':row['capOn'],'off':row['capOff'],'short':False,'origin':'new-plate'})
 output=[]
 for job in jobs:
  row=catalog[job['sku']];target=targets[row['capacityMl']];ref=glassrefs[row['capacityMl'],row['color']];standard=next(s for s in standards['standards']if row['productGroupId']in s['productGroupIds']);views=[];holds=[];metrics=[]
  for role,asset in [('on',job['on']),('off',job['off'])]:
   if asset is None:continue
   im=verified(asset);g=measure(im);source_height=g['width']/ref['metrics']['width']*ref['height'];scale=target['glassHeight']/source_height;x=500-g['centerX']*scale;y=target['baseY']-g['baseY']*scale;after=transformed(im,scale,x,y);layer_recipe=None
   if role=='off':
    recipe=cap_recipes[job['sku']]
    if recipe['source']['sourceSha256']!=asset['sourceSha256'] or len(recipe['choices'])!=1:raise ValueError('Inspected cap layer does not match source')
    psd=PSDImage.open(MASTER/asset['sourcePath']);index=recipe['choices'][0]['index'];cap_layer=psd[index]
    merged=white(psd.composite(ignore_preview=True,color=1,alpha=1));delta=np.abs(np.asarray(merged).astype(float)-np.asarray(im).astype(float))
    if delta.max()>2:raise ValueError('PSD layer reconstruction differs from approved source')
    base=white(psd.composite(ignore_preview=True,color=1,alpha=1,layer_filter=lambda layer:layer.is_visible() and layer is not cap_layer));after=transformed(base,scale,x,y).convert('RGBA');cap=cap_layer.topil().convert('RGBA');cm=measure_cap(cap)
    capx=500+g['width']*scale/2+24-cm['left']*scale;capy=target['baseY']-cm['baseY']*scale
    capframe=cap.transform(CANVAS,Image.Transform.AFFINE,(1/scale,0,-capx/scale,0,1/scale,-capy/scale),Image.Resampling.BICUBIC);after.alpha_composite(capframe);after=after.convert('RGB');layer_recipe={'cap':index,'capX':capx,'capY':capy,'reconstructionMaxError':float(delta.max()),'method':'Original PSD cap layer repositioned beside the uniformly scaled original glass assembly. All layer pixels retained; no shadow processing.'}
   bounds=ink_bounds(after)
   if min(bounds[0],bounds[1])<12 or bounds[2]>988 or bounds[3]>1088:holds.append(role+': safe margins need review')
   measured=measure(after);width_error=abs(measured['width']-(g['width']*scale));base_error=abs(measured['baseY']-target['baseY'])
   if width_error>3 or base_error>3:holds.append(role+': glass registration needs review')
   v={**save(after),'label':'Cap on'if role=='on'else'Cap off','source':asset,'transform':{'scale':scale,'x':x,'y':y},'glass':{'rimY':target['baseY']-target['glassHeight'],'baseY':target['baseY'],'height':target['glassHeight'],'sourceRimY':g['baseY']-source_height,'landmarkMethod':'Projected from inspected bare-glass reference using body width and glass bottom; cap excluded.'},'checks':{'bounds':bounds,'bodyWidthError':round(width_error,3),'baseError':round(base_error,3)}};views.append(v)
   if layer_recipe:v['layers']=layer_recipe
   metrics.append({'role':role,'scale':scale,'sourceGlassHeight':source_height,'outputGlassHeight':target['glassHeight']})
  if job['short']:
   psd=layerrefs[job['sku']];body=psd[1].topil().convert('RGBA');cap=psd[2].topil().convert('RGBA');g=ref['metrics'];scale=target['glassHeight']/ref['height'];x=500-g['centerX']*scale;y=target['baseY']-g['baseY']*scale
   bodyframe=body.transform(CANVAS,Image.Transform.AFFINE,(1/scale,0,-x/scale,0,1/scale,-y/scale),Image.Resampling.BICUBIC);result=Image.new('RGBA',CANVAS,'white');result.alpha_composite(bodyframe)
   capm=measure_cap(cap);capx=500+g['width']*scale/2+48-capm['left']*scale;capy=target['baseY']-capm['baseY']*scale
   capframe=cap.transform(CANVAS,Image.Transform.AFFINE,(1/scale,0,-capx/scale,0,1/scale,-capy/scale),Image.Resampling.BICUBIC);result.alpha_composite(capframe);result=result.convert('RGB');bounds=ink_bounds(result)
   if min(bounds[0],bounds[1])<12 or bounds[2]>988 or bounds[3]>1088:holds.append('off: source parts need spacing review')
   views.append({**save(result),'label':'Cap off','source':job['on'],'layers':{'glass':1,'cap':2},'transform':{'scale':scale,'glassX':x,'glassY':y,'capX':capx,'capY':capy},'glass':{'rimY':target['baseY']-target['glassHeight'],'baseY':target['baseY'],'height':target['glassHeight']},'checks':{'bounds':bounds},'method':'Only the inspected original glass and cap layers, each uniformly scaled. Cap placed beside glass; no masking, fabricated parts or shadow edits.'})
  before=cards[row['sku']]['views'] if job['origin']=='existing-correction' else [{**save(framing(verified(job['on']))),'label':'Original master · fitted full canvas'}]
  pair_check=None
  if len(views)==2:
   images=[np.asarray(Image.open(ROOT/'public'/v['url'].lstrip('/')).convert('RGB')).astype(float)for v in views];top=int(target['baseY']-target['glassHeight']*.55);bottom=int(target['baseY']-10);half=int(target['glassHeight']/ref['height']*ref['metrics']['width']*.46);difference=np.abs(images[0][top:bottom,500-half:500+half]-images[1][top:bottom,500-half:500+half]);pair_check={'bodyMeanError':round(float(difference.mean()),3),'region':[500-half,top,500+half,bottom]}
   if pair_check['bodyMeanError']>12:holds.append('Pair: glass body differs; review source alignment')
  output.append({'sku':row['sku'],'productGroupId':row['productGroupId'],'groupSlug':row['groupSlug'],'capacityMl':row['capacityMl'],'color':row['color'],'itemName':row['itemName'],'origin':job['origin'],'standardId':standard['id'],'standardVersion':standard['version'],'standardReferenceSha256':standard['reference']['sha256'],'before':before,'views':views,'holds':holds,'eligible':not holds,'status':'pending','pairCheck':pair_check,'sourceNotes':('Source cap-on/cap-off mapping inspected. Older filename-only hold retained as history; no change to indexed metadata.'if row['plate'].get('sourceHold')else 'Exact source set; new image approval required.'),'metrics':metrics})
 if sha(protected.read_bytes())!=protected_sha or sha((ROOT/'data/asset-ledger/bottle-standards.json').read_bytes())!=standard_sha:raise ValueError('Protected approvals or standards changed')
 result={'schemaVersion':1,'id':'boston-plate-completion-2026-09-12','family':'Boston Round','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'canvas':{'width':1000,'height':1100},'standardFileSha256':standard_sha,'standardSnapshots':{s['id']:s for s in standards['standards'] if s['family']=='Boston Round'},'protectedApprovalSha256':protected_sha,'preserved':[{**cards[r['sku']],'status':'approved'} for r in scope if r['plate'].get('complete')],'platePresentations':targets,'rows':output,'publicationAuthorized':False}
 (ROOT/'data/asset-ledger/boston-plate-completion.json').write_text(json.dumps(result,indent=2)+'\n');(REVIEW/'prepared.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'new':sum(x['origin']=='new-plate'for x in output),'corrections':sum(x['origin']=='existing-correction'for x in output),'preserved':len(result['preserved']),'eligible':sum(x['eligible']for x in output),'holds':[{ 'sku':x['sku'],'holds':x['holds']}for x in output if x['holds']],'targets':{s:{k:v for k,v in t.items()if k!='samples'}for s,t in targets.items()}},indent=2))
def measure_cap(im):
 a=np.asarray(white(im));ys,xs=np.where(np.max(255-a.astype(float),axis=2)>20);return {'left':float(xs.min()),'baseY':float(ys.max())}
if __name__=='__main__':main()
