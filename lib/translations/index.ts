import { nav } from "./nav";
import { footer } from "./footer";
import { landing } from "./landing";
import { home } from "./home";
import { paywall } from "./paywall";
import { cookbook } from "./cookbook";
import { editModal } from "./editModal";
import { account } from "./account";
import { shoppingList } from "./shoppingList";
import { recipeView } from "./recipeView";
import { creators } from "./creators";
import { settings } from "./settings";
import { recipeDetail } from "./recipeDetail";

export const TRANSLATIONS = {
  ...nav,
  ...footer,
  ...landing,
  ...home,
  ...paywall,
  ...cookbook,
  ...editModal,
  ...account,
  ...shoppingList,
  ...recipeView,
  ...creators,
  ...settings,
  ...recipeDetail,
};

export type TranslationKey = keyof typeof TRANSLATIONS;
