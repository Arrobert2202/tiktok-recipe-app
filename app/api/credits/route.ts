import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserCredits } from "@/lib/credits";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credits = await getUserCredits(session.user.id);
  return NextResponse.json({ credits });
}
