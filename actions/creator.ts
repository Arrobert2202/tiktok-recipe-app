"use server";

import { validateTikTokHandle } from "@/lib/validation";

export interface OptOutResult {
  success: boolean;
  error?: string;
}

/**
 * Submit a creator opt-out request.
 * MVP: Directly records the opt-out without email verification.
 * Full implementation (task 13.2) will add DB persistence and cache invalidation.
 */
export async function submitOptOutRequest(
  handle: string,
  email: string
): Promise<OptOutResult> {
  // Validate handle format
  if (!validateTikTokHandle(handle)) {
    return {
      success: false,
      error:
        "Invalid TikTok handle. Must be 1-24 characters using only letters, numbers, and underscores.",
    };
  }

  // Validate email format (basic check)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      error: "Please enter a valid email address.",
    };
  }

  // TODO (task 13.2): Insert into creatorOptOuts table, set recipes.is_public = false,
  // delete recipeCache entries, invalidate opt-out cache
  return { success: true };
}

/**
 * Reverse a creator opt-out.
 * MVP: Stub that validates inputs.
 * Full implementation (task 13.2) will update DB records and restore public recipes.
 */
export async function reverseOptOut(
  handle: string,
  email: string
): Promise<OptOutResult> {
  // Validate handle format
  if (!validateTikTokHandle(handle)) {
    return {
      success: false,
      error:
        "Invalid TikTok handle. Must be 1-24 characters using only letters, numbers, and underscores.",
    };
  }

  // Validate email format (basic check)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      error: "Please enter a valid email address.",
    };
  }

  // TODO (task 13.2): Set reversed_at on creatorOptOuts record,
  // restore is_public = true on affected recipes
  return { success: true };
}
