import { ImageResponse } from "@vercel/og";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Ingredient } from "@/lib/types";

export const runtime = "edge";

const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 80;
const MAX_INGREDIENTS = 8;
const MAX_INGREDIENT_CHARS = 44;

const BACKGROUND = "#0a0a0f";
const PURPLE_GLOW =
  "radial-gradient(circle at 50% 50%, rgba(147, 51, 234, 0.45) 0%, rgba(147, 51, 234, 0.12) 45%, rgba(10, 10, 15, 0) 72%)";
const PINK_GLOW =
  "radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.38) 0%, rgba(236, 72, 153, 0.10) 45%, rgba(10, 10, 15, 0) 72%)";

/**
 * Story-shaped (1080x1920) recipe card, meant to be saved and posted to
 * Instagram / WhatsApp stories. Separate from the 1200x630 OG image, which
 * exists for link unfurls.
 *
 * Non-public recipes (creator opted out) are never renderable here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const [recipe] = await db
      .select({
        title: recipes.title,
        creatorHandle: recipes.creatorHandle,
        ingredients: recipes.ingredients,
        steps: recipes.steps,
        slug: recipes.slug,
        isPublic: recipes.isPublic,
      })
      .from(recipes)
      .where(eq(recipes.slug, slug));

    if (!recipe) {
      return new Response("Not found", { status: 404 });
    }

    // Opted-out creators' recipes must not be shareable as a card.
    if (!recipe.isPublic) {
      return new Response("Not found", { status: 404 });
    }

    const ingredients = (recipe.ingredients as Ingredient[] | null) ?? [];
    const steps = (recipe.steps as string[] | null) ?? [];
    const shown = ingredients.slice(0, MAX_INGREDIENTS);
    const remaining = ingredients.length - shown.length;

    return new ImageResponse(
      (
        <div
          style={{
            width: WIDTH,
            height: HEIGHT,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            backgroundColor: BACKGROUND,
          }}
        >
          {/* Soft glows — purple top-right, pink bottom-left */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: -360,
              right: -400,
              width: 1100,
              height: 1100,
              backgroundImage: PURPLE_GLOW,
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: -420,
              left: -420,
              width: 1100,
              height: 1100,
              backgroundImage: PINK_GLOW,
            }}
          />

          {/* Content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: WIDTH,
              height: HEIGHT,
              paddingTop: PADDING,
              paddingBottom: PADDING,
              paddingLeft: PADDING,
              paddingRight: PADDING,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 26,
                letterSpacing: 6,
                color: "rgba(255, 255, 255, 0.42)",
              }}
            >
              RECIPE BY
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 12,
                fontSize: 42,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.78)",
              }}
            >
              @{recipe.creatorHandle}
            </div>

            <div
              style={{
                display: "block",
                marginTop: 36,
                fontSize: 86,
                fontWeight: 700,
                lineHeight: 1.08,
                color: "#ffffff",
                textOverflow: "ellipsis",
                lineClamp: 3,
              }}
            >
              {recipe.title}
            </div>

            {/* Stat pills */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                marginTop: 52,
              }}
            >
              <StatPill label={countLabel(ingredients.length, "ingredient")} />
              <div style={{ display: "flex", marginLeft: 20 }}>
                <StatPill label={countLabel(steps.length, "step")} />
              </div>
            </div>

            {/* Ingredients */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 72,
              }}
            >
              {shown.map((ingredient, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 28,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      marginRight: 28,
                      backgroundColor: "#c084fc",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      fontSize: 36,
                      color: "rgba(255, 255, 255, 0.86)",
                    }}
                  >
                    {formatIngredient(ingredient)}
                  </div>
                </div>
              ))}

              {remaining > 0 && (
                <div
                  style={{
                    display: "flex",
                    marginTop: 8,
                    marginLeft: 42,
                    fontSize: 32,
                    color: "rgba(255, 255, 255, 0.38)",
                  }}
                >
                  + {remaining} more
                </div>
              )}
            </div>

            {/* Spacer pushes the footer to the bottom */}
            <div style={{ display: "flex", flexGrow: 1 }} />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: 44,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 34,
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.72)",
                }}
              >
                Full ingredients, steps &amp; cook mode
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  fontSize: 30,
                  color: "rgba(255, 255, 255, 0.38)",
                }}
              >
                Tap the link to open the recipe
              </div>
            </div>

            <div
              style={{
                display: "flex",
                width: WIDTH - PADDING * 2,
                height: 1,
                backgroundColor: "rgba(255, 255, 255, 0.10)",
                marginBottom: 36,
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: WIDTH - PADDING * 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    marginRight: 16,
                    backgroundColor: "#ec4899",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    fontSize: 38,
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  RecipeApp
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  color: "rgba(255, 255, 255, 0.45)",
                }}
              >
                {shareHost(request)}/r/{recipe.slug}
              </div>
            </div>
          </div>
        </div>
      ),
      { width: WIDTH, height: HEIGHT }
    );
  } catch {
    return fallbackCard();
  }
}

function StatPill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        paddingTop: 18,
        paddingBottom: 18,
        paddingLeft: 34,
        paddingRight: 34,
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "rgba(255, 255, 255, 0.14)",
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        fontSize: 32,
        color: "rgba(255, 255, 255, 0.82)",
      }}
    >
      {label}
    </div>
  );
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatIngredient(ingredient: Ingredient): string {
  const text = [ingredient.quantity, ingredient.unit, ingredient.name]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");

  if (text.length <= MAX_INGREDIENT_CHARS) return text;
  return `${text.slice(0, MAX_INGREDIENT_CHARS - 1).trimEnd()}…`;
}

/** Bare host (no protocol) for the footer URL. */
function shareHost(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const raw = configured && configured.length > 0 ? configured : request.url;

  try {
    return new URL(raw).host;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

/** Minimal branded card so a failure never surfaces as a raw 500. */
function fallbackCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BACKGROUND,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -360,
            right: -400,
            width: 1100,
            height: 1100,
            backgroundImage: PURPLE_GLOW,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          RecipeApp
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 32,
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          Recipe card unavailable
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}
