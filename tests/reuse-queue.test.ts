import { describe, it, expect } from 'vitest';
import ledger from '../src/lib/asset-ledger/ledger.json';
import { queueActions, queueCsv, componentLabel, type QueueRow } from '../src/lib/asset-ledger/reuse-queue';

const rows = ledger.rows.filter(r=>r.productRecord&&r.family==='Boston Round') as QueueRow[];
const group = ledger.groupRows;
const standards = ledger.bottleStandards.standards;
// Test the transition explicitly; a completed catalog may have no pending rows.
const pendingRow: QueueRow = {
  ...rows[0],
  plate: {state:'plated',checksPassed:true,complete:false,sha256:'plate-v1'},
  kit: {state:'candidate',candidate:{state:'candidate',collection:'test-pending-kit',bytesVerified:true,plateSha256:'plate-v1'}},
};
describe('reuse queue preserves asset and approval boundaries',()=>{
  it('accounts for the whole catalog family and each lane without mutating it',()=>{
    const before=JSON.stringify(rows);
    for(const r of rows) expect(Object.keys(queueActions(r,group,standards))).toEqual(['plate','kit','hero']);
    expect(JSON.stringify(rows)).toBe(before);
    expect(queueCsv(rows,group,standards,ledger.generatedAt).split('\r\n')).toHaveLength(rows.length+1);
  });
  it('does not treat group coverage as approval for every component',()=>{
    const r={...rows[0],hero:{state:'none'}};
    const completeGroup={id:r.productGroupId!,state:'complete',skus:[r.sku],indexedSkus:[r.sku],sunburstSkus:[r.sku]};
    expect(queueActions(r,[completeGroup],[]).hero).toMatchObject({tone:'repair',title:'Check component coverage'});
  });
  it('keeps technically passing plates in review until their own approval exists',()=>{
    const r=pendingRow;
    expect(queueActions(r,group,standards).plate.tone).toBe('review');
    expect(queueActions({...r,plate:{...r.plate,sourceHold:{reason:'alias conflict'}}},group,standards).plate.tone).toBe('hold');
  });
  it('blocks stale kit bytes or a changed parent plate',()=>{
    const r=pendingRow;
    expect(queueActions(r,group,standards).kit.tone).toBe('review');
    expect(queueActions({...r,plate:{...r.plate,sha256:'new-plate'}},group,standards).kit.tone).toBe('hold');
    expect(queueActions({...r,kit:{...r.kit,candidate:{...r.kit.candidate!,bytesVerified:false}}},group,standards).kit.tone).toBe('hold');
  });
  it('limits final-image approval to the exact SKU and active ready candidate',()=>{
    const r=rows[0];const s={id:'reference',state:'locked',version:1,productGroupIds:[r.productGroupId!],finalCandidate:{sku:r.sku,ready:true,status:'approved',after:{sha256:'new',url:'/new.png'}}};
    expect(queueActions(r,group,[s]).hero.title).toBe('Resized image approved');
    expect(queueActions(r,group,[{...s,finalCandidate:{...s.finalCandidate,sku:'other'}}]).hero.title).not.toBe('Resized image approved');
    expect(queueActions(r,group,[{...s,finalCandidate:{...s.finalCandidate,ready:false}}]).hero.title).not.toBe('Resized image approved');
  });
  it('never derives a component from a SKU and escapes spreadsheet formulas',()=>{
    const r={...rows[0],sku:'=UNTRUSTED()',applicator:null,capColor:null,capHeight:null,capStyle:null,trimColor:null};
    expect(componentLabel(r)).toBe('Component details need reconciliation');
    expect(queueCsv([r],group,standards,'snapshot')).toContain('"\'=UNTRUSTED()"');
  });
});
