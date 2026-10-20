"""Package only the isolated media preview. Never edits the source checkout."""
from pathlib import Path
import json,shutil,tempfile,subprocess,hashlib
root=Path.cwd(); stage=Path(tempfile.mkdtemp(prefix='bb-isolated-frontend-'))
for folder in ['src','convex','messages']:
    shutil.copytree(root/folder,stage/folder)
for folder in ['asset-ledger','reconciliation','descriptions','register/drawings']:
    source=root/'data'/folder
    if source.exists():shutil.copytree(source,stage/'data'/folder)
for name in ['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','tsconfig.build.json','postcss.config.mjs','sanity.config.ts','sanity.cli.ts']:
    shutil.copy2(root/name,stage/name)
for name in ['scripts/vercel-build.sh','scripts/media-release/preflight.ts']:
    dest=stage/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/name,dest)
# Keep app-wide interface artwork and Builder cutouts. Review archives, unrelated
# catalog families, 3D source libraries and PSD masters are not this media preview.
publicFolders=['assets/hero','assets/homepage','images/bottle-builder','fonts','media-releases']
for name in publicFolders:
    source=root/'public'/name
    if source.exists():shutil.copytree(source,stage/'public'/name)
for f in (root/'public').iterdir():
    if f.is_file() and f.suffix.lower() in ['.png','.jpg','.webp','.ico','.svg','.txt','.json']:
        shutil.copy2(f,stage/'public'/f.name)
# Directly referenced interface assets, and every exact SKU's previous hero.
script='''const fs=require('node:fs');const m=require('./src/lib/media-release/manifest.json');const {getProductHero}=require('./src/lib/products/catalog-heroes');process.env.NEXT_PUBLIC_BB_MEDIA_RELEASE='off';console.log(JSON.stringify(m.entries.map(e=>getProductHero(e.websiteSku)?.url).filter(Boolean)));'''
paths=set(json.loads(subprocess.check_output(['node','--import','tsx','-e',script],text=True)))
import re
for f in (root/'src').rglob('*'):
    if f.suffix in ['.ts','.tsx','.css']:
        paths.update(re.findall(r'''["'`](/(?:assets|images|fonts)/[^"'`?${}]+)["'`]''',f.read_text()))
for url in paths:
    f=root/'public'/url.lstrip('/')
    if f.is_file() and f.suffix.lower() not in ['.psd','.hdr','.glb','.blend']:
        dest=stage/'public'/url.lstrip('/');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
config=json.loads((root/'vercel.json').read_text());config.pop('crons',None)
(stage/'vercel.json').write_text(json.dumps(config,indent=2)+'\n')
(stage/'.vercelignore').write_text('node_modules/\n.next/\n.vercel/\n.env*\n')
files={str(p.relative_to(stage)):hashlib.sha256(p.read_bytes()).hexdigest() for p in stage.rglob('*') if p.is_file()}
receipt={'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'files':files,'count':len(files),'bytes':sum((stage/p).stat().st_size for p in files),'adjustments':['No Vercel crons in the isolated preview','Only scoped media and interface assets copied','Build-time data imports retained; local review data and tests excluded']}
(root/'docs/reviews/isolated-preview-deployment-2026-10-20/frontend-package.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'path':str(stage),'files':len(files),'MB':round(receipt['bytes']/1e6,1)}))
