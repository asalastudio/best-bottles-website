"""cyl-bone -> cyl-ship: corner-anchored touch-up, grain clean, edge feather. Deterministic, no AI."""
import sys, numpy as np
from PIL import Image
BONE=np.array((245.0,243.0,239.0)); K=60; FEATHER=48
def ship(src,dst):
    a=np.asarray(Image.open(src).convert("RGB")).astype(np.float64); H,W,_=a.shape
    c=[a[:K,:K].reshape(-1,3).mean(0),a[:K,-K:].reshape(-1,3).mean(0),a[-K:,:K].reshape(-1,3).mean(0),a[-K:,-K:].reshape(-1,3).mean(0)]
    yy,xx=np.mgrid[0:H,0:W]; u=xx/(W-1); v=yy/(H-1)
    surf=((1-u)*(1-v))[...,None]*c[0]+(u*(1-v))[...,None]*c[1]+((1-u)*v)[...,None]*c[2]+(u*v)[...,None]*c[3]
    a=a-surf+BONE                                             # corners land on bone, product/shadow keep their offset
    d=np.abs(a-BONE).max(axis=2)
    w=np.clip((d-4)/4,0,1)[...,None]                          # <=4 levels off bone -> bone; 4..8 fade; >8 untouched
    a=a*w+BONE*(1-w)
    e=np.minimum(np.minimum(yy,H-1-yy),np.minimum(xx,W-1-xx)).astype(np.float64)
    f=np.clip(e/FEATHER,0,1)[...,None]; a=a*f+BONE*(1-f)
    out=np.round(np.clip(a,0,255)).astype(np.uint8); Image.fromarray(out).save(dst)
    corners=max(np.abs(out[:K,:K].reshape(-1,3).mean(0)-BONE).max(),np.abs(out[-K:,-K:].reshape(-1,3).mean(0)-BONE).max())
    return corners
if __name__=="__main__":
    for sku in sys.argv[1:]:
        print(sku,"corners off",round(float(ship(f"cyl-bone/{sku}.png",f"cyl-ship/{sku}.png")),2))
