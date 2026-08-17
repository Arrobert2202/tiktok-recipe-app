import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  varchar,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Ingredient, StrategyAttempt, ExtractionError } from "@/lib/types";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Better-Auth manages this
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  credits: integer("credits").notNull().default(3), // 3 free extractions
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Better-Auth Sessions ────────────────────────────────────────────────────
export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

// ─── Better-Auth Accounts ────────────────────────────────────────────────────
export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Better-Auth Verifications ───────────────────────────────────────────────
export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ─── Recipes ─────────────────────────────────────────────────────────────────
export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 21 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    ingredients: jsonb("ingredients").notNull().$type<Ingredient[]>(),
    steps: jsonb("steps").notNull().$type<string[]>(),
    tipsAndTricks: jsonb("tips_and_tricks").$type<string[]>(),
    sourceUrl: text("source_url").notNull(),
    creatorHandle: varchar("creator_handle", { length: 24 }).notNull(),
    creatorDisplayName: text("creator_display_name"),
    creatorProfileUrl: text("creator_profile_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    extractionStrategy: varchar("extraction_strategy", { length: 20 }).notNull(),
    extractionDurationMs: integer("extraction_duration_ms").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_recipes_slug").on(table.slug),
    index("idx_recipes_source_url").on(table.sourceUrl),
    index("idx_recipes_creator_handle").on(table.creatorHandle),
  ]
);

// ─── Cookbook (User-Recipe junction) ─────────────────────────────────────────
export const cookbookEntries = pgTable(
  "cookbook_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tags: jsonb("tags").notNull().default([]).$type<string[]>(),
    savedAt: timestamp("saved_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_cookbook_user").on(table.userId),
    uniqueIndex("idx_cookbook_user_recipe").on(table.userId, table.recipeId),
  ]
);

// ─── Extraction Jobs ─────────────────────────────────────────────────────────
export const extractionJobs = pgTable(
  "extraction_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cascades on user delete, matching every other user-owned table. Without
    // this, a DELETE on users fails with a foreign key violation as soon as the
    // user has run a single extraction, which blocks account deletion entirely.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    currentStage: varchar("current_stage", { length: 20 }),
    strategiesAttempted: jsonb("strategies_attempted")
      .default([])
      .$type<StrategyAttempt[]>(),
    resultRecipeId: uuid("result_recipe_id").references(() => recipes.id),
    error: jsonb("error").$type<ExtractionError>(),
    // One-shot claim flag for the failure refund. The credit is spent upfront in
    // submitTikTokUrl (so concurrent jobs can't bypass the limit), and given back
    // if the job fails. Trigger.dev may run a failure path more than once —
    // retries, redeploys, manual replays — so the refund is gated on a conditional
    // UPDATE ... WHERE credit_refunded = false. The database picks the single
    // winner; only that caller issues the refund.
    creditRefunded: boolean("credit_refunded").notNull().default(false),
    triggerJobId: text("trigger_job_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_jobs_canonical_url").on(table.canonicalUrl),
    index("idx_jobs_user").on(table.userId),
    index("idx_jobs_status").on(table.status),
  ]
);

// ─── Recipe Cache ────────────────────────────────────────────────────────────
export const recipeCache = pgTable("recipe_cache", {
  canonicalUrl: text("canonical_url").primaryKey(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Anonymous Extractions (rate limiting) ───────────────────────────────────
// Tracks anonymous "try one free" extractions for abuse prevention.
// Stores a salted SHA-256 hash of the client IP, never the raw address.
export const anonymousExtractions = pgTable(
  "anonymous_extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_anon_ip_created").on(table.ipHash, table.createdAt)]
);

// ─── User Action Rate Limits ──────────────────────────────────────────────────
// Per-user rate limiting for authenticated actions/routes that cost money
// (extraction submissions, transcription), mirroring anonymous_extractions'
// shape: one row per attempt, windowed by createdAt, counted rather than
// aggregated so the check stays a simple range query.
export const userActionLimits = pgTable(
  "user_action_limits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 30 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_action_limits_lookup").on(
      table.userId,
      table.action,
      table.createdAt
    ),
  ]
);

// ─── Creator Opt-Out ─────────────────────────────────────────────────────────
export const creatorOptOuts = pgTable(
  "creator_opt_outs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: varchar("handle", { length: 24 }).notNull().unique(),
    email: text("email").notNull(),
    verifiedAt: timestamp("verified_at"),
    optedOutAt: timestamp("opted_out_at").notNull().defaultNow(),
    reversedAt: timestamp("reversed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_optout_handle").on(table.handle)]
);
