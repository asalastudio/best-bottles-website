/**
 * Speaker echo: Grace's TTS is picked up by the mic (phone speakerphone and
 * desktop Chrome speakers), semantic VAD treats it as a new customer turn,
 * and she answers herself until the session glitches.
 *
 * Mute the mic while she is speaking, keep it muted for a tail after audio
 * stops, clear the Realtime input buffer, cancel responses that start in
 * that tail, and ignore user transcripts that match her last utterance.
 *
 * Desktop speakers need a longer tail than a phone earpiece — 450ms let
 * room echo commit a turn after she finished.
 */

export const GRACE_VOICE_ECHO_TAIL_MS = 1200;

export const GRACE_VOICE_AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
} as const;

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

export function isVoiceEchoGuardActive(args: {
    now: number;
    assistantSpeaking: boolean;
    echoGuardUntil: number;
}): boolean {
    return args.assistantSpeaking || args.now < args.echoGuardUntil;
}

/** A new model response during the echo tail is Grace answering her own TTS. */
export function shouldCancelEchoGeneratedResponse(args: {
    now: number;
    assistantSpeaking: boolean;
    echoGuardUntil: number;
}): boolean {
    return !args.assistantSpeaking && args.now < args.echoGuardUntil;
}

export function shouldIgnoreVoiceUserTranscript(args: {
    now: number;
    assistantSpeaking: boolean;
    echoGuardUntil: number;
    transcript: string;
    lastAssistantText: string | null | undefined;
}): boolean {
    if (isVoiceEchoGuardActive(args)) return true;
    return isLikelyAssistantEcho(args.transcript, args.lastAssistantText);
}
