#!/usr/bin/env python3
"""
Prep the real Best Bottles cutouts the cascade + range need:
  - empire_body.png     bare square Empire flacon (top masked at the shoulder)
  - empire_full.png     the full hero (Empire + black antique bulb + tassel)
  - top_XX_name.png      the 9 real closures segmented from 'Assorted Closers'
  - range bottles        clean shapes for the constellation
Beige studio sweep + travertine plinths are gated out by chroma, so only the
real product pixels survive. Deterministic NumPy — no ML, no drift.
"""
import os, numpy as np
from PIL import Image, ImageFilter, ImageChops
from scipy import ndimage

SRC="public/assets"; OUT="creative/best-bottles-scroll-motion/assets/cutouts"
os.makedirs(OUT, exist_ok=True)

def arr(p): return np.asarray(Image.open(os.path.join(SRC,p)).convert("RGB")).astype(np.float32)

def beigeness(rgb):
    """High for warm mid-tone low-chroma studio sweep / travertine."""
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    warm=np.clip((r-b)/60.0,0,1)*np.clip((r-g+18)/40.0,0,1)   # R>=G>=B warm
    mx,mn=rgb.max(-1),rgb.min(-1)
    lum=(0.299*r+0.587*g+0.114*b)
    midbright=np.clip((lum-70)/150.0,0,1)
    lowchroma=np.clip(1-(mx-mn)/70.0,0,1)
    return np.clip(warm*0.6+0.4, 0,1)*midbright*lowchroma

def edges(p):
    g=np.asarray(Image.open(os.path.join(SRC,p)).convert("L").filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    return g/(g.max()+1e-6)

def key(p, k=3.2, eb=1.0):
    rgb=arr(p); h,w,_=rgb.shape
    m=max(6,w//25)
    margin=np.concatenate([rgb[:,:m],rgb[:,-m:]],axis=1)
    bg=np.median(margin,axis=1)
    for c in range(3): bg[:,c]=ndimage.uniform_filter1d(bg[:,c],max(3,h//30))
    bg=bg[:,None,:]
    diff=np.sqrt(((rgb-bg)**2).mean(-1)); d=diff/(diff.max()+1e-6)
    a=np.clip(d*k,0,1)
    a=np.maximum(a,np.clip(edges(p)*2.4*eb,0,1))
    a=a*(1-0.85*beigeness(rgb))            # gate out beige plinths/sweep
    return rgb,a

def cleanup(a, min_frac=0.0004, close=2):
    a=ndimage.grey_closing(a,size=close)
    b=a>0.4
    b=ndimage.binary_fill_holes(b)
    lbl,n=ndimage.label(b)
    if n:
        sizes=ndimage.sum(np.ones_like(lbl),lbl,range(1,n+1))
        thr=b.size*min_frac
        keep=np.isin(lbl,[i+1 for i,s in enumerate(sizes) if s>=thr])
        a=np.where(keep,a,0)
    return a

def save(rgb,a,name,feather=1.0,pad=8):
    a=np.clip(a,0,1)
    ai=Image.fromarray((a*255).astype(np.uint8))
    if feather: ai=ai.filter(ImageFilter.GaussianBlur(feather))
    im=Image.fromarray(rgb.astype(np.uint8)).convert("RGBA"); im.putalpha(ai)
    bb=im.getbbox()
    if bb:
        bb=(max(0,bb[0]-pad),max(0,bb[1]-pad),min(im.width,bb[2]+pad),min(im.height,bb[3]+pad))
        im=im.crop(bb)
    im.save(os.path.join(OUT,name))
    print(f"  -> {name} {im.size}")
    return im

# ---- 1. Empire body + full hero from vintage-spray (square Empire, no label) --
rgb,a=key("vintage-spray.png",k=3.0,eb=1.1)
a=cleanup(a)
full=save(rgb,a,"empire_full.png")            # bottle + bulb + tassel
# bare body: keep only the bottle column (right side), cut above the neck ring.
h,w=a.shape
ab=a.copy()
# the square glass body sits on the right; the black bulb/tassel on the left.
# keep x > 0.52w (bottle side), and clip the collar/atomizer above shoulder.
xx=np.arange(w)[None,:]; yy=np.arange(h)[:,None]
ab=np.where(xx>0.55*w, ab, 0)                  # drop bulb+tassel+hose
# find bottle bbox on the kept mask, then trim the metal collar (top ~14%)
ys,xsr=np.where(ab>0.4)
if len(ys):
    y0,y1=ys.min(),ys.max()
    neck=int(y0+0.135*(y1-y0))                 # below the silver collar
    ab=np.where(yy>=neck, ab, 0)
save(rgb,ab,"empire_body.png",pad=4)

# ---- 2. Segment the 9 real closures from 'Assorted Closers' -------------------
rgb,a=key("Assorted Closers.png",k=3.4,eb=1.0)
a=cleanup(a,min_frac=0.0006,close=2)
# drop the faint ground-shadow band: zero rows whose only content is wide+thin
mask=a>0.45
lbl,n=ndimage.label(mask)
comps=[]
for i in range(1,n+1):
    ys,xs=np.where(lbl==i)
    if len(xs)<200: continue
    wbb=xs.max()-xs.min(); hbb=ys.max()-ys.min()
    if hbb<18: continue                        # skip flat shadow strips
    comps.append((xs.min(),xs.max(),ys.min(),ys.max(),i))
comps.sort(key=lambda c:c[0])                   # left-to-right
names=["rose","copper","red_spray","blue_spray","gold_spray","black_atom",
       "dropper","carbon","white_cap"]
print(f"  closers: {len(comps)} components")
for idx,(x0,x1,y0,y1,ci) in enumerate(comps):
    nm=names[idx] if idx<len(names) else f"top{idx}"
    sub_a=np.where(lbl==ci, a, 0)
    save(rgb,sub_a,f"top_{idx:02d}_{nm}.png",feather=0.8,pad=6)

# ---- 3. Range bottles (constellation) ----------------------------------------
for src,dst,kk in [("hero_bottles.png","range_trio.png",3.0),
                   ("Slim-BB.png","range_slim.png",3.0),
                   ("Cylinder-BB.png","range_rollon.png",3.0),
                   ("CreamJars-BB.png","range_creamjar.png",3.2)]:
    rgb,a=key(src,k=kk,eb=1.0); a=cleanup(a,min_frac=0.001)
    save(rgb,a,dst)
print("done.")
