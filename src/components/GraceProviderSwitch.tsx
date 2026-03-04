"use client";

/**
 * GraceProviderSwitch — selects between ElevenLabs and OpenAI voice providers.
 *
 * Controlled via the NEXT_PUBLIC_GRACE_VOICE_PROVIDER env var:
 *   elevenlabs  → GraceElevenLabsProvider (new)
 *   openai      → GraceProvider (original)
 *
 * Defaults to "elevenlabs" if not set.
 */

import type { ReactNode } from "react";
import GraceElevenLabsProvider from "./GraceElevenLabsProvider";
import GraceProvider from "./GraceProvider";

interface Props {
    children: ReactNode;
}

export default function GraceProviderSwitch({ children }: Props) {
    const provider = process.env.NEXT_PUBLIC_GRACE_VOICE_PROVIDER ?? "elevenlabs";

    if (provider === "openai") {
        return <GraceProvider>{children}</GraceProvider>;
    }

    return <GraceElevenLabsProvider>{children}</GraceElevenLabsProvider>;
}
