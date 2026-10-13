#!/usr/bin/env python3
"""Join saved read-only media evidence. Never mutates a catalogue or approval.

python3 scripts/reconcile-product-media-audit.py --evidence DIR --historical DIR --prior DIR --out DIR
An HTTP pass is deliberately distinct from product identity or visual acceptance.
"""
import argparse
import csv
import hashlib
import html
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text())


def csv_rows(path):
    with Path(path).open(newline='') as f:
        return list(csv.DictReader(f))


def dump(path, data):
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def table_csv(path, rows):
    if not rows:
        Path(path).write_text('')
        return
    with Path(path).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v for k, v in row.items()} for row in rows)


def classify(p):
    sku = p.get('websiteSku') or ''
    if '__RETIRED__' in sku or 'discontinued' in (p.get('stockStatus') or '').lower():
        return 'retired'
    if sku.startswith('REF-'):
        return 'reference_component'
    if sku == 'HMAC-TEST-ONLY':
        return 'test_record'
    if not sku:
        return 'identity_decision_required'
    if p.get('shopifySellable') is False:
        return 'not_sellable_scope_review'
    return 'catalogue_candidate'


def main():
    parser = argparse.ArgumentParser()
    for name in ['evidence', 'historical', 'prior', 'out']:
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    e, old, prior, out = args.evidence, args.historical, args.prior, args.out
    out.mkdir(parents=True, exist_ok=True)
    products = read(e / 'precise-raccoon-123-products.json')
    production = read(e / 'production/audit.json')
    development = read(e / 'development/audit.json')
    stages = read(e / 'precise-raccoon-123-register-stage.json')
    builder = read(e / 'builder-served.json')
    served = builder['served']
    if builder['errors']:
        raise ValueError('Builder census has errors; do not treat a partial result as complete')
    # The gap auditor labels rows with the business `productId` when present; export
    # pages always retain Convex `_id`. Join both exact IDs, never a guessed SKU.
    product_ids = {}
    for p in products:
        for key in [p['_id'], p.get('productId')]:
            if key:
                if key in product_ids and product_ids[key]['_id'] != p['_id']:
                    raise ValueError('Ambiguous product identity: ' + key)
                product_ids[key] = p
    media = {product_ids[r['productId']]['_id']: r for r in production['rows']}
    historical = {r['recordId']: r for r in read(old / 'per-sku-media-kit-recovery.json')}
    by_sku = {}
    for p in products:
        by_sku.setdefault(p.get('websiteSku'), []).append(p)
    issues = []

    def add(id, title, kind, skus, surfaces, evidence, repair, acceptance, certainty='review_required', implementation='not_started', linear=None, reproduction=None, record_ids=None):
        skus = sorted(set(s for s in skus if s))
        configs = [s for s in skus if s in served]
        ids = sorted(set(record_ids or [p['_id'] for s in skus for p in by_sku.get(s, [])]))
        issues.append(dict(id=id, title=title, kind=kind, certainty=certainty, websiteSkus=skus,
                           recordIds=ids, affectedSkuCount=len(skus), configurationIds=configs,
                           affectedConfigurationCount=len(configs), surfaces=surfaces,
                           reproduction=reproduction or 'Open each linked exact SKU and exercise the specified surface; record actual resolved image and selected product identity.',
                           evidence=evidence, proposedRepair=repair, acceptanceCriteria=acceptance,
                           linear=linear or [], implementation=implementation, browserVerification='pending',
                           visualApproval='pending', prCi='not_submitted' if implementation == 'built_locally' else 'not_verified',
                           merged='not_merged' if implementation == 'built_locally' else 'not_verified',
                           assetsPublished='not_verified', referencesLoaded='not_verified', deployed='not_verified', verifiedLive=False))

    missing = [r for r in production['rows'] if r['status'] == 'no_verified_source']
    minaret_file = e / 'elegant-minaret-diagnosis.json'
    minaret_diagnoses = {r['websiteSku']: r for r in read(minaret_file)['rows']} if minaret_file.exists() else {}
    for r in missing:
        p = product_ids[r['productId']]
        scope = classify(p)
        short = hashlib.sha256(r['productId'].encode()).hexdigest()[:10]
        add('BBM-IMAGE-' + short, 'No verified assigned image: ' + (r['websiteSku'] or r['graceSku'] or r['productId']),
            'image_coverage', [r['websiteSku']], ['catalogue', 'PDP', 'Shopify assignment'],
            [{'path': str(e / 'production/audit.json'), 'recordId': r['productId'], 'status': r['status'], 'scope': scope,
              'sourceMatch': 'pending; filename absence does not prove missing master'}],
            'Match exact source and identity; prepare a reviewed local asset and explicit publication/reference payload. Exclude only documented reference, retired or test records.',
            ['Exact SKU identity confirmed', 'Hosted candidate decodes at required dimensions', 'Visual approval at current hash', 'PDP/catalogue/checkout identity checked after approved release'],
            certainty='data_gap_confirmed' if scope not in ['retired', 'reference_component', 'test_record'] else 'non_customer_scope',
            linear=['ASA-104', 'ASA-89'], record_ids=[p['_id']])
        diagnosis = minaret_diagnoses.get(r['websiteSku'])
        if diagnosis and diagnosis['diagnosis'] == 'no_complete_assembly_media_path':
            issues[-1]['surfaces'].append('Builder availability')
            issues[-1]['evidence'].append({'path': str(minaret_file), 'websiteSku': r['websiteSku'],
                'finding': 'Exact included-assembly identity and sellability pass; reviewed body exists; exact plate, legacy kit and renderable register build absent in saved evidence.'})
            issues[-1]['proposedRepair'] = diagnosis['repair']
            issues[-1]['acceptanceCriteria'].extend(['Exact source-backed assembly becomes selectable in Builder',
                'PDP-to-Builder handoff selects this exact SKU; no sibling finish substitution'])

    add('BBM-RETRY-001', 'Builder image stays unavailable after transient failures', 'shared_loading', list(served), ['Builder'],
        [str(e / 'retry-before.log'), str(e / 'retry-nesting-before.log'), str(e / 'retry-final.log')],
        'Keep immediate retry; add one bounded delayed retry, online recovery, and manual retry for the full preview. Avoid nested buttons in selectable thumbnails.',
        ['Failure reproduces before patch', 'Transient error recovers', 'No endless retry loop', 'Thumbnail recovery never selects a bottle', 'Physical iPhone Safari/network recovery check'],
        certainty='confirmed_shared_defect', implementation='built_locally',
        reproduction='Fail both optimized and raw image requests, then restore connectivity. The previous implementation remains unavailable. All configurations are exposed to this shared path; this is not a claim that all fail.')
    pdp_skus = [p.get('websiteSku') for p in products if p.get('productGroupId') and classify(p) == 'catalogue_candidate']
    shopify_pdp_skus = [p.get('websiteSku') for p in products if p.get('websiteSku') in pdp_skus
                       and (p.get('imageUrl') or '').startswith('https://cdn.shopify.com/')]
    add('BBM-PDP-RECOVERY-001', 'PDP optimizer failure discards Shopify image without trying its original', 'shared_loading', shopify_pdp_skus, ['PDP'],
        [str(e / 'pdp-image-recovery-before.log'), str(e / 'pdp-image-recovery-after.log')],
        'Try the exact original URL once after an optimized image fails. Advance to the next exact-SKU fallback only when that original fails too. Preserve per-URL recovery state.',
        ['Shopify optimizer failure recovers to original', 'Direct-source failure does not loop', 'SKU changes do not inherit another URL failure', 'Actual mobile/network recovery verified'],
        certainty='confirmed_shared_defect', implementation='built_locally',
        reproduction='With no renderable kit, fail the optimized Shopify photo request. Before the fix the next source or empty state appears without trying the original. Listed SKU count is exposure through Shopify photo metadata, not witnessed failures or proof that each SKU uses fallback.')
    add('BBM-PDP-BASELINE-001', 'Decorative baseline obstructs bottle presentation', 'shared_presentation', pdp_skus, ['PDP'],
        ['User screenshot 2026-10-01 14:44', 'src/components/pdp/PdpStage.tsx', str(e / 'pdp-tests.log')],
        'Remove decorative stageBaseline element and CSS; preserve geometry datums.', ['Line absent on desktop/mobile PDP', 'Bottle and cap seating unchanged'],
        certainty='confirmed_shared_defect', implementation='built_locally')
    policy_path = Path(__file__).resolve().parents[1] / 'src/lib/products/closure-presentation-policy.json'
    policy = read(policy_path)
    assembled_applicators = {value.lower() for value in policy['assembledApplicators']}
    assembled_exact_skus = set(policy['assembledExactSkus'])
    assembled_skus = [p.get('websiteSku') for p in products
                      if p.get('websiteSku') in assembled_exact_skus
                      or (p.get('applicator') or '').strip().lower() in assembled_applicators]
    add('BBM-PDP-VIEWS-001', 'View controls offer identical assembled views and mislabel photos', 'shared_behavior', assembled_skus, ['PDP'],
        [str(e / 'views-before.log'), str(e / 'views-after.log'), str(policy_path)],
        'Offer only Cap On for closures governed by the existing assembled-only policy; label flat fallback PHOTO and select the first supported view after SKU changes.',
        ['Unsupported buttons disabled', 'Selected button describes actual image', 'Roller and spray supported views retained'],
        certainty='confirmed_shared_defect', implementation='built_locally',
        reproduction='Policy exposure includes exact SKU exceptions and case-insensitive trimmed applicators. Actual assembled-view applicability also requires a kit; these are not all observed failures. Flat-image PHOTO labeling additionally applies to no-kit fallbacks.')
    kits = read(e / 'precise-raccoon-123-kits.json')
    partial_skus = [sku for sku, kit in kits.items() if kit and kit.get('completeness') != 'full']
    add('BBM-PARTIAL-KITS-001', 'Partial legacy kits require exact role applicability review', 'coverage_review', partial_skus, ['PDP', 'Builder'],
        [str(e / 'precise-raccoon-123-kits.json')],
        'Check actual register precedence and supported views before classifying a partial legacy kit as defective.',
        ['Required view roles documented per exact SKU', 'No missing supported layer', 'Unsupported views unavailable'], linear=['ASA-96'])
    shopify_review = [r['websiteSku'] for r in production['rows'] if r['shopify']['variantState'] != 'assigned']
    add('BBM-SHOPIFY-IMAGES-001', 'Shopify assignment gaps and duplicate identities need separate read-back', 'assignment_review', shopify_review, ['Shopify', 'cart', 'checkout'],
        [str(e / 'production/audit.json')],
        'Match exact variant IDs to approved image hashes and check cart/checkout behavior; a missing assignment does not prove the PDP image is missing.',
        ['No ambiguous SKU-to-variant mapping', 'Exact approved variant image', 'Read-back receipt after authorized writes'], linear=['ASA-89'])
    groups = read(e / 'precise-raccoon-123-groups.json')
    for asset in read(e / 'asset-url-results.json'):
        if asset['state'] == 'http-image-healthy' and asset.get('hashMatches') is not False:
            continue
        skus = [s for s in asset['skus'] if s in by_sku]
        for g in groups:
            if g.get('slug') in asset['skus']:
                skus += [p.get('websiteSku') for p in products if p.get('productGroupId') == g.get('_id')]
        id = 'BBM-DELIVERY-' + hashlib.sha256(asset['url'].encode()).hexdigest()[:10]
        add(id, 'Broken or mismatched hosted reference: ' + ', '.join(asset['skus'][:2]), 'delivery', skus, asset['roles'],
            [asset], 'Prepare exact approved replacement reference and rollback receipt; check whether current UI masks the broken reference.',
            ['GET decodes at intended dimensions', 'SKU and role match', 'Actual customer path verified'], certainty='confirmed_reference_defect')
    prior_groups = [
        ('BBM-ROUND-TUBE-001', 'Round 78 ml spray mechanism/tube continuity', 'round78-spray-affected-skus.json', 'websiteSku', ['ASA-206']),
        ('BBM-BOSTON-PIPETTE-001', 'Coloured Boston dropper pipette visibility', 'boston-full-site/coloured-dropper-visual-qa.json', 'websiteSku', ['ASA-206']),
        ('BBM-BUILDER-COVERAGE-001', 'Earlier 67 Builder drawing exceptions', 'builder-67-drawing-backlog.json', 'websiteSku', ['ASA-104', 'ASA-96'])]
    for id, title, file, key, linear in prior_groups:
        rows = read(prior / file)
        if isinstance(rows, dict):
            rows = rows.get('rows', rows.get('items', []))
        add(id, title, 'historical_visual_or_coverage', [r[key] for r in rows], ['PDP', 'Builder'],
            [str(prior / file)], 'Recheck exact current mapping; preserve approved body geometry; replace failed parts only after pilot review.',
            ['Exact finish and glass on both surfaces', 'Supported views actually change', 'Continuous correctly seated tube/pipette', 'Current-hash visual approval'], linear=linear)
    earlier_builds = read(prior / 'builder-67-drawing-backlog.json')['rows']
    stack_file = e / 'drawing-stack/assemblies.json'
    stack_rows = read(stack_file) if stack_file.exists() else None
    add('BBM-DRAWING-STACK-001', 'Review existing drawing stack #341 → #342 → #343 before rebuilding', 'pr_release_queue',
        [r['websiteSku'] for r in stack_rows] if stack_rows is not None else
        [r['websiteSku'] for r in earlier_builds if r.get('localBuildStatus') == 'resolved'], ['PDP', 'Builder'],
        [str(e / 'open-prs.json'), str(prior / 'builder-67-drawing-backlog.json')] +
        ([str(stack_file), str(e / 'drawing-stack/summary.json'), str(e / 'drawing-stack/prs.json')] if stack_rows is not None else []),
        'Reconcile the exact branch assets and rules against current main. Preserve stack order and validate all expanded scopes before any approved merge or data load.',
        ['Exact component source hashes retained', 'All affected combinations reviewed', 'Stack integration passes tests', 'Separate merge/asset/data approvals'],
        implementation='pr_source_reconciled_visual_review_pending' if stack_rows is not None else 'historical_local_builds_not_recertified')
    add('BBM-FINISH-MIGRATION-001', 'PR #347 finish-image migration remains held', 'pr_release_queue', [], ['PDP', 'Builder'],
        [str(e / 'open-prs.json'), 'https://github.com/asalastudio/best-bottles-website/pull/347'],
        'Read the exact asset manifest and approval state; verify hosted assets before changing frontend references.',
        ['Approved hashes only', 'Publication receipts', 'Read-back before merge'], implementation='existing_draft_pr')
    add('BBM-PERFORMANCE-OVERLAP-001', 'PR #368 overlaps the PDP and Builder changes', 'integration_review', [], ['PDP', 'Builder'],
        [str(e / 'open-prs.json'), str(e / 'pr-368.diff')],
        'Rebase the focused media patch against the ultimately approved performance branch. Review PdpStage, PdpRedesignPage, CSS and Matrix boundaries explicitly.',
        ['No duplicate selector/view logic', 'Recovery survives performance refactor', 'Desktop/mobile visual checks'], implementation='integration_pending')
    integration_file = e / 'pr-368-integration/candidate.json'
    if integration_file.exists():
        issues[-1]['implementation'] = 'local_integration_candidate_tested'
        issues[-1]['evidence'].extend([str(integration_file), str(e / 'pr-368-integration/expanded-sources-before.log'),
            str(e / 'pr-368-integration/expanded-sources-after.log'), str(e / 'pr-368-integration/integration-resolution.patch')])
        issues[-1]['proposedRepair'] = 'Apply the reviewed resolution to the exact combined revision: retain mobile LCP CSS without the decorative baseline; recover originals for every newly optimized photo/body source. Candidate is local only; PR and browser gates remain open.'
    add('BBM-GLASS-ORDER-001', 'Stationary glass selector correction requires deployed-path confirmation', 'behavior_review', pdp_skus, ['PDP'],
        ['src/lib/products/pdp-redesign/model.ts:glassOptions'],
        'Current main already sorts glass options independently of active selection. Verify navigation and current deployed order before changing code again.',
        ['Clear/amber/cobalt retain positions after each selection', 'Only selected state changes', 'Mobile navigation checked'], implementation='present_in_current_main')
    issues[-1]['merged'] = 'present_in_current_main'
    tassels = csv_rows(prior / 'tassel-affected-skus.csv')
    add('BBM-TASSEL-METAL-001', 'Black/ivory/red/white tassel hardware silver versus gold', 'historical_identity',
        [r.get('websiteSku') for r in tassels], ['PDP', 'Builder'], [str(prior / 'tassel-affected-skus.csv'), str(prior / 'tassel-verification.json')],
        'Review silver PSD/catalogue evidence against current layers; prepare silver hardware correction only for the exact four compatible finishes.',
        ['Metal finish matches source', 'Hose/bulb colour retained', 'All affected assemblies reviewed'], linear=['ASA-206'])
    add('BBM-FITMENT-SCOPE-001', '5 ml fitments hidden by spray collection scope', 'scope_behavior',
        [p.get('websiteSku') for p in products if p.get('family') == 'Cylinder' and p.get('capacityMl') == 5], ['Builder'],
        [str(prior / '5ml-fitment-check'), 'src/lib/bottle-builder/collections.ts'],
        'Verify scoped and unrestricted flows; change scope messaging/navigation only if misleading. Do not invent compatibility.',
        ['Spray collection scope explicit', 'Explore all fitments exposes approved roller/pour combinations', 'Handoff retains intended bottle'], certainty='historical_explained_needs_recheck')
    for id, title, predicate in [
        ('BBM-HOLD-13425', '13-425 vial caps: factual hold', lambda p: p.get('family') == 'Vial' and p.get('neckThreadSize') == '13-425' and p.get('applicator') != 'Dropper'),
        ('BBM-HOLD-VIAL4', 'Vial 4 droppers: identity/colour decision', lambda p: p.get('family') == 'Vial' and p.get('capacityMl') == 4 and p.get('applicator') == 'Dropper')]:
        add(id, title, 'factual_hold', [p.get('websiteSku') for p in products if predicate(p)], ['PDP', 'Builder eligibility'],
            [str(prior / 'current-status.md')], 'Recover original exact-item decision and verify catalogue/master fitment before changing eligibility or artwork.',
            ['Exact item/neck/finish decision documented', 'Approved scope enumerated'], certainty='historical_hold_needs_recheck')

    approvals = csv_rows(old / 'review-approval-queue.csv')
    replacements = [r for r in approvals if r['collection'] == 'catalog-replacements-2026-09-07']
    add('BBM-REPLACEMENTS-001', '200 historical replacement candidates require hash-specific clearance', 'approval_queue',
        [r['websiteSku'] for r in replacements], ['catalogue', 'PDP', 'Builder'], [str(old / 'review-approval-queue.csv')],
        'Reconcile candidate hashes against current source and hosted asset; do not inherit approval from a different hash.',
        ['Source lineage complete', 'Geometry/technical checks pass', 'Owner approves exact hash'], linear=['ASA-91', 'ASA-89'])
    for item in read(e / 'linear-issues.json')['issues']:
        if item['id'] in ['ASA-197', 'ASA-198', 'ASA-200', 'ASA-201']:
            add('BBM-' + item['id'], item['title'], 'linear_scope_review', [], ['PDP', 'Builder'], [item],
                'Resolve exact SKU scope from linked source evidence; reproduce before repairing.',
                ['Exact affected SKUs enumerated', 'Issue reproduced or disproved with current evidence', 'Applicable views visually accepted'], linear=[item['id']])

    issue_ids = {}
    for issue in issues:
        for id in issue['recordIds']:
            issue_ids.setdefault(id, []).append(issue['id'])
    matrix = []
    for p in products:
        sku = p.get('websiteSku') or ''
        m = media.get(p['_id'], {})
        hist = historical.get(p['_id'], {})
        assembly = stages['assemblies'].get(p.get('graceSku')) or {}
        matrix.append(dict(recordId=p['_id'], websiteSku=sku, graceSku=p.get('graceSku'), family=p.get('family'),
            category=p.get('category'), capacityMl=p.get('capacityMl'), glass=p.get('color'), fitment=p.get('applicator'), finish=p.get('capColor'),
            scope=classify(p), builderOffered=sku in served, builderConfiguration=served.get(sku),
            builderApplicability='offered' if sku in served else 'not_offered_requires_scope_classification',
            registerRenderable=assembly.get('renderable', False), registerReason=assembly.get('reason'),
            mediaCoverage=m.get('status'), shopifyImageState=m.get('shopify', {}).get('variantState'),
            groupSlug=m.get('groupSlug'), legacyUrl=p.get('productUrl'),
            sourceCandidates=hist.get('masterFilenameCandidates', []), historicalKitState=hist.get('kitState'),
            historicalReviews=hist.get('reviewCollections'), issueIds=issue_ids.get(p['_id'], []),
            catalogueCard='pending', pdp='pending', builderSteps='pending' if sku in served else 'scope_review',
            capOn='pending_applicability', sidecar='pending_applicability', exploded='pending_applicability',
            zoom='pending', stationarySelectors='pending', handoff='pending', cartIdentity='pending',
            desktop='pending', mobile='pending', physicalIphoneSafari='pending', visualApproval='pending', verifiedLive=False))
    unmatched = [s for s in served if s not in by_sku]
    if unmatched:
        raise ValueError('Builder configurations missing product identities: ' + str(unmatched))
    active_gaps = [r for r in missing if classify(product_ids[r['productId']]) == 'catalogue_candidate']
    identity_gaps = [r for r in missing if classify(product_ids[r['productId']]) == 'identity_decision_required']
    excluded_gaps = [r for r in missing if classify(product_ids[r['productId']]) in ['retired', 'reference_component', 'test_record']]
    unresolved_offered = [r for r in matrix if r['builderOffered'] and not r['registerRenderable']]
    summary = dict(generatedAt=datetime.now(timezone.utc).isoformat(), productionRecords=len(products),
        uniqueNonblankWebsiteSkus=len({p.get('websiteSku') for p in products if p.get('websiteSku')}),
        builderConfigurations=len(served), builderBodies=len({v['bodyId'] for v in served.values()}),
        builderWithoutRenderableRegister=len(unresolved_offered), sourceMatchPending=len(missing),
        catalogueCandidateImageGapRecords=len(active_gaps), identityDecisionImageGapRecords=len(identity_gaps),
        nonCustomerImageGapRecords=len(excluded_gaps),
        developmentImageGapRecords=development['summary']['needsRecovery'],
        issueRecords=len(issues), issueCertaintyCounts=dict(Counter(i['certainty'] for i in issues)),
        confirmedUniqueTechnicalDefects=sum(i['certainty'] in ['confirmed_shared_defect', 'confirmed_reference_defect'] for i in issues),
        notes=['Issue records include queues and historical holds; do not sum them as independent customer defects.',
               'Live Builder coverage is bounded to locally enumerated body IDs checked against live APIs; remote-only cached bodies are not independently enumerated.',
               'Shared-path impact counts are exposure, not a count of witnessed failures.',
               'Missing source matches are not proof that PSD sources are absent.',
               'No catalogue-wide visual acceptance, owner approval or release is claimed.',
               'Eligible launch scope and external legacy catalogue completeness remain explicit gates.'])
    dump(out / 'backlog.json', dict(summary=summary, issues=issues))
    dump(out / 'acceptance-matrix.json', matrix)
    table_csv(out / 'backlog.csv', issues)
    table_csv(out / 'acceptance-matrix.csv', matrix)
    table_csv(out / 'builder-register-exceptions.csv', unresolved_offered)
    table_csv(out / 'replacement-approval-queue.csv', replacements)
    table_csv(out / 'development-image-gaps.csv', [r for r in development['rows'] if r['status'] == 'no_verified_source'])
    dump(out / 'summary.json', summary)
    data = json.dumps(issues, ensure_ascii=False).replace('<', '\\u003c')
    title = 'Best Bottles — media completion register'
    document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>''' + title + '''</title>
