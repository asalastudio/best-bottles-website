export const CATALOG_UX_REQUIRED_COVERAGE = Object.freeze([
    "cylinder",
    "boston-round",
    "elegant",
    "diva",
    "empire",
    "bottle-only",
    "roll-on",
    "fine-mist",
    "lotion-pump",
    "quote-required",
    "out-of-stock",
    "incompatible",
] as const);

export type CatalogUxCoverageTag = typeof CATALOG_UX_REQUIRED_COVERAGE[number] | "paper-doll" | "conventional";

export type CatalogUxVerificationCase = Readonly<{
    id: string;
    label: string;
    entryPath: string;
    architecture: "paper-doll" | "conventional";
    coverageTags: readonly CatalogUxCoverageTag[];
    expected: Readonly<{
        capacityMl?: number;
        neckThreadSize?: string;
        deliverySystem?: "Roll-On" | "Fine Mist Spray" | "Lotion Pump" | "Bottle Only";
        sellability: "checkout" | "quote" | "unavailable";
        compatibility: "exact" | "not-applicable" | "reject-incompatible";
        urlState: readonly string[];
    }>;
    manualChecks: Readonly<{
        desktop: readonly string[];
        mobile: readonly string[];
    }>;
}>;

function verificationCase(value: CatalogUxVerificationCase): CatalogUxVerificationCase {
    return Object.freeze({
        ...value,
        coverageTags: Object.freeze([...value.coverageTags]),
        expected: Object.freeze({ ...value.expected, urlState: Object.freeze([...value.expected.urlState]) }),
        manualChecks: Object.freeze({
            desktop: Object.freeze([...value.manualChecks.desktop]),
            mobile: Object.freeze([...value.manualChecks.mobile]),
        }),
    });
}

const SHARED_DESKTOP = Object.freeze(["No header clipping at 1440×1000; primary action, price, stock, and compatibility state remain visible."]);
const SHARED_MOBILE = Object.freeze(["At 390×844, controls remain at least 44px and content or purchase actions are not covered by the bottom navigation."]);

