import bpy,json,math
from pathlib import Path
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
out=Path.cwd()/'outputs/catalog-model-repair-2026-10-31/13-415-gpt-paperdoll/renders'
for kind in ['metal','plastic']:
 bpy.ops.wm.open_mainfile(filepath=str(out/('roller-'+kind+'.blend')));s=bpy.context.scene
 o=next(o for o in s.objects if o.name.startswith('roller-'+kind+' |') and 'housing' in o.name)
 bpy.context.view_layer.update()
 vs=[o.matrix_world@v.co for v in o.data.vertices]
 center=(min(v.x for v in vs)+max(v.x for v in vs))/2
 z=min(v.z for v in vs if math.hypot(v.x-center,v.y)>=.00546)
 point=world_to_camera_view(s,s.camera,Vector((center,0,z)));p=out/('roller-'+kind+'.json');m=json.loads(p.read_text())
 m['flangeSeatWorldMm']=z*1000;m['axis']=point.x*s.render.resolution_x*2.5;m['seat']=(1-point.y)*s.render.resolution_y*2.5;m['calibration']='Flange underside read from the exported scene world geometry after linked transforms evaluated.'
 p.write_text(json.dumps(m,indent=2));print(kind,'flange',z*1000,'seat',m['seat'])
