import imageUrlBuilder from "@sanity/image-url";

// Built from the public project id and dataset, not from the API client: the
// client (with its transport, rxjs and a Buffer polyfill, ~37 KB gzip) was
// reaching the browser bundle of every page through the Navbar and homepage
// image helpers, although only server code fetches from Sanity.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const builder = projectId && projectId.length > 0 ? imageUrlBuilder({ projectId, dataset }) : null;

export function urlFor(source: { asset?: { _ref: string }; _type?: string } | null | undefined): string {
    if (!source?.asset?._ref || !builder) return "";
    return builder.image(source).url();
}

/** Resize through Sanity's builder so the stored crop and hotspot are honored. */
export function editorialImageUrl(source: { asset?: { _ref: string } } | undefined, width: number, height?: number): string | undefined {
    if (!source?.asset?._ref || !builder) return undefined;
    let image = builder.image(source).width(width).auto('format');
    if (height) image = image.height(height).fit('crop');
    return image.url();
}
