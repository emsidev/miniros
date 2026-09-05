-- Commit enum additions before the draft policies migration. Existing defaults and rows stay scheduled/assigned.
ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.shift_assignment_status ADD VALUE IF NOT EXISTS 'draft';
