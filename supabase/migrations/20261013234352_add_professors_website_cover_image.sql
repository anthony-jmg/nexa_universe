/*
# Add website cover image for professors (Academy Discovery)

1. Modified Tables
- `professors`
  - Add `website_cover_image` (text, nullable): optional cover image shown on the
    professor's card on the public Academy Discovery page. When empty, the page
    displays an elegant fallback instead. No existing data is modified.

2. Security
- No change: RLS remains enabled with the existing policies; the new nullable
  column is readable/writable through the same policies as the rest of the row.
*/

ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS website_cover_image text;
