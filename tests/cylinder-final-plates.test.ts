import {describe,it,expect} from 'vitest';
import {validateFinalPlateDecision} from '../scripts/asset-ledger/cylinder-final-plates.mjs';

function fixture(){
    const rows=Array.from({length:38},(_,i)=>({sku:'exact-'+i,productGroupId:'group',binding:'binding-'+i,
        classification:i<27?'Plain short cap':'Roller',pairCheck:{passed:true},holds:[],
        views:[{role:'on',sha256:'on-'+i,url:'/on'},{role:'off',sha256:'off-'+i,url:'/off'}]}));
    return {sheet:{token:'packet',revision:2,rows},input:{token:'packet',revision:2,visualApproved:true,legacySourcesAccepted:true}};
}
describe('Cylinder final batch approval boundary',()=>{
    it('records exact views and source decisions without authorizing publication',()=>{
        const f=fixture();const entries=validateFinalPlateDecision(f.sheet,f.input);
        expect(entries).toHaveLength(38);expect(entries.filter((e:{sourceBasis:string})=>e.sourceBasis==='accepted-exact-original-legacy-raster')).toHaveLength(27);
        expect(entries.every((e:{publicationAuthorized:boolean})=>e.publicationAuthorized===false)).toBe(true);
        expect(entries[0].views[1].sha256).toBe('off-0');
    });
    it.each(['token','revision','visualApproved','legacySourcesAccepted'])('rejects stale or missing %s',key=>{
        const f=fixture();expect(()=>validateFinalPlateDecision(f.sheet,{...f.input,[key]:null})).toThrow();
    });
    it('rejects a missing row, duplicate SKU, missing counterpart or failed alignment',()=>{
        for(const change of ['missing','duplicate','off','alignment']){
            const f=fixture();
            if(change==='missing')f.sheet.rows.pop();
            if(change==='duplicate')f.sheet.rows[0].sku=f.sheet.rows[1].sku;
            if(change==='off')f.sheet.rows[0].views.pop();
            if(change==='alignment')f.sheet.rows[0].pairCheck.passed=false;
            expect(()=>validateFinalPlateDecision(f.sheet,f.input)).toThrow();
        }
    });
    it('allows the explicitly accepted source exception but never hides another technical hold',()=>{
        const f=fixture();(f.sheet.rows[0].holds as string[]).push('Accept retained exact legacy front provenance or supply its exact master finish source.');
        expect(validateFinalPlateDecision(f.sheet,f.input)).toHaveLength(38);
        (f.sheet.rows[0].holds as string[]).push('Unsafe image margin');
        expect(()=>validateFinalPlateDecision(f.sheet,f.input)).toThrow('technical');
    });
});
