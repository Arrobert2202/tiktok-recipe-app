import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Transcribes audio/video using OpenAI Whisper API.
 * Supports 90+ languages with automatic language detection.
 *
 * Max file size: 25MB (OpenAI limit)
 * Supported formats: mp4, mpeg, mpga, m4a, wav, webm, mp3
 */
export async function transcribeAudio(file: File | Blob, filename?: string): Promise<string> {
  const transcription = await openai.audio.transcriptions.create({
    file: new File([file], filename || "video.mp4", { type: file.type || "video/mp4" }),
    model: "whisper-1",
    response_format: "text",
  });

  return transcription;
}
