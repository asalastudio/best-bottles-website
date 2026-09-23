#!/usr/bin/env python3
"""Index saved exact-page evidence. URL/filename wording never supplies identity."""
import argparse, hashlib, html, json, re
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

FAMILIES = ['Elegant', 'Diva', 'Circle', 'Sleek']

def canonical(url):
    p=urlsplit(url)
    return urlunsplit((p.scheme,p.netloc,re.sub('/+','/',p.path),p.query,''))

def index(batch):
    catalog=json.loads((batch/'catalog.json').read_text())
    products={p['websiteSku']:p for p in catalog['products'] if p.get('websiteSku')}
    rows=[];errors=[];discovered=set();completed=set()
    for path in sorted((batch/'evidence/pages').glob('*.json')):
        doc=json.loads(path.read_text());url=doc['requestedUrl'];completed.add(canonical(url));text=doc.get('html','')
        headings=[html.unescape(re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<h1\b[^>]*>(.*?)</h1>',text,re.S|re.I)]
        # The legacy product template has a site heading followed by its exact SKU.
        if len(headings)!=2 or not headings[1] or re.search(r'\s',headings[1]):
            errors.append({'url':url,'reason':'Product template did not return one exact SKU heading','headings':headings});continue
        sku=headings[1];images=[]
        for tag in re.findall(r'<img\b[^>]*>',text,re.I):
            attrs=dict((a.lower(),html.unescape(b)) for a,_,b in re.findall(r'([\w-]+)\s*=\s*([\"\x27])(.*?)\2',tag,re.S))
            src=urljoin(url,attrs.get('src',''))
            if '/images/store/' in src and any('/'+folder+'/' in src for folder in ['enlarged_pics','capped','measured','depthview','sideview','aerial']):
                if not any(x['url']==src for x in images):images.append({'url':src,'description':attrs.get('alt','')})
        description=next((x['description'] for x in images if x['description']),None)
        described_family=next((f for f in FAMILIES if description and re.search(r'\b'+f+r'\s+(?:design|style|bottle)',description,re.I)),None)
        p=products.get(sku);family=p.get('family') if p else described_family
        if family not in FAMILIES:
            errors.append({'url':url,'sku':sku,'reason':'Returned product is outside the requested families or family is unresolved'});continue
        conflicts=[]
        if described_family and family!=described_family:conflicts.append('Catalog family differs from product-page description')
        capacities=re.findall(r'\b(\d+(?:\.\d+)?)\s*ml\b',description or '',re.I)
        if p and capacities and p.get('capacityMl') is not None and float(capacities[0])!=p['capacityMl']:
            conflicts.append(f"Catalog capacity {p['capacityMl']} mL differs from page description {capacities[0]} mL")
        # Gallery links are source discovery; the folder alone is not a visual-state decision.
        html_path=path.with_suffix('.html');html_path.write_text(text)
        rows.append({'sku':sku,'family':family,'url':url,'fetchedAt':doc['fetchedAt'],'file':str(html_path.relative_to(batch)),
            'sha256':hashlib.sha256(html_path.read_bytes()).hexdigest(),'description':description,'gallery':images,
            'catalogRecordId':p.get('_id') if p else None,'conflicts':conflicts})
        for link in doc.get('links',[]):
            link=canonical(link)
            if urlsplit(link).netloc=='www.bestbottles.com' and '/product/' in link and any(f.lower() in link.lower() for f in FAMILIES):discovered.add(link)
    by_sku={}
    for r in rows:by_sku.setdefault(r['sku'],[]).append(r)
    missing=[{'sku':p['websiteSku'],'family':p.get('family'),'recordId':p['_id']} for p in products.values() if p.get('family') in FAMILIES and p['websiteSku'] not in by_sku]
    result={'generatedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'pages':rows,'errors':errors,
        'unverifiedCatalogRows':missing,'additionalLegacyRows':[r for r in rows if not r['catalogRecordId']],
        'additionalDiscoveredUrls':sorted(discovered-completed),'counts':{'pages':len(rows),'exactSkus':len(by_sku),'errors':len(errors),
        'catalogRowsWithoutPage':len(missing),'additionalLegacySkus':len({r['sku'] for r in rows if not r['catalogRecordId']}),'additionalUrls':len(discovered-completed)}}
    (batch/'evidence/index.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result['counts']))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--batch',type=Path,required=True);args=parser.parse_args();index(args.batch)
