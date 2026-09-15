import imageUrlBuilder from "@sanity/image-url";
import { client, isSanityConfigured } from "./client";

const builder = isSanityConfigured ? imageUrlBuilder(client) : null;

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
