-- Simple additional scope (owner, 13 Nov 2026): "It should not open the whole
-- quotation builder ... just a click: write the element, write the cost,
-- write the days, send for approval." Lines go in home_change_order_lines as
-- custom lines; these say what the scope does to the timeline.
-- Expand only: a new enum and two nullable columns, nothing existing changed.
CREATE TYPE "ScopeImpact" AS ENUM ('MOVES_PROJECT', 'WITHIN_TIMELINE', 'ITEM_ONLY');

ALTER TABLE "home_change_orders" ADD COLUMN "scopeImpact" "ScopeImpact";
ALTER TABLE "home_change_orders" ADD COLUMN "itemDueOn" DATE;
