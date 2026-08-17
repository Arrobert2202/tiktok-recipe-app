/**
 * Shopping list generation: merge ingredients from multiple recipes into a
 * consolidated, deduplicated list grouped by supermarket section.
 *
 * Everything in this module is a pure function — no DB access, no network,
 * no LLM calls. Categorization is keyword based so it is free and instant.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShoppingCategory =
  | "produce"
  | "meat_seafood"
  | "dairy_eggs"
  | "bakery"
  | "pantry"
  | "spices"
  | "frozen"
  | "other";

export interface ShoppingListItem {
  name: string;
  quantities: string[]; // e.g. ["200 g", "1 cup"] when units differ and can't merge
  merged: string; // display string, e.g. "500 g" or "200 g + 1 cup"
  category: ShoppingCategory;
  recipeTitles: string[]; // which recipes contributed this item
  checked: boolean;
}

/**
 * Loose ingredient shape. `quantity` / `unit` are optional here so the DB row
 * type (`CookbookEntry["ingredients"]`) and the strict `Ingredient` type from
 * `lib/types.ts` are both accepted.
 */
export interface ShoppingListIngredient {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface ShoppingListRecipe {
  title: string;
  ingredients: ShoppingListIngredient[];
}

export const CATEGORY_LABELS: Record<
  ShoppingCategory,
  { label: string; emoji: string }
> = {
  produce: { label: "Produce", emoji: "🥬" },
  meat_seafood: { label: "Meat & Seafood", emoji: "🥩" },
  dairy_eggs: { label: "Dairy & Eggs", emoji: "🥛" },
  bakery: { label: "Bakery", emoji: "🍞" },
  pantry: { label: "Pantry", emoji: "🥫" },
  spices: { label: "Spices", emoji: "🧂" },
  frozen: { label: "Frozen", emoji: "🧊" },
  other: { label: "Other", emoji: "🛒" },
};

/** Display order — roughly the order you walk a supermarket. */
export const CATEGORY_ORDER: ShoppingCategory[] = [
  "produce",
  "meat_seafood",
  "dairy_eggs",
  "bakery",
  "pantry",
  "spices",
  "frozen",
  "other",
];

// ─── Unit canonicalization ───────────────────────────────────────────────────

/**
 * Maps every accepted spelling to a canonical unit token. Only identical
 * canonical units are ever summed — we deliberately do NOT convert between
 * systems (no g -> oz) because rounding drift confuses more than it helps.
 */
const UNIT_ALIASES: Record<string, string> = {
  // mass
  g: "g",
  gr: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  oz: "oz",
  ozs: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  // volume
  ml: "ml",
  mls: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  cl: "cl",
  dl: "dl",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tblsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  pint: "pint",
  pints: "pint",
  quart: "quart",
  quarts: "quart",
  gallon: "gallon",
  gallons: "gallon",
  // countable
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
  piece: "piece",
  pieces: "piece",
  can: "can",
  cans: "can",
  tin: "can",
  tins: "can",
  jar: "jar",
  jars: "jar",
  packet: "packet",
  packets: "packet",
  pack: "packet",
  packs: "packet",
  bunch: "bunch",
  bunches: "bunch",
  sprig: "sprig",
  sprigs: "sprig",
  stalk: "stalk",
  stalks: "stalk",
  head: "head",
  heads: "head",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  handful: "handful",
  handfuls: "handful",
  strip: "strip",
  strips: "strip",
  fillet: "fillet",
  fillets: "fillet",
  sheet: "sheet",
  sheets: "sheet",
  stick: "stick",
  sticks: "stick",
};

/**
 * Reduces a unit to its canonical spelling so `grams` and `g` compare equal.
 * Unknown units are returned lowercased/trimmed so they still compare
 * consistently with themselves.
 */
export function canonicalizeUnit(unit: string | undefined | null): string {
  if (!unit) return "";
  const cleaned = unit
    .toLowerCase()
    .trim()
    .replace(/\.+$/, "")
    .replace(/\s+/g, " ");
  if (!cleaned) return "";
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

// ─── Quantity parsing ────────────────────────────────────────────────────────

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅐": 1 / 7,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
  "⅑": 1 / 9,
  "⅒": 0.1,
};

const UNICODE_FRACTION_CLASS = "½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒";

function parseQuantityToken(token: string): number | null {
  if (!token) return null;
  if (token in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[token];

  const fraction = /^(\d+)\/(\d+)$/.exec(token);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);

  return null;
}

/**
 * Parses a quantity string into a number, or returns `null` when the value
 * isn't numeric (`"a handful"`, `"to taste"`, `""`, `"2-3"`).
 *
 * Handles integers, decimals, simple fractions, unicode fractions, and mixed
 * numbers like `"1 1/2"` / `"1½"`.
 */
export function parseQuantity(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Split "1½" into "1 ½" so mixed numbers parse.
  const spaced = trimmed.replace(
    new RegExp(`(\\d)([${UNICODE_FRACTION_CLASS}])`, "g"),
    "$1 $2"
  );

  const tokens = spaced.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 2) return null;

