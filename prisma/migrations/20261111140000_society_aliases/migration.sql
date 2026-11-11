-- Society spellings (owner, 11 Nov 2026): the other ways leads type a society,
-- so typos link to it. Expand only: one column with a default, nothing changed.
ALTER TABLE "studio_societies" ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
