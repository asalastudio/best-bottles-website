import {describe,it,expect} from 'vitest';
import {buildPlatePlan} from '../scripts/asset-ledger/plate-plan.mjs';

describe('family plate accounting',()=>{
    it('shows a held image appearance approval without increasing completion',()=>{
        const plan=buildPlatePlan({rows:[{sku:'a',family:'Cylinder',productRecord:true,plate:{state:'plated-legacy-source',imageUrl:'plate',checksPassed:false,appearanceApproval:{status:'approved'}}}]});
        expect(plan.counts).toMatchObject({total:1,reconcile:1,complete:0,review:0});
        expect(plan.rows[0].visualApprovalRecorded).toBe(true);
    });
    it('accounts for every applicable product once and preserves unresolved scope separately',()=>{
        const base={family:'Cylinder',productRecord:true,capacityMl:9,productGroupId:'group'};
        const rows=[
            {...base,sku:'approved',plate:{state:'plated',imageUrl:'a',complete:true,checksPassed:true}},
            {...base,sku:'review',plate:{state:'plated',imageUrl:'b',checksPassed:true}},
            {...base,sku:'legacy',plate:{state:'plated-legacy-source',imageUrl:'c'}},
            {...base,sku:'unlinked',productGroupId:null,plate:{state:'none'}},
            {...base,sku:'component',plate:{state:'not-applicable'}},
            {...base,sku:'review-only',productRecord:false,plate:{state:'none'}},
        ];
        const plan=buildPlatePlan({rows,scope:{missingSkuRecords:[{id:'missing'}]}});
        expect(plan.counts).toEqual({total:4,complete:1,review:1,reconcile:1,missing:1});
        expect(plan.families[0]).toMatchObject({family:'Cylinder',total:4,unlinked:1,sizes:[9]});
        expect(plan.scope).toMatchObject({notApplicable:1,reviewOnly:1,unlinked:1,reconciled:false});
        expect(plan.scope.missingSku).toHaveLength(1);
        expect(plan.rows.find((r:{sku:string;reasons:string[]})=>r.sku==='unlinked').reasons).toContain('Catalog product-group link needs reconciliation.');
    });
    it('does not count a stale pair approval as ready for review',()=>{
        const plan=buildPlatePlan({rows:[{sku:'a',family:'Boston Round',productRecord:true,plate:{state:'plated',checksPassed:true,completionReviewHold:'Off view changed'}}]});
        expect(plan.counts).toMatchObject({total:1,reconcile:1,review:0,complete:0});
    });
});