  let total = 0;
  for (const token of tokens) {
    const value = parseQuantityToken(token);
    if (value === null) return null;
    total += value;
  }
  return total;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

// ─── Name normalization ──────────────────────────────────────────────────────

/**
 * Words that describe preparation or size but don't change what you put in
 * the basket, so "1 small onion, diced" and "2 onions" group together.
 */
const DESCRIPTORS = new Set([
  // preparation
  "diced",
  "minced",
  "chopped",
  "sliced",
  "shredded",
  "grated",
  "crushed",
  "cubed",
  "julienned",
  "quartered",
  "halved",
  "peeled",
  "trimmed",
  "rinsed",
  "drained",
  "washed",
  "beaten",
  "melted",
  "softened",
  "room",
  "temperature",
  // intensity adverbs
  "finely",
  "roughly",
  "coarsely",
  "thinly",
  "thickly",
  "freshly",
  "fresh",
  // size
  "large",
  "small",
  "medium",
  "big",
  "extra",
  "jumbo",
  // quality / sourcing
  "good",
  "quality",
  "organic",
  "free",
  "range",
  "ripe",
  "raw",
  // trailing modifiers
  "optional",
  "taste",
  "garnish",
  "serving",
  "serve",
  "needed",
  "desired",
  "divided",
  // filler
  "a",
  "an",
  "the",
  "of",
  "to",
  "for",
  "as",
  "or",
  "and",
  "plus",
  "more",
  "some",
  "about",
  "approx",
]);

const PLURAL_EXCEPTIONS = new Set([
  "hummus",
  "asparagus",
  "couscous",
  "molasses",
  "watercress",
  "swiss",
  "bass",
  "citrus",
  "brussels",
  "sprouts",
  "greens",
]);

const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: "leaf",
  loaves: "loaf",
  halves: "half",
  knives: "knife",
  potatoes: "potato",
  tomatoes: "tomato",
};

/** Deliberately naive singularizer — no stemming library, just plural trims. */
function singularize(word: string): string {
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word];
  if (word.length <= 3) return word;
  if (PLURAL_EXCEPTIONS.has(word)) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/(ch|sh|s|x|z)es$/.test(word)) return word.slice(0, -2);
  if (/oes$/.test(word)) return word.slice(0, -2);
  if (/ss$/.test(word)) return word;
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

function isQuantityToken(token: string): boolean {
  return parseQuantityToken(token) !== null;
}

/**
 * Produces the grouping key for an ingredient name: lowercased, stripped of
 * punctuation, embedded quantities, units and descriptors, then singularized.
 */
export function normalizeIngredientName(name: string): string {
  let text = (name ?? "").toLowerCase();

  // Parenthetical notes are never part of the thing you buy.
  text = text.replace(/\([^)]*\)/g, " ");
  // Keep letters, digits, spaces, decimal points and fraction slashes.
  text = text.replace(
    new RegExp(`[^a-z0-9\\s./${UNICODE_FRACTION_CLASS}]`, "g"),
    " "
  );
  text = text.replace(/\s+/g, " ").trim();

  const tokens = text
    .split(" ")
    .map((token) => token.replace(/\.+$/, ""))
    .filter(Boolean);

  if (tokens.length === 0) return "";

  const kept = tokens.filter(
    (token) =>
      !DESCRIPTORS.has(token) &&
      !isQuantityToken(token) &&
      !(token in UNIT_ALIASES)
  );

  // If stripping removed everything, the descriptors *were* the name.
  const base = kept.length > 0 ? kept : tokens;

  const result = [...base];
  result[result.length - 1] = singularize(result[result.length - 1]);
  return result.join(" ");
}

