import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transcribeAudio } from "@/lib/whisper";

export const runtime = "nodejs";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Auth check
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Validate file size (25MB max for Whisper)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 25MB." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedPrefixes = ["video/", "audio/"];
    if (!allowedPrefixes.some(prefix => file.type.startsWith(prefix))) {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload an MP4, WebM, or audio file." },
        { status: 400 }
      );
    }

    // Transcribe with Whisper
    const transcript = await transcribeAudio(file, file.name);

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 500 }
    );
  }
}
