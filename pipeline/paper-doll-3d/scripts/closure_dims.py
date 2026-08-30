import re, html, sys, urllib.request
UA={"User-Agent":"Mozilla/5.0 (compatible; BestBottles-dims/1.0)"}
def dims(slug):
    url=f"https://www.bestbottles.com/product/{slug}"
    try:
        req=urllib.request.Request(url, headers=UA)
        s=urllib.request.urlopen(req, timeout=30).read().decode("utf-8","replace")
    except Exception as e:
        return {"slug":slug,"error":str(e)[:60]}
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S|re.I)
    t=re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',t)))
    out={"slug":slug}
    m=re.search(r'Item Name:\s*(\S+)', t)
    if m: out["sku"]=m.group(1)
    for key,lab in (("Item Height with Cap","h"),("Item Height without Cap","h_bare"),
                    ("Item Diameter","d"),("Item Width","w"),("Neck Thread Size","neck")):
        mm=re.search(key+r'\s*:?\s*([0-9]+(?:\.[0-9]+)?)', t)
        if mm: out[lab]=float(mm.group(1))
    return out
if __name__=="__main__":
    for slug in sys.argv[1:]:
        d=dims(slug)
        print("  " + "  ".join(f"{k}={v}" for k,v in d.items()))
