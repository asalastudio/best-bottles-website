export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const ACCEPTED_MIMES = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
]);

const ACCEPTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export const PRODUCT_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

function extensionOf(name: string) {
    const match = name.trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
    return match?.[1] ?? "";
}

/** Null when the file can be stored as product imagery; otherwise a staff-facing reason. */
export function validateProductImageFile(file: { name: string; type: string; size: number }): string | null {
    if (file.size <= 0) return "That file is empty. Choose a PNG, JPEG, or WebP.";
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) return "That image is over 8 MB. Use a smaller file.";
    const mime = file.type.toLowerCase();
    const extension = extensionOf(file.name);
    if (mime && !ACCEPTED_MIMES.has(mime)) {
        return "Use a PNG, JPEG, or WebP. Product photos cannot be SVG or PDF.";
    }
    if (!mime && !ACCEPTED_EXTENSIONS.has(extension)) {
        return "Use a PNG, JPEG, or WebP. Product photos cannot be SVG or PDF.";
    }
    return null;
}
