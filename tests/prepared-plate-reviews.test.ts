import {describe, it, expect} from 'vitest';
import {applyPreparedPlateReviews} from '../scripts/asset-ledger/prepared-plate-reviews.mjs';

function fixture() {
    const row = {sku:'exact',productRecord:true,productGroupId:'group',plate:{
        state:'plated',sha256:'on',masterSourceRecorded:true,checksPassed:false,complete:false,
        sourceHold:{reasons:['older source attempt']},sizeHold:'earlier diagnostic',
    }};
    const candidate = {sku:'exact',productGroupId:'group',eligible:true,status:'approved',binding:'review',
        origin:'existing-correction',standardId:'glass',standardVersion:1,standardReferenceSha256:'reference',
        holds:[],views:[{label:'Cap on',sha256:'on',source:{sourcePath:'exact.psd'}},{label:'Cap off',sha256:'off'}]};
    const index = new Map([['exact',{image:'on-url',imageCapOff:'off-url',sourcePath:'exact.psd'}]]);
    const hashes = async (url:string) => url === 'on-url' ? 'on' : 'off';
    return {row,candidate,index,hashes};
}

describe('indexed replacement plate approvals', () => {
    it('resolves earlier findings only after the approved source and every served view match', async () => {
        const f=fixture();
        expect(await applyPreparedPlateReviews([f.row],f.index,{rows:[f.candidate]},f.hashes))
            .toMatchObject({approved:1,resolvedSourceFindings:1,resolvedSizeFindings:1,held:0});
        expect(f.row.plate.complete).toBe(true);
        expect(f.row.plate).toMatchObject({resolvedFindings:{reviewBinding:'review',plateSha256:'on'}});
        expect(f.row.plate).not.toHaveProperty('sourceHold');
    });
    it.each(['off-drift','source-drift','extra-view','network-failure'])('retains holds for %s', async kind => {
        const f=fixture();
        if(kind==='source-drift') f.index.get('exact')!.sourcePath='different.psd';
        if(kind==='extra-view') Object.assign(f.index.get('exact')!,{views:[{cap:'off',view:'back',url:'back-url'}]});
        const hashes=kind==='network-failure'?async()=>{throw Error('unavailable');}:kind==='off-drift'?async()=> 'on':f.hashes;
        expect((await applyPreparedPlateReviews([f.row],f.index,{rows:[f.candidate]},hashes)).held).toBe(1);
        expect(f.row.plate.complete).toBe(false);
        expect(f.row.plate.sourceHold).toBeTruthy();
        expect(f.row.plate.sizeHold).toBeTruthy();
    });
    it('cannot inherit a prepared approval after catalog or standard drift', async () => {
        for(const mutation of [{productGroupId:'other'},{eligible:false},{status:'pending'}]){
            const f=fixture();
            await applyPreparedPlateReviews([f.row],f.index,{rows:[{...f.candidate,...mutation}]},f.hashes);
            expect(f.row.plate.complete).toBe(false);
            expect(f.row.plate.sourceHold).toBeTruthy();
        }
    });
    it('preserves current technical failures despite a matching visual approval', async () => {
        const f=fixture();f.row.plate.state='integrity-hold';
        await applyPreparedPlateReviews([f.row],f.index,{rows:[f.candidate]},f.hashes);
        expect(f.row.plate.complete).toBe(false);
    });
    it('preserves the current approval when a replacement has not been indexed', async () => {
        const f=fixture();f.row.plate.complete=true;f.candidate.views[0].sha256='new';
        await applyPreparedPlateReviews([f.row],f.index,{rows:[f.candidate]},f.hashes);
        expect(f.row.plate.complete).toBe(true);
    });
});
