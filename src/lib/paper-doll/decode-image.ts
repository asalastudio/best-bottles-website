/**
 * Resolve once the bytes are ready to paint. A cached part resolves immediately,
 * which is why swapping a cap costs one frame and not a fade. Shared by the
 * desktop configurator stage and the mobile hero so both stack the same kit
 * the same way.
 */
export function decodeImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => (img.decode ? img.decode().then(() => resolve(), () => resolve()) : resolve());
        img.onerror = () => reject(new Error(url));
        img.src = url;
    });
}
