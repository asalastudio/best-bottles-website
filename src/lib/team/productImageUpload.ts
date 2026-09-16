import { PAPER_DOLL_CANVAS } from "@/lib/paper-doll/contract";

export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Same portrait frame the PDP gallery and paper-doll canvas use (2080÷2288). */
export const PRODUCT_IMAGE_ASPECT_WIDTH = 10;
export const PRODUCT_IMAGE_ASPECT_HEIGHT = 11;

export const PRODUCT_IMAGE_PREFERRED_WIDTH = PAPER_DOLL_CANVAS.width;
export const PRODUCT_IMAGE_PREFERRED_HEIGHT = PAPER_DOLL_CANVAS.height;

const ACCEPTED_MIMES = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
]);

const ACCEPTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export const PRODUCT_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

export const PRODUCT_IMAGE_SPEC = {
    aspectLabel: `${PRODUCT_IMAGE_ASPECT_WIDTH}:${PRODUCT_IMAGE_ASPECT_HEIGHT} portrait`,
    preferredPixels: `${PRODUCT_IMAGE_PREFERRED_WIDTH}×${PRODUCT_IMAGE_PREFERRED_HEIGHT}`,
    maxFileLabel: "8 MB",
    formatsLabel: "PNG, JPEG, or WebP",
} as const;

export const PRODUCT_IMAGE_SPEC_SUMMARY =
    `Preferred ${PRODUCT_IMAGE_SPEC.aspectLabel} · ${PRODUCT_IMAGE_SPEC.preferredPixels} · ${PRODUCT_IMAGE_SPEC.maxFileLabel} max`;

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

const ASPECT_TOLERANCE = 0.03;
const MIN_SHARP_WIDTH = 1000;
const MIN_SHARP_HEIGHT = 1100;

/** Soft guidance for operators. Never blocks an upload — the PDP will letterbox a mismatch. */
export function assessProductImageDimensions(width: number, height: number): string | null {
    if (width <= 0 || height <= 0) return null;
    const expected = PRODUCT_IMAGE_ASPECT_WIDTH / PRODUCT_IMAGE_ASPECT_HEIGHT;
    const actual = width / height;
    if (Math.abs(actual - expected) > ASPECT_TOLERANCE) {
        return `This file is ${width}×${height}. The product page uses a ${PRODUCT_IMAGE_SPEC.aspectLabel} frame (${PRODUCT_IMAGE_SPEC.preferredPixels}). It will still save, but it will letterbox on the PDP.`;
    }
    if (width < MIN_SHARP_WIDTH || height < MIN_SHARP_HEIGHT) {
        return `This file is ${width}×${height}. Prefer ${PRODUCT_IMAGE_SPEC.preferredPixels} so the product page stays sharp.`;
    }
    return null;
}
