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

  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    currentStage: job.currentStage,
    resultRecipeId: job.resultRecipeId,
    error: job.error,
  });
}
