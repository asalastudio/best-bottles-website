from pathlib import Path
import json,hashlib,time
r=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9/outputs/catalog-model-repair-2026-10-31');q=json.loads((r/'sources/audit-queue.json').read_text())+json.loads((r/'sources/audit-queue-supplemental.json').read_text());out=[]
for a in q:
 h=hashlib.sha256()
 with open(a['path'],'rb') as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
 out.append({'id':a['id'],'path':a['path'],'before':a['sha256'],'after':h.hexdigest(),'unchanged':a['sha256']==h.hexdigest()});print('HASH',len(out),a['id'],out[-1]['unchanged'],flush=True)
(r/'audit/originals-verification.json').write_text(json.dumps(out,indent=2));print('ORIGINALS',len(out),'UNCHANGED',sum(x['unchanged'] for x in out),flush=True)
