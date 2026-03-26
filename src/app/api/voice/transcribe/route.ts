import { NextRequest } from "next/server";

type ElevenLabsTranscriptResponse =
  | {
      text?: string;
      transcripts?: Array<{ text?: string }>;
    }
  | null;

function getTranscriptText(payload: ElevenLabsTranscriptResponse): string {
  if (!payload) return "";
  if (typeof payload.text === "string") return payload.text.trim();
  if (Array.isArray(payload.transcripts)) {
    return payload.transcripts
      .map((entry) => entry.text?.trim() || "")
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

export async function POST(req: NextRequest) {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsKey) {
    return Response.json(
      { error: "Voice search is not configured on the server." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return Response.json({ error: "Missing audio upload." }, { status: 400 });
  }

  if (audio.size === 0) {
    return Response.json({ error: "Audio upload was empty." }, { status: 400 });
  }

  const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10 MB
  if (audio.size > MAX_AUDIO_SIZE) {
    return Response.json({ error: "Audio file too large (max 10 MB)." }, { status: 400 });
  }

  const allowedTypes = ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/mp4"];
  if (audio.type && !allowedTypes.includes(audio.type)) {
    return Response.json({ error: "Unsupported audio format." }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("model_id", "scribe_v2");
  upstreamForm.append("language_code", "en");
  upstreamForm.append("tag_audio_events", "false");
  upstreamForm.append("file", audio, audio.name || "recording.webm");

  const upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": elevenLabsKey,
    },
    body: upstreamForm,
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[voice/transcribe] ElevenLabs STT error:", upstream.status, detail);
    return Response.json(
      { error: "Voice search transcription failed." },
      { status: 502 }
    );
  }

  const payload = (await upstream.json()) as ElevenLabsTranscriptResponse;
  const text = getTranscriptText(payload);

  return Response.json({ text });
}
