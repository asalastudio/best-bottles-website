/**
 * The facts the item-description composer is allowed to say about a family
 * and about each fitment. Every line here is something the catalogue, the
 * legacy site, or the configurator registry states outright; nothing is a
 * flourish. When a family has no verified shape, it gets no shape adjective.
 *
 * Voice: the Scientists squad (Ogilvy specificity, Hopkins reason-why). No
 * superlatives, no exclamation points, no em dashes.
 */

export type FamilyDescriptor = {
    /** Noun phrase for the glass itself, used after "a 9 ml cobalt blue glass ..." */
    noun: string;
    /** One verified fact about the form, as a clause that can stand alone. Null when unverified. */
    shape: string | null;
};

const FAMILY_DESCRIPTORS: Record<string, FamilyDescriptor> = {
    // registry body: Cyl-round
    Cylinder: { noun: "cylinder", shape: "Straight sides, so a label wraps square." },
    // registry body: Circle-disc
    Circle: { noun: "Circle bottle", shape: "A flattened disc body that stands on a narrow edge." },
    // registry body: Round-sphere
    Round: { noun: "Round bottle", shape: "A spherical body under a short neck." },
    // registry body: Elegant-oval
    Elegant: { noun: "Elegant bottle", shape: "An oval body, wider than it is deep." },
    "Boston Round": { noun: "Boston Round", shape: "The round-shouldered apothecary form." },
    Diamond: { noun: "Diamond bottle", shape: "Faceted glass that throws light from every plane." },
    Rectangle: { noun: "rectangular bottle", shape: null },
    Square: { noun: "Square bottle", shape: "A square body with flat faces on all four sides." },
    Teardrop: { noun: "Teardrop bottle", shape: "A teardrop body that tapers from a round base to the neck." },
    Tulip: { noun: "Tulip bottle", shape: null },
    Bell: { noun: "Bell bottle", shape: null },
    Pillar: { noun: "Pillar bottle", shape: null },
    Royal: { noun: "Royal bottle", shape: null },
    Flair: { noun: "Flair bottle", shape: null },
    Sleek: { noun: "Sleek bottle", shape: null },
    Slim: { noun: "Slim bottle", shape: null },
    Diva: { noun: "Diva bottle", shape: null },
    Empire: { noun: "Empire bottle", shape: null },
    Grace: { noun: "Grace bottle", shape: null },
    Vial: { noun: "vial", shape: null },
    Apothecary: { noun: "apothecary bottle", shape: null },
    Atomizer: { noun: "atomizer", shape: null },
    Decorative: { noun: "bottle", shape: null },
    "Cream Jar": { noun: "cream jar", shape: "A wide mouth for fingers or a spatula." },
    "Lotion Bottle": { noun: "lotion bottle", shape: null },
    "Plastic Bottle": { noun: "plastic bottle", shape: null },
    "Aluminum Bottle": { noun: "aluminum bottle", shape: "An aluminum cylinder; lighter than glass and it does not break." },
};

export function familyDescriptor(family: string | null | undefined): FamilyDescriptor {
    if (family && FAMILY_DESCRIPTORS[family]) return FAMILY_DESCRIPTORS[family];
    return { noun: "bottle", shape: null };
}

/**
 * Fitment language. `phrase` completes "fitted with ..."; `mechanism` is the
 * one reason-why sentence about how the fitment works. `{finish}` is the
 * collar or cap finish when the SKU carries one, `{neck}` the thread.
 */
export type FitmentVoice = {
    phrase: string;
    mechanism: string | null;
};

