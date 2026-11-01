from pathlib import Path
import hashlib,json,zipfile,tempfile,subprocess
root=Path.cwd();doc=root/'docs/reviews/cylinder9-glass-refraction-2026-11-01'
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[]
for p in sorted(doc.rglob('*')):
 if not p.is_file() or p.name in ['manifest.json','drive-receipt.json','archive-verification.json']:continue
 rel=p.relative_to(doc).as_posix();e={'path':rel,'bytes':p.stat().st_size,'sha256':digest(p)}
 if rel.startswith('runtime/'):e['restoreTo']=rel[len('runtime/'):]
 files.append(e)
manifest={'date':'2026-11-01','status':'review','files':files};(doc/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
restore=Path(tempfile.mkdtemp(prefix='cylinder9-refraction-v03-restore-'))
check=subprocess.run(['node',str(doc/'restore.mjs'),'--root',str(restore),'--apply'],capture_output=True,text=True,check=True)
for e in files:
 if e.get('restoreTo'):assert digest(restore/e['restoreTo'])==e['sha256']
archive=root/'outputs/family-master-library-2026-11-01/Cylinder_9ml_Sunburst-Glass-Refraction_2026-11-01_v03.zip';archive.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for p in [doc/e['path'] for e in files]+[doc/'manifest.json']:z.write(p,doc.name+'/'+p.relative_to(doc).as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for e in files:assert hashlib.sha256(z.read(doc.name+'/'+e['path'])).hexdigest()==e['sha256']
 result={'archive':archive.relative_to(root).as_posix(),'bytes':archive.stat().st_size,'sha256':digest(archive),'zipEntries':len(z.namelist()),'crcPass':True,'entryHashesPass':True,'restore':json.loads(check.stdout),'restoredInto':str(restore)}
(doc/'archive-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
