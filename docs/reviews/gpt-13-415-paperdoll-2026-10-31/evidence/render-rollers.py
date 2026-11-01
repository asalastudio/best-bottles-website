import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd();OUT=ROOT/'outputs/catalog-model-repair-2026-10-31/13-415-gpt-paperdoll';SRC=Path('/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/cyl9-17415-studio-2026-09-30/export.py')
sys.argv=['blender','--','review'];ns={'__file__':str(SRC),'__name__':'review'};exec(compile(SRC.read_text(),str(SRC),'exec'),ns);ns['RAW']=OUT/'renders'
native=ROOT/'outputs/catalog-model-repair-2026-10-31/working/native/native-cyl5-13415-v7-review-2026-09-29__Cyl-5ml-13-415_clear_STUDIO-v1.5-body-v7e/model-fit-v8.blend'
def cpu(s,samples):
 s.cycles.device='CPU';s.cycles.samples=samples;s.cycles.seed=0;s.render.resolution_percentage=250;s.render.threads_mode='FIXED';s.render.threads=4;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
ns['gpu']=cpu
for kind in ['metal','plastic']:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Clear')
 with bpy.data.libraries.load(str(native),link=False) as (src,dst):dst.objects=[n for n in src.objects if n.startswith('roller-'+kind+' |')]
 objs=[]
 for o in dst.objects:
  mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw;s.collection.objects.link(o);o.hide_render=False;objs.append(o)
 ns['only'](s,{o.name for o in objs});ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,63)
 for o in objs:o.hide_render=False
 bpy.context.view_layer.update()
 housing=next(o for o in objs if 'housing' in o.name);vs=[housing.matrix_world@v.co for v in housing.data.vertices]
 center=(min(v.x for v in vs)+max(v.x for v in vs))/2
 flange_z=min(v.z for v in vs if math.hypot(v.x-center,v.y)>=.00546)
 crop=ns['set_crop'](s,ns['projected_box'](s,objs,12));axis,seat=ns['px'](s,(center,0,flange_z))
 ball=next(o for o in objs if 'ball' in o.name)
 assert max(ball.dimensions)-min(ball.dimensions)<.000001
 meta={'source':str(native),'partNames':[o.name for o in objs],'crop':crop,'axis':axis,'seat':seat,'sourcePxPerMm':25,'flangeSeatWorldMm':flange_z*1000,'ballDiameterMm':8.19,'flangeDiameterMm':11.21,'ballSphericityMaxAxisDeltaMm':(max(ball.dimensions)-min(ball.dimensions))*1000,'changes':'Isolated existing 13-415 assembly in studio; mesh, ball position, housing and plug preserved. Complete plug travels with seated ball.','acceptance':'visual-production candidate'}
 s.camera.data.clip_start=.001;s.camera.data.clip_end=100;cpu(s,64);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/('roller-'+kind+'.blend')));ns['render'](s,'roller-'+kind,64,meta)
