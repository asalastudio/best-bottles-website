import { describe, expect, it } from "vitest";
import {
    isLikelyAssistantEcho,
    shouldIgnoreVoiceUserTranscript,
} from "../src/lib/grace/voiceEchoGuard";

describe("Grace voice echo guard", () => {
    it("treats a transcript of Grace's last utterance as echo", () => {
        expect(isLikelyAssistantEcho(
            "Want me to open the 28 milliliter bottle?",
            "Want me to open the 28 milliliter bottle?",
        )).toBe(true);
        expect(isLikelyAssistantEcho(
            "take us to the 28 ml bottle",
            "Want me to open the 28 milliliter bottle?",
        )).toBe(false);
    });

    it("ignores user audio while she is speaking and during the echo tail", () => {
        expect(shouldIgnoreVoiceUserTranscript({
            now: 1_000,
            assistantSpeaking: true,
            echoGuardUntil: 0,
            transcript: "hello",
            lastAssistantText: null,
        })).toBe(true);
        expect(shouldIgnoreVoiceUserTranscript({
            now: 1_200,
            assistantSpeaking: false,
            echoGuardUntil: 1_450,
            transcript: "hello there friend",
            lastAssistantText: "Want another size?",
        })).toBe(true);
        expect(shouldIgnoreVoiceUserTranscript({
            now: 2_000,
            assistantSpeaking: false,
            echoGuardUntil: 1_450,
            transcript: "Take us to the 28 ml bottle",
            lastAssistantText: "Want me to open the 28 milliliter bottle?",
        })).toBe(false);
    });
});
