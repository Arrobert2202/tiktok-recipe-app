/**
 * Shared between the client (lib/use-language.tsx, writes it) and the server
 * (lib/get-server-language.ts, reads it) so page <title>/description can
 * match the visitor's chosen language even though metadata renders before
 * any client JS runs.
 */
export const LANGUAGE_COOKIE_NAME = "recipe-language";
