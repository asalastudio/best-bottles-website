/**
 * Phone speakerphone echo: Grace's TTS is picked up by the mic, semantic VAD
 * treats it as a new customer turn, and she answers herself.
 *
 * Mute the mic while she is speaking, keep it muted for a short tail after
 * audio stops, and ignore user transcripts that match her last utterance.
 */

export const GRACE_VOICE_ECHO_TAIL_MS = 450;

export function normalizeGraceEchoText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function isLikelyAssistantEcho(
    userTranscript: string,
    lastAssistantText: string | null | undefined,
): boolean {
    if (!lastAssistantText) return false;
    const user = normalizeGraceEchoText(userTranscript);
    const assistant = normalizeGraceEchoText(lastAssistantText);
    if (user.length < 8 || assistant.length < 8) return false;
    if (user === assistant) return true;
    if (assistant.includes(user)) return true;
    if (user.includes(assistant) && assistant.length >= 16) return true;

    const userWords = user.split(" ").filter((word) => word.length > 2);
    const assistantWords = new Set(assistant.split(" ").filter((word) => word.length > 2));
    if (userWords.length < 4) return false;
    const overlap = userWords.filter((word) => assistantWords.has(word)).length;
    return overlap / userWords.length >= 0.7 && overlap >= 4;
}

export function shouldIgnoreVoiceUserTranscript(args: {
    now: number;
    assistantSpeaking: boolean;
    echoGuardUntil: number;
    transcript: string;
    lastAssistantText: string | null | undefined;
}): boolean {
    if (args.assistantSpeaking) return true;
    if (args.now < args.echoGuardUntil) return true;
    return isLikelyAssistantEcho(args.transcript, args.lastAssistantText);
}
