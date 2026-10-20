from pathlib import Path
p=Path('/private/tmp/bb-empire-alpha-evidence/capture_pilot.py')
s=p.read_text().replace('from pathlib import Path','from pathlib import Path\nfrom urllib.parse import urlparse,parse_qs')
s=s.replace("async def main():",'''async def image_transport(route):
 url=route.request.url
 source=parse_qs(urlparse(url).query).get('url',[''])[0]
 if source.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):
  response=await route.fetch(url=source)
  await route.fulfill(response=response)
 else: await route.continue_()
async def main():''')
s=s.replace("b=await p.chromium.launch()","b=await p.chromium.launch()\n  # Capture-only transport workaround for local Next optimizer DNS64 rejection.\n  # Serve exact source bytes for remote hardware, leaving app code untouched.")
s=s.replace("for size in [50,100]:", "for size in [50,100]:")
s=s.replace("page=await ctx.new_page();", "page=await ctx.new_page();await page.route('**/_next/image?**',image_transport);")
s=s.replace('i=>i.complete)', 'i=>i.complete && i.naturalWidth>0)')
s=s.replace("row['images']=await page.get_by_role('dialog')", "row['captureTransport']='remote hardware optimizer requests served from their exact original source URLs';row['images']=await page.get_by_role('dialog')")
s=s.replace("row['status']=res.status", "row['status']=res.status;row['captureTransport']='remote hardware optimizer requests served from their exact original source URLs'")
s=s.replace("await ready(page,'dialog[open]')", "await ready(page,'dialog[open]')\n    await page.get_by_role('dialog').locator('image').evaluate_all('async xs => Promise.all(xs.map(async i => {const p=new Image();p.src=i.getAttribute(\"href\");await p.decode();}))')")
Path('/private/tmp/bb-empire-alpha-evidence/capture_final.py').write_text(s)
