/**
 * The shipping address a wholesale order is sent to.
 *
 * Deliberately not `server-only`: the same validator runs in the browser as
 * the customer types and on the server before anything reaches Shopify, and
 * two implementations of "is this address usable" would eventually disagree.
 */
export type PortalAddress = {
    contactName: string;
    company: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    provinceCode: string;
    zip: string;
    countryCode: string;
};

export const EMPTY_ADDRESS: PortalAddress = {
    contactName: "",
    company: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    provinceCode: "",
    zip: "",
    countryCode: "US",
};

export const ADDRESS_FIELD_LABELS: Record<keyof PortalAddress, string> = {
    contactName: "Contact name",
    company: "Company",
    phone: "Phone",
    address1: "Street address",
    address2: "Suite, unit, floor",
    city: "City",
    provinceCode: "State",
    zip: "ZIP code",
    countryCode: "Country",
};

/**
 * Every field a carrier needs to actually deliver a pallet, plus a phone —
 * freight carriers will not book a delivery appointment without one, so an
 * address without a phone is not a shippable address.
 */
const REQUIRED: Array<keyof PortalAddress> = [
    "contactName",
    "phone",
    "address1",
    "city",
    "provinceCode",
    "zip",
    "countryCode",
];

export type AddressErrors = Partial<Record<keyof PortalAddress, string>>;

function trimmed(address: Partial<PortalAddress> | null | undefined): PortalAddress {
    return {
        ...EMPTY_ADDRESS,
        ...address,
        contactName: (address?.contactName ?? "").trim(),
        company: (address?.company ?? "").trim(),
        phone: (address?.phone ?? "").trim(),
        address1: (address?.address1 ?? "").trim(),
        address2: (address?.address2 ?? "").trim(),
        city: (address?.city ?? "").trim(),
        provinceCode: (address?.provinceCode ?? "").trim().toUpperCase(),
        zip: (address?.zip ?? "").trim(),
        countryCode: ((address?.countryCode ?? "").trim() || "US").toUpperCase(),
    };
}

export function normalizeAddress(address: Partial<PortalAddress> | null | undefined): PortalAddress {
    return trimmed(address);
}

export function validateAddress(input: Partial<PortalAddress> | null | undefined): AddressErrors {
    const address = trimmed(input);
    const errors: AddressErrors = {};

    for (const field of REQUIRED) {
        if (!address[field]) errors[field] = `${ADDRESS_FIELD_LABELS[field]} is required.`;
    }

    // Only the shapes we can check without pretending to be a validation
    // service. A wrong-but-plausible ZIP is the carrier's problem to surface;
    // a two-digit one is ours.
    if (address.countryCode === "US") {
        if (address.provinceCode && !/^[A-Z]{2}$/.test(address.provinceCode)) {
            errors.provinceCode = "Use the two-letter state code, such as CA.";
        }
        if (address.zip && !/^\d{5}(-\d{4})?$/.test(address.zip)) {
            errors.zip = "Use a 5-digit ZIP, or ZIP+4.";
        }
    }

    // Enough digits to dial. Formatting varies too much to police further.
    if (address.phone && address.phone.replace(/\D/g, "").length < 10) {
        errors.phone = "Enter a phone number a carrier can call.";
    }

    return errors;
}

export function addressIsUsable(address: Partial<PortalAddress> | null | undefined): boolean {
    return Object.keys(validateAddress(address)).length === 0;
}

/** One-line rendering for summaries and confirmations. */
export function formatAddressLine(address: PortalAddress): string {
    return [
        address.address1,
        address.address2,
        address.city,
        [address.provinceCode, address.zip].filter(Boolean).join(" "),
        address.countryCode === "US" ? null : address.countryCode,
    ]
        .filter(Boolean)
        .join(", ");
}

/** Shopify's MailingAddressInput shape. */
export function toShopifyMailingAddress(address: PortalAddress) {
    const [firstName, ...rest] = address.contactName.split(/\s+/);
    return {
        firstName: firstName || address.contactName,
        lastName: rest.join(" ") || "",
        company: address.company || undefined,
        phone: address.phone || undefined,
        address1: address.address1,
        address2: address.address2 || undefined,
        city: address.city,
        provinceCode: address.provinceCode || undefined,
        zip: address.zip,
        countryCode: address.countryCode,
    };
}
