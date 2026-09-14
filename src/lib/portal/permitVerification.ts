/**
 * Where a reviewer goes to check that a seller's permit is real.
 *
 * There is no nationwide permit-verification API. Sales tax is administered
 * state by state, and each state publishes its own lookup; the Streamlined
 * Sales Tax board covers a subset of states with one service, and commercial
 * products (Avalara CertCapture, Vertex, TaxJar) resell aggregated coverage.
 * Rather than imply a single source exists, this maps a state to the official
 * page a reviewer should open, so verification is one click from the queue
 * instead of a search.
 *
 * A state that is absent has no free public lookup we can link with
 * confidence — the reviewer is told that plainly rather than sent somewhere
 * that will not answer the question.
 */
const VERIFICATION_URLS: Record<string, { label: string; url: string }> = {
    CA: { label: "CDTFA permit verification", url: "https://onlineservices.cdtfa.ca.gov/_/#2" },
    TX: { label: "Texas Comptroller sales taxpayer search", url: "https://mycpa.cpa.state.tx.us/coa/" },
    NY: { label: "NY certificate of authority lookup", url: "https://www8.tax.ny.gov/AUTH/authHome" },
    FL: { label: "Florida annual resale certificate check", url: "https://floridarevenue.com/taxes/certificates" },
    IL: { label: "Illinois tax registration inquiry", url: "https://mytax.illinois.gov/_/" },
    PA: { label: "Pennsylvania e-TIDES / myPATH", url: "https://mypath.pa.gov/" },
    WA: { label: "Washington business lookup", url: "https://secure.dor.wa.gov/gteunauth/_/" },
    CO: { label: "Colorado license verification", url: "https://tax.colorado.gov/verify-a-license-or-certificate" },
    AZ: { label: "Arizona TPT license verification", url: "https://aztaxes.gov/Home/LicenseVerification" },
    GA: { label: "Georgia Tax Center registration search", url: "https://gtc.dor.ga.gov/_/" },
    NJ: { label: "NJ business registration verification", url: "https://www20.state.nj.us/TYTR_BRC/servlet/common/BRCLogin" },
    OH: { label: "Ohio vendor licence lookup", url: "https://thefinder.tax.ohio.gov/StreamlineSalesTaxWeb/Locations/Default.aspx" },
};

/**
 * Member states of the Streamlined Sales Tax Governing Board, which run one
 * shared registration service. Worth naming to a reviewer because a permit
 * from any of them can be checked in the same place.
 */
const SST_LOOKUP = {
    label: "Streamlined Sales Tax registration lookup",
    url: "https://www.streamlinedsalestax.org/certified-service-providers/registration-lookup",
};

const SST_STATES = new Set([
    "AR", "GA", "IN", "IA", "KS", "KY", "MI", "MN", "NE", "NV", "NJ", "NC",
    "ND", "OH", "OK", "RI", "SD", "TN", "UT", "VT", "WA", "WV", "WI", "WY",
]);

export type PermitVerificationLink = { label: string; url: string };

export function permitVerificationLinks(stateCode: string | null | undefined): PermitVerificationLink[] {
    const code = stateCode?.trim().toUpperCase() ?? "";
    const links: PermitVerificationLink[] = [];
    if (VERIFICATION_URLS[code]) links.push(VERIFICATION_URLS[code]);
    if (SST_STATES.has(code)) links.push(SST_LOOKUP);
    return links;
}
