-- A note for the client on any quotation line (owner's team, 15 Oct 2026):
-- written in the builder, printed under the line's details on the quotation
-- PDF and the Final PDF. A column on an existing table (RLS already on for
-- "studio_quote_lines"); no new table.
ALTER TABLE "studio_quote_lines" ADD COLUMN "note" TEXT;
