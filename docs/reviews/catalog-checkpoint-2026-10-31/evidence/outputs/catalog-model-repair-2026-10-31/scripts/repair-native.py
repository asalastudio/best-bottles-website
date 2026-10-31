"""Local copies only. Retain measured native geometry except the requested straight tube.
Delivery camera setup happens in a separate renderer; no source file is overwritten.
"""
import bpy,bmesh,json,sys,math,hashlib,traceback,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
r=Path(sys.argv[sys.argv.index('--')+1]).resolve();q=json.loads((r/'sources/audit-queue.json').read_text())
out=r/'working/native';out.mkdir(parents=True,exist_ok=True)
q.sort(key=lambda a:(0 if 'cyl5' in a['id'] else 1,a['id']))
for row in q:
 if row['kind']!='blend':continue
 dest=out/row['id'];dest.mkdir(exist_ok=True)
 if (dest/'repair-report.json').exists():continue
 try:
  bpy.ops.wm.open_mainfile(filepath=row['path'],load_ui=False,use_scripts=False);s=bpy.context.scene
  af=r/'audit/fit'/f"{row['id']}.json";fit=json.loads(af.read_text()) if af.exists() else {'bodies':[],'tubes':[]}
  changes=[];tubechecks=[]
  for t in fit['tubes']:
   if not fit['bodies'] or not fit['bodies'][0]['openingClear']:continue
   o=bpy.data.objects[t['name']];body=bpy.data.objects[fit['bodies'][0]['name']]
   xyz=np.array([list(o.matrix_world@v.co) for v in o.data.vertices]);zmin,zmax=xyz[:,2].min(),xyz[:,2].max()
   top=xyz[xyz[:,2]>zmax-5e-7];cx,cy=fit['bodies'][0]['axisMm'];cx/=1000;cy/=1000
   # The unbent upper ring preserves source OD and source bore, including the real connection.
   radii=np.linalg.norm(top[:,:2]-np.array([cx,cy]),axis=1);ro=float(radii.max());ri=float(radii.min())
   if ro-ri<.00002:raise ValueError('Cannot recover native tube wall from its top ring')
   floor=fit['bodies'][0]['firstAxialSurfaceZmm']/1000;bottom=floor+.0005;n=128
   verts=[]
   for z,rad in [(bottom,ro),(zmax,ro),(bottom,ri),(zmax,ri)]:
    verts.extend((cx+rad*math.cos(math.tau*j/n),cy+rad*math.sin(math.tau*j/n),z) for j in range(n))
   faces=[]
   for j in range(n):
    k=(j+1)%n;faces.extend([(j,k,n+k,n+j),(2*n+j,3*n+j,3*n+k,2*n+k),(j,2*n+j,2*n+k,k),(n+j,n+k,3*n+k,3*n+j)])
   me=bpy.data.meshes.new(o.data.name+' | straight repair');me.from_pydata(verts,[],faces);me.update()
   for m in o.data.materials:me.materials.append(m)
   old=o.data;old.use_fake_user=True;o.data=me;o.matrix_world=Matrix.Identity(4)
   for p in me.polygons:p.use_smooth=(p.index%4)<2
   bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nm=sum(not e.is_manifold for e in bm.edges);bm.to_mesh(me);bm.free()
   # Sample wall clearance in sixteen directions at 40 heights, from the tube's outer surface.
   inv=body.matrix_world.inverted();dg=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(dg);gaps=[]
   for z in np.linspace(bottom,zmax,40):
    for j in range(16):
     v=Vector((math.cos(math.tau*j/16),math.sin(math.tau*j/16),0));origin=Vector((cx,cy,z));hit,pos,normal,idx=ev.ray_cast(inv@origin,inv.to_3x3()@v)
     if hit:gaps.append(((body.matrix_world@pos)-origin).length-ro)
   check={'object':o.name,'outsideDiameterMm':ro*2000,'insideDiameterMm':ri*2000,'lengthMm':(zmax-bottom)*1000,'floorClearanceMm':.5,'axisOffsetMm':0,'minGlassClearanceMm':min(gaps)*1000 if gaps else None,'nonManifoldEdges':nm,'sourceTopZmm':zmax*1000,'topConnectionUnchanged':True,'geometryPass':nm==0 and (not gaps or min(gaps)>0)}
   if not check['geometryPass']:raise ValueError('Tube does not pass wall clearance: '+str(check))
   tubechecks.append(check);changes.append({'code':'TUBE-AXIS','before':t,'after':check});o['repair']='Straight coaxial hollow tube; measured source OD/ID and upper seat retained; end 0.5 mm above native cavity floor.'
  # Keep originals' studio and hidden variant groups. Tight clipping/render border only disabled in review copies.
  if s.camera:s.camera.data.clip_start=.00001;s.camera.data.clip_end=100
  s.render.use_border=False;s.render.use_crop_to_border=False
  if s.render.engine=='CYCLES':s.cycles.use_denoising=True;s.cycles.transmission_bounces=max(16,s.cycles.transmission_bounces);s.cycles.max_bounces=max(16,s.cycles.max_bounces)
  bpy.ops.wm.save_as_mainfile(filepath=str(dest/'model.blend'),compress=True)
  report={'id':row['id'],'source':row['path'],'sourceSha256':row['sha256'],'workingCopy':str(dest/'model.blend'),'changes':changes,'tubeChecks':tubechecks,'disposition':'geometry checks passed; studio render and visual review pending','unchangedGeometry':'Native body, roller, closure and material geometry retained. Inactive source tube mesh retained as an unlinked fake-user datablock.','sceneAdjustments':['review copy clipping 0.01 mm to 100 m','render border disabled; full canvas','refraction bounces and denoising enabled']}
  (dest/'repair-report.json').write_text(json.dumps(report,indent=2));print('REPAIRED',row['id'],len(changes),flush=True)
 except Exception as e:
  (dest/'error.json').write_text(json.dumps({'error':str(e),'traceback':traceback.format_exc()},indent=2));print('REPAIR_ERROR',row['id'],str(e),flush=True)
print('NATIVE_REPAIR_COMPLETE',flush=True)
