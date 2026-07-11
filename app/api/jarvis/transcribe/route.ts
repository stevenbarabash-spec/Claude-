// Voice → text via OpenAI Whisper. The Jarvis panel records with MediaRecorder
// and posts audio here; browsers with the Web Speech API skip this entirely.
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Transcription needs OPENAI_API_KEY (Whisper). Your browser's speech recognition is used when available." },
      { status: 400 },
    );
  }
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }
  const upstream = new FormData();
  // Keep the correct MIME type — Whisper mis-handles mislabeled containers (guide §8).
  upstream.append("file", file, "capture.webm");
  upstream.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: upstream,
  });
  if (!res.ok) {
    return NextResponse.json({ error: `whisper failed: ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json({ text: data.text ?? "" });
}
