from pathlib import Path
import json,asyncio,shutil
from playwright.async_api import async_playwright
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/round78-lotion-completion');T=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot/round78-lotion-complete');U='http://127.0.0.1:3008/round78-lotion-complete/'
shutil.copytree(O/'legacy',T/'legacy',dirs_exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1200,'height':940})
  for finish in ['ShnSl','MtSl','ShnGl','MtGl','ShnBlk','Cu','ClOvrCap']:
   html='<style>body{margin:0;background:#f5f3ef;font:13px Arial;color:#294333}main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}p{margin:10px}img{width:100%;height:405px;object-fit:contain}</style><main>'
   for glass in ['','Frst']:
    sku=f'LBRnd{glass}78Ltn{finish}'
    for label,url in [('Native PSD',f'source/{sku}.png'),('Current legacy',f'legacy/{sku}-enlarged_pics.gif'),('Local catalog',f'after/{sku}-catalog.png')]:html+=f'<figure><p>{label} · {sku}</p><img src="{U}{url}"></figure>'
   await page.set_content(html+'</main>');await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))');await page.screenshot(path=str(T/f'source-contact-{finish}.png'))
  await b.close();print('Seven source / legacy / local comparison sheets saved')
asyncio.run(main())
