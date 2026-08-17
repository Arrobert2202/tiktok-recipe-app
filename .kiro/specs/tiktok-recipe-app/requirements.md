# Requirements Document

## Introduction

A micro-SaaS MVP that allows users to paste TikTok video URLs and automatically extract structured recipes (ingredients and steps) using an LLM-powered extraction pipeline. Users can save recipes to a personal cookbook, edit LLM parsing mistakes, and share recipes publicly via viral-friendly share pages. The app includes ethical safeguards allowing creators to opt out of having their content indexed.

## Glossary

- **Extraction_Pipeline**: The backend system that processes TikTok URLs through a sequence of strategies (cache lookup, oEmbed, caption parsing, native captions, ASR fallback) to extract recipe data
- **Recipe_Parser**: The component that uses the Vercel AI SDK with Zod schemas to structure raw text (captions, transcripts) into typed recipe objects (ingredients, steps, metadata)
- **Cookbook**: A user's personal collection of saved recipes
- **Cook_Mode**: A fullscreen, distraction-free view of a recipe with wake-lock enabled to prevent screen sleep
- **Share_Page**: A publicly accessible, SEO-indexable page at `/r/[slug]` displaying a recipe with OG image metadata
- **OG_Image_Generator**: The `@vercel/og` powered system that produces dynamic Open Graph images for social previews
- **Creator_Portal**: The `/creators` page and associated API allowing TikTok creators to opt out or manage how their content appears
- **Extraction_Job**: A background job (Trigger.dev or Inngest) that performs the asynchronous extraction work
- **User**: An authenticated person using the app to extract and save recipes
- **Creator**: The TikTok content creator who originally published the video
- **Attribution_Block**: The UI component displaying creator handle, profile link, and embedded TikTok video

## Requirements

### Requirement 1: TikTok URL Submission

**User Story:** As a user, I want to paste a TikTok video URL into the app, so that I can extract a recipe from the video.

#### Acceptance Criteria

1. WHEN a user submits a URL, THE Extraction_Pipeline SHALL validate that the URL matches one of the following TikTok video URL patterns: long-form (`tiktok.com/@{user}/video/{id}`), short-form (`vm.tiktok.com/{shortcode}`), or mobile share links (`tiktok.com/t/{shortcode}`), accepting URLs with or without `https://www` prefix and ignoring trailing query parameters
2. IF a user submits a URL that does not match any recognized TikTok video URL pattern, THEN THE Extraction_Pipeline SHALL return an error message indicating the URL is not a valid TikTok video link, within 2 seconds of submission
3. WHEN a valid TikTok URL is submitted, THE Extraction_Pipeline SHALL create an Extraction_Job and return a unique job identifier to the user within 3 seconds
4. WHILE an Extraction_Job is in progress, THE Extraction_Pipeline SHALL provide status updates to the user at least every 5 seconds, indicating the current extraction stage (e.g., cache lookup, oEmbed retrieval, caption parsing, transcription)
5. IF a user submits a TikTok URL for which an Extraction_Job is already in progress, THEN THE Extraction_Pipeline SHALL return the existing job identifier and current status rather than creating a duplicate job
6. IF a user submits a URL exceeding 2048 characters in length, THEN THE Extraction_Pipeline SHALL reject the submission with an error message indicating the URL exceeds the maximum allowed length

### Requirement 2: Extraction Ladder Strategy

**User Story:** As a user, I want the system to try multiple extraction strategies in sequence, so that I get the best possible recipe extraction regardless of the video's caption quality.

#### Acceptance Criteria

1. WHEN an Extraction_Job begins, THE Extraction_Pipeline SHALL first check the cache for a previously extracted recipe matching the canonical TikTok URL and return the cached result within 1 second if found
2. IF no cached result exists for the submitted URL, THEN THE Extraction_Pipeline SHALL attempt oEmbed metadata retrieval from TikTok with a timeout of 10 seconds
3. WHEN oEmbed metadata is retrieved, THE Extraction_Pipeline SHALL check the video caption for recipe content, defined as text containing at least one ingredient quantity and one action verb (e.g., "mix", "bake", "chop")
4. IF the caption does not meet the recipe content criteria, THEN THE Extraction_Pipeline SHALL attempt to retrieve native captions (subtitles) from the video with a timeout of 15 seconds
5. IF native captions are unavailable or do not meet the recipe content criteria, THEN THE Extraction_Pipeline SHALL fall back to ASR (Automatic Speech Recognition) transcription with a timeout of 60 seconds
6. WHEN extraction completes via any strategy, THE Extraction_Pipeline SHALL record which strategy produced the final result along with the processing duration
7. IF all extraction strategies fail or time out, THEN THE Extraction_Pipeline SHALL mark the Extraction_Job as failed and return an error indicating which strategies were attempted and the reason each failed
8. THE Extraction_Pipeline SHALL execute the full strategy ladder within a maximum total duration of 120 seconds before marking the job as timed out

