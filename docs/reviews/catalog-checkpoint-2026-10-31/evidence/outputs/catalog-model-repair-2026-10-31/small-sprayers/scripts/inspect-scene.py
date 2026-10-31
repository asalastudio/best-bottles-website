import bpy
bpy.ops.wm.open_mainfile(filepath='/Users/jordanrichter/Documents/Codex/2026-09-24/the-image-is-clearly-the-target/outputs/lotion-internals-v30/lotion-v30-photo-w1.05.blend')
for o in bpy.context.scene.objects:
 if o.name.startswith('BB_BTL'):print('BODY',o.name,list(o.dimensions),[(s.material.name if s.material else '') for s in o.material_slots])
