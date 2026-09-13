import type { LedgerRow, Kind } from './types';

export type Candidate = { state: string; sha256?: string; plateSha256?: string; collection: string; bytesVerified?: boolean };
export type QueueRow = LedgerRow & {
  itemName?: string | null; capColor?: string | null; capStyle?: string | null; capHeight?: string | null; trimColor?: string | null; productGroupId?: string | null;
  plate: LedgerRow['plate'] & { complete?: boolean; checksPassed?: boolean; imageUrl?: string; sourcePath?: string; sourceHold?: unknown; sizeHold?: string; masterSourceRecorded?: boolean; approval?: unknown; candidate?: Candidate; localCandidate?: unknown };
  kit: LedgerRow['kit'] & { candidate?: Candidate };
  hero: LedgerRow['hero'] & { candidate?: Candidate };
};
export type QueueGroup = { id: string; state: string; skus: string[]; indexedSkus: string[]; sunburstSkus: string[] };
export type QueueStandard = { id: string; version: number; state: string; productGroupIds: string[]; finalCandidate?: { sku: string; ready: boolean; status: string; after: { sha256: string; url: string } } | null };
export type QueueTone = 'keep' | 'review' | 'repair' | 'hold';
export type QueueAction = { tone: QueueTone; title: string; next: string };
const action = (tone: QueueTone, title: string, next: string): QueueAction => ({ tone, title, next });

// These are work recommendations, not new approval or completion states.
export function queueActions(r: QueueRow, groups: QueueGroup[], standards: QueueStandard[]): Record<Kind, QueueAction> {
  const p = r.plate, k = r.kit, h = r.hero;
  let plate: QueueAction;
  if (p.state === 'not-applicable') plate = action('keep', 'Not required', 'Retain the recorded applicability decision.');
  else if (p.sourceHold || p.hold || p.issues?.length || p.state === 'hold') plate = action('hold', 'Resolve plate hold', 'Reconcile the recorded source or integrity finding against exact catalog evidence and the master PSD. Preserve this file.');
  else if (p.sizeHold || p.state === 'plated-wrong-size') plate = action('repair', 'Check glass sizing', 'Compare the existing plate with its verified physical profile. Keep it unless a measured correction is needed.');
  else if (p.complete) plate = action('keep', 'Keep approved plate', 'Retain these exact bytes and their approval; include them in release checks.');
  else if (p.checksPassed) plate = action('review', 'Recover approval / review', 'Find matching plate-specific approval evidence first. If none exists, review the current image without rebuilding it.');
  else if (p.state === 'plated-cap-on-only') plate = action('repair', 'Recover cap-off view', 'Keep the cap-on plate. Check isolated layers and paired uncapped master PSDs for the required view.');
  else if (p.state === 'none') plate = action('hold', 'Plate not indexed', p.localCandidate ? 'Inspect the preserved local candidate and source evidence before making another plate.' : 'Search saved candidates and verified master sources before creating a plate. This is not yet a photography gap.');
  else plate = action('hold', 'Verify existing plate', 'Resolve its recorded measurement, lineage or review evidence before reuse.');

  let kit: QueueAction;
  if (k.state === 'not-applicable') kit = action('keep', 'Not required', 'Retain the recorded applicability decision.');
  else if (k.state === 'live' && !k.issues?.length) kit = action('keep', 'Keep live kit', 'Preserve its parts. Recheck registration if its plate changes.');
  else if (k.candidate && (!k.candidate.bytesVerified || !k.candidate.plateSha256 || k.candidate.plateSha256 !== p.sha256)) kit = action('hold', 'Recheck saved kit', 'Preserve the candidate; verify its files and alignment against the current plate before review.');
  else if (k.state === 'approved-not-published') kit = action('review', 'Approved · release pending', 'Preserve the exact approved kit. Confirm plate readiness, then include it in a named release.');
  else if (['candidate', 'pending', 'rendered'].includes(k.state) && k.candidate?.bytesVerified) kit = action('review', 'Review saved kit', 'Use the existing candidate. Check photographed parts and alignment; a plate correction requires a new registration check.');
  else if (['changes_requested', 'rejected'].includes(k.state)) kit = action('repair', 'Address kit feedback', 'Read the saved feedback and repair only the affected parts; changed bytes return to review.');
  else if (k.state === 'no-plate') kit = action('hold', 'Plate needed first', 'Recover or finish the plate, then audit real component layers in its master source.');
  else kit = action('hold', 'Resolve kit hold', /parity/i.test(k.reason ?? '') ? 'Check alignment against the exact current plate; preserve usable parts.' : /independent|recoverable/i.test(k.reason ?? '') ? 'Search paired master files and embedded layers for a real component. An old extraction failure does not prove photography is missing.' : /alpha|transparen|edge/i.test(k.reason ?? '') ? 'Inspect extraction edges in the saved parts and original master layers.' : 'Recheck the recorded source or component-layer mapping. Keep unresolved identity explicit.');

  const group = groups.find(g => g.id === r.productGroupId);
  const standard = standards.find(s => !!r.productGroupId && s.productGroupIds.includes(r.productGroupId));
  const final = standard?.finalCandidate;
  let hero: QueueAction;
  if (final?.sku === r.sku && final.ready && final.status === 'approved') hero = action('review', 'Resized image approved', 'Keep the approved final file. Verify its desktop/mobile product experience before release.');
  else if (h.candidate && (!h.candidate.bytesVerified || ['changes_requested','rejected','evidence-missing'].includes(h.candidate.state))) hero = action('repair', 'Check saved hero feedback', 'Preserve the indexed image. Resolve the current candidate’s evidence or feedback before another edit.');
  else if (h.state === 'approved-not-indexed' || h.state === 'approved-not-locked') hero = action('review', 'Recover approved hero', 'Preserve the saved approval. Resolve exact group identity and check the locked glass target before indexing.');
  else if (h.state === 'indexed' && h.generation === 'sunburst-approved') hero = action('review', 'Reuse approved Sunburst', 'Check this configuration against the locked glass target. Resize only if needed; changed bytes need their own review.');
  else if (h.candidate?.bytesVerified) hero = action('review', 'Review saved hero', 'Inspect the existing candidate and its exact component identity before considering new generation.');
  else if (group?.state === 'complete') hero = action('repair', 'Check component coverage', 'A group Sunburst exists. Search saved exact-configuration images and verify the selected component; do not assume a new generation is required.');
  else hero = action('hold', 'Find hero source', 'Reconcile exact group identity and saved images before preparing any missing hero.');
  return { plate, kit, hero };
}

