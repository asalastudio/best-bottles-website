import argparse, concurrent.futures, datetime, hashlib, json, re, subprocess
from pathlib import Path
from urllib.parse import urlencode, urlparse

parser=argparse.ArgumentParser(description='Read-only audit of live builder finish image dependencies')
parser.add_argument('--expect',type=int,required=True,help='Expected number of unique old-host URLs')
parser.add_argument('--references',type=int,required=True,help='Expected old-host configuration reference count')
args=parser.parse_args()
OUT = Path(__file__).resolve().parents[1] / 'output/legacy-finish-images/live-audit'
OUT.mkdir(parents=True,exist_ok=True)
BASE = 'https://best-bottles-website.vercel.app'
def fetch(url):
    return subprocess.check_output(['curl','--fail','--silent','--show-error','--retry','2',url])
def props(value):
    if isinstance(value,dict):
        if 'openFamily' in value and 'bodies' in value: yield value
        for v in value.values():yield from props(v)
    elif isinstance(value,list):
        for v in value:yield from props(v)
def family(f):
    name=f['family'];raw=fetch(BASE+'/matrix?'+urlencode({'family':name}))
    (OUT/('page-'+name.replace(' ','-')+'.html')).write_bytes(raw)
    bodies=[]
    for block in re.findall(r'self\.__next_f\.push\((.*?)\)</script>',raw.decode()):
        value=json.loads(block)
        if len(value)<2 or not isinstance(value[1],str):continue
        for line in value[1].splitlines():
            try: record=json.loads(line.split(':',1)[1])
            except (ValueError,IndexError):continue
            for p in props(record):
                if p['openFamily']==name:bodies.extend(p['bodies'])
    if len(bodies)!=f['groups']:print('COUNT DIFFERENCE',name,len(bodies),f['groups'],flush=True)
    return [(name,b['id']) for b in bodies]
def body(pair):
    name,bodyid=pair
    raw=fetch(BASE+'/api/bottle-builder/bodies?'+urlencode({'family':name,'bodyId':bodyid}))
    (OUT/('body-'+hashlib.sha256(bodyid.encode()).hexdigest()[:16]+'.json')).write_bytes(raw)
    return json.loads(raw)['configurations']
familyBytes=fetch(BASE+'/api/bottle-builder/families')
(OUT/'live-families.json').write_bytes(familyBytes)
families=json.loads(familyBytes)['families']
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    pairs=[p for result in pool.map(family,families) for p in result]
    configurations=[c for result in pool.map(body,pairs) for c in result]
(OUT/'live-configurations.json').write_text(json.dumps(configurations,indent=2)+'\n')
assets={}
for c in configurations:
    fc=c['finishComponent'];url=fc.get('imageUrl') or ''
    if urlparse(url).hostname not in ('bestbottles.com','www.bestbottles.com'):continue
    a=assets.setdefault(url,dict(legacyUrl=url,legacyPath=urlparse(url).path,filename=urlparse(url).path.split('/')[-1],componentWebsiteSkus=set(),componentNames=set(),affectedConfigurationSkus=set(),affectedGraceSkus=set(),pdpGroups=set()))
    for field,val in [('componentWebsiteSkus',fc['websiteSku']),('componentNames',fc['name']),('affectedConfigurationSkus',c['id']),('affectedGraceSkus',c['product'].get('graceSku')),('pdpGroups',c['product'].get('productGroupSlug'))]:
        if val:a[field].add(val)
result=dict(source='Independent live public builder API audit',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),families=len(families),bodies=len(pairs),configurations=len(configurations),uniqueLegacyUrls=len(assets),configurationReferences=sum(len(a['affectedConfigurationSkus']) for a in assets.values()),assets=[{k:sorted(v) if isinstance(v,set) else v for k,v in a.items()} for _,a in sorted(assets.items())])
(OUT/'independent-migration-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
print({k:v for k,v in result.items() if k!='assets'})

assert result['uniqueLegacyUrls']==args.expect and result['configurationReferences']==args.references, 'Unexpected legacy image scope; see output manifest'
