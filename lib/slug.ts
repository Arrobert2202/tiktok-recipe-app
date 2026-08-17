import { customAlphabet } from "nanoid";

const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

export function generateSlug(): string {
  return generateId();
}
