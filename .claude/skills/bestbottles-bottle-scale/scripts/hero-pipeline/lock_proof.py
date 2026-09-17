"""Proof sheets for the lock restoration.
lock-vs-pr.jpg     : 9 bodies x 3 rows (LOCKED 09-07 file on main | PR now | RESTORED), one zoom, the
                     locked shoulder line drawn through every cell.
lock-lines.jpg     : all 39 restored renders with their group's locked shoulder line.
"""
import json, os, numpy as np
from PIL import Image, ImageDraw, ImageFont
from hero_paths import WORK as S
from hero_paths import REPO
BONE=(245,243,239); INK=(26,28,27); MUTED=(120,126,122); RED=(196,58,38); BLUE=(26,111,176)
FP="/System/Library/Fonts/Helvetica.ttc"; CW,CH,BASE=1560,1716,1562
font=lambda sz,b=False: ImageFont.truetype(FP,sz,index=1 if b else 0)
lock={r["sku"]:r for r in json.load(open(f"{REPO}/docs/reviews/cylinder-family-final-manifest-2026-09-07.json"))["rows"]}
lr=json.load(open(f"{S}/lock-restore.json"))

def cols_of(img):
    a=np.asarray(img.convert("RGB")).astype(int)
    m=np.abs(a-np.array(BONE)).max(axis=2)>40; m[BASE-6:,:]=False
    c=np.where(m.sum(axis=0)>6)[0]
    return (int(c.min()),int(c.max())) if len(c) else (0,CW-1)

def cell(path, target_y, scale, pad=70, line=True, label=None):
    im=Image.open(path).convert("RGB")
    x0,x1=cols_of(im); x0=max(0,x0-pad); x1=min(CW-1,x1+pad)
    crop=im.crop((x0,0,x1+1,CH)).resize((round((x1-x0+1)*scale),round(CH*scale)),Image.LANCZOS)
    d=ImageDraw.Draw(crop)
    if line:
        y=round(target_y*scale); d.line([(0,y),(crop.width,y)],fill=RED,width=3)
        if label: d.text((4,y-22),label,font=font(17,True),fill=RED)
    return crop

def sheet_lock_vs_pr():
    skus=["GBSpry3mlClBlk","GBSpry4mlClBlk","GBCyl5SprySlMatt","GBCyl9MtlRollBlkDot","GBCylFrst9SpryMattSl",
          "GBMtlRoll28Blk","GBTallCyl9SpryGlMatt","GBCyl50SpryMtGl","GBCyl100SpryMtGl"]
    rows=[("LOCKED 2026-09-07  -  the file on main today (Photoshop composite), the size Jordan approved", f"{S}/locked-main"),
          ("PR #179 NOW  -  photoreal render sized by the curve", f"{S}/cyl-sized-shoulder"),
          ("RESTORED  -  same render, glass shoulder put back on the locked line", f"{S}/cyl-locked")]
    SC=0.30; GAP=14; PAD=60; HEAD=150; ROWH=round(CH*SC); LABH=70
    cells=[[cell(f"{d}/{s}.png", BASE-lr[s]["shoulderPx"], SC, label=f'{lr[s]["targetPct"]:g}%' if i==0 else None) for s in skus] for i,(t,d) in enumerate(rows)]
    W=PAD*2+max(sum(max(c.width,150) for c in rc)+GAP*(len(skus)-1) for rc in cells)
    H=HEAD+len(rows)*(ROWH+LABH)+PAD
    out=Image.new("RGB",(W,H),BONE); d=ImageDraw.Draw(out)
    d.text((PAD,40),"Cylinder heroes: the locked plan vs the PR vs the restore",font=font(44,True),fill=INK)
    d.text((PAD,98),"Red line = the glass-shoulder height locked per body on 2026-09-07 (cylinder-family-final-manifest). One zoom for every cell; foot on the 91% baseline.",font=font(22),fill=MUTED)
    y=HEAD
    for (title,_),rowcells in zip(rows,cells):
        d.text((PAD,y-2),title,font=font(24,True),fill=INK if "RESTORED" not in title else BLUE); y+=34
        x=PAD
        for s,c in zip(skus,rowcells):
            w=max(c.width,150); out.paste(c,(x+(w-c.width)//2,y))
            cap=f'{lock[s]["capacityMl"]:g} ml'+(" tall" if "Tall" in s else "")+(" frosted" if "Frst" in s else "")
            d.text((x+w/2-d.textlength(cap,font=font(20,True))/2,y+ROWH+4),cap,font=font(20,True),fill=INK)
            d.text((x+w/2-d.textlength(s,font=font(14))/2,y+ROWH+28),s,font=font(14),fill=MUTED)
            x+=w+GAP
        y+=ROWH+LABH-34
    out.save(f"{S}/lock-vs-pr.jpg",quality=92); print("lock-vs-pr.jpg",out.size)

def sheet_lines():
    skus=sorted(lr,key=lambda s:(lr[s]["glassMm"],lr[s]["group"],s))
    SC=0.22; GAP=10; PAD=50; HEAD=120; ROWH=round(CH*SC); LABH=62; per=13
    rows=[skus[i:i+per] for i in range(0,len(skus),per)]
    cells=[[cell(f"{S}/cyl-locked/{s}.png", BASE-lr[s]["shoulderPx"], SC) for s in r] for r in rows]
    W=PAD*2+max(sum(max(c.width,110) for c in rc)+GAP*(len(rc)-1) for rc in cells)
    H=HEAD+len(rows)*(ROWH+LABH)+PAD
    out=Image.new("RGB",(W,H),BONE); d=ImageDraw.Draw(out)
    d.text((PAD,36),f"All {len(lr)} renders on their locked shoulder lines",font=font(40,True),fill=INK)
    d.text((PAD,88),"Each red line sits at the height the 2026-09-07 lock assigns to that body's glass shoulder. Every SKU of a body shares one line.",font=font(20),fill=MUTED)
    y=HEAD
    for r,rc in zip(rows,cells):
        x=PAD
        for s,c in zip(r,rc):
            w=max(c.width,110); out.paste(c,(x+(w-c.width)//2,y))
            t1=f'{lr[s]["group"].replace("-standard","")} ml  {lr[s]["targetPct"]:g}%'
            d.text((x+w/2-d.textlength(t1,font=font(16,True))/2,y+ROWH+4),t1,font=font(16,True),fill=INK)
            d.text((x+w/2-d.textlength(s,font=font(12))/2,y+ROWH+26),s,font=font(12),fill=MUTED)
            x+=w+GAP
        y+=ROWH+LABH
    out.save(f"{S}/lock-lines.jpg",quality=90); print("lock-lines.jpg",out.size)

sheet_lock_vs_pr(); sheet_lines()
