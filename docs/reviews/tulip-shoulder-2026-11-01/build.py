from pathlib import Path
import json,copy,hashlib
root=Path.cwd();batch=root/'docs/reviews/tulip-shoulder-2026-11-01'
old=json.loads((batch/'before-kits.json').read_text())['rows']; rows=copy.deepcopy(old);changes=[]
for sku,kit in rows.items():
    seat=kit['glassSizing']['landmarkY']
    for p in kit['parts']:
        if p['slot'] not in ['sprayer','overcap']:continue
        # The closed overcap covers the neck band; the exposed sprayer does not.
        bottom=seat+16.3 if p['slot']=='overcap' else seat
        dy=bottom-p['bounds']['bottom']
        p['box']['y']+=dy
        p['bounds']['top']+=dy;p['bounds']['bottom']+=dy
        changes.append({'sku':sku,'slot':p['slot'],'previousBottom':old[sku]['parts'][kit['parts'].index(p)]['bounds']['bottom'],'newBottom':bottom,'deltaY':dy})
    assert kit['anchors']==old[sku]['anchors'] and kit['glassSizing']==old[sku]['glassSizing']
    for slot in ['body']:
        assert [p for p in kit['parts'] if p['slot']==slot]==[p for p in old[sku]['parts'] if p['slot']==slot]
    # Interior floor landmarks are visual registrations to these exact masters,
    # not manufacturer depth measurements. Trim the source without stretching it.
    floor=990.0 if 'Tulip6' in sku else 1017.0
    tip=floor-8.0
    for p in kit['parts']:
        if p['slot']!='diptube':continue
        previous=p['bounds']['bottom']
        p['trimBottomPct']=100*(p['box']['y']+p['box']['height']-tip)/p['box']['height']
        p['bounds']['bottom']=tip
        changes.append({'sku':sku,'slot':'diptube','views':p.get('views'),'previousBottom':previous,'newBottom':tip,'interiorFloorY':floor,'clearanceCanvasPx':8.0,'trimBottomPct':p['trimBottomPct']})
out=root/'public/local-kits/tulip-shoulder-2026-11-01';out.mkdir(parents=True,exist_ok=True)
(out/'kits.json').write_text(json.dumps({'rows':rows,'defaultPdpSkus':[]},indent=2)+'\n')
(batch/'registration.json').write_text(json.dumps({'scope':'15 existing Tulip sprayer previews','changes':changes,'preserved':'All body pixels, body boxes, size targets, anchors, sprayer and overcap dimensions, dip-tube source images, width, upper mechanism, bend and image scale'},indent=2)+'\n')
print('Updated',len(rows),'explicit-preview kits')
