import policy from '../../src/lib/products/closure-presentation-policy.json' with {type:'json'};
export function assembledPlatePresentation(identity) {
    return policy.assembledExactSkus.includes(identity.sku??identity.websiteSku) ||
        policy.assembledApplicators.some(value=>value.toLowerCase()===identity.applicator?.trim().toLowerCase());
}
