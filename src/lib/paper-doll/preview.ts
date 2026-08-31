export function isPaperDollDraftPreviewAllowed({
    requested,
    draftModeEnabled,
    nodeEnv,
}: {
    requested: boolean;
    draftModeEnabled: boolean;
    nodeEnv: string | undefined;
}): boolean {
    return requested && (draftModeEnabled || nodeEnv === "development");
}

