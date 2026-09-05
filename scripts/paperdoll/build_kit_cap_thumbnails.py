#!/usr/bin/env python3
"""Crop cap-only picker thumbnails from reviewed physical cap layers, never bottle plates."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image, ImageOps
p=argparse.ArgumentParser();p.add_argument('--release',required=True)
p.add_argument('--reviewed-fitments',help='Exact-SKU/source-hash reviewed external closure photos (not hidden plugs)')
a=p.parse_args()
reviewed={row['sku']:row for row in json.load(open(a.reviewed_fitments))['rows']} if a.reviewed_fitments else {}
r=Path(a.release);out=r/'cap-thumbnails';out.mkdir(exist_ok=True);rows=[]
for kit in json.load(open(r/'kits/manifest.json'))['rows']:
 if not kit.get('publishable') or not kit.get('visualReview',{}).get('approved'):continue
 caps=[part for part in kit['parts'] if part['slot']=='cap']
 if kit['sku'] in reviewed:
  caps=[part for part in kit['parts'] if part['slot']=='fitment']
  if len(caps)!=1 or caps[0]['sha256']!=reviewed[kit['sku']]['sourceSha256']:
   raise ValueError('Reviewed fitment identity drift: '+kit['sku'])
 if len(caps)!=1:continue
 part=caps[0];source=r/'kits'/part['image'];raw=source.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=part['sha256']:raise ValueError('Source hash drift')
 image=Image.open(source).convert('RGBA');bounds=image.getchannel('A').getbbox()
 if not bounds:raise ValueError('Empty cap')
 cropped=image.crop(bounds);cropped.thumbnail((224,224),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(256,256));canvas.alpha_composite(cropped,((256-cropped.width)//2,(256-cropped.height)//2))
 temp=out/'candidate.webp';canvas.save(temp,'WEBP',lossless=True);data=temp.read_bytes();sha=hashlib.sha256(data).hexdigest();file=out/(sha+'.webp');temp.replace(file)
 rows.append({'sku':kit['sku'],'file':str(file),'sha256':sha,'bytes':len(data),'width':256,'height':256,'sourcePart':str(source),'sourceSha256':part['sha256'],'crop':bounds,'storeKey':'paper-doll/reviewed-cap-thumbs/'+sha+'.webp'})
if not set(reviewed).issubset({row['sku'] for row in rows}):raise ValueError('Reviewed fitment missing or unpublished')
(out/'manifest.json').write_text(json.dumps({'rows':rows},indent=2));print(len(rows),'exact-SKU caps;',len({row['sha256'] for row in rows}),'unique crops')
