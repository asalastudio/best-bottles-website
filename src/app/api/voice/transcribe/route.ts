import { NextRequest } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";

type OpenAITranscriptResponse = { text?: string } | null;

export async function POST(req: NextRequest) {
  const rateLimited = await enforceGraceRateLimit(req, { route: "voice-transcribe", limit: 12, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
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
  upstreamForm.append("model", "gpt-4o-mini-transcribe");
  upstreamForm.append("language", "en");
  upstreamForm.append("file", audio, audio.name || "recording.webm");

  const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
    body: upstreamForm,
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[voice/transcribe] OpenAI STT error:", upstream.status, detail);
    return Response.json(
      { error: "Voice search transcription failed." },
      { status: 502 }
    );
  }

  const payload = (await upstream.json()) as OpenAITranscriptResponse;
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";

  return Response.json({ text });
}