### Requirement 3: LLM-Powered Recipe Parsing

**User Story:** As a user, I want extracted text to be parsed into structured recipe data, so that I can view ingredients and steps in a clean format.

#### Acceptance Criteria

1. WHEN raw text is available from any extraction strategy, THE Recipe_Parser SHALL produce a structured recipe object validated against a Zod schema within 30 seconds of receiving the input text
2. THE Recipe_Parser SHALL extract a recipe title (maximum 200 characters), a list of at least 1 ingredient, and at least 1 ordered preparation step from the input text
3. THE Recipe_Parser SHALL structure each ingredient with a required name field, and optional quantity and unit fields, using the raw text as the quantity value when a numeric measurement cannot be determined (e.g., "a handful" stored as quantity)
4. IF the Recipe_Parser cannot identify at least 1 ingredient and at least 1 preparation step from the provided text, THEN THE Recipe_Parser SHALL return a structured error indicating the failure reason and the source text that was attempted
5. IF the input text exceeds 50,000 characters, THEN THE Recipe_Parser SHALL reject the input with a structured error indicating the text length limit was exceeded
6. FOR ALL valid structured recipe objects, parsing then serializing then parsing SHALL produce an object with identical field values (round-trip property)

### Requirement 4: Recipe Page Display

**User Story:** As a user, I want to view an extracted recipe on a dedicated page, so that I can read ingredients and steps clearly.

#### Acceptance Criteria

1. WHEN a user navigates to a recipe page, THE Recipe_Page SHALL display the official TikTok embed iframe for the source video, rendered at full width of its container and maintaining the video's aspect ratio
2. IF the TikTok embed fails to load within 10 seconds, THEN THE Recipe_Page SHALL display a fallback link to the original TikTok video URL
3. THE Recipe_Page SHALL display the Attribution_Block containing the creator's @handle and a link to the creator's TikTok profile
4. THE Recipe_Page SHALL display ingredients as a list with checkboxes that toggle between checked and unchecked states on user interaction, with checked state persisted for the duration of the browser session
5. THE Recipe_Page SHALL display preparation steps in numbered order matching the sequence from the structured recipe object
6. WHILE the viewport width is 1024px or greater, THE Attribution_Block SHALL be visible without scrolling, positioned above the fold within the top portion of the page layout
7. IF a user navigates to a recipe page for a recipe that does not exist or cannot be loaded, THEN THE Recipe_Page SHALL display an error message indicating the recipe is unavailable

### Requirement 5: Cook Mode

**User Story:** As a user, I want a fullscreen cooking mode, so that I can follow the recipe hands-free without my screen turning off.

#### Acceptance Criteria

1. WHEN a user activates Cook_Mode, THE Recipe_Page SHALL enter a full-viewport display showing only ingredients and the current step, with a minimum body text size of 24px and minimum touch-target size of 48x48px
2. WHILE Cook_Mode is active, THE Recipe_Page SHALL display one preparation step at a time and provide forward and backward navigation controls to move between steps
3. WHEN Cook_Mode is activated, THE Recipe_Page SHALL request a wake-lock to prevent the device screen from sleeping
4. WHEN Cook_Mode is deactivated, THE Recipe_Page SHALL release the wake-lock and return to normal Recipe_Page view
5. IF wake-lock is not supported by the browser, THEN THE Recipe_Page SHALL display Cook_Mode without wake-lock and show a persistent inline notice indicating that automatic screen-sleep prevention is unavailable
6. IF the wake-lock is released by the operating system while Cook_Mode is active, THEN THE Recipe_Page SHALL attempt to re-acquire the wake-lock when the page regains visibility
7. WHEN a user activates Cook_Mode, THE Recipe_Page SHALL display a visible control to exit Cook_Mode without requiring gestures or multi-step interaction

### Requirement 6: Personal Cookbook

**User Story:** As a user, I want to save recipes to my personal cookbook, so that I can access them later.

#### Acceptance Criteria

