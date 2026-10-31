from pathlib import Path
source=Path(__file__).with_name('render-small.py');exec(compile(source.read_text().split('for h,label in [(37,')[0],str(source),'exec'))
for h,label in [(37,'3.3'),(49,'4')]:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Clear');old=next(o for o in s.objects if o.name.startswith('BB_BTL'));mat=old.material_slots[0].material.copy()
 tube=lathe('BB_BTL_tube_'+label,[(.55,3.5),(.55,h-12),(.35,h-12),(.35,3.5)],mat)
 housing=lathe('BB_BTL_pump_'+label,[(.7,h-13),(.7,h-11),(1.9,h-10),(1.9,h-3),(1.3,h-3),(1.3,h-9),(.4,h-10),(.4,h-13)],mat)
 springmat=bpy.data.materials.new('pump spring stainless');springmat.diffuse_color=(.22,.22,.22,1);springmat.use_nodes=True;bs=springmat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.22,.22,.22,1);bs.inputs['Metallic'].default_value=.8;bs.inputs['Roughness'].default_value=.25
 cu=bpy.data.curves.new('spring coil','CURVE');cu.dimensions='3D';cu.bevel_depth=.00012;cu.bevel_resolution=3;sp=cu.splines.new('POLY');sp.points.add(192)
 for i,p in enumerate(sp.points):a=i/192*math.tau*5;p.co=(.00105*math.cos(a),.00105*math.sin(a),(h-9+i/192*5)/1000,1)
 spring=bpy.data.objects.new('BB_BTL_spring',cu);s.collection.objects.link(spring);cu.materials.append(springmat)
 ns['only'](s,{tube.name,housing.name});ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,h);crop=ns['set_crop'](s,ns['projected_box'](s,[tube,housing],12));meta={'crop':crop,'axis':ns['px'](s,(0,0,0))[0],'baseline':ns['px'](s,(0,0,0))[1],'tubeOuterDiameterMm':1.1,'tubeInnerDiameterMm':.7,'tipHeightMm':3.5,'interiorBaseMm':2.8,'clearanceMm':.7}
 ns['gpu'](s,64);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'mechanism-{label}.blend'));ns['render'](s,'mechanism-'+label,64,meta)