export const CATALOG_UX_CASES: readonly CatalogUxVerificationCase[] = Object.freeze([
    verificationCase({
        id: "cylinder-9ml-17-415-paper-doll",
        label: "Cylinder 9 mL · 17-415 golden Paper Doll platform",
        entryPath: "/products/cylinder-9ml-17-415?view=build",
        architecture: "paper-doll",
        coverageTags: ["cylinder", "paper-doll", "roll-on"],
        expected: { capacityMl: 9, neckThreadSize: "17-415", deliverySystem: "Roll-On", sellability: "checkout", compatibility: "exact", urlState: ["view=build remains explicit", "configuration SKU updates atomically"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Beauty and Build remain visible peers."], mobile: [...SHARED_MOBILE, "Layer switching does not move the purchase summary off-screen unexpectedly."] },
    }),
    verificationCase({
        id: "cylinder-9ml-13-415-conventional",
        label: "Cylinder 9 mL · 13-415 conventional roll-on platform",
        entryPath: "/products/cylinder-9ml-clear-13-415-rollon",
        architecture: "conventional",
        coverageTags: ["cylinder", "conventional", "roll-on"],
        expected: { capacityMl: 9, neckThreadSize: "13-415", deliverySystem: "Roll-On", sellability: "checkout", compatibility: "exact", urlState: ["never redirects into cylinder-9ml-17-415", "neck finish remains 13-415"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "No Paper Doll controls are shown."], mobile: [...SHARED_MOBILE, "The product name and neck finish distinguish this from 17-415."] },
    }),
    verificationCase({
        id: "boston-round-family",
        label: "Boston Round family browse and bottle selection",
        entryPath: "/catalog?families=Boston+Round",
        architecture: "conventional",
        coverageTags: ["boston-round", "conventional"],
        expected: { sellability: "checkout", compatibility: "exact", urlState: ["families=Boston Round survives refine and back navigation"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Family, capacity, color, and neck finish remain scannable."], mobile: [...SHARED_MOBILE, "Refine opens with the family constraint intact."] },
    }),
    verificationCase({
        id: "elegant-fine-mist",
        label: "Elegant family fine-mist selection",
        entryPath: "/catalog?families=Elegant&applicators=finemist",
        architecture: "conventional",
        coverageTags: ["elegant", "fine-mist", "conventional"],
        expected: { deliverySystem: "Fine Mist Spray", sellability: "checkout", compatibility: "exact", urlState: ["families=Elegant and applicators=finemist remain applied"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Result count matches the visible fine-mist assortment."], mobile: [...SHARED_MOBILE, "Applied filters are removable individually."] },
    }),
    verificationCase({
        id: "diva-family",
        label: "Diva family variation browse",
        entryPath: "/catalog?families=Diva",
        architecture: "conventional",
        coverageTags: ["diva", "conventional"],
        expected: { sellability: "checkout", compatibility: "exact", urlState: ["families=Diva remains authoritative"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Finish previews have unique accessible names."], mobile: [...SHARED_MOBILE, "Product-card media is compact without clipping the bottle."] },
    }),
    verificationCase({
        id: "empire-family",
        label: "Empire family variation browse",
        entryPath: "/catalog?families=Empire",
        architecture: "conventional",
        coverageTags: ["empire", "conventional"],
        expected: { sellability: "checkout", compatibility: "exact", urlState: ["families=Empire remains authoritative"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Variant preview updates do not change the intended PDP link."], mobile: [...SHARED_MOBILE, "Swatch row remains usable without accidental card navigation."] },
    }),
    verificationCase({
        id: "bottle-only",
        label: "Bottle-only product without an applicator",
        entryPath: "/catalog?category=Glass+Bottle",
        architecture: "conventional",
        coverageTags: ["bottle-only", "conventional"],
        expected: { deliverySystem: "Bottle Only", sellability: "checkout", compatibility: "not-applicable", urlState: ["selected bottle-only PDP remains canonical"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "The UI does not imply a closure is included."], mobile: [...SHARED_MOBILE, "Bottle-only status appears before purchase."] },
    }),
    verificationCase({
        id: "lotion-pump",
        label: "Lotion-pump compatible bottle",
        entryPath: "/catalog?applicators=lotionpump",
        architecture: "conventional",
        coverageTags: ["lotion-pump", "conventional"],
        expected: { deliverySystem: "Lotion Pump", sellability: "checkout", compatibility: "exact", urlState: ["applicators=lotionpump remains applied"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Compatible pump and neck finish agree."], mobile: [...SHARED_MOBILE, "Grace inherits the lotion-pump constraint."] },
    }),
    verificationCase({
        id: "quote-required",
        label: "Product requiring a B2B quote",
        entryPath: "/catalog",
        architecture: "conventional",
        coverageTags: ["quote-required", "conventional"],
        expected: { sellability: "quote", compatibility: "not-applicable", urlState: ["selected product identity passes to the quote request"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Request a quote replaces Add to cart without a dead end."], mobile: [...SHARED_MOBILE, "Quote CTA is reachable without excessive scrolling."] },
    }),
    verificationCase({
        id: "out-of-stock",
        label: "Out-of-stock product configuration",
        entryPath: "/catalog",
        architecture: "conventional",
        coverageTags: ["out-of-stock", "conventional"],
        expected: { sellability: "unavailable", compatibility: "not-applicable", urlState: ["selected unavailable SKU remains visible and is not substituted"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Unavailable state gives a quote or alternative path."], mobile: [...SHARED_MOBILE, "Disabled purchase state explains the next action."] },
    }),
    verificationCase({
        id: "incompatible-combination",
        label: "Rejected incompatible bottle and component combination",
        entryPath: "/catalog",
        architecture: "conventional",
        coverageTags: ["incompatible", "conventional"],
        expected: { sellability: "unavailable", compatibility: "reject-incompatible", urlState: ["original capacity and neck-finish constraints remain intact"] },
        manualChecks: { desktop: [...SHARED_DESKTOP, "Cart and Grace reject the mismatch with a specific reason."], mobile: [...SHARED_MOBILE, "Recovery suggestions never silently broaden neck finish or size."] },
    }),
]);

export function catalogUxCaseById(id: string): CatalogUxVerificationCase {
    const testCase = CATALOG_UX_CASES.find((candidate) => candidate.id === id);
    if (!testCase) throw new Error(`Unknown catalog UX verification case: ${id}`);
    return testCase;
}