export function componentLabel(r: QueueRow) {
  return [r.applicator, r.capColor && `${r.capColor} cap`, r.capStyle, r.capHeight, r.trimColor && `${r.trimColor} trim`].filter(Boolean).join(' · ') || 'Component details need reconciliation';
}

export function queueCsv(rows: QueueRow[], groups: QueueGroup[], standards: QueueStandard[], snapshot: string) {
  const header = ['snapshot', 'sku', 'graceSku', 'family', 'sizeMl', 'glassColor', 'component', 'catalogName', 'groupId', 'groupSlug', 'standard', 'standardVersion', ...(['plate','kit','hero'] as Kind[]).flatMap(k => [k+'State', k+'Action', k+'Next', k+'CurrentSha256', k+'CandidateSha256', k+'Collection', k+'Reason'])];
  const lines = rows.map(r => {
    const a = queueActions(r, groups, standards), s = standards.find(s => !!r.productGroupId && s.productGroupIds.includes(r.productGroupId));
    return [snapshot, r.sku, r.graceSku, r.family, r.capacityMl, r.color, componentLabel(r), r.itemName, r.productGroupId, r.groupSlug, s?.id, s?.version, ...(['plate','kit','hero'] as const).flatMap(k => [r[k].state, a[k].title, a[k].next, 'sha256' in r[k] ? r[k].sha256 : '', r[k].candidate?.sha256, r[k].candidate?.collection, JSON.stringify(r[k])])];
  });
  // Quote all fields and neutralize spreadsheet formulas, including untrusted catalog text.
  const escape = (v: unknown) => { let t = String(v ?? ''); if (/^[=+@\-\t\r]/.test(t)) t = "'" + t; return '"' + t.replaceAll('"','""') + '"'; };
  return [header, ...lines].map(line => line.map(escape).join(',')).join('\r\n');
}
