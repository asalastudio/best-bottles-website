from pathlib import Path
import bpy,sys,json,shutil,hashlib
OUT=Path(__file__).resolve().parents[1]
SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
reference=Path('/Users/jordanrichter/Downloads/EB36A593-F711-4CAD-8D9C-5671333C48B3.PNG');dest=OUT/'user-photos/clear-5ml-appearance-reference.png';shutil.copy2(reference,dest)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'renders/glass-5-clear-measured-v14.blend'));s=bpy.context.scene;body=bpy.data.objects['BB_BTL_Cylinder5_measured_envelope'];geo=ns['geo'](body)
# Full-height graded strip sources make continuous curved reflections, with no rectangular
# top/bottom ends within the glass. Geometry and refractive material stay measured-v9.
ns['_strip'](s,'Clear reference | full-height left highlight',-.035,-.026,.018,.15,35,.0265,1.5)
ns['_strip'](s,'Clear reference | full-height right highlight',.045,-.018,.023,.15,22,.0265,1.5)
meta=json.loads((OUT/'renders/glass-5-clear-measured-v14.json').read_text());meta.update({'sourceScene':'glass-5-clear-measured-v14.blend','referenceImage':str(reference),'referenceSha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'referenceUse':'User-confirmed clear 5 ml glass example; lighting and visible glass cues, with measured dimensions retained','appearanceChanges':meta['appearanceChanges']+['Two full-height soft vertical highlights based on user clear-5ml reference; their ends stay beyond bottle bounds'],'geometrySha256':geo,'status':'Local clear-5ml reference review candidate'})
assert ns['geo'](body)==geo
stem='glass-5-clear-measured-v16';ns['gpu'](s,128);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'{stem}.blend'));ns['render'](s,stem,128,meta)
