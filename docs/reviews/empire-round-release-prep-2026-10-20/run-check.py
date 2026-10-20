from pathlib import Path
import os, subprocess, sys, json, time
folder = Path(__file__).resolve().parent
repo = folder.parents[2]
name = sys.argv[1]
check = name.removeprefix('node24-')
commands = {
 'typecheck': ['node','node_modules/typescript/bin/tsc','--noEmit'],
 'lint': ['npm','run','lint'],
 'tests': ['node','node_modules/vitest/vitest.mjs','run','--maxWorkers=4'],
 'media-replay': ['node','scripts/verify-local-media-checkpoint.mjs'],
 'active-build': ['npm','run','build','--','--webpack'],
 'off-build': ['npm','run','build','--','--webpack'],
}
env = {k:v for k,v in os.environ.items() if k in {'PATH','HOME','TMPDIR','LANG','LC_ALL'}}
env.update(CI='true', NEXT_TELEMETRY_DISABLED='1')
if name.startswith('node24-'):
 runtime = Path('/Users/jordanrichter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin')
 assert (runtime/'node').exists(), 'Set the verified Node 24 runtime path for this machine'
 env['PATH'] = str(runtime) + os.pathsep + env['PATH']
if name.endswith('build'):
 env.update(NEXT_PUBLIC_SITE_URL='https://ci.example.com', NEXT_PUBLIC_CLERK_ENABLED='false', NEXT_PUBLIC_SANITY_PROJECT_ID='gh97irjh', NEXT_PUBLIC_SANITY_DATASET='production', NEXT_PUBLIC_CONVEX_URL='https://ci-placeholder.convex.cloud', NODE_OPTIONS='--max-old-space-size=6144')
 if check == 'active-build':
  release = json.loads((repo/'src/lib/media-release/manifest.json').read_text())['revision']
  env.update(NEXT_PUBLIC_BB_MEDIA_RELEASE=release+':all', BB_MEDIA_LOCAL_REVIEW='true')
start = time.time()
with (folder/(name+'.log')).open('w') as output:
 result = subprocess.run(commands[check], cwd=repo, env=env, stdout=output, stderr=subprocess.STDOUT)
receipt = {'check': name, 'command': commands[check], 'exitCode': result.returncode, 'seconds': round(time.time()-start, 2), 'node': subprocess.check_output(['node','--version'], env=env, text=True).strip(), 'baseCommit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(), 'workingTreeChanges': True, 'environment': 'allowlisted; no credentials or deploy commands'}
(folder/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
raise SystemExit(result.returncode)
