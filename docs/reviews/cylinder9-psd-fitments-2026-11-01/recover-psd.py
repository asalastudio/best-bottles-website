from pathlib import Path
import json,subprocess,hashlib,shutil
root=Path.cwd();doc=root/'docs/reviews/cylinder9-psd-fitments-2026-11-01';pub=root/'public/reviews/cylinder9-psd-fitments-2026-11-01'
psdroot=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master')
meta=json.loads((root/'data/register/phase3/pilot-measurements.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
result=[]
for component in meta['components']:
 if component['type']!='fine-mist-sprayer':continue
 psd=psdroot/component['psd']
 info=subprocess.check_output(['/opt/homebrew/bin/magick','identify','-format','%s|%[label]|%w|%h\n',str(psd)],text=True)
 layers=[r.split('|') for r in info.strip().splitlines()]
 record={k:component[k] for k in ['componentId','websiteSku','psd','reference']};record['psdSha256']=sha(psd);record['layers']=[]
 for layer in component['layers']:
  if layer['slot'] not in ['sprayer','collar']:continue
  item=next(r for r in layers if r[1]==layer['layerName'])
  out=doc/(component['componentId']+'--'+layer['slot']+'.png')
  subprocess.run(['/opt/homebrew/bin/magick',str(psd)+'['+item[0]+']','+repage','-bordercolor','none','-border','6','PNG32:'+str(out)],check=True)
  width,height=map(int,subprocess.check_output(['/opt/homebrew/bin/magick','identify','-format','%w %h',str(out)],text=True).split())
  assert (width,height)==(layer['width'],layer['height']),str((component['componentId'],width,height))
  shutil.copy2(out,pub/out.name)
  record['layers'].append({**layer,'file':out.name,'originalMetadataSha256':layer['sha256'],'sha256':sha(out),'extraction':{'tool':'ImageMagick','nativeLayerIndex':int(item[0]),'nativeLayerName':item[1],'transparentPaddingPx':6}})
 result.append(record)
(doc/'psd-provenance.json').write_text(json.dumps({'source':'Native Photoshop layers, not Blender renders','root':str(psdroot),'components':result,'archivedCdnNote':'Black sprayer CDN bytes differ from historical hash, so these are freshly extracted native PSD layers.'},indent=2)+'\n')
shutil.copy2(doc/'psd-provenance.json',pub/'psd-provenance.json')
tube=Path('/Users/jordanrichter/.codex/generated_images/01a190e7-4abb-7e82-8786-970248f1c27f/exec-86305227-28db-4c78-9392-a77f28b61242.png')
shutil.copy2(tube,doc/'BB_DipTube_GPT_Master_v01_APPROVED.png');shutil.copy2(tube,pub/'tube-master.png')
body=root/'docs/reviews/cylinder9-clean-edges-2026-11-01/BB_Cylinder_9ml_17-415_Clear_BODY_Fixed-Edges-v04_REVIEW.png'
shutil.copy2(body,doc/'BB_Cylinder_9ml_17-415_Clear_BODY_v04_APPROVED.png');shutil.copy2(body,pub/'body-approved.png')
print(json.dumps({'components':len(result),'layers':sum(len(r['layers']) for r in result),'tubeSha256':sha(tube),'bodySha256':sha(body)}))
