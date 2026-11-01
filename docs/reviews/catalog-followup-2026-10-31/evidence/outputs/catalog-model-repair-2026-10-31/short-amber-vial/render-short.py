from pathlib import Path
source=Path.cwd()/'outputs/catalog-model-repair-2026-10-31/small-sprayers/scripts/render-small.py'
exec(compile(source.read_text().split('for h,label in [(37,')[0],str(source),'exec'))
OUT=Path.cwd()/'outputs/catalog-model-repair-2026-10-31/short-amber-vial';ns['RAW']=OUT/'renders'
bpy.ops.wm.open_mainfile(filepath=str(ns['LOT']));s=bpy.context.scene;ns['restudio'](s,'Amber');ns['look'](s,'Amber')
old=next(o for o in s.objects if o.name.startswith('BB_BTL'));mat=old.material_slots[0].material.copy()
if 'Amber' in ns['ABSORB']:
 col,den=ns['ABSORB']['Amber']
 for node in mat.node_tree.nodes:
  if node.type=='VOLUME_ABSORPTION':node.inputs['Color'].default_value=(*col,1);node.inputs['Density'].default_value=den
# Envelope from the exact SKU legacy page. Interior/finish radii inferred from
# its reference photograph; this is a visual review model, not a tooling drawing.
profile=[(.01,.5),(6.9,.5),(7.5,.6),(7.85,.9),(8,1.4),(8,12.5),(7.98,12.9),(7.85,13.3),(7.55,13.65),(7.05,13.9),(6.35,14.1),(6.25,14.35),(6.25,21.2),(6.45,21.35),(6.45,21.75),(6.2,22),(5.25,22),(5.05,21.7),(5.05,14.5),(6.7,13),(7,12.5),(7,2.1),(6.7,1.7),(.01,1.7)]
body=lathe('BB_BTL_short_amber_22x16',profile,mat)
# Continuous two-turn finish; smoothly rounded roots/crests and end ramps.
verts=[];faces=[];steps=768;around=24
for j in range(steps+1):
 t=j/steps;a=t*math.tau*2.1;z=16+t*4.65;fade=min(1,t/.035,(1-t)/.035);rr=.35*max(.05,fade)
 for i in range(around):
  b=i*math.tau/around;r=6.45+rr*math.cos(b);verts.append((r*math.cos(a)/1000,r*math.sin(a)/1000,(z+rr*math.sin(b))/1000))
for j in range(steps):
 for i in range(around):k=(i+1)%around;faces.append((j*around+i,j*around+k,(j+1)*around+k,(j+1)*around+i))
faces.append(tuple(range(around-1,-1,-1)));faces.append(tuple(steps*around+i for i in range(around)))
mesh=bpy.data.meshes.new('short vial finish');mesh.from_pydata(verts,[],faces);mesh.update();threads=bpy.data.objects.new('BB_BTL_short_amber_threads',mesh);s.collection.objects.link(threads);mesh.materials.append(mat)
for face in mesh.polygons:face.use_smooth=True
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);assert all(e.is_manifold for e in bm.edges);bm.to_mesh(mesh);bm.free()
ns['only'](s,{body.name,threads.name});ns['backdrop_bone'](s,ns['BONE']);ns['card_top'](s,22)
s.camera.data.clip_start=.001;s.camera.data.clip_end=100
crop=ns['set_crop'](s,ns['projected_box'](s,[body,threads],18));meta={'crop':crop,'axis':ns['px'](s,(0,0,0))[0],'baseline':ns['px'](s,(0,0,0))[1],'shoulder':ns['px'](s,(0,0,.0141))[1],'rim':ns['px'](s,(0,0,.022))[1],'heightMm':22,'diameterMm':16,'sourcePxPerMm':25,'source':'Exact SKU legacy page and photograph GBVialAmb1o5WhtCapSht','inferred':['neck height and thread profile from source photograph','0.8-1 mm wall','1.7 mm interior floor'],'acceptanceClass':'visual-review; no manufacturing validation'}
s.cycles.device='CPU';s.cycles.samples=96;s.render.threads_mode='FIXED';s.render.threads=6
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'renders/short-amber-v1.blend'));ns['render'](s,'short-amber-v1',96,meta)
