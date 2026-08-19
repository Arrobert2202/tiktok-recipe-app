import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transcribeAudio } from "@/lib/whisper";
import { hasCredits } from "@/lib/credits";
import { tryConsumeUserAction } from "@/lib/user-limit";

export const runtime = "nodejs";

export const maxDuration = 60;

// Vercel serverless functions cap request bodies at roughly 4.5MB regardless
// of next.config.ts's serverActions.bodySizeLimit, which only applies to
// Server Actions, not route handlers like this one. The previous 25MB check
// advertised a size the platform would already have rejected.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  // Auth check
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Credit + rate-limit gate. Every call here reaches Whisper and is billed
  // to us regardless of whether the caller ever submits the transcript for
  // extraction, so a credit check alone isn't enough — a user could still
  // call this in a loop as long as their balance stays positive. The credit
  // itself isn't spent here; submitTikTokUrl's upfront claim (step 5's
  // consolidation moved the video-upload path into the same job pipeline)
  // charges it, so this only rejects zero-balance users rather than
  // double-charging.
  if (!(await hasCredits(session.user.id))) {
    return NextResponse.json(
      { error: "You've used all your free recipes. Upgrade to Pro for unlimited extractions." },
      { status: 402 }
    );
  }

  if (!(await tryConsumeUserAction(session.user.id, "transcribe"))) {
    return NextResponse.json(
      { error: "Too many transcription attempts. Please wait a bit and try again." },
      { status: 429 }
    );
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

    // Validate file size
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 4MB." },
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
