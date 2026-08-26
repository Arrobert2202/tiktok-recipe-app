import { nav } from "./nav";
import { footer } from "./footer";
import { landing } from "./landing";
import { home } from "./home";

export const TRANSLATIONS = {
  ...nav,
  ...footer,
  ...landing,
  ...home,
};

export type TranslationKey = keyof typeof TRANSLATIONS;
