from PIL import Image
from collections import deque
from pathlib import Path
import json,hashlib,argparse
parser=argparse.ArgumentParser(description='Clean exterior white matte on six exact frosted tall-9 cap bodies. Run from repository root.')
parser.add_argument('--audit', required=True, help='Read-only catalog rows and kits JSON snapshot')
parser.add_argument('--cache', required=True, type=Path, help='Source WebP directory, filenames SHA256.webp')
args=parser.parse_args()
audit=json.loads(Path(args.audit).read_text()); replacements={}; lineage=[]
Path('public/images/bottle-builder/tall9-cleanup').mkdir(parents=True, exist_ok=True)
Path('docs/reviews/tall9-caps-2026-09-23').mkdir(parents=True, exist_ok=True)
for row in audit['rows']:
 if not row['websiteSku'].startswith('GBTallCylFrst9') or row['color']!='Frosted' or row['applicator'] or not row['websiteSku'].endswith(('BlkShSht','CuSht','GlMattSht','GlSht','SlMattSht','SlSht')):continue
 p=next(p for p in audit['kits'][row['websiteSku']]['parts'] if p['slot']=='body');src=args.cache/(p['image']['sha256']+'.webp'); assert hashlib.sha256(src.read_bytes()).hexdigest()==p['image']['sha256']; im=Image.open(src).convert('RGBA');pix=im.load();w,h=im.size
 # The six exact recovered source layers contain a white rectangle below the
 # threaded neck. Remove only exterior-connected near-white matte pixels;
 # retain neck highlights and all enclosed frosted-glass pixels.
 top=300; visited=bytearray(w*h); q=deque((0,y) for y in range(top,h)); q.extend((w-1,y) for y in range(top,h));q.extend((x,h-1) for x in range(w)); changed=0
 while q:
  x,y=q.popleft();n=y*w+x
  if visited[n]:continue
  visited[n]=1;r,g,b,a=pix[x,y]
  if a and min(r,g,b)<240:continue
  if a:
   coverage=min(1,(255-min(r,g,b))/25);pix[x,y]=(230,230,230,round(a*coverage));changed+=1
  for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
   if 0<=xx<w and top<=yy<h and not visited[yy*w+xx]:q.append((xx,yy))
 out=Path('public/images/bottle-builder/tall9-cleanup')/(row['websiteSku']+'.webp');im.save(out,lossless=True,method=6);sha=hashlib.sha256(out.read_bytes()).hexdigest();image={**p['image'],'url':'/'+str(out.relative_to('public')),'key':str(out.relative_to('public')),'sha256':sha,'bytes':out.stat().st_size}
 replacements[p['image']['sha256']]=image;lineage.append({'sku':row['websiteSku'],'source':p['image'],'output':image,'removedMattePixels':changed,'protectedAboveY':top})
Path('src/lib/bottle-builder/tall9-cleaned-bodies.generated.json').write_text(json.dumps(replacements,indent=2)+'\n')
Path('docs/reviews/tall9-caps-2026-09-23/cleanup-lineage.json').write_text(json.dumps(lineage,indent=2)+'\n')
print([(x['sku'],x['removedMattePixels']) for x in lineage])
