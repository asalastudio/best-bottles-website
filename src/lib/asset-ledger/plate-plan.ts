export type PlateStage = 'complete' | 'release' | 'review' | 'reconcile' | 'missing';
export type PlateCounts = {total:number} & Record<PlateStage,number>;
export type PlateScopeExclusion = {sku:string;family:string;itemName:string;canonicalSku:string;canonicalGroupSlug?:string|null;reason:string;reviewedBy:string;reviewedAt:string;recordId:string};
export type RetiredScopeHold = {sku:string;family:string;itemName:string;graceSku?:string|null;status:string;importSource:string;reason:string};
export type PlatePlanRow = {
    sku:string; graceSku?:string|null; family:string; capacityMl:number|null; color:string|null;
    itemName:string; applicator?:string|null; capColor?:string|null; productGroupId?:string|null;
    groupSlug?:string|null; imageUrl?:string; stage:PlateStage; reasons:string[];
    sha256?:string; capOff?:boolean; plateState:string; sourcePath?:string; visualApprovalRecorded:boolean; preparedApprovalRecorded?:boolean;
    byteDecision?:{status:string;scope:string;reason:string;sha256:string;reviewedBy:string;reviewedAt:string}|null;
    acquisitionCandidate?:{status:string;candidate?:{url:string;sha256:string;bytes:number;width:number;height:number};source?:{path:string;sha256:string;library:string;stateEvidence?:string};holdReasons?:string[]}|null;
    finalPreparation?:{reviewUrl:string;status:string;paired:boolean;alignmentPassed:boolean;sourceDecisionRequired:boolean}|null;
};
export type PlatePlan = {
    preparedReview?:{id:string;status:'preparing'|'ready'|'approved';reviewUrl:string|null;families:string[];preparedFamilies:Array<{family:string;catalogRows:number;preserved:number;candidates:number;eligible?:number;paired:number;holds:number;duplicateProposals:number}>;approvalRevision?:number;approvalAt?:string;approvalId?:string;packetSha256?:string;approvedCount?:number;approvedSkus?:string[];duplicateDispositionCount?:number;recordedExceptions?:number;publicationAuthorized?:false;publicationVerifiedAt?:string;publishedManifestSha256?:string;indexedCount?:number}|null;
    counts:PlateCounts; stages:Record<PlateStage,{label:string;detail:string}>;
    families:Array<PlateCounts & {family:string;sizes:number[];unlinked:number;retired:number}>;
    rows:PlatePlanRow[];
    scope:{reconciled:boolean;reviewOnly:number;notApplicable:number;unlinked:number;excludedDuplicates:PlateScopeExclusion[];retiredScopeHolds:RetiredScopeHold[];missingSku:Array<{id:string;itemName?:string;family?:string}>;acquisitionCandidates?:number;acquisitionRows?:number;technicalRows?:number;technicalReviewRows?:number;technicalReconcileRows?:number};
};
