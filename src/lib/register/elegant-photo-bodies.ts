/**
 * Photographed bare-glass layers from the published Elegant SKU kits. Their
 * native alpha bounds were recorded from productKits.forSkus on 2026-09-27.
 * Keep one photo body per size and glass while the register's newer body art
 * awaits visual approval. Component geometry remains register-owned.
 */
export const ELEGANT_PHOTO_BODIES: Readonly<Record<string, {
    url: string;
    width: number;
    height: number;
    bounds: { left: number; top: number; right: number; bottom: number };
}>> = {
    "elegant-60ml-18-415|Clear": {
        url: "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/kits/master-parts/58165fd317cadaaed55186664e754056328839abd9cf229b479434412b052773.body.webp",
        width: 1000, height: 1100, bounds: { left: 253, top: 278, right: 767, bottom: 1060 },
    },
    "elegant-60ml-18-415|Frosted": {
        url: "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/kits/master-parts/3a4f9d550fc893d4d2612937a5f1f32d00edb6df8017ffadd8e8cdd5034fc8a4.body.webp",
        width: 1000, height: 1100, bounds: { left: 267, top: 299, right: 742, bottom: 1059 },
    },
    "elegant-100ml-18-415|Clear": {
        url: "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/kits/master-parts/58f6e698476afe4a7184805b98462d6bcc5025a8aece80e5283be2c56afeb671.body.webp",
        width: 1000, height: 1100, bounds: { left: 268, top: 238, right: 741, bottom: 1057 },
    },
    "elegant-100ml-18-415|Frosted": {
        url: "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/kits/master-parts/4575009281fe4753630a916e046781e98fc8a5b1e69a91d3996054083408cd65.body.webp",
        width: 1000, height: 1100, bounds: { left: 326, top: 285, right: 682, bottom: 919 },
    },
};
