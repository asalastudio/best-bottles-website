"""Shadow audit: per finished hero, the contact shadow's clock direction, reach, depth and feather; flags anything that is not a single soft shadow toward 2–3:30.
usage: shadow_audit.py <scratch> [family ...]  → heroes/shadow-audit.json + list of SKUs to re-render"""
import json,os,sys,glob,math,numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0,os.path.dirname(__file__)); from measure_hero import measure
S=sys.argv[1]; FAMS=set(sys.argv[2:]); BONE=np.array((245,243,239))
def shadow(path):
    im=np.array(Image.open(path).convert("RGB")).astype(float); H,W,_=im.shape; d=(BONE-im).sum(axis=2); m=measure(path); base=m["base"]; cx=m["cx"]
    strong=np.abs(im-BONE).sum(axis=2)>40; lab,n=ndimage.label(ndimage.binary_closing(strong,iterations=5)); t=max(range(1,n+1),key=lambda i:np.ptp(np.where(lab==i)[0])); bottle=ndimage.binary_dilation(ndimage.binary_fill_holes(lab==t),iterations=3)
    others=ndimage.binary_dilation(strong&~bottle,iterations=12)          # loose caps, tassels: exclude their own shadows from the read
    zone=np.zeros((H,W),bool); zone[base-int(0.06*H):min(H,base+int(0.12*H)),max(0,int(cx-0.45*W)):min(W,int(cx+0.45*W))]=True
    sh=(d>4)&(d<60)&~bottle&~others&zone
    if sh.sum()<200: return dict(clock=None,contact=None,floating=True,note="no shadow")
    ys,xs=np.where(sh); w=d[ys,xs]
    # CONTACT: the darkest shadow must touch the base ring under the bottle's footprint (no bone gap → not floating)
    half=m["body_w"]/2; foot=(np.abs(xs-cx)<=half)&(ys>=base-2)&(ys<=base+10); contact=float(w[foot].max()) if foot.any() else 0.0
    below=(np.abs(xs-cx)<=half)&(ys>base+10)&(ys<=base+60); under_deep=float(w[below].mean()) if below.any() else 0.0
    # CAST: the lighter, farther part of the shadow — its centroid direction from the base centre
    far=np.hypot(xs-cx,ys-base)>half*0.9
    if far.any():
        wf=w[far]; sx=(xs[far]*wf).sum()/wf.sum(); sy=(ys[far]*wf).sum()/wf.sum(); ang=(math.degrees(math.atan2(-(sy-base),sx-cx))+360)%360; clock=((90-ang)%360)/30; cast_depth=float(np.percentile(wf,90))
    else: clock=None; cast_depth=0.0
    floating=contact<8 or (under_deep>contact*0.9)          # no contact darkness, or the shadow is a slab hanging below the base
    return dict(clock=None if clock is None else round(clock,1),contact=round(contact),cast_depth=round(cast_depth),floating=bool(floating),reach_px=int(np.percentile(np.hypot(xs-cx,ys-base),95)),depth=int(w.max()),feather=round(float((w>0.2*w.max()).sum()/max(1,(w>0.8*w.max()).sum())),1),area=int(sh.sum()))
rep={}; redo=[]
for jp in sorted(glob.glob(f"{S}/heroes/out/*.png.json")):
    if ".2080." in jp: continue
    rec=json.load(open(jp)); 
    if FAMS and rec["family"] not in FAMS: continue
    r=shadow(f"{S}/heroes/out/{rec['sku']}.png"); ok=(not r.get("floating")) and r["clock"] is not None and 1.3<=r["clock"]<=3.3 and r.get("cast_depth",99)<=45 and r["feather"]>=3
    rep[rec["sku"]]=dict(family=rec["family"],**r,ok=ok); 
    if not ok: redo.append(rec["sku"])
json.dump(rep,open(f"{S}/heroes/shadow-audit.json","w"),indent=1)
print(f"{len(rep)} audited; {sum(1 for v in rep.values() if v['ok'])} conform (dark contact at the base, light feathered cast toward ~2 o'clock, not floating); {len(redo)} to re-render:"); print(" ".join(redo))
