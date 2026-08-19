import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface TranscriptionResult {
  text: string;
  /** Audio duration in seconds — what Whisper actually bills on, not text length. */
  durationSeconds: number;
}

/**
 * Transcribes audio/video using OpenAI Whisper API.
 * Supports 90+ languages with automatic language detection.
 *
 * Max file size: 25MB (OpenAI limit)
 * Supported formats: mp4, mpeg, mpga, m4a, wav, webm, mp3
 *
 * `verbose_json` rather than plain `text`: Whisper bills per minute of audio,
 * not per character of output, so cost tracking needs the actual duration —
 * plain-text responses don't carry it.
 */
export async function transcribeAudio(
  file: File | Blob,
  filename?: string
): Promise<TranscriptionResult> {
  const transcription = await openai.audio.transcriptions.create({
    file: new File([file], filename || "video.mp4", { type: file.type || "video/mp4" }),
    model: "whisper-1",
    response_format: "verbose_json",
  });

  return { text: transcription.text, durationSeconds: transcription.duration };
}
