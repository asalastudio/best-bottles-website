#!/usr/bin/env python3
"""Read-only PR/source reconciliation. Does not merge, publish, or write catalogue data."""
import argparse
import csv
import io
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def git(*args):
    return subprocess.check_output(['git', *args], text=True)


def rows(ref, file, key):
    return {r[key]: r for r in csv.DictReader(io.StringIO(git('show', ref + ':' + file)))}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--evidence', required=True, type=Path)
    args = parser.parse_args()
    dest = args.evidence / 'drawing-stack'
    dest.mkdir(exist_ok=True)
    source = json.loads((args.evidence / 'precise-raccoon-123-register-stage.json').read_text())
    served = json.loads((args.evidence / 'builder-served.json').read_text())['served']
    prod = {v['websiteSku']: v for v in source['assemblies'].values() if v}
    current_ref = git('rev-parse', 'HEAD').strip()
    current = rows(current_ref, 'data/register/assemblies.csv', 'websiteSku')
    current_components = rows(current_ref, 'data/register/components.csv', 'componentId')
    prs, changes, components = [], [], []
    for number in [341, 342, 343]:
        meta = json.loads(subprocess.check_output(['gh', 'pr', 'view', str(number), '--json',
            'number,title,state,baseRefName,headRefName,headRefOid,files,statusCheckRollup,url'], text=True))
        ref = meta['headRefOid']
        base = git('merge-base', current_ref, ref).strip() if number == 341 else prs[-1]['headRefOid']
        before = rows(base, 'data/register/assemblies.csv', 'websiteSku')
        after = rows(ref, 'data/register/assemblies.csv', 'websiteSku')
        meta['comparisonBaseCommit'] = base
        changed = []
        for sku, row in after.items():
            prior = before.get(sku, {})
            if prior == row:
                continue
            production = prod.get(sku)
            entry = dict(pr=number, websiteSku=sku, graceSku=row['graceSku'], bodyId=row['bodyId'],
                glass=row['glass'], fitment=row['fitmentType'], finish=row['capColor'],
                beforeBuildStatus=prior.get('buildStatus'), branchBuildStatus=row['buildStatus'],
                beforeParts=prior.get('buildParts'), branchParts=row['buildParts'],
                changedFields=[k for k in row if row[k] != prior.get(k)],
                currentLocalBuildStatus=current.get(sku, {}).get('buildStatus'),
                currentLocalParts=current.get(sku, {}).get('buildParts'),
                savedProductionRenderable=production.get('renderable') if production else False,
                savedProductionParts=production.get('parts') if production else None,
                offeredInSavedBuilder=sku in served, browserVerified=False, visuallyApproved=False)
            changes.append(entry)
            changed.append(sku)
        meta['changedAssemblySkus'] = changed
        before_components = rows(base, 'data/register/components.csv', 'componentId')
        after_components = rows(ref, 'data/register/components.csv', 'componentId')
        added = sorted(set(after_components) - set(before_components))
        meta['newComponentIds'] = added
        measurements = []
        for neck in ['13-415', '18-415']:
            measurements += json.loads(git('show', ref + ':data/register/components/' + neck + '-measurements.json'))['components']
        for cid in added:
            measurement = next((m for m in measurements if m['componentId'] == cid), None)
            components.append(dict(pr=number, componentId=cid, branchRecord=after_components[cid],
                measuredSource=measurement, presentInCurrentLocalRegister=cid in current_components,
                presentInSavedProductionStage=cid in source['components'],
                originalPsdReopened=False, extractedFileHashRechecked=False, visualApproval='pending'))
        # Source-only integration simulation: writes unreachable Git objects, never a
        # branch, index, worktree, remote, catalogue or deployment.
        simulated = subprocess.run(['git', 'merge-tree', '--write-tree', current_ref, ref], text=True, capture_output=True)
        (dest / f'pr-{number}-integration-simulation.txt').write_text(simulated.stdout + simulated.stderr)
        if simulated.returncode not in [0, 1]:
            raise RuntimeError(f'Unexpected merge-tree failure for #{number}: {simulated.stderr}')
        meta['integrationSimulation'] = 'conflicts' if simulated.returncode else 'no_textual_conflicts'
        prs.append(meta)
    summary = dict(collectedAt=datetime.now(timezone.utc).isoformat(), currentLocalCommit=current_ref,
        uniqueChangedAssemblySkus=len({r['websiteSku'] for r in changes}),
        newlyResolvedBuilds=sum(r['beforeBuildStatus'] != 'resolved' and r['branchBuildStatus'] == 'resolved' for r in changes),
        addedComponents=len(components), changedSkusOfferedInSavedBuilder=sum(r['offeredInSavedBuilder'] for r in changes),
        changedSkusNotRenderableInSavedProduction=sum(not r['savedProductionRenderable'] for r in changes),
        allChangedSkusAlreadyResolvedLocally=all(r['currentLocalBuildStatus'] == 'resolved' for r in changes),
        scope='Exact assembly CSV deltas only. Other existing assemblies affected by shared renderer/tube changes require broader visual verification.',
        productionEvidence='Previously saved snapshots; no new production browser or API access in this audit.',
        visualAcceptance=False, releaseApproved=False)
    for name, data in [('summary', summary), ('prs', prs), ('assemblies', changes), ('components', components)]:
        (dest / (name + '.json')).write_text(json.dumps(data, indent=2) + '\n')
    with (dest / 'assemblies.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(changes[0]))
        writer.writeheader()
        writer.writerows({k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in r.items()} for r in changes)
    print(json.dumps(summary, indent=2))
    print(json.dumps([{ 'pr': p['number'], 'changedAssemblies': len(p['changedAssemblySkus']),
        'newComponents': len(p['newComponentIds']), 'integration': p['integrationSimulation']} for p in prs], indent=2))


if __name__ == '__main__':
    main()