1. WHEN an authenticated user saves a recipe, THE Cookbook SHALL add the recipe to the user's collection and display a visible confirmation indicator within 1 second
2. IF an authenticated user saves a recipe that already exists in their collection, THEN THE Cookbook SHALL inform the user that the recipe is already saved without creating a duplicate entry
3. THE Cookbook SHALL display all saved recipes with title, thumbnail, and creator attribution, sorted by most recently saved by default, with options to sort by title or date added
4. WHEN a user searches their Cookbook, THE Cookbook SHALL filter recipes by title, ingredient, or tag and return matching results within 300 milliseconds for collections of up to 500 recipes
5. WHEN a user adds or removes tags on a recipe, THE Cookbook SHALL persist the tag changes within 1 second, where each tag is a free-form text label of at most 50 characters and a recipe may have at most 20 tags
6. IF an unauthenticated user attempts to save a recipe, THEN THE Cookbook SHALL prompt the user to sign in or create an account before completing the save action
7. WHEN an authenticated user removes a recipe from their Cookbook, THE Cookbook SHALL delete the recipe from the user's collection and remove it from the displayed list without requiring a page reload

### Requirement 7: Recipe Edit Modal

**User Story:** As a user, I want to edit extracted recipe data, so that I can correct any LLM parsing mistakes.

#### Acceptance Criteria

1. WHEN a user opens the edit modal for a saved recipe, THE Edit_Modal SHALL display all editable fields (title, ingredients, steps, tags) pre-populated with current values, and SHALL support adding, removing, and reordering items in the ingredients and steps lists
2. WHEN a user submits edits, THE Edit_Modal SHALL validate that the title is non-empty and at most 200 characters, that at least one ingredient is present, and that at least one step is present, and SHALL persist valid changes to the database
3. IF validation fails on edit submission, THEN THE Edit_Modal SHALL display an error indication next to each invalid field and SHALL NOT persist changes or close the modal
4. IF a user cancels editing without saving, THEN THE Edit_Modal SHALL discard all unsaved changes and close
5. WHEN edits are saved successfully, THE Recipe_Page SHALL reflect the updated data within 1 second without a full page reload
6. IF persistence fails when saving edits, THEN THE Edit_Modal SHALL display an error message indicating the save failed and SHALL retain the user's in-progress edits

### Requirement 8: Public Share Pages

**User Story:** As a user, I want to share a recipe via a public URL, so that my friends can view it even without an account.

#### Acceptance Criteria

1. THE Share_Page SHALL be accessible at the path `/r/[slug]` where slug is an alphanumeric string between 8 and 21 characters in length, uniquely identifying a recipe
2. THE Share_Page SHALL include Open Graph meta tags (og:title, og:description, og:image, og:url) and Twitter Card meta tags (twitter:card, twitter:title, twitter:description, twitter:image) for rich previews on social platforms
3. WHEN a Share_Page is loaded, THE OG_Image_Generator SHALL produce a 1200×630 pixel Open Graph image containing the recipe title and a food-related visual
4. IF a visitor navigates to a Share_Page with a slug that does not correspond to any existing recipe, THEN THE Share_Page SHALL display a not-found message and return an HTTP 404 status
5. THE Share_Page SHALL display a "Save to your cookbook" call-to-action button for visitors
6. WHEN an unauthenticated visitor clicks "Save to your cookbook", THE Share_Page SHALL redirect to sign-in with a return path back to the recipe
7. WHEN an authenticated visitor clicks "Save to your cookbook", THE Share_Page SHALL add the recipe to the user's Cookbook and display a save confirmation

### Requirement 9: Creator Attribution and Embedding

**User Story:** As a user, I want to see proper credit to the original TikTok creator, so that I respect their work and can follow them.

#### Acceptance Criteria

1. THE Recipe_Page SHALL display the creator's TikTok @handle as a clickable link to the creator's TikTok profile URL obtained from oEmbed author_url
2. THE Share_Page SHALL display an Attribution_Block containing the same creator data (handle, display name, profile link, and embedded video) as the Recipe_Page
3. IF the creator's display name is available from oEmbed metadata, THEN THE Attribution_Block SHALL display the display name alongside the @handle
4. IF oEmbed metadata does not provide the creator's display name, THEN THE Attribution_Block SHALL display only the @handle as the creator identifier
5. THE Attribution_Block SHALL include the official TikTok embed iframe for the source video

### Requirement 10: Creator Opt-Out System

**User Story:** As a creator, I want to opt out of having my content indexed by this app, so that I maintain control over how my content is used.

#### Acceptance Criteria

1. THE Creator_Portal SHALL allow a creator to submit an opt-out request by providing their TikTok handle and completing an identity verification step (email-based or link verification)
2. WHEN a creator submits a valid opt-out request, THE Creator_Portal SHALL display a confirmation acknowledging the request and stating that changes will take effect within 24 hours
3. WHEN a creator opts out, THE Extraction_Pipeline SHALL block extraction of any video associated with the opted-out creator handle within 24 hours
4. WHEN a creator opts out, THE Cookbook SHALL remove existing recipes from that creator from public Share_Pages within 24 hours, while retaining the recipes in users' private Cookbooks with a visible notice indicating the creator has opted out
5. WHEN a user attempts to extract a video from an opted-out creator, THE Extraction_Pipeline SHALL inform the user that the creator has opted out and the recipe cannot be extracted
6. THE Creator_Portal SHALL allow a creator to reverse their opt-out decision at any time by completing the same identity verification step
7. WHEN a creator reverses their opt-out, THE Cookbook SHALL restore previously removed recipes to their associated public Share_Pages within 24 hours
8. IF a creator submits a TikTok handle that does not match the expected format (alphanumeric characters and underscores, 1 to 24 characters), THEN THE Creator_Portal SHALL reject the submission with an error message indicating the handle format is invalid

