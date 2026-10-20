from pathlib import Path
import os,subprocess,sys,json,time
root=Path(__file__).resolve().parent
repo=root.parent/'repository'
if not (repo/'.git').exists():
 repo=Path(subprocess.check_output(['git','-C',str(root),'rev-parse','--show-toplevel'],text=True).strip())
name=sys.argv[1]
commands={
 'typecheck':['node','node_modules/typescript/bin/tsc','--noEmit'],
 'lint':['npm','run','lint'],
 'tests':['node','node_modules/vitest/vitest.mjs','run','--maxWorkers=4'],
 'media-replay':['node','scripts/verify-local-media-checkpoint.mjs'],
 'build':['npm','run','build','--','--webpack'],
 'copper-snapshot':['node','node_modules/vitest/vitest.mjs','run','tests/local-copper-caps.test.ts'],
}
env={k:v for k,v in os.environ.items() if k in {'PATH','HOME','TMPDIR','LANG','LC_ALL'}}
env.update({'CI':'true','NEXT_TELEMETRY_DISABLED':'1'})
if name=='copper-snapshot':
 env['BB_ROUND78_LOTION_SNAPSHOT']=str(repo/'output/round78-lotion-completion/production-snapshot.json')
if name=='build':
 env.update({'NEXT_PUBLIC_SITE_URL':'https://ci.example.com','NEXT_PUBLIC_CLERK_ENABLED':'false','NEXT_PUBLIC_SANITY_PROJECT_ID':'gh97irjh','NEXT_PUBLIC_SANITY_DATASET':'production','NEXT_PUBLIC_CONVEX_URL':'https://ci-placeholder.convex.cloud','NODE_OPTIONS':'--max-old-space-size=6144'})
started=time.time()
with (root/(name+'.log')).open('w') as f:
 result=subprocess.run(commands[name],cwd=repo,env=env,stdout=f,stderr=subprocess.STDOUT)
receipt={'check':name,'command':commands[name],'exitCode':result.returncode,'durationSeconds':round(time.time()-started,2),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'environment':'allowlisted process environment; no credentials loaded'}
(root/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
raise SystemExit(result.returncode)
