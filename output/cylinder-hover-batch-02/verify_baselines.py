import json,numpy as np
from PIL import Image
from pathlib import Path
R=Path('output/cylinder-hover-batch-02');rows=json.load(open(R/'normalization-report.json'))['rows'];out=[]
for r in rows:
 a=np.asarray(Image.open(r['output']).convert('RGB')).astype(float);g=a.mean(2);p=g[:,995:1085].mean(1);d=np.diff(p);base=int(np.argmax(d[2068:2095])+2069)
 out.append({'sku':r['sku'],'state':r['state'],'detectedContact':base,'target':2082,'errorPixels':base-2082})
json.dump(out,open(R/'verified-baselines.json','w'),indent=2);print(out);assert max(abs(r['errorPixels']) for r in out)<=5
