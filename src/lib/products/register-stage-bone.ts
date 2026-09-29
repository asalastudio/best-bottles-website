/** Registered body plates use measured boxes and clear glass baked on #F5F3EF. */
export function hasRegisterBodyPlate(
    parts: readonly { slot: string; box?: unknown }[] | null | undefined,
): boolean {
    return Boolean(parts?.some((part) => part.slot === "body" && part.box));
}