### Requirement 11: Ingest-Level Gating

**User Story:** As a system operator, I want extraction to be blocked at the ingest level for opted-out creators, so that no processing resources are wasted on blocked content.

#### Acceptance Criteria

1. WHEN a TikTok URL is submitted, THE Extraction_Pipeline SHALL resolve the creator handle from the URL and check the creator opt-out list before creating an Extraction_Job
2. IF the creator associated with the URL is on the opt-out list, THEN THE Extraction_Pipeline SHALL reject the request within 500 milliseconds without starting an Extraction_Job and return an indication that the creator has opted out
3. IF the creator handle cannot be resolved from the submitted URL, THEN THE Extraction_Pipeline SHALL reject the request with an error indicating that the creator could not be identified
4. THE Extraction_Pipeline SHALL cache the opt-out list with a maximum staleness of 5 minutes
5. IF the opt-out list source is unavailable when the cache expires, THEN THE Extraction_Pipeline SHALL continue using the stale cached list and retry refreshing on the next request

### Requirement 12: User Authentication

**User Story:** As a user, I want to sign in to the app, so that my cookbook and preferences are persisted across sessions.

#### Acceptance Criteria

1. THE Authentication_System SHALL support email/password sign-up and sign-in, and Google OAuth social login via Better-Auth
2. WHEN a user signs in successfully, THE Authentication_System SHALL create a server-side session with a maximum duration of 30 days and redirect the user to their Cookbook
3. IF authentication fails, THEN THE Authentication_System SHALL display a generic error message indicating invalid credentials without revealing whether the email exists in the system
4. WHEN a user signs out, THE Authentication_System SHALL invalidate the session and redirect to the home page
5. IF an unauthenticated user attempts to access a protected route (Cookbook, Edit), THEN THE Authentication_System SHALL redirect the user to the sign-in page with a return path to the originally requested page
6. WHEN a new user signs up with email/password, THE Authentication_System SHALL require a password of 8 to 128 characters and a valid email address before creating the account

### Requirement 13: Extraction Result Caching

**User Story:** As a user, I want previously extracted recipes to load instantly, so that I do not wait for re-extraction of the same video.

#### Acceptance Criteria

1. WHEN an extraction completes successfully, THE Extraction_Pipeline SHALL store the result in a cache keyed by the canonical TikTok URL, where canonicalization strips tracking parameters, resolves shortlink redirects, and normalizes the URL to a single deterministic form per video
2. WHEN a cached result exists for a submitted URL, THE Extraction_Pipeline SHALL return the cached recipe without starting a new Extraction_Job within 500 milliseconds of the request
3. WHEN a creator opts out, THE Extraction_Pipeline SHALL invalidate all cached results associated with that creator's handle within 24 hours
4. WHEN a user submits a TikTok URL, THE Extraction_Pipeline SHALL canonicalize the URL before performing the cache lookup so that all format variants of the same video resolve to the same cache entry
5. IF a cached result fails schema validation upon retrieval, THEN THE Extraction_Pipeline SHALL discard the invalid cache entry and initiate a new Extraction_Job for the URL

### Requirement 14: Recipe Data Serialization

**User Story:** As a developer, I want recipe data to serialize and deserialize reliably, so that data integrity is maintained across storage and retrieval.

#### Acceptance Criteria

1. THE Recipe_Parser SHALL serialize structured recipe objects to JSON for database storage, preserving all fields defined in the Zod schema including nested ingredients (quantity, unit, name) and ordered steps arrays
2. THE Recipe_Parser SHALL deserialize JSON from the database back into structured recipe objects validated against the Zod schema
3. FOR ALL valid recipe objects, serializing to JSON then deserializing SHALL produce a deeply equal object preserving array ordering, numeric precision of quantities, and presence or absence of optional fields (round-trip property)
4. IF the Recipe_Parser encounters invalid or malformed JSON during deserialization, THEN THE Recipe_Parser SHALL return a structured error indicating the validation failure rather than a partial or default object
5. IF the Recipe_Parser encounters JSON that is valid but does not conform to the Zod schema, THEN THE Recipe_Parser SHALL return a structured error indicating which fields failed validation
