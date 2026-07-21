#!/usr/bin/env python3
"""
Render the canvas-scrub frame sequences from the REAL Best Bottles cutouts.
  cascade : one pinned Empire body, real tops seat one after another to the
            antique-bulb-and-tassel climax (the lead beat)
  swingin : cold-open camera swing settling on the empty Empire
  range   : the single Empire multiplies into every real shape, then collapses
  macro   : slow glide across the real glass detail
Deterministic. Product pixels are never redrawn — only lit, placed, moved.
"""
import os, json, math, numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageChops

CUT = "creative/best-bottles-scroll-motion/assets/cutouts"
FRAMES = "site/frames"
W, H = 1600, 1000
NAVY = (5, 7, 15)

def load(name): return Image.open(os.path.join(CUT, name)).convert("RGBA")
def meta(name):
    p = os.path.join(CUT, name)
    return json.load(open(p)) if os.path.exists(p) else {}

# ---------- scene backdrop -----------------------------------------------------
def _radial(size, cx, cy, r, inner, outer):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - cx) / r) ** 2 + ((yy - cy) / r) ** 2)
    t = np.clip(d, 0, 1)
    img = np.zeros((h, w, 3), np.float32)
    for c in range(3):
        img[..., c] = inner[c] * (1 - t) + outer[c] * t
    return img

def backdrop(light_x=0.66, glow=1.0):
    base = np.zeros((H, W, 3), np.float32) + np.array(NAVY, np.float32)
    # dramatic top light pooled toward the product side
    g = _radial((W, H), W * light_x, H * 0.16, H * 1.05,
                (32, 40, 62), NAVY)
    base = np.maximum(base, g * glow)
    # faint cool floor sheen
    floor = np.zeros((H, W, 3), np.float32)
    fy = int(H * 0.9)
    for c in range(3):
        col = np.linspace(NAVY[c], (14, 18, 30)[c], H - fy)
        floor[fy:, :, c] = col[:, None]
    base = np.maximum(base, floor)
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    return img

def backlight(img, cx, cy, r, strength=64):
    """A soft platinum halo behind the product (chrome key light)."""
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(glow)
    dd.ellipse([cx - r, cy - r*1.3, cx + r, cy + r*1.3], fill=(150, 168, 205, strength))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img.alpha_composite(glow)
    return img

