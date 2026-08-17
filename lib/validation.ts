export interface ValidationResult {
  valid: boolean;
  errors?: Record<string, string>;
}

export interface RecipeEditInput {
  title: string;
  ingredients: { name: string; quantity?: string; unit?: string }[];
  steps: string[];
}

/**
 * Validates a single tag string (1-50 characters).
 */
export function validateTag(tag: string): boolean {
  return tag.length >= 1 && tag.length <= 50;
}

/**
 * Validates a set of tags including individual tag length and total count.
 * @param tags - Array of tag strings to validate
 * @param existingTagCount - Number of tags already on the recipe (default 0)
 */
export function validateTags(
  tags: string[],
  existingTagCount: number = 0
): ValidationResult {
  const errors: Record<string, string> = {};

  const totalCount = existingTagCount + tags.length;
  if (totalCount > 20) {
    errors.tags = `A recipe may have at most 20 tags (currently ${existingTagCount}, adding ${tags.length})`;
  }

  for (let i = 0; i < tags.length; i++) {
    if (!validateTag(tags[i])) {
      errors[`tags[${i}]`] = `Tag must be between 1 and 50 characters`;
    }
  }

  return Object.keys(errors).length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Validates a TikTok handle: alphanumeric characters and underscores, 1-24 characters.
 */
export function validateTikTokHandle(handle: string): boolean {
  return /^[a-zA-Z0-9_]{1,24}$/.test(handle);
}

/**
 * Validates recipe edit input:
 * - Title must be non-empty and at most 200 characters
 * - At least one ingredient with a non-empty name
 * - At least one non-empty step
 */
export function validateRecipeEdit(data: RecipeEditInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.title || data.title.trim().length === 0) {
    errors.title = "Title is required";
  } else if (data.title.length > 200) {
    errors.title = "Title must be at most 200 characters";
  }

  if (!data.ingredients || data.ingredients.length === 0) {
    errors.ingredients = "At least one ingredient is required";
  } else {
    const hasValidIngredient = data.ingredients.some(
      (ing) => ing.name && ing.name.trim().length > 0
    );
    if (!hasValidIngredient) {
      errors.ingredients =
        "At least one ingredient must have a non-empty name";
    }
  }

  if (!data.steps || data.steps.length === 0) {
    errors.steps = "At least one step is required";
  } else {
    const hasValidStep = data.steps.some(
      (step) => step && step.trim().length > 0
    );
    if (!hasValidStep) {
      errors.steps = "At least one step must be non-empty";
    }
  }

  return Object.keys(errors).length === 0
    ? { valid: true }
    : { valid: false, errors };
}
