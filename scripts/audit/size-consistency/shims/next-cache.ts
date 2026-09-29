// Audit shim: run the site's cached loaders uncached outside Next.
export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T { return fn; }
export function revalidateTag(): void {}
export function revalidatePath(): void {}