// ─── Categorization ──────────────────────────────────────────────────────────

const KEYWORD_CATEGORIES: Array<[string, ShoppingCategory]> = [
  // ── produce ────────────────────────────────────────────────────────────
  ["onion", "produce"],
  ["red onion", "produce"],
  ["spring onion", "produce"],
  ["green onion", "produce"],
  ["scallion", "produce"],
  ["shallot", "produce"],
  ["leek", "produce"],
  ["garlic", "produce"],
  ["ginger", "produce"],
  ["tomato", "produce"],
  ["cherry tomato", "produce"],
  ["bell pepper", "produce"],
  ["sweet pepper", "produce"],
  ["red pepper", "produce"],
  ["green pepper", "produce"],
  ["yellow pepper", "produce"],
  ["orange pepper", "produce"],
  ["jalapeno", "produce"],
  ["jalapeño", "produce"],
  ["poblano", "produce"],
  ["serrano", "produce"],
  ["habanero", "produce"],
  ["carrot", "produce"],
  ["potato", "produce"],
  ["sweet potato", "produce"],
  ["yam", "produce"],
  ["turnip", "produce"],
  ["parsnip", "produce"],
  ["beet", "produce"],
  ["radish", "produce"],
  ["celery", "produce"],
  ["fennel", "produce"],
  ["cucumber", "produce"],
  ["zucchini", "produce"],
  ["courgette", "produce"],
  ["squash", "produce"],
  ["butternut squash", "produce"],
  ["pumpkin", "produce"],
  ["eggplant", "produce"],
  ["aubergine", "produce"],
  ["lettuce", "produce"],
  ["romaine", "produce"],
  ["spinach", "produce"],
  ["kale", "produce"],
  ["arugula", "produce"],
  ["rocket", "produce"],
  ["chard", "produce"],
  ["cabbage", "produce"],
  ["bok choy", "produce"],
  ["broccoli", "produce"],
  ["cauliflower", "produce"],
  ["brussels sprout", "produce"],
  ["asparagus", "produce"],
  ["green bean", "produce"],
  ["snap pea", "produce"],
  ["snow pea", "produce"],
  ["sweetcorn", "produce"],
  ["corn on the cob", "produce"],
  ["mushroom", "produce"],
  ["avocado", "produce"],
  ["lemon", "produce"],
  ["lime", "produce"],
  ["orange", "produce"],
  ["grapefruit", "produce"],
  ["apple", "produce"],
  ["banana", "produce"],
  ["pear", "produce"],
  ["peach", "produce"],
  ["nectarine", "produce"],
  ["plum", "produce"],
  ["mango", "produce"],
  ["pineapple", "produce"],
  ["watermelon", "produce"],
  ["melon", "produce"],
  ["kiwi", "produce"],
  ["grape", "produce"],
  ["strawberry", "produce"],
  ["strawberries", "produce"],
  ["blueberry", "produce"],
  ["blueberries", "produce"],
  ["raspberry", "produce"],
  ["raspberries", "produce"],
  ["blackberry", "produce"],
  ["blackberries", "produce"],
  ["pomegranate", "produce"],
  // fresh herbs
  ["herb", "produce"],
  ["basil", "produce"],
  ["parsley", "produce"],
  ["cilantro", "produce"],
  ["fresh coriander", "produce"],
  ["mint", "produce"],
  ["dill", "produce"],
  ["chive", "produce"],
  ["tarragon", "produce"],
  ["fresh rosemary", "produce"],
  ["fresh thyme", "produce"],
  ["fresh oregano", "produce"],
  ["fresh sage", "produce"],
  ["lemongrass", "produce"],
  ["lime leaf", "produce"],

  // ── meat & seafood ─────────────────────────────────────────────────────
  ["beef", "meat_seafood"],
  ["ground beef", "meat_seafood"],
  ["steak", "meat_seafood"],
  ["brisket", "meat_seafood"],
  ["veal", "meat_seafood"],
  ["mince", "meat_seafood"],
  ["chicken", "meat_seafood"],
  ["chicken breast", "meat_seafood"],
  ["chicken thigh", "meat_seafood"],
  ["chicken wing", "meat_seafood"],
  ["turkey", "meat_seafood"],
  ["duck", "meat_seafood"],
  ["pork", "meat_seafood"],
  ["pork chop", "meat_seafood"],
  ["pork belly", "meat_seafood"],
  ["lamb", "meat_seafood"],
  ["bacon", "meat_seafood"],
  ["pancetta", "meat_seafood"],
  ["prosciutto", "meat_seafood"],
  ["ham", "meat_seafood"],
  ["salami", "meat_seafood"],
  ["pepperoni", "meat_seafood"],
  ["chorizo", "meat_seafood"],
  ["sausage", "meat_seafood"],
  ["meatball", "meat_seafood"],
  ["hot dog", "meat_seafood"],
  ["rib", "meat_seafood"],
  ["salmon", "meat_seafood"],
  ["tuna", "meat_seafood"],
  ["cod", "meat_seafood"],
  ["haddock", "meat_seafood"],
  ["halibut", "meat_seafood"],
  ["tilapia", "meat_seafood"],
  ["sea bass", "meat_seafood"],
  ["trout", "meat_seafood"],
  ["mackerel", "meat_seafood"],
  ["sardine", "meat_seafood"],
  ["anchovy", "meat_seafood"],
  ["anchovies", "meat_seafood"],
  ["fish", "meat_seafood"],
  ["shrimp", "meat_seafood"],
  ["prawn", "meat_seafood"],
  ["scallop", "meat_seafood"],
  ["crab", "meat_seafood"],
  ["lobster", "meat_seafood"],
  ["mussel", "meat_seafood"],
  ["clam", "meat_seafood"],
  ["oyster", "meat_seafood"],
  ["squid", "meat_seafood"],
  ["calamari", "meat_seafood"],
  ["octopus", "meat_seafood"],

  // ── dairy & eggs ───────────────────────────────────────────────────────
  ["milk", "dairy_eggs"],
  ["whole milk", "dairy_eggs"],
  ["skim milk", "dairy_eggs"],
  ["buttermilk", "dairy_eggs"],
  ["almond milk", "dairy_eggs"],
  ["oat milk", "dairy_eggs"],
  ["soy milk", "dairy_eggs"],
  ["butter", "dairy_eggs"],
  ["salted butter", "dairy_eggs"],
  ["unsalted butter", "dairy_eggs"],
  ["ghee", "dairy_eggs"],
  ["margarine", "dairy_eggs"],
  ["cheese", "dairy_eggs"],
  ["cream cheese", "dairy_eggs"],
  ["cottage cheese", "dairy_eggs"],
  ["goat cheese", "dairy_eggs"],
  ["mozzarella", "dairy_eggs"],
  ["parmesan", "dairy_eggs"],
  ["parmigiano", "dairy_eggs"],
  ["pecorino", "dairy_eggs"],
  ["cheddar", "dairy_eggs"],
  ["gruyere", "dairy_eggs"],
  ["gouda", "dairy_eggs"],
  ["brie", "dairy_eggs"],
  ["feta", "dairy_eggs"],
  ["ricotta", "dairy_eggs"],
  ["mascarpone", "dairy_eggs"],
  ["halloumi", "dairy_eggs"],
  ["cream", "dairy_eggs"],
  ["heavy cream", "dairy_eggs"],
  ["double cream", "dairy_eggs"],
  ["sour cream", "dairy_eggs"],
  ["whipping cream", "dairy_eggs"],
  ["creme fraiche", "dairy_eggs"],
  ["yogurt", "dairy_eggs"],
  ["yoghurt", "dairy_eggs"],
  ["greek yogurt", "dairy_eggs"],
  ["custard", "dairy_eggs"],
  ["egg", "dairy_eggs"],
  ["egg white", "dairy_eggs"],
  ["egg yolk", "dairy_eggs"],

  // ── bakery ─────────────────────────────────────────────────────────────
  ["bread", "bakery"],
  ["sourdough", "bakery"],
  ["baguette", "bakery"],
  ["ciabatta", "bakery"],
  ["focaccia", "bakery"],
  ["brioche", "bakery"],
  ["bun", "bakery"],
  ["hamburger bun", "bakery"],
  ["hot dog bun", "bakery"],
  ["roll", "bakery"],
  ["bagel", "bakery"],
  ["english muffin", "bakery"],
  ["muffin", "bakery"],
  ["croissant", "bakery"],
  ["tortilla", "bakery"],
  ["wrap", "bakery"],
  ["pita", "bakery"],
  ["naan", "bakery"],
  ["flatbread", "bakery"],
  ["pizza dough", "bakery"],
  ["puff pastry", "bakery"],
  ["phyllo", "bakery"],
  ["filo", "bakery"],
  ["pastry", "bakery"],
  ["cake", "bakery"],

  // ── pantry ─────────────────────────────────────────────────────────────
  ["flour", "pantry"],
  ["cornmeal", "pantry"],
  ["polenta", "pantry"],
  ["cornstarch", "pantry"],
  ["cornflour", "pantry"],
  ["sugar", "pantry"],
  ["brown sugar", "pantry"],
  ["powdered sugar", "pantry"],
  ["icing sugar", "pantry"],
  ["honey", "pantry"],
  ["maple syrup", "pantry"],
  ["syrup", "pantry"],
  ["molasses", "pantry"],
  ["baking powder", "pantry"],
  ["baking soda", "pantry"],
  ["bicarbonate of soda", "pantry"],
  ["yeast", "pantry"],
  ["gelatin", "pantry"],
  ["rice", "pantry"],
  ["arborio rice", "pantry"],
  ["basmati rice", "pantry"],
  ["pasta", "pantry"],
  ["spaghetti", "pantry"],
  ["penne", "pantry"],
  ["fusilli", "pantry"],
  ["macaroni", "pantry"],
  ["lasagna", "pantry"],
  ["lasagne", "pantry"],
  ["noodle", "pantry"],
  ["egg noodle", "pantry"],
  ["ramen", "pantry"],
  ["couscous", "pantry"],
  ["quinoa", "pantry"],
  ["bulgur", "pantry"],
  ["oat", "pantry"],
  ["cereal", "pantry"],
  ["oil", "pantry"],
  ["olive oil", "pantry"],
  ["vegetable oil", "pantry"],
  ["canola oil", "pantry"],
  ["sesame oil", "pantry"],
  ["coconut oil", "pantry"],
  ["sunflower oil", "pantry"],
  ["cooking spray", "pantry"],
  ["vinegar", "pantry"],
  ["balsamic", "pantry"],
  ["stock", "pantry"],
  ["broth", "pantry"],
  ["bouillon", "pantry"],
  ["stock cube", "pantry"],
  ["chicken stock", "pantry"],
  ["chicken broth", "pantry"],
  ["beef stock", "pantry"],
  ["beef broth", "pantry"],
  ["vegetable stock", "pantry"],
  ["vegetable broth", "pantry"],
  ["bean", "pantry"],
  ["black bean", "pantry"],
  ["kidney bean", "pantry"],
  ["chickpea", "pantry"],
  ["lentil", "pantry"],
  ["tomato paste", "pantry"],
  ["tomato puree", "pantry"],
  ["tomato sauce", "pantry"],
  ["canned tomato", "pantry"],
  ["crushed tomato", "pantry"],
  ["diced tomato", "pantry"],
  ["passata", "pantry"],
  ["sun dried tomato", "pantry"],
  ["coconut milk", "pantry"],
  ["coconut cream", "pantry"],
  ["coconut", "pantry"],
  ["condensed milk", "pantry"],
  ["evaporated milk", "pantry"],
  ["soy sauce", "pantry"],
  ["fish sauce", "pantry"],
  ["oyster sauce", "pantry"],
  ["hoisin", "pantry"],
  ["worcestershire", "pantry"],
  ["hot sauce", "pantry"],
  ["sriracha", "pantry"],
  ["ketchup", "pantry"],
  ["mustard", "pantry"],
  ["mayonnaise", "pantry"],
  ["mayo", "pantry"],
  ["salsa", "pantry"],
  ["tahini", "pantry"],
  ["miso", "pantry"],
  ["curry paste", "pantry"],
  ["peanut butter", "pantry"],
  ["jam", "pantry"],
  ["jelly", "pantry"],
  ["marmalade", "pantry"],
  ["nutella", "pantry"],
  ["chocolate", "pantry"],
  ["chocolate chip", "pantry"],
  ["cocoa", "pantry"],
  ["nut", "pantry"],
  ["almond", "pantry"],
  ["walnut", "pantry"],
  ["pecan", "pantry"],
  ["cashew", "pantry"],
  ["peanut", "pantry"],
  ["pistachio", "pantry"],
  ["hazelnut", "pantry"],
  ["pine nut", "pantry"],
  ["seed", "pantry"],
  ["sesame seed", "pantry"],
  ["sunflower seed", "pantry"],
  ["raisin", "pantry"],
  ["sultana", "pantry"],
  ["dried cranberry", "pantry"],
  ["date", "pantry"],
  ["prune", "pantry"],
  ["apricot", "pantry"],
  ["breadcrumb", "pantry"],
  ["panko", "pantry"],
  ["crouton", "pantry"],
  ["olive", "pantry"],
  ["caper", "pantry"],
  ["pickle", "pantry"],
  ["gherkin", "pantry"],
  ["wine", "pantry"],
  ["vanilla", "pantry"],
  ["vanilla extract", "pantry"],
  ["almond extract", "pantry"],
  ["food coloring", "pantry"],
  ["nutritional yeast", "pantry"],
  ["cracker", "pantry"],
  ["tortilla chip", "pantry"],

  // ── spices ─────────────────────────────────────────────────────────────
  ["salt", "spices"],
  ["sea salt", "spices"],
  ["kosher salt", "spices"],
  ["pepper", "spices"],
  ["black pepper", "spices"],
  ["white pepper", "spices"],
  ["peppercorn", "spices"],
  ["paprika", "spices"],
  ["smoked paprika", "spices"],
  ["cumin", "spices"],
  ["coriander", "spices"],
  ["oregano", "spices"],
  ["thyme", "spices"],
  ["rosemary", "spices"],
  ["sage", "spices"],
  ["bay leaf", "spices"],
  ["cinnamon", "spices"],
  ["nutmeg", "spices"],
  ["allspice", "spices"],
  ["clove", "spices"],
  ["cardamom", "spices"],
  ["star anise", "spices"],
  ["fennel seed", "spices"],
  ["mustard seed", "spices"],
  ["chili", "spices"],
  ["chilli", "spices"],
  ["chili powder", "spices"],
  ["chili flake", "spices"],
  ["red pepper flake", "spices"],
  ["cayenne", "spices"],
  ["turmeric", "spices"],
  ["curry powder", "spices"],
  ["garam masala", "spices"],
  ["five spice", "spices"],
  ["za atar", "spices"],
  ["sumac", "spices"],
  ["seasoning", "spices"],
  ["italian seasoning", "spices"],
  ["taco seasoning", "spices"],
  ["garlic powder", "spices"],
  ["onion powder", "spices"],
  ["spice", "spices"],
  ["dried basil", "spices"],
  ["dried oregano", "spices"],
  ["dried thyme", "spices"],
  ["ground ginger", "spices"],

  // ── frozen ─────────────────────────────────────────────────────────────
  ["ice cream", "frozen"],
  ["ice", "frozen"],
  ["sorbet", "frozen"],
  ["puff pastry sheet", "frozen"],
];

