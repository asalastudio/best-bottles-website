"""Exercise the compiled media protocol locally. Never issues a backend request."""
from pathlib import Path
import os, sys, json, subprocess, urllib.request, urllib.error, hashlib, time, socket
root = Path(__file__).resolve().parents[2]
folder = root/'docs/reviews/empire-round-release-prep-2026-10-20'
manifest = json.loads((root/'src/lib/media-release/manifest.json').read_text())
mode = sys.argv[1]
node_binary = sys.argv[2] if len(sys.argv) > 2 else 'node'
assert mode in ['active', 'off']
revision = manifest['revision']+':all' if mode == 'active' else 'media-off-v1'
wrong = 'media-off-v1' if mode == 'active' else manifest['revision']+':all'
env = {k:v for k,v in os.environ.items() if k in {'PATH','HOME','TMPDIR','LANG','LC_ALL'}}
env.update(NODE_ENV='production', NEXT_TELEMETRY_DISABLED='1', NEXT_PUBLIC_SITE_URL='https://ci.example.com', NEXT_PUBLIC_CLERK_ENABLED='false', NEXT_PUBLIC_SANITY_PROJECT_ID='gh97irjh', NEXT_PUBLIC_SANITY_DATASET='production', NEXT_PUBLIC_CONVEX_URL='https://ci-placeholder.convex.cloud')
if mode == 'active': env.update(NEXT_PUBLIC_BB_MEDIA_RELEASE=revision, BB_MEDIA_LOCAL_REVIEW='true')
with socket.socket() as check:
 check.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
 check.bind(('127.0.0.1', 3011))
def get(url):
 try:
  with urllib.request.urlopen('http://127.0.0.1:3011'+url, timeout=5) as r:return r.status, dict(r.headers), r.read()
 except urllib.error.HTTPError as e:return e.code, dict(e.headers), e.read()
checks = []
with (folder/(mode+'-http-server.log')).open('w') as output:
 process = subprocess.Popen([node_binary,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3011'], cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT)
 try:
  url = manifest['entries'][0]['hero']['url']
  for _ in range(80):
   if process.poll() is not None: raise RuntimeError('Local test server exited before verification')
   try:
    if get(url)[0] == 200: break
   except (urllib.error.URLError,TimeoutError): pass
   time.sleep(.25)
  else: raise RuntimeError('Local server did not start')
  for route in ['kits','bodies','families']:
   for attempt in range(2):
    status, headers, data = get('/api/bottle-builder/'+route+'?mediaRevision='+urllib.parse.quote(wrong))
    assert status == 409, (route,status,data)
    lower={k.lower():v for k,v in headers.items()}
    assert lower['cache-control']=='no-store'
    assert lower['x-bb-media-revision']==revision, lower
   checks.append({'route':route,'mismatchedRevisionStatus':409,'repeatRequestStatus':409,'cacheControl':'no-store','responseRevision':revision})
  # Missing identifiers exit before querying any backend.
  for route in ['kits','bodies']:
   assert get('/api/bottle-builder/'+route+'?mediaRevision='+urllib.parse.quote(revision))[0]==400
  for asset in set(manifest['assetMap'].values()):
   status,_,data=get(asset)
   assert status == 200 and hashlib.sha256(data).hexdigest() in asset
  receipt={'node':subprocess.check_output([node_binary,'--version'],env=env,text=True).strip(),'mode':mode,'revision':revision,'checks':checks,'immutableAssetsOverNextHttp':len(set(manifest['assetMap'].values())),'backendRequests':0,'scope':'Local built Next server. Does not exercise a hosted CDN or checkout.'}
  (folder/(mode+'-http-verification.json')).write_text(json.dumps(receipt,indent=2)+'\n')
  print(json.dumps(receipt))
 finally:
  process.terminate()
  try: process.wait(timeout=15)
  except subprocess.TimeoutExpired: process.kill();process.wait()
