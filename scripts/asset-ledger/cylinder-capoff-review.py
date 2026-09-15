#!/usr/bin/env python3
"""Build a single same-zoom review sheet from the immutable Cylinder packet."""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ID = 'cylinder-capoff-final-2026-09-12'
REVIEW = ROOT / 'docs/reviews' / ID
DEST = ROOT / 'public/reviews' / ID
esc = lambda value: html.escape(str(value if value is not None else 'Unknown'))


def main():
    packet = (REVIEW / 'prepared.json').read_bytes()
    data = json.loads(packet)
    digest = hashlib.sha256(packet).hexdigest()
    approval_file = ROOT / 'data/asset-ledger/cylinder-capoff-final-decisions.json'
    approval = json.loads(approval_file.read_text()) if approval_file.exists() else None
    technical_file = REVIEW / 'technical-review.json'
    technical = json.loads(technical_file.read_text()) if technical_file.exists() else None
    release_file = REVIEW / 'ship-completion.json'
    release = json.loads(release_file.read_text()) if release_file.exists() else None
    for record in [approval, technical, release]:
        if record and record['reviewPacketSha256'] != digest:
            raise ValueError('Decision or technical review is stale')
    shipped = bool(release and release.get('status') == 'verified')
    shipped_skus = set(release['skus']) if shipped else set()
    decisions = {r['sku']: r for r in approval['entries']} if approval else {}
    checks = {r['sku']: r for r in technical['rows']} if technical else {}
    all_approved = bool(approval) and all(decisions.get(r['sku'], {}).get('status') == 'approved' and decisions[r['sku']]['binding'] == r['binding'] for r in data['rows'])
    cards = []
    for i, row in enumerate(data['rows'], 1):
        check = checks.get(row['sku'], {})
        holds = check.get('holds', row['holds'])
        corrections = {v['sha256']: v for v in check.get('viewCorrections', [])}
        figures = []
        views = [(row['before'][0], 'Approved cap on · unchanged', 'approved')]
        if row['proposed']:
            views += [(v, 'New master cap on' if v['role'] == 'on' else 'New paired cap off', 'pending') for v in row['proposed']]
        else:
            views += [(v, 'Existing cap off · unchanged', 'retained') for v in row['before'][1:]]
        for view, label, state in views:
            file = ROOT / 'public' / view['url'].lstrip('/')
            if hashlib.sha256(file.read_bytes()).hexdigest() != view['sha256']:
                raise ValueError('Review image bytes changed')
            if view['sha256'] in corrections:
                label = 'Capped source sample · held'
                state = 'retained'
            elif state == 'pending' and all_approved:
                if view['sha256'] not in {v['sha256'] for v in decisions[row['sku']]['views']}:
                    raise ValueError('View approval no longer matches')
                label = label.replace('New ', 'Approved ')
                state = 'approved'
            figures.append(f'''<figure><figcaption class="{state}">{esc(label)}</figcaption>
              <a href="{esc(view['url'])}" target="_blank" aria-label="Open full-size {esc(label)}"><img src="{esc(view['url'])}" width="1000" height="1100" loading="lazy" alt="{esc(row['sku'])} {esc(label)}"></a>
              <details><summary>Image fingerprint</summary><code>{view['sha256']}</code></details></figure>''')
        status = 'Needs technical follow-up' if holds else 'New images ready for review'
        if all_approved:
            status = 'Appearance approved · technical hold' if holds else 'Approved · staged for release'
        if row['sku'] in shipped_skus:
            status = 'Approved · published and indexed'
        if not row['proposed']:
            status = 'Existing pair retained · sizing follow-up'
        flags = ''.join(f'<li>{esc(h)}</li>' for h in holds)
        metrics = [v['checks']['registrationErrors'] for v in row['proposed']]
        max_width = max((m['width'] for m in metrics), default=0)
        max_base = max((m['baseY'] for m in metrics), default=0)
        metrics_text = f'Same 1000 × 1100 canvas. Body-width difference: {max_width:g} px. Glass-bottom difference: {max_base:g} px.'
        if corrections:
            metrics_text = 'This source is still capped. It is excluded from the cap-off release.'
        elif not row['proposed']:
            metrics_text = 'Existing image bytes retained. Pair alignment and the historical sizing finding remain open.'
        cards.append(f'''<article class="card" data-state="{'held' if holds else 'ready'}" data-search="{esc(' '.join(str(row.get(k) or '') for k in ['sku','capacityMl','color','capColor','applicator']))}">
          <div class="eyebrow">{i:02d} / {len(data['rows'])} <span class="pill {'hold' if holds else 'review'}">{esc(status)}</span></div>
          <h2>{esc(row['capacityMl'])} mL · {esc(row['color'])} · {esc(row['capColor'])}</h2>
          <p>{esc(row['applicator'] or 'Cap / closure')} <span class="sku">{esc(row['sku'])}</span></p>
          <div class="figures" style="--columns:{len(figures)}">{''.join(figures)}</div>
          <div class="metrics">{esc(metrics_text)}</div>
          {f'<ul class="flags">{flags}</ul>' if flags else ''}
          <details><summary>Product and review record</summary><p>{esc(row['itemName'])}</p><p>Review binding</p><code>{row['binding']}</code></details>
        </article>''')
    remaining = ''.join(f'''<tr><td>{esc(r['sku'])}</td><td>{esc(r['capacityMl'])} mL · {esc(r['color'])}</td><td>{esc(r['applicator'] or 'Cap / closure')}</td><td>{'Inspect original capped layers for photographed exposed parts' if r['sourceStatus']=='capped-layer-inspection' else 'Exact master source matching remains open'}</td></tr>''' for r in data['remaining'])
    s = data['summary']
    title = 'Your batch approval is saved.' if all_approved else 'Recovered pairs, ready to compare.'
    intro = 'The exact images you reviewed are approved. Twenty-five complete pairs are staged for release. Appearance approvals stay saved for the held rows while their source and sizing checks are resolved.' if all_approved else 'Your original source approval is saved. These plates use that artwork at the size and position of each approved cap-on image. The green-labeled cap-on images are unchanged; blue labels identify new image files.'
    note = 'No repeat review is needed for these unchanged images. Publication still awaits the release-specific ship instruction. The ledger remains at 373 of 436 complete until new plates are indexed.' if all_approved else 'Review the changed images together. Existing approvals stay saved. A batch sign-off can cover the new files shown here; flagged technical work stays separate. This is a local review, and nothing in this batch has been published.'
    stats = [(31, 'Reviewed configurations approved', 'green'), (25, 'Pairs staged for release', 'green'), (6, 'Reviewed rows with technical holds', 'amber'), (32, 'Other source rows still open', 'amber')] if all_approved else [('373 / 436', 'Plates already complete', 'green'), (s['newCapOff'], 'New cap-off plates', 'blue'), (s['newMasterCapOn'], 'Master cap-on replacements', 'blue'), (s['remainingSourceRows'], 'Other source rows still open', 'amber')]
    if shipped:
        title = 'Your 25 approved pairs are published.'
        intro = 'The exact images you approved are now indexed in the development catalog and available on the local product pages. Your image approvals are registered. Original masters and the earlier approvals remain saved.'
        count = release['countsAfter']['family']
        note = f"Cylinder now has {count['complete']} of {count['total']} plates complete. The remaining {count['reconcile']} rows stay on explicit holds. Kits and heroes remain paused. This release updated the development catalog; it was not a production website deployment."
        stats = [(f"{count['complete']} / {count['total']}", 'Cylinder plates complete', 'green'), (len(shipped_skus), 'Pairs published in this release', 'green'), (6, 'Reviewed rows with technical holds', 'amber'), (32, 'Other source rows still open', 'amber')]
    ready_label = 'Published in this release' if shipped else 'Staged for release' if all_approved else 'Ready for image review'
    stats_html = ''.join(f'<div class="stat {color}"><strong>{value}</strong><span>{label}</span></div>' for value, label, color in stats)
    text = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cylinder · paired plate review</title>
    <style>
    :root{{--ink:#243b30;--muted:#627368;--line:#d8dfd6;--paper:#f6f5f1}}*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}}main{{max-width:1320px;margin:auto;padding:40px 28px 100px}}h1,h2{{font-family:Georgia,serif;font-weight:400;line-height:1.15}}h1{{font-size:clamp(36px,5vw,58px);margin:12px 0 18px}}h2{{font-size:32px;margin:12px 0}}p{{margin:12px 0}}a{{color:inherit}}header>p{{max-width:900px}}.eyebrow{{text-transform:uppercase;letter-spacing:.09em;font-size:12px;font-weight:700}}.stats{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:26px 0}}.stat{{padding:20px;background:white;border:1px solid var(--line);border-radius:12px}}.stat strong{{display:block;font-size:32px;line-height:1.2}}.stat span{{font-size:14px}}.green{{border-left:5px solid #3c835b}}.blue{{border-left:5px solid #40799c}}.amber{{border-left:5px solid #be8525}}.toolbar{{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--paper);position:sticky;top:0;padding:16px 0;z-index:2;border-bottom:1px solid var(--line)}}input,select{{font:inherit;padding:10px 12px;border:1px solid #97a89a;border-radius:6px;background:white;color:var(--ink)}}input{{min-width:250px;flex:1}}.card{{background:white;padding:28px;border:1px solid var(--line);border-radius:14px;margin:24px 0 40px;scroll-margin-top:90px}}.pill{{display:inline-block;margin-left:10px;border-radius:20px;padding:4px 12px;font-size:11px;letter-spacing:.03em}}.hold{{background:#fff1d5;color:#73500c}}.review{{background:#e6eff7;color:#244d72}}.sku{{display:inline-block;margin-left:12px;color:var(--muted);font-size:14px}}.figures{{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:16px;margin:24px 0}}figure{{margin:0;min-width:0}}figure img{{display:block;width:100%;height:auto;aspect-ratio:10/11;object-fit:contain;background:#fff}}figcaption{{padding:8px 4px;text-align:center;font-size:14px;font-weight:650;border-bottom:2px solid var(--line)}}figcaption.approved{{color:#2e6741;border-color:#70a07f}}figcaption.pending{{color:#244d72;border-color:#799fbe}}figcaption.retained{{color:#627368}}details{{font-size:13px;color:var(--muted);margin-top:12px}}summary{{cursor:pointer}}code{{display:block;overflow-wrap:anywhere;font-size:11px}}.metrics{{padding:12px 16px;background:#f4f6f2;border-radius:6px;font-size:14px}}.flags{{background:#fff6e4;padding:16px 16px 16px 36px;border-radius:6px}}.note{{background:#eef3ee;border-left:4px solid #638472;padding:18px 22px;border-radius:6px}}.table-wrap{{overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{padding:12px;text-align:left;border-bottom:1px solid var(--line)}}#remaining{{padding:24px;background:#fff;border:1px solid var(--line);border-radius:12px}}[hidden]{{display:none!important}}footer{{margin-top:40px;color:var(--muted);font-size:13px}}@media(max-width:680px){{main{{padding:24px 12px 60px}}.stats{{grid-template-columns:repeat(2,1fr)}}.stat{{padding:14px}}.card{{padding:16px}}h2{{font-size:27px}}.figures{{gap:8px}}figcaption{{font-size:11px;min-height:50px}}.pill{{margin:8px 0 0;display:table}}.sku{{display:block;margin:4px 0}}.toolbar{{position:static}}}}
    </style><main><header><div class="eyebrow">Cylinder · original Photoshop plates</div><h1>{title}</h1>
    <p>{intro}</p>
    <div class="stats">{stats_html}</div>
    <p class="note">{note}</p>
    <p>{s['retainedExistingPairs']} existing pair is retained. All images use the same canvas and zoom within each comparison. Select an image to open its full-size file.</p>
    <p><a href="/team/asset-ledger?preview=1&amp;view=plates&amp;family=Cylinder">Cylinder ledger</a> · <a href="#remaining">Other source work</a> · <a href="prepared.json">Exact batch record</a></p></header>
    <div class="toolbar"><label for="search">Find a bottle</label><input id="search" type="search" placeholder="Size, glass color, finish or SKU"><label for="filter">Show</label><select id="filter"><option value="all">All reviewed configurations</option><option value="ready">{ready_label}</option><option value="held">Technical follow-up</option></select><span id="count" aria-live="polite">{len(cards)} configurations</span></div>
    <section id="cards">{''.join(cards)}</section>
    <section id="remaining"><h2>Other source work · {len(data['remaining'])} rows</h2><p>These rows were not part of the recovered source gallery. Their approved cap-on images stay in place. Source matching and original-layer checks remain open; no component is being invented.</p><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Glass</th><th>Assembly</th><th>Next action</th></tr></thead><tbody>{remaining}</tbody></table></div></section>
    <footer>Review {ID} · prepared {esc(data['createdAt'])}<br>Exact batch fingerprint: <code>{digest}</code></footer>
    </main><script>const search=document.querySelector('#search'),filter=document.querySelector('#filter'),cards=[...document.querySelectorAll('.card')];function update(){{let shown=0;for(const card of cards){{const match=card.dataset.search.toLowerCase().includes(search.value.trim().toLowerCase())&&(filter.value==='all'||filter.value===card.dataset.state);card.hidden=!match;if(match)shown++;}}document.querySelector('#count').textContent=shown+' configurations';}}search.addEventListener('input',update);filter.addEventListener('change',update);</script></html>'''
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / 'prepared.json').write_bytes(packet)
    (DEST / 'index.html').write_text(text)
    (REVIEW / 'index.html').write_text(text)
    print('/reviews/' + ID + '/index.html')
    print('Batch SHA-256:', digest)


if __name__ == '__main__':
    main()
