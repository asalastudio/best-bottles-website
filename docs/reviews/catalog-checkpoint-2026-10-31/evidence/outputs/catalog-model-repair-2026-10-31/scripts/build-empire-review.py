import bpy,bmesh,json,sys,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=r/'working/empire-assemblies';out.mkdir(exist_ok=True)
source=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/empire-18415-v34/export_empire.py')
text=source.read_text().split('\n# ------------------------------------------------------------------ modes')[0]
text=text.replace("RAW=R/'raw';RAW.mkdir(exist_ok=True)","RAW=Path('/tmp/bb-empire-unused-raw')")
text=text.replace("exec(_src[:_src.index('# ------------------------------------------------------------------ modes')])","exec(_src[:_src.index('# ------------------------------------------------------------------ modes')].replace(\"RAW=R/'raw';RAW.mkdir(exist_ok=True)\",\"RAW=Path('/tmp/bb-empire-unused-raw')\"))")
argv=sys.argv;sys.argv=['review','--','definitions'];env={'__file__':str(source)};exec(text,env);sys.argv=argv
for cap in ['50','100']:
 for mech in ['mist','lotion']:
  ident='empire-'+cap+'-'+mech;d=out/ident;d.mkdir(exist_ok=True)
  src=env['V27']/(mech+'-black-clear.blend');bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False,use_scripts=False);s=bpy.context.scene
  bottle,bodyinfo=env['empire_bottle'](s,cap);bpy.context.view_layer.update();E=env['EMP'][cap];rim=E['rim_mm']/1000;shoulder=E['shoulder_top_mm'];hd=[s.objects[n] for n in env['HEAD'][mech]];top=max((o.matrix_world@v.co).z for o in hd for v in o.data.vertices);kz=(env['UNIT_H']-env['COLLAR_TOP'])/((top-env['HEAD_BASE'])*1000)
  env['scale_about'](hd,1,kz,env['HEAD_BASE'],(shoulder+env['COLLAR_TOP'])/1000)
  oldcollar=s.objects[env['COLLAR'][mech]];mat=oldcollar.data.materials[0];collar=env['lathe'](s,('sprayer — ' if mech=='mist' else 'pump — ')+'18-415 collar',env['collar_profile'](shoulder),mat,list(oldcollar.users_collection))
  names=env['MIST_INTERNALS'] if mech=='mist' else env['LOT_INTERNALS'];internals=[s.objects[n] for n in names];env['scale_about'](internals,1.1,1.1,env['RIM9'],rim)
  tube=s.objects[names[1]];od=(1.69 if mech=='mist' else 3.55)*1.1
  beforetube,_=env['rebuild_tube'](s,names[0],names[1],bottle,od)
  env['only'](s,{bottle.name,collar.name,*[o.name for o in hd],*names});env['backdrop_bone'](s,env['BONE']);s.render.use_border=False;s.render.use_crop_to_border=False;s.camera.data.clip_start=.00001;s.camera.data.clip_end=100
  bpy.ops.wm.save_as_mainfile(filepath=str(d/'before-recipe.blend'),compress=True)
  top=max((tube.matrix_world@v.co).z for v in tube.data.vertices);bottom=beforetube['floor_mm']/1000+.0005;ro=od/2000;ri=ro-.00044;n=128;vs=[]
  for z,rad in [(bottom,ro),(top,ro),(bottom,ri),(top,ri)]:vs.extend((rad*math.cos(math.tau*j/n),rad*math.sin(math.tau*j/n),z) for j in range(n))
  fs=[]
  for j in range(n):k=(j+1)%n;fs.extend([(j,k,n+k,n+j),(2*n+j,3*n+j,3*n+k,2*n+k),(j,2*n+j,2*n+k,k),(n+j,n+k,3*n+k,3*n+j)])
  me=bpy.data.meshes.new('Straight Empire dip tube');me.from_pydata(vs,[],fs);me.update()
  for m in tube.data.materials:me.materials.append(m)
  tube.data=me;tube.matrix_world=Matrix.Identity(4);bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(me);bm.free()
  for p in me.polygons:p.use_smooth=p.index%4<2
  bpy.ops.wm.save_as_mainfile(filepath=str(d/'model.blend'),compress=True)
  report={'id':ident,'workingCopy':str(d/'model.blend'),'beforeCopy':str(d/'before-recipe.blend'),'recipe':str(source),'recipeSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceScene':str(src),'body':bodyinfo,'shoulderMm':shoulder,'changes':[{'code':'TUBE-AXIS','detail':'Straight centered hollow tube; floor gap changed from 0.3 to 0.5 mm; existing 18-415 recipe OD retained'}],'tube':{'old':beforetube,'outsideDiameterMm':od,'boreMm':ri*2000,'floorGapMm':.5,'nonManifoldEdges':nm},'qualification':'Existing drawing-based Empire body and published-size 18-415 assembly recipe; closures and scaled internals are not caliper-qualified'}
  (d/'repair-report.json').write_text(json.dumps(report,indent=2));print('EMPIRE_REPAIRED',ident,flush=True)
print('EMPIRE_ASSEMBLIES_COMPLETE',flush=True)