/**
 * Keywords sorted so the most specific match wins: more words first, then
 * longer strings. That's what makes "tomato paste" -> pantry beat
 * "tomato" -> produce.
 */
const SORTED_KEYWORDS: Array<{
  keyword: string;
  category: ShoppingCategory;
  pattern: RegExp;
}> = KEYWORD_CATEGORIES.map(([keyword, category]) => ({
  keyword,
  category,
  pattern: buildKeywordPattern(keyword),
})).sort((a, b) => {
  const wordsA = a.keyword.split(" ").length;
  const wordsB = b.keyword.split(" ").length;
  if (wordsA !== wordsB) return wordsB - wordsA;
  return b.keyword.length - a.keyword.length;
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary match with an optional plural suffix, so "onion" matches
 * "onions" and "tomato" matches "tomatoes" but "pepper" never matches
 * "peppercorn".
 *
 * Uses explicit lookarounds rather than `\b` so keywords with non-ASCII
 * letters ("jalapeño") still anchor correctly.
 */
function buildKeywordPattern(keyword: string): RegExp {
  return new RegExp(
    `(?<![a-z0-9])${escapeRegex(keyword)}(?:e?s)?(?![a-z0-9])`,
    "i"
  );
}

const FROZEN_PATTERN = /\bfrozen\b/i;

/**
 * Assigns a supermarket section to an ingredient name using keyword matching.
 * Free and instant — no model call.
 */
export function categorizeIngredient(name: string): ShoppingCategory {
  if (!name) return "other";

  // "frozen X" always belongs in the freezer aisle regardless of what X is.
  if (FROZEN_PATTERN.test(name)) return "frozen";

  const haystack = name.toLowerCase().replace(/[_/]+/g, " ");

  for (const entry of SORTED_KEYWORDS) {
    if (entry.pattern.test(haystack)) return entry.category;
  }

  return "other";
}

// ─── Merging ─────────────────────────────────────────────────────────────────

interface GroupEntry {
  quantity: string;
  unit: string;
  canonicalUnit: string;
}

interface Group {
  key: string;
  originalNames: string[];
  entries: GroupEntry[];
  recipeTitles: string[];
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Prefer the shortest original spelling — it's usually the cleanest. */
function pickDisplayName(originalNames: string[], fallbackKey: string): string {
  const candidates = originalNames
    .map((name) => name.trim().replace(/[\s,;:.]+$/, ""))
    .filter((name) => name.length > 0);

  if (candidates.length === 0) return titleCase(fallbackKey);

  let best = candidates[0];
  for (const candidate of candidates) {
    if (candidate.length < best.length) best = candidate;
  }
  return titleCase(best);
}

function formatEntry(entry: GroupEntry): string {
  const parts = [entry.quantity.trim(), entry.unit.trim()].filter(
    (part) => part.length > 0
  );
  return parts.join(" ");
}

/**
 * Consolidates the ingredients of several recipes into one shopping list.
 *
 * Quantities are summed only when every entry in a group shares the same
 * canonical unit and every quantity parses as a number. Otherwise the raw
 * quantities are listed side by side so nothing is silently lost.
 */
export function mergeIngredients(
  recipes: ShoppingListRecipe[]
): ShoppingListItem[] {
  const groups = new Map<string, Group>();

  for (const recipe of recipes ?? []) {
    for (const ingredient of recipe?.ingredients ?? []) {
      const rawName = ingredient?.name ?? "";
      const key = normalizeIngredientName(rawName);
      if (!key) continue;

      let group = groups.get(key);
      if (!group) {
        group = { key, originalNames: [], entries: [], recipeTitles: [] };
        groups.set(key, group);
      }

      group.originalNames.push(rawName);
      group.entries.push({
        quantity: ingredient.quantity ?? "",
        unit: ingredient.unit ?? "",
        canonicalUnit: canonicalizeUnit(ingredient.unit),
      });

      const title = recipe.title ?? "";
      if (title && !group.recipeTitles.includes(title)) {
        group.recipeTitles.push(title);
      }
    }
  }

  return Array.from(groups.values()).map((group) => {
    const quantities = group.entries
      .map(formatEntry)
      .filter((value) => value.length > 0);

    const name = pickDisplayName(group.originalNames, group.key);

    return {
      name,
      quantities,
      merged: buildMergedQuantity(group.entries, quantities),
      category: categorizeIngredient(name),
      recipeTitles: group.recipeTitles,
      checked: false,
    };
  });
}

function buildMergedQuantity(
  entries: GroupEntry[],
  quantities: string[]
): string {
  if (entries.length === 0) return "";

  const canonicalUnit = entries[0].canonicalUnit;
  const sameUnit = entries.every(
    (entry) => entry.canonicalUnit === canonicalUnit
  );

  if (sameUnit) {
    const parsed = entries.map((entry) => parseQuantity(entry.quantity));
    if (parsed.every((value) => value !== null)) {
      const total = (parsed as number[]).reduce((sum, value) => sum + value, 0);
      // Reuse the first original spelling so "cups" doesn't become "cup".
      const unitLabel =
        entries.find((entry) => entry.unit.trim().length > 0)?.unit.trim() ?? "";
      return [formatNumber(total), unitLabel]
        .filter((part) => part.length > 0)
        .join(" ");
    }
  }

  return quantities.join(" + ");
}

// ─── Grouping ────────────────────────────────────────────────────────────────

/**
 * Buckets items by category. Every category key is always present so callers
 * can iterate `CATEGORY_ORDER` without null checks.
 */
export function groupByCategory(
  items: ShoppingListItem[]
): Record<ShoppingCategory, ShoppingListItem[]> {
  const grouped = {} as Record<ShoppingCategory, ShoppingListItem[]>;
  for (const category of CATEGORY_ORDER) {
    grouped[category] = [];
  }
  for (const item of items ?? []) {
    (grouped[item.category] ?? grouped.other).push(item);
  }
  return grouped;
}
