import json
from pathlib import Path
out=Path(__file__).resolve().parents[1];rows=json.loads((out/'five-layouts.json').read_text());checks=[];outside=[]
def body_transform(view):
 body={k:v for k,v in view['body'].items() if k!='key'}
 return {'body':body,'frame':view['layout']['frame']}
for row in rows:
 views=row['views'];stable=all(body_transform(v)==body_transform(views[0]) for v in views)
 for view in views:
  f=view['layout']['frame']
  for p in view['layout']['parts']:
   b=p.get('box')
   if not b:continue
   x=f['x']+(b['leftPct']+p['dxPct'])*f['scale'];y=f['y']+(b['topPct']+p['dyPct'])*f['scale'];r=x+b['widthPct']*f['scale'];bottom=y+b['heightPct']*f['scale']
   if min(x,y)<-.5 or max(r,bottom)>100.5:outside.append([row['sku'],view['view'],p['slot'],x,y,r,bottom])
 checks.append({'sku':row['sku'],'stable':stable})
report={'variants':len(rows),'views':len(rows)*3,'stable':all(x['stable'] for x in checks),'outOfFrameImageBoxes':outside,'rows':checks};(out/'five-layout-checks.json').write_text(json.dumps(report,indent=2));print({k:v for k,v in report.items() if k!='rows'});assert report['stable'] and not outside
