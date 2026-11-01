import bpy,json,sys,traceback
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();part=int(sys.argv[sys.argv.index('--')+2]);bootstrap={};exec((r/'scripts/render-variants.py').read_text().split('\nimport traceback')[0],bootstrap);env=bootstrap['env']
assert (r/'sources/tube-appearance-verified.json').exists(), 'Final tube lighting comparison still pending'
queue=json.loads((r/'sources/variant-render-queue.json').read_text());jobs=[a for a in queue if '--spray-' in a['id'] or '--covered-' in a['id']][part::2]
for i,row in enumerate(jobs):
 src=Path(row['workingCopy']).parent/'repair-report-v14.json'
 if not src.exists():raise RuntimeError('Missing verified tube source '+str(src))
 source_report=json.loads(src.read_text());verified=json.loads((r/'audit/repaired-models'/(source_report['id']+'.json')).read_text());fit=json.loads((r/'audit/verified-fit-final'/(source_report['id']+'.json')).read_text());assert verified['path']==source_report['workingCopy'] and verified['geometryPass'] and verified['materialsPass'];assert fit['workingCopy']==source_report['workingCopy'] and all(t['floorPass'] and t['wallPass'] and t['connectionPass'] for t in fit['tubes'])
 row['workingCopy']=source_report['workingCopy'];row['saveScene']=row['id'].startswith('priority-') and row['id'].endswith('--spray-matte-black');dest=env['out']/row['id'];meta=dest/'after.json'
 if meta.exists() and json.loads(meta.read_text()).get('source')==row['workingCopy']:continue
 if meta.exists():
  archive=r/'renders/superseded/tube-pre-v13'/row['id'];archive.mkdir(parents=True,exist_ok=True)
  for old in list(dest.glob('after*'))+[dest/'variant.json',dest/'review-scene.blend']:
   if old.exists():old.rename(archive/old.name)
 try:env['render'](row,row['workingCopy'],'after');(dest/'variant.json').write_text(json.dumps(row,indent=2));print('TUBE_VARIANT',part,i+1,len(jobs),row['id'],flush=True)
 except Exception as e:print('TUBE_VARIANT_ERROR',row['id'],str(e),traceback.format_exc(),flush=True)
print('TUBE_VARIANTS_COMPLETE',part,len(jobs),flush=True)