<style>body{font:16px/1.5 system-ui;background:#f5f3ef;color:#202020;max-width:1200px;margin:auto;padding:32px}h1{font-weight:500}input,select{padding:12px;font:inherit;border:1px solid #aaa;background:white}input{width:60%}article{background:white;padding:22px;margin:16px 0;border:1px solid #d6d2ca}small{color:#625d55}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 monospace}.tag{font-size:12px;border:1px solid #bbb;padding:4px 8px}a{color:#725316}</style>
<h1>''' + title + '''</h1><p>Evidence refreshed 12–13 October 2026 · In progress · No release approved.</p>
<p>''' + str(len(products)) + ''' catalogue records · ''' + str(len(served)) + ''' served Builder configurations · ''' + str(len(active_gaps)) + ''' image-gap records in customer scope · ''' + str(len(unresolved_offered)) + ''' offered combinations without a renderable register build.</p>
<p>These measures overlap. A working URL is not visual approval. Shared-path counts show potential exposure.</p>
<p><a href="acceptance-matrix.csv">Every SKU / acceptance matrix</a> · <a href="backlog.csv">Issue CSV</a> · <a href="pilots/review.html">Artwork pilots</a></p>
<input id="q" placeholder="Search exact SKU, family, issue, Linear ID…" aria-label="Search issues"><select id="state" aria-label="Evidence classification"><option value="">All evidence states</option></select><p id="count"></p><main id="items"></main>
<script>const rows=''' + data + ''';const q=document.querySelector('#q'),state=document.querySelector('#state'),items=document.querySelector('#items');for(const s of [...new Set(rows.map(r=>r.certainty))]){const o=document.createElement('option');o.value=s;o.textContent=s;state.append(o)}function el(tag,text){const e=document.createElement(tag);e.textContent=text;return e}function render(){items.replaceChildren();const filtered=rows.filter(r=>(!state.value||r.certainty===state.value)&&JSON.stringify(r).toLowerCase().includes(q.value.toLowerCase()));document.querySelector('#count').textContent=filtered.length+' issue records';for(const r of filtered){const a=el('article','');a.append(el('small',r.id+' · '+r.certainty),el('h2',r.title),el('p',r.affectedSkuCount+' exact SKUs · '+r.affectedConfigurationCount+' served configurations · '+r.implementation),el('p',r.proposedRepair));const d=el('details','');d.append(el('summary','Exact items, evidence, acceptance and release states'),el('pre',JSON.stringify(r,null,2)));a.append(d);items.append(a)}}q.addEventListener('input',render);state.addEventListener('change',render);render();</script></html>'''
    (out / 'index.html').write_text(document)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
