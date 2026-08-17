import { ImageResponse } from "@vercel/og";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const [recipe] = await db
      .select({ title: recipes.title })
      .from(recipes)
      .where(eq(recipes.slug, slug));

    if (!recipe) {
      return new Response("Not found", { status: 404 });
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            padding: 60,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
              maxWidth: 1000,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {recipe.title}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.8)",
              marginTop: 20,
            }}
          >
            Extracted from TikTok &bull; RecipeApp
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    // Generic fallback on generation error
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            padding: 60,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
            }}
          >
            Recipe
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.8)",
              marginTop: 20,
            }}
          >
            Extracted from TikTok &bull; RecipeApp
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
