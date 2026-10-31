import bpy,math,json,hashlib,bmesh
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
out=Path(__file__).resolve().parents[1];rows=[]
for glass in ['clear','cobalt']:
 p=out/'renders'/f'glass-5-{glass}-measured-v9.blend';bpy.ops.wm.open_mainfile(filepath=str(p));o=bpy.data.objects['BB_BTL_Cylinder5_measured_envelope'];pts=[tuple(v.co) for v in o.data.vertices];mm=[(math.hypot(x,y)*1000,z*1000) for x,y,z in pts];lo=min(z for r,z in mm);hi=max(z for r,z in mm)
 floor=min(z for r,z in mm if r<2 and z>1);barrel=max(r for r,z in mm if 8<z<38)*2
 bore=min(r for r,z in mm if 45<z<50)*2;crest=max(r for r,z in mm if 45<z<51.3)*2;root=min(r for r,z in mm if 45<z<47 and r>5.5)*2
 lipIn=min(r for r,z in mm if 52.2<z<52.8)*2;lipOut=max(r for r,z in mm if 52.2<z<52.8)*2
 bm=bmesh.new();bm.from_mesh(o.data);geo={'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'flippedEdges':sum(e.is_manifold and not e.is_contiguous for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-15 for f in bm.faces)};bm.free()
 measured={'heightMm':hi-lo,'barrelDiameterMm':barrel,'internalDepthMm':hi-floor,'baseThicknessMm':floor-lo,'rootDiameterMm':root,'crestDiameterMm':crest,'threadBoreMm':bore,'plainRimDiameterMm':lipOut,'lipBoreMm':lipIn,'rimWallMm':(lipOut-lipIn)/2,'threadCrestWallMm':(crest-bore)/2}
 expected={'heightMm':53.23,'barrelDiameterMm':17.55,'internalDepthMm':48.8,'baseThicknessMm':4.43,'rootDiameterMm':12,'crestDiameterMm':12.64,'threadBoreMm':7.36,'plainRimDiameterMm':12,'lipBoreMm':8.4,'rimWallMm':1.8,'threadCrestWallMm':2.64}
 checks={k:abs(measured[k]-v)<.015 for k,v in expected.items()}; scene=bpy.context.scene; baseWorld=o.matrix_world@Vector((0,0,lo/1000)); neckWorld=o.matrix_world@Vector((0,0,hi/1000)); baseCamera=world_to_camera_view(scene,scene.camera,baseWorld); neckCamera=world_to_camera_view(scene,scene.camera,neckWorld); checks['baseDownNeckUp']=neckWorld.z>baseWorld.z and neckCamera.y>baseCamera.y; checks['cameraClipSafe']=scene.camera.data.clip_start<baseCamera.z<scene.camera.data.clip_end and scene.camera.data.clip_start<neckCamera.z<scene.camera.data.clip_end;sha=hashlib.sha256(repr(pts).encode()).hexdigest();rows.append({'glass':glass,'file':str(p),'measured':measured,'expected':expected,'checks':checks,'geometry':geo,'geometrySha256':sha});print(glass,measured,checks,flush=True)
report={'rows':rows,'sameGeometryForBothGlasses':rows[0]['geometrySha256']==rows[1]['geometrySha256']};(out/'five-measured-verification.json').write_text(json.dumps(report,indent=2));assert report['sameGeometryForBothGlasses'] and all(all(r['checks'].values()) and not any(r['geometry'].values()) for r in rows)
