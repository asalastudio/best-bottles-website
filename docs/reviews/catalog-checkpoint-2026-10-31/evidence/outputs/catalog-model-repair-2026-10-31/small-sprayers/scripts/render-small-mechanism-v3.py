from pathlib import Path
source=Path(__file__).with_name('render-small.py');exec(compile(source.read_text().split('for h,label in [(37,')[0],str(source),'exec'))
def cpu_render_setup(s,samples):
 s.cycles.device='CPU';s.cycles.samples=samples;s.cycles.seed=0;s.render.resolution_percentage=ns['PCT']
 s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8'
 s.render.threads_mode='FIXED';s.render.threads=6
ns['gpu']=cpu_render_setup
def polymer(name,transmission,roughness):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.89,.91,.90,1);p.inputs['Roughness'].default_value=roughness;p.inputs['Transmission Weight'].default_value=transmission;p.inputs['IOR'].default_value=1.46
 return m
for h,label in [(37,'3.3'),(49,'4')]:
 bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Clear')
 # Hollow swept tube: fixed centered cartridge connection, gentle natural set.
 z0,z1=3.5,h-18; bend=1.1 if label=='3.3' else 1.7
 verts=[];faces=[];rings=97;around=64
 for radius in [.55,.35]:
  for j in range(rings):
   t=j/(rings-1);z=z0+(z1-z0)*t;x=bend*(1-t)**2
   tangent=Vector((-2*bend*(1-t)/(z1-z0),0,1)).normalized()
   normal=Vector((tangent.z,0,-tangent.x))
   for i in range(around):
    a=math.tau*i/around;v=Vector((x,0,z))+normal*(radius*math.cos(a))+Vector((0,radius*math.sin(a),0));verts.append(tuple(v/1000))
 for shell in range(2):
  offset=shell*rings*around
  for j in range(rings-1):
   for i in range(around):
    k=(i+1)%around;f=(offset+j*around+i,offset+j*around+k,offset+(j+1)*around+k,offset+(j+1)*around+i);faces.append(f if shell==0 else f[::-1])
 for j in [0,rings-1]:
  for i in range(around):
   k=(i+1)%around;f=(j*around+i,j*around+k,rings*around+j*around+k,rings*around+j*around+i);faces.append(f if j==0 else f[::-1])
 mesh=bpy.data.meshes.new('Hollow gently curved tube');mesh.from_pydata(verts,[],faces);mesh.update();tube=bpy.data.objects.new('BB_BTL_tube_'+label,mesh);s.collection.objects.link(tube);mesh.materials.append(polymer('Translucent dip tube PP',.72,.14))
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);assert all(e.is_manifold for e in bm.edges);bm.to_mesh(mesh);bm.free()
 for face in mesh.polygons:face.use_smooth=True
 assert max(abs(v.co.x)*1000 for v in mesh.vertices)<5.9
 assert min(v.co.z*1000 for v in mesh.vertices)>1.6

 profile=[(.9,h-19),(.9,h-16),(.95,h-15.5),(1.3,h-15),(1.85,h-13.6),(1.9,h-13),(1.9,h-4.7),(1.82,h-4.5),(1.55,h-4.5),(1.55,h-12.9),(.65,h-15.3),(.62,h-19)]
 housing=lathe('BB_BTL_pump_'+label,profile,polymer('Photo matched translucent pump housing',.68,.18))
 springmat=bpy.data.materials.new('Visible stainless pump spring');springmat.use_nodes=True;bs=springmat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.4,.42,.43,1);bs.inputs['Metallic'].default_value=.85;bs.inputs['Roughness'].default_value=.24
 cu=bpy.data.curves.new('spring coil','CURVE');cu.dimensions='3D';cu.bevel_depth=.00016;cu.bevel_resolution=4;sp=cu.splines.new('POLY');sp.points.add(384)
 for i,p in enumerate(sp.points):
  a=i/384*math.tau*7;p.co=(.00122*math.cos(a),.00122*math.sin(a),(h-12.6+i/384*6.6)/1000,1)
 spring=bpy.data.objects.new('BB_BTL_spring',cu);s.collection.objects.link(spring);cu.materials.append(springmat)
 stem=lathe('BB_BTL_pump_inner_stem',[(.3,h-16),(.3,h-5),(.2,h-5),(.2,h-16)],polymer('Pump piston translucent PP',.55,.22))
 ns['only'](s,{tube.name,housing.name,spring.name,stem.name});spring.hide_render=False
 ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,h);crop=ns['set_crop'](s,ns['projected_box'](s,[tube,housing],12))
 meta={'crop':crop,'axis':ns['px'](s,(0,0,0))[0],'baseline':ns['px'](s,(0,0,0))[1],'tubeOuterDiameterMm':1.1,'tubeInnerDiameterMm':.7,'tipHeightMm':3.5,'interiorBaseMm':1.6,'clearanceMm':1.9,'springVisible':not spring.hide_render,'source':'Original exact-SKU PSD pump layers, source-review/01-layer-06.png and 00-layer-02.png. Housing dimensions visually inferred, not supplier measured.','tipDeflectionMm':bend,'minimumTipClearanceMm':min(v.co.z*1000 for v in mesh.vertices)-1.6,'change':'Gentle quadratic bend, centered tangent at pump, unchanged 1.1 mm OD and 0.7 mm bore. Bend is visually inferred from source photos and user direction, not supplier measured.'}
 ns['gpu'](s,96);s.cycles.max_bounces=32;s.cycles.transmission_bounces=32
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders'/f'mechanism-{label}-v3.blend'));ns['render'](s,f'mechanism-{label}-v3',96,meta)