def place(scene, sprite, cx, base_y, scale, sway=0.0, shadow=True, opacity=1.0):
    """Draw sprite with its BOTTOM-CENTRE at (cx, base_y)."""
    w = max(1, int(sprite.width * scale)); h = max(1, int(sprite.height * scale))
    s = sprite.resize((w, h), Image.LANCZOS)
    if sway:
        s = s.rotate(sway, resample=Image.BICUBIC, expand=True, center=(w//2, 8))
        w, h = s.size
    if opacity < 1:
        al = s.split()[3].point(lambda p: int(p * opacity)); s.putalpha(al)
    x = int(cx - w / 2); y = int(base_y - h)
    if shadow:
        sh = Image.new("RGBA", scene.size, (0, 0, 0, 0))
        ds = ImageDraw.Draw(sh)
        sw = int(w * 0.7)
        ds.ellipse([cx - sw//2, base_y - 8, cx + sw//2, base_y + 14], fill=(0, 0, 0, 120))
        sh = sh.filter(ImageFilter.GaussianBlur(9))
        scene.alpha_composite(sh)
    scene.alpha_composite(s, (x, y))
    return scene

def seat_shadow(scene, cx, y, w):
    sh = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - w//2, y - 6, cx + w//2, y + 10], fill=(0, 0, 0, 150))
    scene.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)))

def save_seq(seq, frames, render_fn):
    d = os.path.join(FRAMES, seq); os.makedirs(d, exist_ok=True)
    for i in range(frames):
        t = i / (frames - 1)
        img = render_fn(t).convert("RGB")
        img.save(os.path.join(d, f"frame_{i+1:04d}.jpg"), quality=82, optimize=True)
    print(f"  {seq}: {frames} frames -> {d}")

# ---------- product geometry ---------------------------------------------------
BODY = load("void_body.png"); BODY_ANCHOR = meta("void_body.anchor.json").get("neck_anchor", [80, 5])
CX = int(W * 0.68)                     # product pinned in the right third
BASE_Y = int(H * 0.90)
BODY_SCALE = (H * 0.60) / BODY.height
BODY_W = BODY.width * BODY_SCALE
NECK = (CX + (BODY_ANCHOR[0] - BODY.width/2) * BODY_SCALE,
        BASE_Y - (BODY.height - BODY_ANCHOR[1]) * BODY_SCALE)

TOPS = [
    ("empty",     None,                    0),
    ("white_cap", "top_08_white_cap.png",  150),
    ("carbon",    "top_07_carbon.png",     150),
    ("dropper",   "top_06_dropper.png",    150),
    ("rose",      "top_00_rose.png",       150),
    ("copper",    "top_01_copper.png",     150),
    ("red_spray", "top_02_red_spray.png",  150),
    ("blue_spray","top_03_blue_spray.png", 150),
    ("gold_spray","top_04_gold_spray.png", 150),
    ("black_atom","top_05_black_atom.png", 150),
    ("antique",   "top_09_antique.png",    300),   # climax, wider target
]
_sprites = {f: load(f) for _, f, _ in TOPS if f}
_antmeta = meta("top_09_antique.dock.json")
ANT_DOCK = _antmeta.get("dock", [543, 90]); ANT_FW = _antmeta.get("ferrule_w", 73)
ANT_SCALE = (BODY_W * 0.44) / ANT_FW              # ferrule matches the collar

def draw_top(scene, name, fname, target_w, opacity=1.0, sway=0.0):
    if not fname: return
    sp = _sprites[fname]
    if name == "antique":
        scale = ANT_SCALE
        s = sp.resize((int(sp.width*scale), int(sp.height*scale)), Image.LANCZOS)
        cx0, cy0 = int(ANT_DOCK[0]*scale), int(ANT_DOCK[1]*scale)
        if sway: s = s.rotate(sway, resample=Image.BICUBIC, expand=True, center=(cx0, cy0))
        if opacity < 1:
            al=s.split()[3].point(lambda p:int(p*opacity)); s.putalpha(al)
        seat_shadow(scene, NECK[0], NECK[1]+4, BODY_W*0.7)
        scene.alpha_composite(s, (int(NECK[0]-cx0), int(NECK[1]-cy0)))
    else:
        scale = target_w / sp.width
        seat_shadow(scene, NECK[0], NECK[1]+4, target_w*0.82)
        place(scene, sp, NECK[0], NECK[1]+int(sp.height*scale*0.20), scale,
              sway=sway, shadow=False, opacity=opacity)

def render_cascade(t):
    scene = backdrop()
    scene = backlight(scene, CX, int(H*0.5), int(BODY_W*1.15), 60)
    # body first (pinned)
    place(scene, BODY, CX, BASE_Y, BODY_SCALE, shadow=True)
    # which state? cross-dissolve between consecutive tops
    n = len(TOPS)
    pos = t * (n - 1)
    i = min(int(pos), n - 2); frac = pos - i
    ease = frac*frac*(3-2*frac)
    for idx, op in ((i, 1-ease), (i+1, ease)):
        name, fname, tw = TOPS[idx]
        if fname and op > 0.01:
            sway = 0.0
            if name == "antique":
                sway = 2.4*math.sin(t*math.pi*6)*ease
            draw_top(scene, name, fname, tw, opacity=op, sway=sway)
    return scene

def _ease(t): return t*t*(3-2*t)

# ---------- SWING-IN : cold open on the empty Empire ---------------------------
def render_swingin(t):
    e = _ease(min(1.0, t/0.92))
    scene = backdrop(glow=0.5 + 0.5*e)
    scene = backlight(scene, CX, int(H*0.5), int(BODY_W*1.15), int(20+44*e))
    scale = BODY_SCALE * (1.16 - 0.16*e)
    rot = (1-e) * 6.5
    dx = int((1-e) * -70); dy = int((1-e) * -26)
    sp = BODY
    w = max(1,int(sp.width*scale)); h = max(1,int(sp.height*scale))
    s = sp.resize((w,h), Image.LANCZOS)
    if rot: s = s.rotate(rot, resample=Image.BICUBIC, expand=True)
    # settle: fade product up, lift vignette
    op = 0.15 + 0.85*_ease(min(1.0,t/0.5))
    al = s.split()[3].point(lambda p:int(p*op)); s.putalpha(al)
    x = int(CX + dx - s.width/2); y = int(BASE_Y + dy - s.height)
    # contact shadow grows in
    seat = Image.new("RGBA", scene.size,(0,0,0,0))
    ImageDraw.Draw(seat).ellipse([CX-BODY_W*0.6, BASE_Y-10, CX+BODY_W*0.6, BASE_Y+22], fill=(0,0,0,int(150*e)))
    scene.alpha_composite(seat.filter(ImageFilter.GaussianBlur(14)))
    scene.alpha_composite(s,(x,y))
    # cinematic vignette lifting away
    if e < 1:
        vig = Image.new("RGBA", scene.size,(0,0,0,0))
        dv=ImageDraw.Draw(vig)
        m=int(220*(1-e))
        dv.rectangle([0,0,W,H], outline=None, fill=(2,3,8,0))
        for i in range(60):
            a=int(m*(1-i/60))
            dv.rectangle([i*6,i*4,W-i*6,H-i*4], outline=(2,3,8,a))
        scene.alpha_composite(vig)
    return scene

# ---------- RANGE : one form multiplies into the constellation, collapses ------
_RANGE_FORMS = ["void_body.png","range_slim.png","range_slim.png",
                "top_00_rose.png","top_01_copper.png","top_02_red_spray.png",
                "top_03_blue_spray.png","top_04_gold_spray.png","top_05_black_atom.png",
                "top_06_dropper.png","top_07_carbon.png","top_08_white_cap.png",
                "void_body.png","range_slim.png"]
_range_sprites = [load(f) for f in _RANGE_FORMS]
# deterministic scatter targets (no RNG): golden-angle spiral across the frame
def _targets(n):
    out=[]; ga=2.399963
    for i in range(n):
        ang=i*ga; rad=0.10+0.42*(i/n)
        x=0.46 + rad*math.cos(ang)*1.15
        y=0.50 + rad*math.sin(ang)*0.82
        sc=0.42+0.5*((i*37)%100)/100.0
        out.append((x,y,sc))
    return out
_RTARGETS=_targets(len(_range_sprites))

def render_range(t):
    scene = backdrop(light_x=0.5, glow=0.85)
    scene = backlight(scene, int(W*0.5), int(H*0.5), int(W*0.5), 40)
    spread = math.sin(min(1.0,max(0.0,t))*math.pi)          # 0 at ends, 1 mid
    spread = _ease(spread)
    center=(CX, int(H*0.52)); cscale=BODY_SCALE
    order=sorted(range(len(_range_sprites)), key=lambda i:_RTARGETS[i][2])
    for i in order:
        sp=_range_sprites[i]; tx,ty,tsc=_RTARGETS[i]
        gx = center[0]*(1-spread) + (W*tx)*spread
        gy = center[1]*(1-spread) + (H*ty)*spread
        base_scale = (H*0.34)/sp.height if sp.height>260 else (H*0.12)/sp.height
        sc = cscale*(1-spread) + base_scale*tsc*spread if i==0 else base_scale*tsc*spread
        if i!=0 and spread<0.02: continue
        op = 1.0 if i==0 else _ease(min(1.0,spread*1.4))
        w=max(1,int(sp.width*sc)); h=max(1,int(sp.height*sc))
        s=sp.resize((w,h),Image.LANCZOS)
        if op<1:
            al=s.split()[3].point(lambda p:int(p*op)); s.putalpha(al)
        scene.alpha_composite(s,(int(gx-w/2),int(gy-h/2)))
    return scene

# ---------- MACRO : slow glide across the real glass ---------------------------
_MACRO = load("void_hero.png")
def render_macro(t):
    scene = backdrop(light_x=0.5, glow=0.7)
    scene = backlight(scene, int(W*0.5), int(H*0.45), int(W*0.4), 46)
    e=t
    big = _MACRO
    scale = (H*1.9)/big.height * (1.0 + 0.12*e)             # zoomed in
    w=int(big.width*scale); h=int(big.height*scale)
    s=big.resize((w,h),Image.LANCZOS)
    # pan diagonally across the glass detail
    x = int(lerp(W*0.15, -w+W*0.95, e))
    y = int(lerp(-h*0.06, -h*0.30, e))
    scene.alpha_composite(s,(x,y))
    return scene

def lerp(a,b,t): return a+(b-a)*t

if __name__ == "__main__":
    import sys
    if "--all" in sys.argv:
        save_seq("swingin", 72, render_swingin)
        save_seq("cascade", 132, render_cascade)
        save_seq("range",   96, render_range)
        save_seq("macro",   72, render_macro)
        print("ALL SEQUENCES DONE")
    elif "--preview" in sys.argv:
        os.makedirs("/tmp/claude-0/-home-user-best-bottles-website/1dbfd9ca-9557-5228-abec-9cca62f6e5d3/scratchpad", exist_ok=True)
        ts = [0.0, 0.22, 0.5, 0.72, 0.9, 1.0]
        sheet = Image.new("RGB", (3*533, 2*333), NAVY)
        for k, t in enumerate(ts):
            im = render_cascade(t).convert("RGB").resize((533, 333))
            sheet.paste(im, ((k%3)*533, (k//3)*333))
        sheet.save("/tmp/claude-0/-home-user-best-bottles-website/1dbfd9ca-9557-5228-abec-9cca62f6e5d3/scratchpad/cascade_preview.png")
        print("preview saved; NECK", NECK, "BODY_W", round(BODY_W))
