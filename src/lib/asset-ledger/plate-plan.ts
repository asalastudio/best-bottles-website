export type PlateStage = 'complete' | 'release' | 'review' | 'reconcile' | 'missing';
export type PlateCounts = {total:number} & Record<PlateStage,number>;
export type PlateScopeExclusion = {sku:string;family:string;itemName:string;canonicalSku:string;canonicalGroupSlug?:string|null;reason:string;reviewedBy:string;reviewedAt:string;recordId:string};
export type PlatePlanRow = {
    sku:string; graceSku?:string|null; family:string; capacityMl:number|null; color:string|null;
    itemName:string; applicator?:string|null; capColor?:string|null; productGroupId?:string|null;
    groupSlug?:string|null; imageUrl?:string; stage:PlateStage; reasons:string[];
    sha256?:string; capOff?:boolean; plateState:string; sourcePath?:string; visualApprovalRecorded:boolean;
    finalPreparation?:{reviewUrl:string;status:string;paired:boolean;alignmentPassed:boolean;sourceDecisionRequired:boolean}|null;
};
export type PlatePlan = {
    counts:PlateCounts; stages:Record<PlateStage,{label:string;detail:string}>;
    families:Array<PlateCounts & {family:string;sizes:number[];unlinked:number}>;
    rows:PlatePlanRow[];
    scope:{reconciled:boolean;reviewOnly:number;notApplicable:number;unlinked:number;excludedDuplicates:PlateScopeExclusion[];missingSku:Array<{id:string;itemName?:string;family?:string}>};
};
