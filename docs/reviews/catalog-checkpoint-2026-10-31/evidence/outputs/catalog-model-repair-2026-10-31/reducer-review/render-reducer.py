import bpy,bmesh,sys,json
from pathlib import Path
root=Path.cwd();out=Path(__file__).resolve().parent;(out/'renders').mkdir(exist_ok=True)
source=root/'outputs/catalog-model-repair-2026-10-31/small-sprayers/scripts/render-small.py';exec(compile(source.read_text().split('for h,label in [(37,')[0],str(source),'exec'))
ns['RAW']=out/'renders'
source_model=root/'outputs/catalog-model-repair-2026-10-31/working/legacy/glb-closures__BB_REDUCER_18415/model-shading-v3.blend'
for seated in [False,True]:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Clear')
 with bpy.data.libraries.load(str(source_model),link=False) as (src,dst):dst.objects=['BB_REDUCER_18415']
 o=dst.objects[0];s.collection.objects.link(o);o.name='BB_BTL_reducer_18415';o.data=o.data.copy();o.data.materials.clear();o.location.z=.060
 m=bpy.data.materials.new('Natural white reducer polypropylene');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.92,.93,.91,1);p.inputs['Roughness'].default_value=.26;p.inputs['Transmission Weight'].default_value=.10;p.inputs['IOR'].default_value=1.46;o.data.materials.append(m)
 if seated:
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,0),plane_no=(0,0,1),clear_inner=True,clear_outer=False,dist=1e-7);bm.to_mesh(o.data);bm.free()
 ns['only'](s,{o.name});ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,63);bpy.context.view_layer.update()
 crop=ns['set_crop'](s,ns['projected_box'](s,[o],12));meta={'crop':crop,'axis':ns['px'](s,(0,0,.060))[0],'seat':ns['px'](s,(0,0,.060))[1],'pxPerMm':25,'source':str(source_model),'sourceDimensionsMm':[11.63,11.63,12.95],'inferred':'Orifice diameter 1.6 mm is inherited from existing traced model, not manufacturer measured','seated':seated}
 name='reducer-18415-'+('seated' if seated else 'full');ns['gpu'](s,96);bpy.ops.wm.save_as_mainfile(filepath=str(out/'renders'/f'{name}.blend'));ns['render'](s,name,96,meta)
