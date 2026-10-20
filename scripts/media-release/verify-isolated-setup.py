# Read-only verification, fixed to the isolated review targets. Run from repository root.
from pathlib import Path
import subprocess,json,hashlib,datetime
base=Path('docs/reviews/isolated-preview-setup-2026-10-20')
seed=json.loads((base/'test-catalog.json').read_text())
query='const tables='+json.dumps(list(seed))+''';const result={};for(const table of tables)result[table]=await ctx.db.query(table).take(200);return JSON.stringify(result);'''
r=subprocess.run(['node','node_modules/convex/bin/main.js','run','--deployment','asala-team:best-bottles-media-review:dev/media-review','--inline-query',query,'--codegen','disable'],capture_output=True,text=True)
assert r.returncode==0,r.stderr
d=json.loads(r.stdout);d=json.loads(d) if isinstance(d,str) else d
stable=lambda rows:json.dumps(sorted(rows,key=lambda x:x['_id']),sort_keys=True,separators=(',',':'))
checks={t:{'rows':len(rows),'matchesSeed':stable(rows)==stable(seed[t]),'sha256':hashlib.sha256(stable(rows).encode()).hexdigest()} for t,rows in d.items()}
assert all(v['matchesSeed'] for v in checks.values())
def vc(path):
 r=subprocess.run(['/Users/jordanrichter/.local/bin/vercel','api',path,'--scope','asala'],capture_output=True,text=True)
 assert r.returncode==0,r.stderr
 return json.loads(r.stdout)
id='prj_JFb1sYpDTmvfUR2qfOOL9TJmF5yt';team='team_CGyACzn1BhcZitDAKUiZRzax'
p=vc('/v9/projects/'+id+'?teamId='+team)
env=vc('/v10/projects/'+id+'/env?teamId='+team)
expected={'NEXT_PUBLIC_BB_MEDIA_RELEASE':'off','NEXT_PUBLIC_REGISTER_STAGE':'on','NEXT_PUBLIC_CONVEX_URL':'https://beloved-wildcat-265.convex.cloud','NEXT_PUBLIC_CLERK_ENABLED':'false'}
assert {e['key'] for e in env['envs']}==set(expected)
assert all(e['target']==['preview'] for e in env['envs'])
assert p['accountId']==team and p.get('link') is None and not p.get('latestDeployments') and not p.get('targets')
assert p['ssoProtection']['deploymentType']=='all'
# Only fetch values after the exact four known public settings are established.
for e in env['envs']:
 value=vc('/v1/projects/'+id+'/env/'+e['id']+'?teamId='+team)
 assert value['value']==expected[e['key']], 'Public configuration mismatch: '+e['key']
spec=subprocess.run(['node','node_modules/convex/bin/main.js','function-spec','--deployment','asala-team:best-bottles-media-review:dev/media-review'],capture_output=True,text=True,check=True)
assert json.loads(spec.stdout)['functions']==[]
backend_env=subprocess.run(['node','node_modules/convex/bin/main.js','env','list','--deployment','asala-team:best-bottles-media-review:dev/media-review'],capture_output=True,text=True,check=True)
assert 'No environment variables set' in backend_env.stdout+backend_env.stderr

record={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'vercel':{k:p.get(k) for k in ['id','name','accountId','nodeVersion','framework','buildCommand','installCommand','link','ssoProtection','latestDeployments','targets']},'environment':[{'key':e['key'],'target':e['target'],'type':e['type'],'value':expected[e['key']]} for e in env['envs']],'convex':{'selector':'asala-team:best-bottles-media-review:dev/media-review','url':'https://beloved-wildcat-265.convex.cloud','functions':0,'environmentVariables':0,'tables':checks},'productionWrites':False,'gitPush':False,'codeDeployments':False}
(base/'isolation-verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