export const FITMENT_VOICE: Record<string, FitmentVoice> = {
    "Metal Roller Ball": {
        phrase: "a steel roller ball",
        mechanism: "The steel ball lays oil down in a thin, even line and feels cool against the skin.",
    },
    "Plastic Roller Ball": {
        phrase: "a plastic roller ball",
        mechanism: "The plastic ball rolls the same thin line as steel and weighs less.",
    },
    "Fine Mist Sprayer": {
        phrase: "a fine-mist sprayer",
        mechanism: "A fine-mist pump breaks a thin liquid into a light, even spray.",
    },
    "Perfume Spray Pump": {
        phrase: "a perfume spray pump",
        mechanism: "The pump meters one measured dose per press.",
    },
    "Lotion Pump": {
        phrase: "a lotion pump",
        mechanism: "A lotion pump moves the thicker liquids a sprayer cannot: serums, creams, lotions and oils.",
    },
    Dropper: {
        phrase: "a glass pipette dropper",
        mechanism: "Squeeze the bulb, draw a measured dose, and release it one drop at a time.",
    },
    Reducer: {
        phrase: "an orifice reducer",
        mechanism: "The reducer narrows the opening so the bottle pours a splash-on dose instead of a stream.",
    },
    "Vintage Bulb Sprayer": {
        phrase: "a vintage-style bulb sprayer",
        mechanism: "Squeeze the bulb to spray; it is a working part and the bottle's ornament.",
    },
    "Vintage Bulb Sprayer with Tassel": {
        phrase: "a vintage-style bulb sprayer with tassel",
        mechanism: "Squeeze the bulb to spray; the bulb and tassel are working parts and the bottle's ornament.",
    },
    "Antique Bulb Sprayer": {
        phrase: "a vintage-style bulb sprayer",
        mechanism: "Squeeze the bulb to spray; it is a working part and the bottle's ornament.",
    },
    "Antique Bulb Sprayer with Tassel": {
        phrase: "a vintage-style bulb sprayer with tassel",
        mechanism: "Squeeze the bulb to spray; the bulb and tassel are working parts and the bottle's ornament.",
    },
    "Glass Stopper": {
        phrase: "a ground-glass stopper",
        mechanism: "The stopper seats by friction and is not leak-proof, so this is a bottle for the dressing table, not the suitcase.",
    },
    "Glass Rod": {
        phrase: "a cap with a glass dab-on rod",
        mechanism: "Dab straight from the rod; the cap seals the neck between uses.",
    },
    "Applicator Cap": {
        phrase: "a cap with a glass dab-on rod",
        mechanism: "Dab straight from the rod; the cap seals the neck between uses.",
    },
    Atomizer: {
        phrase: "a refillable metal-shell atomizer",
        mechanism: null,
    },
    "Metal Atomizer": {
        phrase: "a refillable metal-shell atomizer",
        mechanism: null,
    },
};

/** Screw caps have no fitment; the composer writes the cap itself and the neck's options. */
export const CAP_ONLY_APPLICATORS = new Set<string>(["Cap/Closure", "N/A"]);

/** Customer-facing name of a fitment for lists ("roll-on, fine-mist sprayer, lotion pump"). */
export const FITMENT_LIST_NAMES: Record<string, string> = {
    "Metal Roller Ball": "roll-on",
    "Plastic Roller Ball": "roll-on",
    "Fine Mist Sprayer": "fine-mist sprayer",
    "Perfume Spray Pump": "perfume spray pump",
    "Lotion Pump": "lotion pump",
    Dropper: "dropper",
    Reducer: "reducer",
    "Vintage Bulb Sprayer": "vintage-style bulb sprayer",
    "Vintage Bulb Sprayer with Tassel": "vintage-style bulb sprayer",
    "Antique Bulb Sprayer": "vintage-style bulb sprayer",
    "Antique Bulb Sprayer with Tassel": "vintage-style bulb sprayer",
    "Glass Stopper": "glass stopper",
    "Glass Rod": "glass rod cap",
    "Applicator Cap": "glass rod cap",
};

/**
 * Use lists the legacy site never carried but the fitment implies. Only used
 * when a SKU's legacy description has no "For use with" sentence at all.
 */
export const DEFAULT_USES_BY_APPLICATOR: Record<string, string[]> = {
    "Metal Roller Ball": ["perfume or fragrance oil", "essential oils", "aromatic oils", "aromatherapy"],
    "Plastic Roller Ball": ["perfume or fragrance oil", "essential oils", "aromatic oils", "aromatherapy"],
    "Fine Mist Sprayer": ["cologne", "eau de parfum", "air freshener", "face and body spray", "room spray"],
    "Perfume Spray Pump": ["cologne", "eau de parfum", "air freshener", "face and body spray", "room spray"],
    "Lotion Pump": ["serums", "light creams", "moisturizers", "facial oils", "beard oil", "body lotions"],
    Dropper: ["perfume oils", "diffuser oil", "serums", "facial oils", "beard oil"],
    Reducer: ["cologne", "aftershave", "splash-on", "perfume or fragrance oil", "beard oil"],
    "Vintage Bulb Sprayer": ["cologne", "eau de parfum", "perfume"],
    "Vintage Bulb Sprayer with Tassel": ["cologne", "eau de parfum", "perfume"],
    "Antique Bulb Sprayer": ["cologne", "eau de parfum", "perfume"],
    "Antique Bulb Sprayer with Tassel": ["cologne", "eau de parfum", "perfume"],
    "Glass Stopper": ["perfume or fragrance oil", "essential oil", "aromatherapy"],
    "Glass Rod": ["perfume or fragrance oil", "essential oils", "aromatic oils"],
    "Applicator Cap": ["perfume or fragrance oil", "essential oils", "aromatic oils"],
    Atomizer: ["perfume", "cologne", "eau de parfum"],
    "Metal Atomizer": ["perfume", "cologne", "eau de parfum"],
};
