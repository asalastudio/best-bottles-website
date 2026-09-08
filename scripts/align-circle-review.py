"""Apply saved absolute Circle shoulder targets to a versioned review, then optionally catalog."""
import json, pathlib, hashlib
from PIL import Image,ImageDraw
import numpy as np
R=pathlib.Path(__file__).resolve().parents[1];D=R/'docs/reviews/circle-recovery'
existing=D/'alignment-and-matte-report.json'
if existing.exists() and json.load(open(existing)).get('visualApproved'):
 raise SystemExit('Approved Circle revision is locked. Create a new versioned revision instead of overwriting it.')
originals={r['sku']:r for r in json.load(open(R/'docs/reviews/circle-family-final-manifest-2026-09-06.json'))['rows']}
heroes=json.load(open(R/'src/lib/products/catalog-heroes.json'));marks={r['sku']:r for r in json.load(open(D/'shoulder-landmarks.json'))};matte={r['sku']:r for r in json.load(open(D/'matte-candidates.json'))};feedback=json.load(open(R/'hero-reviews/circle-shoulder-review-2026-09-07/feedback.json'))
json.dump(feedback,open(D/'saved-shoulder-feedback.json','w'),indent=2)
for sku,shoulder in [('GBCrcl15Gl',650),('GBCrcl15SpryGlMatt',748),('GBCrcl15MtlRollGlMatt',720)]:
 f=originals[sku]['framing'];base=(1716*.91-f['translateYPercent']/100*1716)/f['scale'];marks[sku]={'sku':sku,'baseY':base,'shoulderY':shoulder,'definition':'Visually measured original pixels at body-to-neck transition; base recovered from the prior approved baseline transform.'}
rows=[];report=[];sheet=Image.new('RGB',(1560,2310),'#f5f3ef');draw=ImageDraw.Draw(sheet)
for h in [h for h in heroes if h['family']=='Circle']:
 sku=h['websiteSku'];ori=originals[sku];m=marks[sku];d=feedback['decisions'][sku+':'+ori['assetSha256']];target=d['targetHeight'];assert target['measurement']=='glass_shoulder' and target['baselinePercent']==91
 base=m['baseY'] if h['capacityMl']==15 else 1562;shoulder=m['shoulderY'];s=target['heightPercent']/100*1716/(base-shoulder);of=ori['framing'];anchor=(780-of['translateXPercent']/100*1560)/of['scale'];tx=780-anchor*s;ty=1716*.91-base*s;f={'scale':s,'translateXPercent':tx/1560*100,'translateYPercent':ty/1716*100};url=matte[sku]['url'] if sku in matte else ori['url'];sha=matte[sku]['assetSha256'] if sku in matte else ori['assetSha256']
 im=Image.open(R/('public'+url)).convert('RGB');rendered=im.transform((1560,1716),Image.Transform.AFFINE,(1/s,0,-tx/s,0,1/s,-ty/s),Image.Resampling.BICUBIC,fillcolor=(245,243,239))
 # Check significant artwork; faint original shadows are inspected separately.
 a=np.array(im).astype(float);diff=np.max(abs(a-np.array([245,243,239])),axis=2);yy,xx=np.where(diff>32);bounds=[float(xx.min()*s+tx),float(yy.min()*s+ty),float(xx.max()*s+tx),float(yy.max()*s+ty)]
 rec={'sku':sku,'target':target,'originalUrl':ori['url'],'originalAssetSha256':ori['assetSha256'],'url':url,'assetSha256':sha,'originalFraming':of,'framing':f,'landmark':m,'originalBaseY':base,'measuredShoulderPercent':target['heightPercent'],'renderedSignificantArtworkBounds':bounds,'visualApproved':False};report.append(rec)
 rows.append({**h,'sku':sku,'title':h['alt'],'url':url,'assetSha256':sha,'framing':f,'stage':'corrected','priorUrl':ori['url'],'priorAssetSha256':ori['assetSha256'],'sourcePreview':ori['url'],'sourceKind':'Previously approved original artwork, before this sizing and matte correction','targetHeightRequest':target,'measurement':{'totalHeightPercent':(1716*.91-bounds[1])/1716*100},'shoulderSizing':{'measuredPercent':target['heightPercent']},'defaultMeasurement':'glass_shoulder','sizingLocked':False,'reviewNotes':['Saved absolute shoulder target applied with one uniform complete-assembly transform. Original hardware arrangement preserved.','White-matte correction rebuilt across the glass region.' if sku in matte else 'Original artwork colors retained.','Review required before visual lock; not published.']})
 j=len(rows)-1;x=j%6*260;y=j//6*462;thumb=rendered.resize((260,286),Image.Resampling.LANCZOS);sheet.paste(thumb,(x,y));draw.line((x,y+286*.91,x+260,y+286*.91),fill='#9a572e',width=1);draw.line((x,y+286*(.91-target['heightPercent']/100),x+260,y+286*(.91-target['heightPercent']/100)),fill='#47877c',width=1);draw.text((x+4,y+300),sku,fill='black');draw.text((x+4,y+317),str(target['heightPercent'])+'% shoulder',fill='black')
json.dump(rows,open(D/'aligned-review-input.json','w'),indent=2);json.dump({'baselinePercent':91,'rows':report,'visualApproved':False,'published':False},open(D/'alignment-and-matte-report.json','w'),indent=2);sheet.save(D/'aligned-family-sheet.png')
print('Prepared',len(rows),'review rows');print('Bounds near edge:',[(r['sku'],r['renderedSignificantArtworkBounds']) for r in report if r['renderedSignificantArtworkBounds'][0]<5 or r['renderedSignificantArtworkBounds'][2]>1555 or r['renderedSignificantArtworkBounds'][3]>1711])
