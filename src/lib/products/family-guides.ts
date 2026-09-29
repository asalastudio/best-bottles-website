import manifest from "./family-guides.json";

/**
 * Downloadable family compatibility guides (PDF), one per bottle family, plus the complete catalogue.
 *
 * The PDFs are built by `scripts/print/family_guides.py` from the Convex export and the component register,
 * uploaded to Vercel Blob by `scripts/print/upload_family_guides.mjs`, and listed in `family-guides.json`
 * by that upload. Keys are content-addressed, so a rebuilt guide gets a new URL and old links keep working.
 * A family with no entry shows no download link.
 */
export type FamilyGuide = {
    url: string;
    pages: number;
    bytes: number;
    updatedAt: string;
};

type FamilyGuideManifest = {
    generatedAt: string | null;
    source: string | null;
    catalogue: FamilyGuide | null;
    families: Record<string, FamilyGuide>;
};

const guides = manifest as FamilyGuideManifest;

export function familyGuide(familySlug: string): FamilyGuide | null {
    return guides.families[familySlug] ?? null;
}

export function catalogueGuide(): FamilyGuide | null {
    return guides.catalogue;
}

export function formatGuideSize(bytes: number): string {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
