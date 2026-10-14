"""Build an execution index over existing evidence; does not infer eligibility or acceptance."""
import csv, hashlib, json, sys
from collections import defaultdict
from pathlib import Path
base=Path(sys.argv[1])
snapshot=json.loads((base/'dip-tube-continuation-2026-10-13/production.json').read_text())
builder=json.loads((base/'evidence/builder-served.json').read_text())
issues=json.loads((base/'backlog.json').read_text())['issues']
tubes=json.loads((base/'dip-tube-continuation-2026-10-13/production-local-inventory.json').read_text())['rows']
tube_skus={r['websiteSku'] for r in tubes}
by_sku=defaultdict(list)
for issue in issues:
 for sku in issue['websiteSkus']:by_sku[sku].append(issue)
batches=defaultdict(list)
for product in snapshot['products']:
 key=tuple(str(product.get(k) or '') for k in ['family','capacityMl','neckThreadSize','color','applicator'])
 batches[key].append(product)
rows=[]
for key,products in batches.items():
 skus=sorted({p.get('websiteSku') for p in products if p.get('websiteSku')})
 linked={i['id']:i for sku in skus for i in by_sku[sku]}
 pilot=key[0]=='Empire' and key[1]=='50' and key[4]=='Lotion Pump'
 confirmed_gap=any(i['kind']=='image_coverage' and i['certainty']=='data_gap_confirmed' for i in linked.values())
 priority=0 if pilot else 1 if confirmed_gap else 2 if key[0]=='Round' and key[1]=='78' else 3 if key[0]=='Square' and key[1]=='15' else 4 if key[0]=='Boston Round' else 5
 rows.append(dict(batchId='BB-FAMILY-'+hashlib.sha256('|'.join(key).encode()).hexdigest()[:10],priority=priority,family=key[0],capacityMl=key[1],neck=key[2],glass=key[3],fitment=key[4],recordCount=len(products),uniqueWebsiteSkus=len(skus),historicallyServedBuilderSkus=sum(s in builder['served'] for s in skus),tubeCandidateSkus=sum(s in tube_skus for s in skus),websiteSkus=';'.join(skus),recordIds=';'.join(sorted(p['_id'] for p in products)),issueIds=';'.join(sorted(linked)),localStatus='eight_candidates_offline_checked' if pilot else 'reconcile_existing_repairs_before_new_work',sourceReview='candidate_sources_matched' if pilot else 'pending_batch_review',visualApproval='pending',browserVerified=False,catalogueCardVerified=False,published=False,eligibility='confirm_exact_sellable_or_hold_status_per_record'))
rows.sort(key=lambda r:(r['priority'],r['family'],r['capacityMl'],r['neck'],r['glass'],r['fitment']))
with (base/'family-execution-queue.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
receipt=dict(productionSnapshotReceivedAt=snapshot['receivedAt'],builderEvidenceCollectedAt=builder['collectedAt'],records=len(snapshot['products']),uniqueNonblankWebsiteSkus=len({p['websiteSku'] for p in snapshot['products'] if p.get('websiteSku')}),batches=len(rows),uniqueFamilies=len({r['family'] for r in rows}),notes=['Batch counts are work partitions, not defect counts.','Includes standalone, held and retired records; eligibility is not inferred.','Builder membership is historical evidence and must be refreshed per family.','Each batch must reconcile existing local repairs, preserve exact source identity, verify every supported UI view and receive approval before release.','Catalogue cards and all browser acceptance remain pending.'])
(base/'family-execution-queue-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
