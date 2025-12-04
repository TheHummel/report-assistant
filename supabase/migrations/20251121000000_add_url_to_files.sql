-- Add url field to files table for storing storage URLs
-- Note: This migration is now a no-op since url column is in the initial schema
-- Keeping for migration history compatibility

-- alter table files
--   add column if not exists url text;

-- create index if not exists files_url_idx
--   on files (url);

