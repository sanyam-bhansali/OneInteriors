-- Additional scope (owner, 12 Nov 2026): a quotation for new items after the
-- design final, sent as a change order with its payment due at once and the
-- extra days it needs; the project holds until it is paid.
-- Expand only: nullable columns, nothing existing changed.
ALTER TABLE "studio_quotes" ADD COLUMN "scopeForProjectId" TEXT;
CREATE INDEX "studio_quotes_scopeForProjectId_idx" ON "studio_quotes"("scopeForProjectId");

ALTER TABLE "home_change_orders" ADD COLUMN "scopeQuoteId" TEXT;
ALTER TABLE "home_change_orders" ADD COLUMN "daysRequired" INTEGER;
ALTER TABLE "home_change_orders" ADD COLUMN "dueOn" DATE;

ALTER TABLE "home_project_holds" ADD COLUMN "changeOrderId" TEXT;
