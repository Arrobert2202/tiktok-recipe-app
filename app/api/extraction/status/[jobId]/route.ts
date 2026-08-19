import { NextResponse } from "next/server";
import { db } from "@/db";
import { extractionJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  const [job] = await db
    .select()
    .from(extractionJobs)
    .where(eq(extractionJobs.id, jobId));

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Any authenticated user may poll any job — not just its owner. Dedupe
  // (submitTikTokUrl step 8) deliberately hands out an in-progress job's ID
  // to any requester of the same canonical URL, the same way a recipe_cache
  // hit already gives out a completed extraction for free; restricting this
  // route to the original owner turned that into a permanent 404 for
  // everyone else instead. Nothing in the base response is sensitive — no
  // URL, no other user's identity — but `error` is raw exception text from
  // yt-dlp/Whisper/OpenAI/DB failures, which is fine to show the owner (the
  // UI already renders it) and not fine to broadcast to a stranger who
  // happened to dedupe into the same in-flight job.
  const isOwner = job.userId === session.user.id;

  return NextResponse.json({
    status: job.status,
    currentStage: job.currentStage,
    resultRecipeId: job.resultRecipeId,
    error: isOwner ? job.error : job.error && { code: job.error.code },
  });
}
