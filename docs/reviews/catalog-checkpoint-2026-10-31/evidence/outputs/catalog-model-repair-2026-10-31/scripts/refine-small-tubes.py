import bpy,json,sys,math
from pathlib import Path
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();rows=[]
for kind in ['native','priority-assemblies']:
 for f in (r/'working'/kind).glob('*/repair-report-v8.json'):
  a=json.loads(f.read_text());d=f.parent
  if kind=='native' and not any(t in a['id'] for t in ['cyl5-','tall-9ml-']):continue
  bpy.ops.wm.open_mainfile(filepath=a['workingCopy'],load_ui=False,use_scripts=False);s=bpy.context.scene;changes=[]
  for o in s.objects:
   if o.type!='MESH' or 'dip tube' not in o.name.lower() or 'barb' in o.name.lower():continue
   inv=o.matrix_world.inverted();oldmax=max((o.matrix_world@v.co).xy.length for v in o.data.vertices)
   for v in o.data.vertices:
    pt=o.matrix_world@v.co;rad=pt.xy.length
    if rad>.0005:pt.x*=.000525/rad;pt.y*=.000525/rad;v.co=inv@pt
   o.data.update();old=o.data.materials[0];m=old.copy();m.name='Review | thin translucent PE dip tube';o.data.materials[0]=m
   for n in m.node_tree.nodes:
    if n.type=='BSDF_PRINCIPLED':n.inputs['Transmission Weight'].default_value=1;n.inputs['Roughness'].default_value=.12;n.inputs['Base Color'].default_value=(.98,.98,.98,1);n.inputs['IOR'].default_value=1.49
   changes.append({'object':o.name,'beforeOutsideDiameterMm':oldmax*2000,'outsideDiameterMm':1.05,'boreMm':.6365,'wallMm':.20675,'topAndBottomUnchanged':True})
  if not changes:continue
  a['changes'].append({'code':'TUBE-VISUAL-THICKNESS','detail':'Slimmed the 13-415 spray tube from 1.4365 to 1.05 mm OD against the Sleek product photograph; retained 0.6365 mm bore and upper/lower positions. Updated translucent PE surface response. Photo-based visual calibration, not supplier caliper data.','measurements':changes})
  a['tubeVisualQualification']={'reference':'renders/before/catalog/GBSleek5SpryBlkMatt.webp','method':'Matched apparent tube-to-bottle width and translucency in the same 13-415 spray assembly; no supplier tube drawing available','manufacturerDiameterVerified':False,'outsideDiameterMm':1.05,'boreMm':.6365,'wallMm':.20675,'pilot':'renders/pilots/tube-slim/sleek5-transparent.png'}
  a['workingCopy']=str(d/'model-tube-v13.blend');bpy.ops.wm.save_as_mainfile(filepath=a['workingCopy'],compress=True);(d/'repair-report-v13.json').write_text(json.dumps(a,indent=2));rows.append({'id':a['id'],'path':a['workingCopy'],'kind':kind});print('TUBE_REFINED',a['id'],changes,flush=True)
(r/'sources/tube-visual-refinements.json').write_text(json.dumps(rows,indent=2));print('TUBE_REFINEMENTS_COMPLETE',len(rows),flush=True)
