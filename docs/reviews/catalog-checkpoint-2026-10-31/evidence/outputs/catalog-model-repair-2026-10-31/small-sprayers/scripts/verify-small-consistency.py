import bpy,json,math
from pathlib import Path
base=Path(__file__).resolve().parents[1]
report={'source':'Current local Blender scenes; visual comparison with user-provided original-site screenshots','sizes':[]}
for size,height in [('3.3',37),('4',49)]:
 bpy.ops.wm.open_mainfile(filepath=str(base/'renders'/f'glass-{size}-profile-v4.blend'))
 body=next(o for o in bpy.context.scene.objects if o.name.startswith('BB_BTL_small_'+size))
 points=[body.matrix_world@v.co for v in body.data.vertices]
 mm=[(p.x*1000,p.y*1000,p.z*1000) for p in points]
 floor=max(z for x,y,z in mm if math.hypot(x,y)<.01)
 maxdiam=2*max(math.hypot(x,y) for x,y,z in mm)
 heel=sorted(set(round(z,4) for x,y,z in mm if z<=2.4))
 bpy.ops.wm.open_mainfile(filepath=str(base/'renders'/f'mechanism-{size}-v2.blend'))
 tube=next(o for o in bpy.context.scene.objects if o.name.startswith('BB_BTL_tube_'+size))
 pts=[tube.matrix_world@v.co for v in tube.data.vertices]
 tube_min=min(p.z for p in pts)*1000;tube_max=max(p.z for p in pts)*1000
 diameter=2*max(math.hypot(p.x,p.y) for p in pts)*1000
 row={'sizeMl':float(size),'bodyHeightMm':max(p[2] for p in mm)-min(p[2] for p in mm),'bodyDiameterMm':maxdiam,'interiorFloorMm':floor,'tubeTipMm':tube_min,'tipClearanceMm':tube_min-floor,'tubeOuterDiameterMm':diameter,'tubeTopMm':tube_max,'tubeCentered':abs(max(p.x for p in pts)+min(p.x for p in pts))<1e-8 and abs(max(p.y for p in pts)+min(p.y for p in pts))<1e-8,'heelZProfileMm':heel}
 assert abs(row['bodyHeightMm']-height)<.001 and abs(maxdiam-14)<.001
 assert 0<row['tipClearanceMm']<2 and abs(diameter-1.1)<.001 and row['tubeCentered']
 report['sizes'].append(row)
report['matchedHeelProfiles']=report['sizes'][0]['heelZProfileMm']==report['sizes'][1]['heelZProfileMm']
report['heelProfileMaxDeltaMm']=max(abs(a-b) for a,b in zip(report['sizes'][0]['heelZProfileMm'],report['sizes'][1]['heelZProfileMm']))
report['heelProfilesConsistentWithin001Mm']=report['heelProfileMaxDeltaMm']<.01
assert report['heelProfilesConsistentWithin001Mm']
report['notes']=['Tube diameter and concealed neck geometry are modeling assumptions, not supplier measurements.','Mechanism v2 uses the current 1.6 mm base: actual tip clearance is 1.9 mm. The housing and spring follow the exact-SKU source photo visually.']
(base/'small-consistency-native.json').write_text(json.dumps(report,indent=2)+'\n')
print('SMALL CONSISTENCY VERIFIED',flush=True)
